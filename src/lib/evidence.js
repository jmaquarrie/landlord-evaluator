// Turns Land Registry sales into the numbers the app needs: street ceiling,
// done-up vs tired prices, and area rankings.

export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const yearsAgo = (n) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
};

/**
 * Remove bulk transfers: "additional" category sales where two or more
 * properties in the same group (street or sector) changed hands on the same
 * day. Their price is often a portfolio total or an allocation, not a market
 * price. Single company purchases are kept — they are real sales.
 */
export function excludeBulk(sales, groupKey = () => '') {
  const counts = new Map();
  for (const s of sales) {
    if (s.category !== 'additional') continue;
    const k = `${groupKey(s)}|${s.date}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const kept = [];
  let excluded = 0;
  for (const s of sales) {
    if (s.category === 'additional' && counts.get(`${groupKey(s)}|${s.date}`) >= 2) excluded += 1;
    else kept.push(s);
  }
  return { kept, excluded };
}

/**
 * Street evidence. `sales` are Land Registry rows for the street. Uses sales of
 * the same property type where there are at least 4, otherwise all types.
 */
export function streetStats(sales, { propertyType, sinceYears = 10, recentYears = 3 } = {}) {
  const since = yearsAgo(sinceYears);
  const { kept, excluded } = excludeBulk(sales.filter((s) => s.date >= since));
  const all = kept.filter((s) => s.price > 10000);
  const sameType = all.filter((s) => s.propertyType === propertyType);
  const candidates = sameType.length >= 4 ? sameType : all;
  // Drop extreme outliers (mis-recorded or unusual sales) so one odd price can't set the ceiling.
  const mid = quantile(candidates.map((s) => s.price).sort((a, b) => a - b), 0.5);
  const pool = candidates.filter((s) => candidates.length < 6 || s.price <= mid * 2.5);
  const prices = pool.map((s) => s.price).sort((a, b) => a - b);
  if (!prices.length) return null;
  const recentSince = yearsAgo(recentYears);
  const recent = pool.filter((s) => s.date >= recentSince).map((s) => s.price).sort((a, b) => a - b);
  const top = pool.reduce((m, s) => (s.price > m.price ? s : m), pool[0]);
  return {
    count: pool.length,
    sameTypeOnly: candidates === sameType,
    ceiling: top.price,
    ceilingSale: top,
    median: quantile(prices, 0.5),
    tired: quantile(recent.length >= 4 ? recent : prices, 0.25),
    doneUp: quantile(recent.length >= 4 ? recent : prices, 0.8),
    recentCount: recent.length,
    excludedBulk: excluded,
    excludedOutliers: candidates.length - pool.length,
    pool,
  };
}

/** Within evidence, near the ceiling, or over it. Surveyors rarely value far above the street's best sale. */
export function ceilingCheck(arv, stats) {
  if (!stats) return { status: 'unknown', surveyorArv: arv, pctOver: 0 };
  const pctOver = arv / stats.ceiling - 1;
  const status = pctOver > 0 ? 'over' : pctOver > -0.05 ? 'near' : 'within';
  const cap = Math.round((stats.ceiling * 1.03) / 1000) * 1000;
  return { status, surveyorArv: Math.min(arv, cap), pctOver };
}

export function confidenceLabel(count) {
  if (count >= 12) return 'high';
  if (count >= 6) return 'medium';
  return 'low';
}

export function postcodeSector(postcode) {
  const p = (postcode || '').toUpperCase().trim();
  const m = p.match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d)[A-Z]{2}$/);
  return m ? `${m[1]} ${m[2]}` : null;
}

/**
 * Rank postcode sectors in an area. Spread = the gap between the top 20% and
 * bottom 25% of house prices in the sector — a proxy for refurb uplift.
 */
export function rankSectors(sales, { types = ['terraced', 'semi-detached'], minSales = 8 } = {}) {
  const groups = new Map();
  for (const s of excludeBulk(sales, (x) => postcodeSector(x.postcode)).kept) {
    if (types.length && !types.includes(s.propertyType)) continue;
    const sector = postcodeSector(s.postcode);
    if (!sector) continue;
    if (!groups.has(sector)) groups.set(sector, []);
    groups.get(sector).push(s.price);
  }
  const out = [];
  for (const [sector, list] of groups) {
    if (list.length < minSales) continue;
    const sorted = list.sort((a, b) => a - b);
    const tired = quantile(sorted, 0.25);
    const doneUp = quantile(sorted, 0.8);
    out.push({
      sector,
      count: sorted.length,
      tired,
      doneUp,
      median: quantile(sorted, 0.5),
      spread: doneUp - tired,
      spreadPct: tired > 0 ? (doneUp - tired) / tired : 0,
    });
  }
  return out.sort((a, b) => b.spread - a.spread);
}
