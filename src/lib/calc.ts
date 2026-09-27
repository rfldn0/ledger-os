import type { AppData, Obligations, Rule, SubItem } from './types';
import { addDays, fromIso, iso, nextDue, num, sod } from './util';

export const sumC = (a: { c: number | string }[]) => a.reduce((q, o) => q + num(o.c), 0);

export function obTotals(ob: Obligations) {
  const family = sumC(ob.family);
  const personalOnly = sumC(ob.personal);
  const subs = sumC(ob.subs.filter(x => x.status === 'Active'));
  return { family, personalOnly, subs, personal: personalOnly + subs, total: family + personalOnly + subs };
}

export function totals(d: AppData) {
  let inflow = 0, outflow = 0;
  for (const t of d.txns) t.amount > 0 ? (inflow += t.amount) : (outflow -= t.amount);
  return { inflow, outflow, balance: num(d.startCash) + inflow - outflow };
}

export interface DueItem extends SubItem { date: Date; days: number }

/** Active, non-zero subscriptions due within `within` days, soonest first. */
export function dueSoon(subs: SubItem[], within = 14, today = sod(new Date())): DueItem[] {
  return subs
    .filter(x => x.status === 'Active' && num(x.c) > 0)
    .map(x => ({ ...x, ...nextDue(x.d, today) }))
    .filter(x => x.days <= within)
    .sort((a, b) => a.days - b.days);
}

/** Monthly variable-spend limit = the "Monthly Allowance" obligation. */
export function varLimit(ob: Obligations) {
  const a = ob.personal.find(x => /allowance/i.test(x.n));
  return a ? num(a.c) : 200;
}

export interface Occurrence { pid: string; date: string; hours: number }

export function occurrences(rules: Rule[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  for (const r of rules) {
    const st = fromIso(r.start), un = r.until ? fromIso(r.until) : null;
    for (let d = new Date(from); d < to; d = addDays(d, 1)) {
      if (d < st || (un && d > un)) continue;
      if (r.days.includes(d.getDay())) out.push({ pid: r.pid, date: iso(d), hours: r.hours });
    }
  }
  return out;
}
