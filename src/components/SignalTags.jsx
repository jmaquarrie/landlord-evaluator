import { SIGNAL_MAP } from '../lib/signals.js';
import { Tag } from './ui.jsx';

export default function SignalTags({ deal, limit }) {
  const ids = [...(deal.signals || [])];
  const extra = [];
  if (Number(deal.listedDays) >= 90 && !ids.includes('long-listed')) extra.push({ label: `${deal.listedDays} days listed`, tone: 'warning' });
  if (['E', 'F', 'G'].includes(deal.epc)) extra.push({ label: `EPC ${deal.epc}`, tone: 'warning' });
  const tags = [
    ...ids.map((id) => SIGNAL_MAP[id]).filter(Boolean).map((s) => ({
      label: s.id === 'long-listed' && deal.listedDays ? `${deal.listedDays} days listed` : s.label,
      tone: s.tone,
    })),
    ...extra,
  ];
  const shown = limit ? tags.slice(0, limit) : tags;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <Tag key={t.label} tone={t.tone}>
          {t.label}
        </Tag>
      ))}
      {limit && tags.length > limit && <Tag>+{tags.length - limit}</Tag>}
    </div>
  );
}
