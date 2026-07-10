import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import isEmpty from 'lodash/isEmpty.js';
import trim from 'lodash/trim.js';
import {
  CURRENCY_CONFIG,
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  type CurrencyCode,
} from '../../constants/currency';
import {
  useCreateInvoiceMutation,
  useCreateVendorMutation,
  useGetVendorsQuery,
} from '../../store/api';
import { useToast } from '../../components/ui/ToastProvider';
import { getErrorMessage } from '../../utils/errors';

interface CreateInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateInvoiceDialog({ open, onClose }: CreateInvoiceDialogProps) {
  const { data: vendors } = useGetVendorsQuery();
  const [createInvoice, { isLoading, error }] = useCreateInvoiceMutation();
  const [createVendor, { isLoading: creatingVendor }] = useCreateVendorMutation();
  const { showToast } = useToast();

  const [vendorId, setVendorId] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(CURRENCY_CONFIG.DEFAULT_CURRENCY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setVendorId('');
    setNewVendorName('');
    setInvoiceNumber('');
    setDueDate('');
    setDescription('');
    setQuantity('1');
    setUnitPrice('');
    setCurrency(CURRENCY_CONFIG.DEFAULT_CURRENCY);
    setFieldErrors({});
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!vendorId && isEmpty(trim(newVendorName))) {
      errors.vendorId = 'Select a vendor or enter a new vendor name';
    }
    if (isEmpty(trim(invoiceNumber))) errors.invoiceNumber = 'Invoice number is required';
    if (!dueDate) errors.dueDate = 'Due date is required';
    if (isEmpty(trim(description))) errors.description = 'Description is required';
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) errors.quantity = 'Enter a valid quantity';
    const price = parseFloat(unitPrice);
    if (isNaN(price) || price < 0) errors.unitPrice = 'Enter a valid unit price';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resolveVendorId = async (): Promise<string> => {
    if (vendorId) return vendorId;
    const created = await createVendor({ name: trim(newVendorName) }).unwrap();
    return created.id;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const unitPriceCents = Math.round(parseFloat(unitPrice) * 100);
    try {
      const resolvedVendorId = await resolveVendorId();
      await createInvoice({
        vendorId: resolvedVendorId,
        invoiceNumber: trim(invoiceNumber),
        dueDate,
        currency,
        lineItems: [
          {
            description: trim(description),
            quantity: parseInt(quantity, 10),
            unitPriceCents,
          },
        ],
      }).unwrap();
      showToast('Invoice created successfully.', 'success');
      resetForm();
      onClose();
    } catch {
      showToast('Failed to create invoice.', 'error');
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isBusy = isLoading || creatingVendor;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Invoice</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2.5 }}>
          Record a new vendor bill as a draft. A dedicated payable account is created automatically for new vendors.
        </Typography>
        <Stack spacing={2.5}>
          {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

          <FormControl fullWidth error={!!fieldErrors.vendorId}>
            <InputLabel>Vendor</InputLabel>
            <Select
              value={vendorId}
              label="Vendor"
              onChange={(e) => {
                setVendorId(e.target.value);
                setNewVendorName('');
              }}
            >
              {(vendors ?? []).map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  {v.name}
                </MenuItem>
              ))}
            </Select>
            {fieldErrors.vendorId ? (
              <FormHelperText>{fieldErrors.vendorId}</FormHelperText>
            ) : null}
          </FormControl>

          <TextField
            label="Or New Vendor Name"
            value={newVendorName}
            onChange={(e) => {
              setNewVendorName(e.target.value);
              if (e.target.value) setVendorId('');
            }}
            helperText="Creates a vendor and payable account on first invoice"
            fullWidth
          />

          <TextField
            label="Invoice Number"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            error={!!fieldErrors.invoiceNumber}
            helperText={fieldErrors.invoiceNumber}
            fullWidth
          />

          <TextField
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            error={!!fieldErrors.dueDate}
            helperText={fieldErrors.dueDate}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Currency</InputLabel>
            <Select
              value={currency}
              label="Currency"
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            >
              {CURRENCY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Line Item Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={!!fieldErrors.description}
            helperText={fieldErrors.description}
            fullWidth
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              error={!!fieldErrors.quantity}
              helperText={fieldErrors.quantity}
              fullWidth
            />
            <TextField
              label={`Unit Price (${CURRENCY_SYMBOLS[currency]})`}
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              error={!!fieldErrors.unitPrice}
              helperText={fieldErrors.unitPrice}
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isBusy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isBusy}>
          {isBusy ? 'Creating…' : 'Create Invoice'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
