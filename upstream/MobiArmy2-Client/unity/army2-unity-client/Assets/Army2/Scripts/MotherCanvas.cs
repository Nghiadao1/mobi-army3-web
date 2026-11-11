using Army2.CLib;
using Army2.CoreLG;
using Army2.Model;

namespace Army2
{
    public abstract class MotherCanvas
    {
        public static int W;
        public static int H;
        public static int Hw;
        public static int Hh;
        public static int W4;
        public static int H4;
        public static bool BRun;
        public static int Fps = 50;

        protected MotherCanvas()
        {
            SetFullScreenMode(true);
            CheckZoomLevel(GetWidthL(), GetHeightL());
        }

        private void CheckZoomLevel(int width, int height)
        {
            if (width * height >= 3166208)
            {
                MGraphics.ZoomLevel = 6;
            }
            else if (width * height >= 2073600)
            {
                MGraphics.ZoomLevel = 4;
            }
            else if (width * height >= 727040)
            {
                MGraphics.ZoomLevel = 3;
            }
            else if (width * height >= 384000)
            {
                MGraphics.ZoomLevel = 2;
            }
            else
            {
                MGraphics.ZoomLevel = 1;
            }

            if (MGraphics.ZoomLevel > 1)
            {
                MGraphics.ZoomLevel--;
            }

            W = width / MGraphics.ZoomLevel;
            H = height / MGraphics.ZoomLevel;
            Hw = W / 2;
            Hh = H / 2;
            W4 = W / 4;
            H4 = H / 4;
            CRes.Out("Mother canvas zoom level = " + MGraphics.ZoomLevel);
        }

        public static void SetFullScreenMode(bool enabled)
        {
        }

        public virtual void Start()
        {
        }

        public int GetWidthL()
        {
            return MainGame.GetWidth();
        }

        public int GetHeightL()
        {
            return MainGame.GetHeight();
        }

        public abstract void OnPointerDragged(int x, int y, int pointer);
        public abstract void OnPointerPressed(int x, int y, int pointer, int button);
        public abstract void OnPointerReleased(int x, int y, int pointer, int button);
        public abstract void OnPointerHolder(int x, int y, int pointer);
        public abstract void OnPointerHolder();
        public abstract void UpdateCanvas();
    }
}
