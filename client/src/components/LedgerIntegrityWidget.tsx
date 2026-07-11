import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import {
  useGetLedgerIntegrityQuery,
  useVerifyLedgerIntegrityMutation,
} from '../api';
import { ErrorState, Loader } from './common';
import { MoneyAmount } from './ui/MoneyAmount';
import { useToast } from './ui/ToastProvider';
import { tokens } from '../theme/tokens';

export function LedgerIntegrityWidget() {
  const { data, isLoading, isError, error } = useGetLedgerIntegrityQuery();
  const [verify, { isLoading: isVerifying }] = useVerifyLedgerIntegrityMutation();
  const { showToast } = useToast();

  const handleVerify = async () => {
    try {
      const result = await verify().unwrap();
      showToast(
        result.isBalanced
          ? 'Ledger verified — debits and credits are balanced per currency.'
          : 'Ledger imbalance detected. Review entries before processing payments.',
        result.isBalanced ? 'success' : 'error'
      );
    } catch {
      showToast('Verification failed. Please try again.', 'error');
    }
  };

  if (isLoading) {
    return (
      <Card sx={{ borderRadius: 0 }}>
        <Loader variant="card" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card sx={{ borderRadius: 0 }}>
        <CardContent sx={{ p: 3 }}>
          <ErrorState message="Failed to load ledger integrity" error={error} />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const balanced = data.isBalanced;
  const accentColor = balanced ? tokens.color.success : tokens.color.error;
  const accentBg = balanced ? tokens.color.successMuted : tokens.color.errorMuted;

  return (
    <Card
      sx={{
        overflow: 'hidden',
        borderRadius: 0,
        borderColor: balanced ? tokens.color.success : tokens.color.error,
        borderWidth: 1,
        transition: `border-color ${tokens.transition.normal}, box-shadow ${tokens.transition.normal}`,
      }}
    >
      <Box
        sx={{
          height: 4,
          background: balanced
            ? `linear-gradient(90deg, ${tokens.color.success}, ${tokens.color.successMuted})`
            : `linear-gradient(90deg, ${tokens.color.error}, ${tokens.color.errorMuted})`,
        }}
      />

      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Stack spacing={3}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: balanced
                    ? `linear-gradient(135deg, ${tokens.color.success} 0%, #10B981 100%)`
                    : `linear-gradient(135deg, ${tokens.color.error} 0%, #EF4444 100%)`,
                  color: '#fff',
                  boxShadow: tokens.shadow.card,
                }}
              >
                <ShieldOutlinedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h6">Ledger Integrity</Typography>
                <Typography variant="body2">Double-entry balance verification per currency</Typography>
              </Box>
            </Stack>
            <Button
              variant="outlined"
              size="small"
              onClick={handleVerify}
              disabled={isVerifying}
            >
              {isVerifying ? 'Verifying…' : 'Verify Ledger Integrity'}
            </Button>
          </Stack>

          <Box
            sx={{
              p: 3,
              borderRadius: 0,
              bgcolor: accentBg,
              border: `1px solid ${accentColor}22`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
              '@media (prefers-reduced-motion: no-preference)': {
                animation: 'fadeIn 320ms ease',
                '@keyframes fadeIn': {
                  from: { opacity: 0, transform: 'translateY(4px)' },
                  to: { opacity: 1, transform: 'translateY(0)' },
                },
              },
            }}
          >
            {balanced ? (
              <CheckCircleOutlineIcon sx={{ color: accentColor, fontSize: 32, mt: 0.25 }} />
            ) : (
              <ErrorOutlineIcon sx={{ color: accentColor, fontSize: 32, mt: 0.25 }} />
            )}
            <Box>
              <Typography
                variant="subtitle1"
                sx={{ color: accentColor, fontWeight: 600, mb: 0.5 }}
              >
                {balanced ? 'Ledger is balanced' : 'Imbalance detected'}
              </Typography>
              <Typography variant="body2" sx={{ color: tokens.color.inkSecondary }}>
                {balanced
                  ? 'Total debits equal total credits within each currency. The books reconcile.'
                  : 'Debits and credits do not match in one or more currencies. Do not process payments until resolved.'}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: tokens.color.inkMuted }}>
                {data.transactionCount} transactions · {data.entryCount} ledger entries
              </Typography>
            </Box>
          </Box>

          {!balanced ? (
            <Alert severity="error">
              Debits and credits do not match. Investigate immediately before processing payments.
            </Alert>
          ) : null}

          <Stack spacing={2}>
            {data.currencyBalances.map((balance) => {
              const difference = balance.totalDebitsCents - balance.totalCreditsCents;
              const rowColor = balance.isBalanced ? tokens.color.ink : tokens.color.error;

              return (
                <Box
                  key={balance.currency}
                  sx={{
                    p: 2,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    borderRadius: 0,
                  }}
                >
                  <Typography variant="overline" display="block" sx={{ mb: 1.5 }}>
                    {balance.currency}
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    divider={
                      <Box
                        sx={{
                          display: { xs: 'none', sm: 'block' },
                          width: '1px',
                          bgcolor: tokens.color.borderSubtle,
                          alignSelf: 'stretch',
                        }}
                      />
                    }
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" display="block" color="text.secondary">
                        Total Debits
                      </Typography>
                      <MoneyAmount
                        cents={balance.totalDebitsCents}
                        currency={balance.currency}
                        variant="h6"
                        component="div"
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" display="block" color="text.secondary">
                        Total Credits
                      </Typography>
                      <MoneyAmount
                        cents={balance.totalCreditsCents}
                        currency={balance.currency}
                        variant="h6"
                        component="div"
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" display="block" color="text.secondary">
                        Difference
                      </Typography>
                      <MoneyAmount
                        cents={difference}
                        currency={balance.currency}
                        variant="h6"
                        component="div"
                        sx={{ color: rowColor }}
                      />
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
