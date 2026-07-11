import { useMemo, useState } from 'react';
import isEmpty from 'lodash/isEmpty.js';
import trim from 'lodash/trim.js';
import { ACCOUNT_TYPE_OPTIONS, ACCOUNT_TYPES } from '../../constants';
import { AppDialog, FormFields, useFormState, type FormFieldConfig } from '../../components/form';
import { useCreateAccountMutation } from '../../api';
import { useToast } from '../../components/ui/ToastProvider';
import type { AccountType } from '../../types';
import { getErrorMessage } from '../../utils/errors';

interface CreateAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

const INITIAL_VALUES = {
  name: '',
  accountType: ACCOUNT_TYPES.VENDOR_PAYABLE,
};

export function CreateAccountDialog({ open, onClose }: CreateAccountDialogProps) {
  const [createAccount, { isLoading }] = useCreateAccountMutation();
  const { showToast } = useToast();
  const { values, errors, updateValue, setFieldError, reset, getValue } = useFormState(INITIAL_VALUES);
  const [submitError, setSubmitError] = useState('');

  const fields = useMemo<FormFieldConfig[]>(
    () => [
      {
        type: 'text',
        name: 'name',
        label: 'Account Name',
        autoFocus: true,
      },
      {
        type: 'select',
        name: 'accountType',
        label: 'Type',
        options: ACCOUNT_TYPE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      },
    ],
    []
  );

  const handleChange = (name: string, value: string) => {
    setSubmitError('');
    updateValue(name as keyof typeof INITIAL_VALUES, value);
  };

  const handleClose = () => {
    reset();
    setSubmitError('');
    onClose();
  };

  const handleSubmit = async () => {
    setSubmitError('');
    const trimmedName = trim(getValue('name'));
    if (isEmpty(trimmedName)) {
      setFieldError('name', 'Account name is required');
      return;
    }

    try {
      const result = await createAccount({
        name: trimmedName,
        accountType: getValue('accountType') as AccountType,
      }).unwrap();

      if (result.error) {
        setSubmitError(result.error);
        return;
      }

      showToast('Account created', 'success');
      reset();
      onClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const canSubmit = !isEmpty(trim(getValue('name')));

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title="Add Account"
      showCloseButton
      maxWidth="xs"
      error={submitError || undefined}
      confirmLabel="Create"
      confirmLoadingLabel="Creating"
      onConfirm={handleSubmit}
      confirmDisabled={isLoading || !canSubmit}
      confirmLoading={isLoading}
    >
      <FormFields fields={fields} values={values} errors={errors} onChange={handleChange} />
    </AppDialog>
  );
}
