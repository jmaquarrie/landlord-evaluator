// postcodes.io — free UK postcode lookup (OGL data).

export async function lookupPostcode(postcode, { signal } = {}) {
  const pc = (postcode || '').replace(/\s+/g, '');
  if (!pc) return null;
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Postcode lookup returned ${res.status}`);
  const json = await res.json();
  const r = json.result;
  return {
    postcode: r.postcode,
    lat: r.latitude,
    lon: r.longitude,
    district: r.admin_district,
    ward: r.admin_ward,
    region: r.region,
    nation: nationFromCountry(r.country),
  };
}

export function nationFromCountry(country) {
  if (country === 'Scotland') return 'scotland';
  if (country === 'Wales') return 'wales';
  return 'england';
}

export function isValidPostcode(postcode) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test((postcode || '').trim());
}
