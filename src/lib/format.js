const gbpFmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

export function gbp(value) {
  if (!Number.isFinite(value)) return '—';
  return gbpFmt.format(Math.round(value)).replace('-', '−');
}

/** Compact money: £128k, £1.2m, £950. */
export function gbpK(value) {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : '';
  const v = Math.abs(value);
  if (v >= 1e6) return `${sign}£${(v / 1e6).toFixed(v >= 1e7 ? 0 : 2)}m`;
  if (v >= 10000) return `${sign}£${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${sign}£${(v / 1000).toFixed(1)}k`;
  return `${sign}£${Math.round(v)}`;
}

export function pct(value, digits = 1) {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits).replace('-', '−')}%`;
}

export function shortDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** "WESTMORLAND AVENUE" → "Westmorland Avenue". */
export function titleCase(text) {
  return (text || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
