using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using Army2.Model;

namespace Army2.Network
{
    public sealed class SessionME : ISession
    {
        public static readonly SessionME Instance = new SessionME();
        private static readonly ConcurrentQueue<Message> ReceiveMessages = new ConcurrentQueue<Message>();
        private static readonly ConcurrentQueue<Action> MainThreadActions = new ConcurrentQueue<Action>();
        private readonly ConcurrentQueue<Message> sendingMessages = new ConcurrentQueue<Message>();
        private IMessageHandler messageHandler;
        private TcpClient client;
        private NetworkStream stream;
        private CancellationTokenSource cancellation;
        private byte[] key;
        private int curR;
        private int curW;
        private bool getKeyComplete;

        public bool Connected { get; private set; }
        public bool Connecting { get; private set; }
        public int SendByteCount { get; private set; }
        public int RecvByteCount { get; private set; }

        private SessionME()
        {
        }

        public bool IsConnected()
        {
            return Connected;
        }

        public void SetHandler(IMessageHandler handler)
        {
            messageHandler = handler;
        }

        public void Connect(string host, int port)
        {
            if (Connected || Connecting)
            {
                return;
            }

            CRes.Out("connect to " + host + ":" + port);
            Close(0);
            cancellation = new CancellationTokenSource();
            Connecting = true;
            getKeyComplete = false;
            key = null;
            curR = 0;
            curW = 0;

            _ = Task.Run(() => NetworkInitAsync(host, port, cancellation.Token));
        }

        public void SendMessage(Message message)
        {
            sendingMessages.Enqueue(message);
        }

        public void Close(int index)
        {
            CRes.Out("Clean network " + index);
            cancellation?.Cancel();
            cancellation = null;
            Connected = false;
            Connecting = false;
            getKeyComplete = false;
            key = null;
            curR = 0;
            curW = 0;

            try
            {
                stream?.Close();
                client?.Close();
            }
            catch (Exception e)
            {
                CRes.Err(e.Message);
            }

            stream = null;
            client = null;

            while (ReceiveMessages.TryDequeue(out _))
            {
            }

            while (sendingMessages.TryDequeue(out _))
            {
            }
        }

        public static void Update()
        {
            while (MainThreadActions.TryDequeue(out var action))
            {
                action();
            }

            while (ReceiveMessages.TryDequeue(out var message))
            {
                Instance.messageHandler?.OnMessage(message);
            }
        }

        private async Task NetworkInitAsync(string host, int port, CancellationToken token)
        {
            try
            {
                client = new TcpClient();
                var connectTask = client.ConnectAsync(host, port);
                var timeoutTask = Task.Delay(20000, token);
                var completed = await Task.WhenAny(connectTask, timeoutTask);
                if (completed != connectTask)
                {
                    throw new TimeoutException("connect timeout");
                }

                await connectTask;
                stream = client.GetStream();
                Connected = true;
                Connecting = false;

                _ = Task.Run(() => SenderLoopAsync(token), token);
                _ = Task.Run(() => CollectorLoopAsync(token), token);

                await DoSendMessageAsync(new Message(-27), token);
                EnqueueMainThread(() => messageHandler?.OnConnectOK());
            }
            catch (Exception e)
            {
                CRes.Err("connect failed: " + e.Message);
                Connected = false;
                Connecting = false;
                EnqueueMainThread(() => messageHandler?.OnConnectionFail());
            }
        }

        private async Task SenderLoopAsync(CancellationToken token)
        {
            while (Connected && !token.IsCancellationRequested)
            {
                if (getKeyComplete)
                {
                    while (sendingMessages.TryDequeue(out var message))
                    {
                        await DoSendMessageAsync(message, token);
                    }
                }

                await Task.Delay(10, token);
            }
        }

        private async Task CollectorLoopAsync(CancellationToken token)
        {
            try
            {
                while (Connected && !token.IsCancellationRequested)
                {
                    var message = await ReadMessageAsync(token);
                    if (message == null)
                    {
                        break;
                    }

                    CRes.Out("Receive message " + message.Command);
                    if (message.Command == -27)
                    {
                        GetKey(message);
                    }
                    else
                    {
                        ReceiveMessages.Enqueue(message);
                    }

                    await Task.Delay(100, token);
                }
            }
            catch (OperationCanceledException)
            {
            }
            catch (Exception e)
            {
                CRes.Err("collector failed: " + e.Message);
            }

            if (Connected)
            {
                EnqueueMainThread(() => messageHandler?.OnDisconnected());
                Close(1);
            }
        }

