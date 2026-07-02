import { useEffect, useState, useSyncExternalStore } from 'react';
import { getPendingRequestCount, subscribePendingRequests } from '../services/api.js';

export function GlobalLoader() {
  const pending = useSyncExternalStore(subscribePendingRequests, getPendingRequestCount, () => 0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending) { setVisible(false); return undefined; }
    const timer = window.setTimeout(() => setVisible(true), 350);
    return () => window.clearTimeout(timer);
  }, [pending]);
  if (!visible || !pending) return null;
  return <div className="global-loader" role="status" aria-live="polite" aria-label="Please wait, content is loading"><div className="global-loader-card"><span className="global-loader-mark"><img src="/logo.png" alt="" /><i /><b /></span><strong>Loading…</strong><small>{pending > 1 ? 'Preparing your data' : 'Just a moment'}</small></div></div>;
}
