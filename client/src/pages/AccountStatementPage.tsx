import { Box, Chip, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useGetAccountStatementQuery, useGetAccountsQuery } from '../api';
import { Breadcrumbs, Table, type TableColumn } from '../components/common';
import { MoneyAmount } from '../components/ui/MoneyAmount';
import { PageHeader } from '../components/ui/PageHeader';
import { ROUTE_PATHS } from '../routes/routePaths';
import { tokens } from '../theme/tokens';
import type { AccountStatementLine } from '../types';
import { formatDateTime } from '../utils/format';

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
      { label: account?.name ?? accountId ?? '' },
    ],
    [account?.name, accountId]
  );

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

  return (
    <Box>
      <PageHeader
        title="Account Statement"
        backTo={ROUTE_PATHS.ACCOUNTS}
        backLabel="Back to Accounts"
        breadcrumbs={<Breadcrumbs items={breadcrumbItems} />}
        subtitle={account ? `${account.name} · ${account.accountType}` : undefined}
      />

      {account ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            mb: 3,
            p: 2.5,
            borderRadius: 0,
            bgcolor: 'background.paper',
            border: `1px solid ${tokens.color.borderSubtle}`,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" display="block">
              Current Balance
            </Typography>
            <MoneyAmount cents={account.balanceCents} variant="h5" component="div" />
          </Box>
        </Stack>
      ) : null}

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
