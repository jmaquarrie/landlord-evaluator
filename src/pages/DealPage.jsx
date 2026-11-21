import { useMemo } from 'react';
import { useStore } from '../state/store.jsx';
import { analyseDeal } from '../lib/analyse.js';
import { gbpK, pct } from '../lib/format.js';
import { STAGES } from '../lib/defaults.js';
import { Button, EmptyState, Metric, Tabs, Tag, cx, scoreTone } from '../components/ui.jsx';
import SignalTags from '../components/SignalTags.jsx';
import { navigate } from '../router.js';
import { useDealEvidence } from '../lib/data/useDealEvidence.js';
import BrrTab from './deal/BrrTab.jsx';
import ValueAddTab from './deal/ValueAddTab.jsx';
import CashflowTab from './deal/CashflowTab.jsx';
import LongTermTab from './deal/LongTermTab.jsx';
import EvidenceTab from './deal/EvidenceTab.jsx';
import NotesTab from './deal/NotesTab.jsx';

const TABS = [
  { id: 'brr', label: 'BRR' },
  { id: 'value-add', label: 'Value-add options' },
  { id: 'cashflow', label: 'Monthly cashflow' },
  { id: 'long-term', label: 'Long-term vs index fund' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'notes', label: 'Notes and offers' },
];

export default function DealPage({ id, tab = 'brr' }) {
  const store = useStore();
  const { deals, assumptions, buyBox, updateDeal, deleteDeal } = store;
  const deal = deals.find((d) => d.id === id);
  const evidence = useDealEvidence(deal, updateDeal);
  const a = useMemo(() => (deal ? analyseDeal(deal, assumptions, buyBox) : null), [deal, assumptions, buyBox]);

  if (!deal) {
    return (
      <EmptyState
        title="Deal not found"
        body="It may have been deleted."
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            Back to deals
          </Button>
        }
      />
    );
  }

  const update = (patch) => updateDeal(deal.id, patch);
  const stageIndex = STAGES.indexOf(deal.stage);
  const props = { deal, a, update, evidence, assumptions, buyBox };
  const activeTab = TABS.some((t) => t.id === tab) ? tab : 'brr';

  const remove = () => {
    if (window.confirm(`Delete ${deal.address}? This can't be undone.`)) {
      deleteDeal(deal.id);
      navigate('/');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <a href="#/" className="text-sm text-slate-500 hover:text-slate-800">
          ← Deals
        </a>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{deal.address}</h1>
              {deal.sample && <Tag title="Example deal with made-up figures. Delete it whenever you like.">Sample</Tag>}
              {a.passes ? <Tag tone="success">Passes buy box</Tag> : <Tag tone="danger">Misses buy box</Tag>}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {deal.postcode} · {deal.beds} bed {deal.propertyType} · {deal.floorArea ? `${deal.floorArea}m² · ` : ''}EPC {deal.epc || '—'} · {deal.tenure}
              {deal.tenure === 'leasehold' && deal.leaseYears ? ` (${deal.leaseYears} yrs)` : ''} · asking {gbpK(deal.askingPrice)}
              {deal.listingUrl && (
                <>
                  {' · '}
                  <a href={deal.listingUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
                    Listing
                  </a>
                </>
              )}
            </p>
            <div className="mt-2">
              <SignalTags deal={deal} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <Button onClick={() => navigate(`/deal/${deal.id}/pack`)}>Offer pack</Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </div>
        </div>
      </div>

      <ol className="flex flex-wrap items-center gap-1 text-sm" aria-label="Deal stage">
        {STAGES.filter((s) => s !== 'Dropped').map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => update({ stage: s })}
              aria-current={deal.stage === s ? 'step' : undefined}
              className={cx(
                'rounded-md px-2.5 py-1 font-medium transition',
                deal.stage === s
                  ? 'bg-slate-900 text-white'
                  : i < stageIndex && deal.stage !== 'Dropped'
                    ? 'text-slate-800 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
              )}
            >
              {s}
            </button>
            {i < 5 && <span className="text-slate-300">›</span>}
          </li>
        ))}
        <li className="ml-2">
          <button
            type="button"
            onClick={() => update({ stage: deal.stage === 'Dropped' ? 'Lead' : 'Dropped' })}
            className={cx('rounded-md px-2.5 py-1 text-sm font-medium', deal.stage === 'Dropped' ? 'bg-rose-50 text-rose-700' : 'text-slate-400 hover:bg-slate-100')}
          >
            {deal.stage === 'Dropped' ? 'Dropped · reopen' : 'Drop'}
          </button>
        </li>
      </ol>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric
          label="Money left in"
          value={gbpK(a.brr.moneyLeftIn)}
          tone={a.brr.moneyLeftIn <= buyBox.maxLeftIn ? 'success' : 'danger'}
          hint={`Target ≤ ${gbpK(buyBox.maxLeftIn)}`}
        />
        <Metric label="Capital recycled" value={pct(a.brr.recycledPct, 0)} hint={`${gbpK(a.brr.released)} of ${gbpK(a.brr.cashIn)} back`} />
        <Metric label="Cashflow after refi" value={`${gbpK(a.monthly)}/mo`} tone={a.monthly >= buyBox.minCashflow ? 'success' : a.monthly >= 0 ? 'warning' : 'danger'} hint="After tax" />
        <Metric
          label="Max offer"
          value={a.maxOffer ? gbpK(a.maxOffer) : '—'}
          tone={a.maxOffer >= (deal.askingPrice || 0) ? 'success' : 'neutral'}
          hint={deal.askingPrice ? `${a.maxOffer >= deal.askingPrice ? 'At or above' : pct(1 - a.maxOffer / deal.askingPrice, 0) + ' below'} asking` : ''}
        />
        <Metric label="Deal score" value={a.score} tone={scoreTone(a.score)} hint={a.ceiling.status === 'unknown' ? 'ARV not checked yet' : `ARV ${a.ceiling.status === 'over' ? 'over' : a.ceiling.status === 'near' ? 'near' : 'within'} street ceiling`} />
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={(t) => navigate(`/deal/${deal.id}/${t}`)} />

      <div>
        {activeTab === 'brr' && <BrrTab {...props} />}
        {activeTab === 'value-add' && <ValueAddTab {...props} />}
        {activeTab === 'cashflow' && <CashflowTab {...props} />}
        {activeTab === 'long-term' && <LongTermTab {...props} />}
        {activeTab === 'evidence' && <EvidenceTab {...props} />}
        {activeTab === 'notes' && <NotesTab {...props} />}
      </div>
    </div>
  );
}
