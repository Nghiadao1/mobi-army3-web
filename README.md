# MobiArmy 2 — Original Web Client

Chuyển nguyên client Java/LibGDX của [vantu03/MobiArmy2-Client](https://github.com/vantu03/MobiArmy2-Client) sang JavaScript/WebGL bằng TeaVM. Nguồn gốc được giữ tại `upstream/MobiArmy2-Client`, gồm các module và pack asset ban đầu. Script build tạo bản sao có adapter trình duyệt; không sửa trực tiếp bản nguồn lưu trữ.

Luồng vào game theo yêu cầu: **intro gốc → tên nhân vật → vào game**, không yêu cầu đăng ký, email hay mật khẩu. Hồ sơ khách được nhận diện bằng mã ngẫu nhiên lưu trong trình duyệt và dùng database/server Army 2 gốc.

## Chạy và build

Cần Node 22+, JDK 21. Gradle Wrapper được khóa ở 8.14.3.

```sh
npm ci
npm test
npm run build
npm run dev
```

Client web tại `http://127.0.0.1:5180/`. `dist/` chứa JavaScript/WebGL và các asset gốc. Java chỉ cần lúc build, không cần trên thiết bị người chơi.

## Server

Các chức năng phòng đấu, shop, kho đồ, nhiệm vụ và chiến đấu dùng server gốc tại `upstream/MobiArmy2-Server`. Module `server` thêm launcher không có giao diện desktop, cấu hình database bằng biến môi trường và hồ sơ khách bằng tên nhân vật.

- `ARMY2_JDBC_URL`, `ARMY2_DB_USER`, `ARMY2_DB_PASSWORD`: database.
- `ARMY2_TCP_PORT`: cổng server, mặc định 8122.
- `npm run relay`: cầu nối WebSocket 8081 tới server TCP 8122.
- `ARMY2_INTEGRATION_URL=ws://127.0.0.1:8081 npm run test:server`: kiểm thử với server/database đang chạy.

`node scripts/prepare-database.mjs` tạo schema triển khai từ dữ liệu gốc, bỏ tài khoản mẫu. Không sử dụng database chứa dữ liệu thật để chạy kiểm thử.

Client mặc định kết nối relay cùng hostname, cổng 8081. Khi deploy HTTPS, cung cấp relay WSS qua tham số `?relay=wss://...`. GitHub Pages chỉ phục vụ client; server/database/relay cần một tiến trình backend riêng.

## Biệt đội Marvel

Code, asset, chỉ số và kỹ năng gốc của 17 nhân vật được giữ nguyên trong `extensions/marvel/original`. `npm run marvel:sprites` dựng lại 30 pose cho mỗi nhân vật bằng chính renderer, trang bị và asset đã có. Việc ghép đầy đủ kỹ năng vào client/server gốc đang tiếp tục; việc tạo sprite không đồng nghĩa với hoàn tất gameplay Marvel.

Xem trạng thái kiểm chứng tại [PROGRESS.md](PROGRESS.md). Bản viết lại rút gọn trước đây được lưu riêng trong `experiments/rewritten-demo`, không phải game mặc định.
