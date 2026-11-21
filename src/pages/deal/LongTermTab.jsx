import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dealIrr, project } from '../../lib/finance/deal.js';
import { gbp, gbpK, pct } from '../../lib/format.js';
import { Card, Metric, Segmented, Slider, Toggle } from '../../components/ui.jsx';

const COLORS = { property: '#059669', index: '#7c3aed', equity: '#94a3b8' };

export default function LongTermTab({ deal, a, update }) {
  const [mode, setMode] = useState('tied');
  const [reinvest, setReinvest] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const A = a.A;
  const overrides = deal.overrides || {};
  const setGrowth = (patch) => update({ overrides: { ...overrides, growth: { ...(overrides.growth || {}), ...patch } } });
  const exitYear = deal.exitYear || 10;

  const { brr, rows } = project(a.inputs, A, { years: 25, mode, reinvest });
  const exit = rows[exitYear];
  const lead = exit.propertyWealth - exit.indexFund;
  const irr = dealIrr(a.inputs, A, exitYear);
  const crossover = rows.find((r) => r.year > 0 && r.propertyWealth < r.indexFund);
  const data = rows.map((r) => ({ year: r.year, property: Math.round(r.propertyWealth), index: Math.round(r.indexFund), equity: Math.round(r.equity) }));
  const leftIn = Math.max(0, brr.moneyLeftIn);

  return (
    <div className="space-y-5">
      <Card
        title="Wealth: this deal vs an index fund"
        subtitle="Property wealth = what you'd walk away with if you sold that year (after selling costs and tax on the gain) plus all after-tax cashflow collected."
        actions={
          <Segmented
            label="Comparison"
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'tied', label: 'Same cash tied up' },
              { value: 'full', label: 'Full cash, no recycling' },
            ]}
          />
        }
      >
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {mode === 'tied'
            ? `The index fund gets the money you actually leave in the deal: ${gbp(leftIn)}. This is the fair test for a deal you hold, because the rest of your cash comes back at refinance to fund the next one.`
            : `The index fund gets all ${gbp(brr.cashIn)} and keeps it. The property side counts the ${gbp(Math.max(0, brr.released))} returned at refinance as cash earning nothing — a deliberately tough test.`}
        </p>
        <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
          <Slider label="House price growth" min={0} max={8} step={0.5} value={A.growth.housePrice * 100} onChange={(v) => setGrowth({ housePrice: v / 100 })} format={(v) => `${v.toFixed(1)}%`} />
          <Slider label="Index fund return" min={2} max={12} step={0.5} value={A.growth.indexFund * 100} onChange={(v) => setGrowth({ indexFund: v / 100 })} format={(v) => `${v.toFixed(1)}%`} />
          <Slider label="Rent growth" min={0} max={6} step={0.5} value={A.growth.rent * 100} onChange={(v) => setGrowth({ rent: v / 100 })} format={(v) => `${v.toFixed(1)}%`} />
          <Slider label="Sell in year" min={2} max={25} value={exitYear} onChange={(v) => update({ exitYear: v })} format={(v) => `Yr ${v}`} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <Toggle checked={reinvest} onChange={setReinvest} label="Reinvest cashflow in the index fund" hint="Property's monthly profit is invested each year instead of spent" />
          {overrides.growth && (
            <button type="button" className="text-xs font-medium text-indigo-700 hover:underline" onClick={() => update({ overrides: { ...overrides, growth: undefined } })}>
              Reset growth to my defaults
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.property }} />
            Property net wealth
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.index }} />
            Index fund
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3" style={{ background: COLORS.equity }} />
            Equity (value − mortgage)
          </span>
        </div>
        <div className="mt-2" style={{ height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="year" tickFormatter={(v) => `Y${v}`} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
              <YAxis tickFormatter={gbpK} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" width={56} />
              <Tooltip
                formatter={(v, name) => [gbp(v), { property: 'Property net wealth', index: 'Index fund', equity: 'Equity' }[name]]}
                labelFormatter={(v) => `Year ${v}`}
              />
              <ReferenceLine x={exitYear} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: 'Sell', position: 'top', fontSize: 11, fill: '#64748b' }} />
              <Line isAnimationActive={false} type="monotone" dataKey="equity" stroke={COLORS.equity} strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
              <Line isAnimationActive={false} type="monotone" dataKey="index" stroke={COLORS.index} dot={false} strokeWidth={2.5} />
              <Line isAnimationActive={false} type="monotone" dataKey="property" stroke={COLORS.property} dot={false} strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label={`Property, year ${exitYear}`} value={gbpK(exit.propertyWealth)} hint={`${gbpK(exit.cumCash)} cashflow + ${gbpK(exit.exitEquity)} equity after tax`} />
        <Metric label={`Index fund, year ${exitYear}`} value={gbpK(exit.indexFund)} hint={`From ${gbpK(rows[0].indexFund)} at ${pct(A.growth.indexFund, 1)}`} />
        <Metric label="Advantage" value={`${lead >= 0 ? '+' : ''}${gbpK(lead)}`} tone={lead >= 0 ? 'success' : 'danger'} hint={crossover ? `Index ahead from year ${crossover.year}` : 'Property ahead every year'} />
        <Metric label="Property IRR" value={irr === null ? '—' : irr > 5 ? '>500%' : pct(irr, 0)} hint={irr !== null && irr > 1 ? 'Very high because most cash is returned' : 'Annualised, on all cash in and out'} />
      </div>

      <Card padded={false}>
        <button type="button" onClick={() => setShowTable((s) => !s)} className="flex w-full items-center justify-between px-5 py-3 text-sm font-semibold text-slate-900">
          Year-by-year table
          <span className="text-slate-400">{showTable ? '−' : '+'}</span>
        </button>
        {showTable && (
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full min-w-[720px] text-sm tabular-nums">
              <thead>
                <tr className="text-right text-xs text-slate-500">
                  {['Year', 'Rent/mo', 'Rate', 'Value', 'Mortgage', 'Cashflow', 'Cumulative', 'Property wealth', 'Index fund'].map((h, i) => (
                    <th key={h} className={i === 0 ? 'px-5 py-2 text-left font-medium' : 'px-3 py-2 font-medium'}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((r) => (
                  <tr key={r.year} className={r.year === exitYear ? 'bg-indigo-50' : 'border-t border-slate-100'}>
                    <td className="px-5 py-1.5">{r.year}</td>
                    <td className="px-3 py-1.5 text-right">{gbp(r.rent)}</td>
                    <td className="px-3 py-1.5 text-right">{pct(r.rate, 1)}</td>
                    <td className="px-3 py-1.5 text-right">{gbpK(r.value)}</td>
                    <td className="px-3 py-1.5 text-right">{gbpK(r.balance)}</td>
                    <td className="px-3 py-1.5 text-right">{gbpK(r.cashflow)}</td>
                    <td className="px-3 py-1.5 text-right">{gbpK(r.cumCash)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-emerald-700">{gbpK(r.propertyWealth)}</td>
                    <td className="px-3 py-1.5 text-right text-violet-700">{gbpK(r.indexFund)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-500">Index fund assumed held in an ISA (no tax). Property gains taxed at {A.buyer.type === 'company' ? 'corporation tax rates' : 'residential CGT rates (18%/24%)'} on sale.</p>
    </div>
  );
}
