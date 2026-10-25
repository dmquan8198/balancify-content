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
