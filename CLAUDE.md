# CLAUDE.md

## What this project is

Mobile-first PWA for shift inventory management at a small bakery (~2 locations, ~10 staff). Staff use it on their phones each shift to count stock, track sales, count cash, and hand over to the next shift. Data is written to a shared Google Sheet.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Single `index.html` — React 18 via CDN + Babel standalone (no build step) |
| Auth | Google Identity Services (GIS) — client-side sign-in, tokeninfo verify |
| CORS proxy | Cloudflare Worker (`https://quanlycuahang.tdtri281090.workers.dev`) |
| Backend | Google Apps Script web app (`Code.gs`) |
| Database | Google Sheets — sheets: `binh_tan`, `quan_6`, `san_pham`, `users`, `debug_log` |
| Hosting | GitHub Pages (`https://tranductri.github.io/quanlycuahang/`) |
| Offline | PWA: `manifest.json` + `sw.js` (cache-first) |

## Deploy workflow

**Frontend** — push to `main`, GitHub Pages deploys automatically:
```bash
git add index.html sw.js && git commit -m "..." && git push
```
Always bump the cache version in `sw.js` (`kiem-ke-ca-vN`) when deploying changes to `index.html`.

**Backend (Code.gs)** — ALWAYS use `--deploymentId`, never `clasp deploy` alone:
```bash
clasp push --force
clasp deploy --deploymentId AKfycby42dT2SZJ8vGE4Ogk4UUQrodeNTtBFLKluCpflM1jletffFLXbfHXuiID8W90uqoHjpA --description "vN: description"
```

**Cloudflare Worker** — edit via dashboard at dash.cloudflare.com → Workers & Pages → quanlycuahang. Source at `docs/cloudflare-worker.js`.

**Adding a new employee:**
1. Add email to sheet `users` column A
2. Add email to Google Cloud Console → OAuth consent screen → Test users (only while app is in testing mode)

## IDs and endpoints

| Resource | Value |
|---|---|
| GAS_URL (in index.html) | `https://quanlycuahang.tdtri281090.workers.dev` |
| GAS deployment ID | `AKfycby42dT2SZJ8vGE4Ogk4UUQrodeNTtBFLKluCpflM1jletffFLXbfHXuiID8W90uqoHjpA` |
| GAS script ID (.clasp.json) | `1FGxOrncPdgTdjNt6P_MwEeqkNO-0_tH4mj2O458YifgauKitkj9ft02J` |
| Spreadsheet ID | `1EfEAvuYPyf3GWVbi7egfR6SI3riNKPsCiVW0OFZLpg8` |
| GIS OAuth client ID | `570458211298-ogrk61hf89ou38l8q6lt9pba0qi2p969.apps.googleusercontent.com` |

## Architecture

### Request flow

```
Browser → Cloudflare Worker → GAS doGet/doPost → Google Sheets
Browser → oauth2.googleapis.com/tokeninfo (direct, CORS-safe)
```

All GAS calls (read + write) go through the Cloudflare Worker. The Worker adds CORS headers on the response. Browser never calls GAS or Google Sheets directly except for tokeninfo.

### Frontend (`index.html`)

Single-file React app. Two top-level components:
- `App` — handles auth state only. Renders `<Login>` or `<AppContent>`.
- `AppContent` — all app logic. State persisted to `localStorage` (key `ca_v2`).

Screen routing is a `screen` string state — no router.

**Screen flow:**
```
Hub → DauCa → Hub
    → TienDau → Hub
    → TrongCa → Hub
    → CuoiCa → Hub
    → TienCuoi → GiaoCa → submit → Hub (reset)
```

**Key state shape (`ca_v2`):**
```js
{
  ngay, vi_tri, ten,          // ten auto-synced from authUser.name
  dau_ca_done: bool,
  products: [ { dau_h1, dau_h2, dau_kho, dau_cu,
                xuat, nhap, hu, km,
                cuoi_kho, cuoi_hop, cuoi_thuc } ],  // indexed by allProducts position (p.idx)
  tien_dau:  { 500000: n, … },
  tien_cuoi: { … },
  cat_dt:    { … },
  chi_phi, dt_nh, ghi_chu
}
```

**Product indexing (critical):**
- `allProducts` — full list from `san_pham` sheet, all locations
- `data.products` — indexed by `p.idx` (position in allProducts)
- `locationProducts` — filtered for current location, has both `idx` and `locIdx`
- `prevData` — from GAS `lastShift`, indexed by `p.locIdx`
- Never mix `idx` and `locIdx` — they point to different arrays

