using System;
using UnityEngine;

namespace Army2.Model
{
    public static class CRes
    {
        private static readonly short[] SinTable =
        {
            0, 18, 36, 54, 71, 89, 107, 125, 143, 160, 178, 195, 213, 230, 248, 265, 282, 299, 316, 333, 350, 367, 384, 400, 416, 433, 449, 465, 481, 496, 512, 527, 543, 558, 573, 587, 602, 616, 630, 644, 658, 672, 685, 698, 711, 724, 737, 749, 761, 773, 784, 796, 807, 818, 828, 839, 849, 859, 868, 878, 887, 896, 904, 912, 920, 928, 935, 943, 949, 956, 962, 968, 974, 979, 984, 989, 994, 998, 1002, 1005, 1008, 1011, 1014, 1016, 1018, 1020, 1022, 1023, 1023, 1024, 1024
        };

        private static short[] cos;
        private static int[] tan;
        private static readonly System.Random Random = new System.Random();

        public static void Init()
        {
            cos = new short[91];
            tan = new int[91];

            for (var i = 0; i <= 90; i++)
            {
                cos[i] = SinTable[90 - i];
                tan[i] = cos[i] == 0 ? int.MaxValue : (SinTable[i] << 10) / cos[i];
            }
        }

        public static int Sin(int a)
        {
            a = FixAngle(a);
            if (a >= 0 && a < 90) return SinTable[a];
            if (a >= 90 && a < 180) return SinTable[180 - a];
            return a >= 180 && a < 270 ? -SinTable[a - 180] : -SinTable[360 - a];
        }

        public static int Cos(int a)
        {
            EnsureTrig();
            a = FixAngle(a);
            if (a >= 0 && a < 90) return cos[a];
            if (a >= 90 && a < 180) return -cos[180 - a];
            return a >= 180 && a < 270 ? -cos[a - 180] : cos[360 - a];
        }

        public static int Tan(int a)
        {
            EnsureTrig();
            a = FixAngle(a);
            if (a >= 0 && a < 90) return tan[a];
            if (a >= 90 && a < 180) return -tan[180 - a];
            return a >= 180 && a < 270 ? tan[a - 180] : -tan[360 - a];
        }

        public static int Angle(int dx, int dy)
        {
            EnsureTrig();
            if (dx == 0)
            {
                return dy > 0 ? 90 : 270;
            }

            var value = Math.Abs((dy << 10) / dx);
            var angle = Atan(value);
            if (dy >= 0 && dx < 0) angle = 180 - angle;
            if (dy < 0 && dx < 0) angle += 180;
            if (dy < 0 && dx >= 0) angle = 360 - angle;
            return angle;
        }

        public static int FixAngle(int angle)
        {
            if (angle >= 360) angle -= 360;
            if (angle < 0) angle += 360;
            return angle;
        }

        public static int Abs(int value)
        {
            return Math.Abs(value);
        }

        public static int RandomRange(int a, int b)
        {
            return a + Random.Next(b - a);
        }

        public static string[] Split(string text, string separator)
        {
            return text.Split(new[] { separator }, StringSplitOptions.None);
        }

        public static byte[] LoadRMSData(string name)
        {
            return CLib.RMS.LoadRMS(name);
        }

        public static int LoadRMSInt(string name)
        {
            var data = LoadRMSData(name);
            return data == null || data.Length == 0 ? -1 : (sbyte)data[0];
        }

        public static void SaveRMSInt(string name, int value)
        {
            CLib.RMS.SaveRMS(name, new[] { unchecked((byte)value) });
        }

        public static void Out(string text)
        {
            Debug.Log(text);
        }

        public static void Err(string text)
        {
            Debug.LogWarning(text);
        }

        private static int Atan(int value)
        {
            for (var i = 0; i <= 90; i++)
            {
                if (tan[i] >= value)
                {
                    return i;
                }
            }

            return 0;
        }

        private static void EnsureTrig()
        {
            if (cos == null || tan == null)
            {
                Init();
            }
        }
    }
}
