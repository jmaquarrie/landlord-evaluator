import { useState } from 'react';
import { stressTests } from '../../lib/finance/deal.js';
import { purchaseTaxName } from '../../lib/finance/tax.js';
import { lenderFlags } from '../../lib/signals.js';
import { gbp, gbpK, pct } from '../../lib/format.js';
import { Button, Card, Notice, NumberInput, Row, Tag, verdictTone } from '../../components/ui.jsx';
import RefurbEstimator from '../../components/RefurbEstimator.jsx';
import { useStore } from '../../state/store.jsx';

export default function BrrTab({ deal, a, update, buyBox }) {
  const { settings } = useStore();
  const [showEstimator, setShowEstimator] = useState(false);
  const b = a.brr;
  const A = a.A;
  const stress = stressTests(a.inputs, A, buyBox.maxLeftIn);
  const flags = lenderFlags({ ...deal, ...a.inputs });
  const ev = deal.evidence;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Card title="Deal inputs" subtitle="Change any figure and everything updates.">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput
              label="Purchase price"
              kind="money"
              value={deal.purchasePrice}
              onChange={(v) => update({ purchasePrice: v })}
              hint={deal.askingPrice ? `Asking ${gbp(deal.askingPrice)}` : undefined}
            />
            <div>
              <NumberInput label="Refurb cost" kind="money" value={deal.refurbCost} onChange={(v) => update({ refurbCost: v })} hint={`+${pct(A.refurb.contingencyPct, 0)} contingency added`} />
              <button type="button" className="mt-1 text-xs font-medium text-indigo-700 hover:underline" onClick={() => setShowEstimator((s) => !s)}>
                {showEstimator ? 'Hide estimator' : 'Estimate works'}
              </button>
            </div>
            <NumberInput
              label="ARV (value after works)"
              kind="money"
              value={deal.arv}
              onChange={(v) => update({ arv: v, estimated: { ...deal.estimated, arv: false } })}
              hint={
                deal.estimated?.arv
                  ? `Estimated from asking price${ev?.doneUp ? ` — done-up sales on the street ~${gbpK(ev.doneUp)}` : ' — check the Evidence tab'}`
                  : ev?.ceiling
                    ? `Street ceiling ${gbpK(ev.ceiling)} · done-up ~${gbpK(ev.doneUp)}`
                    : undefined
              }
            />
            <NumberInput
              label="Rent per month"
              kind="money"
              value={deal.rent}
              onChange={(v) => update({ rent: v, estimated: { ...deal.estimated, rent: false } })}
              hint={deal.estimated?.rent ? 'Estimated — check local asking rents' : undefined}
            />
            <NumberInput label="Months to refinance" value={deal.monthsToRefi} onChange={(v) => update({ monthsToRefi: v })} min={1} max={24} suffix="mo" />
            {deal.tenure === 'leasehold' ? (
              <NumberInput label="Service charge and ground rent" kind="money" suffix="/mo" value={deal.serviceCharge} onChange={(v) => update({ serviceCharge: v })} />
            ) : (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Bridging {pct(A.bridging.ltv, 0)} at {pct(A.bridging.monthlyRate, 2)}/mo · refinance {pct(A.refi.ltv, 0)} LTV at {pct(A.refi.rate, 1)}.{' '}
                <a href="#/assumptions" className="font-medium text-indigo-700 hover:underline">
                  Change
                </a>
              </div>
            )}
          </div>
          {showEstimator && (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <RefurbEstimator
                deal={deal}
                regionFactor={settings.regionFactor}
                onChange={update}
                onUse={(cost) => {
                  update({ refurbCost: cost });
                  setShowEstimator(false);
                }}
              />
            </div>
          )}
        </Card>

        <Card title="Cash waterfall" subtitle={`${A.buyer.type === 'company' ? 'Limited company' : 'Personal'} purchase · ${b.months}-month refurb`}>
          <Row label={A.bridging.use ? `Deposit (${pct(1 - A.bridging.ltv, 0)})` : 'Purchase (cash)'} value={gbp(b.deposit)} />
          <Row label={purchaseTaxName(A.buyer.nation)} value={gbp(b.stampDuty)} hint={A.buyer.type === 'company' || A.buyer.ownsOtherHome ? 'incl. surcharge' : undefined} />
          <Row label="Legals, survey and fees" value={gbp(b.purchaseFees)} />
          {A.bridging.use && <Row label="Bridging fees and interest" value={gbp(b.bridgeFees + b.bridgeInterest)} hint={`${gbpK(b.bridge)} loan`} />}
          <Row label="Refurb with contingency" value={gbp(b.works)} />
          <Row label="Holding costs" value={gbp(b.holding)} hint={`${b.months} months`} />
          <Row label="Total cash in" value={gbp(b.cashIn)} strong />
          <Row label={`Refinance at ${pct(A.refi.ltv, 0)} of ${gbpK(b.arv)}`} value={gbp(b.refiLoan)} hint={b.limitedBy === 'rent' ? 'capped by rent' : undefined} tone={b.limitedBy === 'rent' ? 'warning' : undefined} />
          {A.bridging.use && <Row label="Repay bridge" value={gbp(-b.bridge)} />}
          <Row label="Refinance fees" value={gbp(-b.refiFees)} />
          <Row label="Cash back at refinance" value={gbp(b.released)} tone="success" />
          <Row label="Money left in" value={gbp(b.moneyLeftIn)} strong tone={b.moneyLeftIn <= buyBox.maxLeftIn ? 'success' : 'danger'} />
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Max offer for ≤ {gbpK(buyBox.maxLeftIn)} left in: <strong className="tabular-nums">{a.maxOffer ? gbp(a.maxOffer) : 'not achievable at these numbers'}</strong>
            {a.maxOffer > 0 && deal.purchasePrice !== a.maxOffer && (
              <Button size="sm" variant="ghost" className="ml-2" onClick={() => update({ purchasePrice: a.maxOffer })}>
                Use as purchase price
              </Button>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <Card title="Stress test" subtitle="Does the deal survive when things go wrong?">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-2 font-medium">Scenario</th>
                <th className="pb-2 text-right font-medium">Left in</th>
                <th className="pb-2 text-right font-medium">Cashflow</th>
                <th className="pb-2 text-right font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {stress.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-2 text-slate-700">{s.label}</td>
                  <td className="py-2 text-right tabular-nums">{gbpK(s.moneyLeftIn)}</td>
                  <td className="py-2 text-right tabular-nums">{gbpK(s.monthly)}/mo</td>
                  <td className="py-2 text-right">
                    <Tag tone={verdictTone(s.verdict)}>{{ works: 'Works', tight: 'Tight', fails: 'Fails' }[s.verdict]}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            Works: within your money-left-in target and cash positive. Tight: up to {gbpK(Math.max(5000, buyBox.maxLeftIn))} over target. A lower valuation means a
            smaller mortgage, so cashflow can rise even as more cash stays in.
          </p>
        </Card>

        <Card title="Lender checks" subtitle="What could stop the refinance.">
          <div className="space-y-2">
            <Notice tone={b.icrCover >= b.requiredIcr ? 'success' : 'danger'}>
              Rental cover {pct(b.icrCover, 0)} at a {pct(A.refi.icrStressRate, 1)} stress rate — lender needs {pct(b.requiredIcr, 0)}.
              {b.limitedBy === 'rent' && ` The loan is capped at ${gbp(b.icrLoan)} by rent, not by value.`}
            </Notice>
            {flags.length === 0 ? (
              <Notice tone="success">No common lender red flags found.</Notice>
            ) : (
              flags.map((f) => (
                <Notice key={f} tone="warning">
                  {f}
                </Notice>
              ))
            )}
            {a.ceiling.status === 'over' && (
              <Notice tone="danger">
                ARV is above anything sold on this street. A surveyor may cap it near {gbp(a.ceiling.surveyorArv)} — see Value-add options and Evidence.
              </Notice>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
