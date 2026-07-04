import { useSiteSettings } from '../context/SiteSettingsContext.jsx';
const logoUrl = new URL('logo.png', document.baseURI).href;
export function Brand() { const { settings } = useSiteSettings(); return <div className="brand"><span className="brand-mark"><img src={logoUrl} alt="" /></span><span>{settings.siteName || 'SAS Academy'}</span></div>; }
