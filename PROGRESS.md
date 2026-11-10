# MOBI ARMY 3 WEB — TIẾN TRÌNH & LUỒNG DỰ ÁN

> File lưu trữ tiến trình và luồng hệ thống để tiếp tục công việc bất cứ lúc nào.  
> Cập nhật lần cuối: **2026-11-05**

---

## 1. Tổng quan & Thông tin Workspace
- **Dự án**: Clone nguyên bản **Mobi Army 3** (PC/Unity) thành **Game Web Offline & Online 1v1 / Săn Boss Co-op**.
- **Thư mục làm việc hiện tại**: `D:\GitHub\AI\mobi-army3-web` *(chuyển từ `C:\Users\nghia\Downloads\MobiArmy3-PC\web-game`)*.
- **Tài nguyên giải mã & PC build gốc**: `D:\GitHub\AI\mobi-army3-web\tài nguyên\`:
  - `tài nguyên/extracted/gamedata_json/`: `images.json`, `maps.json`, `parts.json`, `poses.json`.
  - `tài nguyên/extracted/hd_x2/x2/`: `bg/`, `boss/`, `brick/`, `e/`, `eff/`, `effect/`, `gui/`, `gui2/`, `item/`, `map/`, `mb/`, `small/`.
  - `tài nguyên/extracted/server_cache/small_icons/`: 495 file `2Small*.png`.
  - `tài nguyên/extracted/GameLogic.Full.utf8.cs` & `GameLogic.Hot.utf8.cs`: Script logic C# gốc Mobi Army 3.
  - `tài nguyên/MobiArmy3/`: Bản build Unity PC hoàn chỉnh (`GameAssembly.dll`, `MobiArmy3.exe`).
- **Stack công nghệ**: **Vite + TypeScript + Canvas 2D Native**, không dùng framework nặng, tải nhanh và mượt mà trên cả Mobile & PC.
- **Git Repo**: `https://github.com/Nghiadao1/mobi-army3-web` (nhánh `main`).
- **Web Demo**: `https://nghiadao1.github.io/mobi-army3-web/` (GitHub Actions CI/CD tự động deploy).

---

## 2. Cách chạy & Triển khai
```powershell
cd D:\GitHub\AI\mobi-army3-web
npm.cmd install
npm.cmd run dev      # Khởi chạy dev server: http://localhost:5173/
npm.cmd run build    # tsc && vite build -> thư mục dist/
git add -A; git commit -m "..."; git push origin main   # Tự động deploy GitHub Pages
```

---

