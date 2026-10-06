// Calendar-date helpers. Dates travel as 'YYYY-MM-DD' strings (what the report APIs take) and
// are built from LOCAL parts, never from toISOString(): that converts to UTC and, in India
// (UTC+5:30), turns early-morning local dates into the previous day.

const pad = (n) => String(n).padStart(2, '0');

/** Date -> 'YYYY-MM-DD' in local time. */
export const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** 'YYYY-MM-DD' -> local Date at midnight, or null if it is not a valid date. */
export function fromIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // new Date(2026, 1, 31) rolls over to March; reject anything that did not round-trip.
  return toIso(date) === iso ? date : null;
}

export const todayIso = () => toIso(new Date());

export const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The ranges people reach for most, as { from, to } ISO strings. */
export const QUICK_RANGES = [
  { key: 'today', label: 'Today', range: (t) => [t, t] },
  { key: 'yesterday', label: 'Yesterday', range: (t) => { const y = addDays(t, -1); return [y, y]; } },
  { key: 'last7', label: 'Last 7 days', range: (t) => [addDays(t, -6), t] },
  { key: 'last30', label: 'Last 30 days', range: (t) => [addDays(t, -29), t] },
  { key: 'thisMonth', label: 'This month', range: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), t] },
  {
    key: 'lastMonth',
    label: 'Last month',
    range: (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)],
  },
];

export function quickRange(key) {
  const entry = QUICK_RANGES.find((q) => q.key === key);
  if (!entry) return null;
  const [from, to] = entry.range(new Date());
  return { from: toIso(from), to: toIso(to) };
}
