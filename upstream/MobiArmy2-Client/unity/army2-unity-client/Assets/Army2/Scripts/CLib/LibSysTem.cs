using System.IO;
using UnityEngine;

namespace Army2.CLib
{
    public static class LibSysTem
    {
        public static string Res = "res";

        public static string ResolveAssetPath(string path)
        {
            var clean = path.StartsWith("/") ? path.Substring(1) : path;
            return Path.Combine(Application.streamingAssetsPath, Res, clean);
        }

        public static Stream GetResourceAsStream(string path)
        {
            return File.OpenRead(ResolveAssetPath(path));
        }
    }
}
