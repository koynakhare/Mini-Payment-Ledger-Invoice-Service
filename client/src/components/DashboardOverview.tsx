import { useMemo } from 'react';
import { Box, Button, Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';
import filter from 'lodash/filter.js';
import sumBy from 'lodash/sumBy.js';
import { useGetAccountsQuery, useGetInvoicesQuery } from '../api';
import { Loader } from './common';
import { StatCard } from './ui/StatCard';
import { ROUTE_PATHS } from '../routes/routePaths';
import { ACCOUNT_TYPES, INVOICE_STATUS, PAYABLE_INVOICE_STATUSES } from '../constants';
import { tokens } from '../theme/tokens';

export function DashboardOverview() {
  const navigate = useNavigate();
  const { data: accounts, isLoading: accountsLoading } = useGetAccountsQuery();
  const { data: invoices, isLoading: invoicesLoading } = useGetInvoicesQuery(undefined);

  const stats = useMemo(() => {
    const bank = accounts?.find((a) => a.accountType === ACCOUNT_TYPES.COMPANY_BANK);
    const vendorAccounts = filter(accounts, (a) => a.accountType === ACCOUNT_TYPES.VENDOR_PAYABLE);
    const payableTotal = sumBy(vendorAccounts, 'balanceCents');
    const openInvoices = filter(invoices, (inv) =>
      PAYABLE_INVOICE_STATUSES.includes(inv.status)
    );
    const outstandingCents = sumBy(openInvoices, 'remainingCents');
    const overdueCount = filter(invoices, (inv) => inv.status === INVOICE_STATUS.OVERDUE).length;
    const paidCount = filter(invoices, (inv) => inv.status === INVOICE_STATUS.PAID).length;

    return {
      bankBalance: bank?.balanceCents ?? 0,
      payableTotal,
      vendorCount: vendorAccounts.length,
      outstandingCents,
      openCount: openInvoices.length,
      overdueCount,
      paidCount,
      totalInvoices: invoices?.length ?? 0,
    };
  }, [accounts, invoices]);

  if (accountsLoading || invoicesLoading) {
    return <Loader variant="card" />;
  }

  return (
    <Grid container spacing={2.5} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} lg={3}>
        <StatCard
          label="Company Bank"
          moneyCents={stats.bankBalance}
          tone="primary"
          icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 18 }} />}
          hint="Available cash position"
        />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <StatCard
          label="Vendor Payables"
          moneyCents={stats.payableTotal}
          tone="accent"
          icon={<GroupsOutlinedIcon sx={{ fontSize: 18 }} />}
          hint={`${stats.vendorCount} vendor account${stats.vendorCount === 1 ? '' : 's'}`}
        />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <StatCard
          label="Outstanding"
          moneyCents={stats.outstandingCents}
          tone="warning"
          icon={<PendingActionsOutlinedIcon sx={{ fontSize: 18 }} />}
          hint={`${stats.openCount} open invoice${stats.openCount === 1 ? '' : 's'}`}
        />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <StatCard
          label="Invoices"
          value={stats.totalInvoices}
          tone="default"
          icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />}
          hint={`${stats.paidCount} paid · ${stats.overdueCount} overdue`}
        />
      </Grid>

      <Grid item xs={12}>
        <Card sx={{ borderRadius: 0 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Quick actions
                </Typography>
                <Typography variant="body2">
                  Create bills, pay vendors, and review account statements.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate(ROUTE_PATHS.INVOICES)}
                  sx={{
                    background: tokens.color.accentGradient,
                    '&:hover': { background: tokens.color.accentGradient, filter: 'brightness(1.06)' },
                  }}
                >
                  Manage Invoices
                </Button>
                <Button variant="outlined" onClick={() => navigate(ROUTE_PATHS.ACCOUNTS)}>
                  View Accounts
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
