import type { Num } from './types';

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const DAY_MS = 86400000;

export const num = (v: Num | null | undefined): number => {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '');
  return Number.isFinite(n) ? n : 0;
};

let idSeq = 0;
export const uid = (prefix: string) => prefix + Date.now().toString(36) + (idSeq++).toString(36);

export const money = (n: number, short = false): string => {
  const a = Math.abs(n);
  if (short && a >= 10000) return '$' + (a / 1000).toFixed(1) + 'k';
  return '$' + a.toLocaleString('en-US', { minimumFractionDigits: a % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

/** Signed money: "−$12" for negatives. */
export const sgn = (n: number) => (n < 0 ? '−' : '') + money(n);

export const idr = (n: number, rate: number) =>
  (n < 0 ? '−' : '') + 'Rp' + Math.abs(Math.round(n * rate)).toLocaleString('en-US');

export const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const dkey = (d: Date) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
export const iso = (d: Date) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Monday of the week containing d. */
export const weekStart = (d: Date) => addDays(sod(d), -((d.getDay() + 6) % 7));

export const isoWeek = (d: Date) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((+t - +y0) / DAY_MS + 1) / 7);
};

export type RangeKind = 'week' | 'biweek' | 'month' | 'year';

export const range = (kind: RangeKind, off: number, payAnchor: string, now = new Date()): [Date, Date] => {
  const y = now.getFullYear(), mo = now.getMonth();
  if (kind === 'week') {
    const s = addDays(weekStart(now), off * 7);
    return [s, addDays(s, 7)];
  }
  if (kind === 'biweek') {
    const anchor = fromIso(payAnchor || '2026-09-14');
    const n = Math.floor((+sod(now) - +anchor) / (14 * DAY_MS)) + off;
    const s = addDays(anchor, n * 14);
    return [s, addDays(s, 14)];
  }
  if (kind === 'month') return [new Date(y, mo + off, 1), new Date(y, mo + off + 1, 1)];
  return [new Date(y + off, 0, 1), new Date(y + off + 1, 0, 1)];
};

export const inRange = (ts: string, [a, b]: [Date, Date]) => {
  const d = new Date(ts);
  return d >= a && d < b;
};

/** Next date (today or later) that falls on the given day of month. */
export const nextDue = (day: Num, today: Date) => {
  const dd = Math.min(31, Math.max(1, Math.round(num(day)) || 1));
  let d = new Date(today.getFullYear(), today.getMonth(), dd);
  if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, dd);
  return { date: d, days: Math.round((+d - +today) / DAY_MS) };
};

export const HATCH = 'repeating-linear-gradient(135deg,rgba(42,42,40,.35) 0 2px,transparent 2px 5px)';
