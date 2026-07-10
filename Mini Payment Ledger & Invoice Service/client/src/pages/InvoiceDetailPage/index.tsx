import { useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Grid, Skeleton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DownloadIcon from '@mui/icons-material/Download';
import { useParams } from 'react-router-dom';
import { useGetInvoiceQuery, useSendInvoiceMutation } from '../../store/api';
import {
  Breadcrumbs,
  ErrorState,
  Loader,
  StatusBadge,
} from '../../components/common';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/ToastProvider';
import { INVOICE_STATUS, PAYABLE_INVOICE_STATUSES } from '../../constants';
import { ROUTE_PATHS } from '../../routes/routePaths';
import type { Payment, ReversalType } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import { downloadInvoicePdf } from '../../utils/invoicePdf';
import { tokens } from '../../theme/tokens';
import { ApplyPaymentForm } from './ApplyPaymentForm';
import { InvoiceSummaryCards } from './InvoiceSummaryCards';
import { LineItemsTable } from './LineItemsTable';
import { PaymentHistoryTable } from './PaymentHistoryTable';
import { ReversalsTable } from './ReversalsTable';
import { ReversePaymentDialog } from './ReversePaymentDialog';

export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { data: invoice, isLoading, isError, error } = useGetInvoiceQuery(invoiceId ?? '', {
    skip: !invoiceId,
  });
  const [sendInvoice, { isLoading: sending }] = useSendInvoiceMutation();
  const { showToast } = useToast();

  const [reverseTarget, setReverseTarget] = useState<{
    payment: Payment;
    type: ReversalType;
  } | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const breadcrumbItems = useMemo(
    () => [
      { label: 'Invoices', path: ROUTE_PATHS.INVOICES },
      { label: invoice?.invoiceNumber ?? 'Invoice' },
    ],
    [invoice?.invoiceNumber]
  );

  if (isLoading) {
    return (
      <Box>
        <PageHeader title="Invoice" />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={6} md={3} key={i}>
              <Card>
                <CardContent>
                  <Skeleton width={60} height={16} sx={{ mb: 1 }} />
                  <Skeleton width={100} height={28} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Loader variant="table" rows={4} columns={4} />
      </Box>
    );
  }

  if (isError || !invoice) {
    return (
      <ErrorState
        message={`Failed to load invoice: ${error ? getErrorMessage(error) : 'Not found'}`}
      />
    );
  }

  const canPay = PAYABLE_INVOICE_STATUSES.includes(invoice.status);
  const canSend = invoice.status === INVOICE_STATUS.DRAFT;

  const handleSend = async () => {
    try {
      await sendInvoice(invoice.id).unwrap();
      showToast('Invoice sent and posted to the ledger.', 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
      showToast('Invoice PDF downloaded.', 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <Box sx={{ pb: { xs: 1, md: 0 } }}>
      <PageHeader
        title={invoice.invoiceNumber}
        backTo={ROUTE_PATHS.INVOICES}
        backLabel="Back to Invoices"
        breadcrumbs={<Breadcrumbs items={breadcrumbItems} />}
        subtitle={`Vendor: ${invoice.vendor.name}`}
        actions={
          <>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<DownloadIcon />}
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              sx={{ width: { sm: 'auto' } }}
            >
              {downloadingPdf ? 'Downloading…' : 'Download PDF'}
            </Button>
            {canSend ? (
              <Button
                variant="contained"
                fullWidth
                startIcon={<SendIcon />}
                onClick={handleSend}
                disabled={sending}
                sx={{
                  width: { sm: 'auto' },
                  background: tokens.color.accentGradient,
                  '&:hover': { background: tokens.color.accentGradient, filter: 'brightness(1.06)' },
                }}
              >
                {sending ? 'Sending…' : 'Send Invoice'}
              </Button>
            ) : (
              <StatusBadge status={invoice.status} size="medium" />
            )}
          </>
        }
      />

      <InvoiceSummaryCards invoice={invoice} />
      <LineItemsTable lineItems={invoice.lineItems} currency={invoice.currency} />
      <PaymentHistoryTable
        payments={invoice.payments}
        invoiceCurrency={invoice.currency}
        onReverse={(payment, type) => setReverseTarget({ payment, type })}
      />
      <ReversalsTable reversals={invoice.reversals} invoiceCurrency={invoice.currency} />
      {canPay ? <ApplyPaymentForm invoice={invoice} /> : null}

      <ReversePaymentDialog
        open={!!reverseTarget}
        payment={reverseTarget?.payment ?? null}
        invoiceCurrency={invoice.currency}
        reversalType={reverseTarget?.type ?? null}
        onClose={() => setReverseTarget(null)}
      />
    </Box>
  );
}
