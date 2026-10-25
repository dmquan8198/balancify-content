# Hệ thống tạo bộ ảnh Instagram cho balancify — Thiết kế

Ngày: 2026-10-25 · Trạng thái: chờ duyệt

## 1. Mục tiêu

**Job:** Khi có một folder ảnh thô và một mục tiêu đăng bài, mình muốn nhận một bộ ảnh Instagram đúng brand, sẵn để đăng, mà không phải tự thiết kế, để đăng đều 3–7 bộ/tuần.

- Người dùng: một brand (balancify), một người vận hành (hoặc team nhỏ).
- Người dùng **chỉ duyệt và sửa bằng lời**, không mở file để chỉnh tay.
- Đầu ra bản đầu: ảnh tĩnh cho Feed (4:5) và Story (9:16). Reel làm ở giai đoạn 2.

## 2. Các quyết định đã chốt

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Tần suất | 3–7 bộ/tuần, một brand | Đủ lớn để đáng xây hệ thống |
| Mục tiêu bài | B (tương tác), C (hình ảnh thương hiệu), D (chương trình) | Không có mục tiêu "bán hàng trực tiếp" riêng; giá và CTA chỉ xuất hiện trong F4 |
| Brand guideline | Bản gọn 6 phần, rút từ playbook; bỏ cổng giai đoạn, UGC, con số kinh doanh, kênh phụ | Chỉ giữ thứ hệ thống thực sự dùng |
| Bảng màu | Nền trung tính cố định + màu nhấn theo colorway của túi trong ảnh | Brand có 4 colorway |
| Phong cách ảnh | FEEL dùng flatlay; REAL và PROOF dùng ảnh đời thường | Hai phong cách phục vụ hai job khác nhau |
| Cách dựng | Template dựng bằng code, xuất PNG | Người dùng không sửa tay; cần đúng brand ổn định |
| Nơi lưu | Repo riêng `balancify-content` cho hệ thống; Drive cho ảnh | Tách khỏi app quản lý bán hàng đang deploy trên Vercel |

## 3. Kiến trúc

Hai luồng. Các khối trao đổi với nhau qua file, mỗi khối chạy lại được độc lập.

```
Luồng 0 — một lần cho mỗi reference
Reference (Drive) ─▶ Phân tích ─▶ Đặc tả template ─▶ Người dùng duyệt ─▶ Thư viện template

Luồng 1 — mỗi bài đăng
Brief ─▶ Nạp ảnh ─▶ Thẻ ảnh ─▶ Lên kế hoạch ─▶ [Duyệt 1] ─▶ Dựng ─▶ Kiểm tra brand ─▶ Gói duyệt ─▶ [Duyệt 2] ─▶ Lưu
                                    ▲                              ▲
                          Rulebook + Thư viện template ────────────┘
```

| Khối | Làm gì | Vào | Ra |
|---|---|---|---|
| Rulebook | Guideline gọn dưới dạng file máy đọc được | Guideline đã duyệt | 4 file luật (mục 4) |
| Nạp ảnh | Tải ảnh từ Drive **lần lượt từng file**, tạo bản làm việc cạnh dài 2000px | Link folder | Ảnh cục bộ + danh sách file không tải được |
| Thẻ ảnh | Xem từng ảnh, ghi lại đặc điểm | Ảnh | Một thẻ/ảnh: colorway, kiểu (flatlay / đời thường), có người hay không, chất lượng, cắt được 4:5 và 9:16 hay không, ghi chú |
| Lên kế hoạch | Chọn trụ, họ template, ảnh cho từng slide, viết chữ nháp | Brief + thẻ ảnh + rulebook | 2 phương án kế hoạch |
| Dựng | Điền kế hoạch vào template, chỉnh màu ảnh, xuất PNG | Kế hoạch đã chọn + template | Ảnh Feed + Story |
| Kiểm tra brand | Soát chữ và hình theo rulebook | Ảnh + chữ | Đạt, hoặc danh sách lỗi cụ thể |
| Gói duyệt | Gom thành phẩm để duyệt | Mọi thứ ở trên | Ảnh xem trước, caption, hashtag, lý do chọn ảnh |

