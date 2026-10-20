/**
 * Persistence layer with two tiers:
 *
 *  1. File System Access API — saves to a real .json file the user chooses.
 *     The FileSystemFileHandle is kept across sessions in IndexedDB so the app
 *     can re-open the file automatically on the next load.
 *
 *  2. localStorage fallback — used on browsers that don't support the File
 *     System Access API (Firefox, Safari < 15.2) and as a fast in-browser
 *     cache for the initial synchronous render.
 *
 * Every write goes to localStorage first (synchronous, instant) and then to
 * the linked file asynchronously. This means the app always starts instantly
 * from localStorage, and the JSON file is the portable, human-readable record.
 */
import type { AppData } from './types';
import { seedData } from './seed';

// ─── localStorage ────────────────────────────────────────────────────────────

export const STORAGE_KEY = 'ledgeros.data';
const LEGACY_KEY = 'ledgeros.v2';
export const SCHEMA = 1;

export type StorageState = 'ok' | 'file' | 'unavailable' | 'full';

interface Envelope {
  schema: number;
  data: AppData;
}

function getStore(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__ledgeros_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** Fill any fields missing from older or hand-edited saves with defaults. */
export function normalize(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<AppData> & { sheetData?: boolean };
  const d = seedData();
  const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  const ob = (r.ob && typeof r.ob === 'object' ? r.ob : {}) as Partial<AppData['ob']>;
  const hasSheet = r.sheetData !== false;
  return {
    txns: arr(r.txns, d.txns),
    startCash: r.startCash ?? d.startCash,
    rate: typeof r.rate === 'number' && r.rate > 0 ? r.rate : d.rate,
    ob: { family: arr(ob.family, d.ob.family), personal: arr(ob.personal, d.ob.personal), subs: arr(ob.subs, d.ob.subs) },
    portfolios: arr(r.portfolios, d.portfolios),
    events: hasSheet ? arr(r.events, d.events) : d.events,
    rules: hasSheet ? arr(r.rules, []) : [],
    actual: hasSheet && r.actual && typeof r.actual === 'object' ? r.actual : d.actual,
    buckets: arr(r.buckets, d.buckets),
    settings: { ...d.settings, ...(r.settings && typeof r.settings === 'object' ? r.settings : {}) },
  };
}

export function loadData(): { data: AppData; state: StorageState; fresh: boolean } {
  const store = getStore();
  if (!store) return { data: seedData(), state: 'unavailable', fresh: true };
  try {
    const cur = store.getItem(STORAGE_KEY);
    if (cur) {
      const env = JSON.parse(cur) as Envelope;
      const data = normalize(env.data);
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

/** Calls back when another tab of this browser saves new data. */
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
    [JSON.stringify({ app: 'ledger-os', schema: SCHEMA, exportedAt: new Date().toISOString(), data }, null, 2)],
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

// ─── File System Access API ───────────────────────────────────────────────────

/** Minimal typings for the File System Access API (not yet in all TS DOM libs). */
interface SaveFilePicker {
  (opts?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    excludeAcceptAllOption?: boolean;
  }): Promise<FileSystemFileHandle>;
}
interface OpenFilePicker {
  (opts?: {
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
  }): Promise<FileSystemFileHandle[]>;
}

declare global {
  interface Window {
    showSaveFilePicker?: SaveFilePicker;
    showOpenFilePicker?: OpenFilePicker;
  }
}

/** True when the browser supports native file save/open dialogs. */
export function supportsFileAccess(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.showSaveFilePicker === 'function' &&
    typeof window.showOpenFilePicker === 'function';
}

// ─── IndexedDB handle store ───────────────────────────────────────────────────

const IDB_NAME = 'ledgeros-fs';
const IDB_STORE = 'handles';
const IDB_KEY = 'saveFile';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Retrieve the previously-stored FileSystemFileHandle from IndexedDB. */
export async function getSavedHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openIDB();
    return new Promise(resolve => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemFileHandle) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

/** Persist (or clear) a FileSystemFileHandle in IndexedDB. */
export async function storeHandle(handle: FileSystemFileHandle | null): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      if (handle) store.put(handle, IDB_KEY);
      else store.delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* ignore — file handle storage is best-effort */ }
}

// ─── File read / write ────────────────────────────────────────────────────────

const FILE_ENVELOPE_TAG = 'ledger-os';

/** Read and parse AppData from a FileSystemFileHandle. */
export async function readFromHandle(handle: FileSystemFileHandle): Promise<AppData | null> {
  try {
    const file = await handle.getFile();
    const text = await file.text();
    const json: unknown = JSON.parse(text);
    const payload =
      json && typeof json === 'object' && 'data' in (json as object)
        ? (json as { data: unknown }).data
        : json;
    return normalize(payload);
  } catch { return null; }
}

/** Write AppData to a FileSystemFileHandle as a human-readable JSON file. */
export async function writeToHandle(handle: FileSystemFileHandle, data: AppData): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(
    JSON.stringify(
      { app: FILE_ENVELOPE_TAG, schema: SCHEMA, savedAt: new Date().toISOString(), data },
      null,
      2,
    ),
  );
  await writable.close();
}

// ─── Picker helpers ───────────────────────────────────────────────────────────

const FILE_TYPES = [{ description: 'Ledger OS data', accept: { 'application/json': ['.json'] } }];

/**
 * Show a "Save File" dialog and return the chosen handle.
 * Returns null if the user cancelled or the API is unavailable.
 */
export async function promptNewSaveFile(): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) return null;
  try {
    return await window.showSaveFilePicker({ suggestedName: 'ledger-os-data.json', types: FILE_TYPES });
  } catch { return null; /* user cancelled */ }
}

/**
 * Show an "Open File" dialog and return the chosen handle.
 * Returns null if the user cancelled or the API is unavailable.
 */
export async function promptOpenSaveFile(): Promise<FileSystemFileHandle | null> {
  if (!window.showOpenFilePicker) return null;
  try {
    const [handle] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false });
    return handle;
  } catch { return null; /* user cancelled */ }
}
