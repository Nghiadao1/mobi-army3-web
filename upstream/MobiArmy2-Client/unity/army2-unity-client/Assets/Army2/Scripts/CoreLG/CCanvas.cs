using Army2.CLib;
using Army2.Model;
using Army2.Network;
using Army2.Screen;
using UnityEngine;

namespace Army2.CoreLG
{
    public sealed class CCanvas : MotherCanvas
    {
        public static int GameTick;
        public static int Width;
        public static int Height;
        public static int HhCanvas;
        public static int HwCanvas;
        public static CScreen CurScr;
        public static SplashScr SplashScr;
        public static ServerListScreen ServerListScreen;
        public static bool IsTouch;
        public static readonly bool[] KeyPressed = new bool[55];
        public static readonly bool[] KeyReleased = new bool[55];
        public static readonly bool[] KeyHold = new bool[55];
        public static readonly bool[] IsPointerDown = new bool[2];
        public static readonly bool[] IsPointerRelease = new bool[2];
        public static readonly bool[] IsPointerClick = new bool[2];
        public static int[] PX = new int[2];
        public static int[] PY = new int[2];

        public CCanvas()
        {
            SetFullScreenMode(true);
            IsTouch = true;
            ScreenInit(true);
        }

        public void ScreenInit(bool setV)
        {
            SetFullScreenMode(true);
            Width = W;
            Height = H;
            HhCanvas = Hh;
            HwCanvas = Hw;
            SplashScr = new SplashScr();
            IsTouch = true;
            SplashScr.Show();
            CScreen.W = Width;
            CScreen.H = Height;
            LoadScreen();
        }

        public static void LoadScreen()
        {
            ServerListScreen = new ServerListScreen();
        }

        public void MainLoop()
        {
            CurScr?.MainLoop();
        }

        public override void UpdateCanvas()
        {
            GameTick++;
            if (GameTick > 10000)
            {
                GameTick = 0;
            }

            if (GameTick % 50 == 0)
            {
                GameService.Instance.Ping(GameTick, -1);
                if (SessionME.Instance.Connected)
                {
                    GameMidlet.PingCount++;
                }
            }

            CurScr?.Update();
        }

        public void Paint(MGraphics g)
        {
            CurScr?.Paint(g);
        }

        public static void BeginInputFrame()
        {
            for (var i = 0; i < KeyPressed.Length; i++)
            {
                KeyPressed[i] = false;
                KeyReleased[i] = false;
            }

            for (var i = 0; i < IsPointerClick.Length; i++)
            {
                IsPointerClick[i] = false;
                IsPointerRelease[i] = false;
            }
        }

        public override void OnPointerDragged(int x, int y, int pointer)
        {
            if (pointer >= 2)
            {
                return;
            }

            PX[pointer] = x;
            PY[pointer] = y;
        }

        public override void OnPointerPressed(int x, int y, int pointer, int button)
        {
            if (pointer >= 2)
            {
                return;
            }

            IsPointerDown[pointer] = true;
            IsPointerClick[pointer] = true;
            PX[pointer] = x;
            PY[pointer] = y;
        }

        public override void OnPointerReleased(int x, int y, int pointer, int button)
        {
            if (pointer >= 2)
            {
                return;
            }

            IsPointerDown[pointer] = false;
            IsPointerRelease[pointer] = true;
            PX[pointer] = x;
            PY[pointer] = y;
        }

        public override void OnPointerHolder(int x, int y, int pointer)
        {
        }

        public override void OnPointerHolder()
        {
        }

        public static bool IsPc()
        {
            return GameMidlet.Device == GameMidlet.DeviceTypePc;
        }

        public static bool IsAndroid()
        {
            return GameMidlet.Device == GameMidlet.DeviceTypeAndroid || GameMidlet.Device == GameMidlet.DeviceTypeAndroidStore;
        }

        public static bool IsIos()
        {
            return GameMidlet.Device == GameMidlet.DeviceTypeIos || GameMidlet.Device == GameMidlet.DeviceTypeIosStore;
        }

        public static bool IsDebugging()
        {
            return Debug.isDebugBuild;
        }

        public static void ClearKeyHold()
        {
            for (var i = 0; i < KeyHold.Length; i++)
            {
                KeyHold[i] = false;
            }
        }

        public static void StartWaitDlg(string text)
        {
            CRes.Out("WAIT: " + text);
        }

        public static void EndDlg()
        {
        }
    }
}
