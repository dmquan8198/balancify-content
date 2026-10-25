# balancify-content

Hệ thống tạo bộ ảnh Instagram đúng brand cho balancify.

## Hiện có (giai đoạn 1)
- **Rulebook** (`rulebook/`): brand, giọng văn, hình ảnh, trụ content. Muốn đổi giá, thêm từ cấm, đổi màu colorway — sửa ở đây.
- **Kiểm tra giọng văn:** bắt "shop / bên em / nhà mình", từ tiếng Anh sai chỗ, claim không được phép, hashtag lạ.
- **Template F1 (flatlay colorway):** một ảnh flatlay → ảnh Feed 1080×1350 + Story 1080×1920, có tên colorway viết tay (tô màu túi; tự đổi sang trắng nếu màu túi không đủ tương phản với nền ảnh).

## Cách dùng
Nhắn Claude: "Làm F1 cho ảnh [đường dẫn hoặc link], colorway easy mint."

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
