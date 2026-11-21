// HM Land Registry Price Paid Data via its public SPARQL endpoint.
// Contains HM Land Registry data © Crown copyright and database right. Licensed under the OGL v3.0.
// No fallbacks: if a request fails, callers get an error and show "no data".

const ENDPOINT = 'https://landregistry.data.gov.uk/landregistry/query';
const PREFIXES = `PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>`;

const memo = new Map();
const CACHE_PREFIX = 'lr-cache:v3:';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7;

function str(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"^^xsd:string`;
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    return Date.now() - at < CACHE_TTL ? data : null;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Storage full or blocked: carry on without caching.
  }
}

async function run(query, { signal, cacheKey } = {}) {
  if (cacheKey && memo.has(cacheKey)) return memo.get(cacheKey);
  const cached = cacheKey ? readCache(cacheKey) : null;
  if (cached) {
    memo.set(cacheKey, cached);
    return cached;
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query: `${PREFIXES}\n${query}` }),
    signal,
  });
  if (!res.ok) throw new Error(`Land Registry returned ${res.status}`);
  const json = await res.json();
  const rows = (json?.results?.bindings ?? []).map(toSale);
  if (cacheKey) {
    memo.set(cacheKey, rows);
    writeCache(cacheKey, rows);
  }
  return rows;
}

const tail = (uri) => (uri ? uri.split('/').pop() : undefined);

function toSale(b) {
  return {
    paon: b.paon?.value,
    saon: b.saon?.value,
    street: b.street?.value,
    town: b.town?.value,
    postcode: b.postcode?.value,
    price: Number(b.amount?.value),
    date: b.date?.value,
    propertyType: tail(b.ptype?.value),
    tenure: tail(b.estate?.value),
    newBuild: b.newbuild?.value === 'true',
    // 'standard' = ordinary sale to a private buyer. 'additional' = company buyers,
    // repossessions and bulk/portfolio transfers. Bulk ones are removed in evidence.js.
    category: b.cat?.value?.includes('additional') ? 'additional' : 'standard',
  };
}

const SALE_FIELDS = `?tx lrppi:propertyAddress ?addr ; lrppi:pricePaid ?amount ; lrppi:transactionDate ?date ;
     lrppi:propertyType ?ptype ; lrppi:estateType ?estate ; lrppi:newBuild ?newbuild ;
     lrppi:transactionCategory ?cat .
  OPTIONAL { ?addr lrcommon:paon ?paon } OPTIONAL { ?addr lrcommon:saon ?saon }
  OPTIONAL { ?addr lrcommon:street ?street } OPTIONAL { ?addr lrcommon:town ?town }
  OPTIONAL { ?addr lrcommon:postcode ?postcode }`;

export function salesByPostcode(postcode, opts) {
  const pc = postcode.toUpperCase().trim();
  return run(
    `SELECT * WHERE { ?addr lrcommon:postcode ${str(pc)} . ${SALE_FIELDS} } ORDER BY DESC(?date) LIMIT 500`,
    { ...opts, cacheKey: `pc:${pc}` },
  );
}

export function salesByStreet(street, town, opts) {
  const s = street.toUpperCase();
  const t = town.toUpperCase();
  return run(
    `SELECT * WHERE { ?addr lrcommon:street ${str(s)} ; lrcommon:town ${str(t)} . ${SALE_FIELDS} } ORDER BY DESC(?date) LIMIT 2000`,
    { ...opts, cacheKey: `st:${s}|${t}` },
  );
}

/** Every sale in a local authority since `since` (YYYY-MM-DD). District names are Land Registry's, e.g. "WYRE". */
export function salesByDistrict(district, since, opts) {
  const d = district.toUpperCase().trim();
  return run(
    `SELECT ?postcode ?amount ?date ?ptype ?cat WHERE {
      ?addr lrcommon:district ${str(d)} ; lrcommon:postcode ?postcode .
      ?tx lrppi:propertyAddress ?addr ; lrppi:pricePaid ?amount ; lrppi:transactionDate ?date ; lrppi:propertyType ?ptype ;
          lrppi:transactionCategory ?cat .
      FILTER(?date >= "${since}"^^xsd:date)
    }`,
    { ...opts, cacheKey: `di:${d}|${since}` },
  );
}

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** House number or name from the start of an address line. */
export function houseIdFromAddress(address) {
  const m = (address || '').trim().match(/^(?:flat\s+\S+,?\s+)?(\d+[A-Z]?)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Street evidence for a property: every recorded sale on its street, plus
 * the property's own sale history if we can match its house number.
 */
export async function streetEvidence({ postcode, address }, opts) {
  const local = await salesByPostcode(postcode, opts);
  if (!local.length) return { street: null, town: null, sales: [], history: [] };
  const street = mostCommon(local.map((s) => s.street));
  const town = mostCommon(local.map((s) => s.town));
  const sales = street && town ? await salesByStreet(street, town, opts) : local;
  const id = houseIdFromAddress(address);
  const history = id
    ? sales.filter((s) => (s.paon || '').toUpperCase() === id && s.postcode === postcode.toUpperCase().trim() && !s.saon)
    : [];
  return { street, town, sales, history };
}