**Công nghệ:** TypeScript (Node). Template viết bằng HTML/CSS, dựng ra PNG bằng Chromium không giao diện (Playwright có sẵn trong môi trường). Xử lý ảnh (cắt, chỉnh màu) bằng thư viện `sharp`. Lý do chọn HTML/CSS: kiểu chữ tiếng Việt, khoảng cách chữ, font web hiển thị đúng hơn và dễ sửa hơn so với vẽ ảnh bằng code.

## 4. Rulebook

Bốn file trong `rulebook/`.

### 4.1 brand
- **Định vị:** Daily Hug Bag — túi mềm cho những ngày dài.
- **Một tuyến thông điệp:** Daily Hug Bag. "Find your own balance" chỉ xuất hiện ở bao bì/footer, không dùng làm thông điệp chính trên bài.
- **Khách hàng:** Nữ 22–28, đi làm văn phòng/agency hoặc sinh viên năm cuối, mang laptop mỗi ngày, ở HCM hoặc HN, đang mệt.
- **Ba lớp job:**
  - Chức năng: mang laptop 13–14" đi làm mỗi ngày mà vai không đau, không trông như dân IT.
  - Cảm xúc: một cái "ôm" giữa ngày mệt; tự thưởng ở mức không thấy tội lỗi.
  - Xã hội: thể hiện gu "quiet cute", chụp lên story được.
- **Thông tin sản phẩm được phép nói** (người dùng sửa khi thay đổi): nylon chần bông; đựng vừa laptop 14"; giá 460.000đ; 4 colorway (mục 4.3). Mọi claim khác bị chặn.

### 4.2 voice
- Xưng **"mình"**.
- **Cấm:** "shop", "bên em", "nhà mình".
- **Tiếng Anh chỉ dùng cho:** balancify, Daily Hug Bag, Find your own balance, #dailyhugbag, #balancify, tên 4 colorway, và các từ: laptop, reel, story, nylon, comment, HUG. Mọi chữ còn lại bằng tiếng Việt.
- **Bảng thay từ:** soft → mềm; cozy → êm; ngoài ra, mọi từ tiếng Anh có từ tiếng Việt tự nhiên tương đương đều bị bắt.
- **Không viết caption song ngữ.**
- **Câu mẫu:**
  - "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được."
  - "Không phải mình lười. Mình chỉ hết pin."
  - "Bạn đang mang gì trong túi đi làm? Mình đoán 80% có: cục sạc dự phòng đã hết pin."
  - "Cân bằng không phải là đứng yên. Là biết mình đang nghiêng về đâu."

### 4.3 visual
- **Nền trung tính:** xám than texture đá (nền chụp flatlay) và trắng (màu logo).
- **Màu nhấn theo colorway** — đo từ ảnh, dùng tạm đến khi có hex chính thức (mục 11):

| Colorway | Hex tạm |
|---|---|
| dreaming blue | `#B2CFEA` |
| easy mint | `#B8C6B8` |
| off duty pink | `#EDCBC9` |
| not tired black | `#252728` |

  Màu nhấn của một bài lấy theo colorway trong thẻ ảnh. Bài có nhiều colorway (ví dụ carousel 4 màu) thì mỗi slide dùng màu của túi trên slide đó.
- **Font:** Fraunces (tiêu đề), Be Vietnam Pro (nội dung), Patrick Hand cho tên colorway (tạm, chờ font chính thức — mục 11).
- **Logo:** balance glyph — hai nửa tròn lệch nhau, nửa trái cao hơn. Không xoay, không kéo méo, không đổi màu ngoài trắng (trên nền tối hoặc nền màu) và màu chữ đậm (trên nền sáng).
- **Element được phép:** tên colorway bằng chữ viết tay, viết thường, xoay nghiêng, tô đúng màu túi, đặt ở cạnh ảnh.
- **Element bị cấm:** sparkle, khung viền, sticker, gradient màu, chữ nhiều màu.
- **Luật ảnh flatlay:** chụp thẳng từ trên xuống; nền xám đá; túi nằm giữa, glyph lộ rõ; 4–6 món đồ phối màu theo colorway, xếp quanh phía trên túi.
- **Luật ảnh đời thường:** chụp điện thoại, ánh sáng tự nhiên, không studio; chỉ chỉnh nhẹ (cân sáng, cân màu), không làm bóng bẩy.

