import { describe, expect, it } from 'vitest';
import { corporationTax, gainsTax, incomeTax, personalPropertyTax, purchaseTax } from './tax.js';
import { balanceAfter, calcBrr, holdYear, maxOffer, monthlyPayment, project, requiredIcr, stressTests, xirr } from './deal.js';
import { DEFAULT_ASSUMPTIONS, mergeAssumptions } from '../defaults.js';
import { ceilingCheck, excludeBulk, rankSectors, streetStats, postcodeSector } from '../evidence.js';
import { parseListing } from '../signals.js';

const A = DEFAULT_ASSUMPTIONS;
const deal = { purchasePrice: 128000, refurbCost: 28000, arv: 185000, rent: 925, monthsToRefi: 6 };

describe('purchase tax', () => {
  it('England SDLT with the 5% surcharge', () => {
    expect(purchaseTax(128000)).toBe(6460);
    expect(purchaseTax(300000)).toBe(20000);
  });
  it('no surcharge for a main home or under £40k', () => {
    expect(purchaseTax(300000, { additional: false })).toBe(5000);
    expect(purchaseTax(30000)).toBe(0);
  });
  it('Scotland LBTT plus 8% ADS', () => {
    expect(purchaseTax(200000, { nation: 'scotland' })).toBe(17100);
  });
  it('Wales LTT higher rates', () => {
    expect(purchaseTax(200000, { nation: 'wales' })).toBe(10700);
  });
});

describe('income and company tax', () => {
  it('income tax bands', () => {
    expect(incomeTax(50000)).toBe(7486);
    expect(incomeTax(60000)).toBe(11432);
  });
  it('Section 24: finance costs give a 20% credit, not a deduction', () => {
    expect(personalPropertyTax({ otherIncome: 60000, profitBeforeFinance: 10000, financeCosts: 6000 })).toBe(2800);
    expect(personalPropertyTax({ otherIncome: 30000, profitBeforeFinance: 10000, financeCosts: 6000 })).toBe(800);
  });
  it('2027 property income rates add 2 points', () => {
    expect(personalPropertyTax({ otherIncome: 60000, profitBeforeFinance: 10000, financeCosts: 0, propertyRates2027: true })).toBe(4200);
  });
  it('corporation tax with marginal relief', () => {
    expect(corporationTax(40000)).toBe(7600);
    expect(corporationTax(100000)).toBe(22750);
    expect(corporationTax(300000)).toBe(75000);
    expect(corporationTax(-500)).toBe(0);
  });
  it('CGT for individuals uses the basic band left', () => {
    expect(gainsTax(23000, { buyerType: 'individual', otherIncome: 60000 })).toBe(4800);
  });
});

describe('mortgage maths', () => {
  it('repayment and balance', () => {
    expect(monthlyPayment(100000, 0.06, 25)).toBeCloseTo(644.3, 1);
    expect(balanceAfter(100000, 0.06, 25, 300)).toBeCloseTo(0, 2);
  });
  it('xirr', () => {
    expect(xirr([{ t: 0, amount: -100 }, { t: 1, amount: 110 }])).toBeCloseTo(0.1, 6);
  });
});

describe('BRR', () => {
  const r = calcBrr(deal, A);
  it('builds the cash waterfall', () => {
    expect(r.bridge).toBe(96000);
    expect(r.deposit).toBe(32000);
    expect(r.stampDuty).toBe(6460);
    expect(r.bridgeInterest).toBeCloseTo(96000 * 0.0085 * 6, 6);
    expect(r.works).toBeCloseTo(30800, 6);
    const sum = r.deposit + r.stampDuty + r.purchaseFees + r.bridgeFees + r.bridgeInterest + r.works + r.holding;
    expect(r.cashIn).toBeCloseTo(sum, 6);
    expect(r.moneyLeftIn).toBeCloseTo(r.cashIn - r.released, 6);
  });
  it('refinance limited by rent when rental cover binds', () => {
    const low = calcBrr({ ...deal, rent: 500 }, A);
    expect(low.limitedBy).toBe('rent');
    expect(low.refiLoan).toBeCloseTo((500 * 12) / (1.25 * 0.055), 4);
  });
  it('higher-rate individuals need 145% cover', () => {
    const ind = mergeAssumptions(A, { buyer: { type: 'individual', owners: [{ income: 70000, share: 1 }] } });
    expect(requiredIcr(ind)).toBe(1.45);
  });
  it('max offer hits the target', () => {
    const target = 5000;
    const p = maxOffer(deal, A, target);
    expect(calcBrr({ ...deal, purchasePrice: p }, A).moneyLeftIn).toBeLessThanOrEqual(target);
    expect(calcBrr({ ...deal, purchasePrice: p + 1000 }, A).moneyLeftIn).toBeGreaterThan(target);
  });
  it('stress tests are worse than the base case', () => {
    const s = stressTests(deal, A, 5000);
    const base = s.find((x) => x.id === 'base');
    for (const x of s.filter((v) => ['arv', 'refurb', 'time', 'combo'].includes(v.id))) {
      expect(x.moneyLeftIn).toBeGreaterThan(base.moneyLeftIn);
    }
  });
});

