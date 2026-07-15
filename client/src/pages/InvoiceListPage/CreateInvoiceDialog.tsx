import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
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
  useExtractInvoiceFromDocumentMutation,
  useGetVendorsQuery,
} from '../../api';
import { useToast } from '../../components/ui/ToastProvider';
import { getErrorMessage } from '../../utils/errors';
import { tokens } from '../../theme/tokens';
import type { InvoiceExtractionDraft } from '../../types';

interface CreateInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
}

const INITIAL_VALUES: {
  vendorId: string;
  newVendorName: string;
  invoiceNumber: string;
  dueDate: string;
  description: string;
  quantity: string;
  unitPrice: string;
  currency: CurrencyCode;
} = {
  vendorId: '',
  newVendorName: '',
  invoiceNumber: '',
  dueDate: '',
  description: '',
  quantity: '1',
  unitPrice: '',
  currency: CURRENCY_CONFIG.DEFAULT_CURRENCY,
};

function aiHelper(field: string, draft: InvoiceExtractionDraft | null, base?: string): string | undefined {
  if (!draft?.available) return base;
  if (draft.aiFilledFields.includes(field)) {
    return base ? `${base} · AI-extracted — review before submit` : 'AI-extracted — review before submit';
  }
  if (draft.missingFields.includes(field)) {
    return base ? `${base} · Needs manual entry` : 'Needs manual entry';
  }
  return base;
}

