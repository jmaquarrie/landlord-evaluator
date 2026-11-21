import { useState } from 'react';
import { analyseDeal } from '../../lib/analyse.js';
import { ceilingCheck } from '../../lib/evidence.js';
import { gbp, gbpK, titleCase, uid } from '../../lib/format.js';
import { Button, Card, Notice, NumberInput, Row, Spinner, Tag, TextInput, Toggle, cx } from '../../components/ui.jsx';
import CeilingChart from '../../components/CeilingChart.jsx';

const round = (v, to = 1000) => Math.round(v / to) * to;

export function defaultOptions(deal) {
  const beds = Number(deal.beds) || 3;
  return [
    {
      id: 'extra-bed',
      label: `Add a bedroom (${beds} → ${beds + 1})`,
      note: 'Split a large reception or convert a box room',
      refurbCost: (deal.refurbCost || 0) + 8000,
      arv: round((deal.arv || 0) * 1.08),
      rent: round((deal.rent || 0) * 1.12, 25),
      monthsToRefi: (deal.monthsToRefi || 6) + 1,
    },
    {
      id: 'extension',
      label: 'Rear extension',
      note: 'Single storey, usually permitted development',
      refurbCost: (deal.refurbCost || 0) + 38000,
      arv: round((deal.arv || 0) * 1.15),
      rent: round((deal.rent || 0) * 1.12, 25),
      monthsToRefi: (deal.monthsToRefi || 6) + 4,
    },
    {
      id: 'hmo',
      label: `${beds + 1}-bed HMO`,
      note: 'C4 small HMO; licence needed for 5+ tenants',
      refurbCost: (deal.refurbCost || 0) + 32000,
      arv: round((deal.arv || 0) * 1.02),
      rent: (beds + 1) * 450,
      monthsToRefi: (deal.monthsToRefi || 6) + 2,
      hmo: true,
      billsPerMonth: 450,
    },
  ];
}