describe('hold and projection', () => {
  it('company pays corporation tax on profit after interest', () => {
    const y = holdYear({ monthlyRent: 1000, loan: 100000, balance: 100000, rate: 0.05, A });
    const profit = y.collected - y.opex - 5000;
    expect(y.tax).toBeCloseTo(profit * 0.19, 2);
    expect(y.net).toBeCloseTo(y.collected - y.opex - y.debtService - y.tax, 6);
  });
  it('index fund in tied mode starts with the money left in', () => {
    const { brr, rows } = project(deal, A, { years: 10 });
    expect(rows[0].indexFund).toBeCloseTo(Math.max(0, brr.moneyLeftIn), 6);
    expect(rows[10].indexFund).toBeCloseTo(Math.max(0, brr.moneyLeftIn) * Math.pow(1.07, 10), 4);
  });
  it('repayment mortgage reduces the balance', () => {
    const rep = mergeAssumptions(A, { refi: { repayment: 'repayment' } });
    const { rows } = project(deal, rep, { years: 5 });
    expect(rows[5].balance).toBeLessThan(rows[0].balance);
  });
});

describe('evidence', () => {
  const sales = [120, 130, 140, 150, 160, 170, 180, 192].map((k, i) => ({
    price: k * 1000,
    date: `202${i % 5 + 1}-06-01`,
    propertyType: 'semi-detached',
    postcode: 'FY5 1AB',
  }));
  it('street ceiling', () => {
    const s = streetStats(sales, { propertyType: 'semi-detached' });
    expect(s.ceiling).toBe(192000);
    expect(ceilingCheck(200000, s).status).toBe('over');
    expect(ceilingCheck(185000, s).status).toBe('near');
    expect(ceilingCheck(150000, s).status).toBe('within');
    expect(ceilingCheck(230000, s).surveyorArv).toBe(198000);
  });
  it('drops bulk transfers but keeps single company purchases', () => {
    const rows = [
      { price: 432000, date: '2019-10-25', category: 'additional', postcode: 'FY7 6HL' },
      { price: 691000, date: '2019-10-25', category: 'additional', postcode: 'FY7 6HL' },
      { price: 120000, date: '2021-03-01', category: 'additional', postcode: 'FY7 6HL' },
      { price: 125000, date: '2021-03-01', category: 'standard', postcode: 'FY7 6HL' },
    ];
    const { kept, excluded } = excludeBulk(rows);
    expect(excluded).toBe(2);
    expect(kept.map((r) => r.price)).toEqual([120000, 125000]);
  });
  it('sector ranking', () => {
    expect(postcodeSector('fy5 1ab')).toBe('FY5 1');
    const r = rankSectors(sales, { minSales: 5 });
    expect(r[0].sector).toBe('FY5 1');
    expect(r[0].spread).toBeGreaterThan(0);
  });
});

describe('listing parser', () => {
  it('pulls price, beds, postcode and signals', () => {
    const p = parseListing('Reduced! 3 bedroom semi-detached in FY51LH. For sale by auction, guide price £135,000. Requires modernisation, cash buyers only. EPC rating F');
    expect(p.askingPrice).toBe(135000);
    expect(p.beds).toBe(3);
    expect(p.postcode).toBe('FY5 1LH');
    expect(p.epc).toBe('F');
    expect(p.propertyType).toBe('semi-detached');
    expect(p.signals).toEqual(expect.arrayContaining(['price-cut', 'modernisation', 'cash-only', 'auction']));
  });
});
