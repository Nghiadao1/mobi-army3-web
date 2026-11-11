namespace Army2.Network
{
    public interface ISession
    {
        bool IsConnected();
        void SetHandler(IMessageHandler handler);
        void Connect(string host, int port);
        void SendMessage(Message message);
        void Close(int index);
    }
}
