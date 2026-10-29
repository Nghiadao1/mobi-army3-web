# Army 3 Offline Web — Khung Game & Hướng Dẫn Thay Đồ Họa

Khung game bắn súng tọa độ **Offline (Đấu Bot & Vượt Ải)** chạy trực tiếp trên trình duyệt Web (HTML5 Canvas2D + TypeScript + Vite), sử dụng tài nguyên đã giải mã tách rời từ bản gốc để bạn dễ dàng thay thế sang IP/đồ họa riêng.

## 1. Cách Chạy Game Ngay
- **Cách nhanh nhất trên Windows:** Nhấp đúp file `run-web.bat` (tự động mở `http://localhost:5173`).
- **Hoặc qua Terminal / CMD:**
  ```bash
  cd web-game
  npm.cmd run dev
  ```
- **Đóng gói bản Web tĩnh (`dist/`):**
  ```bash
  npm.cmd run build
  ```

## 2. Cấu Trúc Thư Mục Tài Nguyên (Thay Đồ Họa Không Cần Đụng Code)
Toàn bộ ảnh và dữ liệu nằm dạng file rời chuẩn trong `public/assets/`:

- `public/assets/assets-manifest.json`: Bảng khai báo đường dẫn tài nguyên trung tâm.
- `public/assets/bricks/*.png`: 82 mảnh gạch địa hình HD. Bạn có thể vẽ lại bất kỳ file `.png` nào (giữ nền trong suốt PNG RGBA) — hệ thống tự động nhận va chạm pixel và khoét hố đạn theo alpha thật của ảnh mới!
- `public/assets/holes/*.png` & `hole2/*.png`: Mặt nạ đục thủng đất (`holes/`) và viền cháy đen quanh miệng hố (`hole2/`).
- `public/assets/bullets/*.png`: Ảnh đạn bay (hỗ trợ 1 frame hoặc dải nhiều frame dọc, chỉnh số `frames` trong `assets-manifest.json`).
- `public/assets/effects/*.png`: Hiệu ứng nổ, sét, khói, dịch chuyển, nước bắn.
- `public/assets/bosses/*.png`: Ảnh Boss UFO, Cỗ Máy Hủy Diệt, Máy Bay Ném Bom.
- `public/assets/heroes/`:
  - Mặc định đang đọc từ `Big0.png .. Big4.png` + `data/parts.json` + `data/poses.json` gốc.
  - **Khi muốn thay nhân vật mới:** Chỉ cần bỏ 1 file spritesheet ngang (ví dụ `public/assets/heroes/overrides/gunner_new.png`) và cập nhật mục `heroOverrides.gunner` trong `public/assets/assets-manifest.json`:
    ```json
    "gunner": {
      "url": "assets/heroes/overrides/gunner_new.png",
      "frameWidth": 96,
      "frameHeight": 96,
      "anchorY": 44
    }
    ```

## 3. Cách Chỉnh Sửa Tướng, Vũ Khí & Ải Chiến Dịch
- Mở `src/data/gameContent.ts`:
  - `HEROES`: Chỉnh máu, sát thương, góc bắn tối thiểu/tối đa, loại đạn, tuyệt kỹ POW.
  - `CAMPAIGN_STAGES`: Thêm/sửa các màn Vượt Ải, chọn `mapId`, thêm lính canh hoặc Boss (`ufo`, `mech`, `bomber`).

