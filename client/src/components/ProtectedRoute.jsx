import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSiteSettings } from '../context/SiteSettingsContext.jsx';
import { Loader } from './Loader.jsx';
export function ProtectedRoute({ admin = false }) {
  const { user, loading } = useAuth(); const location = useLocation();
  const { settings, loading: settingsLoading } = useSiteSettings();
  if (loading || settingsLoading) return <Loader />;
  if (!user) return <Navigate to={admin || location.pathname.startsWith('/admin') ? '/admin/login' : '/login'} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/admin/login" replace />;
  if (!admin && user.role === 'admin') return <Navigate to="/admin" replace />;
  if (!admin && settings.maintenanceMode) return <main className="maintenance-page"><h1>Maintenance mode is active</h1><p>The platform is temporarily reserved for administrative work. Please check back shortly.</p></main>;
  return <Outlet />;
}
