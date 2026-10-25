import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { completeCards, type PhotoCard } from "../src/cards/cards";
import { loadRulebook } from "../src/rulebook/load";

const rb = loadRulebook();

async function photo(dir: string, name: string, w: number, h: number) {
  const file = join(dir, name);
  writeFileSync(file, await sharp({ create: { width: w, height: h, channels: 3, background: "#777" } }).jpeg().toBuffer());
  return file;
}

const card = (file: string, over: Partial<PhotoCard> = {}): PhotoCard => ({
  file,
  colorway: "Easy Mint",
  kind: "flatlay",
  person: false,
  quality: "ok",
  focus: { x: 0.5, y: 0.5 },
  note: "",
  ...over,
});

describe("completeCards", () => {
  it("chuẩn hoá colorway và tính fits từ kích thước thật", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cards-"));
    const big = await photo(dir, "big.jpg", 3024, 4032);
    const wide = await photo(dir, "wide.jpg", 1920, 1080);
    const { cards, issues } = await completeCards([card(big), card(wide, { colorway: null })], rb);
    expect(issues).toEqual([]);
    expect(cards[0]).toMatchObject({ colorway: "easy mint", fits: { feed: true, story: true } });
    expect(cards[1]).toMatchObject({ colorway: null, fits: { feed: false, story: false } });
  });

  it("báo lỗi rõ cho từng trường sai", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cards-"));
    const big = await photo(dir, "big.jpg", 3024, 4032);
    const bad = card(big, {
      colorway: "hot red",
      kind: "studio" as PhotoCard["kind"],
      quality: "dep" as PhotoCard["quality"],
      focus: { x: 2, y: Number.NaN },
    });
    const { issues } = await completeCards([bad, card(join(dir, "khong-co.jpg"))], rb);
    const messages = issues.map((i) => i.message).join("\n");
    expect(messages).toMatch(/hot red/);
    expect(messages).toMatch(/kind/);
    expect(messages).toMatch(/quality/);
    expect(messages).toMatch(/focus/);
    expect(messages).toMatch(/Không tìm thấy/);
  });

  it("không giữ fits viết tay: xoá trước khi đo, đọc lỗi thì để trống", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cards-"));
    const wide = await photo(dir, "wide.jpg", 1920, 1080);
    const corrupt = join(dir, "c.jpg");
    writeFileSync(corrupt, "notajpeg");
    const lie = { feed: true, story: true };
    const { cards, issues } = await completeCards([card(wide, { fits: lie }), card(corrupt, { fits: lie })], rb);
    expect(cards[0].fits).toEqual({ feed: false, story: false });
    expect(cards[1].fits).toBeUndefined();
    expect(issues.length).toBeGreaterThan(0);
  });

  it("thẻ không có file chuỗi thì báo lỗi, không ném", async () => {
    const { issues } = await completeCards([{ colorway: "easy mint" } as unknown as PhotoCard], rb);
    expect(issues.map((i) => i.message).join("\n")).toMatch(/file/);
  });
});
