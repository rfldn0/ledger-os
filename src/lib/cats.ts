import type { CatId } from './types';

export interface Cat {
  id: CatId;
  label: string;
  tint: string;
  icon: string;
  words: RegExp;
}

export const CATS: Cat[] = [
  { id: 'income', label: 'Income', tint: '#cfe0c3', icon: 'assets/icon-bill.png', words: /(wage|salary|pay(check)?|invoice|tips?|bonus|freelance|refund)/i },
  { id: 'family', label: 'Family Support', tint: '#cfdde8', icon: 'assets/icon-key.png', words: /(family|remit|tuition|education|school)/i },
  { id: 'living', label: 'Daily Living', tint: '#f1e2b3', icon: 'assets/icon-bag.png', words: /(food|lunch|pocket|snack|coffee|bus|hungry|grocer)/i },
  { id: 'subs', label: 'Subscription', tint: '#e3d5ec', icon: 'assets/icon-gem.png', words: /(sub|spotify|icloud|google|prime|phone|credit|netflix|streaming|cloud)/i },
  { id: 'expense', label: 'Expense', tint: '#f3d9c6', icon: 'assets/icon-coin.png', words: /$^/ }
];

export const catOf = (id: string | null | undefined): Cat => CATS.find(c => c.id === id) || CATS[4];

export const ICONS = ['assets/icon-coin.png', 'assets/icon-gem.png', 'assets/icon-key.png', 'assets/icon-bag.png', 'assets/icon-bill.png'];

export const PCOLORS = ['#9cc08a', '#9dbad3', '#e8b48a', '#d8a8c8', '#e6d27a', '#a8a4d8', '#8fd0c0', '#e89a9a'];

export interface Parsed {
  amount: number;
  memo: string;
  cat: CatId;
  auto: boolean;
}

/** "-435 family" → { amount: -435, memo: 'family', cat: 'family' } */
export function parseEntry(str: string, override: CatId | null): Parsed | null {
  const m = /^\s*([+-])?\s*\$?\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*(.*)$/.exec(str || '');
  if (!m) return null;
  const val = parseFloat(m[2].replace(/,/g, ''));
  if (!Number.isFinite(val) || val === 0) return null;
  const memo = m[3].trim();
  const auto = CATS.find(c => c.words.test(memo));
  const sign = m[1] || (auto?.id === 'income' ? '+' : '-');
  const cat = override || auto?.id || (sign === '+' ? 'income' : 'expense');
  return { amount: sign === '-' ? -val : val, memo: memo || (sign === '+' ? 'Income' : 'Expense'), cat, auto: !override };
}
