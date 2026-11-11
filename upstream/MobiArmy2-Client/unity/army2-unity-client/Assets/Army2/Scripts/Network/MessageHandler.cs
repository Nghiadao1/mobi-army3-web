using Army2.Model;

namespace Army2.Network
{
    public sealed class MessageHandler : IMessageHandler
    {
        public static readonly MessageHandler Instance = new MessageHandler();
        private GameLogicHandler gameLogicHandler;

        private MessageHandler()
        {
        }

        public void SetGameLogicHandler(GameLogicHandler handler)
        {
            gameLogicHandler = handler;
        }

        public void OnMessage(Message message)
        {
            CRes.Out("TODO OnMessage cmd=" + message.Command);
        }

        public void OnConnectOK()
        {
            CRes.Out("Connect OK");
        }

        public void OnConnectionFail()
        {
            CRes.Out("Connection fail");
        }

        public void OnDisconnected()
        {
            CRes.Out("Disconnected");
        }
    }
}