        private static void EnqueueMainThread(Action action)
        {
            MainThreadActions.Enqueue(action);
        }

        private async Task DoSendMessageAsync(Message message, CancellationToken token)
        {
            if (stream == null)
            {
                return;
            }

            var data = message.GetData();
            if (getKeyComplete)
            {
                await stream.WriteAsync(new[] { WriteKey(unchecked((byte)message.Command)) }, 0, 1, token);
            }
            else
            {
                await stream.WriteAsync(new[] { unchecked((byte)message.Command) }, 0, 1, token);
            }

            var size = data?.Length ?? 0;
            if (getKeyComplete)
            {
                var encodedLength = new[]
                {
                    WriteKey((byte)(size >> 8)),
                    WriteKey((byte)(size & 255))
                };
                await stream.WriteAsync(encodedLength, 0, encodedLength.Length, token);
            }
            else
            {
                var length = new[] { (byte)(size >> 8), (byte)(size & 255) };
                await stream.WriteAsync(length, 0, length.Length, token);
            }

            if (size > 0)
            {
                var payload = new byte[size];
                Array.Copy(data, payload, size);
                if (getKeyComplete)
                {
                    for (var i = 0; i < payload.Length; i++)
                    {
                        payload[i] = WriteKey(payload[i]);
                    }
                }

                await stream.WriteAsync(payload, 0, payload.Length, token);
            }

            await stream.FlushAsync(token);
            SendByteCount += 5 + size;
        }

        private async Task<Message> ReadMessageAsync(CancellationToken token)
        {
            var cmdRaw = await ReadByteAsync(token);
            if (cmdRaw < 0)
            {
                return null;
            }

            var cmdByte = (byte)cmdRaw;
            if (getKeyComplete)
            {
                cmdByte = ReadKey(cmdByte);
            }

            var command = unchecked((sbyte)cmdByte);
            int size;
            if (command == -120 || command == 90)
            {
                size = await ReadInt32Async(token);
            }
            else if (getKeyComplete)
            {
                var b1 = ReadKey((byte)await ReadRequiredByteAsync(token));
                var b2 = ReadKey((byte)await ReadRequiredByteAsync(token));
                size = ((b1 & 255) << 8) | (b2 & 255);
            }
            else
            {
                var b1 = await ReadRequiredByteAsync(token);
                var b2 = await ReadRequiredByteAsync(token);
                size = ((b1 & 255) << 8) | (b2 & 255);
            }

            var data = new byte[size];
            var read = 0;
            while (read < size)
            {
                var count = await stream.ReadAsync(data, read, size - read, token);
                if (count <= 0)
                {
                    throw new EndOfStreamException();
                }

                read += count;
                RecvByteCount += 5 + read;
            }

            if (getKeyComplete)
            {
                for (var i = 0; i < data.Length; i++)
                {
                    data[i] = ReadKey(data[i]);
                }
            }

            return new Message(command, data);
        }

        private void GetKey(Message message)
        {
            var keySize = message.Reader().ReadByte();
            key = new byte[keySize];
            for (var i = 0; i < keySize; i++)
            {
                key[i] = message.Reader().ReadByte();
            }

            for (var i = 0; i < key.Length - 1; i++)
            {
                key[i + 1] ^= key[i];
            }

            getKeyComplete = true;
        }

        private byte ReadKey(byte value)
        {
            var result = unchecked((byte)(key[curR++] ^ value));
            if (curR >= key.Length)
            {
                curR %= key.Length;
            }

            return result;
        }

        private byte WriteKey(byte value)
        {
            var result = unchecked((byte)(key[curW++] ^ value));
            if (curW >= key.Length)
            {
                curW %= key.Length;
            }

            return result;
        }

        private async Task<int> ReadByteAsync(CancellationToken token)
        {
            var buffer = new byte[1];
            var count = await stream.ReadAsync(buffer, 0, 1, token);
            return count == 0 ? -1 : buffer[0];
        }

        private async Task<int> ReadRequiredByteAsync(CancellationToken token)
        {
            var value = await ReadByteAsync(token);
            if (value < 0)
            {
                throw new EndOfStreamException();
            }

            return value;
        }

        private async Task<int> ReadInt32Async(CancellationToken token)
        {
            var b1 = await ReadRequiredByteAsync(token);
            var b2 = await ReadRequiredByteAsync(token);
            var b3 = await ReadRequiredByteAsync(token);
            var b4 = await ReadRequiredByteAsync(token);
            return (b1 << 24) | (b2 << 16) | (b3 << 8) | b4;
        }
    }
}
