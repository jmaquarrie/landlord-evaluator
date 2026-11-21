import { useState } from 'react';
import { confidenceLabel } from '../../lib/evidence.js';
import { gbp, gbpK, shortDate, titleCase } from '../../lib/format.js';
import { Button, Card, Metric, Notice, Spinner, Tag } from '../../components/ui.jsx';
import CeilingChart from '../../components/CeilingChart.jsx';

export default function EvidenceTab({ deal, a, update, evidence }) {
  const [showAll, setShowAll] = useState(false);
  const { status, stats, street, planning, place } = evidence;

  if (status === 'loading' || status === 'idle') return <Spinner label="Loading sold prices from Land Registry" />;
  if (status === 'missing') return <Notice>Add a postcode to this deal to load street evidence.</Notice>;
  if (status === 'error')
    return (
      <Notice tone="danger">
        Couldn't reach Land Registry ({evidence.message}).{' '}
        <button type="button" className="font-medium underline" onClick={evidence.reload}>
          Try again
        </button>
      </Notice>
    );

  const pc = encodeURIComponent(deal.postcode);
  const links = (
    <div className="flex flex-wrap gap-2">
      <a className="text-sm font-medium text-indigo-700 hover:underline" href={`https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=${pc}`} target="_blank" rel="noreferrer">
        EPC certificates for {deal.postcode} ↗
      </a>
      <span className="text-slate-300">·</span>
      <a className="text-sm font-medium text-indigo-700 hover:underline" href={`https://www.planning.data.gov.uk/map/?#${place?.lat ?? ''},${place?.lon ?? ''},17z`} target="_blank" rel="noreferrer">
        Planning map ↗
      </a>
    </div>
  );

  if (!stats) {
    return (
      <div className="space-y-4">
        <Notice>No recorded sales {street?.street ? `on ${street.street.toLowerCase()}` : `for ${deal.postcode}`} in the last 10 years. Check nearby streets manually.</Notice>
        {links}
      </div>
    );
  }

  const conf = confidenceLabel(stats.recentCount);
  const sales = [...stats.pool].sort((x, y) => y.date.localeCompare(x.date));
  const shown = showAll ? sales : sales.slice(0, 10);
  const uplift = stats.doneUp - stats.tired;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Street ceiling" value={gbpK(stats.ceiling)} hint={`${shortDate(stats.ceilingSale.date)} · highest in 10 yrs`} />
        <Metric label="Done-up price (top 20%)" value={gbpK(stats.doneUp)} hint={stats.recentCount >= 4 ? 'Last 3 years' : 'Last 10 years'} />
        <Metric label="Tired price (bottom 25%)" value={gbpK(stats.tired)} hint={`Uplift ${gbpK(uplift)}`} />
        <Metric label="Evidence" value={`${stats.count} sales`} hint={`${stats.recentCount} in 3 yrs · confidence ${conf}`} tone={conf === 'low' ? 'warning' : 'neutral'} />
      </div>

      <Card
        title={`Sold prices on ${street.street ? titleCase(street.street) : deal.postcode}`}
        subtitle={`${stats.sameTypeOnly ? `${deal.propertyType} sales only` : 'All property types (too few of the same type)'} · last 10 years · HM Land Registry${
          stats.excludedBulk + stats.excludedOutliers ? ` · ${stats.excludedBulk + stats.excludedOutliers} bulk or outlier sales left out` : ''
        }`}
        actions={
          <div className="flex items-center gap-2">
            {a.ceiling.status !== 'unknown' && (
              <Tag tone={{ over: 'danger', near: 'warning', within: 'success' }[a.ceiling.status]}>
                ARV {a.ceiling.status === 'over' ? 'above ceiling' : a.ceiling.status === 'near' ? 'near ceiling' : 'within evidence'}
              </Tag>
            )}
            <Button size="sm" variant="ghost" onClick={evidence.reload}>
              Refresh
            </Button>
          </div>
        }
      >
        <CeilingChart stats={stats} arv={a.inputs.arv} height={260} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {a.inputs.arv > stats.ceiling
              ? `Your ARV of ${gbp(a.inputs.arv)} is above every sale on this street. Expect a surveyor to come in nearer ${gbp(a.ceiling.surveyorArv)}.`
              : `Your ARV of ${gbp(a.inputs.arv)} is backed by sales on this street.`}
          </p>
          {Math.abs(a.inputs.arv - stats.doneUp) > 2000 && (
            <Button size="sm" onClick={() => update({ arv: Math.round(stats.doneUp / 1000) * 1000, estimated: { ...deal.estimated, arv: false } })}>
              Use done-up price {gbpK(stats.doneUp)} as ARV
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <Card title="Recent sales" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-5 py-2 font-medium">Address</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-5 py-2 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => (
                  <tr key={`${s.date}-${s.paon}-${i}`} className="border-t border-slate-100">
                    <td className="px-5 py-2 text-slate-700">
                      {[s.saon, s.paon, titleCase(s.street)].filter(Boolean).join(' ')} · {s.postcode}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {s.propertyType}
                      {s.tenure === 'leasehold' ? ' · leasehold' : ''}
                      {s.newBuild ? ' · new' : ''}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{shortDate(s.date)}</td>
                    <td className="px-5 py-2 text-right font-medium tabular-nums">{gbp(s.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sales.length > 10 && (
            <div className="border-t border-slate-100 px-5 py-2">
              <button type="button" className="text-sm font-medium text-indigo-700 hover:underline" onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'Show fewer' : `Show all ${sales.length}`}
              </button>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="This property's history">
            {street.history.length ? (
              <>
                {street.history.map((s) => (
                  <div key={s.date} className="flex justify-between border-t border-slate-100 py-2 text-sm first:border-t-0">
                    <span className="text-slate-600">{shortDate(s.date)}</span>
                    <span className="font-medium tabular-nums">{gbp(s.price)}</span>
                  </div>
                ))}
                {(() => {
                  const last = street.history[0];
                  const years = (Date.now() - new Date(last.date).getTime()) / (365.25 * 864e5);
                  return years < 2 ? (
                    <Notice tone="warning">Sold {shortDate(last.date)} — a recent sale can mean a flip, or a seller who needs out.</Notice>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Last sold {Math.floor(years)} years ago.</p>
                  );
                })()}
              </>
            ) : (
              <p className="text-sm text-slate-500">
                {/^\d/.test(deal.address || '') ? 'No past sales recorded for this house number.' : 'Add the house number to the address to see its sale history.'}
              </p>
            )}
          </Card>

          <Card title="Planning constraints">
            {evidence.planningError || !planning ? (
              <p className="text-sm text-slate-500">Couldn't check planning data right now.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {planning.article4.length ? (
                  planning.article4.map((x) => (
                    <Notice key={x.name} tone={x.blocksHmo ? 'danger' : 'warning'}>
                      Article 4 direction: {x.name}
                      {x.blocksHmo ? ' — removes the right to convert to a small HMO' : ''}
                    </Notice>
                  ))
                ) : (
                  <p className="text-slate-600">No Article 4 directions recorded.</p>
                )}
                {planning.conservation.length ? <Notice tone="warning">Conservation area: {planning.conservation.join(', ')}</Notice> : <p className="text-slate-600">Not in a recorded conservation area.</p>}
                <p className="text-xs text-slate-500">From planning.data.gov.uk. Not every council publishes there yet — confirm locally before relying on it.</p>
              </div>
            )}
          </Card>
          {links}
        </div>
      </div>
    </div>
  );
}
