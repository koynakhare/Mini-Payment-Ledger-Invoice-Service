import { useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import {
  CURRENCY_CONFIG,
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  type CurrencyCode,
} from '../../constants/currency';
import { FormField, useFormState, type FormFieldConfig } from '../../components/form';
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

const buildInitialValues = (currency: CurrencyCode) => ({
  paymentAmount: '',
  paymentCurrency: currency,
});

export function ApplyPaymentForm({ invoice }: ApplyPaymentFormProps) {
  const [applyPayment, { isLoading: paying }] = useApplyPaymentMutation();
  const { showToast } = useToast();
  const { values, errors, updateValue, setFieldError } = useFormState(
    buildInitialValues(invoice.currency)
  );
  const [paymentError, setPaymentError] = useState('');

  const paymentCurrency = values.paymentCurrency as CurrencyCode;
  const amountCents = parseAmountToCents(values.paymentAmount);
  const convertedPreviewCents =
    amountCents > 0 ? convertCurrency(amountCents, paymentCurrency, invoice.currency) : 0;
  const showConversionPreview =
    paymentCurrency !== invoice.currency && convertedPreviewCents > 0;

  const fields = useMemo<FormFieldConfig[]>(() => {
    const fieldError = paymentError || errors.paymentAmount;
    return [
      {
        type: 'text',
        name: 'paymentAmount',
        label: `Amount (${CURRENCY_SYMBOLS[paymentCurrency]})`,
        placeholder: (invoice.remainingCents / 100).toFixed(2),
        error: fieldError,
        helperText:
          fieldError ||
          (showConversionPreview
            ? `≈ ${formatCents(convertedPreviewCents, invoice.currency)} applied to invoice`
            : ' '),
      },
      {
        type: 'select',
        name: 'paymentCurrency',
        label: 'Currency',
        minWidth: 140,
        options: CURRENCY_OPTIONS.map((option) => ({
          value: option.value,
          label: option.value,
        })),
      },
    ];
  }, [
    convertedPreviewCents,
    errors.paymentAmount,
    invoice.currency,
    invoice.remainingCents,
    paymentCurrency,
    paymentError,
    showConversionPreview,
  ]);

  const handleChange = (name: string, value: string) => {
    setPaymentError('');
    updateValue(name as keyof typeof values, value);
  };

  const handlePay = async () => {
    setPaymentError('');
    if (amountCents <= 0) {
      setPaymentError('Enter a valid payment amount');
      return;
    }

    if (convertedPreviewCents > invoice.remainingCents) {
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
      updateValue('paymentAmount', '');
    } catch (err) {
      const msg = getErrorMessage(err);
      setPaymentError(msg);
      setFieldError('paymentAmount', msg);
      showToast(msg, 'error');
    }
  };

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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" sx={{ width: '100%' }}>
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            <FormField
              field={fields[0]}
              value={values.paymentAmount}
              onChange={(value) => handleChange('paymentAmount', value)}
            />
          </Box>
          <FormField
            field={fields[1]}
            value={values.paymentCurrency}
            onChange={(value) => handleChange('paymentCurrency', value)}
          />
          <Button
            variant="contained"
            startIcon={<PaymentIcon />}
            onClick={handlePay}
            disabled={paying || !values.paymentAmount}
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
