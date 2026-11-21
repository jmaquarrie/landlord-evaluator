// Default assumptions. Every deal uses these unless the deal overrides a value.
// Users edit them on the Assumptions page.

export const DEFAULT_ASSUMPTIONS = {
  buyer: {
    type: 'company', // 'company' | 'individual'
    nation: 'england', // 'england' | 'scotland' | 'wales'
    ownsOtherHome: true, // individuals only: triggers the additional-dwelling surcharge
    owners: [
      { name: 'Owner 1', income: 50000, share: 1 },
    ],
    propertyRates2027: false, // apply 22/42/47% property income rates (from April 2027)
  },
  purchase: {
    legals: 1800,
    survey: 400,
    otherFees: 0,
  },
  bridging: {
    use: true,
    ltv: 0.75,
    monthlyRate: 0.0085,
    arrangementPct: 0.02,
    exitPct: 0,
  },
  refurb: {
    contingencyPct: 0.1,
    holdingPerMonth: 300, // council tax, empty-property insurance, utilities
  },
  refi: {
    ltv: 0.75,
    rate: 0.052,
    termYears: 25,
    repayment: 'interest_only', // 'interest_only' | 'repayment'
    productFeePct: 0.01,
    brokerFee: 500,
    valuationFee: 450,
    legals: 900,
    icrStressRate: 0.055,
  },
  operating: {
    voidPct: 0.04,
    managementPct: 0.12,
    maintenancePct: 0.08,
    insurance: 450,
    compliance: 300, // gas safety, EICR, licensing, deposit protection
    other: 0,
  },
  growth: {
    housePrice: 0.03,
    rent: 0.03,
    indexFund: 0.07,
    fixYears: 5,
    rateAfterFix: 0.055,
  },
  exit: {
    sellingPct: 0.015,
  },
};

export const DEFAULT_BUY_BOX = {
  areas: [],
  maxPrice: 160000,
  maxLeftIn: 10000,
  minYield: 0.08,
  minCashflow: 100,
};

export const DEFAULT_SETTINGS = {
  cashPot: 60000,
  regionFactor: 1, // refurb cost multiplier for your area
};

export const PROPERTY_TYPES = [
  { value: 'terraced', label: 'Terraced' },
  { value: 'semi-detached', label: 'Semi-detached' },
  { value: 'detached', label: 'Detached' },
  { value: 'flat', label: 'Flat' },
  { value: 'bungalow', label: 'Bungalow' },
];

export const STAGES = ['Lead', 'Viewed', 'Offered', 'Accepted', 'Refurb', 'Refinanced', 'Dropped'];

export const EPC_BANDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export function mergeAssumptions(base, override) {
  if (!override) return base;
  const out = { ...base };
  for (const key of Object.keys(override)) {
    const value = override[key];
    if (value === undefined) continue;
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object'
        ? { ...base[key], ...value }
        : value;
  }
  return out;
}
