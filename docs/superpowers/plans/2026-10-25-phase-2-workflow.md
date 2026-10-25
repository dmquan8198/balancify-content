# Giai đoạn 2 — Nạp ảnh, thẻ ảnh, kế hoạch bài, gói duyệt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Luồng mỗi bài (spec §7) chạy trọn vẹn cho F1. Claude nhận folder ảnh, nạp ảnh, lập thẻ ảnh, đưa 2 phương án, dựng bộ ảnh, tạo gói duyệt. Người dùng duyệt 2 lần.

**Architecture:** Connector Google Drive chỉ Claude gọi được, code thì không. Vì vậy việc chia làm hai bên:
- **Claude** (theo skill `.claude/skills/make-post/SKILL.md`): gọi Drive, xem ảnh, viết thẻ ảnh và kế hoạch bài, nói chuyện với người dùng.
- **Code** (các lệnh `npm run`): làm mọi phần xác định được.
  - `ingest`: giải mã file tải từ Drive, đo kích thước ảnh.
  - `contact`: tạo bảng ảnh thu nhỏ để Claude xem nhanh.
  - `cards`: kiểm tra thẻ ảnh và tính ảnh có đủ lớn cho Feed/Story không.
  - `post`: kiểm tra kế hoạch bài, dựng từng slide bằng `runF1`, tạo gói duyệt.

**Tech Stack:** như giai đoạn 1 (Node 22, TypeScript/tsx, vitest, sharp 0.35.5, playwright-core 1.63.0, yaml).

**Spec:** `docs/superpowers/specs/2026-10-25-instagram-content-system-design.md` (§3, §7, §8, §10, §12).

---

## Quyết định trong plan này (Task 8 ghi lại vào spec)

1. **Thành phẩm gửi trong cuộc trò chuyện, không tải lên Drive.** Công cụ `create_file` của connector bắt Claude dán nội dung file dạng base64 vào lệnh gọi; một PNG 1MB thành ~1,3 triệu ký tự — không khả thi mỗi ngày. Đây là đường dự phòng spec §12 đã nêu.
2. **Chỉ mục tiêu C chạy được ở giai đoạn này.** `pillars.yaml` nối F1 với trụ FEEL, và trụ này chỉ phục vụ mục tiêu C. Mục tiêu B và D cần F2–F4 (giai đoạn 3–4). Khi gặp B hoặc D, kiểm tra kế hoạch bài phải báo rõ lý do, không được tự lặng lẽ đổi sang C.
3. **Ảnh làm việc nằm ngoài repo.** Claude đặt ảnh trong thư mục scratchpad của session, theo cấu trúc `posts/<YYYY-MM-DD>-<tên-bài>/`. Repo không chứa ảnh thật.
4. **Một carousel F1 có 1–4 slide.** Mỗi slide là một lần chạy `runF1` và được ghi vào thư mục con `slide-<n>/`, để hai slide cùng colorway không ghi đè lên nhau.

## Quy ước

- Làm trên nhánh `phase-2`, tạo từ `main`. Mọi lệnh chạy từ `/home/user/balancify-content`.
- Mọi commit kết thúc bằng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VpvDBmvqe41je1wi6iv4Hp
  ```
- Chữ hiển thị cho người dùng (CLI, gói duyệt) bằng tiếng Việt.
- Không commit ảnh. Test dùng ảnh tổng hợp (`tests/fixtures/flatlay.ts`) ghi vào thư mục tạm của hệ điều hành.

## Cấu trúc file

```
src/render/prepare.ts        (sửa) xuất thêm orientedSize, cropSize, fitsFormat, MIN_SHORT_SIDE
src/rulebook/colorway.ts     (sửa) regex slug viết bằng escape ASCII
src/cli/run.ts               (mới) runCli, parseOrUsage, UsageError — xử lý lỗi chung cho mọi CLI
src/cli/f1.ts                (sửa) dùng src/cli/run.ts
src/ingest/ingest.ts         (mới) giải mã file tải từ Drive / chép ảnh cục bộ → thư mục làm việc + photos.json
src/cli/ingest.ts            (mới) npm run ingest
src/contact/sheet.ts         (mới) bảng ảnh thu nhỏ có đánh số
src/cli/contact.ts           (mới) npm run contact
src/cards/cards.ts           (mới) kiểu PhotoCard + completeCards (kiểm tra, chuẩn hoá colorway, tính fits)
src/cli/cards.ts             (mới) npm run cards
src/post/plan.ts             (mới) kiểu PostPlan + validatePlan + PlanError
src/post/run.ts              (mới) runPost: kiểm tra kế hoạch → dựng từng slide → caption.txt, preview.jpg, review.md
src/cli/post.ts              (mới) npm run post (có --check để chỉ kiểm tra)
.claude/skills/make-post/SKILL.md  (mới) quy trình cho Claude
tests/*.test.ts              test tương ứng
README.md, CLAUDE.md, spec   (sửa)
```

---

### Task 0: Tạo nhánh và sửa regex slug

**Files:**
- Modify: `src/rulebook/colorway.ts` (dòng `.replace(/[̀-ͯ]/g, "")`)
- Test: `tests/no-raw-marks.test.ts`

- [ ] **Step 1: Chuyển sang nhánh** (nhánh `phase-2` đã được tạo cùng commit chứa plan này)

```bash
git checkout phase-2
```

- [ ] **Step 2: Viết test (sẽ fail)**

`tests/no-raw-marks.test.ts`:
```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? tsFiles(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("mã nguồn", () => {
  it("không chứa ký tự dấu kết hợp (U+0300–U+036F) viết trần", () => {
    const offenders = tsFiles(join(process.cwd(), "src")).filter((f) => /[\u0300-\u036f]/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npx vitest run tests/no-raw-marks.test.ts`
Expected: FAIL, danh sách chứa `src/rulebook/colorway.ts`.

- [ ] **Step 4: Sửa**

Trong `src/rulebook/colorway.ts`, thay dòng regex bằng:
```ts
    .replace(/[\u0300-\u036f]/g, "")
```
(gõ đúng 6 ký tự `\u0300`, không dán ký tự dấu.)

- [ ] **Step 5: Chạy toàn bộ test**

Run: `npm test`
Expected: mọi test pass (95 + 1).

- [ ] **Step 6: Commit**

```bash
git add src/rulebook/colorway.ts tests/no-raw-marks.test.ts
git commit -m "fix: write slug's combining-mark regex with ASCII escapes in colorway.ts"
```

---

### Task 1: Tách hàm đo kích thước và khả năng cắt ảnh

**Files:**
- Modify: `src/render/prepare.ts`
- Test: `tests/prepare-size.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/prepare-size.test.ts`:
```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cropSize, fitsFormat, MIN_SHORT_SIDE, orientedSize, PhotoError } from "../src/render/prepare";

describe("cropSize / fitsFormat", () => {
  it("ảnh điện thoại dọc 3024×4032", () => {
    expect(cropSize(3024, 4032, 1080, 1350)).toEqual({ width: 3024, height: 3780 });
    expect(cropSize(3024, 4032, 1080, 1920)).toEqual({ width: 2268, height: 4032 });
    expect(fitsFormat(3024, 4032, 1080, 1350)).toBe(true);
    expect(fitsFormat(3024, 4032, 1080, 1920)).toBe(true);
  });

  it("ảnh ngang 1920×1080 không đủ cho Story", () => {
    expect(fitsFormat(1920, 1080, 1080, 1920)).toBe(false);
  });

  it("cạnh ngắn dưới mức tối thiểu thì không đạt", () => {
    expect(MIN_SHORT_SIDE).toBe(1080);
    expect(fitsFormat(1000, 4000, 1080, 1350)).toBe(false);
  });
});

describe("orientedSize", () => {
  it("đổi chiều theo EXIF 6", async () => {
    const buf = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#888" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect(await orientedSize(buf)).toEqual({ width: 3000, height: 4000 });
  });

  it("file không tồn tại hoặc không phải ảnh → PhotoError", async () => {
    await expect(orientedSize("/khong/co.jpg")).rejects.toThrow(PhotoError);
    await expect(orientedSize(Buffer.from("not an image"))).rejects.toThrow(PhotoError);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/prepare-size.test.ts`
Expected: FAIL — `cropSize` / `fitsFormat` / `orientedSize` không được export.

- [ ] **Step 3: Sửa `src/render/prepare.ts`**

Đổi `const MIN_SHORT_SIDE = 1080;` thành `export const MIN_SHORT_SIDE = 1080;` và thêm ngay sau hàm `errText`:
```ts
/** Display size of a photo after EXIF auto-rotation (orientations 5–8 swap width and height). */
export async function orientedSize(input: string | Buffer): Promise<{ width: number; height: number }> {
  if (typeof input === "string" && !existsSync(input)) throw new PhotoError(`Không tìm thấy file ảnh: ${input}`);
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch (e) {
    throw new PhotoError(`Không đọc được ảnh (có thể sai định dạng hoặc thiếu codec, ví dụ HEIC): ${errText(e)}`);
  }
  const swap = (meta.orientation ?? 1) >= 5;
  return { width: (swap ? meta.height : meta.width) ?? 0, height: (swap ? meta.width : meta.height) ?? 0 };
}

