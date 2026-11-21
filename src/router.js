import { useEffect, useState } from 'react';

// Tiny hash router: #/deal/abc/cashflow → ['deal', 'abc', 'cashflow'].
function parse() {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function useRoute() {
  const [parts, setParts] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setParts(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parts;
}

export function navigate(path) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}
