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
