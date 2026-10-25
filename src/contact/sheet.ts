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
const MAX_ITEMS = 600;

export class SheetError extends Error {}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Writes a JPEG grid of thumbnails, each with a numbered label strip underneath. */
export async function contactSheet(items: SheetItem[], outPath: string, opts: SheetOptions = { cell: 360, cols: 4 }): Promise<void> {
  if (items.length === 0) throw new Error("Danh sách ảnh rỗng — không có gì để xếp bảng.");
  if (items.length > MAX_ITEMS) throw new SheetError(`Quá nhiều ảnh cho một bảng (${items.length} > ${MAX_ITEMS}) — chia nhỏ thư mục.`);
  const { cell, cols } = opts;
  const rows = Math.ceil(items.length / cols);

  const tiles = await Promise.all(
    items.map(async (item, i) => {
      let thumb: Buffer;
      try {
        thumb = await sharp(item.file).rotate().resize(cell, cell, { fit: "contain", background: "#ffffff" }).png().toBuffer();
      } catch (e) {
        throw new SheetError(`Không đọc được ảnh ${item.file}: ${e instanceof Error ? e.message : String(e)}`);
      }
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
