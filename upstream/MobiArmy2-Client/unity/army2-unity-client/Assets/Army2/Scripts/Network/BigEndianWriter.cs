using System;
using System.IO;
using System.Text;

namespace Army2.Network
{
    public sealed class BigEndianWriter : IDisposable
    {
        private readonly Stream stream;

        public BigEndianWriter(Stream stream)
        {
            this.stream = stream;
        }

        public void WriteByte(int value)
        {
            stream.WriteByte(unchecked((byte)value));
        }

        public void WriteInt16(int value)
        {
            stream.WriteByte(unchecked((byte)(value >> 8)));
            stream.WriteByte(unchecked((byte)value));
        }

        public void WriteInt32(int value)
        {
            stream.WriteByte(unchecked((byte)(value >> 24)));
            stream.WriteByte(unchecked((byte)(value >> 16)));
            stream.WriteByte(unchecked((byte)(value >> 8)));
            stream.WriteByte(unchecked((byte)value));
        }

        public void WriteUTF(string value)
        {
            var data = Encoding.UTF8.GetBytes(value);
            WriteInt16(data.Length);
            stream.Write(data, 0, data.Length);
        }

        public void Write(byte[] data)
        {
            stream.Write(data, 0, data.Length);
        }

        public void Dispose()
        {
            stream.Dispose();
        }
    }
}
