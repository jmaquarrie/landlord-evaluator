import { useCallback, useEffect, useRef, useState } from 'react';
import { streetEvidence } from './landRegistry.js';
import { lookupPostcode } from './postcodes.js';
import { planningConstraints } from './planning.js';
import { streetStats } from '../evidence.js';

/**
 * Loads live evidence for a deal: street sales (Land Registry), postcode
 * details and planning constraints. Saves a small summary onto the deal so
 * the inbox can show ceiling status without refetching.
 */
export function useDealEvidence(deal, updateDeal) {
  const [state, setState] = useState({ status: 'idle' });
  const dealRef = useRef(deal);
  dealRef.current = deal;

  const load = useCallback(async () => {
    const d = dealRef.current;
    if (!d?.postcode) {
      setState({ status: 'missing' });
      return;
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    try {
      const [place, street] = await Promise.all([
        lookupPostcode(d.postcode, { signal: controller.signal }).catch(() => null),
        streetEvidence({ postcode: d.postcode, address: d.address }, { signal: controller.signal }),
      ]);
      let planning = null;
      let planningError = false;
      if (place) {
        planning = await planningConstraints(place, { signal: controller.signal }).catch(() => {
          planningError = true;
          return null;
        });
      }
      const stats = streetStats(street.sales, { propertyType: d.propertyType });
      setState({ status: 'ready', place, street, stats, planning, planningError });

      const summary = {
        fetchedAt: new Date().toISOString(),
        street: street.street,
        town: street.town,
        ceiling: stats?.ceiling ?? null,
        doneUp: stats?.doneUp ?? null,
        tired: stats?.tired ?? null,
        count: stats?.count ?? 0,
        article4: planning ? planning.article4.length > 0 : null,
        article4BlocksHmo: planning ? planning.article4.some((a) => a.blocksHmo) : null,
        conservation: planning ? planning.conservation.length > 0 : null,
      };
      const prev = d.evidence || {};
      if (prev.ceiling !== summary.ceiling || prev.count !== summary.count || prev.article4 !== summary.article4) {
        updateDeal(d.id, { evidence: summary, ...(place?.lat ? { lat: place.lat, lon: place.lon, district: place.district } : {}) });
      }
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  }, [updateDeal]);

  useEffect(() => {
    load();
    // Reload when the property's location changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id, deal?.postcode, deal?.propertyType, deal?.address]);

  return { ...state, reload: load };
}
