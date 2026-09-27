import { useEffect, useState } from 'react';
import type { StorageState } from '../lib/storage';
import { Coin } from './Sprites';

export type Tab = 'cash' | 'ob' | 'time';
const TABS: [Tab, string][] = [['cash', 'Cashflow'], ['ob', 'Obligations'], ['time', 'Time & Income']];

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  rate: number;
  onRate: (r: number) => void;
  storage: StorageState;
  savedAt: Date | null;
}

export function Header({ tab, onTab, rate, onRate, storage, savedAt }: Props) {
  const [rateText, setRateText] = useState(String(rate));
  useEffect(() => setRateText(String(rate)), [rate]);
  const time = savedAt ? savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <header className="card header">
      <div className="header-main">
        <div className="row"><Coin size={32} /><h1 className="brand" style={{ margin: 0, fontWeight: 400 }}>Ledger OS</h1></div>
        <nav className="row wrap" style={{ gap: 8, marginLeft: 'clamp(0px,1vw,12px)' }} aria-label="Sections">
          {TABS.map(([id, label]) => (
            <button key={id} className={'chip' + (tab === id ? ' on' : '')} aria-current={tab === id ? 'page' : undefined}
              style={{ fontSize: 18, padding: '2px 14px', background: tab === id ? 'var(--green)' : undefined }} onClick={() => onTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="row ml-auto wrap" style={{ gap: 14 }}>
          {storage === 'ok' && time && <span className="small" title="Saved in this browser's local storage">● saved on this device {time}</span>}
          <label className="row mono" style={{ gap: 6, fontSize: 13 }}>1$ =
            <input className="field-u mono" type="number" inputMode="numeric" value={rateText} aria-label="Rupiah per dollar"
              onChange={e => { setRateText(e.target.value); const v = +e.target.value; if (v >= 1) onRate(v); }}
              onBlur={() => setRateText(String(rate))} style={{ width: 76, borderBottomWidth: 2 }} />IDR</label>
        </div>
      </div>
      {storage === 'unavailable' && (
        <div className="banner warn" role="alert">● STORAGE BLOCKED · this browser isn't letting the page save. Changes last until you close the tab. Allow site data, or use ⚙ more → Export backup.</div>
      )}
      {storage === 'full' && (
        <div className="banner warn" role="alert">● STORAGE FULL · the latest change wasn't saved. Export a backup, then clear old entries.</div>
      )}
      <div className="stripe"><div /><div /><div /></div>
    </header>
  );
}
