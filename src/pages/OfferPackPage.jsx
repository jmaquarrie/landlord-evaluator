import { useMemo } from 'react';
import { useStore } from '../state/store.jsx';
import { analyseDeal } from '../lib/analyse.js';
import { useDealEvidence } from '../lib/data/useDealEvidence.js';
import { LINE_ITEMS, lineItemCost } from '../lib/refurb.js';
import { gbp, shortDate } from '../lib/format.js';
import { Button, Spinner } from '../components/ui.jsx';

/**
 * One-page pack to send an agent with an offer: comparable sales, the works
 * needed, and how the offer was reached. Leaves out your margins.
 */
export default function OfferPackPage({ id }) {
  const { deals, assumptions, buyBox, updateDeal, settings } = useStore();
  const deal = deals.find((d) => d.id === id);
  const evidence = useDealEvidence(deal, updateDeal);
  const a = useMemo(() => (deal ? analyseDeal(deal, assumptions, buyBox) : null), [deal, assumptions, buyBox]);
  if (!deal) return <p className="p-8">Deal not found.</p>;

  const offer = deal.offers?.[0]?.amount ?? a.maxOffer;
  const pitch =
    deal.packPitch ??
    'Proceedable buyer able to move quickly. The offer reflects the cost of the works below and recent sales of unmodernised homes on the street.';
  const stats = evidence.stats;
  const tired = stats ? [...stats.pool].filter((s) => s.price <= stats.tired * 1.1).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 6) : [];
  const items = LINE_ITEMS.filter((i) => (deal.refurbItems || []).includes(i.id));

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl justify-between px-4 no-print">
        <a href={`#/deal/${deal.id}`} className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to deal
        </a>
        <Button variant="primary" onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>
      <article className="mx-auto max-w-3xl space-y-6 bg-white p-10 text-sm text-slate-800 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b border-slate-200 pb-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Offer summary · {new Date().toLocaleDateString('en-GB')}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{deal.address}</h1>
          <p className="text-slate-600">
            {deal.postcode} · {deal.beds} bed {deal.propertyType} · asking {gbp(deal.askingPrice)}
          </p>
        </header>

        <section>
          <h2 className="text-base font-semibold text-slate-900">Offer: {gbp(offer)}</h2>
          <textarea
            aria-label="Your position as a buyer"
            rows={3}
            value={pitch}
            onChange={(e) => updateDeal(deal.id, { packPitch: e.target.value })}
            className="no-print mt-2 w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
          />
          <p className="no-print mt-1 text-xs text-slate-400">Edit this to describe your position honestly. Only this text is printed.</p>
          <p className="mt-1 hidden whitespace-pre-line text-slate-600 print:block">{pitch}</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-900">Works needed</h2>
          {items.length ? (
            <table className="w-full">
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="py-1.5">{i.label}</td>
                    <td className="py-1.5 text-right tabular-nums">{gbp(lineItemCost(i, deal.floorArea, settings.regionFactor))}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-semibold">
                  <td className="py-1.5">Total</td>
                  <td className="py-1.5 text-right tabular-nums">{gbp(deal.refurbCost)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-slate-600">Estimated works: {gbp(deal.refurbCost)}. Tick line items in the refurb estimator to itemise this.</p>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-900">Comparable sales on the street</h2>
          {evidence.status === 'loading' && <Spinner label="Loading sales" />}
          {evidence.status === 'ready' && !tired.length && <p className="text-slate-600">No comparable sales recorded.</p>}
          {tired.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-1 font-medium">Address</th>
                  <th className="pb-1 font-medium">Date</th>
                  <th className="pb-1 text-right font-medium">Sold for</th>
                </tr>
              </thead>
              <tbody>
                {tired.map((s, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5">
                      {[s.saon, s.paon, s.street?.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())].filter(Boolean).join(' ')}
                    </td>
                    <td className="py-1.5">{shortDate(s.date)}</td>
                    <td className="py-1.5 text-right tabular-nums">{gbp(s.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-slate-500">Source: HM Land Registry Price Paid Data, © Crown copyright, OGL v3.0.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-900">Why this figure</h2>
          <ul className="list-disc space-y-1 pl-5 text-slate-700">
            {stats && <li>Unmodernised homes on the street have recently sold for around {gbp(stats.tired)}.</li>}
            <li>Works estimated at {gbp(deal.refurbCost)} before the home can be let or mortgaged.</li>
            {deal.listedDays ? <li>The property has been on the market for {deal.listedDays} days.</li> : null}
            {['E', 'F', 'G'].includes(deal.epc) && <li>EPC {deal.epc}: energy upgrades are needed to meet letting standards.</li>}
          </ul>
        </section>
      </article>
    </div>
  );
}
