---
name: make-post
description: Make an on-brand Instagram post for balancify from a Google Drive folder or uploaded photos — ingest, photo cards, two plan options, render, review pack, two user approvals. Use when the user asks for a post, a bộ ảnh, or gives a Drive folder of photos to turn into Instagram content.
---

# Làm một bài Instagram (balancify)

Talk to the user in Vietnamese. Two approval gates are mandatory: plan (gate 1) before rendering, finished images (gate 2) before calling it done.

## 0. Brief
Need: goal (B tương tác / C hình ảnh thương hiệu / D chương trình), photo source (Drive folder link or uploaded photos), optional notes.
- Only goal **C** (trụ FEEL, template F1 flatlay) is built. For B or D, say plainly that F2–F4 are not built yet and offer C instead; never silently switch.

## 1. Work folder
`W = <your scratchpad>/posts/<YYYY-MM-DD>-<slug of a short title>/` — never inside the repo. Photos live in `W/photos`; renders go to `W/out` (a different folder — see step 5).

## 2. Get photos
Drive folder: `search_files` with `parentId = '<folderId>'` (page through `nextPageToken`). Keep `mimeType` image/jpeg, image/png, image/webp. List HEIC and files over ~4 MB separately — tell the user they can't be downloaded (ask for JPEG / smaller export) instead of trying.
Download **one file per call, never in parallel** (parallel calls dropped the connector). Each large result is saved to a tool-results `.txt` path — collect those paths. If a result comes back inline instead, the file is tiny (below 1080 px); note it as too small, don't process it.
Uploaded photos: use their local paths directly.
Then: `npm run ingest -- --out W/photos <paths...>`. Relay every "Bỏ qua" line to the user.
- Re-running ingest is safe: it only appends, and a file already ingested is reported "Đã có sẵn" and left alone. Use it to add photos later or retry failed ones.
- The command prints only this run's photos; `W/photos/photos.json` lists all of them. Every later step uses the working-copy paths from `photos.json`, never the original download paths.
- Content decides the format: JPEG, PNG and WebP are accepted whatever the extension; HEIC is not.

## 3. Look and write cards
`npm run contact -- --from W/photos/photos.json --out W/sheet.jpg`, Read `W/sheet.jpg`. Read individual photos only when you need detail (colorway, focus point).
Write `W/cards.json`: one object per photo `{file (path from photos.json), colorway (the rulebook name, e.g. "easy mint", or null), kind: flatlay|lifestyle, person, quality: ok|blurry|dark|cluttered, focus: {x, y} (0–1, where the bag is), note}`. Then `npm run cards -- --file W/cards.json` and fix every "Lỗi thẻ" line.
- **Never write `fits`.** The command measures it, drops any hand-written value and rewrites `cards.json` itself. A "Lỗi: Không đọc được …" means the JSON is broken; fix the file.
- The card's colorway must be set and must equal the slide's colorway in the plan, or the plan check fails.

## 4. Gate 1 — two plans
Write `W/plan-a.json` and `W/plan-b.json` (`{goal, pillar, family, slides: [{photo, colorway, focus?, why}], caption, hashtags}`), each different in a way that matters (photo choice / slide count / order). 1–4 slides. `photo` is the working-copy path from `photos.json`; every slide photo needs a card. Hashtags look like `#dailyhugbag` (letters, digits, underscore). Caption: Vietnamese, xưng "mình", follow rulebook/voice.yaml; use only facts in rulebook/brand.yaml product_facts. Voice errors in the caption block the plan check — fix the wording, do not argue with the linter.
Check each: `npm run post -- --plan W/plan-a.json --cards W/cards.json --check`. Fix until "Kế hoạch hợp lệ." The check also measures each photo; "không đủ lớn" means pick another photo.
Relay every "Cảnh báo" line (for example the same photo used twice) to the user together with the options.
Show the user both options: per slide the photo number from the sheet, colorway and `why`; the caption. Send `W/sheet.jpg`. Wait for their choice or edits.

## 5. Render
`npm run post -- --plan <chosen> --cards W/cards.json --out W/out`. Read `W/out/preview.jpg` and `W/out/review.md`.
- `--check` and `--out` are separate runs; never pass both (exit 2).
- `--out` is **replaced** on each run, so: use a NEW folder inside the work folder (`W/out`), never the repo or any folder that holds other files, and keep photos outside it (a plan whose photos sit inside `--out` is refused). It is accepted only when it does not exist, is empty, or is a previous pack (has the hidden `.post-pack` file); anything else fails with "Thư mục --out đã có nội dung khác" and nothing is touched.
- Rendering goes to a temporary folder and swaps in only if every slide succeeded, so a failed run leaves the previous pack intact.
- Verdict line in `review.md`: "KẾT QUẢ: ĐẠT", "KẾT QUẢ: ĐẠT (N cảnh báo — xem mục Cảnh báo)" or "KẾT QUẢ: CÓ LỖI".
If "CÓ LỖI": fix the cause (other photo, different `focus`) and rerun, at most twice; then tell the user exactly what still fails. Never present a failing result as passing.

## 6. Gate 2 — review pack
Send with SendUserFile: every `W/out/slide-*/f1-*-feed.png` and `-story.png`, plus `preview.jpg`. Do not send or copy the hidden `.post-pack` file, and never copy it into another folder (that would make the folder look replaceable). Paste the caption from `W/out/caption.txt` and the summary from `review.md`, including any "đổi sang trắng" notes and **every cảnh báo** — do not drop warnings. Ask: duyệt hay sửa gì.
Edits → change plan/cards → rerun step 5 into the same `W/out` → gate 2 again.

## 7. Done
Approved files are the ones already sent; the user posts them. Do not upload to Drive (the connector needs the whole image inlined as base64 — not workable). Never commit photos or W/ to git.
