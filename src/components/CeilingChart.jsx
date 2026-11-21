import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { gbp, gbpK, shortDate } from '../lib/format.js';

/** Street sales over time, with the street ceiling and the deal's ARV marked. */
export default function CeilingChart({ stats, arv, height = 240 }) {
  if (!stats) return null;
  const points = stats.pool.map((s) => ({ x: new Date(s.date).getTime(), y: s.price, s }));
  const prices = points.map((p) => p.y);
  const yMin = Math.min(...prices, arv) * 0.9;
  const yMax = Math.max(...prices, arv, stats.ceiling * 1.03) * 1.05;
  const over = arv > stats.ceiling;
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => new Date(v).getFullYear()}
            tick={{ fontSize: 11, fill: '#64748b' }}
            stroke="#cbd5e1"
          />
          <YAxis dataKey="y" type="number" domain={[yMin, yMax]} tickFormatter={gbpK} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" width={52} />
          <ReferenceArea y1={stats.ceiling} y2={stats.ceiling * 1.03} fill="#fef3c7" fillOpacity={0.8} />
          <ReferenceLine y={stats.ceiling} stroke="#d97706" strokeDasharray="4 3" label={{ value: `Ceiling ${gbpK(stats.ceiling)}`, position: 'insideTopLeft', fill: '#b45309', fontSize: 11 }} />
          <ReferenceLine y={arv} stroke={over ? '#e11d48' : '#059669'} strokeWidth={2} label={{ value: `Your ARV ${gbpK(arv)}`, position: 'insideBottomRight', fill: over ? '#be123c' : '#047857', fontSize: 11 }} />
          <Tooltip
            cursor={false}
            content={({ payload }) => {
              const s = payload?.[0]?.payload?.s;
              if (!s) return null;
              return (
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <div className="font-semibold text-slate-900">{gbp(s.price)}</div>
                  <div className="text-slate-600">
                    {[s.saon, s.paon, s.street].filter(Boolean).join(' ')} · {shortDate(s.date)}
                  </div>
                  <div className="text-slate-500">
                    {s.propertyType} · {s.tenure}
                    {s.newBuild ? ' · new build' : ''}
                  </div>
                </div>
              );
            }}
          />
          <Scatter isAnimationActive={false} data={points} fill="#64748b" fillOpacity={0.65} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
