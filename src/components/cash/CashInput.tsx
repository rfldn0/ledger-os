import { useRef, useState, type KeyboardEvent } from 'react';
import type { CatId, ConfirmAnim, Txn } from '../../lib/types';
import { CATS, catOf, parseEntry } from '../../lib/cats';
import { idr, money, uid } from '../../lib/util';
import { CommitFeedback } from '../CommitFeedback';
import { Icon } from '../Sprites';

interface Props {
  rate: number;
  anim: ConfirmAnim;
  toast: Txn | null;
  canUndo: boolean;
  burstKey: number;
  onCommit: (t: Txn) => void;
  onUndo: () => void;
}

export function CashInput({ rate, anim, toast, canUndo, burstKey, onCommit, onUndo }: Props) {
  const [input, setInput] = useState('');
  const [note, setNote] = useState('');
  const [override, setOverride] = useState<CatId | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const parsed = parseEntry(input, override);
  const activeCat = parsed ? parsed.cat : override;

  const commit = () => {
    if (!parsed) return;
    onCommit({ id: uid('t'), ts: new Date().toISOString(), amount: parsed.amount, memo: parsed.memo, cat: parsed.cat, note: note.trim() });
    setInput(''); setNote(''); setOverride(null);
    ref.current?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Tab' && !e.shiftKey && e.currentTarget === ref.current && input.trim()) {
      e.preventDefault();
      const ids = CATS.map(c => c.id), cur = activeCat ? ids.indexOf(activeCat) : -1;
      setOverride(ids[(cur + 1) % ids.length]);
    } else if (e.key === 'Escape') { setInput(''); setNote(''); setOverride(null); }
  };

  const preview = parsed
    ? { text: `${parsed.amount > 0 ? 'INCOME' : 'EXPENSE'} ${money(parsed.amount)} · ${catOf(parsed.cat).label} · ${idr(parsed.amount, rate)}`, bg: catOf(parsed.cat).tint }
    : input.trim() ? { text: "can't read the amount yet", bg: 'var(--rose)' } : { text: 'waiting for input…', bg: 'var(--white)' };

  return (
    <section className="card white" style={{ padding: '16px 18px' }}>
      <div className="row wrap" style={{ alignItems: 'baseline' }}>
        <h2 className="card-title" style={{ margin: 0, fontWeight: 400 }}>Cash Flow Input</h2>
        <span className="small">Enter positive (+) for income, negative (-) for expense</span>
      </div>
      <div className="row wrap" style={{ gap: '12px clamp(10px,1.4vw,18px)', alignItems: 'flex-end' }}>
        <label className="col" style={{ flex: '2 1 260px', gap: 4, minWidth: 0 }}>
          <span className="caps muted" style={{ fontWeight: 400 }}>AMOUNT (+ / −) AND DESCRIPTION</span>
          <span className="row" style={{ gap: 8, height: 40, borderBottom: '2px dashed var(--ink)' }}>
            <span className="mono" style={{ fontSize: 'clamp(14px,1.5vw,20px)', color: 'var(--note)' }}>&gt;</span>
            <input ref={ref} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} placeholder="-435 family"
              autoFocus spellCheck={false} autoComplete="off" inputMode="text"
              style={{ flex: 1, minWidth: 0, width: '100%', height: '100%', border: 0, background: 'transparent', fontFamily: 'var(--mono)', fontSize: 'clamp(14px,1.5vw,20px)', padding: 0 }} />
          </span>
        </label>
        <label className="col" style={{ flex: '1 1 180px', gap: 4, minWidth: 0 }}>
          <span className="caps muted" style={{ fontWeight: 400 }}>NOTE</span>
          <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={onKey} placeholder="optional"
            style={{ width: '100%', height: 40, border: 0, borderBottom: '2px dashed var(--ink)', background: 'transparent', fontSize: 'clamp(15px,1.5vw,20px)', padding: 0 }} />
        </label>
        <div className="row" style={{ flex: '1 0 clamp(200px,20vw,250px)', gap: 'clamp(10px,1.4vw,18px)' }}>
          <button className="btn-primary" onClick={commit} disabled={!parsed}
            style={{ flex: 1, minHeight: 48, padding: '0 8px', fontSize: 'clamp(15px,1.6vw,21px)', opacity: parsed ? 1 : .55 }}>
            Submit
          </button>
          <CommitFeedback burstKey={burstKey} silver={!!toast && toast.amount < 0} mode={anim} />
        </div>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="small" style={{ minWidth: 110, color: 'var(--muted2)' }}>CATEGORY [TAB]</span>
        {CATS.map(c => {
          const on = activeCat === c.id;
          return (
            <button key={c.id} className={'chip' + (on ? ' on' : '')} aria-pressed={on}
              style={{ height: 30, padding: '0 10px 0 5px', background: on ? c.tint : undefined }}
              onClick={() => { setOverride(o => (o === c.id ? null : c.id)); ref.current?.focus(); }}>
              <Icon src={c.icon} />{c.label}
              {on && <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{parsed?.auto && !override ? 'auto' : 'set'}</span>}
            </button>
          );
        })}
      </div>
      <div className="row wrap" style={{ paddingTop: 10, borderTop: '1.5px dashed var(--rule)', minHeight: 26 }}>
        <span className="small" style={{ minWidth: 110, color: 'var(--muted2)' }}>PREVIEW</span>
        <span className="mono" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 3, border: '1.5px solid var(--ink)', background: preview.bg }}>{preview.text}</span>
        <span className="row ml-auto wrap" style={{ gap: 8 }} aria-live="polite">
          {toast && <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>LOGGED ✓ {toast.amount > 0 ? '+' : '−'}{money(toast.amount)}</span>}
          <span className="muted" style={{ fontSize: 16 }}>{toast ? `${toast.memo} → ${catOf(toast.cat).label}` : 'press SUBMIT or Enter'}</span>
          {canUndo && <button className="link-btn neg" onClick={onUndo}>undo</button>}
        </span>
      </div>
    </section>
  );
}
