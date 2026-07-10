import { Box } from '@mui/material';
import startCase from 'lodash/startCase.js';
import type { InvoiceStatus } from '../../types';
import { statusTokens } from '../../theme/tokens';

export interface StatusBadgeProps {
  status: InvoiceStatus | string;
  size?: 'small' | 'medium';
}

export function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const key = status as InvoiceStatus;
  const token = statusTokens[key] ?? statusTokens.draft;
  const label = startCase(String(status).replace(/_/g, ' '));

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: size === 'small' ? 1.25 : 1.5,
        py: size === 'small' ? 0.375 : 0.5,
        borderRadius: 'pill',
        fontSize: size === 'small' ? '0.75rem' : '0.8125rem',
        fontWeight: 600,
        lineHeight: 1.4,
        color: token.color,
        backgroundColor: token.background,
        border: `1px solid ${token.border}`,
        transition: 'background-color 200ms ease, color 200ms ease, border-color 200ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  );
}
