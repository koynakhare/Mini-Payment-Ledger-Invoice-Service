import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import isEmpty from 'lodash/isEmpty.js';
import { StatusBadge, Table, type TableColumn } from '../../components/common';
import { MoneyAmount } from '../../components/ui/MoneyAmount';
import { tokens } from '../../theme/tokens';
import type { CurrencyCode, Reversal } from '../../types';
import { formatDateTime } from '../../utils/format';

interface ReversalsTableProps {
  reversals: Reversal[];
  invoiceCurrency: CurrencyCode;
}

export function ReversalsTable({ reversals, invoiceCurrency }: ReversalsTableProps) {
  const columns = useMemo<TableColumn<Reversal>[]>(
    () => [
      {
        id: 'date',
        label: 'Date',
        renderCell: (row) => (
          <Box component="span" sx={{ color: tokens.color.inkSecondary }}>
            {formatDateTime(row.createdAt)}
          </Box>
        ),
      },
      {
        id: 'type',
        label: 'Type',
        renderCell: (row) => <StatusBadge status={row.reversalType} />,
      },
      {
        id: 'amount',
        label: 'Amount',
        align: 'right',
        renderCell: (row) => <MoneyAmount cents={row.amountCents} currency={invoiceCurrency} />,
      },
      {
        id: 'reason',
        label: 'Reason',
        renderCell: (row) => (
          <Box component="span" sx={{ color: tokens.color.inkSecondary }}>
            {row.reason ?? '—'}
          </Box>
        ),
      },
    ],
    [invoiceCurrency]
  );

  if (isEmpty(reversals)) {
    return null;
  }

  return (
    <>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Reversals
      </Typography>
      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <Table columns={columns} rows={reversals} rowKey={(row) => row.id} />
      </Box>
    </>
  );
}
