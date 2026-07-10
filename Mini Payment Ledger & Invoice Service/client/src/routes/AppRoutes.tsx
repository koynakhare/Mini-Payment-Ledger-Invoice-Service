import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { APP_ROUTE_CONFIG } from './routeConfig';
import { ROUTE_PATHS } from './routePaths';

export function AppRoutes() {
  return (
    <Routes>
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
    </Routes>
  );
}
