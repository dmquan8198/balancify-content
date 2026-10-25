import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { completeCards, type PhotoCard } from "../cards/cards";
import { loadRulebook } from "../rulebook/load";
import { parseOrUsage, runCli, UsageError } from "./run";

const USAGE = "Cách dùng: npm run cards -- --file <cards.json>";
const mark = (ok: boolean | undefined) => (ok ? "✓" : "✗");

await runCli(USAGE, async () => {
  const { values } = parseOrUsage(() => parseArgs({ options: { file: { type: "string" } } }));
  if (!values.file) throw new UsageError("");
  const input = JSON.parse(readFileSync(values.file, "utf8")) as PhotoCard[];
  const { cards, issues } = await completeCards(input, loadRulebook());
  writeFileSync(values.file, JSON.stringify(cards, null, 2));
  cards.forEach((c, i) =>
    console.log(`${i + 1}. ${basename(c.file)} — ${c.colorway ?? "không rõ colorway"}, ${c.kind}, ${c.quality}, Feed ${mark(c.fits?.feed)} Story ${mark(c.fits?.story)}`),
  );
  for (const issue of issues) console.log(`Lỗi thẻ ${basename(issue.file)}: ${issue.message}`);
  return issues.length === 0 ? 0 : 1;
});
