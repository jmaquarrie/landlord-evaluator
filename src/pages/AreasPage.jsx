import { useMemo, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { salesByDistrict } from '../lib/data/landRegistry.js';
import { postcodeSector, rankSectors } from '../lib/evidence.js';
import { gbp, gbpK, pct } from '../lib/format.js';
import { Button, Card, EmptyState, Field, Metric, NumberInput, Notice, Segmented, Spinner, Tag, cx } from '../components/ui.jsx';

// Land Registry district names (councils). Free text works for any other.
const SUGGESTED = [
  'BLACKPOOL', 'WYRE', 'FYLDE', 'PRESTON', 'SOUTH RIBBLE', 'CHORLEY', 'BLACKBURN WITH DARWEN', 'HYNDBURN', 'BURNLEY', 'PENDLE', 'ROSSENDALE',
  'LANCASTER', 'WEST LANCASHIRE', 'WIGAN', 'BOLTON', 'BURY', 'OLDHAM', 'ROCHDALE', 'SALFORD', 'STOCKPORT', 'TAMESIDE', 'MANCHESTER', 'LIVERPOOL',
  'SEFTON', 'KNOWSLEY', 'ST HELENS', 'WIRRAL', 'WARRINGTON', 'HALTON', 'BRADFORD', 'CALDERDALE', 'KIRKLEES', 'LEEDS', 'WAKEFIELD', 'BARNSLEY',
  'DONCASTER', 'ROTHERHAM', 'SHEFFIELD', 'KINGSTON UPON HULL, CITY OF', 'MIDDLESBROUGH', 'HARTLEPOOL', 'STOCKTON-ON-TEES', 'SUNDERLAND',
  'COUNTY DURHAM', 'NEWCASTLE UPON TYNE', 'GATESHEAD', 'STOKE-ON-TRENT', 'NOTTINGHAM', 'DERBY', 'LEICESTER', 'COVENTRY', 'BIRMINGHAM',
  'WOLVERHAMPTON', 'SANDWELL', 'DUDLEY', 'WALSALL', 'CARDIFF', 'SWANSEA', 'NEWPORT',
];

const PERIODS = [
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
  { value: 36, label: '36 months' },
];

const TYPES = [
  { value: 'terraced', label: 'Terraced' },
  { value: 'semi-detached', label: 'Semis' },
  { value: 'both', label: 'Both' },
];

const RAMP = ['bg-emerald-50 text-emerald-900', 'bg-emerald-100 text-emerald-900', 'bg-emerald-300 text-emerald-950', 'bg-emerald-500 text-white', 'bg-emerald-700 text-white'];

export default function AreasPage() {
  const { buyBox, setBuyBox, areaRents, setAreaRent, deals } = useStore();
  const [input, setInput] = useState('WYRE, BLACKPOOL');
  const [months, setMonths] = useState(24);
  const [type, setType] = useState('both');
  const [metric, setMetric] = useState('spread');
  const [state, setState] = useState({ status: 'idle' });
  const [selected, setSelected] = useState(null);

  const search = async () => {
    const districts = input.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!districts.length) return;
    setState({ status: 'loading', districts });
    setSelected(null);
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    try {
      const results = await Promise.all(districts.map((d) => salesByDistrict(d, since.toISOString().slice(0, 10))));
      const empty = districts.filter((_, i) => !results[i].length);
      setState({ status: 'ready', districts, sales: results.flat(), empty });
    } catch (e) {
      setState({ status: 'error', message: e.message });
    }
  };

  const sectors = useMemo(() => {
    if (state.status !== 'ready') return [];
    const types = type === 'both' ? ['terraced', 'semi-detached'] : [type];
    return rankSectors(state.sales, { types, minSales: 15 }).map((s) => {
      const rent = areaRents[s.sector];
      return { ...s, rent, yield: rent ? (rent * 12) / s.tired : null };
    });
  }, [state, type, areaRents]);

  const METRICS = {
    spread: { label: 'Done-up vs tired gap', get: (s) => s.spread, fmt: gbpK, higherIsBetter: true },
    entry: { label: 'Entry price (tired)', get: (s) => s.tired, fmt: gbpK, higherIsBetter: false },
    volume: { label: 'Sales', get: (s) => s.count, fmt: (v) => v, higherIsBetter: true },
    yield: { label: 'Gross yield on entry', get: (s) => s.yield ?? -1, fmt: (v) => (v >= 0 ? pct(v, 1) : 'Add rent'), higherIsBetter: true },
  };
  const M = METRICS[metric];
  const values = sectors.map(M.get).filter((v) => v >= 0);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const band = (v) => {
    if (v < 0 || !Number.isFinite(lo) || hi === lo) return 0;
    const t = (v - lo) / (hi - lo);
    return Math.min(4, Math.floor((M.higherIsBetter ? t : 1 - t) * 5));
  };
  const ranked = [...sectors].sort((x, y) => (M.higherIsBetter ? M.get(y) - M.get(x) : M.get(x) - M.get(y))).filter((s) => M.get(s) >= 0);
  const grid = [...sectors].sort((x, y) => x.sector.localeCompare(y.sector, 'en', { numeric: true }));
  const sel = sectors.find((s) => s.sector === selected) ?? ranked[0];
  const inBox = sel && buyBox.areas.includes(sel.sector);
  const dealsHere = sel ? deals.filter((d) => postcodeSector(d.postcode) === sel.sector).length : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Area finder</h1>
        <p className="text-sm text-slate-500">Find postcode sectors where tired houses sell well below done-up ones — that gap is your BRR uplift.</p>
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_auto_auto_auto] md:items-end">
          <Field label="Councils (comma-separated)" hint="Land Registry names, e.g. WYRE, BLACKPOOL">
            {(id) => (
              <>
                <input
                  id={id}
                  list="districts"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && search()}
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm uppercase focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <datalist id="districts">
                  {SUGGESTED.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Sold in the last">{() => <Segmented size="sm" value={months} onChange={setMonths} options={PERIODS} />}</Field>
          <Field label="House type">{() => <Segmented size="sm" value={type} onChange={setType} options={TYPES} />}</Field>
          <Button variant="primary" onClick={search} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? 'Searching…' : 'Find areas'}
          </Button>
        </div>
      </Card>

      {state.status === 'idle' && <EmptyState title="Pick the councils you invest in" body="Uses every house sale recorded by HM Land Registry. Larger councils take a few seconds." action={<Button variant="primary" onClick={search}>Find areas</Button>} />}
      {state.status === 'loading' && <Spinner label={`Loading sales for ${state.districts.join(', ')}`} />}
      {state.status === 'error' && <Notice tone="danger">Couldn't reach Land Registry ({state.message}). Try again in a moment.</Notice>}
      {state.status === 'ready' && state.empty.length > 0 && (
        <Notice tone="warning">No sales found for {state.empty.join(', ')}. Check the council name matches Land Registry's (try the suggestions list).</Notice>
      )}

      {state.status === 'ready' && sectors.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {sectors.length} sectors with 15+ sales · {state.sales.length.toLocaleString('en-GB')} sales analysed
            </p>
            <Segmented
              size="sm"
              label="Colour by"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'spread', label: 'BRR gap' },
                { value: 'entry', label: 'Entry price' },
                { value: 'volume', label: 'Sales' },
                { value: 'yield', label: 'Yield' },
              ]}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card title="Sector map" subtitle="One tile per postcode sector, darker is better for the chosen measure.">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))] gap-1.5">
                {grid.map((s) => (
                  <button
                    key={s.sector}
                    type="button"
                    onClick={() => setSelected(s.sector)}
                    className={cx(
                      'flex min-h-[52px] flex-col justify-between rounded-md px-2 py-1.5 text-left text-xs transition',
                      RAMP[band(M.get(s))],
                      sel?.sector === s.sector ? 'ring-2 ring-slate-900 ring-offset-1' : 'hover:ring-2 hover:ring-slate-400',
                    )}
                  >
                    <span className="font-semibold">{s.sector}</span>
                    <span className="tabular-nums">{M.fmt(M.get(s))}</span>
                    {buyBox.areas.includes(s.sector) && <span className="sr-only">In buy box</span>}
                  </button>
                ))}
              </div>
            </Card>

            {sel && (
              <Card
                title={sel.sector}
                subtitle={`${sel.count} ${type === 'both' ? 'terraced and semi' : type} sales in ${months} months`}
                actions={inBox ? <Tag tone="accent">In your buy box</Tag> : null}
              >
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Tired (bottom 25%)" value={gbpK(sel.tired)} />
                  <Metric label="Done-up (top 20%)" value={gbpK(sel.doneUp)} />
                  <Metric label="BRR gap" value={gbpK(sel.spread)} hint={`${pct(sel.spreadPct, 0)} uplift`} tone="success" />
                  <Metric label="Gross yield" value={sel.yield ? pct(sel.yield, 1) : '—'} hint={sel.yield ? 'Rent ÷ tired price' : 'Add a typical rent below'} />
                </div>
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                  <NumberInput label="Typical rent for a done-up house" kind="money" suffix="/mo" value={sel.rent} onChange={(v) => setAreaRent(sel.sector, v)} hint="From local letting agents or portal asking rents" />
                  <Button
                    variant={inBox ? 'secondary' : 'primary'}
                    onClick={() => setBuyBox({ areas: inBox ? buyBox.areas.filter((x) => x !== sel.sector) : [...buyBox.areas, sel.sector] })}
                  >
                    {inBox ? 'Remove from buy box' : 'Add to buy box'}
                  </Button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Median {gbp(sel.median)}. {sel.count >= 25 ? 'Plenty of sales, so ARV evidence will be solid.' : 'Fewer sales, so expect thinner ARV evidence.'}
                  {dealsHere ? ` You have ${dealsHere} deal${dealsHere > 1 ? 's' : ''} here.` : ''}
                </p>
              </Card>
            )}
          </div>

          <Card title={`Ranked by ${M.label.toLowerCase()}`} padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-right text-xs text-slate-500">
                    <th className="px-5 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Sector</th>
                    <th className="px-3 py-2 font-medium">Tired</th>
                    <th className="px-3 py-2 font-medium">Done-up</th>
                    <th className="px-3 py-2 font-medium">BRR gap</th>
                    <th className="px-3 py-2 font-medium">Yield</th>
                    <th className="px-5 py-2 font-medium">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.slice(0, 15).map((s, i) => (
                    <tr
                      key={s.sector}
                      onClick={() => setSelected(s.sector)}
                      className={cx('cursor-pointer border-t border-slate-100 text-right tabular-nums hover:bg-slate-50', sel?.sector === s.sector && 'bg-slate-50')}
                    >
                      <td className="px-5 py-2 text-left text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 text-left font-medium text-slate-900">
                        {s.sector} {buyBox.areas.includes(s.sector) && <Tag tone="accent">Buy box</Tag>}
                      </td>
                      <td className="px-3 py-2">{gbpK(s.tired)}</td>
                      <td className="px-3 py-2">{gbpK(s.doneUp)}</td>
                      <td className="px-3 py-2 font-semibold text-emerald-700">{gbpK(s.spread)}</td>
                      <td className="px-3 py-2">{s.yield ? pct(s.yield, 1) : '—'}</td>
                      <td className="px-5 py-2">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-slate-500">
            The gap uses price, not price per m², so a sector with mixed house sizes can look better than it is. Check individual streets on a deal's Evidence tab.
          </p>
        </>
      )}
    </div>
  );
}
