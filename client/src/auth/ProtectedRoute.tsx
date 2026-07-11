import { Navigate, Outlet } from 'react-router-dom';
import { Loader } from '../components/common/Loader';
import { ROUTE_PATHS } from '../routes/routePaths';
import { useAuth } from './AuthProvider';

export function ProtectedRoute() {
  const { isConfigured, isLoading, session } = useAuth();

  if (!isConfigured) {
    return <Outlet />;
  }

  if (isLoading) {
    return <Loader variant="page" />;
  }

  if (!session) {
    return <Navigate to={ROUTE_PATHS.LOGIN} replace />;
  }

  return <Outlet />;
}
