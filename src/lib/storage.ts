/**
 * Browser-local persistence.
 *
 * Everything lives in `localStorage` under one key, so it works the same in
 * Chrome, Edge, Firefox and Safari (desktop and mobile) with no server. Data
 * stays in the browser it was entered in; the backup export/import moves it
 * between browsers or devices.
 *
 * If storage is unavailable (blocked site data, some private modes) the app
 * still runs from memory and the header warns that changes will not be kept.
 */
import type { AppData } from './types';
import { seedData } from './seed';

export const STORAGE_KEY = 'ledgeros.data';
const LEGACY_KEY = 'ledgeros.v2'; // the design prototype's key
const SCHEMA = 1;

export type StorageState = 'ok' | 'unavailable' | 'full';

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
  // The prototype only kept timesheet data once `sheetData` was set.
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
    settings: { ...d.settings, ...(r.settings && typeof r.settings === 'object' ? r.settings : {}) }
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
    // Corrupt JSON: keep the bad copy aside instead of overwriting it silently.
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
  const blob = new Blob([JSON.stringify({ app: 'ledger-os', schema: SCHEMA, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
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
