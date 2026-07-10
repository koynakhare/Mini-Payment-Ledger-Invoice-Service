import type { FormFieldConfig } from './types';
import { FormSelectField } from './FormSelectField';
import { FormTextField } from './FormTextField';

interface FormFieldProps {
  field: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function FormField({ field, value, onChange }: FormFieldProps) {
  if (field.type === 'select') {
    return <FormSelectField field={field} value={value} onChange={onChange} />;
  }

  return <FormTextField field={field} value={value} onChange={onChange} />;
}
