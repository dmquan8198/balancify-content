export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new Error(`Màu hex không hợp lệ (cần dạng #RRGGBB): ${hex}`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function parseCssColor(css: string): Rgb {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Không đọc được màu CSS: ${css}`);
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  const [r, g, b] = parts.slice(0, 3).map(Number);
  if (![r, g, b].every(Number.isFinite)) throw new Error(`Màu CSS có thành phần không phải số (${css}).`);
  if (parts.length >= 4) {
    const alpha = Number(parts[3]);
    if (!Number.isFinite(alpha) || alpha < 1) {
      throw new Error(`Màu CSS có độ trong suốt (${css}) — không kiểm tra tương phản được.`);
    }
  }
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
