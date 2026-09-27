import type { AppData, Obligations, TimeEvent, Txn } from './types';
import { iso } from './util';

/** Starter rows — replace these with your own transactions. */
export function seedTxns(): Txn[] {
  let i = 0;
  const t = (d: number, h: number, m: number, amount: number, memo: string, cat: Txn['cat'], note = ''): Txn => ({
    id: 's' + i++, ts: new Date(2026, 8, d, h, m).toISOString(), amount, memo, cat, note
  });
  return [
    t(1,  9,  0,  500,  'Paycheck',          'income',  'Weekly pay deposit'),
    t(3,  9,  0,  -200, 'Rent Contribution', 'family'),
    t(5,  12, 0,  -60,  'Groceries',         'living'),
    t(8,  9,  0,  500,  'Paycheck',          'income'),
    t(10, 14, 0,  -15,  'Lunch',             'living'),
    t(12, 10, 0,  -50,  'Subscription Bundle', 'subs'),
    t(15, 9,  0,  500,  'Paycheck',          'income'),
    t(18, 18, 0,  -30,  'Miscellaneous',     'expense'),
    t(22, 9,  0,  500,  'Paycheck',          'income'),
  ];
}

/** Starter obligations — replace these with your own. */
export function seedOb(): Obligations {
  let i = 0;
  const id = () => 'o' + i++;
  return {
    family: [
      { id: id(), n: 'Family Contribution',  c: 200, meta: 'Family Living · Monthly family support' },
      { id: id(), n: 'Education Fund',       c: 100, meta: 'Education · Tuition or school fees' },
      { id: id(), n: 'Emergency Reserve',    c: 50,  meta: 'Emergency · Family emergency fund' },
    ],
    personal: [
      { id: id(), n: 'Personal Allowance',   c: 150, meta: 'Personal · Discretionary spending' },
      { id: id(), n: 'Personal Emergency',   c: 50,  meta: 'Emergency · Personal emergency reserve' },
    ],
    subs: [
      { id: id(), n: 'Streaming Service A',  d: 1,  c: 15,    status: 'Active',    note: 'Video streaming' },
      { id: id(), n: 'Cloud Storage',        d: 5,  c: 9.99,  status: 'Active',    note: 'Cloud backup & storage' },
      { id: id(), n: 'Music Service',        d: 3,  c: 4.99,  status: 'Active',    note: 'Music streaming' },
      { id: id(), n: 'Streaming Service B',  d: 10, c: 0,     status: 'Cancelled', note: 'Cancelled' },
      { id: id(), n: 'Phone Plan',           d: 15, c: 30,    status: 'Active',    note: 'Mobile cellular plan' },
      { id: id(), n: 'Backup Slot',          d: 1,  c: 0,     status: 'Inactive',  note: 'Spare slot for new services' },
    ],
  };
}

/** Starter work-hour events — replace with your own schedule. */
export function seedEvents(): TimeEvent[] {
  const grid = [[8, 8, 8, 8], [8, 8, 8, 8], [8, 8, 8, 8], [0, 0, 0, 0], [0, 0, 0, 0]];
  const out: TimeEvent[] = [];
  grid.forEach((row, d) => row.forEach((h, w) => {
    if (h) out.push({ id: 'e' + d + w, pid: 'p1', date: iso(new Date(2026, 7, 31 + w * 7 + d)), hours: h });
  }));
  return out;
}

export function seedData(): AppData {
  return {
    txns: seedTxns(),
    startCash: 0,
    rate: 1,
    ob: seedOb(),
    portfolios: [{ id: 'p1', name: 'Employer A', rate: 15, color: '#9cc08a' }],
    events: seedEvents(),
    rules: [],
    actual: { '2026-08-31': 480, '2026-09-07': 480, '2026-09-14': 480, '2026-09-21': 480 },
    buckets: [
      { id: 'b1', n: 'Emergency Fund',  saved: 0, target: 500, icon: 'assets/icon-key.png', moves: [] },
      { id: 'b2', n: 'Savings Goal',    saved: 0, target: 1000, icon: 'assets/icon-bag.png', moves: [] },
    ],
    settings: { confirmAnim: 'burst', payAnchor: '2026-09-01' },
  };
}
