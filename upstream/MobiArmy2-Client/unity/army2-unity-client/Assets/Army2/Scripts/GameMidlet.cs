using Army2.CLib;
using Army2.CoreLG;
using Army2.Network;

namespace Army2
{
    public sealed class GameMidlet
    {
        public const byte DeviceTypeJava = 0;
        public const byte DeviceTypeAndroid = 1;
        public const byte DeviceTypeIos = 2;
        public const byte DeviceTypeWinPhone = 3;
        public const byte DeviceTypePc = 4;
        public const byte DeviceTypeAndroidStore = 5;
        public const byte DeviceTypeIosStore = 6;
        public const byte DeviceTypeDev = 7;

        public static readonly GameMidlet Instance = new GameMidlet();
        public static CCanvas GameCanvas;

        public static string Version = "2.4.1";
        public static short VersionByte = 241;
        public static byte VersionCode = 11;
        public static sbyte Server = -2;
        public static int PingCount;
        public static bool Ping;
        public static short VersionServer = 3;
        public static byte Device = DeviceTypePc;
        public static byte Compile = 1;
        public static bool LowGraphic;
        public static byte CurrentIapStore;
        public static byte Provider;
        public static string Ip = "192.168.1.88";
        public static int Port = 19152;
        public static string Agent = "";

        private GameMidlet()
        {
        }

        public void InitGame()
        {
            GameCanvas = new CCanvas();
            InitGame2();
        }

        private void InitGame2()
        {
            var savedIp = GameLogicHandler.LoadIP();
            if (!string.IsNullOrEmpty(savedIp))
            {
                var split = savedIp.Split(':');
                if (split.Length == 2 && int.TryParse(split[1], out var port))
                {
                    Ip = split[0];
                    Port = port;
                }
            }

            GameCanvas.Start();
            MessageHandler.Instance.SetGameLogicHandler(GameLogicHandler.Instance);
            SessionME.Instance.SetHandler(MessageHandler.Instance);
            GameService.Instance.SetSession(SessionME.Instance);
            SetCurrentIapStore();
        }

        public static void SetCurrentIapStore()
        {
            CurrentIapStore = Device == DeviceTypeAndroidStore ? (byte)2 : Device == DeviceTypeIosStore ? (byte)3 : (byte)0;
        }

        public static void OpenUrl(string url)
        {
            MSystem.OpenUrl(url);
        }
    }
}
