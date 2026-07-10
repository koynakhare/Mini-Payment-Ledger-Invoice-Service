import { Grid } from '@mui/material';
import { StatCard } from '../../components/ui/StatCard';
import type { Invoice } from '../../types';
import { formatDate } from '../../utils/format';

interface InvoiceSummaryCardsProps {
  invoice: Invoice;
}

export function InvoiceSummaryCards({ invoice }: InvoiceSummaryCardsProps) {
  return (
    <Grid container spacing={2} sx={{ mb: { xs: 3, md: 4 } }}>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard label="Total" moneyCents={invoice.totalCents} value="" currency={invoice.currency} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          label="Paid"
          moneyCents={invoice.paidCents}
          value=""
          currency={invoice.currency}
          tone="success"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          label="Remaining"
          moneyCents={invoice.remainingCents}
          value=""
          currency={invoice.currency}
          tone={invoice.remainingCents > 0 ? 'warning' : 'success'}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard label="Due Date" value={formatDate(invoice.dueDate)} />
      </Grid>
    </Grid>
  );
}
