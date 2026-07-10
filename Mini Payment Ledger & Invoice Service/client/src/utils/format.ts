import type { CurrencyCode } from '../constants/currency';
import { CURRENCY_CONFIG, CURRENCY_SYMBOLS } from '../constants/currency';
import type { Payment } from '../types';

export function formatCents(cents: number, currency: CurrencyCode = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const amount = Math.abs(cents) / 100;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function parseAmountToCents(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const parts = cleaned.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  const centsPart = (parts[1] || '00').padEnd(2, '0').slice(0, 2);
  const fractional = parseInt(centsPart, 10);
  return whole * 100 + fractional;
}

export function parseDollarsToCents(value: string): number {
  return parseAmountToCents(value);
}

export function formatPaymentDisplay(payment: Payment, invoiceCurrency: CurrencyCode): string {
  if (
    payment.originalCurrency === invoiceCurrency &&
    payment.originalAmountCents === payment.convertedAmountCents
  ) {
    return formatCents(payment.convertedAmountCents, invoiceCurrency);
  }

  const rate = payment.exchangeRateUsed ?? CURRENCY_CONFIG.USD_TO_INR;
  return `${formatCents(payment.originalAmountCents, payment.originalCurrency)} (≈ ${formatCents(
    payment.convertedAmountCents,
    invoiceCurrency
  )} at 1 USD = ${rate} INR)`;
}

export function generateIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
