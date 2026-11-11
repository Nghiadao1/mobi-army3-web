# Port Status

## Converted

- `MainGame.java` -> `Assets/Army2/Scripts/MainGame.cs`
  - Unity bootstrap, update loop, GUI paint loop, pause/destroy hooks.
- `GameMidlet.java` -> `Assets/Army2/Scripts/GameMidlet.cs`
  - Runtime constants, init path, service/session wiring.
- `MotherCanvas.java` -> `Assets/Army2/Scripts/MotherCanvas.cs`
  - Zoom calculation and canvas dimensions.
- `CCanvas.java` -> `Assets/Army2/Scripts/CoreLG/CCanvas.cs`
  - Startup state, current screen, input arrays, tick/update/paint shell.
- `CScreen.java`, `SplashScr.java`, part of `ServerListScreen.java`
  - Minimal screen flow to verify Unity boot.
- `CRes.java`
  - Trig tables, angle helpers, RNG, RMS wrappers, logging.
- `mGraphics.java`
  - Initial immediate-mode Unity GUI adapter for rects, text, images, regions.
- `mImage.java` / `Image.java`
  - Initial texture loading from `StreamingAssets/res`.
- `RMS.java`
  - Persistent data path plus seeded `StreamingAssets/rms` fallback.
- `Message.java`, `Session_ME.java`
  - Big-endian message wrappers and TCP session/key-handshake port.
- Unity input
  - `UnityInputRouter` maps keyboard, mouse, and touch to the original `CCanvas` arrays.
- Network callback safety
  - `SessionME` queues handler callbacks onto Unity's main thread.

## Not Converted Yet

- Full `MessageHandler`, `GameService`, and `GameLogicHandler` command logic beyond session/ping scaffolding.
- Font sprite rendering.
- `Background`, map loader/rendering, terrain collision.
- Login/menu/room/board/preparation/gameplay screens beyond bootstrap placeholders.
- Player, bullet, equipment, item, shop, effect systems.

## Open In Unity

Open this folder:

```text
unity/army2-unity-client
```

The runtime bootstraps itself with `RuntimeInitializeOnLoadMethod`, so a hand-authored scene is not required yet.

## Local Check

The C# scripts passed a local compiler syntax check with temporary UnityEngine stubs. Open/import in Unity is still required for the final engine-level validation.
