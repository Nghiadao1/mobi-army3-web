using Army2.CLib;
using Army2.CoreLG;
using UnityEngine;

namespace Army2.Input
{
    public sealed class UnityInputRouter
    {
        private bool mouseWasDown;

        public void Update()
        {
            if (GameMidlet.GameCanvas == null)
            {
                return;
            }

            CCanvas.BeginInputFrame();
            UpdateKeyboard();
            UpdateMouse();
            UpdateTouch();
        }

        private static void UpdateKeyboard()
        {
            MapKey(KeyCode.UpArrow, 2);
            MapKey(KeyCode.DownArrow, 8);
            MapKey(KeyCode.LeftArrow, 4);
            MapKey(KeyCode.RightArrow, 6);
            MapKey(KeyCode.Return, 5);
            MapKey(KeyCode.KeypadEnter, 5);
            MapKey(KeyCode.Space, 5);
            MapKey(KeyCode.Escape, 13);
            MapKey(KeyCode.F1, 12);
            MapKey(KeyCode.F2, 13);

            MapKey(KeyCode.W, 2);
            MapKey(KeyCode.S, 8);
            MapKey(KeyCode.A, 4);
            MapKey(KeyCode.D, 6);
        }

        private void UpdateMouse()
        {
            if (UnityEngine.Input.touchCount > 0)
            {
                mouseWasDown = false;
                return;
            }

            var pos = ToGamePosition(UnityEngine.Input.mousePosition);
            var isDown = UnityEngine.Input.GetMouseButton(0);
            if (UnityEngine.Input.GetMouseButtonDown(0))
            {
                GameMidlet.GameCanvas.OnPointerPressed(pos.x, pos.y, 0, 0);
            }
            else if (UnityEngine.Input.GetMouseButtonUp(0))
            {
                GameMidlet.GameCanvas.OnPointerReleased(pos.x, pos.y, 0, 0);
            }
            else if (isDown && mouseWasDown)
            {
                GameMidlet.GameCanvas.OnPointerDragged(pos.x, pos.y, 0);
            }

            mouseWasDown = isDown;
        }

        private static void UpdateTouch()
        {
            var count = Mathf.Min(UnityEngine.Input.touchCount, 2);
            for (var i = 0; i < count; i++)
            {
                var touch = UnityEngine.Input.GetTouch(i);
                var pos = ToGamePosition(touch.position);
                switch (touch.phase)
                {
                    case TouchPhase.Began:
                        GameMidlet.GameCanvas.OnPointerPressed(pos.x, pos.y, i, 0);
                        break;
                    case TouchPhase.Moved:
                    case TouchPhase.Stationary:
                        GameMidlet.GameCanvas.OnPointerDragged(pos.x, pos.y, i);
                        break;
                    case TouchPhase.Ended:
                    case TouchPhase.Canceled:
                        GameMidlet.GameCanvas.OnPointerReleased(pos.x, pos.y, i, 0);
                        break;
                }
            }
        }

        private static void MapKey(KeyCode keyCode, int canvasKey)
        {
            if (UnityEngine.Input.GetKeyDown(keyCode))
            {
                CCanvas.KeyPressed[canvasKey] = true;
                CCanvas.KeyHold[canvasKey] = true;
            }

            if (UnityEngine.Input.GetKey(keyCode))
            {
                CCanvas.KeyHold[canvasKey] = true;
            }

            if (UnityEngine.Input.GetKeyUp(keyCode))
            {
                CCanvas.KeyReleased[canvasKey] = true;
                CCanvas.KeyHold[canvasKey] = false;
            }
        }

        private static Vector2Int ToGamePosition(Vector2 screenPosition)
        {
            var x = Mathf.RoundToInt(screenPosition.x / MGraphics.ZoomLevel);
            var y = Mathf.RoundToInt((UnityEngine.Screen.height - screenPosition.y) / MGraphics.ZoomLevel);
            return new Vector2Int(x, y);
        }
    }
}
