import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { PhotoCard } from "../cards/cards";
import { PlanError, type PostPlan } from "../post/plan";
import { checkPlan, runPost } from "../post/run";
import { parseOrUsage, registerKnownError, runCli, UsageError } from "./run";

const USAGE = "Cách dùng: npm run post -- --plan <plan.json> [--cards <cards.json>] (--check | --out <thư mục>)";

registerKnownError(PlanError);

await runCli(USAGE, async () => {
  const { values } = parseOrUsage(() =>
    parseArgs({ options: { plan: { type: "string" }, cards: { type: "string" }, out: { type: "string" }, check: { type: "boolean", default: false } } }),
  );
  if (!values.plan || (!values.check && !values.out)) throw new UsageError("");
  const plan = JSON.parse(readFileSync(values.plan, "utf8")) as PostPlan;
  const cards = values.cards ? (JSON.parse(readFileSync(values.cards, "utf8")) as PhotoCard[]) : [];

  if (values.check) {
    const warnings = checkPlan(plan, cards);
    for (const w of warnings) console.log(`Cảnh báo: ${w.message}`);
    console.log("Kế hoạch hợp lệ.");
    return 0;
  }

  const r = await runPost(plan, values.out!, cards);
  console.log(`Gói duyệt: ${r.reviewFile}`);
  console.log(`Ảnh xem nhanh: ${r.previewFile}`);
  console.log(`Caption: ${r.captionFile}`);
  for (const w of r.warnings) console.log(`Cảnh báo: ${w.message}`);
  console.log(r.ok ? "KẾT QUẢ: ĐẠT" : "KẾT QUẢ: CÓ LỖI");
  return r.ok ? 0 : 1;
});
