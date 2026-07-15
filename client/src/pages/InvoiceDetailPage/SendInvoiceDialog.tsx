import { useEffect, useMemo, useState } from 'react';
import isEmpty from 'lodash/isEmpty.js';
import trim from 'lodash/trim.js';
import { AppDialog, FormFields, useFormState, type FormFieldConfig } from '../../components/form';
import { useSendInvoiceMutation } from '../../api';
import { useToast } from '../../components/ui/ToastProvider';
import type { Invoice } from '../../types';
import { extractEmailFromContactInfo, isValidEmail } from '../../utils/email';
import { getErrorMessage } from '../../utils/errors';

interface SendInvoiceDialogProps {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
}

const INITIAL_VALUES = {
  vendorEmail: '',
};

export function SendInvoiceDialog({ open, invoice, onClose }: SendInvoiceDialogProps) {
  const [sendInvoice, { isLoading }] = useSendInvoiceMutation();
  const { showToast } = useToast();
  const { values, errors, updateValue, setFieldError, reset, getValue } = useFormState(INITIAL_VALUES);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!open || !invoice) return;
    reset();
    setSubmitError('');
    updateValue('vendorEmail', extractEmailFromContactInfo(invoice.vendor.contactInfo));
  }, [open, invoice, reset, updateValue]);

  const fields = useMemo<FormFieldConfig[]>(
    () => [
      {
        type: 'text',
        name: 'vendorEmail',
        label: 'Vendor Email',
        placeholder: 'billing@vendor.com',
        helperText: invoice
          ? `Invoice ${invoice.invoiceNumber} will be sent to this address for ${invoice.vendor.name}.`
          : undefined,
      },
    ],
    [invoice]
  );

  const handleClose = () => {
    reset();
    setSubmitError('');
    onClose();
  };

  const handleSend = async () => {
    if (!invoice) return;
    setSubmitError('');

    const vendorEmail = trim(getValue('vendorEmail'));
    if (isEmpty(vendorEmail)) {
      setFieldError('vendorEmail', 'Vendor email is required');
      return;
    }
    if (!isValidEmail(vendorEmail)) {
      setFieldError('vendorEmail', 'Enter a valid email address');
      return;
    }

    try {
      await sendInvoice({ invoiceId: invoice.id, vendorEmail }).unwrap();
      showToast(`Invoice emailed to ${vendorEmail} with PDF and posted to the ledger.`, 'success');
      handleClose();
    } catch (err) {
      const message = getErrorMessage(err);
      setSubmitError(message);
      showToast(message, 'error');
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title="Send Invoice"
      description="Enter the vendor's email before sending this invoice."
      error={submitError || undefined}
      confirmLabel="Send Invoice"
      confirmLoadingLabel="Sending"
      onConfirm={handleSend}
      confirmLoading={isLoading}
      confirmDisabled={!invoice}
    >
      <FormFields
        fields={fields}
        values={values}
        errors={errors}
        onChange={(name, value) => {
          setSubmitError('');
          updateValue(name as keyof typeof INITIAL_VALUES, value);
        }}
      />
    </AppDialog>
  );
}
