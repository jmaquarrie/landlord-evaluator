// UK tax rules used by the deal engine. Rates current for the 2025/26 tax year
// unless noted. Keep every rate in this file so they can be reviewed in one place.

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

function bandTax(amount, bands) {
  let tax = 0;
  let last = 0;
  for (const [upTo, rate] of bands) {
    const slice = Math.max(0, Math.min(amount, upTo) - last);
    tax += slice * rate;
    last = upTo;
    if (amount <= upTo) break;
  }
  return tax;
}

// ---------------------------------------------------------------- purchase tax

// England and Northern Ireland SDLT, residential, from 1 April 2025.
const SDLT_BANDS = [
  [125000, 0],
  [250000, 0.02],
  [925000, 0.05],
  [1500000, 0.1],
  [Infinity, 0.12],
];
const SDLT_SURCHARGE = 0.05; // higher rates for additional dwellings, from 31 Oct 2024

// Scotland LBTT, plus Additional Dwelling Supplement (8% from 5 Dec 2024).
const LBTT_BANDS = [
  [145000, 0],
  [250000, 0.02],
  [325000, 0.05],
  [750000, 0.1],
  [Infinity, 0.12],
];
const LBTT_ADS = 0.08;

// Wales LTT higher residential rates (from 11 Dec 2024), used for additional homes.
const LTT_HIGHER_BANDS = [
  [180000, 0.05],
  [250000, 0.085],
  [400000, 0.1],
  [750000, 0.125],
  [1500000, 0.15],
  [Infinity, 0.17],
];

/**
 * Purchase tax on a buy-to-let. Investors buying in a company, or who already
 * own a home, pay the additional-dwelling rates. Purchases under £40k are
 * outside the surcharge.
 */
export function purchaseTax(price, { nation = 'england', additional = true } = {}) {
  if (!(price > 0)) return 0;
  const surchargeApplies = additional && price >= 40000;
  if (nation === 'scotland') {
    return round2(bandTax(price, LBTT_BANDS) + (surchargeApplies ? price * LBTT_ADS : 0));
  }
  if (nation === 'wales') {
    if (surchargeApplies) return round2(bandTax(price, LTT_HIGHER_BANDS));
    return round2(
      bandTax(price, [
        [225000, 0],
        [400000, 0.06],
        [750000, 0.075],
        [1500000, 0.1],
        [Infinity, 0.12],
      ]),
    );
  }
  return round2(bandTax(price, SDLT_BANDS) + (surchargeApplies ? price * SDLT_SURCHARGE : 0));
}

export function purchaseTaxName(nation) {
  return nation === 'scotland' ? 'LBTT + ADS' : nation === 'wales' ? 'Land transaction tax' : 'Stamp duty';
}

// ---------------------------------------------------------------- income tax

export const PERSONAL_ALLOWANCE = 12570;
const BASIC_BAND = 37700;
const ADDITIONAL_THRESHOLD = 125140;

function personalAllowance(income) {
  if (income <= 100000) return PERSONAL_ALLOWANCE;
  return Math.max(0, PERSONAL_ALLOWANCE - (income - 100000) / 2);
}

/**
 * Income tax (England/Wales/NI bands) on total income, where `propertyIncome`
 * is the slice of it that is property profit. From April 2027 property income
 * is taxed at 22/42/47% (announced Nov 2025 Budget) — pass `propertyRates2027`.
 */
export function incomeTax(otherIncome, propertyIncome = 0, { propertyRates2027 = false } = {}) {
  const total = Math.max(0, otherIncome + propertyIncome);
  const pa = personalAllowance(total);
  const basicTop = pa + BASIC_BAND;
  const rates = [0.2, 0.4, 0.45];
  const propRates = propertyRates2027 ? [0.22, 0.42, 0.47] : rates;

  // Other income fills the bands first; property income sits on top of it.
  const bands = [
    [0, pa, 0, 0],
    [pa, basicTop, rates[0], propRates[0]],
    [basicTop, ADDITIONAL_THRESHOLD, rates[1], propRates[1]],
    [ADDITIONAL_THRESHOLD, Infinity, rates[2], propRates[2]],
  ];
  const other = Math.min(Math.max(0, otherIncome), total);
  const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  let tax = 0;
  for (const [lo, hi, rate, propRate] of bands) {
    tax += overlap(0, other, lo, hi) * rate + overlap(other, total, lo, hi) * propRate;
  }
  return round2(tax);
}

/**
 * Extra personal tax caused by a property profit, with Section 24: finance
 * costs are not deductible, instead a basic-rate tax credit is given.
 */
export function personalPropertyTax({ otherIncome, profitBeforeFinance, financeCosts, propertyRates2027 = false }) {
  const base = incomeTax(otherIncome, 0, { propertyRates2027 });
  const withProperty = incomeTax(otherIncome, Math.max(0, profitBeforeFinance), { propertyRates2027 });
  const creditRate = propertyRates2027 ? 0.22 : 0.2;
  const credit = Math.min(Math.max(0, financeCosts), Math.max(0, profitBeforeFinance)) * creditRate;
  return round2(Math.max(0, withProperty - base - credit));
}

/** Marginal income tax rate for someone on this income (for display and ICR choice). */
export function marginalRate(income) {
  if (income <= personalAllowance(income)) return 0;
  if (income <= personalAllowance(income) + BASIC_BAND) return 0.2;
  if (income <= ADDITIONAL_THRESHOLD) return 0.4;
  return 0.45;
}

// ---------------------------------------------------------------- company tax

/** Corporation tax with small profits rate and marginal relief (single company, no associates). */
export function corporationTax(profit) {
  if (!(profit > 0)) return 0;
  const lower = 50000;
  const upper = 250000;
  if (profit <= lower) return round2(profit * 0.19);
  if (profit >= upper) return round2(profit * 0.25);
  const marginalRelief = (3 / 200) * (upper - profit);
  return round2(profit * 0.25 - marginalRelief);
}

// ---------------------------------------------------------------- gains

/** Tax on sale. Individuals pay residential CGT (18/24%), companies pay corporation tax. */
export function gainsTax(gain, { buyerType, otherIncome = 0, owners = 1 }) {
  if (!(gain > 0)) return 0;
  if (buyerType === 'company') return corporationTax(gain);
  const exemption = 3000;
  const perOwner = gain / owners;
  let total = 0;
  for (let i = 0; i < owners; i += 1) {
    const taxable = Math.max(0, perOwner - exemption);
    const basicLeft = Math.max(0, PERSONAL_ALLOWANCE + BASIC_BAND - otherIncome);
    const atBasic = Math.min(taxable, basicLeft);
    total += atBasic * 0.18 + (taxable - atBasic) * 0.24;
  }
  return round2(total);
}
