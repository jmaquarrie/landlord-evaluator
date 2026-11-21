import { useState } from 'react';
import { gbp, uid } from '../../lib/format.js';
import { EPC_BANDS, PROPERTY_TYPES } from '../../lib/defaults.js';
import { SIGNALS } from '../../lib/signals.js';
import { Button, Card, NumberInput, Select, TextArea, TextInput, Tag, cx } from '../../components/ui.jsx';

const OFFER_STATUS = [
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'countered', label: 'Countered' },
  { value: 'accepted', label: 'Accepted' },
];

export default function NotesTab({ deal, a, update }) {
  const [amount, setAmount] = useState(a.maxOffer || deal.askingPrice);
  const offers = deal.offers || [];
  const addOffer = () => {
    if (!(amount > 0)) return;
    update({ offers: [{ id: uid(), amount, date: new Date().toISOString().slice(0, 10), status: 'pending' }, ...offers], stage: deal.stage === 'Lead' || deal.stage === 'Viewed' ? 'Offered' : deal.stage });
  };
  const setOffer = (id, patch) => update({ offers: offers.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const toggleSignal = (id) => update({ signals: (deal.signals || []).includes(id) ? deal.signals.filter((s) => s !== id) : [...(deal.signals || []), id] });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Card title="Offers" subtitle={`Your max offer is ${a.maxOffer ? gbp(a.maxOffer) : '—'}.`}>
          <div className="flex items-end gap-2">
            <NumberInput className="flex-1" label="Offer amount" kind="money" value={amount} onChange={setAmount} />
            <Button variant="primary" onClick={addOffer}>
              Log offer
            </Button>
          </div>
          {offers.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100">
              {offers.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-medium tabular-nums">{gbp(o.amount)}</span>
                  <span className="text-slate-500">{new Date(o.date).toLocaleDateString('en-GB')}</span>
                  <select
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs"
                    value={o.status}
                    onChange={(e) => setOffer(o.id, { status: e.target.value })}
                    aria-label="Offer status"
                  >
                    {OFFER_STATUS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Agent">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Agent and branch" value={deal.agent} onChange={(v) => update({ agent: v })} />
            <TextInput label="Phone or email" value={deal.agentContact} onChange={(v) => update({ agentContact: v })} />
          </div>
        </Card>

        <Card title="Notes">
          <TextArea rows={8} value={deal.notes} onChange={(v) => update({ notes: v })} placeholder="Viewing notes, what the agent said about the seller, works spotted…" />
        </Card>
      </div>

      <Card title="Property details">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput className="sm:col-span-2" label="Address" value={deal.address} onChange={(v) => update({ address: v })} />
          <TextInput label="Postcode" value={deal.postcode} onChange={(v) => update({ postcode: v.toUpperCase() })} />
          <NumberInput label="Asking price" kind="money" value={deal.askingPrice} onChange={(v) => update({ askingPrice: v })} />
          <Select label="Property type" value={deal.propertyType} onChange={(v) => update({ propertyType: v })} options={PROPERTY_TYPES} />
          <NumberInput label="Bedrooms" value={deal.beds} onChange={(v) => update({ beds: v })} />
          <NumberInput label="Floor area" suffix="m²" value={deal.floorArea} onChange={(v) => update({ floorArea: v })} />
          <Select label="EPC rating" value={deal.epc} onChange={(v) => update({ epc: v })} options={EPC_BANDS.map((b) => ({ value: b, label: b }))} />
          <Select
            label="Tenure"
            value={deal.tenure}
            onChange={(v) => update({ tenure: v })}
            options={[
              { value: 'freehold', label: 'Freehold' },
              { value: 'leasehold', label: 'Leasehold' },
            ]}
          />
          {deal.tenure === 'leasehold' && <NumberInput label="Lease years left" value={deal.leaseYears} onChange={(v) => update({ leaseYears: v })} />}
          <NumberInput label="Days on market" value={deal.listedDays} onChange={(v) => update({ listedDays: v })} />
          <Select
            label="Nation (for purchase tax)"
            value={deal.nation}
            onChange={(v) => update({ nation: v })}
            options={[
              { value: 'england', label: 'England or Northern Ireland' },
              { value: 'scotland', label: 'Scotland' },
              { value: 'wales', label: 'Wales' },
            ]}
          />
          <TextInput className="sm:col-span-2" label="Listing link" value={deal.listingUrl} onChange={(v) => update({ listingUrl: v })} />
        </div>
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-slate-600">Signals</div>
          <div className="flex flex-wrap gap-1.5">
            {SIGNALS.map((s) => {
              const on = (deal.signals || []).includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSignal(s.id)}
                  className={cx('rounded-md border px-2 py-1 text-xs font-medium transition', on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400')}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        {deal.sample && (
          <div className="mt-4">
            <Tag>Sample deal — edit it freely or delete it</Tag>
          </div>
        )}
      </Card>
    </div>
  );
}
