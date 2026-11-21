// App state: deals, assumptions, buy box and settings. Saved in this browser's
// localStorage. Use Assumptions → Backup to move data between devices.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { DEFAULT_ASSUMPTIONS, DEFAULT_BUY_BOX, DEFAULT_SETTINGS, mergeAssumptions } from '../lib/defaults.js';
import { SAMPLE_DEALS } from '../lib/sampleDeals.js';
import { uid } from '../lib/format.js';

const KEY = 'brr-deal-finder:v1';

function initialState() {
  const fresh = {
    deals: SAMPLE_DEALS.map((d) => ({ ...d, createdAt: new Date().toISOString() })),
    assumptions: DEFAULT_ASSUMPTIONS,
    buyBox: DEFAULT_BUY_BOX,
    settings: DEFAULT_SETTINGS,
    areaRents: {},
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw);
    return {
      ...fresh,
      ...saved,
      // Merge so new default fields appear after an upgrade.
      assumptions: mergeAssumptions(DEFAULT_ASSUMPTIONS, saved.assumptions),
      buyBox: { ...DEFAULT_BUY_BOX, ...saved.buyBox },
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    };
  } catch {
    return fresh;
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'addDeal':
      return { ...state, deals: [action.deal, ...state.deals] };
    case 'updateDeal':
      return { ...state, deals: state.deals.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)) };
    case 'deleteDeal':
      return { ...state, deals: state.deals.filter((d) => d.id !== action.id) };
    case 'setAssumptions':
      return { ...state, assumptions: mergeAssumptions(state.assumptions, action.patch) };
    case 'resetAssumptions':
      return { ...state, assumptions: DEFAULT_ASSUMPTIONS };
    case 'setBuyBox':
      return { ...state, buyBox: { ...state.buyBox, ...action.patch } };
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'setAreaRent':
      return { ...state, areaRents: { ...state.areaRents, [action.sector]: action.rent } };
    case 'replaceAll':
      return { ...initialState(), ...action.state };
    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage blocked: the app still works for this visit.
    }
  }, [state]);

  const addDeal = useCallback((deal) => {
    const full = {
      id: uid(),
      createdAt: new Date().toISOString(),
      stage: 'Lead',
      signals: [],
      offers: [],
      notes: '',
      monthsToRefi: 6,
      serviceCharge: 0,
      refurbItems: [],
      nation: 'england',
      tenure: 'freehold',
      ...deal,
    };
    dispatch({ type: 'addDeal', deal: full });
    return full.id;
  }, []);

  const api = useMemo(
    () => ({
      ...state,
      addDeal,
      updateDeal: (id, patch) => dispatch({ type: 'updateDeal', id, patch }),
      deleteDeal: (id) => dispatch({ type: 'deleteDeal', id }),
      setAssumptions: (patch) => dispatch({ type: 'setAssumptions', patch }),
      resetAssumptions: () => dispatch({ type: 'resetAssumptions' }),
      setBuyBox: (patch) => dispatch({ type: 'setBuyBox', patch }),
      setSettings: (patch) => dispatch({ type: 'setSettings', patch }),
      setAreaRent: (sector, rent) => dispatch({ type: 'setAreaRent', sector, rent }),
      replaceAll: (next) => dispatch({ type: 'replaceAll', state: next }),
    }),
    [state, addDeal],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
