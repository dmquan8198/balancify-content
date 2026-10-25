import { renameSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { CardsError, completeCards, type PhotoCard } from "../cards/cards";
import { loadRulebook } from "../rulebook/load";
import { parseOrUsage, readJson as readJsonWith, registerKnownError, runCli, UsageError } from "./run";

registerKnownError(CardsError);
const readJson = (file: string) => readJsonWith(file, (m) => new CardsError(m));

const USAGE = "Cách dùng: npm run cards -- --file <cards.json>";
const mark = (ok: boolean | undefined) => (ok ? "✓" : "✗");


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
