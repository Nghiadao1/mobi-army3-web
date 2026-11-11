using System.Text;
using Army2.CLib;

namespace Army2.Network
{
    public sealed class GameLogicHandler
    {
        public static readonly GameLogicHandler Instance = new GameLogicHandler();

        private GameLogicHandler()
        {
        }

        public static string LoadIP()
        {
            var data = RMS.LoadRMS("ARMY2") ?? RMS.LoadRMS("AMRY2");
            return data == null ? null : Encoding.UTF8.GetString(data);
        }
    }
}
