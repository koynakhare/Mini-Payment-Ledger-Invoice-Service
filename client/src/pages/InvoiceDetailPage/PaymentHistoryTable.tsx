import { useMemo } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import BlockIcon from '@mui/icons-material/Block';
import { Table, type TableColumn } from '../../components/common';
import { MoneyAmount } from '../../components/ui/MoneyAmount';
import { tokens } from '../../theme/tokens';
import type { CurrencyCode, Payment, ReversalType } from '../../types';
import { formatDateTime, formatPaymentDisplay } from '../../utils/format';

interface PaymentHistoryTableProps {
  payments: Payment[];
  invoiceCurrency: CurrencyCode;
  canReverse?: boolean;
  onReverse: (payment: Payment, type: ReversalType) => void;
}

export function PaymentHistoryTable({
  payments,
  invoiceCurrency,
  canReverse = true,
  onReverse,
}: PaymentHistoryTableProps) {
  const columns = useMemo<TableColumn<Payment>[]>(() => {
    const base: TableColumn<Payment>[] = [
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
        id: 'amount',
        label: 'Paid',
        align: 'right',
        renderCell: (row) => (
          <Typography
            variant="body2"
            component="span"
            sx={{
              fontFamily: tokens.font.mono,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            {formatPaymentDisplay(row, invoiceCurrency)}
          </Typography>
        ),
      },
      {
        id: 'net',
        label: 'Net (invoice)',
        align: 'right',
        renderCell: (row) => (
          <MoneyAmount cents={row.netAmountCents} currency={invoiceCurrency} />
        ),
      },
      {
        id: 'reference',
        label: 'Reference',
        renderCell: (row) => (
          <Box
            component="span"
            sx={{
              fontFamily: tokens.font.mono,
              fontSize: '0.75rem',
              color: tokens.color.inkMuted,
            }}
          >
            {row.idempotencyKey.slice(0, 18)}…
          </Box>
        ),
      },
    ];

    if (!canReverse) {
      return base;
    }

    return [
      ...base,
      {
        id: 'actions',
        label: 'Actions',
        renderCell: (row) =>
          row.netAmountCents > 0 ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              <Button
                size="small"
                variant="text"
                startIcon={<UndoIcon fontSize="small" />}
                onClick={() => onReverse(row, 'refund')}
              >
                Refund
              </Button>
              <Button
                size="small"
                variant="text"
                color="warning"
                startIcon={<BlockIcon fontSize="small" />}
                onClick={() => onReverse(row, 'void')}
              >
                Void
              </Button>
            </Stack>
          ) : null,
      },
    ];
  }, [canReverse, invoiceCurrency, onReverse]);

  return (
    <>
      <Typography variant="subtitle2" sx={{ mt: 4, mb: 1.5 }}>
        Payment History
      </Typography>
      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <Table
          columns={columns}
          rows={payments}
          rowKey={(row) => row.id}
          emptyTitle="No payments yet"
          emptyDescription="Once this invoice is sent, you can apply full or partial payments here."
        />
      </Box>
    </>
  );
}
