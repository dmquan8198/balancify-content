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
  /** Same page with the photo/background hidden and every `data-text` glyph painted solid black on white. */
  glyphMask: Buffer;
  textBoxes: TextBox[];
}

const GLYPH_MASK_CSS =
  "html,body{background:#fff !important}" +
  "body *:not([data-text]):not([data-text] *){visibility:hidden !important}" +
  "[data-text],[data-text] *{visibility:visible !important;color:#000 !important;opacity:1 !important;text-shadow:none !important;background:transparent !important}";

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

    if (requiredFonts.length > 0) {
      // A loaded @font-face is not enough: a misspelled family or missing weight silently falls back.
      const fallback = await page.$$eval(
        "[data-text]",
        (els, families) =>
          els.flatMap((el) => {
            const cs = getComputedStyle(el);
            const first = cs.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
            const ok = families.includes(first) && document.fonts.check(`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, el.textContent ?? "");
            return ok ? [] : [{ id: el.getAttribute("data-text") ?? "", font: `${first} ${cs.fontWeight}` }];
          }),
        requiredFonts,
      );
      if (fallback.length > 0) {
        throw new FontLoadError(`Chữ đang dùng font dự phòng: ${fallback.map((f) => `"${f.id}" (${f.font})`).join(", ")}`);
      }
    }

    const textBoxes = await page.$$eval("[data-text]", (els) =>
      els.map((el) => {
        // Range over the contents, not the element box: text can overflow a fixed-width element.
        const rg = document.createRange();
        rg.selectNodeContents(el);
        const r = rg.getBoundingClientRect();
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
    const maskStyle = await page.addStyleTag({ content: GLYPH_MASK_CSS });
    const glyphMask = await page.screenshot({ type: "png" });
    await maskStyle.evaluate((n) => (n as Element).remove());
    await page.addStyleTag({ content: "[data-text]{visibility:hidden !important}" });
    const background = await page.screenshot({ type: "png" });
    return { png, background, glyphMask, textBoxes };
  } finally {
    await page.close();
  }
}
