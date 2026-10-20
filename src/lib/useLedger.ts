import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from './types';
import {
  getSavedHandle,
  loadData,
  onExternalChange,
  promptNewSaveFile,
  promptOpenSaveFile,
  readFromHandle,
  requestPersistence,
  saveData,
  storeHandle,
  supportsFileAccess,
  writeToHandle,
  type StorageState,
} from './storage';

export type Update = (fn: (d: AppData) => AppData) => void;

/**
 * App data with two-tier persistence:
 *  - localStorage  (synchronous, fast, always-on fallback)
 *  - JSON file     (File System Access API — portable, human-readable)
 *
 * On mount the hook tries to restore a previously-linked file handle from
 * IndexedDB and, if found, loads the data from the file.  Every subsequent
 * change is debounced ~150 ms and written to both tiers.
 */
export function useLedger() {
  const [init] = useState(loadData);
  const [data, setData]       = useState<AppData>(init.data);
  const [storage, setStorage] = useState<StorageState>(init.state);
  const [savedAt, setSavedAt] = useState<Date | null>(init.fresh ? null : new Date());

  // File handle state — keep a ref alongside the state value so the flush
  // callbacks always see the current handle without stale closure issues.
  const [fileHandle, setFileHandleState] = useState<FileSystemFileHandle | null>(null);
  const [fileName,   setFileName]        = useState<string | null>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);

  const setFileHandle = useCallback((h: FileSystemFileHandle | null) => {
    fileHandleRef.current = h;
    setFileHandleState(h);
    setFileName(h ? h.name : null);
  }, []);

  const external  = useRef(false);
  const latest    = useRef(data);
  const dirty     = useRef(init.fresh); // write seed/blank data on very first run
  latest.current  = data;

  // ── Restore file handle from IndexedDB on mount ─────────────────────────────
  useEffect(() => {
    if (!supportsFileAccess()) return;
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
        // Handle is stale (file moved/deleted) — remove it.
        await storeHandle(null);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save helpers ─────────────────────────────────────────────────────────────

  /** Synchronous localStorage save — always runs first so the app is never left unsaved. */
  const flushLocal = useCallback(() => {
    const st = saveData(latest.current);
    // Only surface localStorage errors when there is no file taking over.
    if (!fileHandleRef.current) setStorage(st);
  }, []);

  /** Async file write — runs after flushLocal. */
  const flushFile = useCallback(async () => {
    const handle = fileHandleRef.current;
    if (!handle) return;
    try {
      await writeToHandle(handle, latest.current);
      setStorage('file');
      setSavedAt(new Date());
    } catch {
      // File write failed (e.g. permission revoked) — fall back to localStorage status.
      setStorage(saveData(latest.current));
    }
  }, []);

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    flushLocal();
    if (!fileHandleRef.current) setSavedAt(new Date());
    void flushFile();
  }, [flushLocal, flushFile]);

  // Debounce: save ~150 ms after the last change.
  useEffect(() => {
    if (external.current) { external.current = false; return; }
    dirty.current = true;
    const t = setTimeout(flush, 150);
    return () => clearTimeout(t);
  }, [data, flush]);

  // Force-save on tab hide / page unload (localStorage only — async file write
  // can't reliably complete before the page is killed).
  useEffect(() => {
    requestPersistence();
    const off   = onExternalChange(d => { external.current = true; setData(d); setSavedAt(new Date()); });
    const onHide = () => { if (dirty.current) { dirty.current = false; flushLocal(); } };
    const onVis  = () => { if (document.visibilityState === 'hidden') onHide(); };
    window.addEventListener('pagehide',        onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      off();
      window.removeEventListener('pagehide',        onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [flushLocal]);

  // ── Public API ───────────────────────────────────────────────────────────────

  const update:  Update = useCallback(fn => setData(fn), []);
  const replace          = useCallback((d: AppData) => setData(d), []);

  /**
   * Prompt the user to choose a location for a new save file.
   * Writes current data immediately then switches all future saves to that file.
   */
  const linkFile = useCallback(async () => {
    const handle = await promptNewSaveFile();
    if (!handle) return;
    await writeToHandle(handle, latest.current);
    await storeHandle(handle);
    setFileHandle(handle);
    setStorage('file');
    setSavedAt(new Date());
  }, [setFileHandle]);

  /**
   * Prompt the user to open an existing Ledger OS JSON file.
   * Loads its data, then routes all future saves to that file.
   */
  const openFile = useCallback(async () => {
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

  /** Detach the linked file and revert to localStorage-only persistence. */
  const unlinkFile = useCallback(async () => {
    await storeHandle(null);
    setFileHandle(null);
    setStorage(saveData(latest.current) === 'ok' ? 'ok' : 'unavailable');
  }, [setFileHandle]);

  return {
    data, update, replace,
    storage, savedAt,
    fileHandle, fileName,
    linkFile, openFile, unlinkFile,
    canUseFiles: supportsFileAccess(),
  };
}
