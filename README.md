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

## Đang dùng tạm, cần thay
- Hex 4 colorway (đo từ ảnh) — `rulebook/visual.yaml`
- Font viết tay Patrick Hand — `rulebook/visual.yaml`

Thiết kế: `docs/superpowers/specs/` · Kế hoạch: `docs/superpowers/plans/`
