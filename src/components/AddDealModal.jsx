import { useState } from 'react';
import { Button, Modal, NumberInput, Select, TextArea, TextInput, Notice, cx } from './ui.jsx';
import { EPC_BANDS, PROPERTY_TYPES } from '../lib/defaults.js';
import { SIGNALS, parseListing } from '../lib/signals.js';
import { SCOPES, scopeEstimate } from '../lib/refurb.js';
import { isValidPostcode, lookupPostcode } from '../lib/data/postcodes.js';
import { useStore } from '../state/store.jsx';
import { navigate } from '../router.js';

const EMPTY = {
  address: '',
  postcode: '',
  askingPrice: undefined,
  propertyType: 'terraced',
  beds: 3,
  floorArea: 75,
  epc: 'D',
  tenure: 'freehold',
  leaseYears: undefined,
  listingUrl: '',
  listedDays: undefined,
  signals: [],
  refurbScope: 'medium',
  arv: undefined,
  rent: undefined,
};

export default function AddDealModal({ open, onClose }) {
  const { addDeal, settings } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [paste, setPaste] = useState('');
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const readListing = () => {
    const p = parseListing(paste);
    const found = Object.entries(p).filter(([k, v]) => (k === 'signals' ? v.length : v !== undefined));
    setParsed(found.length);
    set({
      ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length))),
      signals: [...new Set([...form.signals, ...p.signals])],
    });
  };

  const toggleSignal = (id) => set({ signals: form.signals.includes(id) ? form.signals.filter((s) => s !== id) : [...form.signals, id] });

  const save = async () => {
    setError('');
    if (!form.address.trim()) return setError('Enter the address or street.');
    if (!isValidPostcode(form.postcode)) return setError('Enter a full UK postcode, like FY5 2LX.');
    if (!(form.askingPrice > 0)) return setError('Enter the asking price.');
    setSaving(true);
    let nation = 'england';
    let postcode = form.postcode.toUpperCase().trim();
    try {
      const info = await lookupPostcode(postcode);
      if (info) {
        nation = info.nation;
        postcode = info.postcode;
      }
    } catch {
      // Lookup failed: keep England and the typed postcode.
    }
    const refurbCost = scopeEstimate(form.refurbScope, form.floorArea, settings.regionFactor);
    const id = addDeal({
      ...form,
      postcode,
      nation,
      purchasePrice: form.askingPrice,
      refurbCost,
      arv: form.arv || Math.round((form.askingPrice * 1.35) / 1000) * 1000,
      rent: form.rent || Math.round((form.askingPrice * 0.0075) / 25) * 25,
      estimated: { arv: !form.arv, rent: !form.rent },
      sample: false,
    });
    setSaving(false);
    setForm(EMPTY);
    setPaste('');
    setParsed(null);
    onClose();
    navigate(`/deal/${id}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a deal"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Add and analyse'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <TextArea
            label="Paste the listing text (optional)"
            rows={3}
            value={paste}
            onChange={setPaste}
            placeholder="Paste the agent's description. Price, beds, postcode, EPC and seller signals are picked out for you."
          />
          <div className="mt-2 flex items-center gap-3">
            <Button size="sm" onClick={readListing} disabled={!paste.trim()}>
              Read listing
            </Button>
            {parsed !== null && <span className="text-xs text-slate-500">{parsed ? `Filled ${parsed} details. Check them below.` : 'Nothing recognised. Fill in the details below.'}</span>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <TextInput className="sm:col-span-2" label="Address or street" value={form.address} onChange={(v) => set({ address: v })} placeholder="14 Victoria Road, Cleveleys" />
          <TextInput label="Postcode" value={form.postcode} onChange={(v) => set({ postcode: v })} placeholder="FY5 2LX" />
          <NumberInput label="Asking price" kind="money" value={form.askingPrice} onChange={(v) => set({ askingPrice: v })} />
          <Select label="Property type" value={form.propertyType} onChange={(v) => set({ propertyType: v })} options={PROPERTY_TYPES} />
          <NumberInput label="Bedrooms" value={form.beds} onChange={(v) => set({ beds: v })} min={0} max={12} />
          <NumberInput label="Floor area" suffix="m²" value={form.floorArea} onChange={(v) => set({ floorArea: v })} hint="From the EPC or floorplan" />
          <Select label="EPC rating" value={form.epc} onChange={(v) => set({ epc: v })} options={EPC_BANDS.map((b) => ({ value: b, label: b }))} />
          <Select
            label="Tenure"
            value={form.tenure}
            onChange={(v) => set({ tenure: v })}
            options={[
              { value: 'freehold', label: 'Freehold' },
              { value: 'leasehold', label: 'Leasehold' },
            ]}
          />
          {form.tenure === 'leasehold' && <NumberInput label="Lease years left" value={form.leaseYears} onChange={(v) => set({ leaseYears: v })} />}
          <NumberInput label="Days on market" value={form.listedDays} onChange={(v) => set({ listedDays: v })} />
          <TextInput className="sm:col-span-2" label="Listing link" value={form.listingUrl} onChange={(v) => set({ listingUrl: v })} placeholder="https://" />
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-slate-600">Signals</div>
          <div className="flex flex-wrap gap-1.5">
            {SIGNALS.map((s) => {
              const on = form.signals.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSignal(s.id)}
                  aria-pressed={on}
                  className={cx(
                    'rounded-md border px-2 py-1 text-xs font-medium transition',
                    on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400',
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Refurb scope"
            value={form.refurbScope}
            onChange={(v) => set({ refurbScope: v })}
            options={SCOPES.map((s) => ({ value: s.value, label: `${s.label} · ~£${(scopeEstimate(s.value, form.floorArea, settings.regionFactor) / 1000).toFixed(0)}k` }))}
          />
          <NumberInput label="ARV (value after works)" kind="money" value={form.arv} onChange={(v) => set({ arv: v })} hint="Leave blank to estimate, then check the Evidence tab" />
          <NumberInput label="Rent per month" kind="money" value={form.rent} onChange={(v) => set({ rent: v })} />
        </div>

        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}
