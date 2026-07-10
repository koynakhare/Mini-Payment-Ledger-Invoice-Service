import { TextField } from '@mui/material';
import get from 'lodash/get.js';
import type { TextFieldConfig } from './types';

interface FormTextFieldProps {
  field: TextFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function FormTextField({ field, value, onChange }: FormTextFieldProps) {
  return (
    <TextField
      label={field.label}
      type={field.type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      error={!!field.error}
      helperText={field.error ?? field.helperText}
      fullWidth={field.fullWidth ?? true}
      disabled={field.disabled}
      multiline={field.multiline}
      rows={field.rows}
      autoFocus={field.autoFocus}
      InputLabelProps={field.inputLabelShrink ? { shrink: true } : undefined}
    />
  );
}

export function getTextFieldValue(values: Record<string, string>, name: string): string {
  return get(values, name, '') as string;
}
