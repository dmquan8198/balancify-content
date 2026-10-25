import { parseArgs } from "node:util";
import type { PhotoCard } from "../cards/cards";
import { PlanError, type PostPlan } from "../post/plan";
import { checkPlan, runPost } from "../post/run";
import { assertOutsideRepo, OutsideRepoError } from "./paths";
import { parseOrUsage, readJson as readJsonWith, registerKnownError, runCli, UsageError } from "./run";

const USAGE = "Cách dùng: npm run post -- --plan <plan.json> --cards <cards.json> (--check | --out <thư mục>)";

registerKnownError(PlanError);
const readJson = (file: string) => readJsonWith(file, (m) => new PlanError(m));
registerKnownError(OutsideRepoError);


await runCli(USAGE, async () => {
  const { values } = parseOrUsage(() =>
    parseArgs({ options: { plan: { type: "string" }, cards: { type: "string" }, out: { type: "string" }, check: { type: "boolean", default: false } } }),
  );
  if (!values.plan || !values.cards || (!values.check && !values.out)) throw new UsageError("");
  if (values.check && values.out) throw new UsageError("Chỉ dùng một trong hai: --check hoặc --out.");
  if (values.out) assertOutsideRepo(values.out);
  const plan = readJson(values.plan) as PostPlan;
  const cards = readJson(values.cards) as PhotoCard[];
  if (!Array.isArray(cards)) throw new PlanError(`Không đọc được ${values.cards}: phải là một danh sách thẻ ảnh.`);

  if (values.check) {
    const warnings = await checkPlan(plan, cards);
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