export default function ValueAddTab({ deal, a, update, evidence, assumptions, buyBox }) {
  const options = deal.valueAdd?.options ?? defaultOptions(deal);
  const [selected, setSelected] = useState('base');
  const stats = evidence.stats;
  const ceilingValue = stats?.ceiling ?? deal.evidence?.ceiling ?? null;
  const saveOptions = (next) => update({ valueAdd: { options: next } });

  const base = { id: 'base', label: 'Refurb only (current plan)', note: 'The numbers on the BRR tab', refurbCost: deal.refurbCost, arv: deal.arv, rent: deal.rent, monthsToRefi: deal.monthsToRefi };
  const all = [base, ...options];

  const evaluate = (opt) => {
    const check = ceilingValue ? ceilingCheck(opt.arv, { ceiling: ceilingValue }) : { status: 'unknown', surveyorArv: opt.arv };
    const atYourArv = analyseDeal(deal, assumptions, buyBox, { option: opt.id === 'base' ? undefined : opt });
    const atSurveyor = analyseDeal(deal, assumptions, buyBox, { option: { ...opt, arv: check.surveyorArv } });
    return { check, atYourArv, atSurveyor };
  };
  const results = Object.fromEntries(all.map((o) => [o.id, evaluate(o)]));
  const best = all.reduce((m, o) => {
    const r = results[o.id].atSurveyor;
    const score = -r.brr.moneyLeftIn + r.monthly * 24;
    return score > m.score ? { id: o.id, score } : m;
  }, { id: 'base', score: -Infinity }).id;

  const current = all.find((o) => o.id === selected) ?? base;
  const r = results[current.id];
  const article4 = evidence.planning?.article4 ?? null;
  const hmoBlocked = article4?.some((x) => x.blocksHmo) ?? deal.evidence?.article4BlocksHmo;

  const editOption = (patch) => {
    if (current.id === 'base') {
      update({
        ...(patch.refurbCost !== undefined && { refurbCost: patch.refurbCost }),
        ...(patch.arv !== undefined && { arv: patch.arv }),
        ...(patch.rent !== undefined && { rent: patch.rent }),
        ...(patch.monthsToRefi !== undefined && { monthsToRefi: patch.monthsToRefi }),
      });
    } else {
      saveOptions(options.map((o) => (o.id === current.id ? { ...o, ...patch } : o)));
    }
  };

  const makePlan = () => {
    const previous = { ...base, id: uid(), label: 'Previous plan', note: 'Saved when you switched plans' };
    saveOptions([...options.filter((o) => o.id !== current.id), previous]);
    update({ refurbCost: current.refurbCost, arv: current.arv, rent: current.rent, monthsToRefi: current.monthsToRefi });
    setSelected('base');
  };

  const addOption = () => {
    const id = uid();
    saveOptions([...options, { ...base, id, label: 'Custom option', note: '' }]);
    setSelected(id);
  };

  const tagFor = (o) => {
    const res = results[o.id];
    if (o.hmo && hmoBlocked) return ['Article 4 area', 'danger'];
    if (res.check.status === 'over') return ['Over street ceiling', 'danger'];
    if (o.id === best) return ['Best on surveyor value', 'success'];
    if (o.id === 'base') return ['Baseline', 'neutral'];
    return null;
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {all.map((o) => {
          const res = results[o.id];
          const tag = tagFor(o);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelected(o.id)}
              className={cx(
                'rounded-xl border bg-white p-4 text-left transition',
                selected === o.id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300',
              )}
            >
              <div className="min-h-[22px]">{tag && <Tag tone={tag[1]}>{tag[0]}</Tag>}</div>
              <div className="mt-2 font-semibold text-slate-900">{o.label}</div>
              <div className="text-xs text-slate-500">{o.note}</div>
              <div className="mt-3 space-y-0.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Left in</span>
                  <span className={cx('font-semibold tabular-nums', res.atSurveyor.brr.moneyLeftIn <= buyBox.maxLeftIn ? 'text-emerald-700' : 'text-rose-700')}>
                    {gbpK(res.atSurveyor.brr.moneyLeftIn)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashflow</span>
                  <span className="font-semibold tabular-nums">{gbpK(res.atSurveyor.monthly)}/mo</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={addOption}>
          + Add option
        </Button>
      </div>

      <Card
        title="Street ceiling check"
        subtitle={ceilingValue ? `Highest price paid on ${deal.evidence?.street ? titleCase(deal.evidence.street) : 'this street'} in 10 years: ${gbp(ceilingValue)}` : undefined}
        actions={
          r.check.status === 'unknown' ? null : (
            <Tag tone={{ over: 'danger', near: 'warning', within: 'success' }[r.check.status]}>
              {r.check.status === 'over' ? `${Math.round(r.check.pctOver * 100)}% above ceiling` : r.check.status === 'near' ? 'Near the ceiling' : 'Within street evidence'}
            </Tag>
          )
        }
      >
        {evidence.status === 'loading' && <Spinner label="Loading street sales from Land Registry" />}
        {evidence.status === 'error' && (
          <Notice tone="danger">
            Couldn't reach Land Registry, so the ceiling can't be checked.{' '}
            <button type="button" className="font-medium underline" onClick={evidence.reload}>
              Try again
            </button>
          </Notice>
        )}
        {evidence.status === 'ready' && !stats && <Notice>No recorded sales on this street in the last 10 years, so there is no ceiling to check against.</Notice>}
        {stats && <CeilingChart stats={stats} arv={current.arv} />}
        {r.check.status === 'over' && (
          <p className="mt-2 text-sm text-slate-600">
            No home on this street has sold above {gbp(ceilingValue)}. A surveyor is likely to value this near {gbp(r.check.surveyorArv)}, so the results below use that figure.
          </p>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={current.label} subtitle={current.id === 'base' ? 'Edits here change the BRR tab too.' : 'Edit the figures for this option.'}>
          <div className="grid gap-3 sm:grid-cols-2">
            {current.id !== 'base' && <TextInput className="sm:col-span-2" label="Name" value={current.label} onChange={(v) => editOption({ label: v })} />}
            <NumberInput label="Works cost" kind="money" value={current.refurbCost} onChange={(v) => editOption({ refurbCost: v })} />
            <NumberInput label="ARV" kind="money" value={current.arv} onChange={(v) => editOption({ arv: v })} />
            <NumberInput label={current.hmo ? 'Total room rent per month' : 'Rent per month'} kind="money" value={current.rent} onChange={(v) => editOption({ rent: v })} />
            <NumberInput label="Months to refinance" value={current.monthsToRefi} onChange={(v) => editOption({ monthsToRefi: v })} suffix="mo" />
            {current.id !== 'base' && (
              <div className="sm:col-span-2">
                <Toggle checked={current.hmo} onChange={(v) => editOption({ hmo: v })} label="Let as an HMO" hint="Adds bills, 15% management, licence and fire-safety costs" />
              </div>
            )}
            {current.hmo && <NumberInput label="Bills you pay per month" kind="money" value={current.billsPerMonth} onChange={(v) => editOption({ billsPerMonth: v })} />}
          </div>
          {current.id !== 'base' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={makePlan}>
                Make this the plan
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  saveOptions(options.filter((o) => o.id !== current.id));
                  setSelected('base');
                }}
              >
                Remove option
              </Button>
            </div>
          )}
        </Card>

        <Card title="Result">
          <Row label="Works with contingency" value={gbp(r.atSurveyor.brr.works)} />
          <Row label="Total cash in" value={gbp(r.atSurveyor.brr.cashIn)} />
          {r.check.status === 'over' && <Row label="Left in at your ARV" value={gbp(r.atYourArv.brr.moneyLeftIn)} />}
          <Row
            label={r.check.status === 'over' ? 'Left in at surveyor value' : 'Money left in'}
            value={gbp(r.atSurveyor.brr.moneyLeftIn)}
            strong
            tone={r.atSurveyor.brr.moneyLeftIn <= buyBox.maxLeftIn ? 'success' : 'danger'}
          />
          <Row label="Cashflow after tax" value={`${gbp(r.atSurveyor.monthly)}/mo`} strong />
          <Row label="Lead over index fund, year 10" value={gbpK(r.atSurveyor.vsIndex10)} tone={r.atSurveyor.vsIndex10 >= 0 ? 'success' : 'danger'} />
          <div className="mt-3 space-y-2">
            {current.hmo &&
              (article4 === null ? (
                <Notice tone="warning">Couldn't check Article 4 directions. Confirm with the council before planning an HMO.</Notice>
              ) : hmoBlocked ? (
                <Notice tone="danger">This address is inside an Article 4 area that removes the right to convert to a small HMO. You'd need full planning permission.</Notice>
              ) : (
                <Notice tone="warning">
                  No Article 4 direction recorded on planning.data.gov.uk{article4.length ? ' that affects HMOs' : ''}. Not every council publishes there, so confirm with the
                  council. HMO lenders value on bricks and mortar, not rent.
                </Notice>
              ))}
            {current.id === 'extension' && evidence.planning?.conservation?.length > 0 && (
              <Notice tone="warning">In a conservation area ({evidence.planning.conservation[0]}) — extensions may need planning permission.</Notice>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
