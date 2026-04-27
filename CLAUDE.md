# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Mobile-first PWA for shift inventory management at a small bakery (~2 locations, ~10 staff). Staff use it on their phones each shift to count stock, track sales, count cash, and hand over to the next shift. Data is written to a shared Google Sheet.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Single `index.html` — React 18 via CDN + Babel standalone (no build step) |
| Backend | Google Apps Script web app (`Code.gs`) |
| Database | Google Sheets (`ca_lam_viec` sheet, spreadsheet ID in `Code.gs`) |
| Hosting | GitHub Pages (`https://tranductri.github.io/quanlycuahang/`) |
| Offline | PWA: `manifest.json` + `sw.js` (cache-first, bypasses GAS API) |

## Deploy workflow

**Frontend** — push to `main`, GitHub Pages deploys automatically:
```bash
git add index.html && git commit -m "..." && git push
```

**Backend (Code.gs)** — uses `clasp` CLI:
```bash
clasp push                                    # push Code.gs + appsscript.json
clasp deploy --description "v5 description"  # new deployment, outputs new URL
# Then update GAS_URL constant in index.html and push
```

The `.clasp.json` links to script ID `1FGxOrncPdgTdjNt6P_MwEeqkNO-0_tH4mj2O458YifgauKitkj9ft02J`.  
Spreadsheet ID: `1EfEAvuYPyf3GWVbi7egfR6SI3riNKPsCiVW0OFZLpg8`.

## Architecture

### Frontend (`index.html`)

Single-file React app. All state lives in the top-level `App` component and is persisted to `localStorage` (key `ca_v2`) on every change. Screen routing is a simple `screen` string state — no router library.

**Screen flow:**
```
Hub → DauCa (hàng) → TienDau (tiền đầu ca) → Hub
    → TrongCa → Hub
    → CuoiCa → Hub
    → TienCuoi → GiaoCa → submit → Hub (reset)
```

**Key state shape:**
```js
{
  ngay, vi_tri, ten,
  products: [ { dau_h1, dau_h2, dau_kho, xuat, nhap, hu, km, cuoi_thuc } × 11 ],
  tien_dau:  { 500000: n, 200000: n, … },   // denomination → count
  tien_cuoi: { … },
  chi_phi, dt_nh,                            // expenses, bank transfer revenue
  nguoi_giao, nguoi_nhan, ghi_chu
}
```

**`dauDone`** (Bước 1 complete) = all products have at least one zone counted **AND** `tienDauTotal > 0`. Both conditions must be met before Bước 2 unlocks.

**`computePredicted(v)`** = `dau_h1 + dau_h2 + dau_kho + nhap - xuat - hu - km`

**Submit** — `fetch(GAS_URL, { method:'POST', body: JSON.stringify(data) })` with no `Content-Type` header (avoids CORS preflight). GAS redirects to an echo URL; the browser follows automatically and returns JSON.

### Backend (`Code.gs`)

`doGet` — returns product list JSON (health check).  
`doPost` — parses JSON body, appends one row to `ca_lam_viec` sheet (creates sheet with headers on first run).

**Sheet columns:** Timestamp, Ngày, Vị trí, Tên → then per product (×11): Đầu H1/H2/Kho, Xuất, Nhập, Hư, KM, Cuối TT, Dự kiến, Lệch, Doanh thu → denomination counts (9 × ĐC + 9 × CC) → totals, chi phí, DT NH, Người giao/nhận, Ghi chú.

`buildRow()` computes `predicted` and `lech` server-side so the sheet has auditable calculated values independent of the client.

### PWA (`sw.js`)

Cache-first strategy. Pre-caches: `index.html`, `manifest.json`, icons, and the three CDN bundles (React, ReactDOM, Babel). GAS API calls (`script.google.com`) are never intercepted — always hit the network.

Cache name is versioned (`kiem-ke-ca-v1`). Bump the version string in `sw.js` when deploying breaking changes to force cache invalidation on existing installs.

## Critical constraints

- **`SpreadsheetApp.openById(SPREADSHEET_ID)`** must be used in `Code.gs` — `getActiveSpreadsheet()` returns null in web app context.
- **`oauthScopes`** must be explicitly declared in `appsscript.json` — GAS web apps don't auto-grant sheet access without it.
- **No `Content-Type: application/json`** on the POST request from the browser — it triggers a CORS preflight that GAS doesn't handle.
- After any `clasp deploy`, the new deployment URL **must** be updated in the `GAS_URL` constant in `index.html`.
