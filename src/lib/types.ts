export type CatId = 'income' | 'family' | 'living' | 'subs' | 'expense';
export type SubStatus = 'Active' | 'Cancelled' | 'Inactive';
export type ConfirmAnim = 'burst' | 'single' | 'off';

/** Editable numeric fields keep the raw input string while typing; read them with num(). */
export type Num = number | string;

export interface Txn {
  id: string;
  ts: string; // ISO timestamp
  amount: number; // + income, − expense (USD)
  memo: string;
  cat: CatId;
  note: string;
}

export interface ObItem {
  id: string;
  n: string;
  c: Num; // USD per month
  meta: string;
}

export interface SubItem {
  id: string;
  n: string;
  d: Num; // due day of month
  c: Num;
  status: SubStatus;
  note: string;
}

export interface Obligations {
  family: ObItem[];
  personal: ObItem[];
  subs: SubItem[];
}

export interface Portfolio {
  id: string;
  name: string;
  rate: number; // USD per hour, 0 = unpaid
  color: string;
}

export interface TimeEvent {
  id: string;
  pid: string;
  date: string; // YYYY-MM-DD
  hours: number;
}

export interface Rule {
  id: string;
  pid: string;
  days: number[]; // 0 = Sun
  time: string;
  hours: number;
  start: string;
  until: string | null;
}

export interface BucketMove {
  ts: string;
  amt: number;
}

export interface Bucket {
  id: string;
  n: string;
  saved: Num;
  target: Num;
  icon: string;
  moves: BucketMove[];
}

export interface Settings {
  confirmAnim: ConfirmAnim;
  payAnchor: string; // YYYY-MM-DD, start of a bi-weekly pay period
}

export interface AppData {
  txns: Txn[];
  startCash: Num;
  rate: number; // IDR per USD
  ob: Obligations;
  portfolios: Portfolio[];
  events: TimeEvent[];
  rules: Rule[];
  actual: Record<string, Num>; // week-start ISO → actual received
  buckets: Bucket[];
  settings: Settings;
}
