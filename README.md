# TurboBudget

A personal budgeting app that runs entirely in your browser: accounts, subscriptions, debts, interest, taxes, a history timeline and a lot of graphs. There is no server and no account. **Your data never leaves your device**; it is stored in `localStorage` and in `.db` files (JSON) you export yourself.

Built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui and Recharts.

## Features

- **Accounts** – add and edit transactions in popups (income, deposit, spend, transfer between accounts), categories, search, sortable columns (the undated "unaccounted" amounts sort with everything else), undo on delete. Set an account's current balance and optionally **lock** it.
- **Subscriptions** – recurring payments from daily to every 2 years (or custom), yours, someone else's, or a loan with a person, with per-item rounding.
- **Debts** – money you owe and money owed to you, repayment history, and loans taken off your income automatically (an NZ student loan preset: 12% above $24,128 a year). Mark a debt as **stale** when it is no longer a concern: it stays on record but leaves the totals and graphs.
- **Interest** – account interest rules and an interest / RWT calculator. Defaults to monthly; switch to yearly in Settings.
- **Taxes** – tax rules for interest (e.g. RWT) and income.
- **History** – a timeline that overlays subscription payments, interest, tax and loan deductions on an account's transactions with a running balance.
- **Graphs** – filter by account. Category and spending breakdowns, income vs spending, net saved per month, category trends, weekday spending, balance per account, balance projection, subscription costs, debt by person, debt progress and payoff projection. Charts follow the selected UI style.
- **Settings** – exchange rates, default RWT, interest basis (monthly / yearly), appearance, wallpaper, people and categories.

### Appearance

The look comes from the `turbothemes` package in the [turboengine](https://github.com/TurboNZL/turboengine) repository (`themes/`; the old turbothemes repository is retired): 33 UI styles and 67 colour palettes (plus "Match this device" and "System"), in any combination, with a framed live preview and an optional wallpaper. Themes are plain JSON and CSS in `themes/`, and the app checks it in the background (at most every six hours) and picks up new or fixed themes without a TurboBudget update. Settings > Appearance shows which set is in use and can check now or go back to the built-in set.

- The engine is started in `src/lib/themes.ts`; `tailwind.config.ts` points the shadcn colour names at the variables the palettes set, and the primitives in `src/components/ui` carry turbothemes' hook classes (`.btn`, `.input`, `.card`, `.bt-window`, `.bt-menu` ...). See turboengine's `themes/docs/CONTRACT.md`.
- Chart colours are derived from the palette's accent in `src/lib/themes.ts`.
- Only the theme files are fetched from GitHub. Fonts for a style are loaded from jsDelivr when that style is used; offline, the system fonts are used instead.
- Update the engine itself with `pnpm add "github:TurboNZL/turboengine#<commit>&path:/themes"`; theme changes never need it.

## Privacy

- No analytics, no API keys, no backend, and no network request ever carries your data. The only outgoing requests are for the look: theme files from GitHub and style fonts from jsDelivr (set `source: false` and `fonts: "none"` in `src/lib/themes.ts` to stop both).
- Anything you enter lives in your browser's `localStorage`. Clearing site data removes it, so export a `.db` file for backups.
- `.db` exports contain your financial data. Keep them out of public repositories.

## Development

```sh
pnpm install
pnpm dev      # http://localhost:8080
pnpm build    # production build in dist/
pnpm lint
```

## Deploying to GitHub Pages

Set Settings → Pages → Source to "GitHub Actions"; `.github/workflows/deploy.yml` builds and deploys on push to `main`. The app uses a hash router and relative asset paths, so it works under any repo sub-path.

## Contributing

Issues and pull requests are welcome. Please never attach a real `.db` export; make a small fake one instead.

## License

[MIT](LICENSE)
