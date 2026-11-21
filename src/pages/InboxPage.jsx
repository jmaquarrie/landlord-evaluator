import { useMemo, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { analyseDeal } from '../lib/analyse.js';
import { gbpK, pct } from '../lib/format.js';
import { STAGES } from '../lib/defaults.js';
import { Button, Card, EmptyState, Metric, Select, Tag, Toggle, TONE_TEXT, cx, scoreTone } from '../components/ui.jsx';
import SignalTags from '../components/SignalTags.jsx';
import AddDealModal from '../components/AddDealModal.jsx';
import { navigate } from '../router.js';

const SORTS = [
  { value: 'score', label: 'Best score' },
  { value: 'left', label: 'Least money left in' },
  { value: 'cash', label: 'Highest cashflow' },
  { value: 'index', label: 'Biggest lead over index fund' },
  { value: 'new', label: 'Newest' },
];

export default function InboxPage() {
  const { deals, assumptions, buyBox, settings } = useStore();
  const [adding, setAdding] = useState(false);
  const [onlyPassing, setOnlyPassing] = useState(false);
  const [stage, setStage] = useState('active');
  const [sort, setSort] = useState('score');

  const rows = useMemo(
    () => deals.map((d) => ({ deal: d, a: analyseDeal(d, assumptions, buyBox) })),
    [deals, assumptions, buyBox],
  );

  const visible = rows
    .filter((r) => (stage === 'active' ? r.deal.stage !== 'Dropped' : stage === 'all' ? true : r.deal.stage === stage))
    .filter((r) => !onlyPassing || r.a.passes)
    .sort((x, y) => {
      if (sort === 'left') return x.a.brr.moneyLeftIn - y.a.brr.moneyLeftIn;
      if (sort === 'cash') return y.a.monthly - x.a.monthly;
      if (sort === 'index') return y.a.vsIndex10 - x.a.vsIndex10;
      if (sort === 'new') return (y.deal.createdAt || '').localeCompare(x.deal.createdAt || '');
      return y.a.score - x.a.score;
    });

  const passing = rows.filter((r) => r.a.passes && r.deal.stage !== 'Dropped').length;
  const live = rows.filter((r) => ['Accepted', 'Refurb'].includes(r.deal.stage));
  const committed = live.reduce((s, r) => s + r.a.brr.cashIn, 0);
  const available = settings.cashPot - committed;
  const candidates = rows.filter((r) => r.a.passes);
  const avgCashIn = candidates.length ? candidates.reduce((s, r) => s + r.a.brr.cashIn, 0) / candidates.length : 0;
  const avgRecycled = candidates.length ? candidates.reduce((s, r) => s + r.a.brr.recycledPct, 0) / candidates.length : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Deals</h1>
          <p className="text-sm text-slate-500">
            {deals.length} deals · {passing} pass your buy box
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          + Add deal
        </Button>
      </div>

      <Card
        title="Your buy box"
        subtitle="Deals are checked against these rules."
        actions={
          <Button size="sm" onClick={() => navigate('/assumptions')}>
            Edit rules
          </Button>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          <Tag>Asking ≤ {gbpK(buyBox.maxPrice)}</Tag>
          <Tag>Money left in ≤ {gbpK(buyBox.maxLeftIn)}</Tag>
          <Tag>Gross yield ≥ {pct(buyBox.minYield, 0)}</Tag>
          <Tag>Cashflow ≥ {gbpK(buyBox.minCashflow)}/mo</Tag>
          {buyBox.areas.length ? <Tag tone="accent">Areas: {buyBox.areas.join(', ')}</Tag> : <Tag tone="neutral">Any area</Tag>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Cash pot available" value={gbpK(available)} hint={committed ? `${gbpK(committed)} tied up in live deals` : 'Set on the Assumptions page'} />
        <Metric label="Deals you can start now" value={avgCashIn ? (Math.max(0, available) / avgCashIn).toFixed(1) : '—'} hint={avgCashIn ? `Avg ${gbpK(avgCashIn)} cash in per deal` : 'No deals pass yet'} />
        <Metric label="Avg capital recycled" value={candidates.length ? pct(avgRecycled, 0) : '—'} hint="Across deals that pass" />
        <Metric label="Live deals" value={live.length} hint="Accepted or in refurb" />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <Toggle checked={onlyPassing} onChange={setOnlyPassing} label="Only deals that pass" />
          <div className="flex flex-wrap gap-2">
            <Select
              value={stage}
              onChange={setStage}
              options={[{ value: 'active', label: 'All active' }, { value: 'all', label: 'Including dropped' }, ...STAGES.map((s) => ({ value: s, label: s }))]}
            />
            <Select value={sort} onChange={setSort} options={SORTS} />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={deals.length ? 'No deals match these filters' : 'Add your first deal'}
              body={deals.length ? 'Turn off "Only deals that pass" or change the stage filter.' : 'Paste a listing and the app works out the BRR numbers, max offer and long-term return.'}
              action={!deals.length && <Button variant="primary" onClick={() => setAdding(true)}>+ Add deal</Button>}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Property and signals</th>
                  <th className="px-3 py-2.5 text-right font-medium">Asking</th>
                  <th className="px-3 py-2.5 text-right font-medium" title="Highest price that keeps money left in within your buy box">Max offer</th>
                  <th className="px-3 py-2.5 text-right font-medium">Left in</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cashflow</th>
                  <th className="px-3 py-2.5 text-right font-medium" title="Wealth after 10 years compared with putting the same cash in an index fund">vs index, yr 10</th>
                  <th className="px-5 py-2.5 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ deal, a }) => (
                  <tr
                    key={deal.id}
                    onClick={() => navigate(`/deal/${deal.id}`)}
                    className="cursor-pointer border-t border-slate-100 align-top transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-3">
                      <a href={`#/deal/${deal.id}`} className="font-medium text-slate-900 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {deal.address}
                      </a>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span>
                          {deal.postcode} · {deal.beds} bed {deal.propertyType} · {deal.stage}
                        </span>
                        {deal.sample && <Tag>Sample</Tag>}
                        {!a.passes && <span className="text-rose-600">Misses: {a.checks.filter((c) => !c.pass).map((c) => c.label.toLowerCase()).join(', ')}</span>}
                      </div>
                      <div className="mt-1.5">
                        <SignalTags deal={deal} limit={4} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{gbpK(deal.askingPrice)}</td>
                    <td className={cx('px-3 py-3 text-right font-semibold tabular-nums', a.maxOffer < (deal.askingPrice || 0) * 0.85 ? 'text-rose-700' : 'text-slate-900')}>
                      {a.maxOffer ? gbpK(a.maxOffer) : '—'}
                    </td>
                    <td className={cx('px-3 py-3 text-right font-semibold tabular-nums', a.brr.moneyLeftIn <= buyBox.maxLeftIn ? 'text-emerald-700' : 'text-rose-700')}>
                      {gbpK(a.brr.moneyLeftIn)}
                    </td>
                    <td className={cx('px-3 py-3 text-right tabular-nums', a.monthly >= 0 ? 'text-slate-900' : 'text-rose-700')}>{gbpK(a.monthly)}/mo</td>
                    <td className={cx('px-3 py-3 text-right tabular-nums', a.vsIndex10 >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                      {a.vsIndex10 >= 0 ? '+' : ''}
                      {gbpK(a.vsIndex10)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={cx('text-lg font-semibold tabular-nums', TONE_TEXT[scoreTone(a.score)])}>{a.score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddDealModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
