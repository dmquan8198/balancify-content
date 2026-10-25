# Giai đoạn 1 — Rulebook, kiểm tra giọng văn, template F1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Từ một ảnh flatlay và tên colorway, xuất ra ảnh F1 Feed (1080×1350) và Story (1080×1920) đúng brand, kèm báo cáo kiểm tra giọng văn và kiểm tra kỹ thuật.

**Architecture:** Rulebook là 4 file YAML được nạp và kiểm tra hợp lệ khi chạy. Template là HTML/CSS, được dựng thành PNG bằng Chromium (playwright-core). Ảnh được xử lý trước bằng sharp (xoay theo EXIF, cắt theo tỷ lệ, chỉnh màu nhẹ). Kiểm tra giọng văn và kiểm tra kỹ thuật là hàm thuần, có test riêng. Các bước cần phán đoán (chọn ảnh, viết chữ) do Claude làm trong cuộc trò chuyện ở giai đoạn sau; code chỉ lo phần xác định được.

**Tech Stack:** Node 22, TypeScript (chạy bằng tsx), vitest, sharp 0.35.5, playwright-core 1.63.0 (dùng Chromium có sẵn ở `/opt/pw-browsers`, biến `PLAYWRIGHT_BROWSERS_PATH` đã đặt), yaml 2.9.1.

**Spec:** `docs/superpowers/specs/2026-10-25-instagram-content-system-design.md`

---

## Lộ trình tổng (mỗi giai đoạn một plan riêng)

| Giai đoạn | Nội dung | Kết quả dùng được |
|---|---|---|
| **1 (plan này)** | Rulebook, kiểm tra giọng văn, xử lý ảnh, dựng HTML→PNG, kiểm tra kỹ thuật, template F1, ảnh chuẩn so sánh | Lệnh `npm run f1` ra ảnh F1 Feed + Story từ một ảnh |
| 2 | Nạp ảnh từ Drive, thẻ ảnh, gói duyệt, skill quy trình cho Claude | Luồng mỗi bài chạy trọn vẹn cho F1 |
| 3 | Template F2 (carousel đời thường) và F3 (carousel hữu ích) | Mục tiêu B và C đầy đủ |
| 4 | Template F4, luồng reference → đặc tả | Mục tiêu D; thêm template từ reference |
| 5 | Reel từ ảnh tĩnh | Video |

## Quy ước

