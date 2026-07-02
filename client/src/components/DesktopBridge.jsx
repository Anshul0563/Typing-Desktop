import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DesktopBridge() {
  const navigate = useNavigate();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if (!window.desktopApp?.isDesktop) return undefined;
    document.documentElement.dataset.desktop = 'true';
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const stopNavigationListener = window.desktopApp.onNavigate((route) => navigate(route));
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      delete document.documentElement.dataset.desktop;
      stopNavigationListener();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [navigate]);

  if (!window.desktopApp?.isDesktop || online) return null;
  return <div className="desktop-network-status" role="status" aria-live="polite"><WifiOff /><span><strong>You are offline</strong><small>Saved preferences remain available. Online features will resume after reconnection.</small></span></div>;
}
