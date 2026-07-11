import { Box, Chip, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useGetAccountStatementQuery, useGetAccountsQuery } from '../api';
import { Table, Breadcrumbs, type TableColumn } from '../components/common';
import { MoneyAmount } from '../components/ui/MoneyAmount';
import { PageHeader } from '../components/ui/PageHeader';
import {
  ACCOUNT_TYPE_DESCRIPTIONS,
  ACCOUNT_TYPE_OPTIONS,
  ACCOUNT_TYPES,
} from '../constants';
import { ROUTE_PATHS } from '../routes/routePaths';
import { accountTypeTokens, tokens } from '../theme/tokens';
import type { AccountStatementLine, AccountType } from '../types';
import { formatDateTime } from '../utils/format';

function getAccountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function AccountStatementPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const { data: accounts } = useGetAccountsQuery();
  const { data: statement, isLoading, isError, error } = useGetAccountStatementQuery(
    accountId ?? '',
    { skip: !accountId }
  );

  const account = accounts?.find((a) => a.id === accountId);

  const breadcrumbItems = useMemo(
    () => [
      { label: 'Accounts', path: ROUTE_PATHS.ACCOUNTS },
      { label: account?.name ?? 'Statement' },
    ],
    [account?.name]
  );

  const accountDescription = useMemo(() => {
    if (!account) return undefined;
    if (account.accountType === ACCOUNT_TYPES.COMPANY_BANK) {
      return ACCOUNT_TYPE_DESCRIPTIONS.COMPANY_BANK;
    }
    if (account.accountType === ACCOUNT_TYPES.VENDOR_PAYABLE) {
      return ACCOUNT_TYPE_DESCRIPTIONS.VENDOR_PAYABLE;
    }
    return undefined;
  }, [account]);

  const columns = useMemo<TableColumn<AccountStatementLine>[]>(
    () => [
      {
        id: 'date',
        label: 'Date',
        renderCell: (row) => (
          <Box sx={{ whiteSpace: 'nowrap', color: tokens.color.inkSecondary }}>
            {formatDateTime(row.createdAt)}
          </Box>
        ),
      },
      {
        id: 'description',
        label: 'Description',
        accessor: 'description',
      },
      {
        id: 'type',
        label: 'Type',
        renderCell: (row) => (
          <Chip
            label={row.entryType}
            size="small"
            sx={{
              fontWeight: 600,
              textTransform: 'capitalize',
              bgcolor:
                row.entryType === 'credit'
                  ? tokens.color.successMuted
                  : tokens.color.draftMuted,
              color:
                row.entryType === 'credit' ? tokens.color.success : tokens.color.draft,
              border: `1px solid ${
                row.entryType === 'credit' ? '#A7F3D0' : tokens.color.border
              }`,
            }}
          />
        ),
      },
      {
        id: 'amount',
        label: 'Amount',
        align: 'right',
        renderCell: (row) => (
          <MoneyAmount cents={row.amountCents} signed debit={row.entryType === 'debit'} />
        ),
      },
      {
        id: 'runningBalance',
        label: 'Running Balance',
        align: 'right',
        renderCell: (row) => <MoneyAmount cents={row.runningBalanceCents} />,
      },
    ],
    []
  );

  const accountTypeToken = account
    ? (accountTypeTokens[account.accountType] ?? {
        color: tokens.color.inkSecondary,
        background: tokens.color.surfaceMuted,
      })
    : null;

  return (
    <Box>
      <PageHeader
        title={account?.name ?? 'Account Statement'}
        breadcrumbs={
          <Breadcrumbs items={breadcrumbItems} backTo={ROUTE_PATHS.ACCOUNTS} />
        }
        subtitle={
          account && accountTypeToken ? (
            <Stack spacing={0.75}>
              <Chip
                label={getAccountTypeLabel(account.accountType)}
                size="small"
                sx={{
                  alignSelf: 'flex-start',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  letterSpacing: '0.02em',
                  color: accountTypeToken.color,
                  bgcolor: accountTypeToken.background,
                  border: 'none',
                }}
              />
              {accountDescription ? (
                <Typography variant="caption" sx={{ color: tokens.color.inkMuted, lineHeight: 1.5 }}>
                  {accountDescription}
                </Typography>
              ) : null}
            </Stack>
          ) : undefined
        }
        actions={
          account ? (
            <Box
              sx={{
                px: 2,
                py: 1.5,
                bgcolor: tokens.color.surfaceMuted,
                border: `1px solid ${tokens.color.borderSubtle}`,
                textAlign: { xs: 'left', sm: 'right' },
                minWidth: { sm: 180 },
              }}
            >
              <Typography
                variant="overline"
                sx={{ display: 'block', color: tokens.color.inkMuted, lineHeight: 1.3 }}
              >
                Current Balance
              </Typography>
              <MoneyAmount
                cents={account.balanceCents}
                variant="h5"
                component="div"
                sx={{
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: tokens.color.ink,
                }}
              />
            </Box>
          ) : undefined
        }
      />

      <Table
        columns={columns}
        rows={statement ?? []}
        rowKey={(row) => `${row.transactionId}-${row.createdAt}-${row.amountCents}`}
        isLoading={isLoading}
        error={isError ? error : undefined}
        errorMessage="Failed to load statement"
        emptyTitle="No transactions yet"
        emptyDescription="When invoices are sent or payments are applied, entries will appear here with a running balance — like a bank statement."
        maxHeight="calc(100vh - 300px)"
        skeletonRows={8}
        getRowSx={(_row, index) => ({
          '@media (prefers-reduced-motion: no-preference)': {
            animation: 'rowIn 280ms ease',
            animationDelay: `${Math.min(index, 8) * 30}ms`,
            animationFillMode: 'both',
            '@keyframes rowIn': {
              from: { opacity: 0, transform: 'translateY(4px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          },
        })}
      />
    </Box>
  );
}
