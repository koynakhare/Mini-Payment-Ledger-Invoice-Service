import type { ComponentType } from 'react';
import { AccountStatementPage } from '../pages/AccountStatementPage';
import { AccountsPage } from '../pages/AccountsPage';
import { AssistantPage } from '../pages/AssistantPage';
import { DashboardPage } from '../pages/DashboardPage';
import { InvoiceDetailPage } from '../pages/InvoiceDetailPage';
import { InvoiceListPage } from '../pages/InvoiceListPage';
import { ROUTE_KEYS, ROUTE_SEGMENTS } from './routePaths';

export interface AppRouteConfig {
  key: string;
  path?: string;
  index?: boolean;
  Component: ComponentType;
}

export const APP_ROUTE_CONFIG: AppRouteConfig[] = [
  {
    key: ROUTE_KEYS.DASHBOARD,
    index: true,
    Component: DashboardPage,
  },
  {
    key: ROUTE_KEYS.ACCOUNTS,
    path: ROUTE_SEGMENTS.ACCOUNTS,
    Component: AccountsPage,
  },
  {
    key: ROUTE_KEYS.ACCOUNT_STATEMENT,
    path: `${ROUTE_SEGMENTS.ACCOUNTS}/${ROUTE_SEGMENTS.ACCOUNT_ID}`,
    Component: AccountStatementPage,
  },
  {
    key: ROUTE_KEYS.INVOICES,
    path: ROUTE_SEGMENTS.INVOICES,
    Component: InvoiceListPage,
  },
  {
    key: ROUTE_KEYS.INVOICE_DETAIL,
    path: `${ROUTE_SEGMENTS.INVOICES}/${ROUTE_SEGMENTS.INVOICE_ID}`,
    Component: InvoiceDetailPage,
  },
  {
    key: ROUTE_KEYS.ASSISTANT,
    path: ROUTE_SEGMENTS.ASSISTANT,
    Component: AssistantPage,
  },
];
