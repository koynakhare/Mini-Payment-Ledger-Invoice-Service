import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
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

export function ReversePaymentDialog({
  open,
  payment,
  invoiceCurrency,
  reversalType,
  onClose,
}: ReversePaymentDialogProps) {
  const [reversePayment, { isLoading: reversing }] = useReversePaymentMutation();
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleClose = () => {
    setReason('');
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
        reason: reason || undefined,
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {reversalType === 'void' ? 'Void Payment' : 'Refund Payment'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {reversalType === 'void'
            ? 'Creates an internal correcting reversal. The original payment is preserved for audit.'
            : 'Creates a reversing double-entry transaction. The original payment is never deleted.'}
        </Typography>
        {payment ? (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Amount:{' '}
            <MoneyAmount
              cents={payment.netAmountCents}
              currency={invoiceCurrency}
              component="span"
            />
          </Typography>
        ) : null}
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <TextField
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          multiline
          rows={2}
          helperText="Optional — for internal audit trail"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          color={reversalType === 'void' ? 'warning' : 'primary'}
          onClick={handleConfirm}
          disabled={reversing}
        >
          {reversing ? 'Processing…' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
