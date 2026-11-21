import { corporationTax, gainsTax, marginalRate, personalPropertyTax, purchaseTax } from './tax.js';

// ---------------------------------------------------------------- helpers

export function monthlyPayment(principal, annualRate, years) {
  if (!(principal > 0)) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function balanceAfter(principal, annualRate, years, monthsPaid) {
  if (!(principal > 0)) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  const k = Math.min(monthsPaid, n);
  if (r === 0) return principal * (1 - k / n);
  const pmt = monthlyPayment(principal, annualRate, years);
  return Math.max(0, principal * Math.pow(1 + r, k) - pmt * ((Math.pow(1 + r, k) - 1) / r));
}

/** IRR for cash flows at fractional year times: [{ t, amount }]. Returns null when undefined. */
export function xirr(flows) {
  const npv = (rate) => flows.reduce((s, f) => s + f.amount / Math.pow(1 + rate, f.t), 0);
  let lo = -0.99;
  let hi = 10;
  const fLo = npv(lo);
  const fHi = npv(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (npv(mid) * fLo > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function isAdditional(A) {
  return A.buyer.type === 'company' || A.buyer.ownsOtherHome;
}

function ownersOf(A) {
  const owners = A.buyer.owners?.length ? A.buyer.owners : [{ income: 0, share: 1 }];
  const total = owners.reduce((s, o) => s + (Number(o.share) || 0), 0) || owners.length;
  return owners.map((o) => ({ ...o, share: (Number(o.share) || 0) / total || 1 / owners.length }));
}

/** Rental cover lenders want: 125% for companies and basic-rate taxpayers, 145% for higher-rate. */
export function requiredIcr(A) {
  if (A.buyer.type === 'company') return 1.25;
  const top = Math.max(...ownersOf(A).map((o) => marginalRate(Number(o.income) || 0)));
  return top >= 0.4 ? 1.45 : 1.25;
}

// ---------------------------------------------------------------- BRR

/**
 * Buy, refurbish, refinance. `deal` needs purchasePrice, refurbCost, arv, rent
 * (monthly) and monthsToRefi. Returns every line of the cash waterfall.
 */
export function calcBrr(deal, A) {
  const price = Math.max(0, Number(deal.purchasePrice) || 0);
  const months = Math.max(1, Number(deal.monthsToRefi) || 6);
  const arv = Math.max(0, Number(deal.arv) || 0);
  const rent = Math.max(0, Number(deal.rent) || 0);
  const nation = deal.nation || A.buyer.nation;

  const bridge = A.bridging.use ? price * A.bridging.ltv : 0;
  const deposit = price - bridge;
  const stampDuty = purchaseTax(price, { nation, additional: isAdditional(A) });
  const purchaseFees = A.purchase.legals + A.purchase.survey + (A.purchase.otherFees || 0);
  const bridgeFees = bridge * (A.bridging.arrangementPct + A.bridging.exitPct);
  const bridgeInterest = bridge * A.bridging.monthlyRate * months;
  const works = (Number(deal.refurbCost) || 0) * (1 + A.refurb.contingencyPct);
  const holding = A.refurb.holdingPerMonth * months;
  const cashIn = deposit + stampDuty + purchaseFees + bridgeFees + bridgeInterest + works + holding;

  const icr = requiredIcr(A);
  const ltvLoan = arv * A.refi.ltv;
  const icrLoan = rent > 0 ? (rent * 12) / (icr * A.refi.icrStressRate) : 0;
  const refiLoan = Math.min(ltvLoan, icrLoan);
  const limitedBy = icrLoan < ltvLoan ? 'rent' : 'ltv';
  const refiFees = refiLoan * A.refi.productFeePct + A.refi.brokerFee + A.refi.valuationFee + A.refi.legals;
  const released = refiLoan - bridge - refiFees;
  const moneyLeftIn = cashIn - released;

  return {
    price,
    months,
    arv,
    rent,
    bridge,
    deposit,
    stampDuty,
    purchaseFees,
    bridgeFees,
    bridgeInterest,
    works,
    holding,
    cashIn,
    refiLoan,
    ltvLoan,
    icrLoan,
    limitedBy,
    requiredIcr: icr,
    icrCover: refiLoan > 0 ? (rent * 12) / (refiLoan * A.refi.icrStressRate) : 0,
    refiFees,
    released,
    moneyLeftIn,
    recycledPct: cashIn > 0 ? Math.max(0, Math.min(1, released / cashIn)) : 0,
    equityAfterRefi: arv - refiLoan,
    // Cost base for tax on sale: purchase, purchase costs and works.
    costBase: price + stampDuty + purchaseFees + works,
  };
}

// ---------------------------------------------------------------- hold

/** One year of letting, given the rent that year and the loan. */
export function holdYear({ monthlyRent, loan, balance, rate, A, serviceCharge = 0 }) {
  const gross = monthlyRent * 12;
  const voids = gross * A.operating.voidPct;
  const collected = gross - voids;
  const management = collected * A.operating.managementPct;
  const maintenance = gross * A.operating.maintenancePct;
  const fixed = A.operating.insurance + A.operating.compliance + (A.operating.other || 0) + serviceCharge * 12;
  const opex = management + maintenance + fixed;

  const interest = balance * rate;
  const debtService =
    A.refi.repayment === 'repayment' ? Math.min(monthlyPayment(loan, rate, A.refi.termYears) * 12, balance + interest) : interest;
  const principal = Math.max(0, debtService - interest);

  const profitBeforeFinance = collected - opex;
  let tax;
  if (A.buyer.type === 'company') {
    tax = corporationTax(profitBeforeFinance - interest);
  } else {
    tax = ownersOf(A).reduce(
      (s, o) =>
        s +
        personalPropertyTax({
          otherIncome: Number(o.income) || 0,
          profitBeforeFinance: profitBeforeFinance * o.share,
          financeCosts: interest * o.share,
          propertyRates2027: A.buyer.propertyRates2027,
        }),
      0,
    );
  }
  const preTax = collected - opex - debtService;
  return {
    gross,
    voids,
    collected,
    management,
    maintenance,
    insurance: A.operating.insurance,
    compliance: A.operating.compliance + (A.operating.other || 0),
    serviceCharge: serviceCharge * 12,
    opex,
    interest,
    debtService,
    principal,
    tax,
    preTax,
    net: preTax - tax,
  };
}

/** Rent at which after-tax cashflow is zero. */
export function breakEvenRent(deal, A) {
  const brr = calcBrr(deal, A);
  let lo = 0;
  let hi = 20000;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const y = holdYear({ monthlyRent: mid, loan: brr.refiLoan, balance: brr.refiLoan, rate: A.refi.rate, A, serviceCharge: deal.serviceCharge });
    if (y.net > 0) hi = mid;
    else lo = mid;
  }
  return hi;
}

// ---------------------------------------------------------------- long term

/**
 * Year-by-year projection after refinance, and the index-fund alternative.
 * mode 'tied': the fund gets the money you actually leave in the deal.
 * mode 'full': the fund gets all your cash; the property side keeps returned capital as cash.
 */
export function project(deal, A, { years = 25, mode = 'tied', reinvest = false } = {}) {
  const brr = calcBrr(deal, A);
  const g = A.growth;
  const owners = ownersOf(A);
  const loan = brr.refiLoan;
  let balance = loan;
  let value = brr.arv;
  let rent = brr.rent;
  let cumCash = 0;
  let reinvestFund = 0;
  const leftIn = Math.max(0, brr.moneyLeftIn);
  let fund = mode === 'full' ? brr.cashIn : leftIn;
  const returnedCash = mode === 'full' ? Math.max(0, brr.released) : 0;

  const exitPosition = (v, bal) => {
    const netSale = v * (1 - A.exit.sellingPct);
    const gain = netSale - brr.costBase;
    const tax =
      A.buyer.type === 'company'
        ? corporationTax(gain)
        : gainsTax(gain, {
            buyerType: 'individual',
            otherIncome: Math.max(...owners.map((o) => Number(o.income) || 0)),
            owners: owners.length,
          });
    return { netSale, tax, equity: netSale - bal - tax };
  };

  const rows = [];
  const start = exitPosition(value, balance);
  rows.push({
    year: 0,
    value,
    balance,
    equity: value - balance,
    cashflow: 0,
    cumCash: 0,
    propertyWealth: mode === 'full' ? brr.cashIn : leftIn,
    exitEquity: start.equity,
    indexFund: fund,
  });

  for (let year = 1; year <= years; year += 1) {
    const rate = year <= g.fixYears ? A.refi.rate : g.rateAfterFix;
    const y = holdYear({ monthlyRent: rent, loan, balance, rate, A, serviceCharge: deal.serviceCharge });
    balance = Math.max(0, balance - y.principal);
    value *= 1 + g.housePrice;
    cumCash += y.net;
    if (reinvest) reinvestFund = reinvestFund * (1 + g.indexFund) + Math.max(0, y.net);
    fund *= 1 + g.indexFund;
    const exit = exitPosition(value, balance);
    const cashSide = reinvest ? reinvestFund + Math.min(0, cumCash) : cumCash;
    rows.push({
      year,
      rate,
      rent,
      value,
      balance,
      equity: value - balance,
      cashflow: y.net,
      cumCash,
      exitEquity: exit.equity,
      saleTax: exit.tax,
      propertyWealth: exit.equity + cashSide + returnedCash,
      indexFund: fund,
    });
    rent *= 1 + g.rent;
  }
  return { brr, rows };
}

/** Annualised return on the cash you put in, selling at `exitYear`. */
export function dealIrr(deal, A, exitYear = 10) {
  const { brr, rows } = project(deal, A, { years: exitYear });
  const refiT = brr.months / 12;
  const flows = [
    { t: 0, amount: -brr.cashIn },
    { t: refiT, amount: brr.released },
  ];
  for (let y = 1; y <= exitYear; y += 1) flows.push({ t: refiT + y, amount: rows[y].cashflow });
  flows.push({ t: refiT + exitYear, amount: rows[exitYear].exitEquity });
  return xirr(flows);
}

// ---------------------------------------------------------------- search tools

/** Highest purchase price that keeps money left in at or under `target`. */
export function maxOffer(deal, A, target) {
  const left = (p) => calcBrr({ ...deal, purchasePrice: p }, A).moneyLeftIn;
  if (left(1000) > target) return 0;
  let lo = 1000;
  let hi = Math.max(1000000, (Number(deal.arv) || 0) * 2);
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (left(mid) <= target) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo / 500) * 500;
}

export function stressTests(deal, A, target) {
  const scenarios = [
    { id: 'base', label: 'Base case', deal, A },
    { id: 'arv', label: 'ARV down-valued 10%', deal: { ...deal, arv: deal.arv * 0.9 }, A },
    { id: 'refurb', label: 'Refurb overrun 20%', deal: { ...deal, refurbCost: deal.refurbCost * 1.2 }, A },
    { id: 'time', label: 'Works take 3 months longer', deal: { ...deal, monthsToRefi: (Number(deal.monthsToRefi) || 6) + 3 }, A },
    { id: 'rate', label: 'Refinance rate 2% higher', deal, A: { ...A, refi: { ...A.refi, rate: A.refi.rate + 0.02, icrStressRate: A.refi.icrStressRate + 0.02 } } },
    { id: 'rent', label: 'Rent 10% lower', deal: { ...deal, rent: deal.rent * 0.9 }, A },
    { id: 'combo', label: 'ARV −10% and refurb +20%', deal: { ...deal, arv: deal.arv * 0.9, refurbCost: deal.refurbCost * 1.2 }, A },
  ];
  return scenarios.map((s) => {
    const brr = calcBrr(s.deal, s.A);
    const y = holdYear({ monthlyRent: brr.rent, loan: brr.refiLoan, balance: brr.refiLoan, rate: s.A.refi.rate, A: s.A, serviceCharge: deal.serviceCharge });
    const monthly = y.net / 12;
    const slack = Math.max(5000, target);
    let verdict = 'fails';
    if (brr.moneyLeftIn <= target && monthly > 0) verdict = 'works';
    else if (brr.moneyLeftIn <= target + slack && monthly > 0) verdict = 'tight';
    return { id: s.id, label: s.label, moneyLeftIn: brr.moneyLeftIn, monthly, verdict };
  });
}

/**
 * Overall deal score out of 100. Weighted on what matters for BRR: how much
 * cash stays in, cashflow after refinance, rental cover headroom, and whether
 * the ARV is backed by street evidence.
 */
export function dealScore({ brr, monthly, target, ceilingStatus }) {
  const leftScore = brr.cashIn > 0 ? Math.max(0, Math.min(1, 1 - (brr.moneyLeftIn - target) / Math.max(brr.cashIn * 0.5, 1))) : 0;
  const cfScore = Math.max(0, Math.min(1, monthly / 300));
  const icrScore = Math.max(0, Math.min(1, (brr.icrCover - 1) / 0.6));
  const ceil = { within: 1, near: 0.6, over: 0.15 }[ceilingStatus] ?? 0.6;
  return Math.round(leftScore * 40 + cfScore * 25 + icrScore * 15 + ceil * 20);
}
