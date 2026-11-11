# Army2 Client C# Migration Plan

## Snapshot

- Project type: LibGDX multi-module game client.
- Modules: `core`, `desktop`, `android`, `ios`.
- Main runtime entry:
  - Desktop: `desktop/src/com/mygdx/game/DesktopLauncher.java`
  - Android: `android/src/com/mygdx/game/AndroidLauncher.java`
  - iOS: `ios/src/com/mygdx/game/IOSLauncher.java`
  - Game loop: `core/src/com/teamobi/mobiarmy2/MainGame.java`
- Core source size: 169 Java files, about 44.6k lines across Java sources.
- Main assets:
  - `android/assets/res`
  - `desktop/assets/res`
  - `desktop/assets/rms`
  - top-level `assets` for README screenshots.

## Source Map

- `core/src/com/teamobi/mobiarmy2`
  - LibGDX lifecycle, launcher-independent game entry, MIDlet-style bootstrap, platform flags.
- `core/src/coreLG`
  - Global canvas/state coordinator, screen registry, cache/version data loaders, platform helpers.
- `core/src/CLib`
  - Java ME compatibility and LibGDX bridge: image, graphics, sound, RMS, sockets, vectors, fonts.
- `core/src/screen`
  - UI/game screens: login, menu, room/board, prepare, inventory, equipment, game screen.
- `core/src/network`
  - Binary protocol, command IDs, encrypted session key handshake, sender/receiver threads.
- `core/src/model`
  - Shared data models, math helpers, fonts, menus, popups, dialogs, language strings.
- `core/src/player`, `core/src/item`, `core/src/map`, `core/src/effect`, `core/src/Equipment`, `core/src/shop`
  - Gameplay entities, projectile logic, terrain/map data, effects, equipment/shop logic.
- `core/src/javax`
  - Small Java ME shim layer.

## Recommended C# Target Shape

Pick one target before code conversion:

- Unity: best if the new environment is mobile-first and needs store builds, touch, audio, and asset tooling.
- MonoGame/FNA: best if the goal is a direct 2D C# port with a game loop close to LibGDX.
- Godot C#: possible, but the existing immediate-mode render style needs more adaptation.

Default recommendation: MonoGame if preserving behavior is the top priority; Unity if publishing mobile builds is the top priority.

## Porting Strategy

1. Create a C# shell with the same lifecycle:
   - `Initialize`
   - `Update`
   - `Draw`
   - pause/resume/dispose hooks.

2. Port compatibility adapters first:
   - `mGraphics` -> C# render wrapper.
   - `Image` / `mImage` -> texture wrapper.
   - `RMS` -> persistent storage abstraction.
   - `mSound` / `SoundSystem` -> audio wrapper.
   - `mSocket`, `Message`, `Session_ME` -> async TCP/session layer.
   - `mVector`, `mHashtable` -> `List<T>` / `Dictionary<TKey,TValue>` or temporary Java-like wrappers.

3. Preserve game globals during the first pass:
   - Keep static state in `CCanvas`, `GameScr`, `CRes`, `GameMidlet`.
   - Do cleanup/refactor only after gameplay parity is confirmed.

4. Port protocol exactly:
   - Keep command byte values.
   - Keep Java big-endian binary reading/writing.
   - Keep XOR key order in `Session_ME`.
   - Write small tests for message encode/decode before connecting to server.

5. Port asset loading:
   - Normalize to one canonical asset root, probably from `desktop/assets/res`.
   - Copy RMS seed files from `desktop/assets/rms`.
   - Preserve case-sensitive paths and extensionless files such as `res/item/item` and `res/map/bg`.

6. Port deterministic gameplay/math:
   - `CRes.sin`, `cos`, `tan`, `angle`, `fixangle`.
   - Bullet and terrain collision logic in `item/Bullet.java`, `item/BM.java`, `map/CMap.java`, `map/MM.java`.
   - Keep integer arithmetic where Java uses integer arithmetic.

7. Port screens incrementally:
   - `SplashScr`
   - `ServerListScreen`
   - `LoginScr`
   - `MenuScr`
   - room/board/preparation screens
   - `GameScr`
   - shop/inventory/equipment screens.

## Java-to-C# Mapping Notes

- `DataInputStream` / `DataOutputStream`: implement big-endian binary readers/writers. Do not use .NET `BinaryReader` defaults directly for shorts/ints.
- Java `byte` is signed; C# `byte` is unsigned. Use `sbyte` or explicit conversion helpers for protocol commands and XOR key operations.
- Java `Vector`: initially map to a small wrapper or `List<object>` to reduce churn.
- `Thread` + blocking queues: use `Task`, `CancellationToken`, `ConcurrentQueue<Message>`, or `Channel<Message>`.
- LibGDX `SpriteBatch`: map to MonoGame `SpriteBatch` or Unity `Texture2D`/UI rendering wrapper.
- LibGDX y-down orthographic camera: preserve coordinate direction; current rendering assumes y-down coordinates.
- `Gdx.app.postRunnable`: in C#, queue GPU texture creation onto the main thread.
- `RMS`: use `Application.persistentDataPath` in Unity or app data/local directory in MonoGame.

## Risk Areas

- Binary protocol breakage from byte signedness or endianness.
- Texture creation off the render thread.
- Path differences between `android/assets` and `desktop/assets`.
- Global state initialization order in `CCanvas.loadScreen`, `GameMidlet.initGame`, `CRes.init`.
- Integer math differences in projectile/angle logic.
- Rendering anchor/flip/clip behavior in `mGraphics`.
- Current repo has deleted files in git status: `gradlew.bat`, `run.bat`.

## First Implementation Milestone

Goal: boot a C# window/app showing the existing splash/login flow without server gameplay.

Tasks:

1. Create C# project skeleton.
2. Copy canonical assets into C# content folder.
3. Implement `CRes`, `Image`, `mImage`, `mGraphics`, `RMS` enough for splash/login.
4. Port `GameMidlet`, `MotherCanvas`, `CCanvas` startup path.
5. Port `SplashScr`, `ServerListScreen`, `LoginScr`, plus required models/fonts.
6. Verify asset rendering, touch/mouse input, and screen transitions.

## Second Implementation Milestone

Goal: connect to existing MobiArmy2 server and reach room/board screens.

Tasks:

1. Port `Message`, `Command`, `Session_ME`, `GameService`, `MessageHandler`, `GameLogicHandler`.
2. Add protocol tests for command length, key handshake, and signed command IDs.
3. Test login, server list, room list, board list.

## Third Implementation Milestone

Goal: playable battle parity.

Tasks:

1. Port map/terrain and player/equipment loaders.
2. Port `GameScr`, `CPlayer`, `Boss`, `BM`, `Bullet`.
3. Verify angle, force, projectile path, collision, wind, terrain holes, effects.
4. Compare against Java client behavior using same server and cached data.
