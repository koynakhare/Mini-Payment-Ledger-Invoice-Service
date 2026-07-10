import { Box, Grid } from '@mui/material';
import { DashboardOverview } from '../components/DashboardOverview';
import { LedgerIntegrityWidget } from '../components/LedgerIntegrityWidget';
import { PageHeader } from '../components/ui/PageHeader';
import { tokens } from '../theme/tokens';

export function DashboardPage() {
  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Accounts payable overview, cash position, and double-entry ledger health"
      />

      <DashboardOverview />

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <LedgerIntegrityWidget />
        </Grid>
        <Grid item xs={12} md={6}>
          <Box
            sx={{
              p: 3,
              height: '100%',
              borderRadius: 0,
              bgcolor: tokens.color.surface,
              border: `1px solid ${tokens.color.borderSubtle}`,
              boxShadow: tokens.shadow.card,
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 4,
                borderRadius: 0,
                background: tokens.color.accentGradient,
                mb: 2,
              }}
            />
            <Box component="h3" sx={{ m: 0, mb: 1, fontSize: '1rem', fontWeight: 600, color: tokens.color.ink }}>
              How it works
            </Box>
            <Box component="ol" sx={{ m: 0, pl: 2.5, color: tokens.color.inkSecondary, lineHeight: 1.8, fontSize: '0.875rem' }}>
              <li>Create a vendor invoice as a draft</li>
              <li>Send it to post the liability to the ledger</li>
              <li>Apply payment from the company bank account</li>
              <li>Refund or void payments when corrections are needed</li>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box
            sx={{
              p: 3,
              height: '100%',
              borderRadius: 0,
              background: `linear-gradient(145deg, ${tokens.color.primary} 0%, #0D4A6E 100%)`,
              color: '#fff',
              boxShadow: tokens.shadow.cardHover,
            }}
          >
            <Box component="h3" sx={{ m: 0, mb: 1, fontSize: '1rem', fontWeight: 600 }}>
              Double-entry AP
            </Box>
            <Box sx={{ fontSize: '0.875rem', lineHeight: 1.75, color: 'rgba(255,255,255,0.85)' }}>
              Every payment debits the vendor payable account and credits company bank. Refunds
              reverse the flow. Balances are always derived from the transaction log — never stored
              as mutable fields.
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
