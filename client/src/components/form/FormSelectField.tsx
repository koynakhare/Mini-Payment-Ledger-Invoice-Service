import { FormControl, FormHelperText, InputLabel, MenuItem, Select } from '@mui/material';
import isEmpty from 'lodash/isEmpty.js';
import type { FieldOption, SelectFieldConfig } from './types';

interface FormSelectFieldProps {
  field: SelectFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function FormSelectField({ field, value, onChange }: FormSelectFieldProps) {
  const options = field.options ?? [];
  const showEmptyState = !field.loading && isEmpty(options);
  const helperText = field.error ?? field.helperText;
  const shouldShrinkLabel = !!field.displayEmpty || !!value;

  return (
    <FormControl
      fullWidth={field.fullWidth ?? true}
      error={!!field.error}
      disabled={field.disabled}
      sx={field.minWidth ? { minWidth: field.minWidth } : undefined}
    >
      <InputLabel shrink={shouldShrinkLabel}>{field.label}</InputLabel>
      <Select
        value={value}
        label={field.label}
        displayEmpty={field.displayEmpty}
        onChange={(event) => onChange(event.target.value)}
        renderValue={
          field.renderValue
            ? (selected) => field.renderValue?.(selected, options)
            : undefined
        }
        sx={
          field.displayEmpty && !value
            ? {
                '& .MuiSelect-select': {
                  color: 'text.secondary',
                },
              }
            : undefined
        }
      >
        {field.loading ? (
          <MenuItem value="" disabled>
            {field.loadingLabel ?? 'Loading…'}
          </MenuItem>
        ) : showEmptyState ? (
          <MenuItem value="" disabled>
            {field.emptyLabel ?? 'No options available'}
          </MenuItem>
        ) : (
          options.map((option) => (
            <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </MenuItem>
          ))
        )}
      </Select>
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}

export function mapToFieldOptions<T>(
  items: T[] | undefined,
  getValue: (item: T) => string,
  getLabel: (item: T) => string
): FieldOption[] {
  return (items ?? []).map((item) => ({
    value: getValue(item),
    label: getLabel(item),
  }));
}