### 4.4 pillars

| Trụ | Tỷ lệ tham chiếu | Mục tiêu | Họ template | Kiểu ảnh |
|---|---|---|---|---|
| FEEL | 30% | C | F1 | Flatlay |
| REAL | 40% | B, C | F2 | Đời thường |
| SERVE | 10% | B | F3 | Đời thường hoặc flatlay |
| PROOF | 20% | B | F3 | Đời thường |
| (chương trình) | — | D | F4 | Bất kỳ |

Tỷ lệ chỉ để tham chiếu: hệ thống không tự cân tỷ lệ giữa các bài, người dùng chọn mục tiêu cho từng bài.

## 5. Họ template (bản đầu)

Mỗi họ có hai biến thể: Feed 1080×1350 và Story 1080×1920.

| Họ | Cấu trúc | Chữ |
|---|---|---|
| **F1 Flatlay colorway** | 1 ảnh, hoặc carousel tối đa 4 slide (mỗi colorway một slide) | Tên colorway viết tay + nhãn nhỏ "Daily Hug Bag". Không thêm chữ nào khác trên ảnh. |
| **F2 Carousel đời thường** | 3–6 slide ảnh | Slide 1: hook, một câu tiếng Việt. Slide giữa: gần như không chữ. Slide cuối: câu chốt. |
| **F3 Carousel hữu ích / bằng chứng** | 4–7 slide, nhiều chữ, đáng lưu | Mỗi slide một ý. Chủ đề ví dụ: trong túi mình có gì; so sánh size với laptop 14"; sắp xếp túi đi làm. |
| **F4 Thông báo chương trình** | 1–3 slide, khung cố định | Tên chương trình, thời gian, điều kiện, CTA "comment HUG". |

Đặc tả chi tiết của từng họ (vị trí, cỡ chữ, nhịp) lấy từ luồng reference (mục 6). Bốn ảnh flatlay người dùng đã gửi là reference cho F1.

## 6. Luồng reference

- **Nơi để:** folder Drive "Reference", chia thư mục con F1–F4.
- **Dạng:** ảnh chụp màn hình bài đăng (carousel thì đủ mọi slide) + một dòng ghi chú "thích ở chỗ nào".
- **Đầu ra:** một file đặc tả cho mỗi reference, lưu trong `templates/<họ>/spec`. Nội dung: layout, số slide và thứ tự, tỷ lệ chữ/ảnh, kiểu chữ, vị trí element, nhịp câu chữ, kiểu hook. Mỗi mục có cột "giữ nguyên / đổi cho đúng brand".
- **Không lưu** hình hay chữ của bài gốc trong repo; chỉ lưu cấu trúc.
- Đặc tả phải được người dùng duyệt trước khi dùng.

## 7. Luồng hằng ngày

1. Người dùng nhắn: mục tiêu (B/C/D) + link folder ảnh + ghi chú (tuỳ chọn).
2. Nạp ảnh, lập thẻ ảnh.
3. **Duyệt 1:** hệ thống đưa 2 phương án kế hoạch (họ template, ảnh cho từng slide, chữ nháp). Người dùng chọn hoặc sửa bằng lời.
4. Dựng, rồi kiểm tra brand.
5. **Duyệt 2:** gói duyệt gồm ảnh Feed + Story, caption, hashtag, lý do chọn ảnh. Người dùng duyệt hoặc nhắn sửa; sửa thì quay lại bước tương ứng.
6. Lưu thành phẩm vào Drive: `Output/<YYYY-MM-DD>-<tên-bài>/`.
7. Người dùng tự đăng lên Instagram.

## 8. Xử lý lỗi

Nguyên tắc: không bao giờ bỏ qua âm thầm; mọi thứ bị loại đều được liệt kê kèm lý do.

