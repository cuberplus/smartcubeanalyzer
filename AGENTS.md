# Working in this repo

## Lines of code

Production code is kept flat or shrinking. A feature that adds lines should pay
for them by simplifying something else. **Tests are exempt** — never trade test
coverage for line count. Measure before and after:

```powershell
(Get-ChildItem src -Recurse -Include *.ts,*.tsx,*.js,*.css -File |
  Where-Object { $_.FullName -notmatch '\\tests\\|__mocks__' } |
  Get-Content | Measure-Object -Line).Lines
```

## Releasing

Bump `APP_VERSION` in `src/Helpers/Version.ts` by hand before every deploy — it
is shown at the bottom of the page and is how a release is confirmed live. Then
commit, push to `master`, and `npm run deploy` (publishes `build/` to
`gh-pages`, serving https://cuberplus.com/smartcubeanalyzer/).

## Checks

`npm test` (plain jest), `npx tsc --noEmit`, `npx eslint src`, `npm run build`.
`any` and `unknown` are both banned by lint. jest-dom matchers are NOT set up,
so use `getAttribute()` / `textContent`; component tests need a
`/** @jest-environment jsdom */` docblock. `ChartPerformance.test.tsx` enforces
load-time budgets — lower them after a speedup so the gain cannot regress.
