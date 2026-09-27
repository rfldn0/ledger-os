import type { AppData } from '../../lib/types';
import { dueSoon, obTotals, totals } from '../../lib/calc';
import { DAY_MS, HATCH, MON, idr, inRange, money, range, sgn, sod } from '../../lib/util';
import { Icon } from '../Sprites';

export function Hero({ data, unalloc }: { data: AppData; unalloc: number }) {
  const today = sod(new Date());
  const anchor = data.settings.payAnchor;
  const month = range('month', 0, anchor);
  const mTx = data.txns.filter(x => inRange(x.ts, month));
  const mIn = mTx.reduce((a, x) => a + Math.max(0, x.amount), 0);
  const mOut = mTx.reduce((a, x) => a + Math.max(0, -x.amount), 0);
  const obT = obTotals(data.ob).total;
  const surplus = mIn - obT;
  const lIn = data.txns.filter(x => x.amount > 0 && inRange(x.ts, range('month', -1, anchor))).reduce((a, x) => a + x.amount, 0);
  const monName = MON[month[0].getMonth()];

  let headline: string;
  if (!data.txns.length) headline = 'Log your first entry to see your month.';
  else if (lIn > 0) { const d = surplus - (lIn - obT); headline = "You're " + money(d) + (d >= 0 ? ' ahead of ' : ' behind ') + 'last month.'; }
  else if (surplus >= 0) headline = unalloc > 0
    ? `Income covers every commitment this month, with ${money(unalloc)} not yet in a bucket.`
    : 'Income covers every commitment this month, and the surplus is all in buckets.';
  else headline = `Commitments are ${money(-surplus)} more than income logged this month.`;

  const nets = Array.from({ length: 6 }, (_, k) => {
    const i = k - 5, r = range('month', i, anchor), tx = data.txns.filter(x => inRange(x.ts, r));
    return { i, a: r[0], v: tx.reduce((q, x) => q + x.amount, 0), any: tx.length > 0 };
  });
  const nMax = Math.max(1, ...nets.map(n => Math.abs(n.v)));

  const { inflow, outflow, balance } = totals(data);
  const due = dueSoon(data.ob.subs, 14, today);
  const dueSum = due.reduce((a, x) => a + +x.c, 0);
  const daysIn = Math.max(1, Math.round((+today - +month[0]) / DAY_MS) + 1);
  const vel = (mIn - mOut) / daysIn;
  const nd = due[0];
  const side = [
    { label: 'BALANCE NOW', icon: 'assets/icon-coin.png', bg: 'var(--paper)', value: sgn(balance), cls: balance < 0 ? 'neg' : '', sub: `${money(inflow)} in · ${money(outflow)} out` },
    { label: 'CASH VELOCITY', icon: 'assets/icon-bill.png', bg: 'var(--paper)', value: (vel < 0 ? '−' : '+') + money(Math.round(vel * 100) / 100) + '/day', cls: vel < 0 ? 'neg' : 'pos', sub: `${sgn(mIn - mOut)} net over ${daysIn} days` },
    nd
      ? { label: 'NEXT DUE · ' + (nd.days === 0 ? 'TODAY' : nd.days + 'd'), icon: 'assets/icon-gem.png', bg: nd.days <= 3 ? 'var(--rose)' : 'var(--butter)', value: `${money(dueSum)} · ${due.length} bills`, cls: '', sub: `next ${nd.n}, ${MON[nd.date.getMonth()]} ${nd.date.getDate()}` }
      : { label: 'NEXT DUE', icon: 'assets/icon-gem.png', bg: 'var(--green)', value: 'Nothing due', cls: '', sub: 'next 14 days are clear' }
  ];

  return (
    <section className="hero tnum">
      <div className="hero-main">
        <span className="caps-11" style={{ letterSpacing: '.12em' }}>{monName.toUpperCase()} · LEFT AFTER COMMITMENTS</span>
        <span className={'hero-value' + (surplus < 0 ? ' neg' : '')}>{sgn(surplus)}</span>
        <span className="mono muted" style={{ fontSize: 13 }}>{idr(surplus, data.rate)} · {money(mIn)} in − {money(obT)} outside commitments</span>
        <span className="hero-headline">{headline}</span>
        <div className="trend" aria-label="Net per month, last 6 months">
          {nets.map(n => (
            <div key={n.i} className="col" style={{ alignItems: 'center', gap: 4 }} title={`${MON[n.a.getMonth()]}: ${sgn(n.v)}`}>
              <div className="trend-bar" style={{
                height: (n.any ? Math.max(4, Math.round(Math.abs(n.v) / nMax * 44)) : 4),
                background: !n.any ? 'transparent' : n.v < 0 ? 'var(--rose)' : n.i === 0 ? 'var(--stripe1)' : HATCH
              }} />
              <span className="mono muted" style={{ fontSize: 10 }}>{MON[n.a.getMonth()]}</span>
            </div>
          ))}
          <span className="small" style={{ paddingBottom: 18, marginLeft: 6 }}>net per month</span>
        </div>
      </div>
      <div className="hero-side">
        {side.map(k => (
          <div key={k.label} className="card side-card" style={{ background: k.bg }}>
            <Icon src={k.icon} size={32} />
            <div className="col" style={{ gap: 1, minWidth: 0 }}>
              <span className="caps" style={{ letterSpacing: '.1em' }}>{k.label}</span>
              <span className={'kpi-v ' + k.cls}>{k.value}</span>
              <span className="mono muted" style={{ fontSize: 11 }}>{k.sub}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