/** Largest crop of a w×h photo with the target frame's aspect ratio. */
export function cropSize(w: number, h: number, width: number, height: number): { width: number; height: number } {
  const ratio = width / height;
  return w / h > ratio ? { width: Math.round(h * ratio), height: h } : { width: w, height: Math.round(w / ratio) };
}

/** Whether a w×h photo can fill a width×height frame without upscaling. */
export function fitsFormat(w: number, h: number, width: number, height: number): boolean {
  if (Math.min(w, h) < MIN_SHORT_SIDE) return false;
  const c = cropSize(w, h, width, height);
  return c.width >= width && c.height >= height;
}
```

Trong `preparePhoto`, thay khối từ `if (typeof input === "string" && !existsSync(input))` đến hết dòng `const h = …` bằng:
```ts
  const { width: w, height: h } = await orientedSize(input);
```
và thay ba dòng `const ratio …`, `const cw …`, `const ch …` bằng:
```ts
  const { width: cw, height: ch } = cropSize(w, h, width, height);
```
Giữ nguyên mọi dòng khác (kiểm tra cạnh ngắn, kiểm tra vùng cắt, tính `left`/`top`, pipeline sharp).

- [ ] **Step 4: Chạy toàn bộ test**

Run: `npm test && npm run typecheck`
Expected: mọi test pass (cả `tests/prepare.test.ts` cũ), typecheck sạch.

- [ ] **Step 5: Commit**

```bash
git add src/render/prepare.ts tests/prepare-size.test.ts
git commit -m "refactor: export orientedSize, cropSize and fitsFormat from photo preparation"
```

---

### Task 2: Bộ xử lý lỗi chung cho CLI

**Files:**
- Create: `src/cli/run.ts`
- Modify: `src/cli/f1.ts`
- Test: `tests/cli.test.ts` (đã có — phải tiếp tục pass), `tests/cli-run.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/cli-run.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseOrUsage, UsageError } from "../src/cli/run";
import { parseArgs } from "node:util";