- Mọi lệnh chạy từ thư mục gốc repo `/home/user/balancify-content`, trên nhánh `phase-1`.
- Mọi commit kết thúc bằng hai dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VpvDBmvqe41je1wi6iv4Hp
  ```
- Không bao giờ commit ảnh thật của brand. `.gitignore` chặn `*.jpg`, `*.jpeg`, `*.heic`, `*.png` (trừ `tests/golden/*.png`).

## Quyết định chi tiết hơn spec (Task 12 cập nhật lại spec)

1. **Font viết tay tạm:** Patrick Hand (giấy phép OFL), đánh dấu `provisional`, thay được trong `rulebook/visual.yaml`.
2. **Từ tiếng Anh được phép thêm:** `nylon` (playbook dùng "nylon chần bông"), `comment` và `HUG` (CTA "comment HUG" trong playbook).
3. **Câu mẫu thứ hai** trong spec chứa từ "brand" và vi phạm luật tiếng Anh, nên được thay bằng "Không phải mình lười. Mình chỉ hết pin."
4. **Ngưỡng tương phản** theo WCAG: 4.5:1 cho chữ dưới 24px, 3:1 cho chữ từ 24px.
5. **Phát hiện tiếng Anh:** một từ không dấu bị coi là tiếng Anh nếu không khớp cấu trúc âm tiết tiếng Việt (phụ âm đầu + vần + phụ âm cuối). Giới hạn đã biết: những từ tiếng Anh trùng cấu trúc tiếng Việt (ví dụ "hot", "top", "the") lọt qua.
6. **Phát hiện claim:** dựa trên danh sách `blocked_claims` trong `voice.yaml`. Claim ngoài danh sách do Claude chịu trách nhiệm khi viết.

## Cấu trúc file

```
package.json, tsconfig.json, vitest.config.ts, .gitignore
rulebook/brand.yaml          định vị, khách hàng, thông tin sản phẩm được phép nói
rulebook/voice.yaml          xưng hô, từ cấm, tiếng Anh được phép, thay từ, claim bị chặn, câu mẫu
rulebook/visual.yaml         màu nền, colorway, font, element cấm, kích thước, ngưỡng tương phản
rulebook/pillars.yaml        trụ ↔ mục tiêu ↔ họ template
scripts/fetch-fonts.sh       tải font OFL về assets/fonts
assets/fonts/                font + giấy phép (commit vào repo)
src/rulebook/types.ts        kiểu dữ liệu rulebook
src/rulebook/load.ts         nạp + kiểm tra hợp lệ rulebook
src/lint/voice.ts            kiểm tra giọng văn
src/checks/contrast.ts       tính tỷ lệ tương phản WCAG
src/checks/technical.ts      kiểm tra kích thước, vùng an toàn Story, tương phản
src/render/prepare.ts        xoay EXIF, cắt theo tỷ lệ + điểm lấy nét, chỉnh màu nhẹ
src/render/render.ts         HTML → PNG bằng Chromium, trả về vị trí các khối chữ
src/templates/fonts.ts       sinh @font-face từ rulebook
src/templates/f1.ts          template F1
src/pipeline/f1.ts           ghép các bước thành một lần chạy F1
src/cli/f1.ts                lệnh dòng lệnh `npm run f1`
tests/…                      test tương ứng; tests/fixtures/flatlay.ts sinh ảnh mẫu; tests/golden/ ảnh chuẩn
README.md (tiếng Việt, cho người dùng), CLAUDE.md (cho agent)
```

---

### Task 1: Khởi tạo dự án

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Test: `tests/smoke.test.ts`

- [ ] **Step 1: Tạo package.json và cài thư viện**

```bash
cat > package.json <<'EOF'
{
  "name": "balancify-content",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "fonts": "bash scripts/fetch-fonts.sh",
    "f1": "tsx src/cli/f1.ts",
    "golden:update": "UPDATE_GOLDEN=1 vitest run tests/golden.test.ts"
  }
}
EOF
npm i -E sharp@0.35.5 playwright-core@1.63.0 yaml@2.9.1
npm i -E -D vitest@5.0.5 tsx@4.23.15 typescript@5 @types/node@22
```

Expected: `added … packages`, không có lỗi.

- [ ] **Step 2: Tạo tsconfig.json, vitest.config.ts, .gitignore**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
```

`.gitignore`:
```
node_modules/
out/
*.jpg
*.jpeg
*.heic
*.png
!tests/golden/*.png
```

- [ ] **Step 3: Viết smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { chromium } from "playwright-core";

describe("môi trường", () => {
  it("sharp tạo được ảnh", async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#ffffff" } }).png().toBuffer();
    expect((await sharp(png).metadata()).width).toBe(4);
  });

  it("chromium khởi động được", async () => {
    const browser = await chromium.launch();
    expect(browser.isConnected()).toBe(true);
    await browser.close();
  });
});
```

- [ ] **Step 4: Chạy test**

Run: `npm test`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore tests/smoke.test.ts
git commit -m "chore: scaffold TypeScript project with sharp, playwright-core, vitest"
```

---

### Task 2: Rulebook — file YAML và bộ nạp

**Files:**
- Create: `rulebook/brand.yaml`, `rulebook/voice.yaml`, `rulebook/visual.yaml`, `rulebook/pillars.yaml`
- Create: `src/rulebook/types.ts`, `src/rulebook/load.ts`
- Test: `tests/rulebook.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/rulebook.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { loadRulebook, validate, RulebookError } from "../src/rulebook/load";

describe("rulebook", () => {
  it("nạp được 4 file và có 4 colorway", () => {
    const rb = loadRulebook();
    expect(rb.brand.product).toBe("Daily Hug Bag");
    expect(rb.voice.pronoun).toBe("mình");
    expect(Object.keys(rb.visual.colorways)).toEqual(["dreaming blue", "easy mint", "off duty pink", "not tired black"]);
    expect(rb.pillars.FEEL.family).toBe("F1");
  });

  it("báo lỗi rõ ràng khi màu colorway không phải hex", () => {
    const rb = loadRulebook();
    rb.visual.colorways["easy mint"] = { accent: "xanh" };
    expect(() => validate(rb)).toThrow(RulebookError);
    expect(() => validate(rb)).toThrow(/easy mint/);
  });

  it("báo lỗi khi thiếu thông tin sản phẩm", () => {
    const rb = loadRulebook();
    rb.brand.product_facts = [];
    expect(() => validate(rb)).toThrow(/product_facts/);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/rulebook.test.ts`
Expected: FAIL — `Failed to resolve import "../src/rulebook/load"`.

- [ ] **Step 3: Tạo 4 file rulebook**

`rulebook/brand.yaml`:
```yaml
name: balancify
product: Daily Hug Bag
positioning: "Daily Hug Bag — túi mềm cho những ngày dài."
message: Daily Hug Bag
tagline:
  text: Find your own balance
  placement: "Chỉ ở bao bì và footer, không dùng làm thông điệp chính trên bài."
audience: "Nữ 22–28, đi làm văn phòng/agency hoặc sinh viên năm cuối, mang laptop mỗi ngày, ở HCM hoặc HN, đang mệt."
jobs:
  functional: "Mang laptop 13–14\" đi làm mỗi ngày mà vai không đau, không trông như dân IT."
  emotional: "Một cái ôm giữa ngày mệt; tự thưởng ở mức không thấy tội lỗi."
  social: "Thể hiện gu quiet cute, chụp lên story được."
product_facts:
  - "nylon chần bông"
  - "đựng vừa laptop 14\""
  - "giá 460.000đ"
  - "4 colorway: dreaming blue, easy mint, off duty pink, not tired black"
```

`rulebook/voice.yaml`:
```yaml
pronoun: mình
forbidden:
  - shop
  - bên em
  - nhà mình
english_allowed:
  phrases:
    - Daily Hug Bag
    - Find your own balance
    - dreaming blue
    - easy mint
    - off duty pink
    - not tired black
  words:
    - balancify
    - laptop
    - reel
    - story
    - nylon
    - comment
    - HUG
hashtags_allowed:
  - "#dailyhugbag"
  - "#balancify"
replacements:
  soft: mềm
  cozy: êm
blocked_claims:
  - chống nước
  - chống thấm
  - bảo hành
  - da thật
  - cao cấp nhất
  - rẻ nhất
examples:
  - "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được."
  - "Không phải mình lười. Mình chỉ hết pin."
  - "Bạn đang mang gì trong túi đi làm? Mình đoán 80% có: cục sạc dự phòng đã hết pin."
  - "Cân bằng không phải là đứng yên. Là biết mình đang nghiêng về đâu."
```

`rulebook/visual.yaml`:
```yaml
neutrals:
  ground: "#3B3D3F"
  white: "#FFFFFF"
colorways:
  dreaming blue: { accent: "#B2CFEA", provisional: true }
  easy mint: { accent: "#B8C6B8", provisional: true }
  off duty pink: { accent: "#EDCBC9", provisional: true }
  not tired black: { accent: "#252728", provisional: true }
fonts:
  display: { family: Fraunces, weight: "100 900", file: assets/fonts/Fraunces.ttf }
  body: { family: Be Vietnam Pro, weight: 400, file: assets/fonts/BeVietnamPro-Regular.ttf }
  body_semibold: { family: Be Vietnam Pro, weight: 600, file: assets/fonts/BeVietnamPro-SemiBold.ttf }
  handwriting: { family: Patrick Hand, weight: 400, file: assets/fonts/PatrickHand-Regular.ttf, provisional: true }
banned_elements: [sparkle, khung viền, sticker, gradient màu, chữ nhiều màu]
formats:
  feed: { width: 1080, height: 1350 }
  story: { width: 1080, height: 1920, safe_top: 250, safe_bottom: 340 }
contrast:
  min_small: 4.5
  min_large: 3.0
  large_px: 24
```

`rulebook/pillars.yaml`:
```yaml
pillars:
  FEEL: { share: 30, goals: [C], family: F1, photo: flatlay }
  REAL: { share: 40, goals: [B, C], family: F2, photo: lifestyle }
  SERVE: { share: 10, goals: [B], family: F3, photo: any }
  PROOF: { share: 20, goals: [B], family: F3, photo: lifestyle }
  PROGRAM: { share: null, goals: [D], family: F4, photo: any }
```

- [ ] **Step 4: Viết kiểu dữ liệu và bộ nạp**

`src/rulebook/types.ts`:
```ts
export interface Brand {
  name: string;
  product: string;
  positioning: string;
  message: string;
  tagline: { text: string; placement: string };
  audience: string;
  jobs: { functional: string; emotional: string; social: string };
  product_facts: string[];
}

export interface Voice {
  pronoun: string;
  forbidden: string[];
  english_allowed: { phrases: string[]; words: string[] };
  hashtags_allowed: string[];
  replacements: Record<string, string>;
  blocked_claims: string[];
  examples: string[];
}

export interface FontSpec {
  family: string;
  weight: number | string;
  file: string;
  provisional?: boolean;
}

export interface Colorway {
  accent: string;
  provisional?: boolean;
}

export interface Format {
  width: number;
  height: number;
  safe_top?: number;
  safe_bottom?: number;
}

export interface Visual {
  neutrals: Record<string, string>;
  colorways: Record<string, Colorway>;
  fonts: Record<"display" | "body" | "body_semibold" | "handwriting", FontSpec>;
  banned_elements: string[];
  formats: { feed: Format; story: Format };
  contrast: { min_small: number; min_large: number; large_px: number };
}

export type Goal = "B" | "C" | "D";

export interface Pillar {
  share: number | null;
  goals: Goal[];
  family: "F1" | "F2" | "F3" | "F4";
  photo: "flatlay" | "lifestyle" | "any";
}

export interface Rulebook {
  brand: Brand;
  voice: Voice;
  visual: Visual;
  pillars: Record<string, Pillar>;
}
```

`src/rulebook/load.ts`:
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { Pillar, Rulebook } from "./types";

export class RulebookError extends Error {}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const FAMILIES = ["F1", "F2", "F3", "F4"];
const FONT_KEYS = ["display", "body", "body_semibold", "handwriting"] as const;

function req(cond: unknown, message: string): asserts cond {
  if (!cond) throw new RulebookError(message);
}

function read<T>(dir: string, name: string): T {
  return parse(readFileSync(join(dir, `${name}.yaml`), "utf8")) as T;
}

export function validate(rb: Rulebook): void {
  req(rb.brand?.name, "brand.name thiếu");
  req(Array.isArray(rb.brand.product_facts) && rb.brand.product_facts.length > 0, "brand.product_facts phải có ít nhất 1 dòng");
  req(rb.voice?.pronoun, "voice.pronoun thiếu");
  req(Array.isArray(rb.voice.forbidden), "voice.forbidden phải là danh sách");
  req(rb.visual?.colorways && Object.keys(rb.visual.colorways).length > 0, "visual.colorways trống");
  for (const [name, c] of Object.entries(rb.visual.colorways)) {
    req(HEX.test(c.accent), `màu colorway "${name}" không phải hex 6 số: ${c.accent}`);
  }
  for (const [name, hex] of Object.entries(rb.visual.neutrals)) {
    req(HEX.test(hex), `màu nền "${name}" không phải hex 6 số: ${hex}`);
  }
  for (const key of FONT_KEYS) req(rb.visual.fonts?.[key]?.file, `visual.fonts.${key} thiếu`);
  for (const [name, p] of Object.entries(rb.pillars)) {
    req(FAMILIES.includes(p.family), `pillar ${name}: family phải là F1–F4, đang là ${p.family}`);
  }
}

export function loadRulebook(dir = join(process.cwd(), "rulebook")): Rulebook {
  const rb: Rulebook = {
    brand: read(dir, "brand"),
    voice: read(dir, "voice"),
    visual: read(dir, "visual"),
    pillars: read<{ pillars: Record<string, Pillar> }>(dir, "pillars").pillars,
  };
  validate(rb);
  return rb;
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx vitest run tests/rulebook.test.ts`
Expected: `3 passed`.

- [ ] **Step 6: Commit**

```bash
git add rulebook src/rulebook tests/rulebook.test.ts
git commit -m "feat: add brand rulebook YAML files and validated loader"
```

---

### Task 3: Kiểm tra giọng văn

**Files:**
- Create: `src/lint/voice.ts`
- Test: `tests/lint-voice.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/lint-voice.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { loadRulebook } from "../src/rulebook/load";
import { hasErrors, lintText } from "../src/lint/voice";

const { voice } = loadRulebook();
const rules = (text: string) => lintText(text, voice).map((i) => `${i.rule}:${i.match}`);

describe("lintText", () => {
  it("bắt từ xưng hô bị cấm", () => {
    expect(rules("Shop mới về túi")).toContain("forbidden:Shop");
    expect(rules("Bên em có sẵn hàng")).toContain("forbidden:Bên em");
  });

  it("không bắt 'shop' nằm trong từ khác", () => {
    expect(rules("Mình bán túi ở workshop")).not.toContain("forbidden:workshop");
  });

  it("bắt từ tiếng Anh và gợi ý từ thay", () => {
    const issues = lintText("Túi siêu soft luôn á", voice);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: "english", match: "soft", suggestion: "mềm" });
    expect(lintText("Cái túi cozy ghê", voice)[0]).toMatchObject({ match: "cozy", suggestion: "êm" });
  });

  it("bắt từng từ tiếng Anh trong cụm", () => {
    expect(rules("mint green era")).toEqual(["english:mint", "english:green", "english:era"]);
  });

  it("bắt claim bị chặn", () => {
    expect(rules("Túi chống nước nhé")).toContain("blocked_claim:chống nước");
  });

  it("cảnh báo hashtag ngoài danh sách", () => {
    const issues = lintText("Túi mới #tuixinh", voice);
    expect(issues).toEqual([expect.objectContaining({ rule: "hashtag", severity: "warn", match: "#tuixinh" })]);
    expect(hasErrors(issues)).toBe(false);
  });

  it("câu mẫu trong rulebook đều đạt", () => {
    for (const example of voice.examples) expect(lintText(example, voice)).toEqual([]);
  });

  it("caption mở bán trong playbook đạt", () => {
    const caption =
      "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được.\n\n" +
      "Daily Hug Bag — nylon chần bông, mềm như gối, đựng vừa laptop 14\", nhẹ đến mức đeo cả ngày vai không biết.\n\n" +
      "460.000đ · lô đầu đúng 20 chiếc · comment HUG để mình nhắn riêng.\n\n#dailyhugbag #balancify";
    expect(lintText(caption, voice)).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/lint-voice.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lint/voice"`.

- [ ] **Step 3: Viết bộ kiểm tra**

`src/lint/voice.ts`:
```ts
import type { Voice } from "../rulebook/types";

export type Severity = "error" | "warn";

export interface LintIssue {
  rule: "forbidden" | "blocked_claim" | "english" | "hashtag";
  severity: Severity;
  match: string;
  message: string;
  suggestion?: string;
}

const VN_DIACRITIC = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu;

// A diacritic-free token counts as Vietnamese if it fits onset + rhyme + coda.
const ONSET = "(?:ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|b|c|d|g|h|k|l|m|n|p|r|s|t|v|x)?";
const NUCLEUS = "(?:uyu|uya|uye|uoi|uou|ieu|yeu|oai|oay|uay|oeo|ai|ao|au|ay|eo|eu|ia|ie|iu|oa|oe|oi|oo|ua|ue|ui|uo|uu|uy|ye|a|e|i|o|u|y)";
const CODA = "(?:ch|ng|nh|c|m|n|p|t)?";
const VN_SYLLABLE = new RegExp(`^${ONSET}${NUCLEUS}${CODA}$`, "i");

const HASHTAG = /#[\p{L}\p{N}_]+/gu;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phraseRe = (phrase: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(phrase)}(?![\\p{L}\\p{N}])`, "giu");

export function lintText(input: string, voice: Voice): LintIssue[] {
  const text = input.normalize("NFC");
  const issues: LintIssue[] = [];

  for (const word of voice.forbidden) {
    for (const m of text.matchAll(phraseRe(word))) {
      issues.push({ rule: "forbidden", severity: "error", match: m[0], message: `Không dùng "${m[0]}" — luôn xưng "${voice.pronoun}".` });
    }
  }

  for (const claim of voice.blocked_claims) {
    for (const m of text.matchAll(phraseRe(claim))) {
      issues.push({ rule: "blocked_claim", severity: "error", match: m[0], message: `Claim "${m[0]}" không có trong thông tin sản phẩm được phép nói.` });
    }
  }

  const allowedTags = new Set(voice.hashtags_allowed.map((h) => h.toLowerCase()));
  for (const m of text.matchAll(HASHTAG)) {
    if (!allowedTags.has(m[0].toLowerCase())) {
      issues.push({ rule: "hashtag", severity: "warn", match: m[0], message: `Hashtag "${m[0]}" chưa có trong danh sách được phép.` });
    }
  }

  let rest = text.replace(HASHTAG, " ");
  for (const phrase of [...voice.english_allowed.phrases, ...voice.forbidden, ...voice.blocked_claims]) {
    rest = rest.replace(phraseRe(phrase), " ");
  }

  const allowedWords = new Set(voice.english_allowed.words.map((w) => w.toLowerCase()));
  for (const token of rest.match(/\p{L}+/gu) ?? []) {
    if (VN_DIACRITIC.test(token) || allowedWords.has(token.toLowerCase()) || VN_SYLLABLE.test(token)) continue;
    const suggestion = voice.replacements[token.toLowerCase()];
    issues.push({
      rule: "english",
      severity: "error",
      match: token,
      message: suggestion
        ? `Từ tiếng Anh "${token}" — dùng "${suggestion}".`
        : `Từ "${token}" không phải tiếng Việt và không có trong danh sách tiếng Anh được phép.`,
      ...(suggestion ? { suggestion } : {}),
    });
  }

  return issues;
}

export const hasErrors = (issues: LintIssue[]) => issues.some((i) => i.severity === "error");
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/lint-voice.test.ts`
Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lint tests/lint-voice.test.ts
git commit -m "feat: add Vietnamese voice linter (forbidden words, English, claims, hashtags)"
```

---

### Task 4: Tính tương phản

**Files:**
- Create: `src/checks/contrast.ts`
- Test: `tests/contrast.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/contrast.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, parseCssColor } from "../src/checks/contrast";

describe("contrast", () => {
  it("trắng/đen là 21:1, cùng màu là 1:1", () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    expect(contrastRatio([120, 120, 120], [120, 120, 120])).toBeCloseTo(1, 5);
  });

  it("#777777 trên nền trắng xấp xỉ 4.48", () => {
    expect(contrastRatio(hexToRgb("#777777"), hexToRgb("#FFFFFF"))).toBeCloseTo(4.48, 2);
  });

  it("đọc được màu CSS rgb() và rgba()", () => {
    expect(parseCssColor("rgb(178, 207, 234)")).toEqual([178, 207, 234]);
    expect(parseCssColor("rgba(1, 2, 3, 0.5)")).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/contrast.test.ts`
Expected: FAIL — `Failed to resolve import "../src/checks/contrast"`.

- [ ] **Step 3: Viết hàm**

`src/checks/contrast.ts`:
```ts
export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function parseCssColor(css: string): Rgb {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Không đọc được màu CSS: ${css}`);
  const [r, g, b] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [r, g, b];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/contrast.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/checks/contrast.ts tests/contrast.test.ts
git commit -m "feat: add WCAG contrast helpers"
```

---

### Task 5: Font

**Files:**
- Create: `scripts/fetch-fonts.sh`, `assets/fonts/*` (tải về), `src/templates/fonts.ts`
- Test: `tests/fonts.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/fonts.test.ts`:
```ts
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRulebook } from "../src/rulebook/load";
import { fontFaceCss } from "../src/templates/fonts";

const rb = loadRulebook();

describe("fonts", () => {
  it("mọi font trong rulebook có file", () => {
    for (const f of Object.values(rb.visual.fonts)) expect(existsSync(f.file), f.file).toBe(true);
  });

  it("sinh @font-face cho từng font", () => {
    const css = fontFaceCss(rb);
    expect(css.match(/@font-face/g)).toHaveLength(4);
    expect(css).toContain('font-family:"Patrick Hand"');
    expect(css).toContain("font-weight:600");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/fonts.test.ts`
Expected: FAIL — `Failed to resolve import "../src/templates/fonts"`.

- [ ] **Step 3: Viết script tải font và chạy**

`scripts/fetch-fonts.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/fonts
base="https://raw.githubusercontent.com/google/fonts/main/ofl"
get() { curl -fsSL -o "assets/fonts/$2" "$base/$1"; }
get "fraunces/Fraunces%5BSOFT,WONK,opsz,wght%5D.ttf" Fraunces.ttf
get "fraunces/OFL.txt" OFL-Fraunces.txt
get "bevietnampro/BeVietnamPro-Regular.ttf" BeVietnamPro-Regular.ttf
get "bevietnampro/BeVietnamPro-SemiBold.ttf" BeVietnamPro-SemiBold.ttf
get "bevietnampro/OFL.txt" OFL-BeVietnamPro.txt
get "patrickhand/PatrickHand-Regular.ttf" PatrickHand-Regular.ttf
get "patrickhand/OFL.txt" OFL-PatrickHand.txt
ls -l assets/fonts
```

Run: `npm run fonts`
Expected: liệt kê 7 file trong `assets/fonts`, mỗi file `.ttf` lớn hơn 0 byte.

- [ ] **Step 4: Viết bộ sinh @font-face**

`src/templates/fonts.ts`:
```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Rulebook } from "../rulebook/types";

export function fontFaceCss(rb: Rulebook, root = process.cwd()): string {
  return Object.values(rb.visual.fonts)
    .map((f) => {
      const data = readFileSync(resolve(root, f.file)).toString("base64");
      return `@font-face{font-family:"${f.family}";src:url(data:font/ttf;base64,${data}) format("truetype");font-weight:${f.weight};font-style:normal;}`;
    })
    .join("\n");
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx vitest run tests/fonts.test.ts`
Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-fonts.sh assets/fonts src/templates/fonts.ts tests/fonts.test.ts
git commit -m "feat: vendor OFL fonts and generate embedded @font-face CSS"
```

---

### Task 6: Xử lý ảnh trước khi dựng

**Files:**
- Create: `src/render/prepare.ts`
- Test: `tests/prepare.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/prepare.test.ts`:
```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { PhotoError, preparePhoto } from "../src/render/prepare";

async function pixel(buf: Buffer, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

describe("preparePhoto", () => {
  it("cắt về đúng kích thước đích", async () => {
    const src = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: "#888888" } }).jpeg().toBuffer();
    const out = await preparePhoto(src, 1080, 1350);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([1080, 1350]);
  });

  it("xoay ảnh theo EXIF trước khi cắt", async () => {
    // Landscape: left half red, right half blue. EXIF 6 = rotate 90° clockwise, so left becomes top.
    const half = { width: 2000, height: 3000, channels: 3 as const };
    const red = await sharp({ create: { ...half, background: "#ff0000" } }).png().toBuffer();
    const blue = await sharp({ create: { ...half, background: "#0000ff" } }).png().toBuffer();
    const src = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#000000" } })
      .composite([{ input: red, left: 0, top: 0 }, { input: blue, left: 2000, top: 0 }])
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await preparePhoto(src, 1080, 1350);
    const top = await pixel(out, 540, 10);
    const bottom = await pixel(out, 540, 1340);
    expect(top[0]).toBeGreaterThan(200);
    expect(bottom[2]).toBeGreaterThan(200);
  });

  it("từ chối ảnh có cạnh ngắn dưới 1080px", async () => {
    const small = await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#888888" } }).jpeg().toBuffer();
    await expect(preparePhoto(small, 1080, 1350)).rejects.toThrow(PhotoError);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/prepare.test.ts`
Expected: FAIL — `Failed to resolve import "../src/render/prepare"`.

- [ ] **Step 3: Viết hàm xử lý ảnh**

`src/render/prepare.ts`:
```ts
import sharp from "sharp";

export class PhotoError extends Error {}

/** Point to keep in frame when cropping, as fractions of width/height (0–1). */
export interface Focus {
  x: number;
  y: number;
}

