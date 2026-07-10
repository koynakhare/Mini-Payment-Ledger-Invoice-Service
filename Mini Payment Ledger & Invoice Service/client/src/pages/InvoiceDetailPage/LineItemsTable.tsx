import { useMemo } from 'react';
import { Typography } from '@mui/material';
import { Table, type TableColumn } from '../../components/common';
import { MoneyAmount } from '../../components/ui/MoneyAmount';
import { tokens } from '../../theme/tokens';
import type { CurrencyCode, InvoiceLineItem } from '../../types';

interface LineItemsTableProps {
  lineItems: InvoiceLineItem[];
  currency: CurrencyCode;
}

export function LineItemsTable({ lineItems, currency }: LineItemsTableProps) {
  const columns = useMemo<TableColumn<InvoiceLineItem>[]>(
    () => [
      { id: 'description', label: 'Description', accessor: 'description' },
      {
        id: 'quantity',
        label: 'Qty',
        align: 'right',
        renderCell: (row) => (
          <Typography component="span" sx={{ fontFamily: tokens.font.mono }}>
            {row.quantity}
          </Typography>
        ),
      },
      {
        id: 'unitPrice',
        label: 'Unit Price',
        align: 'right',
        renderCell: (row) => <MoneyAmount cents={row.unitPriceCents} currency={currency} />,
      },
      {
        id: 'amount',
        label: 'Amount',
        align: 'right',
        renderCell: (row) => <MoneyAmount cents={row.amountCents} currency={currency} />,
      },
    ],
    [currency]
  );

  return (
    <>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Line Items
      </Typography>
      <Table columns={columns} rows={lineItems} rowKey={(row) => row.id} />
    </>
  );
}
