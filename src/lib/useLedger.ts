import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from './types';
import { loadData, onExternalChange, requestPersistence, saveData, type StorageState } from './storage';

export type Update = (fn: (d: AppData) => AppData) => void;

/** App data backed by localStorage: saves shortly after each change and syncs across tabs. */
export function useLedger() {
  const [init] = useState(loadData);
  const [data, setData] = useState<AppData>(init.data);
  const [storage, setStorage] = useState<StorageState>(init.state);
  const [savedAt, setSavedAt] = useState<Date | null>(init.fresh ? null : new Date());
  const external = useRef(false);
  const latest = useRef(data);
  const dirty = useRef(init.fresh); // first run: write the starter data straight away
  latest.current = data;

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    const st = saveData(latest.current);
    setStorage(st);
    if (st === 'ok') setSavedAt(new Date());
  }, []);

  useEffect(() => {
    if (external.current) { external.current = false; return; }
    dirty.current = true;
    const t = setTimeout(flush, 150);
    return () => clearTimeout(t);
  }, [data, flush]);

  useEffect(() => {
    requestPersistence();
    const off = onExternalChange(d => { external.current = true; setData(d); setSavedAt(new Date()); });
    const onHide = () => flush();
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => { off(); window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onVis); };
  }, [flush]);

  const update: Update = useCallback(fn => setData(fn), []);
  const replace = useCallback((d: AppData) => setData(d), []);

  return { data, update, replace, storage, savedAt };
}
