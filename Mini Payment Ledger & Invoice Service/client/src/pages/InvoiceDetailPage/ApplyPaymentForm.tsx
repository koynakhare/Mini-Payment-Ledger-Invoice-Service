import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import {
  CURRENCY_CONFIG,
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  type CurrencyCode,
} from '../../constants/currency';
import { MoneyAmount } from '../../components/ui/MoneyAmount';
import { useToast } from '../../components/ui/ToastProvider';
import { useApplyPaymentMutation } from '../../store/api';
import type { Invoice } from '../../types';
import { convertCurrency } from '../../utils/convertCurrency';
import {
  formatCents,
  generateIdempotencyKey,
  parseAmountToCents,
} from '../../utils/format';
import { getErrorMessage } from '../../utils/errors';
import { tokens } from '../../theme/tokens';

interface ApplyPaymentFormProps {
  invoice: Invoice;
}

export function ApplyPaymentForm({ invoice }: ApplyPaymentFormProps) {
  const [applyPayment, { isLoading: paying }] = useApplyPaymentMutation();
  const { showToast } = useToast();
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState<CurrencyCode>(
    invoice.currency
  );
  const [paymentError, setPaymentError] = useState('');

  const convertedPreviewCents = useMemo(() => {
    const amountCents = parseAmountToCents(paymentAmount);
    if (amountCents <= 0) return 0;
    return convertCurrency(amountCents, paymentCurrency, invoice.currency);
  }, [paymentAmount, paymentCurrency, invoice.currency]);

  const handlePay = async () => {
    setPaymentError('');
    const amountCents = parseAmountToCents(paymentAmount);
    if (amountCents <= 0) {
      setPaymentError('Enter a valid payment amount');
      return;
    }

    const convertedAmountCents = convertCurrency(
      amountCents,
      paymentCurrency,
      invoice.currency
    );

    if (convertedAmountCents > invoice.remainingCents) {
      setPaymentError(
        `Amount exceeds remaining balance of ${formatCents(invoice.remainingCents, invoice.currency)}`
      );
      return;
    }

    try {
      await applyPayment({
        invoiceId: invoice.id,
        amountCents,
        currency: paymentCurrency,
        idempotencyKey: generateIdempotencyKey('pay'),
      }).unwrap();
      showToast('Payment applied successfully.', 'success');
      setPaymentAmount('');
    } catch (err) {
      const msg = getErrorMessage(err);
      setPaymentError(msg);
      showToast(msg, 'error');
    }
  };

  const showConversionPreview =
    paymentCurrency !== invoice.currency && convertedPreviewCents > 0;

  return (
    <Card
      sx={{
        mt: 2,
        overflow: 'hidden',
        borderRadius: 0,
        border: `1px solid ${tokens.color.accent}33`,
        boxShadow: tokens.shadow.glow,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
          Apply Payment
        </Typography>
        <Typography variant="body2" sx={{ mb: 2.5 }}>
          Pays from the company bank account to {invoice.vendor.name}. Remaining balance:{' '}
          <MoneyAmount
            cents={invoice.remainingCents}
            currency={invoice.currency}
            component="span"
          />
          . Overpayment is rejected automatically.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
          <TextField
            label={`Amount (${CURRENCY_SYMBOLS[paymentCurrency]})`}
            value={paymentAmount}
            onChange={(e) => {
              setPaymentAmount(e.target.value);
              setPaymentError('');
            }}
            placeholder={(invoice.remainingCents / 100).toFixed(2)}
            error={!!paymentError}
            helperText={
              paymentError ||
              (showConversionPreview
                ? `≈ ${formatCents(convertedPreviewCents, invoice.currency)} applied to invoice`
                : ' ')
            }
            fullWidth
          />
          <FormControl sx={{ minWidth: { sm: 140 } }} fullWidth>
            <InputLabel>Currency</InputLabel>
            <Select
              value={paymentCurrency}
              label="Currency"
              onChange={(e) => {
                setPaymentCurrency(e.target.value as CurrencyCode);
                setPaymentError('');
              }}
            >
              {CURRENCY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<PaymentIcon />}
            onClick={handlePay}
            disabled={paying || !paymentAmount}
            sx={{
              minWidth: 160,
              background: tokens.color.accentGradient,
              '&:hover': { background: tokens.color.accentGradient, filter: 'brightness(1.06)' },
            }}
          >
            {paying ? 'Processing…' : 'Apply Payment'}
          </Button>
        </Stack>
        {showConversionPreview ? (
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: tokens.color.inkMuted }}>
            Fixed rate: 1 USD = {CURRENCY_CONFIG.USD_TO_INR} INR
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}
