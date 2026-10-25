# balancify-content — agent notes

- Spec: `docs/superpowers/specs/2026-10-25-instagram-content-system-design.md`. Plans: `docs/superpowers/plans/`.
- Commands: `npm test`, `npm run typecheck`, `npm run f1 -- --photo <file> --colorway "<name>"`, `npm run golden:update` (only after a deliberate layout change; inspect the new PNGs before committing).
- Never commit brand photos or Drive downloads. `.gitignore` blocks images except `tests/golden/*.png`.
- `rulebook/*.yaml` encodes decisions the user approved. Change it only when the user asks, and say what changed.
- Everything user-facing (copy, CLI output, reports) is Vietnamese. Run copy through `lintText` before showing it.
- Playwright: use `playwright-core` (pinned 1.63.0 to match the browsers in `/opt/pw-browsers`). Do not run `playwright install`.
