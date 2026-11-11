using System;
using System.IO;
using System.Text;

namespace Army2.Network
{
    public sealed class BigEndianReader : IDisposable
    {
        private readonly Stream stream;

        public BigEndianReader(Stream stream)
        {
            this.stream = stream;
        }

        public sbyte ReadByteSigned()
        {
            var value = stream.ReadByte();
            if (value < 0) throw new EndOfStreamException();
            return unchecked((sbyte)value);
        }

        public byte ReadByte()
        {
            var value = stream.ReadByte();
            if (value < 0) throw new EndOfStreamException();
            return (byte)value;
        }

        public short ReadInt16()
        {
            var hi = ReadByte();
            var lo = ReadByte();
            return unchecked((short)((hi << 8) | lo));
        }

        public int ReadInt32()
        {
            var b1 = ReadByte();
            var b2 = ReadByte();
            var b3 = ReadByte();
            var b4 = ReadByte();
            return (b1 << 24) | (b2 << 16) | (b3 << 8) | b4;
        }

        public string ReadUTF()
        {
            var length = (ushort)ReadInt16();
            var data = new byte[length];
            var read = stream.Read(data, 0, length);
            if (read != length) throw new EndOfStreamException();
            return Encoding.UTF8.GetString(data);
        }

        public void Dispose()
        {
            stream.Dispose();
        }
    }
}
