import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppData, CatId, ObItem, Obligations, SubItem, SubStatus } from '../lib/types';
import type { Update } from '../lib/useLedger';
import { obTotals } from '../lib/calc';
import { MON, idr, money, nextDue, num, sod, uid } from '../lib/util';
import { Icon } from './Sprites';

const ORDER: Record<SubStatus, number> = { Active: 0, Cancelled: 1, Inactive: 2 };
const NEXT: Record<SubStatus, SubStatus> = { Active: 'Cancelled', Cancelled: 'Inactive', Inactive: 'Active' };

interface Props {
  data: AppData;
  update: Update;
  onPay: (item: { id: string; n: string; c: number | string }, cat: CatId) => void;
}

export function ObligationsTab({ data, update, onPay }: Props) {
  const [paid, setPaid] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const { ob, rate } = data;
  const t = obTotals(ob);

  const pay = (x: { id: string; n: string; c: number | string }, cat: CatId) => {
    if (!(num(x.c) > 0)) return;
    onPay(x, cat);
    setPaid(x.id);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPaid(null), 2500);
  };
  const updOb = <G extends keyof Obligations>(g: G, id: string, patch: Partial<Obligations[G][number]>) =>
    update(d => ({ ...d, ob: { ...d.ob, [g]: (d.ob[g] as Obligations[G][number][]).map(x => (x.id === id ? { ...x, ...patch } : x)) } }));
  const removeOb = (g: keyof Obligations, id: string) =>
    update(d => ({ ...d, ob: { ...d.ob, [g]: (d.ob[g] as { id: string }[]).filter(x => x.id !== id) } }));
  const addOb = (g: 'family' | 'personal') =>
    update(d => ({ ...d, ob: { ...d.ob, [g]: [...d.ob[g], { id: uid('o'), n: 'New item', c: 0, meta: '' }] } }));

  const kpis = [
    { label: 'FAMILY SUPPORT', v: t.family, bg: 'var(--blue)', fg: 'var(--ink)' },
    { label: 'PERSONAL OBLIGATIONS', v: t.personal, bg: 'var(--butter)', fg: 'var(--ink)' },
    { label: 'TOTAL OUTSIDE COMMITMENTS', v: t.total, bg: 'var(--ink)', fg: 'var(--paper)' },
    { label: 'DAILY AVERAGE (30d)', v: t.total / 30, bg: 'var(--paper)', fg: 'var(--ink)' },
    { label: 'ANNUALIZED', v: t.total * 12, bg: 'var(--paper)', fg: 'var(--ink)' }
  ];

  const groups: { g: 'family' | 'personal'; title: string; icon: string; cat: CatId; rows: ObItem[]; linked: boolean; sub: number }[] = [
    { g: 'family', title: 'Family Support Expense', icon: 'assets/icon-key.png', cat: 'family', rows: ob.family, linked: false, sub: t.family },
    { g: 'personal', title: 'Personal Fixed Obligation', icon: 'assets/icon-bag.png', cat: 'living', rows: ob.personal, linked: true, sub: t.personal }
  ];

  const today = sod(new Date());
  const subs = ob.subs.map(x => ({ x, ...nextDue(x.d, today) }))
    .sort((a, b) => ORDER[a.x.status] - ORDER[b.x.status] || a.days - b.days);
  const activeCount = ob.subs.filter(x => x.status === 'Active').length;

  const payBtn = (x: { id: string; n: string; c: number | string }, cat: CatId, style = {}) => (
    <button className="chip" title="Log this payment to Cashflow" disabled={!(num(x.c) > 0)}
      style={{ borderRadius: 10, fontSize: 15, padding: '0 8px', background: paid === x.id ? 'var(--green)' : undefined, ...style }}
      onClick={() => pay(x, cat)}>{paid === x.id ? 'paid ✓' : 'Pay'}</button>
  );

  return (
    <>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16 }}>
        {kpis.map(k => (
          <div key={k.label} className="card" style={{ background: k.bg, color: k.fg, padding: '10px 14px', gap: 2 }}>
            <span className="caps-11" style={{ letterSpacing: '.08em' }}>{k.label}</span>
            <span className="mono" style={{ fontSize: 'clamp(18px,2vw,24px)', fontWeight: 600 }}>{money(k.v)}</span>
            <span className="mono" style={{ fontSize: 12, opacity: .75 }}>{idr(k.v, rate)}</span>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,520px),1fr))', gap: 22, alignItems: 'start' }}>
        <div className="col" style={{ gap: 22, minWidth: 0 }}>
          {groups.map(g => (
            <div key={g.g} className="card" style={{ gap: 6 }}>
              <div className="row">
                <Icon src={g.icon} size={26} />
                <h2 className="card-title" style={{ margin: 0, fontWeight: 400 }}>{g.title}</h2>
                <button className="chip ml-auto" onClick={() => addOb(g.g)}>+ add</button>
              </div>
              <div className="scroll-x">
                <div className="gtable" style={{ minWidth: 480, gridTemplateColumns: 'minmax(0,1.3fr) 76px 112px minmax(0,1.2fr) 60px 22px' }}>
                  <span className="th">ITEM</span><span className="th">USD/MO</span><span className="th">IDR</span><span className="th">CATEGORY · NOTES</span><span className="th">&nbsp;</span><span className="th">&nbsp;</span>
                  {g.rows.map(o => (
                    <div key={o.id} style={{ display: 'contents' }}>
                      <input className="td" aria-label="Item" value={o.n} onChange={e => updOb(g.g, o.id, { n: e.target.value })}
                        style={{ border: 0, borderBottom: '1.5px dashed var(--rule2)', background: 'transparent', fontFamily: 'var(--hand)', fontSize: 17, padding: '5px 0' }} />
                      <input className="td" aria-label="USD per month" type="number" step="0.01" value={o.c} onChange={e => updOb(g.g, o.id, { c: e.target.value })}
                        style={{ border: 0, borderBottom: '1.5px dashed var(--rule2)', background: 'transparent', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }} />
                      <span className="td muted" style={{ whiteSpace: 'nowrap', fontSize: 12, overflow: 'hidden' }}>{idr(num(o.c), rate)}</span>
                      <input className="td" aria-label="Category and notes" value={o.meta} onChange={e => updOb(g.g, o.id, { meta: e.target.value })}
                        style={{ border: 0, borderBottom: '1.5px dashed var(--rule2)', background: 'transparent', fontFamily: 'var(--hand)', fontSize: 15, color: 'var(--note)', padding: '6px 0' }} />
                      {payBtn(o, g.cat, { padding: 0, justifyContent: 'center' })}
                      <button className="x-btn" title="Delete" aria-label={`Delete ${o.n}`} onClick={() => removeOb(g.g, o.id)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              {g.linked && (
                <div className="row" style={{ gap: 8, padding: '6px 0', borderBottom: '1.5px dashed var(--rule2)' }}>
                  <span style={{ fontSize: 17 }}>Subscriptions total</span>
                  <span className="tag" style={{ fontSize: 10, fontWeight: 700, background: 'var(--green)' }}>LINKED</span>
                  <span className="mono ml-auto" style={{ fontSize: 13, fontWeight: 600 }}>{money(t.subs)}</span>
                  <span className="mono muted" style={{ fontSize: 12, minWidth: 110, textAlign: 'right' }}>{idr(t.subs, rate)}</span>
                </div>
              )}
              <div className="row" style={{ alignItems: 'baseline', gap: 8, paddingTop: 4 }}>
                <span style={{ fontSize: 19 }}>Subtotal</span>
                <span className="mono ml-auto" style={{ fontSize: 17, fontWeight: 700 }}>{money(g.sub)}</span>
                <span className="mono muted" style={{ fontSize: 12, minWidth: 110, textAlign: 'right' }}>{idr(g.sub, rate)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ gap: 6 }}>
          <div className="row">
            <Icon src="assets/icon-gem.png" size={26} />
            <h2 className="card-title" style={{ margin: 0, fontWeight: 400 }}>Monthly Subscriptions &amp; Services</h2>
            <button className="chip ml-auto" onClick={() => update(d => ({ ...d, ob: { ...d.ob, subs: [...d.ob.subs, { id: uid('o'), n: 'New service', d: 3, c: 0, status: 'Active', note: '' }] } }))}>+ add</button>
          </div>
          <span style={{ fontSize: 15, color: 'var(--muted)' }}>Sorted by next due date. Click a status to cycle Active → Cancelled → Inactive.</span>
          <div className="col">
            {subs.map(({ x, date, days }) => <SubRow key={x.id} x={x} date={date} days={days} rate={rate}
              upd={p => updOb('subs', x.id, p)} remove={() => removeOb('subs', x.id)} payBtn={payBtn(x, 'subs')} />)}
          </div>
          <div className="row wrap" style={{ alignItems: 'baseline', gap: 8, paddingTop: 4 }}>
            <span style={{ fontSize: 19 }}>Active total</span>
            <span className="mono muted" style={{ fontSize: 12 }}>{activeCount} active</span>
            <span className="mono ml-auto" style={{ fontSize: 17, fontWeight: 700 }}>{money(t.subs)}</span>
            <span className="mono muted" style={{ fontSize: 12 }}>{money(t.subs * 12)}/yr</span>
          </div>
        </div>
      </section>
    </>
  );
}

function SubRow({ x, date, days, rate, upd, remove, payBtn }: { x: SubItem; date: Date; days: number; rate: number; upd: (p: Partial<SubItem>) => void; remove: () => void; payBtn: ReactNode }) {
  const act = x.status === 'Active';
  const alert = act ? (days <= 3 ? `DUE ${days === 0 ? 'TODAY' : 'IN ' + days + 'd'}` : `UPCOMING (${days}d)`) : 'INACTIVE';
  const alertBg = act ? (days <= 3 ? 'var(--rose)' : days <= 14 ? 'var(--butter)' : 'var(--white)') : 'var(--white)';
  const statusBg = act ? 'var(--green)' : x.status === 'Cancelled' ? 'var(--peach)' : '#e8e4d8';
  const op = act ? 1 : .45;
  return (
    <div className="col" style={{ gap: 4, padding: '8px 0', borderBottom: '1.5px dashed var(--rule2)' }}>
      <div className="row wrap" style={{ gap: 8 }}>
        <input aria-label="Service" value={x.n} onChange={e => upd({ n: e.target.value })}
          style={{ flex: 1, minWidth: 110, border: 0, background: 'transparent', fontSize: 19, padding: 0, opacity: op }} />
        <span className="tag" style={{ background: alertBg }}>{alert}</span>
        <button className="chip" style={{ borderRadius: 10, fontSize: 15, padding: '0 8px', background: statusBg }} onClick={() => upd({ status: NEXT[x.status] || 'Active' })}>{x.status}</button>
        {payBtn}
        <button className="x-btn" title="Delete" aria-label={`Delete ${x.n}`} onClick={remove}>×</button>
      </div>
      <div className="row wrap mono" style={{ gap: 12, fontSize: 12, opacity: op }}>
        <label className="row" style={{ gap: 3 }}>$<input className="field-u mono" type="number" step="0.01" aria-label="Monthly cost" value={x.c}
          onChange={e => upd({ c: e.target.value })} style={{ width: 62, fontWeight: 600 }} /></label>
        <span className="muted">{idr(num(x.c), rate)}</span>
        <label className="row" style={{ gap: 4 }}>due day<input className="field-u mono" type="number" min={1} max={31} value={x.d}
          onChange={e => upd({ d: e.target.value })} style={{ width: 38 }} /></label>
        <span className="muted">next {MON[date.getMonth()]} {date.getDate()}</span>
        <input aria-label="Notes" value={x.note} onChange={e => upd({ note: e.target.value })} placeholder="notes"
          style={{ flex: 1, minWidth: 120, border: 0, background: 'transparent', fontFamily: 'var(--hand)', fontSize: 15, color: 'var(--note)' }} />
      </div>
    </div>
  );
}