describe("parseOrUsage", () => {
  it("tham số thừa → UsageError kèm gợi ý", () => {
    expect(() =>
      parseOrUsage(() => parseArgs({ args: ["a"], options: {} }), "gợi ý"),
    ).toThrow(new UsageError("gợi ý"));
  });

  it("tuỳ chọn lạ → UsageError không gợi ý", () => {
    expect(() => parseOrUsage(() => parseArgs({ args: ["--x"], options: {} }), "gợi ý")).toThrow(new UsageError(""));
  });

  it("lỗi khác được ném lại nguyên vẹn", () => {
    expect(() => parseOrUsage(() => { throw new RangeError("khác"); })).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/cli-run.test.ts`
Expected: FAIL — `Failed to resolve import "../src/cli/run"`.

- [ ] **Step 3: Viết `src/cli/run.ts`**

```ts
import { PhotoError } from "../render/prepare";
import { closeBrowser, FontLoadError } from "../render/render";
import { ColorwayError } from "../rulebook/colorway";
import { RulebookError } from "../rulebook/load";

export class UsageError extends Error {}

/** Errors whose message is already a clear Vietnamese explanation for the user. */
const known: Array<new (...args: never[]) => Error> = [PhotoError, RulebookError, FontLoadError, ColorwayError];

export function registerKnownError(cls: new (...args: never[]) => Error): void {
  if (!known.includes(cls)) known.push(cls);
}

/** Turns node:util parseArgs errors into UsageError; `positionalHint` is shown for stray positional arguments. */
export function parseOrUsage<T>(parse: () => T, positionalHint = ""): T {
  try {
    return parse();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code?.startsWith("ERR_PARSE_ARGS")) {
      throw new UsageError(code === "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL" ? positionalHint : "");
    }
    throw e;
  }
}

/** Runs a CLI body: prints usage (exit 2), known errors as "Lỗi: …" (exit 1), anything else as unexpected (exit 1). */
export async function runCli(usage: string, main: () => Promise<number>): Promise<void> {
  try {
    process.exitCode = await main();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof UsageError) {
      console.error(usage);
      if (message) console.error(message);
      process.exitCode = 2;
    } else if (known.some((cls) => e instanceof cls)) {
      console.error(`Lỗi: ${message}`);
      process.exitCode = 1;
    } else {
      console.error(`Lỗi không mong đợi: ${message}`);
      process.exitCode = 1;
    }
  } finally {
    await closeBrowser();
  }
}
```

- [ ] **Step 4: Viết lại `src/cli/f1.ts` dùng bộ xử lý chung**

```ts
import { parseArgs } from "node:util";
import { runF1 } from "../pipeline/f1";
import { parseOrUsage, runCli, UsageError } from "./run";

const USAGE = 'Cách dùng: npm run f1 -- --photo <đường dẫn ảnh> --colorway "easy mint" [--out out] [--focus-x 0.5] [--focus-y 0.5]';
const QUOTE_HINT = 'Tên colorway có khoảng trắng — hãy đặt trong ngoặc kép, ví dụ --colorway "easy mint"';

/** Issue messages end with "."; drop it before joining so the line has no ".;". */
const joinMessages = (messages: string[]) => messages.map((m) => m.replace(/\.\s*$/, "")).join("; ");

await runCli(USAGE, async () => {
  const { values } = parseOrUsage(
    () =>
      parseArgs({
        options: {
          photo: { type: "string" },
          colorway: { type: "string" },
          out: { type: "string", default: "out" },
          "focus-x": { type: "string", default: "0.5" },
          "focus-y": { type: "string", default: "0.5" },
        },
      }),
    QUOTE_HINT,
  );
  if (!values.photo || !values.colorway) throw new UsageError("");
  const report = await runF1({
    photo: values.photo,
    colorway: values.colorway,
    outDir: values.out ?? "out",
    focus: { x: Number(values["focus-x"]), y: Number(values["focus-y"]) },
  });
  for (const f of report.formats) {
    const note = f.nameColor === "fallback" ? " (tên colorway đổi sang trắng vì màu túi không đủ tương phản)" : "";
    console.log(`${f.format}: ${f.file} — ${f.checks.length === 0 ? "đạt" : joinMessages(f.checks.map((c) => c.message))}${note}`);
  }
  for (const issue of report.lint) console.log(`chữ: ${issue.message}`);
  console.log(report.ok ? "KẾT QUẢ: ĐẠT" : "KẾT QUẢ: CÓ LỖI");
  return report.ok ? 0 : 1;
});
```

Ghi chú: `src/cli/f1.ts` chạy CLI ngay khi được import, nên không module nào được import nó. Task 6 chuyển `joinMessages` sang `src/post/format.ts` để dùng chung.

- [ ] **Step 5: Chạy test**

Run: `npx vitest run tests/cli-run.test.ts tests/cli.test.ts && npm run typecheck`
Expected: `cli-run` 3 passed, `cli` 5 passed (không đổi hành vi), typecheck sạch.

- [ ] **Step 6: Commit**

```bash
git add src/cli/run.ts src/cli/f1.ts tests/cli-run.test.ts
git commit -m "refactor: share CLI error handling and argument parsing"
```

---

### Task 3: Nạp ảnh

**Files:**
- Create: `src/ingest/ingest.ts`, `src/cli/ingest.ts`
- Modify: `package.json` (thêm script `ingest`)
- Test: `tests/ingest.test.ts`

Đầu vào có hai loại:
- **File kết quả tải từ Drive.** Khi ảnh lớn, công cụ `download_file_content` lưu kết quả thành một file `.txt` chứa JSON `{content: base64, id, mimeType, title}`.
- **File ảnh cục bộ.** Ví dụ ảnh người dùng gửi trực tiếp trong cuộc trò chuyện.

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/ingest.test.ts`:
```ts
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ingest } from "../src/ingest/ingest";

describe("ingest", () => {
  it("nạp file tải từ Drive và ảnh cục bộ, liệt kê file lỗi kèm lý do", async () => {
    const src = mkdtempSync(join(tmpdir(), "ingest-src-"));
    const out = join(mkdtempSync(join(tmpdir(), "ingest-out-")), "photos");
    const jpg = await sharp({ create: { width: 2000, height: 3000, channels: 3, background: "#888" } }).jpeg().toBuffer();

    const drive = join(src, "mcp-Google_Drive-download_file_content-1.txt");
    writeFileSync(drive, JSON.stringify({ content: jpg.toString("base64"), id: "abc", mimeType: "image/jpeg", title: "IMG_8316.jpeg" }));
    const local = join(src, "Ảnh đẹp.jpg");
    writeFileSync(local, jpg);
    const heic = join(src, "heic.txt");
    writeFileSync(heic, JSON.stringify({ content: "AAAA", id: "h", mimeType: "image/heic", title: "IMG_1.HEIC" }));
    const garbage = join(src, "rac.txt");
    writeFileSync(garbage, "không phải json");

    const r = await ingest([drive, local, heic, garbage, join(src, "khong-co.jpg")], out);

    expect(r.photos.map((p) => [p.index, p.title, p.width, p.height, p.driveId])).toEqual([
      [1, "IMG_8316.jpeg", 2000, 3000, "abc"],
      [2, "Ảnh đẹp.jpg", 2000, 3000, undefined],
    ]);
    expect(r.photos[0].file).toBe(join(out, "01-img-8316.jpg"));
    expect(r.photos[1].file).toBe(join(out, "02-anh-dep.jpg"));
    for (const p of r.photos) expect(existsSync(p.file)).toBe(true);

    expect(r.failures.map((f) => f.input)).toEqual([heic, garbage, join(src, "khong-co.jpg")]);
    expect(r.failures[0].reason).toContain("image/heic");
    expect(r.failures[1].reason).toContain("JSON");
    expect(r.failures[2].reason).toContain("Không tìm thấy");

    const manifest = JSON.parse(readFileSync(join(out, "photos.json"), "utf8"));
    expect(manifest.photos).toHaveLength(2);
    expect(manifest.failures).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/ingest.test.ts`
Expected: FAIL — `Failed to resolve import "../src/ingest/ingest"`.

- [ ] **Step 3: Viết `src/ingest/ingest.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { orientedSize, PhotoError } from "../render/prepare";
import { slug } from "../rulebook/colorway";

export interface IngestedPhoto {
  index: number;
  title: string;
  file: string;
  width: number;
  height: number;
  driveId?: string;
}

export interface IngestFailure {
  input: string;
  reason: string;
}

export interface IngestResult {
  photos: IngestedPhoto[];
  failures: IngestFailure[];
}

const EXT_BY_MIME: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const DRIVE_RESULT_EXT = new Set([".txt", ".json"]);

interface Loaded {
  title: string;
  mimeType?: string;
  driveId?: string;
  data: Buffer;
}

function load(input: string): Loaded {
  if (!existsSync(input)) throw new PhotoError(`Không tìm thấy file: ${input}`);
  if (!DRIVE_RESULT_EXT.has(extname(input).toLowerCase())) return { title: basename(input), data: readFileSync(input) };

  let parsed: { content?: unknown; id?: string; mimeType?: string; title?: string };
  try {
    parsed = JSON.parse(readFileSync(input, "utf8"));
  } catch {
    throw new PhotoError("File không phải JSON hợp lệ (không phải kết quả tải từ Drive).");
  }
  if (typeof parsed.content !== "string") throw new PhotoError("File JSON không có trường content (không phải kết quả tải từ Drive).");
  if (parsed.mimeType && !EXT_BY_MIME[parsed.mimeType]) {
    throw new PhotoError(`Định dạng ${parsed.mimeType} chưa hỗ trợ — cần JPEG, PNG hoặc WebP (ảnh HEIC hãy xuất sang JPEG).`);
  }
  return { title: parsed.title ?? basename(input), mimeType: parsed.mimeType, driveId: parsed.id, data: Buffer.from(parsed.content, "base64") };
}

/** Copies photos into `outDir` as `NN-<slug>.<ext>`, measures them, and writes `photos.json`. Never throws per file. */
export async function ingest(inputs: string[], outDir: string): Promise<IngestResult> {
  mkdirSync(outDir, { recursive: true });
  const photos: IngestedPhoto[] = [];
  const failures: IngestFailure[] = [];

  for (const input of inputs) {
    try {
      const { title, mimeType, driveId, data } = load(input);
      const { width, height } = await orientedSize(data);
      const index = photos.length + 1;
      const ext = (mimeType && EXT_BY_MIME[mimeType]) || extname(title).toLowerCase() || ".jpg";
      const name = `${String(index).padStart(2, "0")}-${slug(title.replace(/\.[^.]+$/, "")) || "anh"}${ext === ".jpeg" ? ".jpg" : ext}`;
      const file = join(outDir, name);
      writeFileSync(file, data);
      photos.push({ index, title, file, width, height, ...(driveId ? { driveId } : {}) });
    } catch (e) {
      failures.push({ input, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  writeFileSync(join(outDir, "photos.json"), JSON.stringify({ photos, failures }, null, 2));
  return { photos, failures };
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/ingest.test.ts`
Expected: `1 passed`.

- [ ] **Step 5: Viết CLI `src/cli/ingest.ts` và thêm script**

```ts
import { parseArgs } from "node:util";
import { ingest } from "../ingest/ingest";
import { parseOrUsage, runCli, UsageError } from "./run";

const USAGE = "Cách dùng: npm run ingest -- --out <thư mục ảnh> <file ảnh hoặc file tải từ Drive>...";

await runCli(USAGE, async () => {
  const { values, positionals } = parseOrUsage(() => parseArgs({ options: { out: { type: "string" } }, allowPositionals: true }));
  if (!values.out || positionals.length === 0) throw new UsageError("");
  const r = await ingest(positionals, values.out);
  console.log(`Đã nạp ${r.photos.length} ảnh vào ${values.out}`);
  for (const p of r.photos) console.log(`${p.index}. ${p.title} → ${p.file} (${p.width}×${p.height})`);
  for (const f of r.failures) console.log(`Bỏ qua ${f.input}: ${f.reason}`);
  return r.photos.length > 0 ? 0 : 1;
});
```

Thêm vào `scripts` trong `package.json`:
```json
"ingest": "tsx src/cli/ingest.ts",
```

- [ ] **Step 6: Commit**

```bash
git add src/ingest src/cli/ingest.ts package.json tests/ingest.test.ts
git commit -m "feat: ingest Drive downloads and local photos into a working folder"
```

---

### Task 4: Bảng ảnh thu nhỏ

Mục đích: để Claude xem một lượt 20 ảnh qua **một** ảnh tổng hợp (rẻ hơn nhiều so với mở 20 ảnh lớn), rồi mới mở riêng những ảnh cần xem kỹ.

**Files:**
- Create: `src/contact/sheet.ts`, `src/cli/contact.ts`
- Modify: `package.json` (script `contact`)
- Test: `tests/contact.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/contact.test.ts`:
```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { contactSheet } from "../src/contact/sheet";

describe("contactSheet", () => {
  it("xếp lưới 4 cột, mỗi ô 360px + dải nhãn 40px", async () => {
    const dir = mkdtempSync(join(tmpdir(), "contact-"));
    const items = await Promise.all(
      [1, 2, 3, 4, 5].map(async (i) => {
        const file = join(dir, `${i}.jpg`);
        writeFileSync(file, await sharp({ create: { width: 1200, height: 1600, channels: 3, background: "#777" } }).jpeg().toBuffer());
        return { file, label: String(i) };
      }),
    );
    const out = join(dir, "sheet.jpg");
    await contactSheet(items, out);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([1440, 800]);
  });

  it("danh sách rỗng → lỗi", async () => {
    await expect(contactSheet([], "/tmp/x.jpg")).rejects.toThrow(/rỗng/);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/contact.test.ts`
Expected: FAIL — `Failed to resolve import "../src/contact/sheet"`.

- [ ] **Step 3: Viết `src/contact/sheet.ts`**

```ts
import sharp from "sharp";

export interface SheetItem {
  file: string;
  label: string;
}

export interface SheetOptions {
  cell: number;
  cols: number;
}

const LABEL_H = 40;

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Writes a JPEG grid of thumbnails, each with a numbered label strip underneath. */
export async function contactSheet(items: SheetItem[], outPath: string, opts: SheetOptions = { cell: 360, cols: 4 }): Promise<void> {
  if (items.length === 0) throw new Error("Danh sách ảnh rỗng — không có gì để xếp bảng.");
  const { cell, cols } = opts;
  const rows = Math.ceil(items.length / cols);

  const tiles = await Promise.all(
    items.map(async (item, i) => {
      const thumb = await sharp(item.file).rotate().resize(cell, cell, { fit: "contain", background: "#ffffff" }).png().toBuffer();
      const label = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${LABEL_H}"><rect width="100%" height="100%" fill="#16233D"/>` +
          `<text x="10" y="28" font-family="DejaVu Sans, sans-serif" font-size="22" fill="#ffffff">${escapeXml(item.label)}</text></svg>`,
      );
      const left = (i % cols) * cell;
      const top = Math.floor(i / cols) * (cell + LABEL_H);
      return [
        { input: thumb, left, top },
        { input: label, left, top: top + cell },
      ];
    }),
  );

  await sharp({ create: { width: cols * cell, height: rows * (cell + LABEL_H), channels: 3, background: "#ffffff" } })
    .composite(tiles.flat())
    .jpeg({ quality: 85 })
    .toFile(outPath);
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/contact.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Viết CLI `src/cli/contact.ts` và thêm script**

