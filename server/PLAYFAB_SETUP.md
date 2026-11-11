# Thiết lập PlayFab cho MobiArmy 2 Web

## Kiến trúc được hỗ trợ

PlayFab được dùng để tạo và định danh tài khoản người chơi. Server gọi
`Server/LoginWithServerCustomId` và lưu `PlayFabId` dưới dạng khóa tài khoản
trong bảng `user`.

PlayFab **không thay thế MySQL** trong dự án này. Server Army 2 gốc dùng SQL,
khóa ngoại và nhiều bảng quan hệ cho map, shop, trang bị, nhiệm vụ, phòng đấu
và tiến độ người chơi. PlayFab Entity Objects phù hợp với các object JSON nhỏ,
không phải một endpoint JDBC.

Luồng kết nối:

```text
Browser -> WebSocket relay :8081 -> Army 2 server :8122
                                      |-> PlayFab Identity HTTPS
                                      `-> MySQL :3306
```

## 1. Tạo PlayFab Title

1. Đăng nhập [PlayFab Game Manager](https://developer.playfab.com/) và tạo một Title.
2. Sao chép `Title ID` trong phần cài đặt Title.
3. Tạo hoặc sao chép Secret Key trong **Settings > Secret Keys**.
4. Không đưa Secret Key vào client, GitHub Pages, URL hoặc repository.

Server dùng Secret Key để tạo/đăng nhập tài khoản ẩn danh. Cặp guest identity
và token của trình duyệt được SHA-256 trước khi gửi làm `ServerCustomId`.
Khi bật PlayFab lần đầu, hồ sơ `guest_*` hợp lệ hiện có sẽ tự đổi khóa sang
`playfab_*`; dữ liệu gameplay trong MySQL được giữ nguyên.

## 2. Chuẩn bị MySQL/MariaDB

Cài MySQL 8 hoặc MariaDB tương thích, tạo user rỗng và import schema sạch:

```powershell
node scripts/prepare-database.mjs
mysql -u root -p -e "source server/build/schema.sql"
```

Có thể đổi tên database bằng `ARMY2_DATABASE` trước khi chạy script. Không dùng
database chứa dữ liệu thật để thử nghiệm.

## 3. Đặt biến môi trường phía server

Trong PowerShell đang dùng để chạy backend:

```powershell
$env:PLAYFAB_TITLE_ID="1E8BF1"
$env:PLAYFAB_SECRET_KEY="YOUR_SERVER_SECRET_KEY"
$env:ARMY2_JDBC_URL="jdbc:mysql://127.0.0.1:3306/army?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC"
$env:ARMY2_DB_USER="army2"
$env:ARMY2_DB_PASSWORD="YOUR_DATABASE_PASSWORD"
$env:ARMY2_TCP_PORT="8122"
```

Không đổi tên `server/.env.example` thành file chứa secret rồi commit. Với môi
trường production, đặt các giá trị này trong secret manager của nền tảng host.

## 4. Chạy backend

Cần JDK 21 và Node.js 22+. Từ thư mục gốc repository, mở hai terminal:

```powershell
# Terminal 1: game server
.\web-client\gradlew.bat -p server run
```

```powershell
# Terminal 2: WebSocket relay
npm ci
npm run relay
```

Khi đúng, máy phải lắng nghe cổng `8122` và `8081`. Client web mặc định kết nối
relay tại hostname hiện tại, cổng `8081`.

## 5. Production

- Chạy game server, relay và MySQL trên backend có tiến trình luôn hoạt động.
- Đặt relay sau TLS reverse proxy và dùng URL `wss://` qua tham số `?relay=`.
- GitHub Pages chỉ host client tĩnh; nó không chạy Java server, relay hoặc MySQL.
- Chỉ mở relay ra Internet. Không công khai cổng MySQL và không đưa PlayFab
  Secret Key xuống browser.

## Kiểm tra nhanh

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3306,8081,8122
npm test
$env:ARMY2_INTEGRATION_URL="ws://127.0.0.1:8081"
npm run test:server
```

Nếu log server báo `PlayFab login failed`, kiểm tra Title ID, Secret Key, quyền
Title và kết nối HTTPS. Nếu client báo mất kết nối mà không có log PlayFab, kiểm
tra relay `8081` và game server `8122` trước.

## Tài liệu PlayFab liên quan

- [Server LoginWithServerCustomId](https://learn.microsoft.com/en-us/rest/api/playfab/server/authentication/login-with-server-custom-id)
- [Player Data và Entity Objects](https://learn.microsoft.com/en-us/gaming/playfab/player-progression/player-data)
- [Title Data](https://learn.microsoft.com/en-us/gaming/playfab/live-service-management/game-configuration/titledata/)
