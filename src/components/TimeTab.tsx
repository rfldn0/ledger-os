import { useState } from 'react';
import type { AppData, Portfolio } from '../lib/types';
import type { Update } from '../lib/useLedger';
import { PCOLORS } from '../lib/cats';
import { obTotals, occurrences, type Occurrence } from '../lib/calc';
import { DOW, MON, addDays, fromIso, idr, iso, isoWeek, money, sgn, sod, uid, weekStart } from '../lib/util';
import { Modal } from './Modal';
import { Icon } from './Sprites';

interface LogState {
  pid: string;
  date: string;
  time: string;
  hours: string;
  existing: boolean;
  mode: 'one' | 'rec';
  days: number[];
  ends: 'never' | 'on';
  until: string;
}
interface NewP { name: string; rate: string; color: string; fromModal: boolean }

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function TimeTab({ data, update }: { data: AppData; update: Update }) {
  const [weekOff, setWeekOff] = useState(0);
  const [modal, setModal] = useState<LogState | null>(null);
  const [newP, setNewP] = useState<NewP | null>(null);
  const { portfolios, events, rules, actual } = data;

  const today = sod(new Date()), todayIso = iso(today);
  const ws = addDays(weekStart(today), weekOff * 7), we = addDays(ws, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const evHours = (pid: string, di: string) => events.filter(e => e.pid === pid && e.date === di).reduce((a, e) => a + e.hours, 0);
  const occHours = (occ: Occurrence[], pid: string, di: string) => occ.filter(o => o.pid === pid && o.date === di).reduce((a, o) => a + o.hours, 0);

  // week matrix
  const occW = occurrences(rules, ws, we);
  let weekMoney = 0, weekHrs = 0;
  const matrix = portfolios.map(p => {
    let tot = 0;
    const cells = days.map(d => {
      const di = iso(d), ev = evHours(p.id, di), oc = occHours(occW, p.id, di), hrs = ev + oc;
      tot += hrs;
      return { di, hrs, oc };
    });
    weekMoney += tot * p.rate; weekHrs += tot;
    return { p, cells, tot };
  });

  // month of the viewed week
  const mid = addDays(ws, 3);
  const ms = new Date(mid.getFullYear(), mid.getMonth(), 1), me = new Date(mid.getFullYear(), mid.getMonth() + 1, 1);
  const weeks: Date[] = [];
  for (let w = weekStart(ms); w < me; w = addDays(w, 7)) weeks.push(w);
  const occM = occurrences(rules, weeks[0], addDays(weeks[weeks.length - 1], 7));
  const hoursOn = (pid: string, d: Date) => { const di = iso(d); return evHours(pid, di) + occHours(occM, pid, di); };
  const dayHours = (d: Date) => portfolios.reduce((a, p) => a + hoursOn(p.id, d), 0);
  const dayMoney = (d: Date) => portfolios.reduce((a, p) => a + hoursOn(p.id, d) * p.rate, 0);

  let tH = 0, tC = 0, tA = 0, anyA = false;
  const incWeeks = weeks.map((w, i) => {
    let h = 0, c = 0;
    for (let j = 0; j < 7; j++) { const d = addDays(w, j); h += dayHours(d); c += dayMoney(d); }
    const key = iso(w), a = actual[key], has = a !== undefined && a !== '' && a !== null, v = has ? +a - c : null;
    tH += h; tC += c; if (has) { tA += +a; anyA = true; }
    const e = addDays(w, 6);
    return { key, label: 'W' + (i + 1), range: `${MON[w.getMonth()]} ${w.getDate()}–${e.getDate()}`, h, c, a: has ? a : '', v };
  });
  const tV = anyA ? tA - tC : null;
  const obTotal = obTotals(data.ob).total, net = tA - obTotal;
  const maxH = Math.max(1, ...weeks.flatMap(w => Array.from({ length: 7 }, (_, j) => dayHours(addDays(w, j)))));

  const pCards = portfolios.map(p => {
    let h = 0;
    for (let d = new Date(ms); d < me; d = addDays(d, 1)) h += hoursOn(p.id, d);
    const rc = rules.filter(r => r.pid === p.id).length;
    return { p, h, rc };
  });

  // modal helpers
  const openModal = (pid: string, date: string) => {
    const ex = evHours(pid, date);
    setModal({ pid, date, time: '09:00', hours: String(ex || 4), existing: ex > 0, mode: 'one', days: [fromIso(date).getDay()], ends: 'never', until: '' });
  };
  const setM = (p: Partial<LogState>) => setModal(m => (m ? { ...m, ...p } : m));
  const rulesOn = (pid: string, date: string) => {
    const d = fromIso(date);
    return rules.filter(r => r.pid === pid && r.days.includes(d.getDay()) && fromIso(r.start) <= d && (!r.until || fromIso(r.until) >= d));
  };
  const saveModal = () => {
    if (!modal) return;
    const m = modal, hrs = +m.hours;
    if (!(hrs > 0) || !m.pid) return;
    if (m.mode === 'one') {
      update(d => ({ ...d, events: [...d.events.filter(e => !(e.pid === m.pid && e.date === m.date)), { id: uid('e'), pid: m.pid, date: m.date, hours: hrs }] }));
    } else {
      if (!m.days.length) return;
      update(d => ({ ...d, rules: [...d.rules, { id: uid('r'), pid: m.pid, days: m.days, time: m.time, hours: hrs, start: m.date, until: m.ends === 'on' && m.until ? m.until : null }] }));
    }
    setModal(null);
  };
  const summary = (m: LogState) => {
    const p = portfolios.find(x => x.id === m.pid), rate = p ? p.rate : 0, hrs = +m.hours || 0;
    const D = DOW.map(x => x[0] + x.slice(1).toLowerCase());
    if (m.mode === 'one') { const d = fromIso(m.date); return `${D[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()} at ${m.time} · ${hrs}h${rate ? ' · ' + money(hrs * rate) : ''}`; }
    if (!m.days.length) return 'Pick at least one day';
    const base = 'Every ' + DAY_ORDER.filter(d => m.days.includes(d)).map(d => D[d]).join(' & ') + ' at ' + m.time;
    if (m.ends === 'on' && m.until) {
      let n = 0;
      const u = fromIso(m.until);
      for (let d = fromIso(m.date); d <= u; d = addDays(d, 1)) if (m.days.includes(d.getDay())) n++;
      return `${base} until ${MON[u.getMonth()]} ${u.getDate()} · ${n} sessions${rate ? ' · ' + money(n * hrs * rate) : ''}`;
    }
    return base + (rate ? ` · ${money(m.days.length * hrs * rate)}/week` : ' · ongoing');
  };

  const openNewP = (fromModal: boolean) => {
    const used = portfolios.map(p => p.color);
    setNewP({ name: '', rate: '0', color: PCOLORS.find(c => !used.includes(c)) || PCOLORS[0], fromModal });
  };
  const saveNewP = () => {
    if (!newP) return;
    const name = newP.name.trim();
    if (!name) return;
    const p: Portfolio = { id: uid('p'), name, rate: Math.max(0, +newP.rate || 0), color: newP.color };
    update(d => ({ ...d, portfolios: [...d.portfolios, p] }));
    if (newP.fromModal) setM({ pid: p.id });
    setNewP(null);
  };
  const removeP = (p: Portfolio) => {
    if (!window.confirm(`Delete "${p.name}" and all its logged time?`)) return;
    update(d => ({ ...d, portfolios: d.portfolios.filter(x => x.id !== p.id), events: d.events.filter(e => e.pid !== p.id), rules: d.rules.filter(r => r.pid !== p.id) }));
  };
  const on = (b: boolean) => (b ? 'var(--green)' : 'var(--white)');
  const wEnd = days[6];
  const inputBox = { padding: 5, fontFamily: 'var(--mono)', fontSize: 12 };

  return (
    <>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16 }}>
        {pCards.map(({ p, h, rc }) => (
          <div key={p.id} className="card" style={{ padding: '12px 14px', gap: 4 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 14, height: 14, background: p.color, border: '2px solid var(--ink)' }} />
              <span style={{ fontSize: 22 }}>{p.name}</span>
              <span className="mono muted ml-auto" style={{ fontSize: 12 }}>{p.rate ? money(p.rate) + '/hr' : 'unpaid'}</span>
              <button className="x-btn" title="Delete activity" aria-label={`Delete ${p.name}`} onClick={() => removeP(p)}>×</button>
            </div>
            <span className="mono" style={{ fontSize: 26, fontWeight: 600 }}>{p.rate ? money(h * p.rate) : h + 'h'}</span>
            <span className="small">{h}h in {MON[ms.getMonth()]}{rc ? ` · ${rc} recurring` : ''}</span>
          </div>
        ))}
        <button className="add-slot col" onClick={() => openNewP(false)} style={{ minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 21 }}>
          + New activity<span style={{ fontSize: 15, color: 'var(--muted)' }}>work, study, gym, anything</span>
        </button>
      </section>

      <section className="card">
        <div className="row wrap" style={{ gap: 12 }}>
          <button className="btn" aria-label="Previous week" onClick={() => setWeekOff(w => w - 1)} style={{ width: 34, height: 30, padding: 0, fontSize: 20, borderRadius: 10 }}>‹</button>
          <span style={{ fontSize: 23 }}>Week {isoWeek(ws)} · {MON[ws.getMonth()]} {ws.getDate()}–{MON[wEnd.getMonth()]} {wEnd.getDate()}</span>
          <button className="btn" aria-label="Next week" onClick={() => setWeekOff(w => w + 1)} style={{ width: 34, height: 30, padding: 0, fontSize: 20, borderRadius: 10 }}>›</button>
          {weekOff !== 0 && <button className="link-btn" onClick={() => setWeekOff(0)}>this week</button>}
          <span className="mono ml-auto" style={{ fontSize: 13, fontWeight: 700 }}>WEEK {weekHrs}h · {money(weekMoney)}</span>
          <button className="chip danger" onClick={() => {
            if (window.confirm('Reset the timesheet? This clears all logged hours, recurring rules and actual received amounts. Activities are kept.'))
              update(d => ({ ...d, events: [], rules: [], actual: {} }));
          }}>Reset timesheet</button>
        </div>
        <div className="scroll-x">
          <div className="tgrid">
            <div className="hd" />
            {days.map(d => (
              <div key={iso(d)} className="hd dl col" style={{ background: iso(d) === todayIso ? 'var(--butter)' : 'transparent' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em' }}>{DOW[d.getDay()]}</span>
                <span className="muted" style={{ fontSize: 11 }}>{MON[d.getMonth()]} {d.getDate()}</span>
              </div>
            ))}
            <div className="hd sl" style={{ fontSize: 11, fontWeight: 700 }}>Σ HRS</div>
            {!portfolios.length && <div className="rb" style={{ gridColumn: '1 / -1', padding: 14, fontFamily: 'var(--hand)', fontSize: 17 }}>Add an activity above to start logging time.</div>}
            {matrix.map(({ p, cells, tot }) => (
              <div key={p.id} style={{ display: 'contents' }}>
                <div className="rb row" style={{ padding: '8px 6px', gap: 6, fontFamily: 'var(--hand)', fontSize: 17 }}>
                  <span style={{ width: 10, height: 10, flex: 'none', background: p.color, border: '1.5px solid var(--ink)' }} />{p.name}
                </div>
                {cells.map(c => (
                  <button key={c.di} className="cell-btn dl rb" title={`${p.name} · ${c.di}`} onClick={() => openModal(p.id, c.di)}>
                    <span style={{
                      background: c.hrs ? p.color : 'transparent', color: c.hrs ? 'var(--ink)' : 'rgba(0,0,0,.3)',
                      border: c.oc ? '2px dashed var(--ink)' : c.hrs ? '2px solid var(--ink)' : '0'
                    }}>{c.hrs ? (c.oc ? '↻ ' : '') + c.hrs + 'h' : '+'}</span>
                  </button>
                ))}
                <div className="sl rb row" style={{ padding: '8px 6px', fontWeight: 700 }}>{tot}h</div>
              </div>
            ))}
          </div>
        </div>
        <span className="note" style={{ fontSize: 16 }}>Click a cell to log or edit its hours (saving replaces the day's total). ↻ dashed = recurring.</span>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,460px),1fr))', gap: 22, alignItems: 'start' }}>
        <div className="card" style={{ gap: 10 }}>
          <div className="row"><Icon src="assets/icon-bill.png" size={26} /><h2 className="card-title" style={{ margin: 0, fontWeight: 400 }}>Income Breakdown · {MON[ms.getMonth()]} {ms.getFullYear()}</h2></div>
          <div className="scroll-x">
            <div className="gtable" style={{ minWidth: 420, gridTemplateColumns: 'minmax(0,1.3fr) 54px 88px 92px 80px' }}>
              <span className="th">PERIOD</span><span className="th r">HOURS</span><span className="th r">CALCULATED</span><span className="th r">ACTUAL</span><span className="th r">VARIANCE</span>
              {incWeeks.map(w => (
                <div key={w.key} style={{ display: 'contents' }}>
                  <span className="td" style={{ whiteSpace: 'nowrap' }}><b>{w.label}</b> <span className="muted" style={{ fontSize: 11 }}>{w.range}</span></span>
                  <span className="td r">{w.h}</span>
                  <span className="td r">{money(w.c)}</span>
                  <label className="td row" style={{ justifyContent: 'flex-end', gap: 2, padding: '4px 0' }}>$
                    <input type="number" step="0.01" aria-label={`Actual received ${w.label}`} value={w.a} placeholder="—"
                      onChange={e => { const v = e.target.value; update(d => ({ ...d, actual: { ...d.actual, [w.key]: v } })); }}
                      style={{ width: 64, border: 0, borderBottom: '1.5px solid var(--ink)', background: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, textAlign: 'right', padding: 2 }} />
                  </label>
                  <span className={'td r ' + (w.v === null ? '' : w.v < 0 ? 'neg' : 'pos')} style={{ fontWeight: 600, color: w.v === null ? 'rgba(0,0,0,.4)' : undefined }}>
                    {w.v === null ? '—' : (w.v >= 0 ? '+' : '−') + money(w.v)}</span>
                </div>
              ))}
              <span style={{ padding: '8px 0', fontWeight: 700 }}>Total</span>
              <span className="r" style={{ padding: '8px 0', fontWeight: 700 }}>{tH}</span>
              <span className="r" style={{ padding: '8px 0', fontWeight: 700 }}>{money(tC)}</span>
              <span className="r" style={{ padding: '8px 0', fontWeight: 700 }}>{anyA ? money(tA) : '—'}</span>
              <span className={'r ' + (tV !== null && tV < 0 ? 'neg' : 'pos')} style={{ padding: '8px 0', fontWeight: 700 }}>{tV === null ? '—' : (tV >= 0 ? '+' : '−') + money(tV)}</span>
            </div>
          </div>
          <div className="box" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', overflow: 'hidden' }}>
            <div className="col" style={{ padding: '10px 12px', gap: 2, background: 'var(--peach)' }}>
              <span className="caps">LESS OUTSIDE EXPENSES</span>
              <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>−{money(obTotal)}</span>
            </div>
            <div className="col" style={{ padding: '10px 12px', gap: 2, background: 'var(--green)' }}>
              <span className="caps">NET REMAINDER</span>
              <span className={'mono ' + (net < 0 ? 'neg' : 'pos')} style={{ fontSize: 20, fontWeight: 700 }}>{sgn(net)}</span>
              <span className="mono" style={{ fontSize: 12 }}>{idr(net, data.rate)}</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ gap: 10 }}>
          <h2 className="card-title" style={{ margin: 0, fontWeight: 400 }}>Weekly Work Hours Schedule</h2>
          <div className="mono" style={{ display: 'grid', gridTemplateColumns: `80px repeat(${weeks.length},minmax(0,1fr)) 56px`, fontSize: 13, border: '2px solid var(--ink)', background: 'var(--white)' }}>
            <span className="caps" style={{ padding: 6, borderBottom: '2px solid var(--ink)' }}>DAY</span>
            {weeks.map((w, i) => (
              <span key={iso(w)} className="caps" style={{ padding: '6px 2px', borderBottom: '2px solid var(--ink)', borderLeft: '1.5px dashed var(--rule2)', textAlign: 'center', background: iso(w) === iso(ws) ? 'var(--butter)' : 'transparent' }}>W{i + 1}</span>
            ))}
            <span className="caps" style={{ padding: 6, borderBottom: '2px solid var(--ink)', borderLeft: '2px solid var(--ink)', textAlign: 'right' }}>TOTAL</span>
            {DAY_ORDER.map(dow => {
              const off = (dow + 6) % 7;
              let tot = 0;
              const cells = weeks.map(w => { const h = dayHours(addDays(w, off)); tot += h; return { w, h, k: h / maxH }; });
              return (
                <div key={dow} style={{ display: 'contents' }}>
                  <span style={{ padding: 6, borderBottom: '1.5px dashed var(--rule2)', fontFamily: 'var(--hand)', fontSize: 16 }}>{DOW[dow][0] + DOW[dow].slice(1).toLowerCase()}</span>
                  {cells.map(c => (
                    <span key={iso(c.w)} style={{
                      margin: 3, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600,
                      background: c.h ? `rgba(111,154,95,${(.2 + c.k * .8).toFixed(2)})` : 'transparent',
                      color: c.h ? (c.k > .6 ? '#fff' : 'var(--ink)') : 'rgba(0,0,0,.3)',
                      outline: iso(c.w) === iso(ws) ? '2px solid var(--stripe3)' : 'none'
                    }}>{c.h || '·'}</span>
                  ))}
                  <span style={{ padding: 6, borderBottom: '1.5px dashed var(--rule2)', borderLeft: '2px solid var(--ink)', textAlign: 'right', fontWeight: 700 }}>{tot}</span>
                </div>
              );
            })}
          </div>
          <span className="note" style={{ fontSize: 16 }}>Follows the week you're viewing above (highlighted). Darker = longer day.</span>
        </div>
      </section>

      {modal && (
        <Modal onClose={() => setModal(null)} label={modal.existing ? 'Edit time' : 'Log time'} z={10}>
          <div className="row"><span className="modal-title">{modal.existing ? 'Edit time' : 'Log time'}</span><button className="x-btn ml-auto" style={{ fontSize: 26 }} aria-label="Close" onClick={() => setModal(null)}>×</button></div>
          <div className="row" style={{ gap: 8 }}>
            <select className="field-box grow" aria-label="Activity" value={modal.pid} onChange={e => setM({ pid: e.target.value })} style={{ fontSize: 18, padding: 6 }}>
              {portfolios.map(p => <option key={p.id} value={p.id}>{p.rate ? `${p.name} · ${money(p.rate)}/hr` : `${p.name} · unpaid`}</option>)}
            </select>
            <button className="chip" style={{ borderRadius: 10, padding: '0 10px' }} onClick={() => openNewP(true)}>+ New</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr .8fr', gap: 8 }}>
            <label className="caps col" style={{ gap: 3 }}>DATE<input className="field-box" type="date" value={modal.date} onChange={e => e.target.value && setM({ date: e.target.value })} style={inputBox} /></label>
            <label className="caps col" style={{ gap: 3 }}>START<input className="field-box" type="time" value={modal.time} onChange={e => setM({ time: e.target.value })} style={inputBox} /></label>
            <label className="caps col" style={{ gap: 3 }}>HOURS<input className="field-box" type="number" min={0.25} step={0.25} value={modal.hours} onChange={e => setM({ hours: e.target.value })} style={inputBox}
              onKeyDown={e => { if (e.key === 'Enter') saveModal(); }} /></label>
          </div>
          <div className="box" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderRadius: 14, overflow: 'hidden' }}>
            <button aria-pressed={modal.mode === 'one'} onClick={() => setM({ mode: 'one' })} style={{ border: 0, padding: 6, fontSize: 18, background: on(modal.mode === 'one') }}>One-Time</button>
            <button aria-pressed={modal.mode === 'rec'} onClick={() => setM({ mode: 'rec' })} style={{ border: 0, borderLeft: '2px solid var(--ink)', padding: 6, fontSize: 18, background: on(modal.mode === 'rec') }}>Recurring</button>
          </div>
          {modal.mode === 'rec' && (
            <div className="col" style={{ gap: 8, padding: 10, border: '1.5px dashed var(--ink)', borderRadius: 6 }}>
              <span style={{ fontSize: 17 }}>Every</span>
              <div className="row wrap" style={{ gap: 5 }}>
                {DAY_ORDER.map(d => {
                  const a = modal.days.includes(d);
                  return <button key={d} aria-pressed={a} onClick={() => setM({ days: a ? modal.days.filter(x => x !== d) : [...modal.days, d] })}
                    style={{ width: 38, height: 32, border: '2px solid var(--ink)', borderRadius: 6, fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, background: on(a) }}>{DOW[d].slice(0, 2)}</button>;
                })}
              </div>
              <div className="row wrap" style={{ gap: 8 }}>
                <span style={{ fontSize: 17 }}>Ends</span>
                <button className="chip" style={{ background: on(modal.ends === 'never') }} onClick={() => setM({ ends: 'never' })}>never</button>
                <button className="chip" style={{ background: on(modal.ends === 'on') }} onClick={() => { const u = fromIso(modal.date); u.setMonth(u.getMonth() + 3); setM({ ends: 'on', until: modal.until || iso(u) }); }}>on date</button>
                {modal.ends === 'on' && <input className="field-box" type="date" value={modal.until} onChange={e => setM({ until: e.target.value })} style={{ ...inputBox, width: 'auto', padding: '3px 5px' }} />}
              </div>
            </div>
          )}
          <div className="mono box" style={{ fontSize: 12, background: 'var(--green)', border: '1.5px solid var(--ink)', padding: '6px 10px', borderRadius: 4 }}>{summary(modal)}</div>
          <div className="row wrap">
            {modal.existing && <button className="btn danger" style={{ fontSize: 17 }} onClick={() => { const m = modal; update(d => ({ ...d, events: d.events.filter(e => !(e.pid === m.pid && e.date === m.date)) })); setModal(null); }}>Delete entry</button>}
            {rulesOn(modal.pid, modal.date).length > 0 && <button className="btn danger" style={{ fontSize: 17 }} onClick={() => { const ids = rulesOn(modal.pid, modal.date).map(r => r.id); update(d => ({ ...d, rules: d.rules.filter(r => !ids.includes(r.id)) })); setModal(null); }}>Delete ↻ rule</button>}
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary sm" onClick={saveModal}>Save</button>
          </div>
        </Modal>
      )}

      {newP && (
        <Modal onClose={() => setNewP(null)} label="New activity" maxWidth={380} z={20}>
          <div className="row"><span className="modal-title">New activity</span><button className="x-btn ml-auto" style={{ fontSize: 26 }} aria-label="Close" onClick={() => setNewP(null)}>×</button></div>
          <label className="caps col" style={{ gap: 3 }}>NAME
            <input className="field-box" value={newP.name} autoFocus placeholder="e.g. Working, Study, Gym" onChange={e => { const v = e.target.value; setNewP(n => n && { ...n, name: v }); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveNewP(); } }} style={{ fontFamily: 'var(--hand)', fontSize: 19, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }} /></label>
          <label className="caps col" style={{ gap: 3 }}>HOURLY RATE ($) · 0 IF UNPAID
            <input className="field-box" type="number" min={0} step={0.5} value={newP.rate} onChange={e => { const v = e.target.value; setNewP(n => n && { ...n, rate: v }); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveNewP(); } }} style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 400 }} /></label>
          <div className="caps col" style={{ gap: 6 }}>COLOR
            <div className="row wrap" style={{ gap: 8 }}>
              {PCOLORS.map(hex => (
                <button key={hex} aria-label={`Color ${hex}`} aria-pressed={newP.color === hex} onClick={() => setNewP(n => n && { ...n, color: hex })}
                  style={{ width: 30, height: 30, border: '2px solid var(--ink)', borderRadius: 4, background: hex, boxShadow: newP.color === hex ? '0 0 0 3px var(--stripe3)' : 'none' }} />
              ))}
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setNewP(null)}>Cancel</button>
            <button className="btn-primary sm" style={{ opacity: newP.name.trim() ? 1 : .4 }} onClick={saveNewP}>Add</button>
          </div>
        </Modal>
      )}
    </>
  );
}
