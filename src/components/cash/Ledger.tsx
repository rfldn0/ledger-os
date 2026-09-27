import { Fragment, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { AppData, ConfirmAnim, Txn } from '../../lib/types';
import type { Update } from '../../lib/useLedger';
import { CATS, catOf } from '../../lib/cats';
import { addDays, dkey, idr, money, num, sgn, sod } from '../../lib/util';
import { Coin, Icon } from '../Sprites';

export type Filter = 'all' | 'income' | 'fixed' | 'variable' | Txn['cat'];

const GROUPS: Record<string, { label: string; cats: Txn['cat'][]; tint: string }> = {
  all: { label: 'All', cats: [], tint: 'var(--green)' },
  income: { label: 'Income', cats: ['income'], tint: 'var(--green)' },
  fixed: { label: 'Fixed', cats: ['family', 'subs'], tint: 'var(--blue)' },
  variable: { label: 'Variable', cats: ['living', 'expense'], tint: 'var(--butter)' }
};
const LIMIT = 8;
const HEADS: [string, boolean][] = [['', false], ['DATE', false], ['CATEGORY', false], ['DESCRIPTION', false], ['MONEY IN', true], ['MONEY OUT', true], ['BALANCE', true], ['NOTES', false]];

interface Row {
  key: string;
  gap: boolean;
  t?: Txn;
  when: string;
  bal: number;
}

interface Props {
  data: AppData;
  update: Update;
  filter: Filter;
  setFilter: (f: Filter) => void;
  lastId: string | null;
  onExportBackup: () => void;
  onImportBackup: (f: File) => void;
  onClearEntries: () => void;
  onRestore: () => void;
  onDelete: (id: string) => void;
}

const fmtD = (d: Date) => `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;

export function Ledger({ data, update, filter, setFilter, lastId, onExportBackup, onImportBackup, onClearEntries, onRestore, onDelete }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [more, setMore] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pick = (f: Filter) => { setFilter(f); setShowAll(false); };

  const chron = [...data.txns].sort((a, b) => a.ts.localeCompare(b.ts));
  const all: Row[] = [];
  if (chron.length) {
    const byDay: Record<string, Txn[]> = {};
    chron.forEach(t => { (byDay[dkey(new Date(t.ts))] ||= []).push(t); });
    let bal = num(data.startCash);
    const today = sod(new Date());
    const last = sod(new Date(chron[chron.length - 1].ts));
    const end = last > today ? last : today;
    for (let d = sod(new Date(chron[0].ts)); d <= end; d = addDays(d, 1)) {
      const list = byDay[dkey(d)];
      if (!list) { all.push({ key: 'gap' + dkey(d), gap: true, when: fmtD(d), bal }); continue; }
      for (const t of list) {
        bal += t.amount;
        const dt = new Date(t.ts);
        all.push({ key: t.id, gap: false, t, bal, when: `${fmtD(dt)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` });
      }
    }
  }
  all.reverse();
  const g = GROUPS[filter];
  const filtered = filter === 'all' ? all : all.filter(r => !r.gap && r.t && (g ? g.cats.includes(r.t.cat) : r.t.cat === filter));
  const rows = showAll ? filtered : filtered.slice(0, LIMIT);
  const filterNote = g ? (filter === 'fixed' ? 'Fixed = Family Support + Subscription' : filter === 'variable' ? 'Variable = Daily Living + Expense' : '') : 'Category: ' + catOf(filter).label;

  const setNote = (id: string, note: string) => update(d => ({ ...d, txns: d.txns.map(x => (x.id === id ? { ...x, note } : x)) }));

  const exportCsv = () => {
    const q = (v: unknown) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [['Date', 'Category', 'Description', 'Money In', 'Money Out', 'Note'].map(q).join(',')].concat(
      chron.map(x => [new Date(x.ts).toISOString(), catOf(x.cat).label, x.memo, x.amount > 0 ? x.amount : '', x.amount < 0 ? -x.amount : '', x.note || ''].map(q).join(','))
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'ledger.csv';
    document.body.appendChild(a); a.click(); a.remove();
  };

  const cell = (r: Row, content: ReactNode, cls = '', style: CSSProperties = {}, clickable = true) => (
    <div className={'td ' + cls + (clickable && !r.gap ? ' click' : '')} style={{ background: r.t && r.t.id === lastId ? 'var(--butter)' : undefined, ...style }}
      onClick={clickable && r.t ? () => setOpen(o => (o === r.t!.id ? null : r.t!.id)) : undefined}>{content}</div>
  );

  return (
    <section className="card" style={{ gap: 10 }}>
      <div className="row wrap" style={{ gap: '8px 14px' }}>
        <h2 className="card-title" style={{ margin: 0, fontWeight: 400 }}>Cashflow &amp; Daily Recurring Update</h2>
        <span className="small">{filterNote}</span>
        <div className="row wrap ml-auto" style={{ gap: 6 }}>
          {Object.entries(GROUPS).map(([id, x]) => (
            <button key={id} className={'chip' + (filter === id ? ' on' : '')} aria-pressed={filter === id}
              style={{ background: filter === id ? x.tint : undefined }} onClick={() => pick(id as Filter)}>{x.label}</button>
          ))}
          <button className="chip" aria-expanded={more} onClick={() => setMore(m => !m)}>{more ? '⚙ less' : '⚙ more'}</button>
        </div>
      </div>

      {more && (
        <div className="col" style={{ gap: 12, padding: '10px 12px', border: '1.5px dashed rgba(0,0,0,.35)', borderRadius: 'var(--r-box)' }}>
          <div className="row wrap" style={{ gap: '10px 16px' }}>
            <span className="caps muted">CATEGORY</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {CATS.map(c => (
                <button key={c.id} className="chip" aria-pressed={filter === c.id} style={{ fontSize: 15, padding: '0 10px 0 4px', background: filter === c.id ? c.tint : undefined }}
                  onClick={() => pick(c.id)}><Icon src={c.icon} size={18} />{c.label}</button>
              ))}
            </div>
            <label className="row mono ml-auto" style={{ gap: 6, fontSize: 12 }}>STARTING CASH $
              <input className="field-u mono" type="number" value={data.startCash} onChange={e => { const v = e.target.value; update(d => ({ ...d, startCash: v })); }} style={{ width: 80, borderBottomWidth: 2 }} /></label>
          </div>
          <div className="row wrap" style={{ gap: '10px 16px' }}>
            <span className="caps muted">COMMIT ANIMATION</span>
            <div className="row" style={{ gap: 6 }}>
              {(['burst', 'single', 'off'] as ConfirmAnim[]).map(a => (
                <button key={a} className={'chip' + (data.settings.confirmAnim === a ? ' on' : '')} aria-pressed={data.settings.confirmAnim === a}
                  style={{ background: data.settings.confirmAnim === a ? 'var(--green)' : undefined }}
                  onClick={() => update(d => ({ ...d, settings: { ...d.settings, confirmAnim: a } }))}>{a}</button>
              ))}
            </div>
            <label className="row mono" style={{ gap: 6, fontSize: 12 }}>PAYDAY ANCHOR
              <input className="field-u mono" type="date" value={data.settings.payAnchor}
                onChange={e => { const v = e.target.value; if (v) update(d => ({ ...d, settings: { ...d.settings, payAnchor: v } })); }} style={{ borderBottomWidth: 2 }} /></label>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="caps muted" title="Your data lives in this browser only">SAVED IN THIS BROWSER</span>
            <button className="chip" onClick={onExportBackup}>Export backup</button>
            <button className="chip" onClick={() => fileRef.current?.click()}>Import backup</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) onImportBackup(f); e.target.value = ''; }} />
            <span className="row wrap ml-auto" style={{ gap: 8 }}>
              <button className="chip" onClick={exportCsv}>Export CSV</button>
              <button className="chip" onClick={onRestore}>Restore sheet data</button>
              <button className="chip danger" onClick={onClearEntries}>Clear entries</button>
            </span>
          </div>
        </div>
      )}

      {!data.txns.length ? (
        <div className="col" style={{ border: '2px dashed var(--ink)', borderRadius: 'var(--r-card)', padding: '32px 20px', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <Coin size={64} />
          <span style={{ fontSize: 24 }}>No entries yet</span>
          <span className="muted" style={{ fontSize: 17, maxWidth: 380 }}>Type <span className="mono" style={{ fontSize: 14 }}>+500 wage</span> in Cash Flow Input and press SUBMIT. Your ledger, stream and readouts fill in from there.</span>
        </div>
      ) : (
        <>
          <div className="scroll-x">
            <div className="ledger" role="table" aria-label="Ledger">
              {HEADS.map(([label, right], i) => <div key={i} className={'th' + (right ? ' r' : '')} role="columnheader">{label}</div>)}
              {rows.map(r => {
                const t = r.t;
                const c = t ? catOf(t.cat) : null;
                const isOpen = !!t && open === t.id;
                return (
                  <Fragment key={r.key}>
                    {t ? (
                      <button className="td" aria-expanded={isOpen} aria-label="Details" onClick={() => setOpen(o => (o === t.id ? null : t.id))}
                        style={{ border: 0, borderBottom: '1.5px dashed var(--rule)', background: t.id === lastId ? 'var(--butter)' : 'transparent', padding: 0, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted2)' }}>{isOpen ? '▾' : '▸'}</button>
                    ) : <div className="td" />}
                    {cell(r, r.when, r.gap ? 'gap' : '')}
                    {cell(r, c
                      ? <span className="pill" style={{ background: c.tint }}><Icon src={c.icon} size={18} />{c.label}</span>
                      : <span className="pill gap" style={{ borderColor: 'rgba(0,0,0,.3)' }}><span style={{ opacity: .35, display: 'flex' }}><Icon src="assets/icon-coin.png" size={18} /></span>No Transactions</span>,
                      '', { padding: '5px 6px' })}
                    {cell(r, t ? t.memo : '—', r.gap ? 'gap' : '')}
                    {cell(r, t && t.amount > 0 ? money(t.amount) : '', 'r pos', { fontWeight: 600 }, false)}
                    {cell(r, t && t.amount < 0 ? money(t.amount) : '', 'r neg', { fontWeight: 600 }, false)}
                    {cell(r, sgn(r.bal), 'r' + (r.gap ? ' gap' : ''), { fontWeight: 700 }, false)}
                    {cell(r, t?.note || '', '', { fontFamily: 'var(--hand)', fontSize: 16, color: 'var(--note)', padding: 6 }, false)}
                    {isOpen && t && (
                      <div className="ledger-detail">
                        <span style={{ fontSize: 12 }}>{new Date(t.ts).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="muted" style={{ fontSize: 12 }}>{idr(t.amount, data.rate)}</span>
                        <label className="row grow" style={{ minWidth: 240, gap: 8 }}><span className="caps">NOTE</span>
                          <input className="field-u grow" value={t.note} onChange={e => setNote(t.id, e.target.value)} placeholder="add a note or receipt reference"
                            style={{ fontFamily: 'var(--hand)', fontSize: 17, color: 'var(--note)' }} /></label>
                        <button className="chip danger" style={{ fontFamily: 'var(--hand)', fontSize: 15 }} onClick={() => { onDelete(t.id); setOpen(null); }}>Delete entry</button>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
          {!filtered.length && <span className="muted" style={{ textAlign: 'center', padding: 8 }}>Nothing in this filter yet.</span>}
          {filtered.length > LIMIT && (
            <button className="link-btn" style={{ alignSelf: 'center', fontSize: 18 }} onClick={() => setShowAll(s => !s)}>
              {showAll ? 'show fewer' : `show all ${filtered.length} rows`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
