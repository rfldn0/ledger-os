import { useEffect, useRef, useState } from 'react';
import type { Bucket } from '../../lib/types';
import type { Update } from '../../lib/useLedger';
import { ICONS } from '../../lib/cats';
import { num, sgn, uid } from '../../lib/util';
import { Blocks, Icon } from '../Sprites';

export function Buckets({ buckets, unalloc, update }: { buckets: Bucket[]; unalloc: number; update: Update }) {
  const [moveAmt, setMoveAmt] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const upd = (id: string, patch: (b: Bucket) => Partial<Bucket>) =>
    update(d => ({ ...d, buckets: d.buckets.map(b => (b.id === id ? { ...b, ...patch(b) } : b)) }));

  const move = (b: Bucket) => {
    const amt = num(moveAmt[b.id] ?? 50);
    if (!(amt > 0)) return;
    upd(b.id, x => ({ saved: num(x.saved) + amt, moves: [...(x.moves || []), { ts: new Date().toISOString(), amt }] }));
    setFlash(b.id);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlash(null), 2500);
  };

  return (
    <div className="card tnum" style={{ flex: '1 1 min(100%,300px)' }}>
      <div className="row"><Icon src="assets/icon-coin.png" size={24} /><h2 className="card-title" style={{ margin: 0, fontWeight: 400 }}>Surplus &amp; Savings Buckets</h2></div>
      <div className="row" style={{ gap: 8, border: '1.5px solid var(--ink)', borderRadius: 'var(--r-box)', padding: '6px 10px', background: unalloc < 0 ? 'var(--rose)' : 'var(--butter)' }}>
        <span className="caps">UNALLOCATED SURPLUS</span>
        <span className="mono ml-auto" style={{ fontSize: 16, fontWeight: 700 }}>{sgn(unalloc)}</span>
      </div>
      {buckets.map(b => {
        const tg = num(b.target), sv = num(b.saved), k = tg ? Math.min(1, sv / tg) : 0;
        return (
          <div key={b.id} className="col" style={{ gap: 6, padding: 8, margin: '0 -8px', borderRadius: 'var(--r-box)', background: flash === b.id ? 'var(--butter)' : 'transparent' }}>
            <div className="row" style={{ gap: 8 }}>
              <Icon src={b.icon} size={28} />
              <input className="grow" aria-label="Bucket name" value={b.n} onChange={e => { const v = e.target.value; upd(b.id, () => ({ n: v })); }}
                style={{ border: 0, background: 'transparent', fontSize: 19, padding: 0 }} />
              <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{tg ? Math.round(k * 100) + '%' : '—'}</span>
              <button className="x-btn" title="Delete bucket" aria-label={`Delete bucket ${b.n}`}
                onClick={() => { if (window.confirm(`Delete bucket "${b.n}"?`)) update(d => ({ ...d, buckets: d.buckets.filter(x => x.id !== b.id) })); }}>×</button>
            </div>
            <Blocks fill={Math.round(k * 12)} color={k >= 1 ? '#8cb87a' : '#2a2a28'} />
            <div className="row wrap mono" style={{ gap: '6px 10px', fontSize: 12 }}>
              <label className="row" style={{ gap: 2 }}>$<input className="field-u mono" type="number" aria-label="Saved" value={b.saved}
                onChange={e => { const v = e.target.value; upd(b.id, () => ({ saved: v })); }} style={{ width: 58, fontSize: 12, fontWeight: 600 }} /></label>
              <span className="muted">of</span>
              <label className="row" style={{ gap: 2 }}>$<input className="field-u mono" type="number" aria-label="Target" value={b.target}
                onChange={e => { const v = e.target.value; upd(b.id, () => ({ target: v })); }} style={{ width: 58, fontSize: 12 }} /></label>
              <span className="row ml-auto" style={{ gap: 4 }}>
                <label className="row" style={{ gap: 2 }}>$<input className="field-u mono" type="number" aria-label="Amount to add" value={moveAmt[b.id] ?? '50'}
                  onChange={e => { const v = e.target.value; setMoveAmt(m => ({ ...m, [b.id]: v })); }}
                  onKeyDown={e => { if (e.key === 'Enter') move(b); }} style={{ width: 44, fontSize: 12 }} /></label>
                <button className="chip" style={{ fontSize: 15, padding: '0 8px', background: 'var(--green)' }} onClick={() => move(b)}>Add →</button>
              </span>
            </div>
          </div>
        );
      })}
      <button className="add-slot" onClick={() => update(d => ({ ...d, buckets: [...d.buckets, { id: uid('b'), n: 'New bucket', saved: 0, target: 300, icon: ICONS[d.buckets.length % ICONS.length], moves: [] }] }))}>+ New bucket</button>
    </div>
  );
}
