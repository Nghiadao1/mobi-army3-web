# army2-unity-client

Unity C# migration workspace for the Java LibGDX Army2 client.

Open this folder with Unity Hub:

```text
unity/army2-unity-client
```

Current scope:

- Boots a Unity runtime through `MainGame`.
- Preserves the Java-style lifecycle: `InitGame`, `MainLoop`, `UpdateCanvas`, `Paint`.
- Adds initial adapters for graphics, image loading, RMS persistence, big-endian protocol messages, and TCP session handling.
- Routes keyboard, mouse, and touch through `UnityInputRouter` into the old Java-style `CCanvas` input arrays.
- Dispatches network callbacks on Unity's main thread before message handlers touch game state or rendering objects.
- Copies Java assets into `Assets/StreamingAssets/res` and RMS seed data into `Assets/StreamingAssets/rms`.

Validation:

- The scripts were syntax-checked with the local C# compiler using temporary UnityEngine stubs.
- Full Unity import/play validation still needs a real Unity install.

Next porting step:

1. Port `Font`, `Background`, `ServerListScreen`, and `LoginScr`.
2. Port full `GameService`, `MessageHandler`, and `GameLogicHandler` command handling.
3. Move Java gameplay classes into matching C# namespaces while keeping global static state until parity is reached.
