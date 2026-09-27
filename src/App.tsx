import { useEffect, useRef, useState } from 'react';
import type { CatId, Txn } from './lib/types';
import { useLedger } from './lib/useLedger';
import { downloadBackup, readBackup } from './lib/storage';
import { varLimit } from './lib/calc';
import { inRange, num, range, uid } from './lib/util';
import { Header, type Tab } from './components/Header';
import { CashflowTab, type Feedback, type OverInfo } from './components/cash/CashflowTab';
import { ObligationsTab } from './components/ObligationsTab';
import { TimeTab } from './components/TimeTab';

const TAB_KEY = 'ledgeros.tab';

function initialTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (t === 'cash' || t === 'ob' || t === 'time') return t;
  } catch { /* storage blocked */ }
  return 'cash';
}

export function App() {
  const { data, update, replace, storage, savedAt } = useLedger();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [fb, setFb] = useState<Feedback>({ toast: null, lastId: null, burstKey: 0 });
  const [over, setOver] = useState<OverInfo | null>(null);
  const undoTimer = useRef<number>(undefined);

  useEffect(() => { try { localStorage.setItem(TAB_KEY, tab); } catch { /* ignore */ } }, [tab]);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  /** Add a transaction with commit feedback: coin hop, highlighted row and a 5s undo. */
  const log = (t: Txn) => {
    update(d => ({ ...d, txns: [...d.txns, t] }));
    setFb(f => ({ toast: t, lastId: t.id, burstKey: f.burstKey + 1 }));
    clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setFb(f => ({ ...f, lastId: null })), 5000);
  };

  const commit = (t: Txn) => {
    log(t);
    if (t.amount < 0 && (t.cat === 'living' || t.cat === 'expense')) {
      const month = range('month', 0, data.settings.payAnchor), lim = varLimit(data.ob);
      const spend = [...data.txns, t]
        .filter(x => x.amount < 0 && (x.cat === 'living' || x.cat === 'expense') && inRange(x.ts, month))
        .reduce((q, x) => q - x.amount, 0);
      if (lim > 0 && spend > lim) setOver({ id: t.id, spend, lim });
    }
  };

  const remove = (id: string) => {
    update(d => ({ ...d, txns: d.txns.filter(x => x.id !== id) }));
    setFb(f => (f.toast?.id === id ? { ...f, toast: null, lastId: null } : f));
  };

  const pay = (x: { id: string; n: string; c: number | string }, cat: CatId) =>
    log({ id: uid('t'), ts: new Date().toISOString(), amount: -num(x.c), memo: x.n, cat, note: 'Paid from Obligations' });

  const importBackup = async (f: File) => {
    try {
      const d = await readBackup(f);
      if (window.confirm(`Replace everything in this browser with the backup "${f.name}" (${d.txns.length} entries)?`)) {
        replace(d);
        setFb({ toast: null, lastId: null, burstKey: 0 });
      }
    } catch {
      window.alert("That file isn't a Ledger OS backup.");
    }
  };

  return (
    <main className="page">
      <Header tab={tab} onTab={setTab} rate={data.rate} onRate={r => update(d => ({ ...d, rate: r }))} storage={storage} savedAt={savedAt} />
      {tab === 'cash' && (
        <CashflowTab data={data} update={update} feedback={fb} over={over}
          onCommit={commit} onUndo={() => fb.lastId && remove(fb.lastId)} onDelete={remove}
          onCloseOver={undo => { if (undo && over) remove(over.id); setOver(null); }}
          onExportBackup={() => downloadBackup(data)} onImportBackup={importBackup} />
      )}
      {tab === 'ob' && <ObligationsTab data={data} update={update} onPay={pay} />}
      {tab === 'time' && <TimeTab data={data} update={update} />}
    </main>
  );
}
