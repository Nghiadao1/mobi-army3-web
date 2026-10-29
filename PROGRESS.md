# MOBI ARMY 3 WEB — TIẾN TRÌNH & LUỒNG DỰ ÁN

> File này dùng để tiếp tục công việc ở phiên sau. Cập nhật lần cuối: 2026-10-29.

## 1. Tổng quan
- Clone Mobi Army 3 (PC/Unity) thành **game web offline** (đấu Bot / vượt ải) + **Solo online 1v1 (PeerJS P2P)**.
- Dùng tạm tài nguyên gốc đã giải mã (`../extracted/`) → `public/assets/`, sẽ thay đồ họa sau.
- Stack: **Vite + TypeScript + Canvas 2D**, không framework.
- Repo: https://github.com/Nghiadao1/mobi-army3-web (nhánh `main`)
- Web chạy: https://nghiadao1.github.io/mobi-army3-web/ (GitHub Pages tự deploy qua `.github/workflows/deploy.yml`)

## 2. Chạy & Deploy
```powershell
cd c:\Users\nghia\Downloads\MobiArmy3-PC\web-game
npm.cmd install
npm.cmd run dev      # http://localhost:5173/
npm.cmd run build    # tsc + vite build -> dist/
git add -A; git commit -m "..."; git push origin main   # tự deploy Pages
```

## 3. Cấu trúc mã nguồn chính
| File | Vai trò |
|---|---|
| `src/main.ts` | `GameApp`: sảnh (tabs Vượt Ải / Đấu Bot / Online / Hướng dẫn), HUD trận, bàn phím, nút cảm ứng |
| `src/engine/BattleEngine.ts` | Lõi trận đấu: lượt, gió, vật lý, đạn, kỹ năng tướng, item, camera, render |
| `src/engine/CharacterRenderer.ts` | Ghép nhân vật từ parts/poses (Big0..4.png + `2Small*.png`), phản lực bay |
| `src/engine/Terrain.ts` | Địa hình phá hủy được, `waterY`, raycast, spawn |
| `src/engine/BotAI.ts` | `PHYSICS`, `computeShotVelocity`, `solveBotShot` |
| `src/data/gameContent.ts` | `HEROES` (17 tướng), `BATTLE_ITEMS` (8), `CAMPAIGN_STAGES` (6 ải) |
| `src/types.ts` | Kiểu dữ liệu (`WeaponPattern`, `HeroDef` có `canFly`...) |
| `src/network/OnlineManager.ts` | PeerJS host/join phòng, đồng bộ action |
| `src/assets/AssetManager.ts` | Nạp manifest, sprite, parts, poses, maps |
| `public/assets/assets-manifest.json` | Đăng ký bullets/effects/bosses/ui/smallParts |
| `public/assets/data/maps.json` | 27 map (waterY đã hạ = maxBrickBottom + 18) |

## 4. Danh sách tướng (17) & kỹ năng
**Army (9):** Gunner (pháo), Aka (liên thanh), Điện Quang (sét), **King Kong** (khỉ parts 177–180, súng chuối part 32, bắn 4 quả chuối), Rocketer, Granos (lựu đạn chùm), **Chicky** (bắn gà `gatruilong.png`, 2 thanh lực: lực bay + giờ đẻ trứng vàng — phase `charging_2`), **Apache** (bắn kim cương lên trời, laze khúc xạ tam giác nổ điểm cuối), **Tazang** (bumerang `boomerang_curve`, đổi hướng giữa không trung).

**Marvel (8):**
- **Captain America**: khiên nảy 1 lần trên địa hình, xong/trúng mục tiêu bay về tay Cap (`returningToOwner`).
- **Iron Man / Ultron** (`canFly`): bay tự do 4 hướng (W/S/↑/↓ bay lên/xuống, A/D ngang), tốn thể lực; chỉnh góc bằng Q/E hoặc nút `📐±Góc`.
- **Ultron**: mỗi 3 lượt triệu hồi 1 nhân bản (tối đa 3), nhân bản tự bắn khi Ultron tấn công.
- **Hulk** (`hulk_leap`): bật nhảy theo quỹ đạo, càng cao càng mạnh; **không phá địa hình, không tự gây sát thương**.
- **Thor**: ném rìu Stormbreaker + cột sét giáng tại điểm cuối (`lightningBeams`).
- **Hawkeye**: bắn cung `muiten.png`; dùng item bất kỳ HOẶC góc 89° → mũi tên khổng lồ `muiten_cn.png` khóa mục tiêu 100%.
- **Winter Soldier**: giữ nguyên (bắn tỉa + lựu đạn chùm).
- **Loki**: đầu mỗi lượt biến hình ngẫu nhiên thành tướng khác (`baseHeroId === 'loki'`).

## 5. Tính năng đã xong
- [x] Hạ mực nước 27 map, spawn đúng mặt đất
- [x] 8 item chuẩn icon (`item.png` stripIndex 0,1,2,5,6,7,9,10): hồi máu, dịch chuyển, đạn đôi, chuột bom, khiên, ngưng gió, bom phá đất, tơ nhện
- [x] 6 ải campaign + boss (UFO, Mech, Bomber)
- [x] Đấu Bot 1v1/2v2, 3 mức độ khó
- [x] Solo online 1v1 PeerJS (link mời `?room=XXXX`)
- [x] Tối ưu mobile: pinch-zoom, nút cảm ứng, responsive
- [x] 17 tướng + kỹ năng như mục 4

## 6. Lưu ý kỹ thuật
- Sprite Marvel/nâng cấp lấy từ `extracted/server_cache/small_icons/2Small{imgId}.png` → copy vào `public/assets/heroes/small/` và thêm ID vào `manifest.smallParts`.
- Bullet mới: thêm file vào `public/assets/bullets/` + đăng ký trong `assets-manifest.json` (`{url, frames}`).
- Kỹ năng mới: thêm `WeaponPattern` (types.ts) → case trong `scheduleHeroWeapon` → xử lý `special` trong `updateProjectiles` / `detonateProjectile`.
- Online chỉ đồng bộ action (fire/move/item), RNG (Loki, gió) có thể lệch giữa 2 máy → cần seed nếu muốn chuẩn.
- Bot AI chưa hiểu cơ chế đặc biệt (bumerang, chicky 2 thanh, bay) — dùng quỹ đạo parabol thường.

## 7. Việc có thể làm tiếp (gợi ý)
- [ ] Đồng bộ seed RNG cho online (Loki, gió, hòm tiếp tế)
- [ ] Bot AI tính quỹ đạo bumerang / Hawkeye 89° / bay của Iron Man
- [ ] Thay đồ họa mới (heroOverrides trong manifest)
- [ ] Âm thanh riêng cho từng kỹ năng
- [ ] Thêm tướng / map / ải mới

## 8. Lịch sử commit chính
- `897b1b0` Thêm Ultron, Loki; làm lại kỹ năng Marvel + Apache/KingKong/Chicky
- `da6f353` Hulk đáp an toàn, Iron Man/Ultron bay 4 hướng, thêm Tazang bumerang