```ts
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { contactSheet } from "../contact/sheet";
import type { IngestResult } from "../ingest/ingest";
import { parseOrUsage, runCli, UsageError } from "./run";

const USAGE = "Cách dùng: npm run contact -- --from <photos.json> --out <bảng.jpg>";

await runCli(USAGE, async () => {
  const { values } = parseOrUsage(() => parseArgs({ options: { from: { type: "string" }, out: { type: "string" } } }));
  if (!values.from || !values.out) throw new UsageError("");
  const manifest = JSON.parse(readFileSync(values.from, "utf8")) as IngestResult;
  await contactSheet(
    manifest.photos.map((p) => ({ file: p.file, label: `${p.index}. ${p.width}×${p.height}` })),
    values.out,
  );
  console.log(`Đã tạo bảng ${manifest.photos.length} ảnh: ${values.out}`);
  return 0;
});
```

Thêm vào `scripts`:
```json
"contact": "tsx src/cli/contact.ts",
```

- [ ] **Step 6: Commit**

```bash
git add src/contact src/cli/contact.ts package.json tests/contact.test.ts
git commit -m "feat: numbered contact sheet for reviewing many photos at once"
```

---

### Task 5: Thẻ ảnh

Claude viết các trường cần phán đoán: colorway, kiểu ảnh, có người hay không, chất lượng, điểm lấy nét, ghi chú. Code kiểm tra các trường đó hợp lệ, chuẩn hoá tên colorway về đúng tên trong rulebook, và **tự tính** `fits` (đủ lớn cho Feed và Story không), không để Claude tự đoán.

**Files:**
- Create: `src/cards/cards.ts`, `src/cli/cards.ts`
- Modify: `package.json` (script `cards`)
- Test: `tests/cards.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/cards.test.ts`:
```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { completeCards, type PhotoCard } from "../src/cards/cards";
import { loadRulebook } from "../src/rulebook/load";

const rb = loadRulebook();

async function photo(dir: string, name: string, w: number, h: number) {
  const file = join(dir, name);
  writeFileSync(file, await sharp({ create: { width: w, height: h, channels: 3, background: "#777" } }).jpeg().toBuffer());
  return file;
}

const card = (file: string, over: Partial<PhotoCard> = {}): PhotoCard => ({
  file,
  colorway: "Easy Mint",
  kind: "flatlay",
  person: false,
  quality: "ok",
  focus: { x: 0.5, y: 0.5 },
  note: "",
  ...over,
});

describe("completeCards", () => {
  it("chuẩn hoá colorway và tính fits từ kích thước thật", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cards-"));
    const big = await photo(dir, "big.jpg", 3024, 4032);
    const wide = await photo(dir, "wide.jpg", 1920, 1080);
    const { cards, issues } = await completeCards([card(big), card(wide, { colorway: null })], rb);
    expect(issues).toEqual([]);
    expect(cards[0]).toMatchObject({ colorway: "easy mint", fits: { feed: true, story: true } });
    expect(cards[1]).toMatchObject({ colorway: null, fits: { feed: false, story: false } });
  });

  it("báo lỗi rõ cho từng trường sai", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cards-"));
    const big = await photo(dir, "big.jpg", 3024, 4032);
    const bad = card(big, {
      colorway: "hot red",
      kind: "studio" as PhotoCard["kind"],
      quality: "dep" as PhotoCard["quality"],
      focus: { x: 2, y: Number.NaN },
    });
    const { issues } = await completeCards([bad, card(join(dir, "khong-co.jpg"))], rb);
    const messages = issues.map((i) => i.message).join("\n");
    expect(messages).toMatch(/hot red/);
    expect(messages).toMatch(/kind/);
    expect(messages).toMatch(/quality/);
    expect(messages).toMatch(/focus/);
    expect(messages).toMatch(/Không tìm thấy/);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/cards.test.ts`
Expected: FAIL — `Failed to resolve import "../src/cards/cards"`.

- [ ] **Step 3: Viết `src/cards/cards.ts`**