export function CreateInvoiceDialog({ open, onClose }: CreateInvoiceDialogProps) {
  const { data: vendorsData, isLoading: vendorsLoading } = useGetVendorsQuery();
  const vendors = Array.isArray(vendorsData) ? vendorsData : [];
  const [createInvoice, { isLoading, error }] = useCreateInvoiceMutation();
  const [createVendor, { isLoading: creatingVendor }] = useCreateVendorMutation();
  const [extractInvoice, { isLoading: extracting }] = useExtractInvoiceFromDocumentMutation();
  const { showToast } = useToast();
  const [documentText, setDocumentText] = useState('');
  const [extractionDraft, setExtractionDraft] = useState<InvoiceExtractionDraft | null>(null);
  const [extractionError, setExtractionError] = useState('');
  const [extraLineItemsNote, setExtraLineItemsNote] = useState('');

  const { values, errors, updateValue, setFieldErrors, reset, getValue, setValues } =
    useFormState(INITIAL_VALUES);

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
        helperText: aiHelper(
          'vendorName',
          extractionDraft,
          !vendorsLoading && vendors.length === 0
            ? 'No vendors in the database yet. Enter a new vendor name below.'
            : undefined
        ),
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
        helperText: aiHelper(
          'vendorName',
          extractionDraft,
          'Creates a vendor and payable account on first invoice'
        ),
      },
      {
        type: 'text',
        name: 'invoiceNumber',
        label: 'Invoice Number',
        helperText: aiHelper('invoiceNumber', extractionDraft),
      },
      {
        type: 'date',
        name: 'dueDate',
        label: 'Due Date',
        inputLabelShrink: true,
        helperText: aiHelper('dueDate', extractionDraft),
      },
      {
        type: 'select',
        name: 'currency',
        label: 'Currency',
        options: CURRENCY_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        })),
        helperText: aiHelper('currency', extractionDraft),
      },
      {
        type: 'text',
        name: 'description',
        label: 'Line Item Description',
        helperText: aiHelper('lineItems', extractionDraft),
      },
      {
        type: 'number',
        name: 'quantity',
        label: 'Quantity',
        helperText: aiHelper('lineItems', extractionDraft),
      },
      {
        type: 'number',
        name: 'unitPrice',
        label: `Unit Price (${CURRENCY_SYMBOLS[currency]})`,
        helperText: aiHelper('lineItems', extractionDraft),
      },
    ];
  }, [extractionDraft, values.currency, vendorOptions, vendors, vendorsLoading]);

  const applyDraft = (draft: InvoiceExtractionDraft) => {
    const first = draft.lineItems.find(
      (item) => item.description && item.quantity && item.unitPriceCents !== null
    );
    setValues((prev) => ({
      ...prev,
      vendorId: draft.matchedVendorId ?? '',
      newVendorName: draft.matchedVendorId ? '' : draft.vendorName ?? '',
      invoiceNumber: draft.invoiceNumber ?? prev.invoiceNumber,
      dueDate: draft.dueDate ?? prev.dueDate,
      currency: draft.currency ?? prev.currency,
      description: first?.description ?? prev.description,
      quantity: first?.quantity ? String(first.quantity) : prev.quantity,
      unitPrice:
        first?.unitPriceCents !== null && first?.unitPriceCents !== undefined
          ? (first.unitPriceCents / 100).toFixed(2)
          : prev.unitPrice,
    }));

    const extras = draft.lineItems.slice(1).filter((item) => item.description);
    setExtraLineItemsNote(
      extras.length
        ? `AI found ${extras.length} additional line item(s) not shown in this form. Add them manually if needed: ${extras
            .map((item) => item.description)
            .join('; ')}`
        : ''
    );
  };

  const handleExtract = async () => {
    setExtractionError('');
    const text = documentText.trim();
    if (!text) {
      setExtractionError('Paste invoice text or upload a file first.');
      return;
    }
    try {
      const draft = await extractInvoice({ documentText: text }).unwrap();
      setExtractionDraft(draft);
      if (draft.available) {
        applyDraft(draft);
        showToast('Draft fields pre-filled from the document. Review before creating.', 'success');
      } else {
        showToast(draft.message, 'error');
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setExtractionError(message);
      setExtractionDraft(null);
      showToast(message, 'error');
    }
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setExtractionError('');
    try {
      if (file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        setDocumentText(text);
        const draft = await extractInvoice({ documentText: text }).unwrap();
        setExtractionDraft(draft);
        if (draft.available) {
          applyDraft(draft);
          showToast('Draft fields pre-filled from the file. Review before creating.', 'success');
        } else {
          showToast(draft.message, 'error');
        }
        return;
      }

      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/');
      if (!isPdf && !isImage) {
        setExtractionError('Supported uploads: plain text, PDF, or image files (PNG/JPEG/WebP).');
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const mimeType = isPdf ? 'application/pdf' : file.type || 'image/png';
      const draft = await extractInvoice({
        documentBase64: base64,
        mimeType,
      }).unwrap();
      setExtractionDraft(draft);
      if (draft.available) {
        applyDraft(draft);
        showToast(
          `Draft fields pre-filled from the ${isPdf ? 'PDF' : 'image'}. Review before creating.`,
          'success'
        );
      } else {
        showToast(draft.message, 'error');
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setExtractionError(message);
      setExtractionDraft(null);
      showToast(message, 'error');
    }
  };

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
      setDocumentText('');
      setExtractionDraft(null);
      setExtraLineItemsNote('');
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err) || 'Failed to create invoice.', 'error');
    }
  };

  const handleClose = () => {
    reset();
    setDocumentText('');
    setExtractionDraft(null);
    setExtractionError('');
    setExtraLineItemsNote('');
    onClose();
  };

  const isBusy = isLoading || creatingVendor || extracting;

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title="Create Invoice"
      description="Record a new vendor bill as a draft. Optionally extract fields from a document — a human still reviews and submits."
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
            {isBusy && !extracting ? 'Creating…' : 'Create Invoice'}
          </Button>
        </>
      }
    >
      <Box
        sx={{
          mb: 2.5,
          p: 2,
          border: `1px solid ${tokens.color.border}`,
          bgcolor: tokens.color.surfaceMuted,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <AutoAwesomeOutlinedIcon fontSize="small" sx={{ color: tokens.color.accent }} />
          <Typography variant="subtitle2">Extract from document (experimental)</Typography>
        </Stack>
        <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: tokens.color.inkMuted }}>
          Paste invoice text or upload a text, PDF, or image file. Extraction pre-fills the form only —
          nothing is saved until you click Create Invoice.
        </Typography>
        <TextField
          label="Paste invoice text"
          value={documentText}
          onChange={(event) => setDocumentText(event.target.value)}
          fullWidth
          multiline
          minRows={3}
          disabled={isBusy}
          sx={{ mb: 1.5 }}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="outlined"
            startIcon={<UploadFileOutlinedIcon />}
            component="label"
            disabled={isBusy}
          >
            Upload file
            <input
              hidden
              type="file"
              accept="text/plain,application/pdf,image/png,image/jpeg,image/webp,.txt,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleFile(file);
                event.target.value = '';
              }}
            />
          </Button>
          <Button
            variant="contained"
            startIcon={<AutoAwesomeOutlinedIcon />}
            onClick={() => void handleExtract()}
            disabled={isBusy || !documentText.trim()}
          >
            {extracting ? 'Extracting…' : 'Extract draft fields'}
          </Button>
        </Stack>
        {extractionError ? (
          <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 0 }}>
            {extractionError}
          </Alert>
        ) : null}
        {extractionDraft?.available ? (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {extractionDraft.message}
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {extractionDraft.aiFilledFields.map((field) => (
                <Chip
                  key={`ai-${field}`}
                  size="small"
                  label={`AI: ${field}`}
                  sx={{ borderRadius: 0, bgcolor: tokens.color.accentMuted, color: tokens.color.accent }}
                />
              ))}
              {extractionDraft.missingFields.map((field) => (
                <Chip
                  key={`miss-${field}`}
                  size="small"
                  label={`Needs entry: ${field}`}
                  sx={{ borderRadius: 0, bgcolor: tokens.color.warningMuted, color: tokens.color.warning }}
                />
              ))}
            </Stack>
          </Box>
        ) : null}
        {extraLineItemsNote ? (
          <Alert severity="info" sx={{ mt: 1.5, borderRadius: 0 }}>
            {extraLineItemsNote}
          </Alert>
        ) : null}
      </Box>

      <FormFields fields={fields} values={values} errors={errors} onChange={handleChange} />
    </AppDialog>
  );
}
