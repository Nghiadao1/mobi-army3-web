# Tiến độ port nguyên bản — 11/11/2026

## Tiêu chí bắt buộc

- Giữ nguồn, cấu trúc, asset và chức năng client Army 2 gốc.
- Chỉ thay adapter nền tảng để chạy trên trình duyệt.
- Giữ intro, thay đăng ký/đăng nhập bằng tên nhân vật.
- Tích hợp đúng 17 nhân vật Marvel từ dự án cũ, gồm hình ảnh và kỹ năng.
- Kiểm thử các màn/chế độ trên runtime thật trước khi tuyên bố hoàn thành.
- Có nhánh backup trước thay thế, commit và push kết quả.

## Đã có bằng chứng

- Nguồn client gốc được lưu tại `upstream/MobiArmy2-Client`.
- Server gốc, dữ liệu gameplay và asset server được giữ tại `upstream/MobiArmy2-Server`.
- Toàn bộ client Java biên dịch thành JavaScript/WebGL thành công bằng LibGDX/TeaVM.
- Server Java biên dịch headless thành công và chạy với database thử nghiệm riêng.
- Màn chọn server, intro khí cầu và màn nhập tên chạy trên trình duyệt bằng asset/font gốc.
- Cầu nối giữ nguyên byte qua dữ liệu TCP/WebSocket bị chia gói: test đạt.
- Tạo hồ sơ khách, từ chối tên không hợp lệ/mã hồ sơ sai, tải 5 pack asset và danh sách phòng, đổi tên/nối lại cùng ID, từ chối tên trùng: integration test đạt trên server/database thật.
- Đã thao tác trên UI thật: intro → tên đã lưu → Vào game → sảnh menu gốc. Sửa adapter đọc gói lớn để đồng bộ asset không bị kẹt.
- Sau khi khởi động lại server và reload client: sửa tên thành `Nghĩa Web` bằng form nhập liệu trình duyệt rồi vào lại sảnh thành công, không có lỗi handler.
- Dữ liệu/asset/renderer Marvel từ nhánh cũ được lưu nguyên; đã dựng đủ 17 spritesheet × 30 pose.
- Bản demo TypeScript rút gọn được chuyển ra `experiments/rewritten-demo`.

## Còn cần hoàn tất hoặc kiểm chứng

- Test tay các màn phòng/chuẩn bị, đấu thường, boss, luyện tập, kho đồ, trang bị, shop, nhiệm vụ và các chức năng mạng.
- Ghép roster, chỉ số, kỹ năng và đồng bộ Marvel vào client/server gốc.
- Kiểm thử mobile, âm thanh và hiệu năng với các map/boss.
- Đóng gói backend để người dùng chạy thử đầu ra dễ dàng.
- Push nhánh backup và các commit mới; HTTPS Git hiện chưa có credential trong phiên terminal.

Nhánh backup cục bộ: `codex/mobi-army3-before-ma2-rewrite-20261110` tại `8d702dc`.
Build thành công chỉ chứng minh khả năng biên dịch, không chứng minh toàn bộ chức năng đã được port và kiểm thử.