```ts
import { fitsFormat, orientedSize, type Focus } from "../render/prepare";
import { findColorway } from "../rulebook/colorway";
import type { Rulebook } from "../rulebook/types";

export type PhotoKind = "flatlay" | "lifestyle";
export type PhotoQuality = "ok" | "blurry" | "dark" | "cluttered";

const KINDS: PhotoKind[] = ["flatlay", "lifestyle"];
const QUALITIES: PhotoQuality[] = ["ok", "blurry", "dark", "cluttered"];

/** One photo as judged by Claude; `fits` is computed by code, never written by hand. */
export interface PhotoCard {
  file: string;
  /** Rulebook colorway name, or null when the photo shows no bag / several colorways. */
  colorway: string | null;
  kind: PhotoKind;
  person: boolean;
  quality: PhotoQuality;
  focus: Focus;
  note: string;
  fits?: { feed: boolean; story: boolean };
}

export interface CardIssue {
  file: string;
  message: string;
}

const inUnit = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

export async function completeCards(cards: PhotoCard[], rb: Rulebook): Promise<{ cards: PhotoCard[]; issues: CardIssue[] }> {
  const issues: CardIssue[] = [];
  const out: PhotoCard[] = [];

  for (const c of cards) {
    const add = (message: string) => issues.push({ file: c.file, message });
    const next: PhotoCard = { ...c };

    if (!KINDS.includes(c.kind)) add(`kind phải là ${KINDS.join(" / ")}, đang là "${c.kind}".`);
    if (!QUALITIES.includes(c.quality)) add(`quality phải là ${QUALITIES.join(" / ")}, đang là "${c.quality}".`);
    if (!inUnit(c.focus?.x) || !inUnit(c.focus?.y)) add(`focus.x và focus.y phải là số từ 0 đến 1.`);
    if (typeof c.person !== "boolean") add(`person phải là true hoặc false.`);

    if (c.colorway !== null) {
      try {
        next.colorway = findColorway(rb.visual, c.colorway).name;
      } catch (e) {
        add(e instanceof Error ? e.message : String(e));
      }
    }

    try {
      const { width, height } = await orientedSize(c.file);
      const { feed, story } = rb.visual.formats;
      next.fits = { feed: fitsFormat(width, height, feed.width, feed.height), story: fitsFormat(width, height, story.width, story.height) };
    } catch (e) {
      add(e instanceof Error ? e.message : String(e));
    }

    out.push(next);
  }
  return { cards: out, issues };
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/cards.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Viết CLI `src/cli/cards.ts` và thêm script**

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { completeCards, type PhotoCard } from "../cards/cards";
import { loadRulebook } from "../rulebook/load";
import { parseOrUsage, runCli, UsageError } from "./run";

const USAGE = "Cách dùng: npm run cards -- --file <cards.json>";
const mark = (ok: boolean | undefined) => (ok ? "✓" : "✗");

await runCli(USAGE, async () => {
  const { values } = parseOrUsage(() => parseArgs({ options: { file: { type: "string" } } }));
  if (!values.file) throw new UsageError("");
  const input = JSON.parse(readFileSync(values.file, "utf8")) as PhotoCard[];
  const { cards, issues } = await completeCards(input, loadRulebook());
  writeFileSync(values.file, JSON.stringify(cards, null, 2));
  cards.forEach((c, i) =>
    console.log(`${i + 1}. ${basename(c.file)} — ${c.colorway ?? "không rõ colorway"}, ${c.kind}, ${c.quality}, Feed ${mark(c.fits?.feed)} Story ${mark(c.fits?.story)}`),
  );
  for (const issue of issues) console.log(`Lỗi thẻ ${basename(issue.file)}: ${issue.message}`);
  return issues.length === 0 ? 0 : 1;
});
```

Thêm vào `scripts`:
```json
"cards": "tsx src/cli/cards.ts",
```

- [ ] **Step 6: Commit**

```bash
git add src/cards src/cli/cards.ts package.json tests/cards.test.ts
git commit -m "feat: photo cards with validation and computed Feed/Story fit"
```

---

### Task 6: Kế hoạch bài và gói duyệt

**Files:**
- Create: `src/post/plan.ts`, `src/post/format.ts`, `src/post/run.ts`, `src/cli/post.ts`
- Modify: `src/cli/f1.ts` (import `joinMessages` từ `src/post/format.ts`), `package.json` (script `post`)
- Test: `tests/post-plan.test.ts`, `tests/post-run.test.ts`

- [ ] **Step 1: Viết test kiểm tra kế hoạch (sẽ fail)**

`tests/post-plan.test.ts`:
```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PhotoCard } from "../src/cards/cards";
import { validatePlan, type PostPlan } from "../src/post/plan";
import { loadRulebook } from "../src/rulebook/load";

const rb = loadRulebook();
const dir = mkdtempSync(join(tmpdir(), "plan-"));
const photo = join(dir, "a.jpg");
writeFileSync(photo, "x");

const plan = (over: Partial<PostPlan> = {}): PostPlan => ({
  goal: "C",
  pillar: "FEEL",
  family: "F1",
  slides: [{ photo, colorway: "easy mint", why: "Túi nằm giữa, đồ phối cùng tông." }],
  caption: "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được.",
  hashtags: ["#dailyhugbag"],
  ...over,
});

const errors = (p: PostPlan, cards: PhotoCard[] = []) => validatePlan(p, rb, cards).filter((i) => i.severity === "error").map((i) => i.message);

describe("validatePlan", () => {
  it("kế hoạch đúng thì không có lỗi", () => {
    expect(errors(plan())).toEqual([]);
  });

  it("mục tiêu B với F1 bị chặn, nói rõ lý do", () => {
    expect(errors(plan({ goal: "B" })).join("\n")).toMatch(/Mục tiêu B không thuộc trụ FEEL/);
  });

  it("họ template chưa xây bị chặn", () => {
    expect(errors(plan({ pillar: "REAL", family: "F2" })).join("\n")).toMatch(/F2 chưa được xây/);
  });

  it("số slide F1 phải từ 1 đến 4", () => {
    expect(errors(plan({ slides: [] })).join("\n")).toMatch(/1–4 slide/);
  });

  it("ảnh không tồn tại, colorway sai, caption sai giọng", () => {
    const msg = errors(
      plan({ slides: [{ photo: join(dir, "khong-co.jpg"), colorway: "hot red", why: "x" }], caption: "Shop mới về túi siêu soft" }),
    ).join("\n");
    expect(msg).toMatch(/Không tìm thấy ảnh/);
    expect(msg).toMatch(/hot red/);
    expect(msg).toMatch(/shop/i);
    expect(msg).toMatch(/soft/);
  });

  it("dùng thẻ ảnh: ảnh kém, sai kiểu, không đủ lớn", () => {
    const card: PhotoCard = {
      file: photo,
      colorway: "easy mint",
      kind: "lifestyle",
      person: true,
      quality: "blurry",
      focus: { x: 0.5, y: 0.5 },
      note: "",
      fits: { feed: true, story: false },
    };
    const msg = errors(plan(), [card]).join("\n");
    expect(msg).toMatch(/chất lượng/);
    expect(msg).toMatch(/flatlay/);
    expect(msg).toMatch(/Story/);
  });

  it("hashtag phải bắt đầu bằng #", () => {
    expect(errors(plan({ hashtags: ["dailyhugbag"] })).join("\n")).toMatch(/#/);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/post-plan.test.ts`
Expected: FAIL — `Failed to resolve import "../src/post/plan"`.

- [ ] **Step 3: Viết `src/post/plan.ts`**

```ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { PhotoCard } from "../cards/cards";
import { lintText } from "../lint/voice";
import type { Focus } from "../render/prepare";
import { findColorway } from "../rulebook/colorway";
import type { Goal, Pillar, Rulebook } from "../rulebook/types";

export class PlanError extends Error {}

export interface PlanSlide {
  photo: string;
  colorway: string;
  focus?: Focus;
  /** Why this photo was chosen — shown to the user in the review pack. */
  why: string;
}

export interface PostPlan {
  goal: Goal;
  pillar: string;
  family: Pillar["family"];
  slides: PlanSlide[];
  caption: string;
  hashtags: string[];
}

export interface PlanIssue {
  severity: "error" | "warn";
  message: string;
}

/** Template families that exist in code. */
export const BUILT_FAMILIES: Pillar["family"][] = ["F1"];
const F1_MAX_SLIDES = 4;

export function validatePlan(plan: PostPlan, rb: Rulebook, cards: PhotoCard[] = []): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const error = (message: string) => issues.push({ severity: "error", message });
  const warn = (message: string) => issues.push({ severity: "warn", message });

  const pillar = rb.pillars[plan.pillar];
  if (!pillar) {
    error(`Trụ "${plan.pillar}" không có trong rulebook/pillars.yaml (có: ${Object.keys(rb.pillars).join(", ")}).`);
  } else {
    if (!pillar.goals.includes(plan.goal)) {
      error(`Mục tiêu ${plan.goal} không thuộc trụ ${plan.pillar} (trụ này phục vụ: ${pillar.goals.join(", ")}).`);
    }
    if (pillar.family !== plan.family) error(`Trụ ${plan.pillar} dùng họ template ${pillar.family}, kế hoạch lại ghi ${plan.family}.`);
  }
  if (!BUILT_FAMILIES.includes(plan.family)) error(`Họ template ${plan.family} chưa được xây (hiện có: ${BUILT_FAMILIES.join(", ")}).`);

  if (plan.family === "F1" && (plan.slides.length < 1 || plan.slides.length > F1_MAX_SLIDES)) {
    error(`F1 cần 1–${F1_MAX_SLIDES} slide, kế hoạch có ${plan.slides.length}.`);
  }

  const seen = new Set<string>();
  plan.slides.forEach((s, i) => {
    const n = i + 1;
    if (!existsSync(s.photo)) error(`Slide ${n}: Không tìm thấy ảnh ${s.photo}.`);
    try {
      const name = findColorway(rb.visual, s.colorway).name;
      if (seen.has(name)) warn(`Slide ${n}: colorway "${name}" đã có ở slide trước.`);
      seen.add(name);
    } catch (e) {
      error(`Slide ${n}: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!s.why?.trim()) warn(`Slide ${n}: thiếu lý do chọn ảnh.`);

    const card = cards.find((c) => resolve(c.file) === resolve(s.photo));
    if (card) {
      if (card.quality !== "ok") error(`Slide ${n}: thẻ ảnh ghi chất lượng "${card.quality}".`);
      if (pillar?.photo === "flatlay" && card.kind !== "flatlay") error(`Slide ${n}: trụ ${plan.pillar} cần ảnh flatlay, ảnh này là ${card.kind}.`);
      if (card.fits && !card.fits.feed) error(`Slide ${n}: ảnh không đủ lớn cho Feed.`);
      if (card.fits && !card.fits.story) error(`Slide ${n}: ảnh không đủ lớn cho Story.`);
    }
  });

  if (!plan.caption?.trim()) error("Caption trống.");
  for (const tag of plan.hashtags) if (!tag.startsWith("#")) error(`Hashtag "${tag}" phải bắt đầu bằng #.`);
  for (const issue of lintText(`${plan.caption}\n${plan.hashtags.join(" ")}`, rb.voice)) {
    (issue.severity === "error" ? error : warn)(`Caption: ${issue.message}`);
  }
  return issues;
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/post-plan.test.ts`
Expected: `7 passed`.

- [ ] **Step 5: Tách `joinMessages`**

`src/post/format.ts`:
```ts
/** Issue messages end with "."; drop it before joining so the line has no ".;". */
export const joinMessages = (messages: string[]) => messages.map((m) => m.replace(/\.\s*$/, "")).join("; ");

export const NAME_FALLBACK_NOTE = " (tên colorway đổi sang trắng vì màu túi không đủ tương phản)";
```
Trong `src/cli/f1.ts`: xoá định nghĩa `joinMessages` cục bộ, thêm `import { joinMessages, NAME_FALLBACK_NOTE } from "../post/format";`, và thay chuỗi ghi chú tại chỗ bằng `NAME_FALLBACK_NOTE`.

Run: `npx vitest run tests/cli.test.ts` → `5 passed`.

- [ ] **Step 6: Viết test runPost (sẽ fail)**

`tests/post-run.test.ts`:
```ts
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { PlanError, type PostPlan } from "../src/post/plan";
import { runPost } from "../src/post/run";
import { closeBrowser } from "../src/render/render";
import { makeFlatlayFixture } from "./fixtures/flatlay";

afterAll(closeBrowser);

describe("runPost", () => {
  it("dựng carousel 2 slide và tạo gói duyệt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "post-"));
    const mint = join(dir, "mint.jpg");
    const black = join(dir, "black.jpg");
    writeFileSync(mint, await makeFlatlayFixture());
    writeFileSync(black, await makeFlatlayFixture("#252728"));
    const plan: PostPlan = {
      goal: "C",
      pillar: "FEEL",
      family: "F1",
      slides: [
        { photo: mint, colorway: "easy mint", why: "Túi giữa khung, đồ phối cùng tông." },
        { photo: black, colorway: "not tired black", why: "Tương phản mạnh với slide 1." },
      ],
      caption: "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được.",
      hashtags: ["#dailyhugbag", "#balancify"],
    };
    const out = join(dir, "out");
    const r = await runPost(plan, out);

    expect(r.ok).toBe(true);
    expect(r.slides.map((s) => s.report.colorway)).toEqual(["easy mint", "not tired black"]);
    for (const s of r.slides) for (const f of s.report.formats) expect(existsSync(f.file)).toBe(true);
    expect(existsSync(join(out, "slide-1", "f1-easy-mint-feed.png"))).toBe(true);
    expect(existsSync(r.previewFile)).toBe(true);
    expect(readFileSync(r.captionFile, "utf8")).toBe(`${plan.caption}\n\n#dailyhugbag #balancify\n`);

    const review = readFileSync(r.reviewFile, "utf8");
    expect(review).toContain("KẾT QUẢ: ĐẠT");
    expect(review).toContain("## Slide 2 — not tired black");
    expect(review).toContain("Tương phản mạnh với slide 1.");
    expect(review).toContain("đổi sang trắng");
  });

  it("kế hoạch có lỗi thì không dựng gì và ném PlanError liệt kê lỗi", async () => {
    const dir = mkdtempSync(join(tmpdir(), "post-"));
    const plan: PostPlan = { goal: "B", pillar: "FEEL", family: "F1", slides: [], caption: "", hashtags: [] };
    await expect(runPost(plan, join(dir, "out"))).rejects.toThrow(PlanError);
    expect(existsSync(join(dir, "out"))).toBe(false);
  });
});
```

- [ ] **Step 7: Chạy test, xác nhận fail**

Run: `npx vitest run tests/post-run.test.ts`
Expected: FAIL — `Failed to resolve import "../src/post/run"`.

- [ ] **Step 8: Viết `src/post/run.ts`**

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PhotoCard } from "../cards/cards";
import { contactSheet } from "../contact/sheet";
import { runF1, type F1Report } from "../pipeline/f1";
import { loadRulebook } from "../rulebook/load";
import { joinMessages, NAME_FALLBACK_NOTE } from "./format";
import { PlanError, validatePlan, type PlanIssue, type PostPlan } from "./plan";

export interface SlideResult {
  index: number;
  why: string;
  report: F1Report;
}

export interface PostResult {
  ok: boolean;
  warnings: PlanIssue[];
  slides: SlideResult[];
  reviewFile: string;
  previewFile: string;
  captionFile: string;
}

const FORMAT_LABEL = { feed: "Feed", story: "Story" } as const;

/** Throws PlanError (before writing anything) when the plan has errors. */
export function checkPlan(plan: PostPlan, cards: PhotoCard[] = []): PlanIssue[] {
  const issues = validatePlan(plan, loadRulebook(), cards);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) throw new PlanError(`Kế hoạch bài có ${errors.length} lỗi:\n${errors.map((e) => `- ${e.message}`).join("\n")}`);
  return issues;
}

export async function runPost(plan: PostPlan, outDir: string, cards: PhotoCard[] = []): Promise<PostResult> {
  const warnings = checkPlan(plan, cards);

  const slides: SlideResult[] = [];
  for (const [i, s] of plan.slides.entries()) {
    const report = await runF1({ photo: s.photo, colorway: s.colorway, focus: s.focus, outDir: join(outDir, `slide-${i + 1}`) });
    slides.push({ index: i + 1, why: s.why, report });
  }

  mkdirSync(outDir, { recursive: true });
  const captionFile = join(outDir, "caption.txt");
  writeFileSync(captionFile, `${plan.caption}\n\n${plan.hashtags.join(" ")}\n`);

  const previewFile = join(outDir, "preview.jpg");
  await contactSheet(
    slides.flatMap((s) => s.report.formats.map((f) => ({ file: f.file, label: `${s.index} ${FORMAT_LABEL[f.format]}` }))),
    previewFile,
    { cell: 360, cols: 2 },
  );

  const ok = slides.every((s) => s.report.ok);
  const lines = [
    `# Gói duyệt — mục tiêu ${plan.goal} · trụ ${plan.pillar} · ${plan.family}`,
    "",
    ok ? "KẾT QUẢ: ĐẠT" : "KẾT QUẢ: CÓ LỖI",
    "",
    "## Caption",
    "",
    plan.caption,
    "",
    plan.hashtags.join(" "),
    "",
  ];
  for (const s of slides) {
    lines.push(`## Slide ${s.index} — ${s.report.colorway}`, "", `Lý do chọn ảnh: ${s.why}`, "");
    for (const f of s.report.formats) {
      const status = f.checks.length === 0 ? "đạt" : joinMessages(f.checks.map((c) => c.message));
      lines.push(`- ${FORMAT_LABEL[f.format]}: ${f.file} — ${status}${f.nameColor === "fallback" ? NAME_FALLBACK_NOTE : ""}`);
    }
    for (const issue of s.report.lint) lines.push(`- Chữ: ${issue.message}`);
    lines.push("");
  }
  if (warnings.length > 0) lines.push("## Cảnh báo", "", ...warnings.map((w) => `- ${w.message}`), "");

  const reviewFile = join(outDir, "review.md");
  writeFileSync(reviewFile, lines.join("\n"));
  return { ok, warnings, slides, reviewFile, previewFile, captionFile };
}
```

- [ ] **Step 9: Chạy test, xác nhận pass**

Run: `npx vitest run tests/post-run.test.ts`
Expected: `2 passed`.

- [ ] **Step 10: Viết CLI `src/cli/post.ts`, đăng ký PlanError, thêm script**

```ts
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { PhotoCard } from "../cards/cards";
import { PlanError, type PostPlan } from "../post/plan";
import { checkPlan, runPost } from "../post/run";
import { parseOrUsage, registerKnownError, runCli, UsageError } from "./run";

