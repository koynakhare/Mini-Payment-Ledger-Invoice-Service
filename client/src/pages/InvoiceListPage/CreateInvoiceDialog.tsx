import { useMemo } from 'react';
import { Button } from '@mui/material';
import isEmpty from 'lodash/isEmpty.js';
import trim from 'lodash/trim.js';
import {
  CURRENCY_CONFIG,
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  type CurrencyCode,
} from '../../constants/currency';
import {
  AppDialog,
  FormFields,
  mapToFieldOptions,
  useFormState,
  type FormFieldConfig,
} from '../../components/form';
import {
  useCreateInvoiceMutation,
  useCreateVendorMutation,
  useGetVendorsQuery,
} from '../../api';
import { useToast } from '../../components/ui/ToastProvider';
import { getErrorMessage } from '../../utils/errors';

interface CreateInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
}

const INITIAL_VALUES = {
  vendorId: '',
  newVendorName: '',
  invoiceNumber: '',
  dueDate: '',
  description: '',
  quantity: '1',
  unitPrice: '',
  currency: CURRENCY_CONFIG.DEFAULT_CURRENCY,
};

export function CreateInvoiceDialog({ open, onClose }: CreateInvoiceDialogProps) {
  const { data: vendorsData, isLoading: vendorsLoading } = useGetVendorsQuery();
  const vendors = Array.isArray(vendorsData) ? vendorsData : [];
  const [createInvoice, { isLoading, error }] = useCreateInvoiceMutation();
  const [createVendor, { isLoading: creatingVendor }] = useCreateVendorMutation();
  const { showToast } = useToast();

  const { values, errors, updateValue, setFieldErrors, reset, getValue } = useFormState(INITIAL_VALUES);

  const vendorOptions = useMemo(
    () => mapToFieldOptions(vendors, (vendor) => vendor.id, (vendor) => vendor.name),
    [vendors]
  );

  const fields = useMemo<FormFieldConfig[]>(() => {
    const currency = values.currency as CurrencyCode;

    return [
      {
        type: 'select',
        name: 'vendorId',
        label: 'Vendor',
        displayEmpty: true,
        loading: vendorsLoading,
        loadingLabel: 'Loading vendors…',
        emptyLabel: 'No vendors yet — use the field below',
        options: vendorOptions,
        helperText:
          !vendorsLoading && vendors.length === 0
            ? 'No vendors in the database yet. Enter a new vendor name below.'
            : undefined,
        renderValue: (selected) => {
          if (!selected) {
            if (vendorsLoading) return 'Loading vendors…';
            if (vendors.length === 0) return 'No vendors yet';
            return 'Select a vendor';
          }
          return vendors.find((vendor) => vendor.id === selected)?.name ?? 'Select a vendor';
        },
      },
      {
        type: 'text',
        name: 'newVendorName',
        label: 'Or New Vendor Name',
        helperText: 'Creates a vendor and payable account on first invoice',
      },
      {
        type: 'text',
        name: 'invoiceNumber',
        label: 'Invoice Number',
      },
      {
        type: 'date',
        name: 'dueDate',
        label: 'Due Date',
        inputLabelShrink: true,
      },
      {
        type: 'select',
        name: 'currency',
        label: 'Currency',
        options: CURRENCY_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      },
      {
        type: 'text',
        name: 'description',
        label: 'Line Item Description',
      },
      {
        type: 'number',
        name: 'quantity',
        label: 'Quantity',
      },
      {
        type: 'number',
        name: 'unitPrice',
        label: `Unit Price (${CURRENCY_SYMBOLS[currency]})`,
      },
    ];
  }, [values.currency, vendorOptions, vendors, vendorsLoading]);

  const handleChange = (name: string, value: string) => {
    if (name === 'newVendorName' && value) {
      updateValue('vendorId', '');
    }
    if (name === 'vendorId' && value) {
      updateValue('newVendorName', '');
    }
    updateValue(name as keyof typeof INITIAL_VALUES, value);
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof typeof INITIAL_VALUES, string>> = {};
    if (!getValue('vendorId') && isEmpty(trim(getValue('newVendorName')))) {
      nextErrors.vendorId = 'Select a vendor or enter a new vendor name';
    }
    if (isEmpty(trim(getValue('invoiceNumber')))) {
      nextErrors.invoiceNumber = 'Invoice number is required';
    }
    if (!getValue('dueDate')) {
      nextErrors.dueDate = 'Due date is required';
    }
    if (isEmpty(trim(getValue('description')))) {
      nextErrors.description = 'Description is required';
    }
    const qty = parseInt(getValue('quantity'), 10);
    if (!qty || qty <= 0) {
      nextErrors.quantity = 'Enter a valid quantity';
    }
    const price = parseFloat(getValue('unitPrice'));
    if (isNaN(price) || price < 0) {
      nextErrors.unitPrice = 'Enter a valid unit price';
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resolveVendorId = async (): Promise<string> => {
    const vendorId = getValue('vendorId');
    if (vendorId) return vendorId;
    const created = await createVendor({ name: trim(getValue('newVendorName')) }).unwrap();
    return created.id;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const unitPriceCents = Math.round(parseFloat(getValue('unitPrice')) * 100);
    try {
      const resolvedVendorId = await resolveVendorId();
      await createInvoice({
        vendorId: resolvedVendorId,
        invoiceNumber: trim(getValue('invoiceNumber')),
        dueDate: getValue('dueDate'),
        currency: getValue('currency') as CurrencyCode,
        lineItems: [
          {
            description: trim(getValue('description')),
            quantity: parseInt(getValue('quantity'), 10),
            unitPriceCents,
          },
        ],
      }).unwrap();
      showToast('Invoice created successfully.', 'success');
      reset();
      onClose();
    } catch {
      showToast('Failed to create invoice.', 'error');
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isBusy = isLoading || creatingVendor;

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title="Create Invoice"
      description="Record a new vendor bill as a draft. A dedicated payable account is created automatically for new vendors."
      error={error ? getErrorMessage(error) : undefined}
      confirmLabel="Create Invoice"
      confirmLoadingLabel="Creating"
      onConfirm={handleSubmit}
      confirmDisabled={isBusy}
      confirmLoading={isBusy}
      actions={
        <>
          <Button onClick={handleClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={isBusy}>
            {isBusy ? 'Creating…' : 'Create Invoice'}
          </Button>
        </>
      }
    >
      <FormFields fields={fields} values={values} errors={errors} onChange={handleChange} />
    </AppDialog>
  );
}
