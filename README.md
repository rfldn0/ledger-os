# Ledger OS

Budget tracker built from the "Ledger wireframes and design research" files (Ledger OS v3 prototype).
Design rules live in [design/DESIGN.md](design/DESIGN.md).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ — host anywhere, or open via any static server
```

## Storage

All data is saved in the browser's `localStorage` (key `ledgeros.data`). This works the same in
Chrome, Edge, Firefox and Safari, desktop and mobile, with no server or account.

- Saves ~150 ms after every change, and again when the tab is hidden or closed.
- Other open tabs of the same browser update live.
- Data from the design prototype (`ledgeros.v2`) is picked up automatically.
- If the browser blocks storage (or it is full) a red banner says so.
- Data is per browser. Use **Cashflow → ⚙ more → Export backup / Import backup** to move it
  between browsers or devices, or to keep a copy. Clearing site data erases it.

## Offline / install

The production build registers a service worker ([public/sw.js](public/sw.js)) that caches the app,
sprites and fonts, so after one visit Ledger OS opens with no connection. It also has a web manifest, so
browsers offer "Install app" / "Add to Home Screen". Your data isn't affected by this: it stays in
localStorage either way. When you deploy a change to `public/sw.js`, bump `CACHE` in that file.