const USAGE = "Cách dùng: npm run post -- --plan <plan.json> [--cards <cards.json>] (--check | --out <thư mục>)";

registerKnownError(PlanError);

await runCli(USAGE, async () => {
  const { values } = parseOrUsage(() =>
    parseArgs({ options: { plan: { type: "string" }, cards: { type: "string" }, out: { type: "string" }, check: { type: "boolean", default: false } } }),
  );
  if (!values.plan || (!values.check && !values.out)) throw new UsageError("");
  const plan = JSON.parse(readFileSync(values.plan, "utf8")) as PostPlan;
  const cards = values.cards ? (JSON.parse(readFileSync(values.cards, "utf8")) as PhotoCard[]) : [];

  if (values.check) {
    const warnings = checkPlan(plan, cards);
    for (const w of warnings) console.log(`Cảnh báo: ${w.message}`);
    console.log("Kế hoạch hợp lệ.");
    return 0;
  }

  const r = await runPost(plan, values.out!, cards);
  console.log(`Gói duyệt: ${r.reviewFile}`);
  console.log(`Ảnh xem nhanh: ${r.previewFile}`);
  console.log(`Caption: ${r.captionFile}`);
  for (const w of r.warnings) console.log(`Cảnh báo: ${w.message}`);
  console.log(r.ok ? "KẾT QUẢ: ĐẠT" : "KẾT QUẢ: CÓ LỖI");
  return r.ok ? 0 : 1;
});
```

Thêm vào `scripts`:
```json
"post": "tsx src/cli/post.ts",
```

- [ ] **Step 11: Chạy toàn bộ test**

Run: `npm test && npm run typecheck`
Expected: mọi test pass, typecheck sạch.

- [ ] **Step 12: Commit**

```bash
git add src/post src/cli/post.ts src/cli/f1.ts package.json tests/post-plan.test.ts tests/post-run.test.ts
git commit -m "feat: post plans with validation, multi-slide F1 rendering and review pack"
```

---

### Task 7: Thử cả chuỗi lệnh như Claude sẽ chạy

**Files:**
- Test: `tests/workflow.test.ts`

- [ ] **Step 1: Viết test**

`tests/workflow.test.ts`:
```ts
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeFlatlayFixture } from "./fixtures/flatlay";

