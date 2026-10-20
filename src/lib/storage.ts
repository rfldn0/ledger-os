/**
 * Persistence layer — two modes:
 *
 *  Tauri desktop (IS_TAURI = true):
 *    Reads and writes $APPDATA/LedgerOS/data.json directly via the
 *    native file system.  No user dialogs, no IndexedDB, no localStorage
 *    overhead.  In-memory React state is the hot cache; the file is the
 *    single source of truth.
 *
 *  Browser fallback (IS_TAURI = false):
 *    Two-tier: localStorage (fast sync) + File System Access API
 *    (portable JSON file chosen by the user, Chrome/Edge only).
 */
import type { AppData } from './types';
import { seedData } from './seed';

// ─── Environment detection ────────────────────────────────────────────────────

/** True when running inside the Tauri desktop wrapper. */
export const IS_TAURI: boolean =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ─── Shared ───────────────────────────────────────────────────────────────────

export const SCHEMA = 1;
export type StorageState = 'ok' | 'file' | 'unavailable' | 'full';

const FILE_TAG = 'ledger-os';

/** Fill any fields missing from older or hand-edited saves with defaults. */
export function normalize(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<AppData> & { sheetData?: boolean };
  const d = seedData();
  const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  const ob = (r.ob && typeof r.ob === 'object' ? r.ob : {}) as Partial<AppData['ob']>;
  const hasSheet = r.sheetData !== false;
  return {
    txns:       arr(r.txns, d.txns),
    startCash:  r.startCash ?? d.startCash,
    rate:       typeof r.rate === 'number' && r.rate > 0 ? r.rate : d.rate,
    ob: {
      family:   arr(ob.family,   d.ob.family),
      personal: arr(ob.personal, d.ob.personal),
      subs:     arr(ob.subs,     d.ob.subs),
    },
    portfolios: arr(r.portfolios, d.portfolios),
    events:     hasSheet ? arr(r.events, d.events) : d.events,
    rules:      hasSheet ? arr(r.rules, []) : [],
    actual:     hasSheet && r.actual && typeof r.actual === 'object' ? r.actual : d.actual,
    buckets:    arr(r.buckets, d.buckets),
    settings:   { ...d.settings, ...(r.settings && typeof r.settings === 'object' ? r.settings : {}) },
  };
}

// ─── Tauri FS path ────────────────────────────────────────────────────────────

const TAURI_DIR  = 'LedgerOS';        // relative to $APPDATA
const TAURI_FILE = 'LedgerOS/data.json';

/** Load AppData from $APPDATA/LedgerOS/data.json (Tauri only). */
export async function loadDataTauri(): Promise<{ data: AppData; fresh: boolean }> {
  try {
    const { BaseDirectory, exists, mkdir, readTextFile } = await import('@tauri-apps/plugin-fs');
    const bd = BaseDirectory.AppData;

    // Ensure directory exists on first run
    if (!(await exists(TAURI_DIR, { baseDir: bd }))) {
      await mkdir(TAURI_DIR, { baseDir: bd, recursive: true });
    }

    if (!(await exists(TAURI_FILE, { baseDir: bd }))) {
      return { data: seedData(), fresh: true };
    }

    const text    = await readTextFile(TAURI_FILE, { baseDir: bd });
    const json: unknown = JSON.parse(text);
    const payload = json && typeof json === 'object' && 'data' in (json as object)
      ? (json as { data: unknown }).data
      : json;
    const data = normalize(payload);
    return data ? { data, fresh: false } : { data: seedData(), fresh: true };
  } catch {
    return { data: seedData(), fresh: true };
  }
}

