import { LINE_ITEMS, SCOPES, epcUpgradeEstimate, lineItemCost, lineItemsTotal, scopeEstimate } from '../lib/refurb.js';
import { gbp } from '../lib/format.js';
import { Button, Segmented, cx } from './ui.jsx';

/** Two ways to price works: a quick scope estimate, or ticking line items. */
export default function RefurbEstimator({ deal, regionFactor, onUse, onChange }) {
  const area = deal.floorArea || 70;
  const items = deal.refurbItems || [];
  const scopeCost = scopeEstimate(deal.refurbScope || 'medium', area, regionFactor);
  const itemsCost = lineItemsTotal(items, area, regionFactor);
  const epc = epcUpgradeEstimate(deal.epc);
  const toggle = (id) => onChange({ refurbItems: items.includes(id) ? items.filter((i) => i !== id) : [...items, id] });

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-medium text-slate-600">Quick estimate by scope · {area}m²</div>
        <Segmented size="sm" value={deal.refurbScope || 'medium'} onChange={(v) => onChange({ refurbScope: v })} options={SCOPES.map((s) => ({ value: s.value, label: s.label }))} />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600">{SCOPES.find((s) => s.value === (deal.refurbScope || 'medium'))?.hint}</span>
          <Button size="sm" onClick={() => onUse(scopeCost)}>
            Use {gbp(scopeCost)}
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-slate-600">Or build it up item by item</div>
        <div className="grid gap-1 sm:grid-cols-2">
          {LINE_ITEMS.map((item) => {
            const on = items.includes(item.id);
            return (
              <label key={item.id} className={cx('flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm', on ? 'border-slate-900 bg-slate-50' : 'border-slate-200')}>
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={on} onChange={() => toggle(item.id)} className="accent-slate-900" />
                  {item.label}
                </span>
                <span className="tabular-nums text-slate-500">{gbp(lineItemCost(item, area, regionFactor))}</span>
              </label>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600">{items.length} items selected</span>
          <Button size="sm" onClick={() => onUse(itemsCost)} disabled={!items.length}>
            Use {gbp(itemsCost)}
          </Button>
        </div>
      </div>

      {epc > 0 && (
        <p className="text-xs text-slate-500">
          EPC {deal.epc} → C typically costs about {gbp(epc)}. The government plans to require EPC C for new tenancies by 2030, so budget for it now if
          it isn't in your works list.
        </p>
      )}
      <p className="text-xs text-slate-400">Contingency is added on top in the cash waterfall. Adjust prices for your area on the Assumptions page.</p>
    </div>
  );
}
