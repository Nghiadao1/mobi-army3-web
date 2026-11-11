using System;
using UnityEngine;

namespace Army2.CLib
{
    public static class MSystem
    {
        public static long CurrentTimeMillis()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }

        public static void OpenUrl(string url)
        {
            Application.OpenURL(url);
        }
    }
}
