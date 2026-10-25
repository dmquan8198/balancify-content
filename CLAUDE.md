# balancify-content — agent notes

- Spec: `docs/superpowers/specs/2026-10-25-instagram-content-system-design.md`. Plans: `docs/superpowers/plans/`.
- Commands: `npm test`, `npm run typecheck`, `npm run f1 -- --photo <file> --colorway "<name>"`, `npm run golden:update` (only after a deliberate layout change; inspect the new PNGs before committing).
- Never commit brand photos or Drive downloads. `.gitignore` blocks images except `tests/golden/*.png`.
- Download Drive files to a scratch directory outside the repo (never into the repo), then pass that local path to `--photo`. HEIC is not supported; ask for JPEG.
- `npm run f1` writes `f1-<slug>-feed.png`, `f1-<slug>-story.png` and `report-<slug>.json` to `--out` (default `out/`), replacing that colorway's previous results. Exit codes: 0 pass, 1 check failures or known errors (photo, rulebook, font, colorway), 2 usage error.
- `rulebook/*.yaml` encodes decisions the user approved. Change it only when the user asks, and say what changed.
- Everything user-facing (copy, CLI output, reports) is Vietnamese. Run copy through `lintText` before showing it.
- Playwright: use `playwright-core` (pinned 1.63.0 to match the browsers in `/opt/pw-browsers`). Do not run `playwright install`.