## 3. Kiến trúc mã nguồn chính
| File | Vai trò & Trách nhiệm |
|---|---|
| [`src/main.ts`](file:///D:/GitHub/AI/mobi-army3-web/src/main.ts) | Controller chính: Sảnh chờ Lobby (Vượt Ải / Đấu Bot / Săn Boss Co-op / Online WebRTC), Modal chọn tướng (Filter 10 Xạ Thủ & 17 Avenger), Modal chọn 43 Maps & 7 Boss, HUD chiến đấu, phím ảo cảm ứng mobile & phím tắt PC |
| [`src/engine/BattleEngine.ts`](file:///D:/GitHub/AI/mobi-army3-web/src/engine/BattleEngine.ts) | Lõi trận đấu: Tính toán lượt đi, nạp đạn, lực gió, đạn vật lý, cơ chế kỹ năng đặc biệt của từng anh hùng, hiệu ứng nổ, trừ máu, lá chắn ma thuật, đánh dấu mục tiêu, camera rung chấn, âm thanh |
| [`src/engine/CharacterRenderer.ts`](file:///D:/GitHub/AI/mobi-army3-web/src/engine/CharacterRenderer.ts) | Trình kết xuất nhân vật: Ghép 6 lớp trang bị (Mũ, Thân, Chân, Vũ khí, Kính/Mặt nạ, Cánh/Balo) từ `Big0..4.png` + `2Small*.png` theo 30 Poses chuẩn Mobi Army 3, hiệu ứng lá chắn ma thuật, dấu ấn tử thần, Mandalas, hào quang Nộ POW |
| [`src/engine/Terrain.ts`](file:///D:/GitHub/AI/mobi-army3-web/src/engine/Terrain.ts) | Địa hình phá hủy được bằng mask hố đạn (`h32x26.png`, `h44x39.png`, `h55x50.png`, `hrangcua.png`), tạo cục tơ nhện, thuật toán Bresenham raycast va chạm và tìm vị trí spawn an toàn trên mặt đất |
| [`src/engine/BotAI.ts`](file:///D:/GitHub/AI/mobi-army3-web/src/engine/BotAI.ts) | AI Bot: Tính toán góc và lực bắn tối ưu theo vận tốc gió và khoảng cách mục tiêu, hỗ trợ 3 cấp độ (Dễ, Vừa, Khó) |
| [`src/data/gameContent.ts`](file:///D:/GitHub/AI/mobi-army3-web/src/data/gameContent.ts) | Dữ liệu chính thống: 27 Anh Hùng (10 Xạ thủ cơ bản + 17 Biến thể Avenger), 16 Vật phẩm chiến đấu, 12 Ải Vượt Ải Campaign, 7 Trận Săn Boss Co-op |
| [`src/types.ts`](file:///D:/GitHub/AI/mobi-army3-web/src/types.ts) | Định nghĩa TypeScript: `HeroDef`, `HeroEquipment`, `WeaponPattern`, `BattleItemDef`, `MapDef`, `CampaignStage` |
| [`src/network/OnlineManager.ts`](file:///D:/GitHub/AI/mobi-army3-web/src/network/OnlineManager.ts) | Quản lý mạng P2P qua WebRTC (PeerJS), đồng bộ phòng chơi, chọn tướng, góc ngắm, lực bắn, item, chat realtime và xử lý ngắt kết nối an toàn |
| [`src/assets/AssetManager.ts`](file:///D:/GitHub/AI/mobi-army3-web/src/assets/AssetManager.ts) | Bộ nạp tài nguyên: Load `assets-manifest.json`, `maps.json`, `parts.json`, `poses.json`, hình ảnh spritesheets và âm thanh Web Audio API |
| [`public/assets/data/maps.json`](file:///D:/GitHub/AI/mobi-army3-web/public/assets/data/maps.json) | Dữ liệu 50 Maps (43 Map chiến trường + 7 Đấu trường Boss) đã được cân chỉnh mực nước `waterY` và `height` hoàn hảo |

---

## 4. Hệ thống Nhân Vật Chuẩn Official (https://mobiarmy3.me/nhan-vat)

### 4.1. 10 Xạ Thủ Cơ Bản (Xạ thủ #1 → #10)
1. **Gunner (#1)**: Pháo thủ cối chuẩn mực Mobi Army. POW bắn chùm 3 đại pháo hạt nhân hủy diệt.
2. **Miss 6 (#2)**: Xạ thủ tiểu liên bắn điểm xạ chuẩn xác theo góc ngắm. POW xả nguyên băng 6 viên xuyên giáp.
3. **Electician (#3)**: Chiến binh lôi điện phóng chùm 3 cầu sét Plasma ít lệch gió. POW Thiên Lôi Ngũ Tuyệt (5 tia sét).
4. **King Kong (#4)**: Khỉ đột vác súng chuối bắn chùm 4 quả chuối xoáy liên hoàn phá nát địa hình. POW Mưa Chuối Rừng Xanh.
5. **Rocketer (#5)**: Phóng chùm 3 tên lửa tầm xa tách góc rải thảm. POW phóng 5 đầu đạn tên lửa liên hoàn.
6. **Granos (#6)**: Lựu đạn mẹ phát nổ văng ra 3 quả bom con nảy tiếp trên mặt đất. POW Siêu Bom Phân Mảnh (5 bom con).
7. **Chicky (#7)**: Đạn bắn ra là Gà Bay với cơ chế **2 thanh lực**: Thanh 1 căn lực bay của Gà, Thanh 2 căn chuẩn xác giây Gà đẻ Trứng Vàng rơi xuống.
8. **Tarzan (#8)**: Ném chiếc Bumerang xoáy lượn vòng cung và **tự động đảo ngược hướng bay** giữa không trung.
9. **Apache (#9)**: Bắn viên Kim Cương lên trời rồi phóng tia Laze khúc xạ qua Kim Cương tạo thành mạng lưới tam giác hủy diệt điểm cuối.
10. **Magenta (#10)**: Xạ thủ tinh tú bắn chùm 4 quả cầu ma pháp tím lượn xoáy và hội tụ vào mục tiêu. POW Đại Cầu Tinh Vân hủy diệt.

### 4.2. 17 Anh Hùng Biệt Đội Avenger
- **Iron Man / Iron Chiến Giáp Nano**: Bay lượn tự do 4 hướng (W/S/A/D) vượt qua mọi địa hình đồi núi, cự ly di chuyển +90%, nạp đạn 295, công +350. Bắn liên hoàn 4 pháo plasma. POW Bão Tên Lửa Jericho Micro.
- **Iron Man Mark 50**: Kỹ năng **Pháo Năng Lượng**: Bắn tia năng lượng thẳng xuyên qua mọi đối tượng trên đường bắn gây 150% sát thương (kích hoạt sau 2 phát bắn thường).
- **Hulk**: Bật nhảy trực tiếp tới mục tiêu, ngắm bắn thẳng góc 90°, hoàn toàn miễn nhiễm gió. Nhảy trúng người **không phá địa hình và không tự làm tổn thương mình**, sát thương tỷ lệ thuận theo độ cao cú nhảy (HP +250%, công +450).
- **Red Hulk**: Kỹ năng **Xé Gió**: Vỗ tay tạo luồng cuồng phong sang trái/phải gây 150% sát thương toàn bộ vùng gió (dùng sau 2 phát thường).
- **Thor**: **Sấm Sét** (theo mobiarmy3.me/nhan-vat): 2 phát đầu ném búa thường, phát thứ 3 gọi sét đánh xuống, mỗi cột sét gây 150% sát thương (nạp đạn 250 cực nhanh).
- **Thor Stormbreaker**: Ném rìu Stormbreaker, gọi **Bão Sét Tam Hướng** quanh chỗ búa rơi gây 150% sát thương diện rộng sau 2 phát thường.
- **Loki**: Kỹ năng **Giả Dạng**: Đầu mỗi lượt tự động biến thành 1 người chơi khác trên sân và sử dụng trọn vẹn bộ kỹ năng của họ. Phát bắn trúng có **20% cơ hội đóng băng đối thủ 1 lượt**.
- **Doctor Strange**: **Lá Chắn Ma Thuật**: Sau 3 phát thường tự động bật khiên (không mất lượt), chặn trọn vẹn 100% đòn đánh kế tiếp rồi vỡ. Nội tại Đĩa Phép: **Đĩa xanh** bỏ qua 20% phòng thủ, **Đĩa vàng** giảm 10% sát thương địch ở lượt sau.
- **Captain America**: Ném Khiên Vibranium bật nảy 2 lần trên địa hình rồi bay về tay. **Nội tại ẩn**: Giảm 20% sát thương toàn phần, đồng đội cùng phe nhận +20% phòng thủ.
- **Captain Nomad**: Phiên bản Nomad chiến đấu phong trần, công 255, giảm 20% sát thương toàn phần, đồng đội +20% phòng thủ.
- **Captain Bạc Vàng**: Bộ giáp hoàng kim hoàng gia, nạp đạn nhanh 290, công 260, giảm 20% sát thương toàn phần, đồng đội +20% thủ.
- **Winter Soldier**: Đạn súng ngắm **bắn xuyên qua địa hình** để đánh trúng mục tiêu ẩn nấp phía sau.
- **Winter Soldier Mùa Đông**: **Đánh Dấu Mục Tiêu**: Đạn xuyên địa hình. Phát bắn thường trúng đối thủ sẽ đánh dấu họ tới hết trận, mục tiêu bị đánh dấu nhận thêm 20% sát thương từ mọi nguồn.
- **Hawk Eyes**: Bắn cung thiện xạ. Kỹ năng **Khóa Mục Tiêu** (theo mobiarmy3.me/nhan-vat): sau 3 phát bắn thường, phát kế tiếp bắn 4 mũi tên tự tìm mục tiêu, mỗi mũi gây 50% sát thương. (Đã bỏ cơ chế tự chế cũ: mũi tên khổng lồ góc 89°/350 DMG và nạp kỹ năng bằng Item — Item của Hawk Eyes nay hoạt động như mọi hero.)
- **Hawk Eyes Công Nghệ**: **Phi Cơ Hỗ Trợ**: Gọi chiến đấu cơ xả súng càn quét diện rộng quanh mục tiêu gây 200% sát thương (dùng sau 2 phát thường).
- **Ultron**: Bay lượn tự do như Iron Man. Kỹ năng **Phân Thân**: Tạo bản sao sở hữu 33% máu tối đa & sát thương (tối đa 5 bản sao). Bản sao tự động nã pháo yểm trợ mỗi khi Ultron tấn công.
- **Ultron Tối Thượng**: Phân thân + **Tăng Cường**: Khi máu tụt xuống dưới 50% HP, tự động hút bản sao còn nhiều máu nhất để hồi phục lượng HP tương ứng (1 lần mỗi trận, không mất lượt).

---

## 5. Danh Sách Bản Đồ Chuẩn Official (https://mobiarmy3.me/ban-do)

### 5.1. 43 Bản Đồ Chiến Trường
1. Cây cầu băng (Mới)
2. Khu năng lượng (Mới)
3. Căn cứ thép 2 (Mới)
4. Sân bay (Mới)
5. Đảo uốn lượn (Mới)
6. Sinh Tử (Mới)
7. Kim tự tháp 2 (Mới)
8. Cầu vồng băng (Mới)
9. Vách núi (Mới)
10. Chiến trường (Mới)
11. Đảo vòng cung (Mới)
12. Đảo mây (Mới)
13. Thang mây (Mới)
14. Không lối thoát (Mới)
15. Cầu sắt 2 (Mới)
16. Bám trụ (Mới)
17. Lưới sắt (Mới)
18. Thoát thân (Mới)
19. Thiên đường (Mới)
20. Miền đất hứa (Mới)
21. Mê cung (Mới)
22. Hang đá 2 (Mới)
23. Cây cầu dừa (Mới)
24. Đền tế 2 (Mới)
25. Bong bóng 1 (Mới)
26. Bong bóng 2 (Mới)
27. Cầu vồng (Mới)
28. Cầu băng
29. Đảo 2 cây dừa
30. Nghĩa trang
31. Kim tự tháp
32. Đảo nổi
33. Băng giá
34. Đền tế
35. Trốn thoát
36. Song sắt
37. Rào cản
38. Thành Phố Sắt
39. Rừng đá
40. Hang đá
41. Đảo bay
42. Cầu sắt
43. Căn cứ thép

### 5.2. 7 Đấu Trường Đại Boss
1. Boss Bạo chúa công nghệ
2. Boss Bao vây (Đấu trường 1100x850)
3. Boss Hai tòa tháp (Đấu trường 1150x700)
4. Boss Khí cầu (Đấu trường 1200x800)
5. Boss Đặt bom (Đấu trường 1000x800)
6. Boss Rùa (Đấu trường 1000x800)
7. Boss Rồng (Đấu trường 1000x800)

> **Cải tiến mực nước**: Đã cân chỉnh toàn bộ 50 maps sao cho mực nước luôn cách đáy gạch thấp nhất tối thiểu 75px, loại bỏ 100% tình trạng spawn rơi xuống nước hoặc không còn đất di chuyển.

---

## 6. Lịch Sử Commit Gần Nhất
- `c48a102`: Cập nhật tài nguyên MobiArmy3 Unity PC (`MobiArmy3.exe`, `GameLogic.dll.bytes`, resources).
- `6676421`: Sửa lỗi Thor, Ironman, Loki, đạn bắn góc siêu cao, thêm 3 Đại Boss mới (Boss Bom, Titan Robot, Dơi Chúa).
- `364cee2`: Mobile portrait & landscape responsive layout cho lobby room, pedestals, top bar & bottom bar.
- `ffcf83b`: Fix Loki & Iron Man sprite offsets, Hulk wind immunity & 90 deg aim, Hulk landing crater logic, giảm phá đất 20%, top header chat ticker, lobby dual board/room view, 50 official maps & massive boss arenas.
- `43389cc`: Lobby room UI overhaul, Green Hulk, Ultron clone online sync, disconnect handling, indestructible terrain, in-game chat & Iron Man plasma rework.
- `85f57ee`: Loki transform note, Captain bounce/POW, bag slots, web terrain, new items, flying wall-pierce, online coop boss hunt & 3 new bosses.

---

## 7. Roadmap — Hướng làm tiếp

> Thêm ngày **2026-11-05** sau khi rà soát toàn bộ code. Làm theo thứ tự P0 → P1 → P2, xong mục nào đánh dấu `[x]` vào mục đó.
> Kiểm tra chuẩn trước khi push: `npm test` (test vật lý đạn) + `npm run build` (tsc & vite build) đều phải pass, và chơi thử tay 1 trận Đấu Bot + 1 trận Vượt Ải.

### P0 — Dọn nền (2026-11-05)
- [x] Thêm mục Roadmap này vào PROGRESS.md để không mất phương hướng giữa các phiên làm việc.
- [x] Thêm `.muse/` và `.bridge_backups/` vào `.gitignore` để `git status` luôn sạch.
- [x] Thiết lập Vitest + bộ test tự động đầu tiên cho vật lý đạn trong `src/engine/BotAI.test.ts` (hàm `computeShotVelocity` và `solveBotShot`), chạy bằng `npm test`.

### P1 — Giảm rủi ro & tăng giá trị chơi
- [ ] Tách `src/engine/BattleEngine.ts` theo từng bước nhỏ. ✅ Bước 1 (2026-11-05): `scheduleHeroWeapon` (702 dòng) đã chuyển sang `src/engine/heroWeapons.ts` — hàm chỉ dùng 4 thành viên của engine (`queueProjectile`/`spawnBullet`/`spawnFloatingText`/`chargePower2`, 3 method đầu chuyển private→public), BattleEngine còn 4.629 dòng và chỉ giữ method ủy quyền; body kiểm chứng giống hệt bản gốc (chỉ `this.`→`engine.`), tsc + 20/20 test + build pass. Bước tiếp theo (khi cần): `spawnFighters` hoặc `detonateProjectile`. Sau mỗi bước phải chạy lại `npm test` + `npm run build`.
- [ ] Nếu cần, tách tiếp `src/main.ts` (2.212 dòng) phần render Lobby / Modal.
- [x] Vòng lặp tiến trình (2026-11-10, Gói A Army 2): thưởng xu sau trận + 54 nhiệm vụ + mở khóa dần 7 hero cổ điển theo giá gốc Army 2 trong `src/data/progression.ts`, lưu `localStorage` (chi tiết ở mục ARMY 2 UPDATE cuối file). Khác kế hoạch gốc: khóa hero cổ điển (có giá gốc Army 2) thay vì Avenger (giữ miễn phí).

### P2 — Mở rộng sau khi nền vững
- [x] Thêm content mới (2026-11-05): Map 43 'Kim Tự Tháp Đảo Chiều' (lật ngang map Kim Tự Tháp theo đúng kích thước gạch thật, tổng 51 map), Ải 31 (Loki & Ultron Tối Thượng ở map 43), Boss 118 'Song Thú Hỗn Mang' (Hắc Long + Nhện Chúa cùng lúc). Sửa luôn 9 lỗi heroId cũ ('winter' -> 'wintersoldier', 'chick' -> 'chicky' khiến địch bị rơi về Gunner mặc định) và thêm test kiểm tra dữ liệu stage/map/hero trong `src/data/gameContent.test.ts`. Tổng test hiện tại: 18.
- [x] Online (2026-11-05): tăng độ ổn định WebRTC trong `src/network/OnlineManager.ts` — timeout 15s khi tạo/vào phòng, tự thử mã phòng mới khi trùng mã, tự reconnect khi rớt broker PeerJS, heartbeat ping/pong mỗi 5s (mất liên lạc >15s thì tự kết thúc trận), bắt lỗi 'peer-unavailable' khi vào phòng không tồn tại, `send()` trả trạng thái và log khi rớt gói. Vẫn dùng PeerJS cloud làm broker (chưa self-host).
- [x] Tối ưu bundle (2026-11-05): tách chunk bằng dynamic import — BattleEngine (99,8KB) chỉ tải khi vào trận, PeerJS (117KB) chỉ tải khi tạo/vào phòng Online. Chunk chính của lobby giảm từ 339KB xuống 156KB (gzip 92,5KB -> 42,3KB).
- [x] Âm thanh + font gốc (2026-11-06): trích xuất toàn bộ 26 đoạn âm thanh từ resources.resource của bản Unity theo _audio_manifest.tsv (20 đoạn FSB5-Vorbis dựng lại OGG bằng python-fsb5, 6 đoạn IMA-ADPCM/Vorbis còn lại giải bằng vgmstream; sound/2 trùng hệt sound/water nên bỏ) -> 27 file trong public/assets/audio/ (music_0 = nhạc nền 204s + bản .mp3 cho Safari). SoundEngine thành dạng lai: nhạc nền lặp music_0 ở sảnh / music_1 khi vào trận (tôn trọng nút tắt tiếng, mở khóa sau thao tác đầu tiên), playShoot/playItemUse/playSplash ưu tiên file gốc shoot/fire/item/water qua bộ đệm WebAudio, tiếng tổng hợp làm dự phòng; tiếng nổ + sound 50-68 + 59/60 chờ nghe định danh. Nhúng 4 font TTF gốc (barmeneb/chelthm/normalFont1/staccato) qua public/fonts.css: Army Normal cho chữ thường, Army Display cho tiêu đề + số sát thương canvas, Army Numbers cho đồng hồ HUD, Army Brush cho banner lượt.



## BIG UPDATE x3 (2026-11-06) — tai nguyen giai ma tu BlueStacks dua vao game
- Nang cap do phan giai x3 (1.5x) cho 268 file trung ten: backgrounds, bricks 173-254, effects, bullets, ui/item.png; them SpriteStripEntry.div=1.5 trong assets-manifest.json (31 muc bullets/effects + bullets.tornado moi) va 2 diem ve (dan + hieu ung) chia theo div de giu nguyen kich thuoc hien thi. Bosses KHONG nang cap vi CharacterRenderer cat frame theo pixel co dinh.
- 4 item chien dau moi (tong 20): Thien Thach Roi (phao hieu -> thien thach 300 dmg roi xuong diem danh dau), Loc Xoay Cuon Phang (loc chay doc mat dat, dmg vung theo nhip + gam dia hinh, dung effect locxoay truoc day chua dung), Dan Lua Thieu Dot (dot chay 60 HP x 2 luot, Fighter.burnTurns), Tia Laser Xuyen Pha (bay thang, bo qua gio + trong luc, vet dan do).
- Sua icon strip bi lech: double 1->4 (x2), shield 4->20, vampire 31->34, mouse 7->31, suicide 29->24, stealth 23->29, airstrike 26->22, poison 38->32, nuke 35->25; item moi dung cac o chua dung 23/19/40/18.
- UI: DPad tran dau thay bang ban ve goc gui2 (public/assets/ui/dpad/dpad.png + 4 vung bam data-hold trong suot, sang vang khi giu), giu nguyen hop bay (angleUp/angleDown) va o GOC BAN.
- Kiem chung: tsc OK, vitest 20/20, vite build OK.


## ARMY 2 UPDATE (2026-11-10) — port noi dung tu source Mobi Army 2 (vantu03 client/server + ban COFFEE)
- Goi A Tien trinh: file moi src/data/progression.ts — 54 nhiem vu (18 nhom x 3 cap) + gia mo khoa 7 hero co dien (Granos 20k, Rocketer 30k, King Kong 40k, Apache 70k, Tarzan 90k, Chicky 100k, Magenta 120k xu) lay nguyen tu bang mission/nhanvat cua dbarmy2.sql (ban share Army 2). Ho so luu localStorage 'mobiarmy3_progression_v1': xu/XP/danh du, ngay dang nhap, bo dem thong ke tran (soloWins/damage/kills/ufoWins/bossWins/kill_<hero>/win_<hero>...). UI: badge xu gia o sanh thanh badge that + nut mo modal Nhiem Vu (54 dong, thanh tien do, nut Nhan Thuong); modal Chon Tuong co the khoa + huy gia + nut Mo Khoa o chan modal, chan ra tran bang tuong chua mo khoa; modal ket qua tran cong xu (+500..1500 tuy che do thang, hoa 200, thua 100, +damage/50 toi da 500) va bao nhiem vu vua hoan thanh. Nhom goc khong co co che tuong ung duoc anh xa lai (co ghi ro trong header progression.ts): ngoc cap 8/9/10 -> chinh phuc ai/boss khac nhau + tong thang; Nem B52 -> tong tieu diet; dau Ma -> Boss Doi (ai 117); Proton -> Dien Quang; dau tren 5 nguoi -> Online 1v1. Thuong 'luong' cua ban goc bo qua (web chi con xu/XP/danh du). Tao ho so moi duoc tang 20.000 xu (du mua Granos).
- Goi B Map: convert 11 map Army 2 chua co vao maps.json (mapId 57-67): Halloween, Halloween 2, Bom 1, Bom 2, Thanh pho nhen, Thanh pho may, Khung long may, Khu vuc cam, Dinh Hi Ma Lap Son, Hang nhen, Nghia trang 2. Format .map doc tu MM.java cua client Army 2: [width u16BE][height u16BE][n u8] + n x [brickId u8][x u16BE][y u16BE] + tail diem spawn. Quy doi brickId = id + 168 (kiem chung khop 100% tap gach voi 3 map trung ten da co san: Cay cau bang, Sinh Tu, Cau vong bang); rieng id 97-102 (gach Halloween/Nghia trang, vuot tran 254) dung cong thuc fallback 173 + id % 82 -> 188-193; bo 2 gach sentinel x=-1 (0xFFFF) trong Halloween 2 va Balloon. height = h + 22, waterY = height - 40 (dung mau 3 map giong het), bgId gan theo map cung chu de (11 nghia trang, 21 pho/thap, 22 khung long, 27 luoi sat, 14 hang da). Tong map: 51 -> 62.
- Goi C Item: them 7 item (tong 27) tu bang item Army 2: Di Chuyen x2 (dung tai cho, the luc x2 trong luot), Dan Xuyen Dat (arm + special 'piercing_terrain' san co cua engine), Mua Dan (phao hieu -> 12 vien dan 24 dmg trut xuong quanh diem cham), Bom Mu (Fighter.blindTurns=2; bot ban lech +-7 do, luc +-15% khi executeFire, tru dan theo phat ban), Bom Hen Gio (placedBombs dem nguoc theo luot cua chu bom, ve truc tiep tren canvas + no bang Projectile tong hop qua detonateProjectile), Ten Lua (special 'rocket': trong luc 35%, 105% cong, blast 55), Khoang Dat (special 'drill': cham dat -> crawling duoi long dat, carveCrater h14x12 moi 4 tick, no khi sat dich/het 95 tick). Icon tam dung cac o strip dang trong 5/14/15/16/17/21/26 — chua doi chieu truc quan tung o voi strip goc nhu dot x3. Bot chua tu dung 7 item nay (chi nguoi choi lap tui).
- Kiem chung: tsc OK, vitest 33/33 (them src/data/progression.test.ts 11 test; gameContent.test +2: map Army 2 + item Army 2), vite build OK (BattleEngine chunk 103.67 -> 110.48KB). TRANG THAI: chua commit/push, cho user duyet. Ban lam viec nam o may Muse (~/workspace/mobi-army3-web-work, clone tu GitHub main); can dong bo 10 file thay doi sang Windows qua SheepGate khi agent online roi chay lai test/build tren Windows.

## REBUILD ARMY 2 - GIAI DOAN 1: ASSET (2026-11-10)
User chot huong dap-xay lai: thay toan bo asset bang asset goc Army 2 (source vantu03 + ARMY-2-COFFEE), port co che + boss Army 2, chi giu nhan vat Marvel. GD1 = asset:
- Pipeline: tools/import-army2-assets.mjs (idempotent, chay: node tools/import-army2-assets.mjs) - 105 thao tac chep, 0 bo qua.
- THAY TRUC TIEP (cung ten + cung ti le frame, ban Army 2 = 1x, ban cu = x3 chay div 1.5 -> div 0.5, kich thuoc hien thi giu nguyen): effects/no.png (explosion), effects/locxoay.png (tornado), bullets/axit.png (acid f16), bullets/bongbong.png (f2), bullets/box.png + box2 + boxEmpty (crate), ui/logoGame.png (logo goc 82x65).
- ITEM STRIP: ui/item.png doi sang ban x2 Army 2 (32x1312, 41 o) thay ban Army 3 (50x2048); REMAP stripIndex ca 27 item theo dung o Army 2 (nhan dien truc quan tung o + doi chieu bang item DB): vampire 34->13 (binh thuoc), mouse 31->32 (nhen), suicide 24->9 (luu dan), nuke 25->26 (no), digger 28->25 (pheu dao dat), drill 26->8 (nui lua/khoan), laser 18->22 (tia), fire_ammo 40->33 (duoc lua), smoke 16->7 (xoay khi), windstop 11->28 (quat gio), freeze 36->30 (tinh the bang), web 27->31 (nhen), stealth 29->6 (bong ma - khop DB item 5 Tang hinh), shield 20->36 (ao giap), airstrike 22->29 (dia bay), team_heal 13->16 (cross + chevron), bullet_rain 15->10 (bom chum), timebomb 17->24 (bom gai), poison 32->38, pierce 14->18. Mot vai o la "best match" (pierce/poison/bullet_rain/timebomb) - can user xem lai bang mat.
- STAGING cho GD2/GD3 (200 file, chua noi engine): heroes/army2/big0-9.png (sheet 10 hero classic), bosses/army2/snowman/ (14 file Nguoi Tuyet) + bosses/army2/parts/ (40 manh boss server: robot/UFO/nhen/ma/khi cau/T-Rex), backgrounds/army2/ (25 manh canh quan bgItem), ui/army2/ (gui + x2/gui 127 file + newGUI), audio/army2/ (music0.mp3 24s loop + 3 wav).
- CHUA thay (co ly do): gach 173-254 + nen b2xx + sheet hero Marvel/classic dang dung = xuat xu Army 3 (khong co ban Army 2 tuong duong dang file rieng - Army 2 ve nen bang manh bgItem + gach la o 12px trong .map); holes/ (ban 1x lam ho dan co lai ~5 lan - thuoc GD2 tune vat ly); dan/effect con lai (dan ten rieng chi co o dang bullet0-10 danh so trong server - can doi chieu tung vien o GD2).

## REBUILD ARMY 2 - GIAI DOAN 2: NEN + ASSET PACK + VAT LY (2026-11-10)
- FILEPACK GIAI MA: ca 5 pack cua client (map/bg, gui/gui, item/item, effect/effect, effect/Hole) dung XOR khoa "NguyenVanMinh", index XOR chay LIEN TUC tren toan vung du lieu (ban dau giai sai phase tung file). Pipeline (tools/import-army2-assets.mjs) tu giai ma + staging public/assets/packs/* (123 file) va doi chieu cheo Node vs Python: trung khop 100%.
- ASSET THAY TIEP (ban goc trong pack, ti le 3x da kiem chung, div 0.5): effects ex3/freeze/khoi/khoidoc/lua/tangHinhEffect/teleport_eff/waterBum/longga + locxoay (ban pack 40x96 dung hon ban roi 32x96 cua GD1) + bomnguyentu (div 0.56); bullets grenade/rocket2/laser/13Missile/bomb/trungvang/thienthach/daodat/specialbullet/web/gatruilong; holes/* ca 12 file = ban goc Hole pack (CUNG kich thuoc -> 0 doi gameplay, chi doi nguon goc byte) + bullets/hrangcua.
- NEN ARMY 2 (port Background.java): module src/engine/army2Background.ts chua bang spec 14 type (mau troi phang + mau chan canh + cap manh xa/gan + sun/may) trich nguyen van setColor/loadImage cua client; BattleEngine.drawSkyAndParallax viet lai: troi phang, manh bgItem lap gach parallax xa 1/8 gan 1/4, mat troi sun0/sun1 + may cl1/cl2 tu bg pack; AssetManager nap truoc manh theo bgType. maps.json: them bgType cho ca 62 map - 39 map khop DB Army 2 (bang map dbarmy2), 13 theo tu khoa ten, 10 gan tay/mac dinh. Bo renderer b2xx cu (pickBackgroundLayers giu lai lam legacy, khong con dung).
- HERO CLASSIC: bigImage0-9 cua Army 2 la ATLAS TRANG BI dung chung he part/pose voi ban web dang dung (Army 3 ke thua nguyen he nay; bang dataImage/parts/poses cua Army 2 nam phia server, khong co trong source) -> renderer hien tai DA la renderer Army 2/3 dung chung, khong co ban thay the nao khac de port. Giu nguyen.
- VAT LY: client Army 2 chi VE lai quy dao server tinh san (Bullet nhan xPaint/yPaint; BM chi chua bang trong luong/gio BULLset_* lay tu server, ban dich san khong co; server Bot.java khong chua mo phong quy dao) -> khong co hang so goc doc duoc. Giu PHYSICS hien tai (GRAVITY 0.215, WIND_FACTOR 0.0029, MAX_POWER_SPEED 18.2) - ep so doan se lech ca BotAI solver. Phan "vat ly" lam duoc that: ho dan dung mask goc Army 2 (xem tren).
- CHUA LAM trong GD2: electric.png (59x448, so frame khong chia het cho 5 nhu manifest - chua ro frame goc), chuotBull (25x26 sprite don, manifest dang cat 4 frame sai ca o ban cu), nuoc kieu Army 2 (wts 24x24 2 frame - co san trong bg pack, de GD sau), tuyet/set cho bgType 12, rock_up treo tren tran cho bgType 13 (da rut gon 2 lop).

## REBUILD ARMY 2 - GIAI DOAN 3: BOSS ARMY 2 (2026-11-10)
Port boss goc Army 2 theo Boss.java (client) + bang FrameImage trong CPlayer.java:
- 9 UnitKind moi (types.ts): a2_ufo (gun 16), a2_robot (gun 15 BigRobot), a2_trex (gun 13 BugRobot), a2_spider (gun 22), a2_balloon (gun 17 Khi cau), a2_ghost (gun 25), a2_ghost2 (gun 26), a2_gift (gun 23/24 hop qua), a2_snowman (bo sprite Boss/SnowMan - client khong co code ve SnowMan trong ban source nay, dung fullBody/body_injured/arm nguyen bo).
- CharacterRenderer: them drawA2* dung SPRITE GOC (khong ve tay): UFO 51x46 frame 0/1 + UFOFire nhap nhay; BigRobot lap leg + body (+body_injured) + arm cat 35x40; T-Rex bug_leg 44x25/bug_body 42x30/bug_gun 15x15; Nhen spider 41x22 x 2 doan than + soi to + luoi; Khi cau khicau 143x49 + fan1/fan2/front_fan/back_fan + nhip deltaYKC; Ma ma/ma2 35x32 x 4 frame; Hop qua box2 trong bong bongbong; Nguoi Tuyet fullBody + arm 80x64 khi ban. Helper drawStripFrame dung chung.
- BattleEngine: them a2_ufo/a2_balloon/a2_ghost/a2_ghost2/a2_gift vao danh sach bay (ca 2 cho spawn campaign + coop). AssetManager nap truoc sprite boss Army 2.
- 10 man San Boss moi (BOSS_HUNT_STAGES 119-128) tren dung map boss 41-50 cua Army 2 (doi chieu file .map trong DB): UFO->map 64 Khu vuc cam, Robot->62 Thanh pho may, T-Rex->63 Khung long may, Nhen may->61 Thanh pho nhen, Khi cau->65 Dinh Hi Ma Lap Son, Ma->2 Nghia trang, Song ma->67 Nghia trang 2, Vua bom->59 Bom 1, Nguoi Tuyet->11 Cay cau bang, Chua Nhen->66 Hang nhen. HP 3100-4600 ngang boss hien co, vu khi theo heroId classic.
- Boss Army 2 ban bang he vu khi hero nhu boss hien tai (server goc tinh rieng tung loai dan boss - khong co trong source; giu co che chung cua game).
