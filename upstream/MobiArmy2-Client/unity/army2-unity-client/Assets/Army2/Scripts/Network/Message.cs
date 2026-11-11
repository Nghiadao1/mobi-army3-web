using System.IO;

namespace Army2.Network
{
    public sealed class Message
    {
        public sbyte Command;
        private MemoryStream output;
        private BigEndianWriter writer;
        private MemoryStream input;
        private BigEndianReader reader;

        public Message()
        {
        }

        public Message(int command) : this((sbyte)command)
        {
        }

        public Message(sbyte command)
        {
            Command = command;
            output = new MemoryStream();
            writer = new BigEndianWriter(output);
        }

        public Message(sbyte command, byte[] data)
        {
            Command = command;
            input = new MemoryStream(data);
            reader = new BigEndianReader(input);
        }

        public byte[] GetData()
        {
            return output?.ToArray();
        }

        public BigEndianReader Reader()
        {
            return reader;
        }

        public BigEndianWriter Writer()
        {
            return writer;
        }
    }
}
