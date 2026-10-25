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