const run = (script: string, ...args: string[]) => {
  const r = spawnSync("npx", ["tsx", `src/cli/${script}.ts`, ...args], { cwd: process.cwd(), encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

describe("chuỗi ingest → contact → cards → post", () => {
  it("chạy trọn từ file tải về đến gói duyệt", async () => {
    const work = mkdtempSync(join(tmpdir(), "workflow-"));
    const download = join(work, "download.txt");
    const jpg = await makeFlatlayFixture();
    writeFileSync(download, JSON.stringify({ content: jpg.toString("base64"), id: "x1", mimeType: "image/jpeg", title: "flatlay mint.jpg" }));

    const photos = join(work, "photos");
    expect(run("ingest", "--out", photos, download).code).toBe(0);
    const manifest = JSON.parse(readFileSync(join(photos, "photos.json"), "utf8"));
    const file = manifest.photos[0].file as string;

    expect(run("contact", "--from", join(photos, "photos.json"), "--out", join(work, "sheet.jpg")).code).toBe(0);
    expect(existsSync(join(work, "sheet.jpg"))).toBe(true);

    const cards = join(work, "cards.json");
    writeFileSync(cards, JSON.stringify([{ file, colorway: "easy mint", kind: "flatlay", person: false, quality: "ok", focus: { x: 0.5, y: 0.5 }, note: "" }]));
    expect(run("cards", "--file", cards).code).toBe(0);
    expect(JSON.parse(readFileSync(cards, "utf8"))[0].fits).toEqual({ feed: true, story: true });

    const plan = join(work, "plan.json");
    writeFileSync(
      plan,
      JSON.stringify({
        goal: "C",
        pillar: "FEEL",
        family: "F1",
        slides: [{ photo: file, colorway: "easy mint", why: "Ảnh duy nhất, túi ở giữa." }],
        caption: "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được.",
        hashtags: ["#dailyhugbag"],
      }),
    );
    const check = run("post", "--plan", plan, "--cards", cards, "--check");
    expect(check.code).toBe(0);
    expect(check.out).toContain("Kế hoạch hợp lệ.");

    const out = join(work, "out");
    const post = run("post", "--plan", plan, "--cards", cards, "--out", out);
    expect(post.out).toContain("KẾT QUẢ: ĐẠT");
    expect(post.code).toBe(0);
    expect(existsSync(join(out, "review.md"))).toBe(true);
  });

  it("kế hoạch mục tiêu B: mã 1, lỗi tiếng Việt, không stack trace", () => {
    const work = mkdtempSync(join(tmpdir(), "workflow-"));
    const plan = join(work, "plan.json");
    writeFileSync(plan, JSON.stringify({ goal: "B", pillar: "FEEL", family: "F1", slides: [], caption: "", hashtags: [] }));
    const r = run("post", "--plan", plan, "--check");
    expect(r.code).toBe(1);
    expect(r.out.trimStart().startsWith("Lỗi: Kế hoạch bài có")).toBe(true);
    expect(r.out).toMatch(/Mục tiêu B không thuộc trụ FEEL/);
    expect(r.out).not.toMatch(/\n\s+at /);
  });
});
```

- [ ] **Step 2: Chạy test**

Run: `npx vitest run tests/workflow.test.ts`
Expected: `2 passed`. Nếu fail, sửa nguyên nhân thật ở file nguồn tương ứng (không nới test).

- [ ] **Step 3: Commit**

```bash
git add tests/workflow.test.ts
git commit -m "test: run the ingest → contact → cards → post chain end to end"
```

---

### Task 8: Skill cho Claude và tài liệu

**Files:**
- Create: `.claude/skills/make-post/SKILL.md`
- Modify: `README.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-25-instagram-content-system-design.md`

- [ ] **Step 1: Viết skill**

`.claude/skills/make-post/SKILL.md`:
````markdown
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
`W = <your scratchpad>/posts/<YYYY-MM-DD>-<slug of a short title>/` — never inside the repo.

## 2. Get photos
Drive folder: `search_files` with `parentId = '<folderId>'` (page through `nextPageToken`). Keep `mimeType` image/jpeg, image/png, image/webp. List HEIC and files over ~4 MB separately — tell the user they can't be downloaded (ask for JPEG / smaller export) instead of trying.
Download **one file per call, never in parallel** (parallel calls dropped the connector). Each large result is saved to a tool-results `.txt` path — collect those paths. If a result comes back inline instead, the file is tiny (below 1080 px); note it as too small, don't process it.
Uploaded photos: use their local paths directly.
Then: `npm run ingest -- --out W/photos <paths...>` and relay every "Bỏ qua" line to the user.

## 3. Look and write cards
`npm run contact -- --from W/photos/photos.json --out W/sheet.jpg`, Read `W/sheet.jpg`. Read individual photos only when you need detail (colorway, focus point).
Write `W/cards.json`: one object per photo `{file, colorway (rulebook name or null), kind: flatlay|lifestyle, person, quality: ok|blurry|dark|cluttered, focus: {x, y} (0–1, where the bag is), note}`. Then `npm run cards -- --file W/cards.json` and fix every "Lỗi thẻ" line. `fits` is computed — never write it.

## 4. Gate 1 — two plans
Write `W/plan-a.json` and `W/plan-b.json` (`{goal, pillar, family, slides: [{photo, colorway, focus?, why}], caption, hashtags}`), each different in a way that matters (photo choice / slide count / order). Caption: Vietnamese, xưng "mình", follow rulebook/voice.yaml; use only facts in rulebook/brand.yaml product_facts.
Check each: `npm run post -- --plan W/plan-a.json --cards W/cards.json --check`. Fix until "Kế hoạch hợp lệ."
Show the user both options: per slide the photo number from the sheet, colorway and `why`; the caption. Send `W/sheet.jpg`. Wait for their choice or edits.

## 5. Render
`npm run post -- --plan <chosen> --cards W/cards.json --out W/out`. Read `W/out/preview.jpg` and `W/out/review.md`.
If "KẾT QUẢ: CÓ LỖI": fix the cause (other photo, different `focus`) and rerun, at most twice; then tell the user exactly what still fails. Never present a failing result as passing.

## 6. Gate 2 — review pack
Send with SendUserFile: every `W/out/slide-*/f1-*-feed.png` and `-story.png`, plus `preview.jpg`. Paste the caption from `W/out/caption.txt` and the summary from `review.md` (including any "đổi sang trắng" notes and warnings). Ask: duyệt hay sửa gì.
Edits → change plan/cards → rerun step 5 → gate 2 again.

## 7. Done
Approved files are the ones already sent; the user posts them. Do not upload to Drive (the connector needs the whole image inlined as base64 — not workable). Never commit photos or W/ to git.
````

- [ ] **Step 2: Cập nhật README.md**

Thay mục "## Cách dùng" bằng:
```markdown
## Cách dùng
Nhắn Claude: "Làm bài mục tiêu C từ folder [link Drive]" (hoặc gửi ảnh trực tiếp). Claude làm theo skill `.claude/skills/make-post`:
1. Lấy ảnh từ Drive (từng ảnh một; ảnh HEIC hoặc lớn hơn ~4MB sẽ được báo lại để bạn xuất JPEG nhỏ hơn).
2. Lập thẻ ảnh, đưa **2 phương án** (ảnh nào vào slide nào, caption) — bạn chọn hoặc sửa.
3. Dựng ảnh Feed + Story cho từng slide, kiểm tra brand, gửi **gói duyệt** (ảnh, caption, lý do chọn ảnh) — bạn duyệt hoặc nhắn sửa.
4. Thành phẩm được gửi trong cuộc trò chuyện; bạn tự đăng lên Instagram.

Hiện chỉ có template F1 (flatlay colorway) nên chỉ làm được mục tiêu **C**. Mục tiêu B và D cần F2–F4 (giai đoạn 3–4).

Lệnh Claude dùng (tham khảo): `npm run ingest`, `npm run contact`, `npm run cards`, `npm run post`, `npm run f1`.
```
Giữ nguyên các dòng về `--photo`, HEIC, ngoặc kép, `report-<slug>.json`, mã thoát (đặt dưới tiêu đề "### Lệnh f1").

- [ ] **Step 3: Cập nhật CLAUDE.md**

Thêm các dòng:
```markdown
- To make a post, follow `.claude/skills/make-post/SKILL.md` (two user approval gates). Work folders live in your scratchpad under `posts/`, never in the repo.
- Commands: `npm run ingest -- --out <dir> <files...>`, `npm run contact -- --from <photos.json> --out <sheet.jpg>`, `npm run cards -- --file <cards.json>`, `npm run post -- --plan <plan.json> [--cards <cards.json>] (--check | --out <dir>)`. All exit 0 ok / 1 failure / 2 usage.
- Finished images go to the user via SendUserFile; do not upload them to Drive.
```

- [ ] **Step 4: Cập nhật spec**

Trong `docs/superpowers/specs/2026-10-25-instagram-content-system-design.md`:

Mục 7, bước 6 — thay bằng:
```
6. Gửi thành phẩm trong cuộc trò chuyện (ảnh Feed + Story từng slide, ảnh xem nhanh, caption). Không tải lên Drive: connector yêu cầu dán toàn bộ nội dung ảnh dạng base64 vào lệnh gọi, không khả thi mỗi ngày.
```

Mục 10, bảng — dòng đầu thay bằng:
```
| Ảnh gốc, reference | Google Drive |
| Ảnh làm việc và thành phẩm của từng bài | Thư mục scratchpad của session (`posts/<ngày>-<tên-bài>/`), gửi cho người dùng qua cuộc trò chuyện |
```

Mục 12 — dòng "Tải file lên Drive chưa được kiểm chứng" thay bằng:
```
- **Không tải thành phẩm lên Drive** (đã kiểm chứng: connector cần nội dung base64 trong lệnh gọi). Thành phẩm gửi trong cuộc trò chuyện.
```

- [ ] **Step 5: Chạy toàn bộ test**

Run: `npm test && npm run typecheck`
Expected: mọi test pass, typecheck sạch.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/make-post/SKILL.md README.md CLAUDE.md docs/superpowers/specs/2026-10-25-instagram-content-system-design.md
git commit -m "docs: make-post skill for Claude and phase 2 workflow docs"
```
