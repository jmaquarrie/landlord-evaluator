import { StoreProvider } from './state/store.jsx';
import { useRoute } from './router.js';
import { cx } from './components/ui.jsx';
import InboxPage from './pages/InboxPage.jsx';
import AreasPage from './pages/AreasPage.jsx';
import DealPage from './pages/DealPage.jsx';
import AssumptionsPage from './pages/AssumptionsPage.jsx';
import OfferPackPage from './pages/OfferPackPage.jsx';

const NAV = [
  { id: '', label: 'Deals', href: '#/' },
  { id: 'areas', label: 'Area finder', href: '#/areas' },
  { id: 'assumptions', label: 'Assumptions', href: '#/assumptions' },
];

function Shell() {
  const route = useRoute();
  const [section, id, tab] = route;

  if (section === 'deal' && tab === 'pack') return <OfferPackPage id={id} />;

  let page;
  if (section === 'deal') page = <DealPage id={id} tab={tab} />;
  else if (section === 'areas') page = <AreasPage />;
  else if (section === 'assumptions') page = <AssumptionsPage />;
  else page = <InboxPage />;

  const active = section === 'deal' ? '' : section ?? '';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur no-print">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <a href="#/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">BRR</span>
            <span className="hidden sm:inline">Deal Finder</span>
          </a>
          <nav className="flex gap-1" aria-label="Main">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={n.href}
                aria-current={active === n.id ? 'page' : undefined}
                className={cx(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition',
                  active === n.id ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{page}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-400 no-print">
        Sold prices: HM Land Registry Price Paid Data, © Crown copyright, OGL v3.0. Postcodes: postcodes.io. Figures are estimates for
        screening deals, not financial or tax advice.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