**Auth state (`ca_auth` in localStorage):**
```js
{ email, name, picture }  // from Google tokeninfo
```
Whitelist is in Google Sheet `users` col A — fetched at login time via GAS.

**`computePredicted(v)`** = `dau_h1 + dau_h2 + dau_kho + dau_cu + nhap - xuat - hu - km`

**Submit** — POST to Cloudflare Worker with `Content-Type: application/json`. Worker forwards to GAS. Response JSON `{success, message/error}`.

### Backend (`Code.gs`)

**`doGet` actions:**
- `?action=getProducts` — returns all products with location flags
- `?action=lastShift&vi_tri=...` — returns last row of location sheet
- `?action=getUsers` — returns email list from `users` sheet

**`doPost`** — appends one row to `binh_tan` or `quan_6` sheet, then writes to `debug_log`.

**Performance:**
- Spreadsheet opened once per execution via `getSpreadsheet()`
- `san_pham` rows cached via `CacheService` (6h TTL, key `san_pham_rows`)
- To bust cache manually: clear via GAS console or wait 6h

**Sheet columns (binh_tan / quan_6):**
Timestamp, Ngày, Vị trí, Tên → per product (×N, 13 cols each): Đầu H1/H2/Kho/Hộp, Xuất, Nhập, Hư, KM, Cuối TT, Dự kiến, Lệch, Tiêu thụ, Doanh thu → 9×ĐC + 9×CC + 9×CấtDT (denomination counts) → Tổng ĐC, Tổng CC, Chi phí, DT NH, Tổng DT, Lệch tiền, Tổng cất, Còn lại, Người giao, Người nhận, Ghi chú

**`debug_log` sheet:** Timestamp, Action, Status, Vị trí, Ngày, Tên, Tổng DT, Chi phí, DT NH, Lệch tiền, Ghi chú, Error, Raw payload (5000 char max). Written on every doPost and doGet:lastShift.

### PWA (`sw.js`)

Cache-first. Pre-caches `index.html`, `manifest.json`, icons, React/ReactDOM/Babel CDN bundles.
Never intercepts `script.google.com` or `workers.dev` calls — always network.
Cache version: `kiem-ke-ca-vN`. Bump N on every frontend deploy to force update on existing installs.
Update flow: SW installs silently → banner appears → user taps "Tải lại" → app sends `SKIP_WAITING` → page reloads.

## Critical constraints

**GAS:**
- `SpreadsheetApp.openById()` required — standalone script, `getActiveSpreadsheet()` returns null
- `oauthScopes` must be declared in `appsscript.json` — not auto-granted in web app context
- `clasp deploy` without `--deploymentId` creates a NEW deployment that requires manual GAS console re-authorization (shows as CORS error). Always use the fixed deployment ID.
- `clasp push` will upload ALL `.js` files in the directory unless excluded in `.claspignore`. `sw.js`, `manifest.json`, `icon-*.png`, `docs/**` are already excluded.

**CORS:**
- GAS web app 302 redirects lack CORS headers — direct browser→GAS POST fails. All writes go via Cloudflare Worker.
- `Content-Type: application/json` on a POST triggers a CORS preflight. Worker handles OPTIONS correctly.
- `tokeninfo` endpoint is CORS-safe — called directly from browser, no proxy needed.

**Auth:**
- OAuth app is in **testing mode** — only emails in Google Cloud Console "Test users" list can complete login
- To add a user: (1) add email to sheet `users`, (2) add to GCP Test users
- To remove testing restriction: publish app in OAuth consent screen → "Publish App"
- Session stored in `localStorage` (`ca_auth`) — no expiry, logout is manual
- `authUser.name` is the Google display name, auto-synced into `data.ten` on mount

**Frontend:**
- No build step — Babel transpiles JSX in the browser. Cold parse adds ~1-2s on first load.
- React hooks rules apply strictly: no hooks after conditional returns. Auth gate uses two separate components (`App` + `AppContent`).
- `data.products` array length must match `allProducts.length`. On product list change, `AppContent` migrates saved state preserving existing values.

**Performance:**
- GAS cold start: ~2-4s after inactivity — unavoidable on free tier
- `san_pham` cache: if products are updated in Sheet, GAS serves stale data for up to 6h
