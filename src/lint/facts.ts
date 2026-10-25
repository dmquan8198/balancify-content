/**
 * Numeric product claims (price, weight, size) in free text. Spec §8: a caption may only state
 * numbers that also appear in rulebook brand.product_facts. Plain counts ("20 chiếc", "80%")
 * carry no unit from the list below and are not claims.
 */
export interface Claim {
  /** The text as written, e.g. "460k". */
  match: string;
  /** Normalised kind and value, e.g. "money:460000" (VND), "weight:200" (gram), "size:14" (inch). */
  key: string;
}

const NUM = String.raw`\d{1,3}(?:[.,]\d{3})+(?![.,]?\d)|\d+(?:[.,]\d+)?`;
const UNIT = String.raw`triệu|tr|nghìn|ngàn|vnđ|vnd|đồng|đ|₫|kg|gram|gam|gr|g|k|inches|inch|["”″]`;
const CLAIM = new RegExp(
  String.raw`(?<![\p{L}\p{N}.,])(?<num>${NUM})(?<sp>\s?)(?<unit>${UNIT})(?<tail>(?<=tr)\d{1,3})?(?![\p{L}\p{N}])`,
  "giu",
);

const MONEY: Record<string, number> = { "triệu": 1e6, tr: 1e6, "nghìn": 1e3, "ngàn": 1e3, k: 1e3, "vnđ": 1, vnd: 1, "đồng": 1, "đ": 1, "₫": 1 };
const WEIGHT: Record<string, number> = { kg: 1000, gram: 1, gam: 1, gr: 1, g: 1 };
const QUOTES = new Set(['"', "”", "″"]);

function parseNumber(raw: string): number {
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) return Number(raw.replace(/[.,]/g, ""));
  return Number(raw.replace(",", "."));
}

export function extractClaims(input: string): Claim[] {
  const claims: Claim[] = [];
  for (const m of input.normalize("NFC").matchAll(CLAIM)) {
    const { num, sp, unit, tail } = m.groups!;
    const u = unit.toLowerCase();
    if (QUOTES.has(u) && sp) continue; // `14 "` is a quotation mark, not an inch mark
    const n = parseNumber(num);
    let key: string;
    if (u in MONEY) {
      const extra = tail ? Number(tail.padEnd(3, "0")) * 1e3 : 0;
      key = `money:${Math.round(n * MONEY[u] + extra)}`;
    } else if (u in WEIGHT) key = `weight:${Math.round(n * WEIGHT[u])}`;
    else key = `size:${n}`;
    claims.push({ match: m[0], key });
  }
  return claims;
}

/** Claims in `text` whose value does not appear in any of `facts`. */
export function unsupportedClaims(text: string, facts: string[]): Claim[] {
  const allowed = new Set(facts.flatMap((f) => extractClaims(f).map((c) => c.key)));
  return extractClaims(text).filter((c) => !allowed.has(c.key));
}
