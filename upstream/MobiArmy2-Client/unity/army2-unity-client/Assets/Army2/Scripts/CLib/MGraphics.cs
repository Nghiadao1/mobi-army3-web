using UnityEngine;

namespace Army2.CLib
{
    public sealed class MGraphics
    {
        public static int ZoomLevel = 1;
        public static readonly int HCenter = 1;
        public static readonly int VCenter = 2;
        public static readonly int Left = 4;
        public static readonly int Right = 8;
        public static readonly int Top = 16;
        public static readonly int Bottom = 32;

        private Color color = Color.white;
        private int translateX;
        private int translateY;
        private Texture2D whiteTexture;
        private GUIStyle labelStyle;

        public void Begin()
        {
            whiteTexture ??= Texture2D.whiteTexture;
            labelStyle ??= new GUIStyle(GUI.skin.label)
            {
                fontSize = 16,
                normal = { textColor = Color.white }
            };
        }

        public void End()
        {
            translateX = 0;
            translateY = 0;
            GUI.color = Color.white;
        }

        public void Translate(int tx, int ty)
        {
            translateX += tx * ZoomLevel;
            translateY += ty * ZoomLevel;
        }

        public int GetTranslateX()
        {
            return translateX / ZoomLevel;
        }

        public int GetTranslateY()
        {
            return translateY / ZoomLevel;
        }

        public void SetColor(int rgb)
        {
            var r = ((rgb >> 16) & 255) / 255f;
            var g = ((rgb >> 8) & 255) / 255f;
            var b = (rgb & 255) / 255f;
            color = new Color(r, g, b, 1f);
            labelStyle.normal.textColor = color;
        }

        public void FillRect(int x, int y, int w, int h, bool useClip)
        {
            var old = GUI.color;
            GUI.color = color;
            GUI.DrawTexture(ToRect(x, y, w, h), whiteTexture);
            GUI.color = old;
        }

        public void DrawString(string text, int x, int y, int anchor)
        {
            var size = labelStyle.CalcSize(new GUIContent(text));
            var px = (float)(x * ZoomLevel + translateX);
            var py = (float)(y * ZoomLevel + translateY);

            if ((anchor & HCenter) != 0) px -= size.x / 2f;
            if ((anchor & Right) != 0) px -= size.x;
            if ((anchor & VCenter) != 0) py -= size.y / 2f;
            if ((anchor & Bottom) != 0) py -= size.y;

            GUI.Label(new Rect(px, py, size.x + 4, size.y + 2), text, labelStyle);
        }

        public void DrawImage(MImage image, int x, int y, int anchor)
        {
            if (image?.Texture == null)
            {
                return;
            }

            var width = image.Width;
            var height = image.Height;
            var rect = ToAnchoredRect(x, y, width, height, anchor);
            GUI.DrawTexture(rect, image.Texture);
        }

        public void DrawRegion(MImage image, int srcX, int srcY, int width, int height, int flip, int destX, int destY, int anchor, bool useClip)
        {
            if (image?.Texture == null)
            {
                return;
            }

            var rect = ToAnchoredRect(destX, destY, width, height, anchor);
            var source = new Rect(
                (float)srcX / image.Texture.width,
                1f - ((float)srcY + height) / image.Texture.height,
                (float)width / image.Texture.width,
                (float)height / image.Texture.height);
            GUI.DrawTextureWithTexCoords(rect, image.Texture, source);
        }

        public void SetClip(int x, int y, int w, int h)
        {
        }

        private Rect ToRect(int x, int y, int w, int h)
        {
            return new Rect(x * ZoomLevel + translateX, y * ZoomLevel + translateY, w * ZoomLevel, h * ZoomLevel);
        }

        private Rect ToAnchoredRect(int x, int y, int w, int h, int anchor)
        {
            var px = (float)(x * ZoomLevel + translateX);
            var py = (float)(y * ZoomLevel + translateY);
            var width = w * ZoomLevel;
            var height = h * ZoomLevel;

            if ((anchor & HCenter) != 0) px -= width / 2f;
            if ((anchor & Right) != 0) px -= width;
            if ((anchor & VCenter) != 0) py -= height / 2f;
            if ((anchor & Bottom) != 0) py -= height;

            return new Rect(px, py, width, height);
        }
    }
}
