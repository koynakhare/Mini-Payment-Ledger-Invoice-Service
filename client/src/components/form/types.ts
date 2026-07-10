import type { ReactNode } from 'react';

export interface FieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface BaseFieldConfig {
  name: string;
  label: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export interface TextFieldConfig extends BaseFieldConfig {
  type: 'text' | 'number' | 'date';
  multiline?: boolean;
  rows?: number;
  inputLabelShrink?: boolean;
  autoFocus?: boolean;
}

export interface SelectFieldConfig extends BaseFieldConfig {
  type: 'select';
  options: FieldOption[];
  displayEmpty?: boolean;
  emptyLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  renderValue?: (selected: string, options: FieldOption[]) => ReactNode;
  minWidth?: number | string;
}

export type FormFieldConfig = TextFieldConfig | SelectFieldConfig;

export type FormValues = Record<string, string>;
