# TurboBudget: project handoff

Read this first. It is the running state and decision log: update it whenever a decision or the state changes.

## Engine
This app is pinned to TurboNZL/turboengine (see `.turboengine.json`). The engine is a **reference, not a dependency**, with one exception: the theme package (`turboengine/themes`, npm name `turbothemes`) is installed through `package.json` as `github:TurboNZL/turboengine#<commit>&path:/themes`. The old `TurboNZL/turbothemes` repository is retired; do not point anything at it. Before building something every app would want, look in the engine's `modules/` first. If you improve something that came from it, say so in the session log so it can be ported back.

Taking a newer engine is deliberate: change the commit in `package.json`, run `pnpm install`, check the picker and a few UI styles, then update `engine.ref` in `.turboengine.json`. Themes themselves update at run time from `themes/dist` on turboengine `main`, with no app release.

## User preferences (how to work with them)
- Don't waste their usage. Fact-check and double-check yourself; use web search liberally.
- They write casually; reply in normal capitalised prose.
- Put effort into verifying against real runs, not only unit tests.
- A merged PR cannot take new work: restart the branch from main for follow-up changes. Commit trailers as the harness gives them.

## Decisions made (don't re-ask)
| Topic | Decision |
|---|---|
| Engine modules | Browser-only app: only the themes are used. The updaters, window-frame, editions, android-shell and release-pipeline modules do not apply (no Electron, no server, no Android). |
| Theme glue | `src/lib/themes.ts` (starts the engine, `storagePrefix: turbobudget`, chart colours) and `AppearanceCard.tsx`; layouts are not used. |
| Name | **TurboBudget** (the repository's name; it was BudgetTrack until 2026-10-20). Part of the TurboSuite site's apps. Every identifier changed (title, header, storage keys `turbobudget-*`, the engine prefix `turbobudget.*`, export file names `turbobudget-<date>.db`). Importing a `.db` never depended on its file name, so old `budget-track-*.db` exports still import. |
| Old data | `src/lib/legacyNames.ts` (imported first in `main.tsx`, tested in `legacyNames.test.ts`) copies every `budget-track*` localStorage key to its `turbobudget*` name once and removes the old one; a key that already exists under the new name wins. **Delete it, its import and its test once every device has run this version.** localStorage is per address: moving the app to a new web address (the TurboSuite page links https://web.turbobudget.prismalite.org) starts empty there, so use Data > export on the old address and import on the new. |
| Logo | The mark stays the bars (no engine ring or emblem): `brandSvg` draws them on a tile in the theme's colours for the header logo; `public/icon.svg` is the static tile (app icon), `public/apple-touch-icon.png` the same as a PNG. |
| Favicon | **The bars alone, in the current theme's accent, no tile** (`faviconSvg` in `lib/brand.ts`, re-applied by `syncApp` on every look change), so the tab changes colour with the look. The engine's rule: anything 48 px or smaller is the symbol, not the full mark. `public/favicon.svg` and `favicon.ico` are the same bars in a neutral blue for the first paint, for browsers that ignore data-URI icons and for the address-bar history. |

## Session log
- Moved the `turbothemes` dependency from the retired turbothemes repository to turboengine `themes/` (commit pinned in `package.json`, lockfile resolves through codeload so CI can fetch it), added `.turboengine.json`, this file, and updated the wording that named the old repository.
- 2026-10-20: renamed BudgetTrack to TurboBudget with a tested storage shim, made the favicon the bars alone in the theme's accent, added vitest (`pnpm test`) and `"license": "MIT"` / `"name": "turbobudget"` to package.json. Checked in a real Chromium: a browser holding only `budget-track*` keys (3 accounts, the Graphs tab, the Nord theme) opened the new build with all of it intact under the new names, and the favicon fill moved from #69bcd3 (Nord) to #9048f4 (Dracula). Not done: moving the Cloudflare Pages project (budget-track-d86.pages.dev) to https://web.turbobudget.prismalite.org is the owner's dashboard step; the old address keeps serving until then.
