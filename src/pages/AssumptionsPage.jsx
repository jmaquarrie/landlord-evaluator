import { useRef } from 'react';
import { useStore } from '../state/store.jsx';
import { requiredIcr } from '../lib/finance/deal.js';
import { marginalRate } from '../lib/finance/tax.js';
import { pct } from '../lib/format.js';
import { Button, Card, NumberInput, Segmented, Select, Tag, TextInput, Toggle } from '../components/ui.jsx';

function Section({ title, subtitle, children }) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </Card>
  );
}

export default function AssumptionsPage() {
  const store = useStore();
  const { assumptions: A, setAssumptions, buyBox, setBuyBox, settings, setSettings, resetAssumptions } = store;
  const fileRef = useRef(null);
  const set = (section, patch) => setAssumptions({ [section]: patch });
  const owners = A.buyer.owners;
  const setOwner = (i, patch) => set('buyer', { owners: owners.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ deals: store.deals, assumptions: A, buyBox, settings, areaRents: store.areaRents }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `brr-deals-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.deals)) throw new Error('No deals in file');
      if (window.confirm(`Replace your current data with ${data.deals.length} deals from this file?`)) store.replaceAll(data);
    } catch (e) {
      window.alert(`That file couldn't be read: ${e.message}`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Assumptions</h1>
          <p className="text-sm text-slate-500">Defaults used for every deal. Changes apply straight away and save in this browser.</p>
        </div>
        <Button variant="ghost" onClick={() => window.confirm('Reset all assumptions to the defaults? Your deals and buy box are kept.') && resetAssumptions()}>
          Reset to defaults
        </Button>
      </div>

      <Card title="Buyer" subtitle="Drives stamp duty, tax and lender rental cover.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Segmented
              label="Buy as"
              value={A.buyer.type}
              onChange={(v) => set('buyer', { type: v })}
              options={[
                { value: 'company', label: 'Limited company' },
                { value: 'individual', label: 'Personally' },
              ]}
            />
            <Select
              value={A.buyer.nation}
              onChange={(v) => set('buyer', { nation: v })}
              options={[
                { value: 'england', label: 'England or NI' },
                { value: 'scotland', label: 'Scotland' },
                { value: 'wales', label: 'Wales' },
              ]}
            />
            <Tag tone="accent">Lender wants {pct(requiredIcr(A), 0)} rental cover</Tag>
          </div>
          {A.buyer.type === 'individual' && (
            <>
              <div className="space-y-2">
                {owners.map((o, i) => (
                  <div key={i} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_auto]">
                    <TextInput label="Owner" value={o.name} onChange={(v) => setOwner(i, { name: v })} />
                    <NumberInput label="Other income per year" kind="money" value={o.income} onChange={(v) => setOwner(i, { income: v })} hint={`${pct(marginalRate(o.income), 0)} taxpayer`} />
                    <NumberInput label="Share" kind="percent" value={o.share} onChange={(v) => setOwner(i, { share: v })} />
                    {owners.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => set('buyer', { owners: owners.filter((_, j) => j !== i) })}>
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                {owners.length < 4 && (
                  <Button size="sm" onClick={() => set('buyer', { owners: [...owners, { name: `Owner ${owners.length + 1}`, income: 30000, share: 0.5 }] })}>
                    + Add owner
                  </Button>
                )}
              </div>
              <Toggle checked={A.buyer.ownsOtherHome} onChange={(v) => set('buyer', { ownsOtherHome: v })} label="I already own a home" hint="Triggers the additional-property surcharge on stamp duty" />
              <Toggle
                checked={A.buyer.propertyRates2027}
                onChange={(v) => set('buyer', { propertyRates2027: v })}
                label="Use 2027 property income tax rates"
                hint="22/42/47% on rental profit from April 2027, as announced in the November 2025 Budget"
              />
            </>
          )}
        </div>
      </Card>

      <Section title="Buy box" subtitle="Deals that meet all of these are marked as passing.">
        <NumberInput label="Max asking price" kind="money" value={buyBox.maxPrice} onChange={(v) => setBuyBox({ maxPrice: v })} />
        <NumberInput label="Max money left in" kind="money" value={buyBox.maxLeftIn} onChange={(v) => setBuyBox({ maxLeftIn: v })} hint="Also the target for max offer" />
        <NumberInput label="Min gross yield" kind="percent" value={buyBox.minYield} onChange={(v) => setBuyBox({ minYield: v })} hint="Rent ÷ purchase price" />
        <NumberInput label="Min cashflow after tax" kind="money" suffix="/mo" value={buyBox.minCashflow} onChange={(v) => setBuyBox({ minCashflow: v })} />
        <div className="sm:col-span-2">
          <div className="mb-1 text-xs font-medium text-slate-600">Areas</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {buyBox.areas.length ? (
              buyBox.areas.map((s) => (
                <button key={s} type="button" onClick={() => setBuyBox({ areas: buyBox.areas.filter((x) => x !== s) })} className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                  {s} ✕
                </button>
              ))
            ) : (
              <span className="text-sm text-slate-500">Any area.</span>
            )}
            <a href="#/areas" className="ml-1 text-xs font-medium text-indigo-700 hover:underline">
              Add from Area finder
            </a>
          </div>
        </div>
      </Section>

      <Section title="Cash">
        <NumberInput label="Cash pot available" kind="money" value={settings.cashPot} onChange={(v) => setSettings({ cashPot: v })} hint="Used to show how many deals you can fund" />
        <NumberInput label="Refurb price factor" value={settings.regionFactor} step={0.05} onChange={(v) => setSettings({ regionFactor: v })} hint="1 = North West. London ~1.5, North East ~0.9" />
      </Section>

      <Section title="Buying and bridging">
        <NumberInput label="Legals" kind="money" value={A.purchase.legals} onChange={(v) => set('purchase', { legals: v })} />
        <NumberInput label="Survey" kind="money" value={A.purchase.survey} onChange={(v) => set('purchase', { survey: v })} />
        <NumberInput label="Other fees (sourcing, auction)" kind="money" value={A.purchase.otherFees} onChange={(v) => set('purchase', { otherFees: v })} />
        <div className="flex items-end pb-1 sm:col-span-2 lg:col-span-3">
          <Toggle checked={A.bridging.use} onChange={(v) => set('bridging', { use: v })} label="Buy with bridging finance" hint="Off = buy with cash" />
        </div>
        {A.bridging.use && (
          <>
            <NumberInput label="Bridging LTV" kind="percent" value={A.bridging.ltv} onChange={(v) => set('bridging', { ltv: v })} />
            <NumberInput label="Monthly interest" kind="percent" value={A.bridging.monthlyRate} onChange={(v) => set('bridging', { monthlyRate: v })} />
            <NumberInput label="Arrangement fee" kind="percent" value={A.bridging.arrangementPct} onChange={(v) => set('bridging', { arrangementPct: v })} />
            <NumberInput label="Exit fee" kind="percent" value={A.bridging.exitPct} onChange={(v) => set('bridging', { exitPct: v })} />
          </>
        )}
      </Section>

      <Section title="Refurb">
        <NumberInput label="Contingency" kind="percent" value={A.refurb.contingencyPct} onChange={(v) => set('refurb', { contingencyPct: v })} />
        <NumberInput label="Holding costs while empty" kind="money" suffix="/mo" value={A.refurb.holdingPerMonth} onChange={(v) => set('refurb', { holdingPerMonth: v })} hint="Council tax, insurance, utilities" />
      </Section>

      <Section title="Refinance">
        <NumberInput label="LTV" kind="percent" value={A.refi.ltv} onChange={(v) => set('refi', { ltv: v })} />
        <NumberInput label="Mortgage rate" kind="percent" value={A.refi.rate} onChange={(v) => set('refi', { rate: v })} />
        <NumberInput label="Lender stress rate" kind="percent" value={A.refi.icrStressRate} onChange={(v) => set('refi', { icrStressRate: v })} hint="Used for rental cover" />
        <Select
          label="Mortgage type"
          value={A.refi.repayment}
          onChange={(v) => set('refi', { repayment: v })}
          options={[
            { value: 'interest_only', label: 'Interest only' },
            { value: 'repayment', label: 'Repayment' },
          ]}
        />
        <NumberInput label="Term" suffix="yrs" value={A.refi.termYears} onChange={(v) => set('refi', { termYears: v })} />
        <NumberInput label="Product fee" kind="percent" value={A.refi.productFeePct} onChange={(v) => set('refi', { productFeePct: v })} />
        <NumberInput label="Broker fee" kind="money" value={A.refi.brokerFee} onChange={(v) => set('refi', { brokerFee: v })} />
        <NumberInput label="Valuation fee" kind="money" value={A.refi.valuationFee} onChange={(v) => set('refi', { valuationFee: v })} />
        <NumberInput label="Refinance legals" kind="money" value={A.refi.legals} onChange={(v) => set('refi', { legals: v })} />
      </Section>

      <Section title="Running costs">
        <NumberInput label="Voids" kind="percent" value={A.operating.voidPct} onChange={(v) => set('operating', { voidPct: v })} />
        <NumberInput label="Letting and management" kind="percent" value={A.operating.managementPct} onChange={(v) => set('operating', { managementPct: v })} hint="Of rent collected, incl. VAT" />
        <NumberInput label="Maintenance" kind="percent" value={A.operating.maintenancePct} onChange={(v) => set('operating', { maintenancePct: v })} />
        <NumberInput label="Insurance" kind="money" suffix="/yr" value={A.operating.insurance} onChange={(v) => set('operating', { insurance: v })} />
        <NumberInput label="Compliance and licensing" kind="money" suffix="/yr" value={A.operating.compliance} onChange={(v) => set('operating', { compliance: v })} hint="Gas safety, EICR, licence, landlord database" />
        <NumberInput label="Other" kind="money" suffix="/yr" value={A.operating.other} onChange={(v) => set('operating', { other: v })} />
      </Section>

      <Section title="Growth and selling">
        <NumberInput label="House price growth" kind="percent" value={A.growth.housePrice} onChange={(v) => set('growth', { housePrice: v })} />
        <NumberInput label="Rent growth" kind="percent" value={A.growth.rent} onChange={(v) => set('growth', { rent: v })} />
        <NumberInput label="Index fund return" kind="percent" value={A.growth.indexFund} onChange={(v) => set('growth', { indexFund: v })} hint="Long-run global equity ~7%" />
        <NumberInput label="Fixed rate length" suffix="yrs" value={A.growth.fixYears} onChange={(v) => set('growth', { fixYears: v })} />
        <NumberInput label="Rate after the fix" kind="percent" value={A.growth.rateAfterFix} onChange={(v) => set('growth', { rateAfterFix: v })} />
        <NumberInput label="Selling costs" kind="percent" value={A.exit.sellingPct} onChange={(v) => set('exit', { sellingPct: v })} />
      </Section>

      <Card title="Backup" subtitle="Your data lives in this browser only. Download a backup to keep it safe or move it to another device.">
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportData}>Download backup</Button>
          <Button onClick={() => fileRef.current?.click()}>Restore from backup</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        </div>
      </Card>
    </div>
  );
}
