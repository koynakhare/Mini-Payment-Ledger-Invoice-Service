import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LoginPage } from '../pages/LoginPage';
import { APP_ROUTE_CONFIG } from './routeConfig';
import { RequireAuth } from './RequireAuth';
import { ROUTE_PATHS, ROUTE_SEGMENTS } from './routePaths';

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTE_SEGMENTS.LOGIN} element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        {APP_ROUTE_CONFIG.map(({ key, path, index, Component }) =>
          index ? (
            <Route key={key} index element={<Component />} />
          ) : (
            <Route key={key} path={path} element={<Component />} />
          )
        )}
        <Route path="*" element={<Navigate to={ROUTE_PATHS.DASHBOARD} replace />} />
      </Route>
    </Routes>
  );
}
