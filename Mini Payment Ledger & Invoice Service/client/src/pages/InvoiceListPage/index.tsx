import { useCallback, useMemo, useState } from 'react';
import { Box, Button, IconButton, Link, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { Link as RouterLink } from 'react-router-dom';
import {
  useGetInvoicesQuery,
  useMarkOverdueInvoicesMutation,
} from '../../store/api';
import { Loader, StatusBadge, Table, type TableColumn } from '../../components/common';
import { MoneyAmount } from '../../components/ui/MoneyAmount';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/ToastProvider';
import {
  INVOICE_STATUS_FILTER_ALL,
  STATUS_FILTER_OPTIONS,
} from '../../constants';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { tokens } from '../../theme/tokens';
import type { Invoice, InvoiceStatus } from '../../types';
import { formatDate } from '../../utils/format';
import { formatInvoiceStatus } from '../../utils/invoice';
import { getErrorMessage } from '../../utils/errors';
import { downloadInvoicePdf } from '../../utils/invoicePdf';
import { CreateInvoiceDialog } from './CreateInvoiceDialog';

export function InvoiceListPage() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | typeof INVOICE_STATUS_FILTER_ALL>(
    INVOICE_STATUS_FILTER_ALL
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const status = statusFilter === INVOICE_STATUS_FILTER_ALL ? undefined : statusFilter;
  const { data: invoices, isLoading, isError, error } = useGetInvoicesQuery(status);
  const [markOverdue, { isLoading: markingOverdue }] = useMarkOverdueInvoicesMutation();

  const handleMarkOverdue = async () => {
    try {
      const updated = await markOverdue(undefined).unwrap();
      showToast(
        updated.length
          ? `Marked ${updated.length} invoice(s) as overdue.`
          : 'No invoices required status update.',
        'success'
      );
    } catch {
      showToast('Overdue job failed.', 'error');
    }
  };

  const handleDownloadPdf = useCallback(
    async (invoice: Invoice) => {
      setDownloadingId(invoice.id);
      try {
        await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
        showToast(`Downloaded ${invoice.invoiceNumber}.`, 'success');
      } catch (err) {
        showToast(getErrorMessage(err), 'error');
      } finally {
        setDownloadingId(null);
      }
    },
    [showToast]
  );

  const columns = useMemo<TableColumn<Invoice>[]>(
    () => [
      {
        id: 'invoiceNumber',
        label: 'Invoice #',
        renderCell: (row) => (
          <Link
            component={RouterLink}
            to={ROUTE_PATHS.INVOICE_DETAIL(row.id)}
            underline="hover"
            sx={{ fontWeight: 600, fontFamily: tokens.font.mono, fontSize: '0.875rem' }}
          >
            {row.invoiceNumber}
          </Link>
        ),
      },
      {
        id: 'vendor',
        label: 'Vendor',
        renderCell: (row) => row.vendor.name,
      },
      {
        id: 'status',
        label: 'Status',
        renderCell: (row) => <StatusBadge status={row.status} />,
      },
      {
        id: 'dueDate',
        label: 'Due Date',
        renderCell: (row) => (
          <Box component="span" sx={{ color: tokens.color.inkSecondary }}>
            {formatDate(row.dueDate)}
          </Box>
        ),
      },
      {
        id: 'total',
        label: 'Total',
        align: 'right',
        renderCell: (row) => <MoneyAmount cents={row.totalCents} currency={row.currency} />,
      },
      {
        id: 'remaining',
        label: 'Remaining',
        align: 'right',
        renderCell: (row) => (
          <MoneyAmount
            cents={row.remainingCents}
            currency={row.currency}
            sx={{
              color:
                row.remainingCents > 0 ? tokens.color.warning : tokens.color.success,
            }}
          />
        ),
      },
      {
        id: 'download',
        label: 'PDF',
        align: 'right',
        renderCell: (row) => (
          <Tooltip title="Download invoice PDF">
            <span>
              <IconButton
                size="small"
                aria-label={`Download PDF for ${row.invoiceNumber}`}
                onClick={() => handleDownloadPdf(row)}
                disabled={downloadingId === row.id}
                sx={{
                  borderRadius: 0,
                  color: tokens.color.accent,
                  border: `1px solid ${tokens.color.border}`,
                  '&:hover': { bgcolor: tokens.color.accentMuted },
                }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ),
      },
    ],
    [downloadingId, handleDownloadPdf]
  );

  if (isLoading) {
    return (
      <Box>
        <PageHeader title="Invoices" subtitle="Accounts payable with payment tracking" />
        <Loader variant="table" rows={6} columns={7} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Invoices"
        subtitle="Track vendor bills from draft through payment"
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<ScheduleOutlinedIcon />}
              onClick={handleMarkOverdue}
              disabled={markingOverdue}
            >
              {markingOverdue ? 'Running…' : 'Run Overdue Job'}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{
                background: tokens.color.accentGradient,
                '&:hover': { background: tokens.color.accentGradient, filter: 'brightness(1.06)' },
              }}
            >
              New Invoice
            </Button>
          </>
        }
      />

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          mb: 3,
          p: 0.75,
          borderRadius: 0,
          bgcolor: tokens.color.surface,
          border: `1px solid ${tokens.color.borderSubtle}`,
          boxShadow: tokens.shadow.card,
          width: 'fit-content',
          maxWidth: '100%',
        }}
      >
        {STATUS_FILTER_OPTIONS.map((filterOption) => {
          const active = statusFilter === filterOption.value;
          return (
            <Button
              key={filterOption.value}
              size="small"
              variant={active ? 'contained' : 'text'}
              onClick={() => setStatusFilter(filterOption.value)}
              sx={{
                borderRadius: tokens.radius.pill,
                px: 2,
                minWidth: 'auto',
                fontWeight: 600,
                ...(active
                  ? {
                      background: tokens.color.accentGradient,
                      color: '#fff',
                      boxShadow: 'none',
                      '&:hover': {
                        background: tokens.color.accentGradient,
                        filter: 'brightness(1.06)',
                      },
                    }
                  : {
                      color: tokens.color.inkSecondary,
                      '&:hover': { bgcolor: tokens.color.surfaceMuted },
                    }),
              }}
            >
              {filterOption.label}
            </Button>
          );
        })}
      </Box>

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
          rows={invoices ?? []}
          rowKey={(row) => row.id}
          error={isError ? error : undefined}
          errorMessage="Failed to load invoices"
          emptyTitle={
            statusFilter === INVOICE_STATUS_FILTER_ALL
              ? 'No invoices yet'
              : `No ${formatInvoiceStatus(statusFilter as InvoiceStatus).toLowerCase()} invoices`
          }
          emptyDescription={
            statusFilter === INVOICE_STATUS_FILTER_ALL
              ? 'Create your first invoice to record a vendor bill and start the payment workflow.'
              : 'Try a different filter or create a new invoice.'
          }
          emptyAction={
            statusFilter === INVOICE_STATUS_FILTER_ALL ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
                Create Invoice
              </Button>
            ) : undefined
          }
          maxHeight="calc(100vh - 280px)"
          skeletonRows={6}
        />
      </Box>

      <CreateInvoiceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  );
}
