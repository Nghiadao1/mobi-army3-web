using Army2.CLib;
using Army2.CoreLG;
using Army2.Network;

namespace Army2.Screen
{
    public abstract class CScreen
    {
        public static int W;
        public static int H;
        public static CScreen Instance;
        public Command Left;
        public Command Center;
        public Command Right;

        protected CScreen()
        {
            Instance = this;
        }

        public virtual void Paint(MGraphics g)
        {
        }

        public virtual void Update()
        {
        }

        public virtual void MainLoop()
        {
        }

        public virtual void Show()
        {
            ClearKey();
            CCanvas.CurScr = this;
        }

        public static void ClearKey()
        {
            for (var i = 0; i < CCanvas.KeyPressed.Length; i++)
            {
                CCanvas.KeyPressed[i] = false;
                CCanvas.KeyHold[i] = false;
            }

            for (var i = 0; i < CCanvas.IsPointerClick.Length; i++)
            {
                CCanvas.IsPointerClick[i] = false;
            }
        }
    }
}
