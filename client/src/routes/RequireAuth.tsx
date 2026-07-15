import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { ROUTE_PATHS } from '../routes/routePaths';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={ROUTE_PATHS.LOGIN} replace state={{ from: location.pathname }} />;
  }

  return children;
}