const MIN_SHORT_SIDE = 1080;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export async function preparePhoto(input: string | Buffer, width: number, height: number, focus: Focus = { x: 0.5, y: 0.5 }): Promise<Buffer> {
  const oriented = await sharp(input).rotate().toBuffer();
  const { width: w = 0, height: h = 0 } = await sharp(oriented).metadata();
  if (Math.min(w, h) < MIN_SHORT_SIDE) {
    throw new PhotoError(`Ảnh quá nhỏ (${w}×${h}); cạnh ngắn cần ít nhất ${MIN_SHORT_SIDE}px.`);
  }

  const ratio = width / height;
  const cw = w / h > ratio ? Math.round(h * ratio) : w;
  const ch = w / h > ratio ? h : Math.round(w / ratio);
  const left = clamp(Math.round(focus.x * w - cw / 2), 0, w - cw);
  const top = clamp(Math.round(focus.y * h - ch / 2), 0, h - ch);

  return sharp(oriented)
    .extract({ left, top, width: cw, height: ch })
    .resize(width, height)
    .modulate({ brightness: 1.02, saturation: 1.05 })
    .jpeg({ quality: 92 })
    .toBuffer();
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/prepare.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/render/prepare.ts tests/prepare.test.ts
git commit -m "feat: prepare photos (EXIF orientation, focus crop, light grade, size guard)"
```

---

### Task 7: Dựng HTML thành PNG

**Files:**
- Create: `src/render/render.ts`
- Test: `tests/render.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/render.test.ts`:
```ts
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { closeBrowser, FontLoadError, renderHtml } from "../src/render/render";

afterAll(closeBrowser);

const page = (body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#3B3D3F}</style></head><body>${body}</body></html>`;

describe("renderHtml", () => {
  it("xuất PNG đúng kích thước và trả về vị trí khối chữ", async () => {
    const r = await renderHtml(
      page(`<div data-text="t" style="position:absolute;left:100px;top:200px;font-size:40px;color:rgb(255,255,255)">Tiếng Việt</div>`),
      1080,
      1350,
    );
    const meta = await sharp(r.png).metadata();
    expect([meta.width, meta.height]).toEqual([1080, 1350]);
    expect(r.textBoxes).toHaveLength(1);
    expect(r.textBoxes[0]).toMatchObject({ id: "t", x: 100, y: 200, color: "rgb(255, 255, 255)", fontSizePx: 40, text: "Tiếng Việt" });
  });

  it("ảnh nền không chứa chữ", async () => {
    const r = await renderHtml(
      page(`<div data-text="t" style="position:absolute;left:0;top:0;width:200px;height:200px;background:#ffffff"></div>`),
      400,
      400,
    );
    const { data } = await sharp(r.background).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBe(0x3b);
  });

  it("báo lỗi khi font bắt buộc không tải được", async () => {
    await expect(renderHtml(page("<div>x</div>"), 100, 100, ["Font Không Có"])).rejects.toThrow(FontLoadError);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/render.test.ts`
Expected: FAIL — `Failed to resolve import "../src/render/render"`.

- [ ] **Step 3: Viết bộ dựng**

`src/render/render.ts`:
```ts
import { chromium, type Browser } from "playwright-core";

export class FontLoadError extends Error {}

/** Axis-aligned box of an element marked with `data-text`, in CSS pixels. */
export interface TextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fontSizePx: number;
  text: string;
}

export interface RenderResult {
  png: Buffer;
  /** Same page with every `data-text` element hidden, for sampling what sits behind text. */
  background: Buffer;
  textBoxes: TextBox[];
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  browser ??= await chromium.launch();
  return browser;
}

export async function closeBrowser(): Promise<void> {
  await browser?.close();
  browser = null;
}

export async function renderHtml(html: string, width: number, height: number, requiredFonts: string[] = []): Promise<RenderResult> {
  const page = await (await getBrowser()).newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  try {
    await page.setContent(html, { waitUntil: "load" });
    const missing = await page.evaluate(async (families: string[]) => {
      const faces = Array.from(document.fonts);
      await Promise.all(faces.map((f) => f.load().catch(() => undefined)));
      await document.fonts.ready;
      return families.filter((fam) => !faces.some((f) => f.family.replace(/["']/g, "") === fam && f.status === "loaded"));
    }, requiredFonts);
    if (missing.length > 0) throw new FontLoadError(`Không tải được font: ${missing.join(", ")}`);

    const textBoxes = await page.$$eval("[data-text]", (els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          id: el.getAttribute("data-text") ?? "",
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          color: cs.color,
          fontSizePx: parseFloat(cs.fontSize),
          text: el.textContent ?? "",
        };
      }),
    );
    const png = await page.screenshot({ type: "png" });
    await page.addStyleTag({ content: "[data-text]{visibility:hidden !important}" });
    const background = await page.screenshot({ type: "png" });
    return { png, background, textBoxes };
  } finally {
    await page.close();
  }
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/render.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/render/render.ts tests/render.test.ts
git commit -m "feat: render HTML to PNG with Chromium, report text boxes, verify fonts"
```

---

### Task 8: Kiểm tra kỹ thuật

**Files:**
- Create: `src/checks/technical.ts`
- Test: `tests/technical.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/technical.test.ts`:
```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { checkContrast, checkPalette, checkSafeZone, checkSize } from "../src/checks/technical";
import type { TextBox } from "../src/render/render";
import { loadRulebook } from "../src/rulebook/load";

const story = { width: 1080, height: 1920, safe_top: 250, safe_bottom: 340 };
const contrast = { min_small: 4.5, min_large: 3.0, large_px: 24 };
const box = (over: Partial<TextBox>): TextBox => ({ id: "t", x: 100, y: 600, width: 300, height: 60, color: "rgb(255, 255, 255)", fontSizePx: 30, text: "x", ...over });
const solid = (w: number, h: number, bg: string) => sharp({ create: { width: w, height: h, channels: 3, background: bg } }).png().toBuffer();

describe("checkSize", () => {
  it("bắt sai kích thước", async () => {
    expect(await checkSize(await solid(1080, 1920, "#000"), story)).toEqual([]);
    expect(await checkSize(await solid(1080, 1350, "#000"), story)).toHaveLength(1);
  });
});

describe("checkSafeZone", () => {
  it("chữ trong vùng an toàn thì đạt", () => {
    expect(checkSafeZone([box({ y: 600 })], story)).toEqual([]);
  });

  it("bắt chữ lấn vùng trên và vùng dưới của Story", () => {
    expect(checkSafeZone([box({ y: 200 })], story)).toHaveLength(1);
    expect(checkSafeZone([box({ y: 1560, height: 60 })], story)).toHaveLength(1);
  });

  it("bắt chữ tràn ra ngoài khung ngang", () => {
    expect(checkSafeZone([box({ x: 900, width: 300 })], story)).toHaveLength(1);
  });
});

describe("checkContrast", () => {
  it("chữ trắng trên nền trắng bị bắt, chữ đen trên nền trắng đạt", async () => {
    const bg = await solid(1080, 1920, "#ffffff");
    expect(await checkContrast(bg, [box({ color: "rgb(255, 255, 255)" })], contrast)).toHaveLength(1);
    expect(await checkContrast(bg, [box({ color: "rgb(0, 0, 0)" })], contrast)).toEqual([]);
  });

  it("chữ lớn dùng ngưỡng 3:1", async () => {
    const bg = await solid(1080, 1920, "#ffffff");
    // #8a8a8a on white ≈ 3.45:1 — fails small text, passes large text.
    expect(await checkContrast(bg, [box({ color: "rgb(138, 138, 138)", fontSizePx: 16 })], contrast)).toHaveLength(1);
    expect(await checkContrast(bg, [box({ color: "rgb(138, 138, 138)", fontSizePx: 64 })], contrast)).toEqual([]);
  });
});

describe("checkPalette", () => {
  const { visual } = loadRulebook();

  it("màu trắng và màu colorway đạt", () => {
    expect(checkPalette([box({ color: "rgb(255, 255, 255)" }), box({ color: "rgb(178, 207, 234)" })], visual)).toEqual([]);
  });

  it("màu ngoài bảng màu bị bắt", () => {
    expect(checkPalette([box({ color: "rgb(255, 0, 0)" })], visual)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/technical.test.ts`
Expected: FAIL — `Failed to resolve import "../src/checks/technical"`.

- [ ] **Step 3: Viết các kiểm tra**

`src/checks/technical.ts`:
```ts
import sharp from "sharp";
import type { Format, Visual } from "../rulebook/types";
import type { RenderResult, TextBox } from "../render/render";
import { contrastRatio, hexToRgb, parseCssColor, type Rgb } from "./contrast";

export interface CheckIssue {
  check: "size" | "safe_zone" | "contrast" | "palette";
  message: string;
}

const TOLERANCE = 0.5;

export async function checkSize(png: Buffer, fmt: Format): Promise<CheckIssue[]> {
  const { width, height } = await sharp(png).metadata();
  return width === fmt.width && height === fmt.height
    ? []
    : [{ check: "size", message: `Kích thước ${width}×${height}, cần ${fmt.width}×${fmt.height}.` }];
}

export function checkSafeZone(boxes: TextBox[], fmt: Format): CheckIssue[] {
  const top = fmt.safe_top ?? 0;
  const bottom = fmt.height - (fmt.safe_bottom ?? 0);
  const issues: CheckIssue[] = [];
  for (const b of boxes) {
    if (b.y < top - TOLERANCE || b.y + b.height > bottom + TOLERANCE) {
      issues.push({ check: "safe_zone", message: `Chữ "${b.id}" nằm ngoài vùng an toàn dọc (${top}–${bottom}px).` });
    }
    if (b.x < -TOLERANCE || b.x + b.width > fmt.width + TOLERANCE) {
      issues.push({ check: "safe_zone", message: `Chữ "${b.id}" tràn ra ngoài khung ngang.` });
    }
  }
  return issues;
}

export async function checkContrast(background: Buffer, boxes: TextBox[], rules: Visual["contrast"]): Promise<CheckIssue[]> {
  const { width: W = 0, height: H = 0 } = await sharp(background).metadata();
  const issues: CheckIssue[] = [];
  for (const b of boxes) {
    const left = Math.max(0, Math.floor(b.x));
    const top = Math.max(0, Math.floor(b.y));
    const width = Math.min(W - left, Math.ceil(b.width));
    const height = Math.min(H - top, Math.ceil(b.height));
    if (width < 1 || height < 1) continue;
    const { channels } = await sharp(background).extract({ left, top, width, height }).stats();
    const behind: Rgb = [channels[0].mean, channels[1].mean, channels[2].mean];
    const ratio = contrastRatio(parseCssColor(b.color), behind);
    const min = b.fontSizePx >= rules.large_px ? rules.min_large : rules.min_small;
    if (ratio < min) {
      issues.push({ check: "contrast", message: `Chữ "${b.id}" tương phản ${ratio.toFixed(2)}:1, cần ít nhất ${min}:1.` });
    }
  }
  return issues;
}

export function checkPalette(boxes: TextBox[], visual: Visual): CheckIssue[] {
  const allowed = new Set(
    [...Object.values(visual.neutrals), ...Object.values(visual.colorways).map((c) => c.accent)].map((hex) => hexToRgb(hex).join(",")),
  );
  return boxes
    .filter((b) => !allowed.has(parseCssColor(b.color).join(",")))
    .map((b) => ({ check: "palette" as const, message: `Chữ "${b.id}" dùng màu ${b.color}, không có trong bảng màu.` }));
}

export async function runTechnicalChecks(r: RenderResult, fmt: Format, visual: Visual): Promise<CheckIssue[]> {
  return [
    ...(await checkSize(r.png, fmt)),
    ...checkSafeZone(r.textBoxes, fmt),
    ...checkPalette(r.textBoxes, visual),
    ...(await checkContrast(r.background, r.textBoxes, visual.contrast)),
  ];
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/technical.test.ts`
Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/checks/technical.ts tests/technical.test.ts
git commit -m "feat: add size, Story safe-zone, contrast and palette checks"
```

---

### Task 9: Template F1 Flatlay colorway

Bố cục rút từ 4 ảnh flatlay reference: tên colorway viết tay, viết thường, xoay khoảng 72°, tô màu túi, đặt sát mép phải ở khoảng 62% chiều cao; nhãn "Daily Hug Bag" nhỏ, màu trắng, góc dưới bên trái. Không có element nào khác.

**Files:**
- Create: `src/templates/f1.ts`
- Test: `tests/f1-template.test.ts`

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/f1-template.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { loadRulebook } from "../src/rulebook/load";
import { f1Html } from "../src/templates/f1";

const rb = loadRulebook();
const photoJpeg = Buffer.from("fake");

describe("f1Html", () => {
  it("dùng màu colorway cho tên và đúng kích thước Story", () => {
    const t = f1Html(rb, { photoJpeg, colorway: "off duty pink", format: "story" });
    expect([t.width, t.height]).toEqual([1080, 1920]);
    expect(t.html).toContain("color:#EDCBC9");
    expect(t.html).toContain(">off duty pink<");
    expect(t.html).toContain(">Daily Hug Bag<");
    expect(t.fonts).toEqual(["Patrick Hand", "Be Vietnam Pro"]);
  });

  it("báo lỗi với colorway không có trong rulebook", () => {
    expect(() => f1Html(rb, { photoJpeg, colorway: "hot red", format: "feed" })).toThrow(/hot red/);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/f1-template.test.ts`
Expected: FAIL — `Failed to resolve import "../src/templates/f1"`.

- [ ] **Step 3: Viết template**

`src/templates/f1.ts`:
```ts
import type { Rulebook } from "../rulebook/types";
import { fontFaceCss } from "./fonts";

export type FormatName = "feed" | "story";

export interface F1Input {
  photoJpeg: Buffer;
  colorway: string;
  format: FormatName;
  label?: string;
}

export interface TemplateOutput {
  html: string;
  width: number;
  height: number;
  fonts: string[];
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function f1Html(rb: Rulebook, input: F1Input): TemplateOutput {
  const fmt = rb.visual.formats[input.format];
  const colorway = rb.visual.colorways[input.colorway];
  if (!colorway) throw new Error(`Không có colorway "${input.colorway}" trong rulebook/visual.yaml`);
  const hand = rb.visual.fonts.handwriting;
  const label = rb.visual.fonts.body_semibold;
  const nameTop = Math.round(fmt.height * 0.62);
  const labelBottom = (fmt.safe_bottom ?? 0) + 56;
  const photo = `data:image/jpeg;base64,${input.photoJpeg.toString("base64")}`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaceCss(rb)}
html,body{margin:0;padding:0}
body{width:${fmt.width}px;height:${fmt.height}px;position:relative;overflow:hidden;background:${rb.visual.neutrals.ground}}
.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.name{position:absolute;left:${fmt.width - 150}px;top:${nameTop}px;transform:translate(-50%,-50%) rotate(72deg);white-space:nowrap;font-family:"${hand.family}";font-weight:${hand.weight};font-size:64px;line-height:1;color:${colorway.accent}}
.label{position:absolute;left:56px;bottom:${labelBottom}px;font-family:"${label.family}";font-weight:${label.weight};font-size:26px;letter-spacing:.08em;line-height:1.3;color:${rb.visual.neutrals.white}}
</style></head><body>
<img class="photo" src="${photo}" alt="">
<div class="name" data-text="colorway-name">${escapeHtml(input.colorway)}</div>
<div class="label" data-text="label">${escapeHtml(input.label ?? rb.brand.product)}</div>
</body></html>`;

  return { html, width: fmt.width, height: fmt.height, fonts: [hand.family, label.family] };
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/f1-template.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/templates/f1.ts tests/f1-template.test.ts
git commit -m "feat: add F1 flatlay colorway template (feed + story)"
```

---

### Task 10: Ghép thành một lần chạy F1 và lệnh dòng lệnh

**Files:**
- Create: `tests/fixtures/flatlay.ts`, `src/pipeline/f1.ts`, `src/cli/f1.ts`
- Test: `tests/f1-pipeline.test.ts`

- [ ] **Step 1: Tạo ảnh mẫu tổng hợp (không dùng ảnh thật của brand)**

`tests/fixtures/flatlay.ts`:
```ts
import sharp from "sharp";

/** Deterministic stand-in for a flatlay: dark ground, bag kept left of the colorway-name column, two props above. */
export async function makeFlatlayFixture(accent = "#B8C6B8"): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="3200">
  <rect width="100%" height="100%" fill="#3B3D3F"/>
  <rect x="760" y="1500" width="880" height="1300" rx="220" fill="${accent}"/>
  <path d="M900 1520 Q1200 760 1500 1520" stroke="${accent}" stroke-width="130" fill="none"/>
  <circle cx="1200" cy="2150" r="80" fill="#FFFFFF"/>
  <rect x="700" y="600" width="260" height="380" rx="40" fill="#C2D6EA"/>
  <rect x="1500" y="700" width="300" height="160" rx="30" fill="#8C5E40"/>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}
```

- [ ] **Step 2: Viết test (sẽ fail)**

`tests/f1-pipeline.test.ts`:
```ts
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { runF1, slug } from "../src/pipeline/f1";
import { closeBrowser } from "../src/render/render";
import { makeFlatlayFixture } from "./fixtures/flatlay";

afterAll(closeBrowser);

describe("slug", () => {
  it("bỏ dấu và khoảng trắng", () => {
    expect(slug("Easy Mint")).toBe("easy-mint");
    expect(slug("Đi làm vui")).toBe("di-lam-vui");
  });
});

describe("runF1", () => {
  it("xuất Feed + Story, báo cáo đạt", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "f1-"));
    const report = await runF1({ photo: await makeFlatlayFixture(), colorway: "easy mint", outDir });

    expect(report.ok).toBe(true);
    expect(report.lint).toEqual([]);
    expect(report.formats.map((f) => f.format)).toEqual(["feed", "story"]);
    for (const f of report.formats) expect(f.checks).toEqual([]);

    const feed = await sharp(join(outDir, "f1-easy-mint-feed.png")).metadata();
    const story = await sharp(join(outDir, "f1-easy-mint-story.png")).metadata();
    expect([feed.width, feed.height]).toEqual([1080, 1350]);
    expect([story.width, story.height]).toEqual([1080, 1920]);

    expect(existsSync(join(outDir, "report.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(outDir, "report.json"), "utf8")).ok).toBe(true);
  });

  it("báo lỗi rõ khi colorway sai", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "f1-"));
    await expect(runF1({ photo: await makeFlatlayFixture(), colorway: "hot red", outDir })).rejects.toThrow(/hot red/);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npx vitest run tests/f1-pipeline.test.ts`
Expected: FAIL — `Failed to resolve import "../src/pipeline/f1"`.

- [ ] **Step 4: Viết pipeline**

`src/pipeline/f1.ts`:
```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runTechnicalChecks, type CheckIssue } from "../checks/technical";
import { hasErrors, lintText, type LintIssue } from "../lint/voice";
import { preparePhoto, type Focus } from "../render/prepare";
import { renderHtml } from "../render/render";
import { loadRulebook } from "../rulebook/load";
import { f1Html, type FormatName } from "../templates/f1";

export interface F1Options {
  photo: string | Buffer;
  colorway: string;
  outDir: string;
  focus?: Focus;
  label?: string;
}

export interface F1FormatReport {
  format: FormatName;
  file: string;
  checks: CheckIssue[];
}

export interface F1Report {
  colorway: string;
  lint: LintIssue[];
  formats: F1FormatReport[];
  ok: boolean;
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function runF1(opts: F1Options): Promise<F1Report> {
  const rb = loadRulebook();
  if (!rb.visual.colorways[opts.colorway]) throw new Error(`Không có colorway "${opts.colorway}" trong rulebook/visual.yaml`);
  const label = opts.label ?? rb.brand.product;
  const lint = lintText(label, rb.voice);
  mkdirSync(opts.outDir, { recursive: true });

  const formats: F1FormatReport[] = [];
  for (const format of ["feed", "story"] as const) {
    const fmt = rb.visual.formats[format];
    const photoJpeg = await preparePhoto(opts.photo, fmt.width, fmt.height, opts.focus);
    const t = f1Html(rb, { photoJpeg, colorway: opts.colorway, format, label });
    const rendered = await renderHtml(t.html, t.width, t.height, t.fonts);
    const checks = await runTechnicalChecks(rendered, fmt, rb.visual);
    const file = join(opts.outDir, `f1-${slug(opts.colorway)}-${format}.png`);
    writeFileSync(file, rendered.png);
    formats.push({ format, file, checks });
  }

  const report: F1Report = { colorway: opts.colorway, lint, formats, ok: !hasErrors(lint) && formats.every((f) => f.checks.length === 0) };
  writeFileSync(join(opts.outDir, "report.json"), JSON.stringify(report, null, 2));
  return report;
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx vitest run tests/f1-pipeline.test.ts`
Expected: `3 passed`.

- [ ] **Step 6: Viết lệnh dòng lệnh**

`src/cli/f1.ts`:
```ts
import { parseArgs } from "node:util";
import { runF1 } from "../pipeline/f1";
import { closeBrowser } from "../render/render";

const { values } = parseArgs({
  options: {
    photo: { type: "string" },
    colorway: { type: "string" },
    out: { type: "string", default: "out" },
    "focus-x": { type: "string", default: "0.5" },
    "focus-y": { type: "string", default: "0.5" },
  },
});

if (!values.photo || !values.colorway) {
  console.error('Cách dùng: npm run f1 -- --photo <đường dẫn ảnh> --colorway "easy mint" [--out out] [--focus-x 0.5] [--focus-y 0.5]');
  process.exit(2);
}

try {
  const report = await runF1({
    photo: values.photo,
    colorway: values.colorway,
    outDir: values.out ?? "out",
    focus: { x: Number(values["focus-x"]), y: Number(values["focus-y"]) },
  });
  for (const f of report.formats) {
    console.log(`${f.format}: ${f.file} — ${f.checks.length === 0 ? "đạt" : f.checks.map((c) => c.message).join("; ")}`);
  }
  for (const issue of report.lint) console.log(`chữ: ${issue.message}`);
  console.log(report.ok ? "KẾT QUẢ: ĐẠT" : "KẾT QUẢ: CÓ LỖI");
  process.exitCode = report.ok ? 0 : 1;
} finally {
  await closeBrowser();
}
```

- [ ] **Step 7: Chạy thử lệnh với ảnh mẫu**

```bash
npx tsx -e 'import("./tests/fixtures/flatlay.ts").then(async m => (await import("node:fs")).writeFileSync("out-fixture.jpg", await m.makeFlatlayFixture()))'
npm run f1 -- --photo out-fixture.jpg --colorway "easy mint" --out out
rm out-fixture.jpg
```

Expected: hai dòng `feed: out/f1-easy-mint-feed.png — đạt` và `story: out/f1-easy-mint-story.png — đạt`, rồi `KẾT QUẢ: ĐẠT`.

- [ ] **Step 8: Commit**

```bash
git add tests/fixtures/flatlay.ts src/pipeline/f1.ts src/cli/f1.ts tests/f1-pipeline.test.ts
git commit -m "feat: add F1 pipeline and npm run f1 command"
```

---

### Task 11: Ảnh chuẩn để so sánh

**Files:**
- Create: `tests/golden.test.ts`, `tests/golden/f1-easy-mint-feed.png`, `tests/golden/f1-easy-mint-story.png`

- [ ] **Step 1: Viết test**

`tests/golden.test.ts`:
```ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { runF1 } from "../src/pipeline/f1";
import { closeBrowser } from "../src/render/render";
import { makeFlatlayFixture } from "./fixtures/flatlay";

afterAll(closeBrowser);

const GOLDEN = join(process.cwd(), "tests/golden");
const MAX_MEAN_DIFF = 0.5; // average per-channel difference, 0–255

async function meanAbsDiff(a: Buffer, b: Buffer): Promise<number> {
  const ra = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rb = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) return Infinity;
  let sum = 0;
  for (let i = 0; i < ra.data.length; i++) sum += Math.abs(ra.data[i] - rb.data[i]);
  return sum / ra.data.length;
}

describe("ảnh chuẩn F1", () => {
  it("layout không lệch so với ảnh chuẩn", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "golden-"));
    const report = await runF1({ photo: await makeFlatlayFixture(), colorway: "easy mint", outDir });
    mkdirSync(GOLDEN, { recursive: true });

    for (const f of report.formats) {
      const name = `f1-easy-mint-${f.format}.png`;
      const golden = join(GOLDEN, name);
      if (process.env.UPDATE_GOLDEN || !existsSync(golden)) {
        writeFileSync(golden, readFileSync(f.file));
        continue;
      }
      expect(await meanAbsDiff(readFileSync(f.file), readFileSync(golden)), name).toBeLessThan(MAX_MEAN_DIFF);
    }
  });
});
```

- [ ] **Step 2: Tạo ảnh chuẩn lần đầu và xem bằng mắt**

Run: `npm run golden:update`
Expected: `1 passed`; xuất hiện `tests/golden/f1-easy-mint-feed.png` và `tests/golden/f1-easy-mint-story.png`.

Mở cả hai ảnh để kiểm tra:
- tên "easy mint" viết tay, màu mint, nằm dọc sát mép phải, không đè lên túi;
- nhãn "Daily Hug Bag" màu trắng ở góc dưới trái;
- ở bản Story, nhãn nằm trên vạch 340px tính từ đáy;
- không có element nào khác.

- [ ] **Step 3: Chạy test so sánh**

Run: `npx vitest run tests/golden.test.ts`
Expected: `1 passed`.

- [ ] **Step 4: Chạy toàn bộ test và typecheck**

Run: `npm test && npm run typecheck`
Expected: mọi test pass (38 test), typecheck không có lỗi.

- [ ] **Step 5: Commit**

```bash
git add tests/golden.test.ts tests/golden/*.png
git commit -m "test: add golden image comparison for F1"
```

---

### Task 12: Tài liệu và cập nhật spec

**Files:**
- Create: `README.md`, `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-25-instagram-content-system-design.md` (mục 4.2, 4.3, 9, 11)

- [ ] **Step 1: Viết README.md (tiếng Việt, cho người dùng)**

```markdown
# balancify-content

Hệ thống tạo bộ ảnh Instagram đúng brand cho balancify.

## Hiện có (giai đoạn 1)
- **Rulebook** (`rulebook/`): brand, giọng văn, hình ảnh, trụ content. Muốn đổi giá, thêm từ cấm, đổi màu colorway — sửa ở đây.
- **Kiểm tra giọng văn:** bắt "shop / bên em / nhà mình", từ tiếng Anh sai chỗ, claim không được phép, hashtag lạ.
- **Template F1 (flatlay colorway):** một ảnh flatlay → ảnh Feed 1080×1350 + Story 1080×1920, có tên colorway viết tay.

## Cách dùng
Nhắn Claude: "Làm F1 cho ảnh [đường dẫn hoặc link], colorway easy mint."

Lệnh tương ứng (Claude tự chạy):
`npm run f1 -- --photo <ảnh> --colorway "easy mint"`

## Đang dùng tạm, cần thay
- Hex 4 colorway (đo từ ảnh) — `rulebook/visual.yaml`
- Font viết tay Patrick Hand — `rulebook/visual.yaml`

Thiết kế: `docs/superpowers/specs/` · Kế hoạch: `docs/superpowers/plans/`
```

- [ ] **Step 2: Viết CLAUDE.md (cho agent)**

```markdown
# balancify-content — agent notes

- Spec: `docs/superpowers/specs/2026-10-25-instagram-content-system-design.md`. Plans: `docs/superpowers/plans/`.
- Commands: `npm test`, `npm run typecheck`, `npm run f1 -- --photo <file> --colorway "<name>"`, `npm run golden:update` (only after a deliberate layout change; inspect the new PNGs before committing).
- Never commit brand photos or Drive downloads. `.gitignore` blocks images except `tests/golden/*.png`.
- `rulebook/*.yaml` encodes decisions the user approved. Change it only when the user asks, and say what changed.
- Everything user-facing (copy, CLI output, reports) is Vietnamese. Run copy through `lintText` before showing it.
- Playwright: use `playwright-core` (pinned 1.63.0 to match the browsers in `/opt/pw-browsers`). Do not run `playwright install`.
```

- [ ] **Step 3: Cập nhật spec cho khớp quyết định của plan**

Trong `docs/superpowers/specs/2026-10-25-instagram-content-system-design.md`:

Mục 4.2 — thay dòng tiếng Anh được phép:
```
- **Tiếng Anh chỉ dùng cho:** balancify, Daily Hug Bag, Find your own balance, #dailyhugbag, #balancify, tên 4 colorway, và các từ: laptop, reel, story, nylon, comment, HUG. Mọi chữ còn lại bằng tiếng Việt.
```
Xoá dòng "Ngoại lệ (không có từ tiếng Việt tự nhiên): laptop, reel, story." trong bảng thay từ.

Mục 4.2 — thay câu mẫu thứ hai:
```
  - "Không phải mình lười. Mình chỉ hết pin."
```

Mục 4.3 — dòng font:
```
- **Font:** Fraunces (tiêu đề), Be Vietnam Pro (nội dung), Patrick Hand cho tên colorway (tạm, chờ font chính thức — mục 11).
```

Mục 9 — dòng tương phản:
```
  - độ tương phản chữ/nền ≥ 4.5:1 với chữ dưới 24px, ≥ 3:1 với chữ từ 24px (WCAG).
```

- [ ] **Step 4: Chạy lại toàn bộ test**

Run: `npm test && npm run typecheck`
Expected: mọi test pass, typecheck không có lỗi.

- [ ] **Step 5: Commit và push nhánh**

```bash
git add README.md CLAUDE.md docs/superpowers/specs/2026-10-25-instagram-content-system-design.md
git commit -m "docs: add README, agent notes; align spec with phase 1 decisions"
git push -u origin phase-1
```

Expected: nhánh `phase-1` xuất hiện trên GitHub.
