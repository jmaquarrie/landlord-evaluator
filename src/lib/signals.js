// Motivated-seller and risk signals. Picked up from pasted listing text, or
// ticked by hand when adding a deal.

export const SIGNALS = [
  { id: 'price-cut', label: 'Price reduced', tone: 'warning', words: ['reduced', 'price cut', 'price reduction', 'now only'] },
  { id: 'modernisation', label: 'Needs modernisation', tone: 'warning', words: ['modernisation', 'modernization', 'refurbishment', 'renovation', 'tlc', 'updating', 'project'] },
  { id: 'cash-only', label: 'Cash buyers only', tone: 'warning', words: ['cash buyer', 'cash only'] },
  { id: 'no-chain', label: 'No chain', tone: 'neutral', words: ['no chain', 'chain free', 'no onward chain'] },
  { id: 'probate', label: 'Probate', tone: 'warning', words: ['probate', 'deceased', 'executor'] },
  { id: 'auction', label: 'Auction', tone: 'warning', words: ['auction', 'legal pack'] },
  { id: 'repossession', label: 'Repossession', tone: 'warning', words: ['repossess', 'receivers', 'lpa receiver'] },
  { id: 'long-listed', label: 'Long time listed', tone: 'warning', words: [] },
  { id: 'hmo-potential', label: 'HMO potential', tone: 'success', words: ['hmo', 'house share'] },
  { id: 'extra-bed', label: 'Extra bedroom potential', tone: 'success', words: ['large reception', 'through lounge', 'loft', 'potential to extend', 'scope to extend'] },
  { id: 'short-lease', label: 'Short lease', tone: 'danger', words: ['short lease'] },
  { id: 'non-standard', label: 'Non-standard construction', tone: 'danger', words: ['non-standard', 'non standard', 'concrete construction', 'timber frame', 'steel frame', 'prc', 'airey', 'wimpey no fines'] },
  { id: 'flood', label: 'Flood risk', tone: 'danger', words: ['flood'] },
  { id: 'above-commercial', label: 'Above commercial', tone: 'danger', words: ['above shop', 'above a shop', 'above commercial', 'flat above'] },
  { id: 'ex-council', label: 'Ex-local authority', tone: 'danger', words: ['ex-local authority', 'ex local authority', 'ex-council', 'ex council'] },
];

export const SIGNAL_MAP = Object.fromEntries(SIGNALS.map((s) => [s.id, s]));

export function detectSignals(text) {
  const t = (text || '').toLowerCase();
  return SIGNALS.filter((s) => s.words.some((w) => t.includes(w))).map((s) => s.id);
}

// Lender red flags — these kill refinances.
export function lenderFlags(deal) {
  const flags = [];
  const value = Number(deal.arv) || 0;
  if (value && value < 75000) flags.push('Valued under £75k — many BTL lenders won’t lend');
  if (deal.tenure === 'leasehold' && Number(deal.leaseYears) && Number(deal.leaseYears) < 85)
    flags.push(`Lease ${deal.leaseYears} years — most lenders want 85+ remaining`);
  if ((deal.signals || []).includes('non-standard')) flags.push('Non-standard construction — specialist lender needed');
  if ((deal.signals || []).includes('above-commercial')) flags.push('Above commercial premises — limits lender choice');
  if ((deal.signals || []).includes('ex-council') && deal.propertyType === 'flat')
    flags.push('Ex-local-authority flat — some lenders exclude high-rise blocks');
  if (Number(deal.monthsToRefi) < 6) flags.push('Under 6 months — most lenders need 6 months’ ownership before refinancing at the new value');
  return flags;
}

/** Pull price, beds and postcode out of pasted listing text where possible. */
export function parseListing(text) {
  const t = text || '';
  const price = t.match(/£\s?([\d,]{5,9})/);
  const beds = t.match(/(\d)\s*(?:-|\s)?bed(?:room)?s?/i);
  const postcode = t.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  const epc = t.match(/EPC(?:\s*rating)?\s*(?:of|:|-)?\s*([A-G])\b/i);
  const type = /semi[-\s]?detached/i.test(t)
    ? 'semi-detached'
    : /\bdetached/i.test(t)
      ? 'detached'
      : /terrace/i.test(t)
        ? 'terraced'
        : /\b(flat|apartment|maisonette)\b/i.test(t)
          ? 'flat'
          : /bungalow/i.test(t)
            ? 'bungalow'
            : undefined;
  return {
    askingPrice: price ? Number(price[1].replace(/,/g, '')) : undefined,
    beds: beds ? Number(beds[1]) : undefined,
    postcode: postcode ? postcode[1].toUpperCase().replace(/\s*(\d[A-Z]{2})$/, ' $1') : undefined,
    epc: epc ? epc[1].toUpperCase() : undefined,
    propertyType: type,
    signals: detectSignals(t),
  };
}
