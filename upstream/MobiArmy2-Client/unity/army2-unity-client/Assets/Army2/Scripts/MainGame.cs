using Army2.CLib;
using Army2.CoreLG;
using Army2.Input;
using Army2.Model;
using Army2.Network;
using UnityEngine;

namespace Army2
{
    public sealed class MainGame : MonoBehaviour
    {
        public static MainGame Instance { get; private set; }
        public static bool IsPause { get; private set; }
        public static string MainThreadName { get; private set; }

        private MGraphics graphics;
        private UnityInputRouter inputRouter;
        private float updateAccumulator;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Bootstrap()
        {
            if (Instance != null)
            {
                return;
            }

            var go = new GameObject("Army2 Unity Client");
            UnityEngine.Object.DontDestroyOnLoad(go);
            go.AddComponent<MainGame>();
        }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                UnityEngine.Object.Destroy(gameObject);
                return;
            }

            Instance = this;
            MainThreadName = "UnityMain";
            Application.targetFrameRate = 40;
            graphics = new MGraphics();
            inputRouter = new UnityInputRouter();
            MapKey.Load();
            CRes.Init();
            GameMidlet.Instance.InitGame();
        }

        private void Update()
        {
            if (IsPause)
            {
                return;
            }

            updateAccumulator += Time.unscaledDeltaTime;

            SessionME.Update();
            inputRouter.Update();

            if (GameMidlet.GameCanvas != null)
            {
                GameMidlet.GameCanvas.MainLoop();
            }

            if (updateAccumulator >= 0.01f)
            {
                GameMidlet.GameCanvas?.UpdateCanvas();
                updateAccumulator = 0f;
            }
        }

        private void OnGUI()
        {
            if (IsPause || GameMidlet.GameCanvas == null)
            {
                return;
            }

            graphics.Begin();
            GameMidlet.GameCanvas.Paint(graphics);
            graphics.End();
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            IsPause = pauseStatus;
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                SessionME.Instance.Close(1111);
                Instance = null;
            }
        }

        public static int GetWidth()
        {
            return UnityEngine.Screen.width;
        }

        public static int GetHeight()
        {
            return UnityEngine.Screen.height;
        }
    }
}
