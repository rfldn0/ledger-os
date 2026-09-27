import { useState } from 'react';
import type { AppData, Txn } from '../../lib/types';
import type { Update } from '../../lib/useLedger';
import { obTotals } from '../../lib/calc';
import { seedTxns } from '../../lib/seed';
import { inRange, money, num, range } from '../../lib/util';
import { Modal } from '../Modal';
import { Blocks } from '../Sprites';
import { Buckets } from './Buckets';
import { CashInput } from './CashInput';
import { Hero } from './Hero';
import { Ledger, type Filter } from './Ledger';
import { Readouts } from './Readouts';
import { StreamView } from './StreamView';

export interface Feedback {
  toast: Txn | null;
  lastId: string | null;
  burstKey: number;
}

export interface OverInfo { id: string; spend: number; lim: number }

interface Props {
  data: AppData;
  update: Update;
  feedback: Feedback;
  over: OverInfo | null;
  onCommit: (t: Txn) => void;
  onUndo: () => void;
  onDelete: (id: string) => void;
  onCloseOver: (undo: boolean) => void;
  onExportBackup: () => void;
  onImportBackup: (f: File) => void;
}

export function CashflowTab({ data, update, feedback, over, onCommit, onUndo, onDelete, onCloseOver, onExportBackup, onImportBackup }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const month = range('month', 0, data.settings.payAnchor);
  const mIn = data.txns.filter(x => x.amount > 0 && inRange(x.ts, month)).reduce((a, x) => a + x.amount, 0);
  const surplus = mIn - obTotals(data.ob).total;
  const moved = data.buckets.reduce((a, b) => a + (b.moves || []).filter(m => inRange(m.ts, month)).reduce((q, m) => q + num(m.amt), 0), 0);
  const unalloc = surplus - moved;

  const commit = (t: Txn) => { setFilter('all'); onCommit(t); };

  return (
    <>
      <Hero data={data} unalloc={unalloc} />
      <CashInput rate={data.rate} anim={data.settings.confirmAnim} toast={feedback.toast} burstKey={feedback.burstKey}
        canUndo={!!feedback.toast && feedback.lastId === feedback.toast.id} onCommit={commit} onUndo={onUndo} />
      <section className="row wrap" style={{ gap: 22, alignItems: 'flex-start' }}>
        <StreamView data={data} onFilter={f => setFilter(f as Filter)} />
        <Buckets buckets={data.buckets} unalloc={unalloc} update={update} />
      </section>
      <Readouts txns={data.txns} payAnchor={data.settings.payAnchor} />
      <Ledger data={data} update={update} filter={filter} setFilter={setFilter} lastId={feedback.lastId}
        onExportBackup={onExportBackup} onImportBackup={onImportBackup} onDelete={onDelete}
        onClearEntries={() => { if (window.confirm('Clear all cashflow entries? Obligations, timesheet and buckets are kept.')) update(d => ({ ...d, txns: [] })); }}
        onRestore={() => { if (window.confirm('Replace the ledger with your Recurring sheet data?')) update(d => ({ ...d, txns: seedTxns() })); }} />

      {over && (
        <Modal onClose={() => onCloseOver(false)} label="Over budget" maxWidth={420}>
          <span className="tag" style={{ alignSelf: 'flex-start', background: 'var(--rose)', fontWeight: 700 }}>OVER BY {money(over.spend - over.lim)}</span>
          <span className="modal-title">Variable spending is past its {money(over.lim)} limit</span>
          <span style={{ fontSize: 17, color: 'rgba(0,0,0,.65)' }}>This month: {money(over.spend)} on Daily Living and Expense. The limit is your Monthly Allowance in Obligations.</span>
          <Blocks fill={Math.round(Math.min(1, over.lim / over.spend) * 12)} empty="var(--rose)" />
          <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn danger" onClick={() => onCloseOver(true)}>Undo entry</button>
            <button className="btn-primary sm" autoFocus onClick={() => onCloseOver(false)}>Keep it</button>
          </div>
        </Modal>
      )}
    </>
  );
}
