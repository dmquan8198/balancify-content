# balancify-content

Hệ thống tạo bộ ảnh Instagram đúng brand cho balancify.

## Hiện có (giai đoạn 1)
- **Rulebook** (`rulebook/`): brand, giọng văn, hình ảnh, trụ content. Muốn đổi giá, thêm từ cấm, đổi màu colorway — sửa ở đây.
- **Kiểm tra giọng văn:** bắt "shop / bên em / nhà mình", từ tiếng Anh sai chỗ, claim không được phép, hashtag lạ.
- **Template F1 (flatlay colorway):** một ảnh flatlay → ảnh Feed 1080×1350 + Story 1080×1920, có tên colorway viết tay (tô màu túi; tự đổi sang trắng nếu màu túi không đủ tương phản với nền ảnh).

## Cách dùng
Nhắn Claude: "Làm bài mục tiêu C từ folder [link Drive]" (hoặc gửi ảnh trực tiếp). Claude làm theo skill `.claude/skills/make-post`:
1. Lấy ảnh từ Drive (từng ảnh một; ảnh HEIC hoặc lớn hơn ~4MB sẽ được báo lại để bạn xuất JPEG nhỏ hơn).
2. Lập thẻ ảnh, đưa **2 phương án** (ảnh nào vào slide nào, caption) — bạn chọn hoặc sửa.
3. Dựng ảnh Feed + Story cho từng slide, kiểm tra brand, gửi **gói duyệt** (ảnh, caption, lý do chọn ảnh, cảnh báo nếu có) — bạn duyệt hoặc nhắn sửa.
4. Thành phẩm được gửi trong cuộc trò chuyện; bạn tự đăng lên Instagram.

Hiện chỉ có template F1 (flatlay colorway) nên chỉ làm được mục tiêu **C**. Mục tiêu B và D cần F2–F4 (giai đoạn 3–4).

Lệnh Claude dùng (tham khảo): `npm run ingest`, `npm run contact`, `npm run cards`, `npm run post`, `npm run f1`.

### An toàn với `--out`
`npm run post -- --out <thư mục>` **thay thế** thư mục đó mỗi lần chạy. Vì vậy lệnh chỉ chấp nhận thư mục chưa có, thư mục rỗng, hoặc gói duyệt do chính lệnh này tạo trước đó (có tệp ẩn `.post-pack`); thư mục có nội dung khác bị từ chối và không bị đụng tới. Không bao giờ dùng thư mục hiện tại, thư mục cha của nó, thư mục người dùng hoặc thư mục gốc. Ảnh nguồn không được nằm trong `--out`. Kết quả được dựng ở thư mục tạm và thay vào khi lệnh chạy xong — kể cả khi kết quả là "CÓ LỖI"; chỉ khi lệnh dừng giữa chừng vì lỗi ("Lỗi: …") thì gói cũ mới được giữ nguyên. `ingest --out` và `post --out` từ chối thư mục nằm trong repo — dùng đường dẫn tuyệt đối ở ngoài repo (thư mục scratchpad). `post` bắt buộc có `--cards`. `--check` và `--out` là hai lần chạy riêng.

### Lệnh f1
Lệnh tương ứng (Claude tự chạy):
`npm run f1 -- --photo <ảnh> --colorway "easy mint"`

- `--photo` là đường dẫn file ảnh trên máy. Nếu gửi link Google Drive, Claude tải ảnh về trước rồi mới chạy lệnh.
- Ảnh HEIC (iPhone) chưa đọc được — xuất sang JPEG trước.
- Tên colorway có khoảng trắng phải đặt trong ngoặc kép; viết hoa hay dùng gạch nối (`easy-mint`) đều được.
- Kết quả nằm trong `out/`: `f1-<colorway>-feed.png`, `f1-<colorway>-story.png` và báo cáo `report-<colorway>.json` (ví dụ `report-easy-mint.json`).
- Mã thoát: `0` = đạt; `1` = có lỗi kiểm tra hoặc lỗi ảnh/rulebook/font/colorway; `2` = gõ lệnh sai.

## Đang dùng tạm, cần thay
- Hex 4 colorway (đo từ ảnh) — `rulebook/visual.yaml`
- Font viết tay Patrick Hand — `rulebook/visual.yaml`

Thiết kế: `docs/superpowers/specs/` · Kế hoạch: `docs/superpowers/plans/`
