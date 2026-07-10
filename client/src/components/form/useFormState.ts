import { useCallback, useState } from 'react';
import get from 'lodash/get.js';
import type { FormValues } from './types';

export function useFormState<T extends FormValues>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const updateValue = useCallback((name: keyof T, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const setFieldError = useCallback((name: keyof T, message: string) => {
    setErrors((prev) => ({ ...prev, [name]: message }));
  }, []);

  const setFieldErrors = useCallback((nextErrors: Partial<Record<keyof T, string>>) => {
    setErrors(nextErrors);
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const getValue = useCallback((name: keyof T) => get(values, name, '') as string, [values]);

  const getError = useCallback((name: keyof T) => get(errors, name) as string | undefined, [errors]);

  return {
    values,
    errors,
    updateValue,
    setFieldError,
    setFieldErrors,
    reset,
    getValue,
    getError,
    setValues,
  };
}
