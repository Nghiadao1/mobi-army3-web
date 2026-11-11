namespace Army2.Network
{
    public interface IMessageHandler
    {
        void OnMessage(Message message);
        void OnConnectOK();
        void OnConnectionFail();
        void OnDisconnected();
    }
}