/** Write AppData to $APPDATA/LedgerOS/data.json (Tauri only). */
export async function saveDataTauri(data: AppData): Promise<void> {
  const { BaseDirectory, writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(
    TAURI_FILE,
    JSON.stringify({ app: FILE_TAG, schema: SCHEMA, savedAt: new Date().toISOString(), data }, null, 2),
    { baseDir: BaseDirectory.AppData },
  );
}

// ─── localStorage ────────────────────────────────────────────────────────────

export const STORAGE_KEY = 'ledgeros.data';
const LEGACY_KEY         = 'ledgeros.v2';

interface Envelope { schema: number; data: AppData; }

function getStore(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__ledgeros_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch { return null; }
}

export function loadData(): { data: AppData; state: StorageState; fresh: boolean } {
  const store = getStore();
  if (!store) return { data: seedData(), state: 'unavailable', fresh: true };
  try {
    const cur = store.getItem(STORAGE_KEY);
    if (cur) {
      const data = normalize((JSON.parse(cur) as Envelope).data);
      if (data) return { data, state: 'ok', fresh: false };
    }
    const legacy = store.getItem(LEGACY_KEY);
    if (legacy) {
      const data = normalize(JSON.parse(legacy));
      if (data) return { data, state: 'ok', fresh: false };
    }
  } catch {
    try { store.setItem(STORAGE_KEY + '.corrupt-' + Date.now(), store.getItem(STORAGE_KEY) || ''); } catch { /* ignore */ }
  }
  return { data: seedData(), state: 'ok', fresh: true };
}

export function saveData(data: AppData): StorageState {
  const store = getStore();
  if (!store) return 'unavailable';
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ schema: SCHEMA, data } satisfies Envelope));
    return 'ok';
  } catch (e) {
    const name = (e as DOMException)?.name;
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' ? 'full' : 'unavailable';
  }
}

/** Calls back when another browser tab saves new data. */
export function onExternalChange(cb: (data: AppData) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const data = normalize((JSON.parse(e.newValue) as Envelope).data);
      if (data) cb(data);
    } catch { /* ignore */ }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/** Ask the browser not to evict our data under storage pressure (best effort). */
export function requestPersistence() {
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* unsupported */ }
}

export function downloadBackup(data: AppData) {
  const blob = new Blob(
    [JSON.stringify({ app: FILE_TAG, schema: SCHEMA, exportedAt: new Date().toISOString(), data }, null, 2)],
    { type: 'application/json' },
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ledger-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function readBackup(file: File): Promise<AppData> {
  const json = JSON.parse(await file.text());
  const data = normalize(json && typeof json === 'object' && 'data' in json ? json.data : json);
  if (!data) throw new Error('Not a Ledger OS backup');
  return data;
}

// ─── File System Access API (browser, Chrome/Edge only) ──────────────────────

interface SaveFilePicker {
  (opts?: { suggestedName?: string; types?: Array<{ description?: string; accept: Record<string, string[]> }>; excludeAcceptAllOption?: boolean }): Promise<FileSystemFileHandle>;
}
interface OpenFilePicker {
  (opts?: { types?: Array<{ description?: string; accept: Record<string, string[]> }>; multiple?: boolean; excludeAcceptAllOption?: boolean }): Promise<FileSystemFileHandle[]>;
}
declare global {
  interface Window { showSaveFilePicker?: SaveFilePicker; showOpenFilePicker?: OpenFilePicker; }
}

export function supportsFileAccess(): boolean {
  return !IS_TAURI &&
    typeof window !== 'undefined' &&
    typeof window.showSaveFilePicker === 'function' &&
    typeof window.showOpenFilePicker === 'function';
}

// ─── IndexedDB handle store (browser only) ───────────────────────────────────

const IDB_NAME = 'ledgeros-fs', IDB_STORE = 'handles', IDB_KEY = 'saveFile';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getSavedHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openIDB();
    return new Promise(resolve => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemFileHandle) ?? null);
      req.onerror  = () => resolve(null);
    });
  } catch { return null; }
}

export async function storeHandle(handle: FileSystemFileHandle | null): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      if (handle) store.put(handle, IDB_KEY);
      else store.delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch { /* best-effort */ }
}

// ─── File read / write (browser) ─────────────────────────────────────────────

export async function readFromHandle(handle: FileSystemFileHandle): Promise<AppData | null> {
  try {
    const text = await (await handle.getFile()).text();
    const json: unknown = JSON.parse(text);
    const payload = json && typeof json === 'object' && 'data' in (json as object)
      ? (json as { data: unknown }).data : json;
    return normalize(payload);
  } catch { return null; }
}

export async function writeToHandle(handle: FileSystemFileHandle, data: AppData): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(
    JSON.stringify({ app: FILE_TAG, schema: SCHEMA, savedAt: new Date().toISOString(), data }, null, 2),
  );
  await writable.close();
}

const FILE_TYPES = [{ description: 'Ledger OS data', accept: { 'application/json': ['.json'] } }];

export async function promptNewSaveFile(): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) return null;
  try { return await window.showSaveFilePicker({ suggestedName: 'ledger-os-data.json', types: FILE_TYPES }); }
  catch { return null; }
}

export async function promptOpenSaveFile(): Promise<FileSystemFileHandle | null> {
  if (!window.showOpenFilePicker) return null;
  try { const [h] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false }); return h; }
  catch { return null; }
}
