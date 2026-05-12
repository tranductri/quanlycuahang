# Report UI — shadcn/ui + Tailwind CSS Design

**Date:** 2026-05-12
**Status:** Approved
**Scope:** Design system and component mapping for `report.html` — the manager-facing reporting dashboard.

---

## 1. Goals

- Use shadcn/ui + Tailwind CSS for the reporting dashboard UI.
- AI-friendly: components live in-repo, fully editable, no hidden abstractions.
- Keep the staff PWA (`index.html`) completely unchanged.

---

## 2. Project Structure

`report.html` becomes a Vite React app in a `report/` subdirectory. It is built separately and deployed alongside the static PWA on GitHub Pages.

```
project root/
├── index.html          (staff PWA — CDN React, no changes ever)
├── sw.js
├── manifest.json
├── icon-*.png
├── report/             (Vite React app — manager dashboard)
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── ui/         (shadcn generated components)
│   │       ├── Dashboard.jsx
│   │       ├── ProductRevenue.jsx
│   │       ├── ShiftsTable.jsx
│   │       └── CashDiscrepancy.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── worker/
│   ├── wrangler.toml
│   └── index.js
└── supabase/
    ├── schema.sql
    └── seed.sql
```

GitHub Pages serves `index.html` at `/` and `report/dist/index.html` at `/report/` from the same repo.

---

## 3. Setup

```bash
npm create vite@latest report -- --template react
cd report
npm install -D tailwindcss @tailwindcss/vite
npm install @supabase/supabase-js
npx shadcn@latest init
```

shadcn init options: style `default`, base color `zinc`, CSS variables `yes`.

---

## 4. Component Mapping

| UI Element | shadcn/ui Component | Notes |
|---|---|---|
| Date range filter | `DatePickerWithRange` | Uses `react-day-picker` |
| Location dropdown | `Select` | Options from Supabase `locations` table |
| Apply button | `Button` | Triggers data refetch |
| Summary cards (4×) | `Card`, `CardHeader`, `CardContent` | Responsive CSS grid |
| Revenue table | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` | |
| Revenue bar | `Progress` | Width = `revenue / maxRevenue * 100%` |
| Shifts table | `Table` + `Badge` | `Badge` for location name |
| Cash diff highlight | `Table` + `cn()` | `cn('bg-red-50 text-red-700')` on rows where `Math.abs(cash_diff) > 50000` |
| Section wrappers | `Card` | One `Card` per report section |
| Google sign-in screen | `Card` + `Button` | Centered, matches GIS flow from `index.html` |
| Loading states | `Skeleton` | Replaces cards and table rows while fetching |

---

## 5. Layout

Single page, scroll-based (no tabs). All three report sections are always visible below the filter bar.

```
┌─────────────────────────────────────────┐
│  [Date range]   [Location]   [Apply]    │
├─────────────────────────────────────────┤
│  Card: Total Sales │ Expenses │ Avg     │
│  Cash Diff         │ Shifts   │         │
├─────────────────────────────────────────┤
│  Card: Revenue by Product               │
│  Table + Progress bars                  │
├─────────────────────────────────────────┤
│  Card: Shifts                           │
│  Table with Badge for location          │
├─────────────────────────────────────────┤
│  Card: Cash Discrepancy                 │
│  Table, red rows for  > 50,000đ diff    │
└─────────────────────────────────────────┘
```

---

## 6. Auth

Same Google GIS flow as `index.html`. On mount, check `localStorage` for `ca_auth`. If missing, render a centered `Card` with a Google Sign-In `Button`. After sign-in, verify email against Supabase `users` table before rendering the dashboard.

---

## 7. Data Layer

No changes from the existing backend migration spec. The `report/` app uses the Supabase JS client (`@supabase/supabase-js`) with the anon key and the same queries defined in `2026-05-12-backend-migration-supabase-design.md` Section 4.3.

---

## 8. Deployment

```bash
cd report
npm run build        # outputs to report/dist/
```

`vite.config.js` sets `base: '/report/'` so all asset paths are correct under the GitHub Pages subpath. The `report/dist/` directory is committed to the repo and served by GitHub Pages.

Add to `.gitignore`: `report/node_modules/`. Do NOT ignore `report/dist/` — it must be committed for GitHub Pages.
