import { useMemo, useState } from 'react';
import { Typography } from '@mui/material';
import { AppDialog, FormFields, useFormState, type FormFieldConfig } from '../../components/form';
import { MoneyAmount } from '../../components/ui/MoneyAmount';
import { useToast } from '../../components/ui/ToastProvider';
import { useReversePaymentMutation } from '../../store/api';
import type { CurrencyCode, Payment, ReversalType } from '../../types';
import { generateIdempotencyKey } from '../../utils/format';
import { getErrorMessage } from '../../utils/errors';

interface ReversePaymentDialogProps {
  open: boolean;
  payment: Payment | null;
  invoiceCurrency: CurrencyCode;
  reversalType: ReversalType | null;
  onClose: () => void;
}

const INITIAL_VALUES = {
  reason: '',
};

export function ReversePaymentDialog({
  open,
  payment,
  invoiceCurrency,
  reversalType,
  onClose,
}: ReversePaymentDialogProps) {
  const [reversePayment, { isLoading: reversing }] = useReversePaymentMutation();
  const { showToast } = useToast();
  const { values, updateValue, reset } = useFormState(INITIAL_VALUES);
  const [error, setError] = useState('');

  const fields = useMemo<FormFieldConfig[]>(
    () => [
      {
        type: 'text',
        name: 'reason',
        label: 'Reason',
        multiline: true,
        rows: 2,
        helperText: 'Optional — for internal audit trail',
      },
    ],
    []
  );

  const handleClose = () => {
    reset();
    setError('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!payment || !reversalType) return;
    setError('');
    try {
      await reversePayment({
        paymentId: payment.id,
        reversalType,
        idempotencyKey: generateIdempotencyKey(reversalType),
        reason: values.reason || undefined,
      }).unwrap();
      showToast(reversalType === 'void' ? 'Payment voided.' : 'Refund processed.', 'success');
      handleClose();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      showToast(msg, 'error');
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title={reversalType === 'void' ? 'Void Payment' : 'Refund Payment'}
      description={
        <>
          <Typography variant="body2">
            {reversalType === 'void'
              ? 'Creates an internal correcting reversal. The original payment is preserved for audit.'
              : 'Creates a reversing double-entry transaction. The original payment is never deleted.'}
          </Typography>
          {payment ? (
            <Typography variant="body2">
              Amount:{' '}
              <MoneyAmount
                cents={payment.netAmountCents}
                currency={invoiceCurrency}
                component="span"
              />
            </Typography>
          ) : null}
        </>
      }
      error={error || undefined}
      confirmLabel="Confirm"
      confirmLoadingLabel="Processing"
      confirmColor={reversalType === 'void' ? 'warning' : 'primary'}
      onConfirm={handleConfirm}
      confirmLoading={reversing}
    >
      <FormFields
        fields={fields}
        values={values}
        onChange={(name, value) => updateValue(name as keyof typeof INITIAL_VALUES, value)}
        spacing={0}
      />
    </AppDialog>
  );
}
