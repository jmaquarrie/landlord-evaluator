// planning.data.gov.uk — Article 4 directions and conservation areas at a point.
// Coverage depends on councils publishing their data, so "none found" means
// "none recorded", not "none exist".

const BASE = 'https://www.planning.data.gov.uk/entity.json';

async function entitiesAt(dataset, lat, lon, signal) {
  const params = new URLSearchParams({ dataset, latitude: String(lat), longitude: String(lon), limit: '10', exclude_field: 'geometry' });
  const res = await fetch(`${BASE}?${params}`, { signal });
  if (!res.ok) throw new Error(`planning.data.gov.uk returned ${res.status}`);
  const json = await res.json();
  return (json.entities ?? []).filter((e) => !e['end-date']);
}

export async function planningConstraints({ lat, lon }, { signal } = {}) {
  const [article4, conservation] = await Promise.all([
    entitiesAt('article-4-direction-area', lat, lon, signal),
    entitiesAt('conservation-area', lat, lon, signal),
  ]);
  return {
    article4: article4.map((e) => ({
      name: e.name || e.reference,
      rights: e['permitted-development-rights'] || '',
      // Class L (3L) is the C3 house → C4 small HMO change of use.
      blocksHmo: /(^|[^0-9])3L|class l|c4|hmo/i.test(`${e['permitted-development-rights']} ${e.name} ${e.description ?? ''}`),
    })),
    conservation: conservation.map((e) => e.name || e.reference),
  };
}
