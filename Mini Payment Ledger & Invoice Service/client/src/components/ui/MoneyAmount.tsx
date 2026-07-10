import { Typography, type TypographyProps } from '@mui/material';
import type { CurrencyCode } from '../../constants/currency';
import { tokens } from '../../theme/tokens';
import { formatCents } from '../../utils/format';

interface MoneyAmountProps extends Omit<TypographyProps, 'children'> {
  cents: number;
  currency?: CurrencyCode;
  signed?: boolean;
  debit?: boolean;
}

export function MoneyAmount({
  cents,
  currency = 'USD',
  signed = false,
  debit = false,
  variant = 'body2',
  ...props
}: MoneyAmountProps) {
  const display =
    signed && debit
      ? formatCents(-Math.abs(cents), currency)
      : signed && !debit
        ? formatCents(Math.abs(cents), currency)
        : formatCents(cents, currency);

  return (
    <Typography
      variant={variant}
      component="span"
      sx={{
        fontFamily: tokens.font.mono,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 600,
        letterSpacing: '-0.02em',
        ...props.sx,
      }}
      {...props}
    >
      {display}
    </Typography>
  );
}
