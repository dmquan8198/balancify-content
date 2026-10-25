import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import sharp from "sharp";

/** A pixel counts as changed when any channel differs by more than this (0–255). */
export const CHANGED_PIXEL_DIFF = 32;
/** Images match when at most this share of pixels changed (0.05%). */
export const MAX_CHANGED_SHARE = 0.0005;

export interface ImageComparison {
  same: boolean;
  changed: number;
  total: number;
  changedShare: number;
}

export async function compareImages(a: Buffer, b: Buffer): Promise<ImageComparison> {
  const ra = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rb = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height || ra.info.channels !== rb.info.channels) {
    return { same: false, changed: Infinity, total: 0, changedShare: Infinity };
  }
  const ch = ra.info.channels;
  const total = ra.info.width * ra.info.height;
  let changed = 0;
  for (let p = 0; p < total; p++) {
    for (let c = 0; c < ch; c++) {
      const i = p * ch + c;
      if (Math.abs(ra.data[i] - rb.data[i]) > CHANGED_PIXEL_DIFF) {
        changed++;
        break;
      }
    }
  }
  const changedShare = changed / total;
  return { same: changedShare <= MAX_CHANGED_SHARE, changed, total, changedShare };
}

/** Compares `actual` with the golden file; writes it instead only when `update` is set. */
export async function checkGolden(actual: Buffer, goldenPath: string, update: boolean): Promise<{ ok: boolean; message: string }> {
  const name = basename(goldenPath);
  if (update) {
    mkdirSync(dirname(goldenPath), { recursive: true });
    writeFileSync(goldenPath, actual);
    return { ok: true, message: `${name}: đã ghi ảnh chuẩn mới` };
  }
  if (!existsSync(goldenPath)) {
    return { ok: false, message: `${name}: chưa có ảnh chuẩn — chạy \`npm run golden:update\` rồi xem ảnh trước khi commit.` };
  }
  const cmp = await compareImages(actual, readFileSync(goldenPath));
  return { ok: cmp.same, message: `${name}: ${cmp.changed} điểm ảnh khác (${(cmp.changedShare * 100).toFixed(3)}%)` };
}
