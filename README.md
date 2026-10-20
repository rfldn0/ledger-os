# Ledger OS

![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.99-000000?logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![WebView2](https://img.shields.io/badge/WebView2-Windows-0078D4?logo=microsoftedge&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-offline-5A0FC8?logo=pwa&logoColor=white)

Offline-first budget tracker built from the "Ledger wireframes and design research" files (Ledger OS v3 prototype).
It runs as a **Tauri 2 desktop app** (system tray, auto-start, data in a local JSON file) and still works as a
plain browser PWA. No backend, no account. Design rules live in [design/DESIGN.md](design/DESIGN.md).

## Tech stack

| Layer | What |
|---|---|
| Desktop shell | Tauri 2 (Rust): tray icon, auto-start, hide-to-tray on close |
| Plugins | `tauri-plugin-fs` (data file), `tauri-plugin-autostart` (launch at login) |
| UI | React 19 + TypeScript, bundled by Vite |
| Rendering | System WebView2 (no bundled Chromium, so it uses about 20–40 MB of RAM) |
| Browser fallback | `localStorage`, File System Access API, IndexedDB, service worker |

## Run

Requires Node.js. The desktop build also needs Rust (`cargo` on PATH) and WebView2, which ships with Windows 10/11.

```bash
npm install

# Desktop (Tauri)
npm run tauri:dev     # React hot reload + Rust watch, opens the app window
npm run tauri:build   # release build + installers → src-tauri/target/release/bundle/
npm run tauri:icon    # regenerate src-tauri/icons/ from public/icon-512.png

# Browser only
npm run dev           # http://localhost:5173
npm run build         # static site in dist/
npm run typecheck
```

The release profile in [src-tauri/Cargo.toml](src-tauri/Cargo.toml) is tuned for a small binary and low RAM
(LTO, `opt-level = "s"`, stripped, `panic = "abort"`).

## Desktop behavior

- **Close (X) hides to the tray** instead of quitting. Left-click the tray icon or choose **Open Ledger OS**
  to bring the window back. **Quit** in the tray menu exits.
- **Auto-start:** the app registers itself to launch at Windows login the first time it runs. To turn it off,
  disable "Ledger OS" in Task Manager → Startup apps.
- **Data file:** `%APPDATA%\com.ledgeros.app\LedgerOS\data.json` (Tauri's app-data directory for the
  `com.ledgeros.app` identifier). It's created on first run and written 100 ms after each change. File access is
  scoped to that folder in [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json).

The Rust side is in [src-tauri/src/lib.rs](src-tauri/src/lib.rs). The UI detects Tauri through `IS_TAURI` in
[src/lib/storage.ts](src/lib/storage.ts) and picks the storage path to match.

## Storage in the browser

When it isn't running under Tauri, the app falls back to two tiers:

1. **`localStorage`** (key `ledgeros.data`) is always written. It saves about 150 ms after every change and again
   when the tab is hidden or closed. Other open tabs update live. Data from the design prototype (`ledgeros.v2`)
   is picked up automatically.
2. **Linked file (Chrome/Edge only):** in the header, **link file** / **open file** saves to a portable `.json` file
   you choose through the File System Access API. The file handle is kept in IndexedDB, so the same file reopens
   automatically on your next visit. Firefox and Safari use `localStorage` only.

If the browser blocks storage (or it's full), a red banner says so. Use **Cashflow → ⚙ more → Export backup /
Import backup** to move data between browsers or devices, or to keep a copy. Clearing site data erases
`localStorage`.

The app starts empty. There's no seed or sample data.

## Offline / install (browser)

The production build registers a service worker ([public/sw.js](public/sw.js)) that caches the app, sprites and
fonts, so after one visit Ledger OS opens with no connection. With the web manifest, browsers offer "Install app" /
"Add to Home Screen". When you deploy a change to `public/sw.js`, bump `CACHE` in that file.

## Project layout

```
src/                 React UI
  lib/storage.ts     Tauri file I/O + browser localStorage / file-handle storage
  lib/useLedger.ts   App state, load/save, debounced writes
  components/        Cashflow, Obligations, Time tabs
src-tauri/           Rust shell
  src/lib.rs         Tray, auto-start, close-to-tray
  tauri.conf.json    Window, tray, bundle config
  capabilities/      FS + autostart permissions
public/              PWA manifest, service worker, sprites, icons
design/DESIGN.md     Design rules
```

## Not done yet

- `npm run tauri:build` hasn't been run, so there's no installer yet.
- Hide-to-tray, auto-start after a reboot, and data persistence across restarts still need to be tested by hand.
