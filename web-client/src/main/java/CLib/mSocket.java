package CLib;

import java.io.*;
import java.util.ArrayDeque;
import org.teavm.interop.Async;
import org.teavm.interop.AsyncCallback;
import org.teavm.jso.*;

/** Byte-for-byte TCP stream over a same-protocol WebSocket relay. */
public class mSocket {
    private JSObject socket;
    private boolean open;
    private final ArrayDeque<Integer> incoming = new ArrayDeque<>();
    private AsyncCallback<Integer> pendingRead;
    private final ByteArrayOutputStream outgoing = new ByteArrayOutputStream();
    @JSFunctor interface Event extends JSObject { void handle(); }
    @JSFunctor interface Data extends JSObject { void handle(String bytes); }

    public mSocket(String host, int port) throws IOException { connect(resolveRelay()); }
    @JSBody(script="return window.ARMY2_RELAY_URL || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':8081';")
    private static native String resolveRelay();
    @Async private native void connect(String url) throws IOException;
    private void connect(String url, AsyncCallback<Void> callback) {
        socket = create(url, () -> { open = true; callback.complete(null); }, this::receive,
            () -> { if (open) { open = false; if (pendingRead != null) { AsyncCallback<Integer> read = pendingRead; pendingRead = null; read.complete(-1); } }
                    else callback.error(new IOException("Không kết nối được cầu nối Army 2")); });
    }
    @JSBody(params={"url", "onOpen", "onData", "onClose"}, script="var s=new WebSocket(url);s.binaryType='arraybuffer';s.onopen=function(){onOpen();};s.onmessage=function(e){var a=new Uint8Array(e.data),parts=[];for(var i=0;i<a.length;i+=8192)parts.push(String.fromCharCode.apply(null,a.subarray(i,i+8192)));onData(parts.join(''));};s.onclose=function(){onClose();};return s;")
    private static native JSObject create(String url, Event onOpen, Data onData, Event onClose);
    private void receive(String bytes) {
        for (int i = 0; i < bytes.length(); i++) incoming.addLast((int)bytes.charAt(i));
        if (pendingRead != null && !incoming.isEmpty()) { AsyncCallback<Integer> read = pendingRead; pendingRead = null; read.complete(incoming.removeFirst()); }
    }
    @Async private native int readOne() throws IOException;
    private void readOne(AsyncCallback<Integer> callback) {
        if (!incoming.isEmpty()) callback.complete(incoming.removeFirst());
        else if (!open) callback.complete(-1);
        else pendingRead = callback;
    }
    public DataInputStream getInputStream() { return new DataInputStream(new InputStream() {
        public int read() throws IOException { return readOne(); }
        public int read(byte[] bytes, int offset, int length) throws IOException {
            if (offset < 0 || length < 0 || offset > bytes.length - length) throw new IndexOutOfBoundsException();
            if (length == 0) return 0;
            int first = readOne();
            if (first < 0) return -1;
            bytes[offset] = (byte) first;
            int count = 1;
            while (count < length && !incoming.isEmpty()) bytes[offset + count++] = (byte) (int) incoming.removeFirst();
            return count;
        }
        public int available() { return incoming.size(); }
    }); }
    public DataOutputStream getOutputStream() { return new DataOutputStream(new OutputStream() {
        public void write(int value) { outgoing.write(value); }
        public void flush() throws IOException {
            if (!open) throw new IOException("Army 2 relay disconnected");
            byte[] bytes = outgoing.toByteArray(); outgoing.reset();
            StringBuilder data = new StringBuilder();
            for (byte b : bytes) data.append((char)(b & 255));
            send(socket, data.toString());
        }
    }); }
    @JSBody(params={"socket", "bytes"}, script="var a=new Uint8Array(bytes.length);for(var i=0;i<a.length;i++)a[i]=bytes.charCodeAt(i);socket.send(a);")
    private static native void send(JSObject socket, String bytes);
    @JSBody(params={"socket"}, script="if(socket)socket.close();")
    private static native void closeSocket(JSObject socket);
    public void close() { open = false; closeSocket(socket); if (pendingRead != null) { AsyncCallback<Integer> read=pendingRead;pendingRead=null;read.complete(-1); } }
    public void setKeepAlive(boolean value) { }
    public String getIP() { return resolveRelay(); }
    public byte getState() { return (byte)(open ? 1 : 0); }
}
