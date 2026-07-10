import type { ReactNode } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Breakpoint } from '@mui/material/styles';

interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  error?: string;
  maxWidth?: Breakpoint | false;
  fullWidth?: boolean;
  showCloseButton?: boolean;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  confirmLoadingLabel?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  actions?: ReactNode;
  disableBackdropClose?: boolean;
}

export function AppDialog({
  open,
  onClose,
  title,
  description,
  children,
  error,
  maxWidth = 'sm',
  fullWidth = true,
  showCloseButton = false,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  onConfirm,
  confirmDisabled = false,
  confirmLoading = false,
  confirmLoadingLabel,
  confirmColor = 'primary',
  actions,
  disableBackdropClose = false,
}: AppDialogProps) {
  const handleClose = () => {
    if (confirmLoading) return;
    onClose();
  };

  const defaultActions = (
    <>
      <Button onClick={handleClose} disabled={confirmLoading}>
        {cancelLabel}
      </Button>
      {onConfirm ? (
        <Button
          variant="contained"
          color={confirmColor}
          onClick={onConfirm}
          disabled={confirmDisabled || confirmLoading}
        >
          {confirmLoading ? (confirmLoadingLabel ?? `${confirmLabel}…`) : confirmLabel}
        </Button>
      ) : null}
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={disableBackdropClose ? undefined : handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
    >
      <DialogTitle sx={{ pr: showCloseButton ? 6 : undefined }}>
        {title}
        {showCloseButton ? (
          <IconButton
            aria-label="Close"
            onClick={handleClose}
            sx={{ position: 'absolute', right: 12, top: 12 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : null}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          {description ? (
            typeof description === 'string' ? (
              <Typography variant="body2">{description}</Typography>
            ) : (
              description
            )
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {children}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>{actions ?? defaultActions}</DialogActions>
    </Dialog>
  );
}
