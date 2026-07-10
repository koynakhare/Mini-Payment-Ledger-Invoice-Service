import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import isEmpty from 'lodash/isEmpty.js';
import trim from 'lodash/trim.js';
import { ACCOUNT_TYPE_OPTIONS, ACCOUNT_TYPES } from '../../constants';
import { useCreateAccountMutation } from '../../store/api';
import { useToast } from '../../components/ui/ToastProvider';
import type { AccountType } from '../../types';
import { getErrorMessage } from '../../utils/errors';

interface CreateAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateAccountDialog({ open, onClose }: CreateAccountDialogProps) {
  const [createAccount, { isLoading }] = useCreateAccountMutation();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>(ACCOUNT_TYPES.VENDOR_PAYABLE);
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setAccountType(ACCOUNT_TYPES.VENDOR_PAYABLE);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setError('');
    const trimmedName = trim(name);
    if (isEmpty(trimmedName)) {
      setError('Account name is required');
      return;
    }

    try {
      const result = await createAccount({
        name: trimmedName,
        accountType,
      }).unwrap();

      if (result.error) {
        setError(result.error);
        return;
      }

      showToast('Account created', 'success');
      resetForm();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const canSubmit = !isEmpty(trim(name));

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Add Account
        <IconButton
          aria-label="Close"
          onClick={handleClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label="Account Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            fullWidth
            autoFocus
          />
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={accountType}
              label="Type"
              onChange={(e) => setAccountType(e.target.value as AccountType)}
            >
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isLoading || !canSubmit}>
          {isLoading ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
