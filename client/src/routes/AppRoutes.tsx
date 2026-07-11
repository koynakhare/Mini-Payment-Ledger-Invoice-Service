import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { Layout } from '../components/Layout';
import { LoginPage } from '../pages/LoginPage';
import { APP_ROUTE_CONFIG } from './routeConfig';
import { ROUTE_PATHS } from './routePaths';

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTE_PATHS.LOGIN} element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          {APP_ROUTE_CONFIG.map(({ key, path, index, Component }) =>
            index ? (
              <Route key={key} index element={<Component />} />
            ) : (
              <Route key={key} path={path} element={<Component />} />
            )
          )}
          <Route path="*" element={<Navigate to={ROUTE_PATHS.DASHBOARD} replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
