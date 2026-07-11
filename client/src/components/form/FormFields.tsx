import { Stack } from '@mui/material';
import get from 'lodash/get.js';
import { FormField } from './FormField';
import type { FormFieldConfig, FormValues } from './types';

interface FormFieldsProps {
  fields: FormFieldConfig[];
  values: FormValues;
  errors?: Partial<Record<string, string>>;
  onChange: (name: string, value: string) => void;
  spacing?: number;
  direction?: 'column' | 'row';
}

export function FormFields({
  fields,
  values,
  errors = {},
  onChange,
  spacing = 2.5,
  direction = 'column',
}: FormFieldsProps) {
  return (
    <Stack spacing={spacing} direction={direction} sx={{ overflow: 'visible' }}>
      {fields.map((field) => (
        <FormField
          key={field.name}
          field={{
            ...field,
            error: get(errors, field.name) ?? field.error,
          }}
          value={get(values, field.name, '') as string}
          onChange={(value) => onChange(field.name, value)}
        />
      ))}
    </Stack>
  );
}