| Tình huống | Xử lý |
|---|---|
| Ảnh không tải được (connector giới hạn khoảng 4MB/file) | Tải lần lượt; liệt kê tên file lỗi; đề nghị gửi bản nén hoặc gửi trực tiếp |
| Connector Drive bị ngắt | Thử lại file đó một lần sau khi kết nối lại; vẫn lỗi thì liệt kê |
| Ảnh mờ, cạnh ngắn dưới 1080px, hoặc không cắt được tỷ lệ cần mà giữ trọn túi | Ghi vào thẻ ảnh, loại khỏi kế hoạch |
| Không đủ ảnh hợp lệ cho template | Báo, đề xuất họ template cần ít ảnh hơn |
| Không xác định được colorway | Hỏi người dùng |
| Chữ vi phạm voice | Tự viết lại một lần; vẫn lỗi thì đưa vào gói duyệt dưới dạng **lỗi**, kèm lý do |
| Claim ngoài "thông tin sản phẩm được phép nói" | Chặn cứng, không tự viết lại |
| Chữ tràn khung | Giảm cỡ chữ đến mức tối thiểu của template; vẫn tràn thì rút gọn câu |

## 9. Kiểm tra chất lượng

- **Kiểm tra hình:** mọi màu chữ/element thuộc bảng màu ở mục 4.3; mọi font thuộc danh sách font; không có element bị cấm.
- **Test luật voice:** câu sai mẫu ("shop", "bên em", "soft", "cozy", "chống nước") phải bị bắt; câu mẫu ở mục 4.2 phải qua.
- **Ảnh chuẩn để so sánh:** mỗi họ template dựng từ một bộ ảnh mẫu cố định; mỗi thay đổi code được so với ảnh chuẩn để phát hiện lệch layout.
- **Kiểm tra kỹ thuật tự động trên mỗi ảnh xuất ra:**
  - đúng kích thước 1080×1350 / 1080×1920;
  - Story: không có chữ trong vùng 250px trên cùng và 340px dưới cùng (vùng giao diện Instagram che);
  - độ tương phản chữ/nền ≥ 4.5:1 với chữ dưới 24px, ≥ 3:1 với chữ từ 24px (WCAG).

## 10. Lưu trữ

| Loại | Nơi lưu |
|---|---|
| Ảnh gốc, reference, thành phẩm | Google Drive |
| Rulebook, đặc tả, template, code, test, ảnh chuẩn để so sánh | Repo `balancify-content` |

Container của session bị xoá sau khi ngừng dùng, nên không có gì quan trọng được chỉ nằm trong container.

## 11. Đầu vào còn thiếu (cần trước khi xây phần liên quan)

| # | Cần | Chặn phần nào |
|---|---|---|
| 1 | Hex chính thức của 4 colorway | Màu nhấn (đang dùng hex tạm) |
| 2 | Font viết tay cho tên colorway | F1 |
| 3 | File glyph gốc (SVG hoặc PNG nền trong) | Mọi template có logo |
| 4 | Xác nhận dùng Fraunces + Be Vietnam Pro | Mọi template |
| 5 | Trạng thái bản túi in 3 nơ (colorway chính thức, mẫu thử, hay bản riêng?) | Nhận diện colorway trong thẻ ảnh |
| 6 | Reference cho F2, F3, F4 | Đặc tả F2–F4 |

## 12. Rủi ro đã biết

- **Giới hạn tải ảnh của connector Drive** (khoảng 4MB/file; file 8–9MB đã lỗi khi thử). Ảnh gốc điện thoại thường vượt mức này. Cách giảm: folder ảnh xuất ở chất lượng vừa, hoặc gửi trực tiếp.
- **Tải file lên Drive chưa được kiểm chứng** qua connector. Nếu không được, thành phẩm được gửi trực tiếp trong cuộc trò chuyện.
- **Tải font từ internet** có thể bị proxy chặn; nếu vậy, font được lưu sẵn trong repo (cả hai font đề xuất đều có giấy phép mở).

## 13. Ngoài phạm vi bản đầu

Reel và video (giai đoạn 2), tự đăng lên Instagram, nội dung Threads, đọc số liệu bài đăng để tự cải thiện, dựng trên Canva/Figma.
