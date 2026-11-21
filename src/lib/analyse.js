// One place that turns a saved deal into every number the screens show.
import { mergeAssumptions } from './defaults.js';
import { calcBrr, dealScore, holdYear, maxOffer, project } from './finance/deal.js';
import { ceilingCheck } from './evidence.js';
import { postcodeSector } from './evidence.js';

/** Assumptions for a deal: global defaults, the deal's nation, then per-deal overrides. */
export function dealAssumptions(deal, A) {
  return mergeAssumptions(mergeAssumptions(A, { buyer: { nation: deal.nation || A.buyer.nation } }), deal.overrides);
}

/** The numbers fed into the engine, for the base case or a value-add option. */
export function dealInputs(deal, option) {
  const src = option ?? deal;
  return {
    purchasePrice: Number(deal.purchasePrice) || Number(deal.askingPrice) || 0,
    refurbCost: Number(src.refurbCost) || 0,
    arv: Number(src.arv) || 0,
    rent: Number(src.rent) || 0,
    monthsToRefi: Number(src.monthsToRefi) || Number(deal.monthsToRefi) || 6,
    serviceCharge: Number(deal.serviceCharge) || 0,
    nation: deal.nation,
  };
}

/** Option-specific running costs (HMOs pay bills and higher management). */
export function optionAssumptions(A, option) {
  if (!option?.hmo) return A;
  return mergeAssumptions(A, {
    operating: {
      managementPct: Math.max(A.operating.managementPct, 0.15),
      other: (A.operating.other || 0) + (Number(option.billsPerMonth) || 0) * 12 + 1200, // + HMO licence and fire safety
    },
  });
}

export function analyseDeal(deal, A, buyBox, { option } = {}) {
  const DA = optionAssumptions(dealAssumptions(deal, A), option);
  const inputs = dealInputs(deal, option);
  const brr = calcBrr(inputs, DA);
  const y1 = holdYear({ monthlyRent: inputs.rent, loan: brr.refiLoan, balance: brr.refiLoan, rate: DA.refi.rate, A: DA, serviceCharge: inputs.serviceCharge });
  const monthly = y1.net / 12;
  const target = buyBox.maxLeftIn;
  const ceiling = deal.evidence?.ceiling ? ceilingCheck(inputs.arv, { ceiling: deal.evidence.ceiling }) : { status: 'unknown', surveyorArv: inputs.arv };
  const proj = project(inputs, DA, { years: 10 });
  const y10 = proj.rows[10];
  const grossYield = inputs.purchasePrice > 0 ? (inputs.rent * 12) / inputs.purchasePrice : 0;
  const score = dealScore({ brr, monthly, target, ceilingStatus: ceiling.status });

  const checks = [
    { id: 'price', label: `Price ≤ ${buyBox.maxPrice.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })}`, pass: (Number(deal.askingPrice) || inputs.purchasePrice) <= buyBox.maxPrice },
    { id: 'left', label: 'Money left in', pass: brr.moneyLeftIn <= target },
    { id: 'yield', label: 'Gross yield', pass: grossYield >= buyBox.minYield },
    { id: 'cash', label: 'Cashflow', pass: monthly >= buyBox.minCashflow },
  ];
  if (buyBox.areas?.length) {
    const sector = postcodeSector(deal.postcode);
    checks.push({ id: 'area', label: 'In your areas', pass: !!sector && buyBox.areas.includes(sector) });
  }

  return {
    A: DA,
    inputs,
    brr,
    y1,
    monthly,
    grossYield,
    maxOffer: maxOffer(inputs, DA, target),
    ceiling,
    score,
    checks,
    passes: checks.every((c) => c.pass),
    vsIndex10: y10.propertyWealth - y10.indexFund,
  };
}
