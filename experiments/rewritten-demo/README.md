# Army 2 Web Reforged

Bản game bắn súng tọa độ chạy trực tiếp trên trình duyệt, viết lại bằng **TypeScript + Canvas 2D + Vite** dựa trên cơ chế và tài nguyên của [MobiArmy2-Client](https://github.com/vantu03/MobiArmy2-Client). Bản web bổ sung roster **17 thành viên Marvel** và hệ thống progression offline.

## Nội dung hiện có

- 10 xạ thủ Army 2 cổ điển và 17 hero Marvel.
- Vật lý góc, lực, trọng lực và gió; đường ngắm trực quan.
- Địa hình động có thể bị khoét bởi vụ nổ.
- 8 kiểu vũ khí: đạn đơn, liên thanh, chùm, phân mảnh, boomerang, laser, sét và cận chiến.
- Sprite đạn và animation vụ nổ được giải trực tiếp từ các pack `item/effect` của client LibGDX.
- Nội tại riêng: bay, khiên phép, xuyên phá, đánh dấu, đóng băng, cuồng nộ và phân thân.
- Bot tự tính góc/lực, độ chính xác thay đổi theo cấp bản đồ.
- 6 đấu trường, ba cấp độ khó.
- XP, cấp chỉ huy, xu, mở khóa hero và thiết lập âm thanh lưu bằng `localStorage`.
- Điều khiển chuột, bàn phím và cảm ứng; giao diện responsive cho desktop/mobile.

## Chạy dự án

```bash
npm install
npm run dev
```

Kiểm tra trước khi phát hành:

```bash
npm test
npm run build
```

Thư mục `dist/` là bản web tĩnh có thể deploy lên GitHub Pages.

## Điều khiển

- `A` / `D`: di chuyển.
- `W` / `S`: thay đổi góc bắn.
- Thanh lực: chỉnh lực bắn.
- `Space`: khai hỏa.
- Nút `Nộ`: dùng tuyệt kỹ khi đạt 100%.

## Nguồn tham khảo

- Java/LibGDX client: `vantu03/MobiArmy2-Client`.
- Bản web sử dụng các PNG/audio được giải pack từ thư mục `desktop/assets/res` của nguồn trên.
- Engine web là bản triển khai TypeScript độc lập, không yêu cầu Java hoặc LibGDX ở runtime.

Tên và tài nguyên của MobiArmy/Marvel thuộc về các chủ sở hữu tương ứng. Dự án này phục vụ mục đích thử nghiệm kỹ thuật và phi thương mại.
