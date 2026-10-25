import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { closeBrowser, FontLoadError, renderHtml } from "../src/render/render";
import { loadRulebook } from "../src/rulebook/load";
import { fontFaceCss } from "../src/templates/fonts";

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
    // Box hugs the glyph run, so it may sit a pixel or two inside the line box.
    expect(r.textBoxes[0].y).toBeGreaterThanOrEqual(198);
    expect(r.textBoxes[0].y).toBeLessThanOrEqual(204);
    expect(r.textBoxes[0]).toMatchObject({ id: "t", x: 100, color: "rgb(255, 255, 255)", fontSizePx: 40, text: "Tiếng Việt" });
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

describe("renderHtml glyphMask", () => {
  it("png có ảnh + chữ, glyphMask chỉ có chữ đen trên trắng, background không có chữ", async () => {
    const html = page(
      `<div style="position:absolute;left:0;top:0;width:400px;height:400px;background:#ff0000"></div>` +
        `<div data-text="t" style="position:absolute;left:0;top:0;width:100px;height:100px;background:#00ff00;color:#ffffff;opacity:.5">x</div>`,
    );
    const r = await renderHtml(html, 400, 400);
    const px = async (buf: Buffer, x: number, y: number) => {
      const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const i = (y * info.width + x) * info.channels;
      return [data[i], data[i + 1], data[i + 2]];
    };
    // png: green box at half opacity over red.
    const p = await px(r.png, 90, 90);
    expect(p[0]).toBeGreaterThan(100);
    expect(p[1]).toBeGreaterThan(100);
    // glyphMask: photo hidden, element background transparent → white; outside → white.
    expect(await px(r.glyphMask, 90, 90)).toEqual([255, 255, 255]);
    expect(await px(r.glyphMask, 300, 300)).toEqual([255, 255, 255]);
    // background: red everywhere, no text.
    expect(await px(r.background, 90, 90)).toEqual([255, 0, 0]);
  });

  it("glyphMask vẽ nét chữ màu đen", async () => {
    const r = await renderHtml(
      page(`<div data-text="t" style="position:absolute;left:0;top:0;font-size:200px;line-height:1;font-weight:900;color:#ffffff;opacity:.2">█</div>`),
      400,
      400,
    );
    const { data, info } = await sharp(r.glyphMask).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let dark = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i] < 128) dark++;
    expect(dark).toBeGreaterThan(1000);
  });
});

describe("renderHtml text boxes", () => {
  it("khối chữ bao trọn chữ tràn ra ngoài phần tử", async () => {
    const r = await renderHtml(
      page(`<div data-text="t" style="position:absolute;left:10px;top:10px;width:100px;white-space:nowrap;font-size:30px;color:#fff">Một dòng chữ rất dài tràn ra ngoài</div>`),
      1080,
      400,
    );
    expect(r.textBoxes[0].width).toBeGreaterThan(100);
  });
});

describe("renderHtml font fallback", () => {
  it("báo lỗi khi chữ rơi về font dự phòng vì sai tên font", async () => {
    const css = fontFaceCss(loadRulebook());
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div data-text="name" style="font-family:'Patrik Hand';font-size:40px">easy mint</div></body></html>`;
    await expect(renderHtml(html, 400, 200, ["Patrick Hand"])).rejects.toThrow(FontLoadError);
    await expect(renderHtml(html, 400, 200, ["Patrick Hand"])).rejects.toThrow(/name/);
  });

  it("font đúng tên và độ đậm thì đạt", async () => {
    const css = fontFaceCss(loadRulebook());
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div data-text="label" style="font-family:'Be Vietnam Pro';font-weight:600;font-size:26px">Daily Hug Bag</div></body></html>`;
    await expect(renderHtml(html, 400, 200, ["Be Vietnam Pro"])).resolves.toBeTruthy();
  });
});
