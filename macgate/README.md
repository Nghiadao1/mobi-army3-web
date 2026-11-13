# MacGate (MVP) — bản SheepGate cho Mac, chạy qua Cloudflare Tunnel

Cho phép Muse đọc/ghi/sửa file và chạy lệnh trực tiếp trong project trên Mac của bạn,
giống cách SheepGate làm trên Windows — không cần pair app Muse (bản này là chương
trình thường chạy trong Terminal nên không bị khóa DEP/pairing của app Muse chặn).

## Cần gì

- Node.js bản LTS (kiểm tra: mở Terminal gõ `node -v`; chưa có thì cài ở https://nodejs.org)
- Mạng internet. Lần đầu script sẽ tự tải `cloudflared` (công cụ chính chủ Cloudflare).
- Nếu macOS hỏi quyền truy cập thư mục Documents cho Terminal: đồng ý (hoặc vào
  System Settings > Privacy & Security > Full Disk Access, bật cho Terminal).

## Cách chạy (3 bước)

1. Giải nén gói này ra một chỗ cố định, ví dụ `~/macgate` (đừng để trong thư mục project game).
2. Mở Terminal, chạy:

   ```bash
   cd ~/macgate
   chmod +x start-macgate.sh
   ./start-macgate.sh /Users/admin/Documents/GitHub/mobi-army3-web
   ```

3. Script sẽ hiện **PAIR CODE** (8 ký tự) và một link dạng `https://*.trycloudflare.com`.
   Gửi cả hai thứ đó cho Muse trong chat. Code chỉ dùng được 1 lần — sau khi Muse
   pair xong, code tự hủy; token phiên do Muse lưu an toàn, không in ra chat.

Giữ nguyên cửa sổ Terminal trong lúc làm việc. Bấm `Ctrl+C` là dừng cả agent lẫn tunnel.

## An toàn

- Agent chỉ nghe ở `127.0.0.1` trên Mac; ra ngoài internet là qua tunnel có token bảo vệ.
- Agent bị nhốt trong thư mục project bạn chỉ định: mọi đường dẫn thoát ra ngoài đều bị chặn.
- Lệnh chạy qua agent bị giới hạn trong danh sách: git, node, npm, npx, python3, ls, cat, pwd, which.
- Mỗi lần ghi/sửa file, bản cũ được sao lưu vào `<project>/.bridge_backups/`.
- Muốn thu hồi quyền ngay: dừng Terminal, và/hoặc xóa file `<project>/.macgate/state.json`
  rồi khởi động lại — Muse sẽ phải pair lại từ đầu.

## Hạn chế của bản MVP

- Link trycloudflare đổi mỗi lần khởi động lại tunnel → mỗi phiên làm việc gửi Muse link mới.
- Mac ngủ (sleep) là mất kết nối; cắm sạc và để máy thức khi đang vibe code.
- Lệnh chạy có timeout 120 giây; build dài hơn mức đó cần tăng sau.
- KHÔNG cài lại/xóa macOS để "sửa" gì liên quan — máy này dính DEP, erase là bị ép enroll Jamf.
