import type { Txn } from '../../lib/types';
import { DAY_MS, HATCH, MON, isoWeek, money, range, type RangeKind } from '../../lib/util';

const KINDS: [RangeKind, string][] = [['week', 'WEEKLY'], ['biweek', 'BI-WEEKLY'], ['month', 'MONTHLY'], ['year', 'YEARLY']];

/** Income this period vs the previous one. */
export function Readouts({ txns, payAnchor }: { txns: Txn[]; payAnchor: string }) {
  const incomeIn = ([s, e]: [Date, Date]) => txns.reduce((a, t) => {
    const d = new Date(t.ts);
    return t.amount > 0 && d >= s && d < e ? a + t.amount : a;
  }, 0);

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
      {KINDS.map(([k, label]) => {
        const cr = range(k, 0, payAnchor), pr = range(k, -1, payAnchor);
        const cur = incomeIn(cr), prev = incomeIn(pr), mx = Math.max(cur, prev, 1);
        const px = (v: number) => Math.max(3, Math.round(v / mx * 42));
        const e = new Date(+cr[1] - DAY_MS);
        const sub = k === 'week' ? 'ISO W' + isoWeek(cr[0])
          : k === 'biweek' ? `${MON[cr[0].getMonth()]} ${cr[0].getDate()}–${MON[e.getMonth()]} ${e.getDate()}`
          : k === 'month' ? MON[cr[0].getMonth()].toUpperCase() : String(cr[0].getFullYear());
        const pct = prev ? Math.round((cur / prev - 1) * 100) : null;
        const delta = pct === null ? (cur ? 'new' : '—') : (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '%';
        return (
          <div key={k} className="card tnum" style={{ padding: 12, gap: 6 }}>
            <div className="row mono" style={{ justifyContent: 'space-between', gap: 8, fontSize: 11, letterSpacing: '.1em' }}>
              <span style={{ fontWeight: 700 }}>{label}</span><span className="muted">{sub}</span>
            </div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 600 }}>{money(Math.round(cur), true)}</div>
            <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 46, borderBottom: '2px solid var(--ink)' }}>
              <div title="previous" style={{ width: 22, height: px(prev), border: '1.5px solid var(--ink)', borderBottom: 0, background: HATCH }} />
              <div title="current" style={{ width: 22, height: px(cur), border: '1.5px solid var(--ink)', borderBottom: 0, background: 'var(--stripe1)' }} />
              <span className={'mono ' + (pct !== null && pct < 0 ? 'neg' : 'pos')} style={{ fontSize: 12, fontWeight: 600, marginLeft: 6, paddingBottom: 4 }}>{delta}</span>
              <span className="mono ml-auto" style={{ fontSize: 11, paddingBottom: 4, color: 'rgba(0,0,0,.5)' }}>prev {money(Math.round(prev), true)}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
