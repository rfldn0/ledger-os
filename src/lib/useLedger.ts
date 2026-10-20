import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from './types';
import { seedData } from './seed';
import {
  IS_TAURI,
  getSavedHandle,
  loadData,
  loadDataTauri,
  onExternalChange,
  promptNewSaveFile,
  promptOpenSaveFile,
  readFromHandle,
  requestPersistence,
  saveData,
  saveDataTauri,
  storeHandle,
  supportsFileAccess,
  writeToHandle,
  type StorageState,
} from './storage';

export type Update = (fn: (d: AppData) => AppData) => void;

/**
 * App data with auto-persistence.
 *
 * Tauri mode (desktop):
 *   Starts with blank seed data, then immediately loads the real data from
 *   $APPDATA/LedgerOS/data.json (< 10 ms on local disk).  Every subsequent
 *   change is debounced 100 ms then written directly to that file.
 *   In-memory React state is the hot cache — reads are always instant.
 *
 * Browser mode (fallback):
 *   localStorage (sync) + File System Access API (portable JSON file).
 */
export function useLedger() {
  // ── Initial state ─────────────────────────────────────────────────────────
  // Tauri: seed placeholder so App never sees null; real data arrives via effect.
  // Browser: load from localStorage synchronously (instant).
  const [init] = useState(() =>
    IS_TAURI
      ? { data: seedData(), state: 'file' as StorageState, fresh: true }
      : loadData()
  );

  // True only during the brief async Tauri file read on first mount (~5-20 ms)
  const [isLoading, setIsLoading] = useState(IS_TAURI);

  const [data,    setData]    = useState<AppData>(init.data);
  const [storage, setStorage] = useState<StorageState>(IS_TAURI ? 'file' : init.state);
  const [savedAt, setSavedAt] = useState<Date | null>(IS_TAURI ? null : (init.fresh ? null : new Date()));

  // ── File handle (browser mode only) ──────────────────────────────────────
  const [fileHandle, setFileHandleState] = useState<FileSystemFileHandle | null>(null);
  const [fileName,   setFileName]        = useState<string | null>(IS_TAURI ? 'data.json' : null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);

  const setFileHandle = useCallback((h: FileSystemFileHandle | null) => {
    fileHandleRef.current = h;
    setFileHandleState(h);
    setFileName(h ? h.name : null);
  }, []);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const external     = useRef(false); // true = change came from another tab
  const tauriLoading = useRef(false); // true = async initial load in progress
  const latest       = useRef<AppData>(data);
  const dirty        = useRef(!IS_TAURI && init.fresh);
  latest.current     = data;

  // ── Tauri: load from file on mount ────────────────────────────────────────
  useEffect(() => {
    if (!IS_TAURI) return;
    loadDataTauri().then(({ data: fileData, fresh }) => {
      tauriLoading.current = true; // suppress the next debounce tick
      setData(fileData);
      setSavedAt(fresh ? null : new Date());
      setStorage('file');
      dirty.current = false;
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Browser: restore File System file handle from IndexedDB on mount ──────
  useEffect(() => {
    if (IS_TAURI || !supportsFileAccess()) return;
    getSavedHandle().then(async handle => {
      if (!handle) return;
      const fileData = await readFromHandle(handle);
      if (fileData) {
        setFileHandle(handle);
        setData(fileData);
        setSavedAt(new Date());
        setStorage('file');
        dirty.current = false;
      } else {
        await storeHandle(null); // handle is stale (file moved/deleted)
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save helpers ──────────────────────────────────────────────────────────

  /** Synchronous localStorage write — browser mode only. */
  const flushLocal = useCallback(() => {
    const st = saveData(latest.current);
    if (!fileHandleRef.current) setStorage(st);
  }, []);

  /** Async File System API write — browser mode only. */
  const flushFile = useCallback(async () => {
    const handle = fileHandleRef.current;
    if (!handle) return;
    try {
      await writeToHandle(handle, latest.current);
      setStorage('file');
      setSavedAt(new Date());
    } catch {
      setStorage(saveData(latest.current));
    }
  }, []);

  /** Async native FS write — Tauri mode. */
  const flushTauri = useCallback(async () => {
    try {
      await saveDataTauri(latest.current);
      setStorage('file');
      setSavedAt(new Date());
    } catch { /* best-effort; file retried on next change */ }
  }, []);

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    if (IS_TAURI) {
      void flushTauri();
    } else {
      flushLocal();
      if (!fileHandleRef.current) setSavedAt(new Date());
      void flushFile();
    }
  }, [flushTauri, flushLocal, flushFile]);

  // ── Debounce: write 100 ms after last change ──────────────────────────────
  useEffect(() => {
    if (external.current)     { external.current = false; return; }
    if (tauriLoading.current) { tauriLoading.current = false; return; }

    dirty.current = true;
    const t = setTimeout(flush, 100);
    return () => clearTimeout(t);
  }, [data, flush]);

  // ── Force-save on tab hide / page unload (browser mode only) ─────────────
  useEffect(() => {
    if (IS_TAURI) return;
    requestPersistence();
    const off    = onExternalChange(d => { external.current = true; setData(d); setSavedAt(new Date()); });
    const onHide = () => { if (dirty.current) { dirty.current = false; flushLocal(); } };
    const onVis  = () => { if (document.visibilityState === 'hidden') onHide(); };
    window.addEventListener('pagehide',           onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      off();
      window.removeEventListener('pagehide',           onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [flushLocal]);

  // ── Public API ────────────────────────────────────────────────────────────

  const update:  Update = useCallback(fn => setData(d => fn(d)), []);
  const replace          = useCallback((d: AppData) => setData(d), []);

  const linkFile = useCallback(async () => {
    if (IS_TAURI) return;
    const handle = await promptNewSaveFile();
    if (!handle) return;
    await writeToHandle(handle, latest.current);
    await storeHandle(handle);
    setFileHandle(handle);
    setStorage('file');
    setSavedAt(new Date());
  }, [setFileHandle]);

  const openFile = useCallback(async () => {
    if (IS_TAURI) return;
    const handle = await promptOpenSaveFile();
    if (!handle) return;
    const fileData = await readFromHandle(handle);
    if (!fileData) { window.alert("That file isn't a valid Ledger OS data file."); return; }
    await storeHandle(handle);
    setFileHandle(handle);
    setData(fileData);
    setSavedAt(new Date());
    setStorage('file');
    dirty.current = false;
  }, [setFileHandle]);

  const unlinkFile = useCallback(async () => {
    if (IS_TAURI) return;
    await storeHandle(null);
    setFileHandle(null);
    setStorage(saveData(latest.current) === 'ok' ? 'ok' : 'unavailable');
  }, [setFileHandle]);

  return {
    data,
    isLoading,
    update,
    replace,
    storage,
    savedAt,
    fileHandle,
    fileName,
    linkFile,
    openFile,
    unlinkFile,
    canUseFiles: supportsFileAccess(),
  };
}
