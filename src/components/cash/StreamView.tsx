import { useState } from 'react';
import type { AppData } from '../../lib/types';
import { obTotals } from '../../lib/calc';
import { MON, inRange, money, range } from '../../lib/util';
import { Icon } from '../Sprites';

const H = 240, GAP = 8, MINH = 28;

/** Sankey-style view: this month's income flowing into commitments and surplus. */
export function StreamView({ data, onFilter }: { data: AppData; onFilter: (f: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const month = range('month', 0, data.settings.payAnchor);
  const mTx = data.txns.filter(x => inRange(x.ts, month));
  const mIn = mTx.reduce((a, x) => a + Math.max(0, x.amount), 0);
  const t = obTotals(data.ob);
  const surplus = mIn - t.total;

  const srcMap: Record<string, number> = {};
  mTx.filter(x => x.amount > 0).forEach(x => { srcMap[x.memo] = (srcMap[x.memo] || 0) + x.amount; });
  let srcs = Object.entries(srcMap).sort((a, b) => b[1] - a[1]);
  if (srcs.length > 3) srcs = [...srcs.slice(0, 2), ['Other', srcs.slice(2).reduce((a, x) => a + x[1], 0)]];

  const list = [
    { id: 'family', label: 'Family support', v: t.family, tint: 'var(--blue)', icon: 'assets/icon-key.png', filter: 'family' },
    { id: 'personal', label: 'Personal fixed', v: t.personalOnly, tint: 'var(--butter)', icon: 'assets/icon-bag.png', filter: 'variable' },
    { id: 'subs', label: 'Subscriptions', v: t.subs, tint: 'var(--lilac)', icon: 'assets/icon-gem.png', filter: 'subs' },
    { id: 'surplus', label: 'Surplus → buckets', v: Math.max(0, surplus), tint: 'var(--stripe1)', icon: 'assets/icon-coin.png', filter: 'income' }
  ].filter(x => x.v > 0);

  const TT = Math.max(1, list.reduce((a, x) => a + x.v, 0)), base = Math.max(mIn, t.total, 1);
  const avail = H - GAP * Math.max(0, list.length - 1), rest = avail - MINH * list.length;
  let topR = 0, topL = 0;
  const geo = list.map(x => {
    const hr = rest > 0 ? MINH + rest * x.v / TT : avail / list.length, hl = x.v / TT * H;
    const g = { top: topR, hr, l0: topL, l1: topL + hl };
    topR += hr + GAP; topL += hl;
    return g;
  });
  const hb = hover !== null ? list[hover] : null;
  const note = hb
    ? `${hb.label} · ${money(hb.v)} · ${mIn ? Math.round(hb.v / mIn * 100) : 0}% of income`
    : surplus < 0 ? 'short by ' + money(-surplus) : money(surplus) + ' surplus';
  const inH = Math.round(Math.min(1, mIn / base) * H);

  return (
    <div className="card tnum" style={{ flex: '2 1 min(100%,560px)' }}>
      <div className="row wrap" style={{ alignItems: 'baseline' }}>
        <h2 className="card-title" style={{ margin: 0, fontWeight: 400 }}>Stream View</h2>
        <span className="small">{MON[month[0].getMonth()].toUpperCase()} · income → commitments</span>
        <span className="mono ml-auto" style={{ fontSize: 12, fontWeight: 700 }}>{note}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(96px,150px) minmax(24px,1fr) minmax(128px,210px)', height: H }}>
        <div className="col" style={{ height: H }}>
          <div className="col" style={{ height: inH, border: '2px solid var(--ink)', borderRadius: 'var(--r-box)', background: 'var(--green)', padding: 8, gap: 3, overflow: 'hidden' }}>
            <span className="caps">INCOME</span>
            <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{money(mIn)}</span>
            {srcs.map(([n, v]) => (
              <span key={n} className="row" style={{ justifyContent: 'space-between', gap: 4, fontSize: 14, lineHeight: 1.1 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</span>
                <span className="mono" style={{ fontSize: 11 }}>{money(v)}</span>
              </span>
            ))}
          </div>
          {surplus < 0 && (
            <div className="col" style={{ flex: 1, border: '2px solid var(--ink)', borderTop: 0, background: 'var(--rose)', padding: '6px 8px', overflow: 'hidden' }}>
              <span className="caps">SHORTFALL</span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{money(-surplus)}</span>
            </div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <svg viewBox={`0 0 300 ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }} role="img" aria-label="Income flowing into commitments">
            {list.map((x, i) => {
              const g = geo[i], r0 = g.top + 2, r1 = g.top + g.hr - 2;
              const d = `M0,${g.l0} C150,${g.l0} 150,${r0} 300,${r0} L300,${r1} C150,${r1} 150,${g.l1} 0,${g.l1} Z`;
              return (
                <path key={x.id} d={d} fill={x.tint} stroke="#2a2a28" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
                  opacity={hover === null || hover === i ? 0.95 : 0.35} style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onFilter(x.filter)}>
                  <title>{x.label}: {money(x.v)}</title>
                </path>
              );
            })}
          </svg>
        </div>
        <div style={{ position: 'relative', height: H }}>
          {list.map((x, i) => (
            <button key={x.id} onClick={() => onFilter(x.filter)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              style={{
                position: 'absolute', left: 0, right: 0, top: geo[i].top, height: geo[i].hr, border: '2px solid var(--ink)',
                borderRadius: 'var(--r-box)', background: x.tint, boxShadow: hover === i ? '2px 2px 0 var(--ink)' : 'none',
                padding: '0 8px', display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left', overflow: 'hidden'
              }}>
              <Icon src={x.icon} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.label}</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{money(x.v)}</span>
            </button>
          ))}
        </div>
      </div>
      <span className="note">Band thickness = dollars. Hover a band for its share; click a bucket to filter the ledger.</span>
    </div>
  );
}
