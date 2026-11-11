using Army2.CLib;
using Army2.CoreLG;

namespace Army2.Screen
{
    public sealed class SplashScr : CScreen
    {
        private int tick;
        private bool loadScreen = true;
        private bool isPaint;

        public override void Paint(MGraphics g)
        {
            g.SetColor(0x77D2FF);
            g.FillRect(0, 0, W, H, false);

            if (isPaint)
            {
                g.SetColor(0x113355);
                g.DrawString("Army2 Unity", CCanvas.Width / 2, CCanvas.Height / 2 - 12, MGraphics.HCenter | MGraphics.Top);
                g.DrawString("Java port bootstrap", CCanvas.Width / 2, CCanvas.Height / 2 + 12, MGraphics.HCenter | MGraphics.Top);
            }
        }

        public override void Update()
        {
            if (loadScreen)
            {
                loadScreen = false;
                isPaint = true;
            }
            else if (tick == 55)
            {
                CCanvas.ServerListScreen.Show();
                return;
            }

            tick++;
        }
    }
}
