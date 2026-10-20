import type { AppData } from './types';

/** Returns a blank AppData — no transactions, obligations, events, or buckets. */
export function seedData(): AppData {
  return {
    txns: [],
    startCash: 0,
    rate: 1,
    ob: { family: [], personal: [], subs: [] },
    portfolios: [],
    events: [],
    rules: [],
    actual: {},
    buckets: [],
    settings: { confirmAnim: 'burst', payAnchor: new Date().toISOString().slice(0, 10) },
  };
}
