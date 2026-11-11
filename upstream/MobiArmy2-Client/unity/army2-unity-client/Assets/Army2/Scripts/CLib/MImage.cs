using System.IO;
using UnityEngine;

namespace Army2.CLib
{
    public sealed class MImage
    {
        public Texture2D Texture { get; private set; }
        public int Width => Texture != null ? Texture.width : 0;
        public int Height => Texture != null ? Texture.height : 0;

        public static MImage CreateImage(string url)
        {
            var image = new MImage();
            var path = LibSysTem.ResolveAssetPath(url);
            if (!File.Exists(path))
            {
                Debug.LogWarning("Missing image: " + path);
                return image;
            }

            var bytes = File.ReadAllBytes(path);
            var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Point
            };
            texture.LoadImage(bytes);
            image.Texture = texture;
            return image;
        }
    }
}
