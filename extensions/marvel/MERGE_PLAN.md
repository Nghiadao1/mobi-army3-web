# Kế hoạch ghép Marvel vào client/server gốc

Soạn 2026-11-13 qua MacGate, dựa trên trạng thái thật của repo (không suy đoán).

## Trạng thái đã kiểm chứng

- Dữ liệu Marvel gốc của dự án cũ được bảo toàn nguyên tại `extensions/marvel/original/`
  (src TS đầy đủ + public/assets: heroes, data/images.json, parts.json, poses.json).
- `scripts/build-marvel-sprites.mjs` đọc `HEROES` từ `src/data/gameContent.ts` (lọc
  `faction === 'marvel'`), dùng chính CharacterRenderer cũ để dựng sheet.
- Đã chạy lại thành công 2026-11-13: **17 spritesheet** (2880x96, 30 pose/sheet) +
  `heroes.json` tại `web-client/build/generated/assets/res/marvel/`.
- 17 hero: ironman, ironman_mark50, hulk (HP 2850), red_hulk (HP 2850), thor,
  thor_stormbreaker, loki, doctor_strange, captain, captain_nomad, captain_gold,
  wintersoldier, wintersoldier_winter, hawkeye, hawkeye_tech, ultron, ultron_prime.
  Phần lớn HP 2300. Mỗi hero có đủ: attack, reloadTime, moveSpeed, staminaMax,
  minAngle/maxAngle, weapon, holeMask/powHoleMask, equipment, siteSkillName/Desc,
  siteBonuses, specialSkillName/Desc, canFly.
- Client Java (web-client, port TeaVM của client LibGDX gốc) **chưa hề tham chiếu**
  tới asset/dữ liệu Marvel: `git grep -i marvel -- web-client` = 0 kết quả.
  Sheet + heroes.json hiện chỉ nằm ở thư mục build/generated, chưa được đóng gói
  vào asset mà client tải, và không có mã Java nào đọc chúng.

## Điểm khác kiến trúc cần xử lý

- Client gốc dựng hình nhân vật từ hệ part/pose (equipment bigImage), còn sheet
  Marvel là ảnh toàn thân 30 pose theo ngữ nghĩa pose của renderer TS cũ.
  Cần một bảng ánh xạ pose TS -> trạng thái animation của client gốc
  (đứng, đi, ngắm bắn, bắn, trúng đạn, chết...) trước khi vẽ được trong trận.
- Server gốc tính đường đạn/sát thương phía server. Chỉ số trong heroes.json
  (hp/attack/reload/...) phải được server áp dụng cho người chơi chọn hero Marvel,
  nếu không client và server sẽ lệch trạng thái trận đấu.
- Kỹ năng: mỗi hero có site skill + special skill vốn được cài trong BattleEngine
  TS cũ (src/engine). Muốn giữ đúng kỹ năng phải port từng kỹ năng sang logic
  trận đấu phía server Java - đây là phần việc lớn nhất, làm theo từng hero.

## Tiến độ

- 2026-11-13: **P1 xong ở mức build** — kiểm chứng build Gradle trên Mac: heroes.json + 17 sheet nằm trong dist/assets/res/marvel/; thêm army2.web.MarvelRoster (loader failure-soft, parse bằng JsonReader, không reflection) và hook gọi trong WebLauncher.create(); build lại thành công, chuỗi "Marvel roster loaded" có trong app.js đã biên dịch. Còn thiếu: mở client trên trình duyệt để thấy trace nạp đủ 17 hero lúc chạy thật (kiểm chứng runtime) — gộp vào vòng test tay tiếp theo. Môi trường build trên Mac: JAVA_HOME=/Users/admin/jdks/jdk-21.0.13+9/Contents/Home (Temurin 21 cài riêng, java mặc định của máy là 1.8 không dùng được).

## Các giai đoạn đề xuất

- **P1 - Đóng gói dữ liệu:** đưa heroes.json + 17 sheet từ build/generated vào
  gói asset client tải về; viết loader phía Java đọc heroes.json thành roster.
  Kiểm chứng: client khởi động, log/tải được 17 hero, không đổi hành vi cũ.
- **P2 - Chọn hero + render trong trận:** thêm nhánh render: nếu người chơi dùng
  hero Marvel thì vẽ bằng sheet (theo bảng ánh xạ pose), thay cho part/pose.
  Bắt đầu với chế độ luyện tập (offline) để không phụ thuộc server.
  Kiểm chứng: vào trận luyện tập, hero Marvel đứng/di chuyển/bắn đúng hình.
- **P3 - Chỉ số phía server:** server nhận diện hero Marvel, áp hp/attack/reload/
  moveSpeed/stamina từ heroes.json khi tạo trận. Kiểm chứng: đấu thường 2 máy,
  máu/sát thương khớp chỉ số hero ở cả hai phía.
- **P4 - Kỹ năng theo hero:** port special skill từng hero từ BattleEngine TS
  sang server Java, thứ tự ưu tiên theo hero người chơi dùng nhiều nhất.
  Kiểm chứng từng kỹ năng bằng trận test riêng.
- **P5 - Hoàn thiện:** shop/kho đồ mở khóa hero, đồng bộ profile, test mobile/
  âm thanh/hiệu năng như mục còn lại trong PROGRESS.md.

## Điều kiện cần trước P1

- Cần chạy được build Gradle (web-client + server) để kiểm chứng mỗi giai đoạn.
  MacGate hiện chưa chạy được java/gradle (chưa có trong allowlist, giới hạn
  120s/lệnh cũng ngắn hơn một vòng build TeaVM). Hai lựa chọn:
  (a) nâng cấp MacGate v0.2: thêm java/gradlew vào allowlist + tăng timeout cho
  lệnh build; (b) người dùng tự chạy lệnh build trong Terminal, Muse đọc log.
