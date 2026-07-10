import type { ReactNode } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { MoneyAmount } from './MoneyAmount';
import { tokens } from '../../theme/tokens';

import type { CurrencyCode } from '../../constants/currency';

interface StatCardProps {
  label: string;
  value?: string | number;
  moneyCents?: number;
  currency?: CurrencyCode;
  tone?: 'default' | 'success' | 'warning' | 'error' | 'accent' | 'primary';
  icon?: ReactNode;
  hint?: string;
}

const toneColors = {
  default: tokens.color.ink,
  success: tokens.color.success,
  warning: tokens.color.warning,
  error: tokens.color.error,
  accent: tokens.color.accent,
  primary: tokens.color.primary,
};

const toneBackgrounds = {
  default: tokens.color.surfaceMuted,
  success: tokens.color.successMuted,
  warning: tokens.color.warningMuted,
  error: tokens.color.errorMuted,
  accent: tokens.color.accentMuted,
  primary: tokens.color.primaryMuted,
};

export function StatCard({
  label,
  value,
  moneyCents,
  currency = 'USD',
  tone = 'default',
  icon,
  hint,
}: StatCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 0,
        transition: `transform ${tokens.transition.normal}, box-shadow ${tokens.transition.normal}`,
        '@media (prefers-reduced-motion: no-preference)': {
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: tokens.shadow.cardHover,
          },
        },
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <StackRow icon={icon} tone={tone} label={label} />
        {moneyCents !== undefined ? (
          <MoneyAmount
            cents={moneyCents}
            currency={currency}
            variant="h5"
            component="div"
            sx={{
              color: toneColors[tone],
              fontSize: '1.5rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          />
        ) : (
          <Typography
            variant="h5"
            sx={{
              fontFamily: tokens.font.mono,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              color: toneColors[tone],
              fontSize: '1.5rem',
              letterSpacing: '-0.02em',
            }}
          >
            {value ?? ''}
          </Typography>
        )}
        {hint ? (
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: tokens.color.inkMuted }}>
            {hint}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StackRow({
  icon,
  tone,
  label,
}: {
  icon?: ReactNode;
  tone: StatCardProps['tone'];
  label: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
      {icon ? (
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: toneBackgrounds[tone ?? 'default'],
            color: toneColors[tone ?? 'default'],
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      ) : null}
      <Typography variant="overline" sx={{ lineHeight: 1.3 }}>
        {label}
      </Typography>
    </Box>
  );
}
