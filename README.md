# BRR Deal Finder

A tool for finding and assessing buy–refurbish–refinance (BRR) property deals in the UK.

- **Deals** — every deal ranked by max offer, money left in, cashflow, lead over an index fund and an overall score, checked against your buy box. Paste a listing and the price, beds, postcode, EPC and seller signals are picked out for you.
- **Deal workspace**
  - **BRR** — cash waterfall (deposit, stamp duty with surcharge, bridging, works with contingency, holding costs, refinance), max offer for your money-left-in target, stress tests, lender checks (rental cover, the 6-month rule, low values, short leases, non-standard construction) and a refurb estimator.
  - **Value-add options** — refurb only vs an extra bedroom vs an extension vs an HMO, each judged at the value a surveyor is likely to give once the street ceiling is applied. HMOs are checked against Article 4 directions.
  - **Monthly cashflow** — where each month's rent goes, for a limited company or personal ownership (Section 24 applied), interest-only or repayment, plus 25 years of after-tax cashflow including your fixed rate ending.
  - **Long-term vs index fund** — net wealth if you sold in any year compared with an index fund, either with the same cash tied up (fair for BRR) or with all your cash and no recycling.
  - **Evidence** — every sale on the street from HM Land Registry, the street ceiling, done-up and tired prices, the property's own sale history and planning constraints.
  - **Notes and offers** — offer log, agent details, notes and a printable offer pack for agents.
- **Area finder** — ranks postcode sectors in any council by the gap between tired and done-up house prices, using every sale recorded by Land Registry.
- **Assumptions** — buyer type and incomes, buy box, finance, running costs, growth and backup/restore.

## Getting started

```bash
npm install
npm run dev
```

```bash
npm test         # finance engine tests
npm run build    # production build
```

## Data sources

All live data comes from free public APIs called from the browser — no keys needed.

| What | Source |
| --- | --- |
| Sold prices | [HM Land Registry Price Paid Data](https://landregistry.data.gov.uk/) (SPARQL), © Crown copyright, OGL v3.0 |
| Postcodes | [postcodes.io](https://postcodes.io) |
| Article 4 and conservation areas | [planning.data.gov.uk](https://www.planning.data.gov.uk/) |

When a source can't be reached the app says so — it never fills in made-up numbers. Bulk transfers (several properties sold on the same day, recorded as "additional" transactions) and extreme outliers are left out of street evidence.

There is no free source of listings or rents, so deals and rents are entered by you. Asking-rent and ARV fields are marked as estimated until you change them.

## Tax and rates

Rules live in `src/lib/finance/tax.js` so they can be reviewed in one place:

- SDLT (England/NI) from April 2025 with the 5% additional-dwelling surcharge; Scotland LBTT with 8% ADS; Wales LTT higher rates.
- Income tax with Section 24 (20% credit on finance costs), and an optional switch for the 22/42/47% property income rates from April 2027.
- Corporation tax at 19%/25% with marginal relief; CGT at 18%/24% for individuals.

Figures are estimates for screening deals, not financial or tax advice.

## Data storage

Deals and settings are saved in the browser's `localStorage`. Use **Assumptions → Backup** to download a JSON backup or move to another device.

## Project layout

```
src/
  lib/finance/   tax rules and the BRR, cashflow and projection engine (+ tests)
  lib/data/      Land Registry, postcodes.io and planning.data.gov.uk clients
  lib/           defaults, evidence statistics, refurb costs, listing parser
  components/    shared UI kit, charts, refurb estimator, add-deal form
  pages/         Deals, Area finder, Assumptions, deal workspace tabs, offer pack
  state/         app store with localStorage persistence
```
