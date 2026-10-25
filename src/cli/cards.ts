import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { CardsError, completeCards, type PhotoCard } from "../cards/cards";
import { loadRulebook } from "../rulebook/load";
import { parseOrUsage, registerKnownError, runCli, UsageError } from "./run";

registerKnownError(CardsError);

const USAGE = "Cách dùng: npm run cards -- --file <cards.json>";
const mark = (ok: boolean | undefined) => (ok ? "✓" : "✗");

function readJson(file: string): unknown {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    throw new CardsError(`Không đọc được ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new CardsError(`Không đọc được ${file}: JSON không hợp lệ (${e instanceof Error ? e.message : String(e)})`);
  }
}

await runCli(USAGE, async () => {
  const { values } = parseOrUsage(() => parseArgs({ options: { file: { type: "string" } } }));
  if (!values.file) throw new UsageError("");
  const input = readJson(values.file) as PhotoCard[];
  const { cards, issues } = await completeCards(input, loadRulebook());
  const tmp = `${values.file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(cards, null, 2));
  renameSync(tmp, values.file);
  cards.forEach((c, i) =>
    typeof c?.file === "string" &&
    console.log(`${i + 1}. ${basename(c.file)} — ${c.colorway ?? "không rõ colorway"}, ${c.kind}, ${c.quality}, Feed ${mark(c.fits?.feed)} Story ${mark(c.fits?.story)}`),
  );
  for (const issue of issues) console.log(`Lỗi thẻ ${basename(String(issue.file))}: ${issue.message}`);
  return issues.length === 0 ? 0 : 1;
});
