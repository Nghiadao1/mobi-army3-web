namespace Army2.Network
{
    public sealed class GameService
    {
        public static readonly GameService Instance = new GameService();
        private ISession session;

        private GameService()
        {
        }

        public void SetSession(ISession value)
        {
            session = value;
        }

        public void Ping(int tick, long time)
        {
            if (session == null || !session.IsConnected())
            {
                return;
            }

            var message = new Message(-28);
            message.Writer().WriteInt32(tick);
            message.Writer().WriteInt32((int)time);
            session.SendMessage(message);
        }
    }
}
