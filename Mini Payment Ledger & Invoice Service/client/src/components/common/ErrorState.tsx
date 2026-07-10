import { Alert } from '@mui/material';
import { getErrorMessage } from '../../utils/errors';

export interface ErrorStateProps {
  message?: string;
  error?: unknown;
}

export function ErrorState({ message, error }: ErrorStateProps) {
  const text = message ?? (error ? getErrorMessage(error) : 'Something went wrong');
  return <Alert severity="error">{text}</Alert>;
}
