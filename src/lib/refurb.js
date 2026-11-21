// Refurb cost estimating. Figures are typical 2025/26 North-West England
// contractor prices; adjust with the region factor on the Assumptions page.

export const SCOPES = [
  { value: 'cosmetic', label: 'Cosmetic', perM2: 160, hint: 'Decorate, flooring, light fixes' },
  { value: 'medium', label: 'Medium', perM2: 420, hint: 'Kitchen, bathroom, decorate' },
  { value: 'full', label: 'Full', perM2: 750, hint: 'Rewire, heating, kitchen, bath, plaster' },
  { value: 'structural', label: 'Structural', perM2: 1100, hint: 'Full plus walls, roof or damp works' },
];

export const LINE_ITEMS = [
  { id: 'kitchen', label: 'Kitchen', cost: 6500 },
  { id: 'bathroom', label: 'Bathroom', cost: 4800 },
  { id: 'rewire', label: 'Full rewire', cost: 4500 },
  { id: 'boiler', label: 'Boiler and radiators', cost: 5200 },
  { id: 'plaster', label: 'Replaster', perM2: 32 },
  { id: 'decorate', label: 'Decorate throughout', perM2: 28 },
  { id: 'flooring', label: 'Flooring and carpets', perM2: 34 },
  { id: 'windows', label: 'Windows and doors', cost: 5500 },
  { id: 'damp', label: 'Damp treatment', cost: 2800 },
  { id: 'roof', label: 'Roof repairs', cost: 4500 },
  { id: 'insulation', label: 'Insulation (EPC upgrade)', cost: 2600 },
  { id: 'garden', label: 'Garden and exterior', cost: 1800 },
  { id: 'wall', label: 'Remove or add a wall', cost: 3500 },
];

export function scopeEstimate(scope, floorArea, regionFactor = 1) {
  const s = SCOPES.find((x) => x.value === scope) ?? SCOPES[1];
  return Math.round(((Number(floorArea) || 70) * s.perM2 * regionFactor) / 100) * 100;
}

export function lineItemCost(item, floorArea, regionFactor = 1) {
  const base = item.perM2 ? item.perM2 * (Number(floorArea) || 70) : item.cost;
  return Math.round((base * regionFactor) / 50) * 50;
}

export function lineItemsTotal(selectedIds, floorArea, regionFactor = 1) {
  return LINE_ITEMS.filter((i) => selectedIds.includes(i.id)).reduce(
    (s, i) => s + lineItemCost(i, floorArea, regionFactor),
    0,
  );
}

/** Typical EPC upgrade spend to reach band C, used as a planning figure. */
export function epcUpgradeEstimate(band) {
  return { A: 0, B: 0, C: 0, D: 3000, E: 6500, F: 9000, G: 10000 }[band] ?? 0;
}
