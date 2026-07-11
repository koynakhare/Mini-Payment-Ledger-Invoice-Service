import { useMemo, useState } from 'react';
import { Box, Button, Chip, Grid, Link, Typography } from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AddIcon from '@mui/icons-material/Add';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { Link as RouterLink } from 'react-router-dom';
import filter from 'lodash/filter.js';
import sumBy from 'lodash/sumBy.js';
import { useGetAccountsQuery } from '../../api';
import { Table, type TableColumn } from '../../components/common';
import { MoneyAmount } from '../../components/ui/MoneyAmount';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { ACCOUNT_TYPE_DESCRIPTIONS, ACCOUNT_TYPES } from '../../constants';
import { accountTypeTokens, tokens } from '../../theme/tokens';
import type { Account } from '../../types';
import { CreateAccountDialog } from './CreateAccountDialog';

function formatAccountType(type: string): string {
  return type.replace(/_/g, ' ');
}

export function AccountsPage() {
  const { data: accounts, isLoading, isError, error } = useGetAccountsQuery();
  const [createOpen, setCreateOpen] = useState(false);

  const summary = useMemo(() => {
    const bank = accounts?.find((a) => a.accountType === ACCOUNT_TYPES.COMPANY_BANK);
    const vendors = filter(accounts, (a) => a.accountType === ACCOUNT_TYPES.VENDOR_PAYABLE);
    return {
      bankBalance: bank?.balanceCents ?? 0,
      payableTotal: sumBy(vendors, 'balanceCents'),
      vendorCount: vendors.length,
    };
  }, [accounts]);

  const columns = useMemo<TableColumn<Account>[]>(
    () => [
      {
        id: 'name',
        label: 'Account',
        renderCell: (row) => {
          const description =
            row.accountType === ACCOUNT_TYPES.COMPANY_BANK
              ? ACCOUNT_TYPE_DESCRIPTIONS.COMPANY_BANK
              : row.accountType === ACCOUNT_TYPES.VENDOR_PAYABLE
                ? ACCOUNT_TYPE_DESCRIPTIONS.VENDOR_PAYABLE
                : null;

          return (
            <Box>
              <Box sx={{ fontWeight: 600, color: tokens.color.ink }}>{row.name}</Box>
              {description ? (
                <Typography variant="caption" sx={{ display: 'block', color: tokens.color.inkMuted, mt: 0.25 }}>
                  {description}
                </Typography>
              ) : null}
            </Box>
          );
        },
      },
      {
        id: 'type',
        label: 'Type',
        renderCell: (row) => {
          const token = accountTypeTokens[row.accountType] ?? {
            color: tokens.color.inkSecondary,
            background: tokens.color.surfaceMuted,
          };
          return (
            <Chip
              label={formatAccountType(row.accountType)}
              size="small"
              sx={{
                fontWeight: 600,
                fontSize: '0.7rem',
                letterSpacing: '0.02em',
                color: token.color,
                bgcolor: token.background,
                border: 'none',
              }}
            />
          );
        },
      },
      {
        id: 'balance',
        label: 'Balance',
        align: 'right',
        renderCell: (row) => (
          <MoneyAmount cents={row.balanceCents} sx={{ fontWeight: 600 }} />
        ),
      },
      {
        id: 'statement',
        label: '',
        renderCell: (row) => (
          <Link
            component={RouterLink}
            to={ROUTE_PATHS.ACCOUNT_STATEMENT(row.id)}
            underline="none"
            sx={{
              fontWeight: 600,
              fontSize: '0.8125rem',
              color: tokens.color.accent,
              px: 1.5,
              py: 0.5,
              borderRadius: 0,
              bgcolor: tokens.color.accentMuted,
              transition: `background-color ${tokens.transition.fast}`,
              '&:hover': { bgcolor: '#D0F0EC' },
            }}
          >
            Statement →
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <Box>
      <PageHeader
        title="Accounts"
        subtitle="Company bank, per-vendor payables, and expense — balances derived live from the ledger"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Add Account
          </Button>
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <StatCard
            label="Company Bank"
            moneyCents={summary.bankBalance}
            tone="primary"
            icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 18 }} />}
            hint={ACCOUNT_TYPE_DESCRIPTIONS.COMPANY_BANK}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <StatCard
            label="Total Vendor Payables"
            moneyCents={summary.payableTotal}
            tone="accent"
            icon={<GroupsOutlinedIcon sx={{ fontSize: 18 }} />}
            hint={`${ACCOUNT_TYPE_DESCRIPTIONS.VENDOR_PAYABLE} · ${summary.vendorCount} vendor account${summary.vendorCount === 1 ? '' : 's'}`}
          />
        </Grid>
      </Grid>

      <Box
        sx={{
          borderRadius: 0,
          overflow: 'hidden',
          border: `1px solid ${tokens.color.borderSubtle}`,
          boxShadow: tokens.shadow.card,
          bgcolor: tokens.color.surface,
        }}
      >
        <Table
          columns={columns}
          rows={accounts ?? []}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          error={isError ? error : undefined}
          errorMessage="Failed to load accounts"
          emptyTitle="No accounts yet"
          emptyDescription="Add an account or run the database seed script to create system accounts."
          maxHeight="calc(100vh - 380px)"
          skeletonRows={5}
        />
      </Box>

      <CreateAccountDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  );
}
