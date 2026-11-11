using Army2.CLib;
using Army2.CoreLG;

namespace Army2.Screen
{
    public sealed class ServerListScreen : CScreen
    {
        public static string[] NameServer = { "LOCAL" };
        public static string[] Address = { "127.0.0.1" };
        public static short[] Port = { 19152 };

        public override void Paint(MGraphics g)
        {
            g.SetColor(0x1B263B);
            g.FillRect(0, 0, W, H, false);
            g.SetColor(0xE0E1DD);
            g.DrawString("Army2 Unity", CCanvas.Width / 2, 48, MGraphics.HCenter | MGraphics.Top);
            g.DrawString("Server list bootstrap", CCanvas.Width / 2, 84, MGraphics.HCenter | MGraphics.Top);

            for (var i = 0; i < NameServer.Length; i++)
            {
                g.DrawString(NameServer[i] + "  " + Address[i] + ":" + Port[i], 32, 130 + i * 24, MGraphics.Left | MGraphics.Top);
            }
        }
    }
}
