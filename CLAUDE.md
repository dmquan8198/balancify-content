# balancify-content — agent notes

- Spec: `docs/superpowers/specs/2026-10-25-instagram-content-system-design.md`. Plans: `docs/superpowers/plans/`.
- Commands: `npm test`, `npm run typecheck`, `npm run f1 -- --photo <file> --colorway "<name>"`, `npm run golden:update` (only after a deliberate layout change; inspect the new PNGs before committing).
- Never commit brand photos or Drive downloads. `.gitignore` blocks images except `tests/golden/*.png`.
- Download Drive files to a scratch directory outside the repo (never into the repo), then pass that local path to `--photo`. HEIC is not supported; ask for JPEG.
- `npm run f1` writes `f1-<slug>-feed.png`, `f1-<slug>-story.png` and `report-<slug>.json` to `--out` (default `out/`), replacing that colorway's previous results. Exit codes: 0 pass, 1 check failures or known errors (photo, rulebook, font, colorway), 2 usage error.
- `rulebook/*.yaml` encodes decisions the user approved. Change it only when the user asks, and say what changed.
- Everything user-facing (copy, CLI output, reports) is Vietnamese. Run copy through `lintText` before showing it.
- Playwright: use `playwright-core` (pinned 1.63.0 to match the browsers in `/opt/pw-browsers`). Do not run `playwright install`.
- To make a post, follow `.claude/skills/make-post/SKILL.md` (two user approval gates). Work folders live in your scratchpad under `posts/`, never in the repo.
- Commands: `npm run ingest -- --out <dir> <files...>`, `npm run contact -- --from <photos.json> --out <sheet.jpg>`, `npm run cards -- --file <cards.json>`, `npm run post -- --plan <plan.json> [--cards <cards.json>] (--check | --out <dir>)`. All exit 0 ok / 1 failure / 2 usage. `--check` and `--out` are mutually exclusive.
- `npm run post --out` REPLACES the folder: use a new folder (e.g. `W/out`), never the repo or a folder with other files; photos must not live inside it. Tests and probes must use `mkdtempSync` dirs under `os.tmpdir()` for `--out`, photos, plans and cards.
- Finished images go to the user via SendUserFile; do not upload them to Drive.
