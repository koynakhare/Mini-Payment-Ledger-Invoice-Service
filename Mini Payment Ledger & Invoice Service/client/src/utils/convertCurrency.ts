import type { CurrencyCode } from '../constants/currency';
import { CURRENCY_CONFIG } from '../constants/currency';

export function convertCurrency(
  amountCents: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): number {
  if (fromCurrency === toCurrency) {
    return amountCents;
  }
  if (fromCurrency === 'USD' && toCurrency === 'INR') {
    return Math.round(amountCents * CURRENCY_CONFIG.USD_TO_INR);
  }
  if (fromCurrency === 'INR' && toCurrency === 'USD') {
    return Math.round(amountCents / CURRENCY_CONFIG.USD_TO_INR);
  }
  return amountCents;
}
