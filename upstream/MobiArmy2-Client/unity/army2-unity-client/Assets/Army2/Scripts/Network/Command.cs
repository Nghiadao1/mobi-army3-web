using Army2.Model;

namespace Army2.Network
{
    public sealed class Command
    {
        public string Caption;
        public IAction Action;

        public Command(string caption, IAction action)
        {
            Caption = caption;
            Action = action;
        }
    }
}
