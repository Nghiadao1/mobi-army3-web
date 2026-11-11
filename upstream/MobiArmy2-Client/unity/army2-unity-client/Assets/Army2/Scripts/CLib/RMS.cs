using System.IO;
using UnityEngine;

namespace Army2.CLib
{
    public static class RMS
    {
        private static string Root => Path.Combine(Application.persistentDataPath, "rms");

        public static void SaveRMS(string filename, byte[] data)
        {
            Directory.CreateDirectory(Root);
            File.WriteAllBytes(Path.Combine(Root, filename), data);
        }

        public static byte[] LoadRMS(string filename)
        {
            var local = Path.Combine(Root, filename);
            if (File.Exists(local))
            {
                return File.ReadAllBytes(local);
            }

            var seed = Path.Combine(Application.streamingAssetsPath, "rms", filename);
            return File.Exists(seed) ? File.ReadAllBytes(seed) : null;
        }

        public static int LoadRMSInt(string filename)
        {
            var data = LoadRMS(filename);
            return data == null || data.Length == 0 ? -1 : (sbyte)data[0];
        }

        public static void ClearRMS(string filename)
        {
            var path = Path.Combine(Root, filename);
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
    }
}
