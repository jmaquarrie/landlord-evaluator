import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { breakEvenRent, project } from '../../lib/finance/deal.js';
import { gbp, gbpK, pct } from '../../lib/format.js';
import { Card, Metric, NumberInput, Segmented, cx } from '../../components/ui.jsx';

function BarRow({ label, value, max, tone = 'cost' }) {
  const width = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  const color = { income: 'bg-emerald-500', cost: 'bg-rose-400', net: value >= 0 ? 'bg-indigo-600' : 'bg-rose-600' }[tone];
  return (
    <div className="grid grid-cols-[minmax(0,170px)_minmax(0,1fr)_88px] items-center gap-3 py-1.5 text-sm">
      <span className={tone === 'net' ? 'font-semibold text-slate-900' : 'text-slate-600'}>{label}</span>
      <div className="h-2 rounded-sm bg-slate-100">
        <div className={cx('h-2 rounded-sm', color)} style={{ width: `${width}%` }} />
      </div>
      <span className={cx('text-right tabular-nums', tone === 'net' && 'font-semibold', tone === 'net' && value < 0 && 'text-rose-700')}>{gbp(value)}</span>
    </div>
  );
}

export default function CashflowTab({ deal, a, update }) {
  const A = a.A;
  const y = a.y1;
  const m = (v) => v / 12;
  const overrides = deal.overrides || {};
  const setOverride = (section, patch) => update({ overrides: { ...overrides, [section]: { ...(overrides[section] || {}), ...patch } } });
  const { rows } = project(a.inputs, A, { years: 25 });
  const chart = rows.slice(1).map((r) => ({ year: `Y${r.year}`, cashflow: Math.round(r.cashflow) }));
  const left = a.brr.moneyLeftIn;
  const breakEven = breakEvenRent(a.inputs, A);
  const duringWorks = (a.brr.holding + (A.bridging.use ? a.brr.bridgeInterest : 0)) / a.brr.months;

  const lines = [
    ['Voids', -y.voids],
    ['Letting and management', -y.management],
    ['Maintenance', -y.maintenance],
    ['Insurance', -y.insurance],
    ['Compliance and licensing', -y.compliance],
    ...(y.serviceCharge ? [['Service charge and ground rent', -y.serviceCharge]] : []),
    [A.refi.repayment === 'repayment' ? 'Mortgage payment' : 'Mortgage interest', -y.debtService],
    [A.buyer.type === 'company' ? 'Corporation tax' : 'Income tax (Section 24)', -y.tax],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Who owns it"
          value={A.buyer.type}
          onChange={(v) => setOverride('buyer', { type: v })}
          options={[
            { value: 'company', label: 'Ltd company' },
            { value: 'individual', label: 'Personal' },
          ]}
        />
        <Segmented
          label="Mortgage type"
          value={A.refi.repayment}
          onChange={(v) => setOverride('refi', { repayment: v })}
          options={[
            { value: 'interest_only', label: 'Interest only' },
            { value: 'repayment', label: 'Repayment' },
          ]}
        />
        {(overrides.buyer || overrides.refi?.repayment) && (
          <button type="button" className="text-xs font-medium text-indigo-700 hover:underline" onClick={() => update({ overrides: { ...overrides, buyer: undefined, refi: undefined } })}>
            Use my default settings
          </button>
        )}
        <span className="text-xs text-slate-500">Applies to this deal only, including stamp duty and lender checks.</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <Card title="Where each month's rent goes" subtitle={`After refinance, year 1 · ${A.buyer.type === 'company' ? 'limited company' : 'personal ownership'}`}>
          <BarRow label="Rent" value={m(y.gross)} max={m(y.gross)} tone="income" />
          {lines.map(([label, v]) => (
            <BarRow key={label} label={label} value={m(v)} max={m(y.gross)} />
          ))}
          <div className="mt-1 border-t border-slate-200 pt-1">
            <BarRow label="Net to you" value={m(y.net)} max={m(y.gross)} tone="net" />
          </div>
          {A.buyer.type === 'individual' && (
            <p className="mt-3 text-xs text-slate-500">
              Personal tax uses your owners' incomes from Assumptions. Mortgage interest gets a {A.buyer.propertyRates2027 ? '22' : '20'}% tax credit rather than being deducted.
            </p>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Quick what-if">
            <div className="grid gap-3">
              <NumberInput label="Rent per month" kind="money" value={deal.rent} onChange={(v) => update({ rent: v })} />
              <NumberInput label="Mortgage rate" kind="percent" value={A.refi.rate} onChange={(v) => setOverride('refi', { rate: v })} />
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="In your pocket" value={`${gbpK(m(y.net))}/mo`} tone={y.net >= 0 ? 'success' : 'danger'} />
            <Metric label="Per year" value={gbpK(y.net)} />
            <Metric
              label={`Return on ${gbpK(Math.max(0, left))} left in`}
              value={left <= 0 ? (y.net > 0 ? 'Infinite' : '—') : pct(y.net / left, 0)}
              hint={left <= 0 ? 'All your cash came back' : 'Cash-on-cash'}
            />
            <Metric label="Break-even rent" value={`${gbpK(breakEven)}/mo`} hint={`${pct(1 - breakEven / (deal.rent || 1), 0)} headroom`} />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            During works: about <strong className="text-slate-900">{gbp(duringWorks)}/mo</strong> in holding costs{A.bridging.use ? ' and bridging interest (rolled up into the bridge)' : ''}. It's already counted in money left in.
          </div>
        </div>
      </div>

      <Card title="After-tax cashflow by year" subtitle={`Rent grows ${pct(A.growth.rent, 1)} a year. Your ${A.growth.fixYears}-year fix ends and the rate moves to ${pct(A.growth.rateAfterFix, 1)}.`}>
        <div style={{ height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" interval={1} />
              <YAxis tickFormatter={gbpK} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" width={52} />
              <Tooltip formatter={(v) => [gbp(v), 'After-tax cashflow']} cursor={{ fill: '#f1f5f9' }} />
              <Bar isAnimationActive={false} dataKey="cashflow" radius={[3, 3, 0, 0]}>
                {chart.map((d) => (
                  <Cell key={d.year} fill={d.cashflow >= 0 ? '#10b981' : '#f43f5e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
