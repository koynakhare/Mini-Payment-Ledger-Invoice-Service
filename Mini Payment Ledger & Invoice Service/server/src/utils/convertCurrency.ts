import { AppError } from '../errors/AppError.js';
import type { CurrencyCode } from '../config/currencyConfig.js';
import { CURRENCY_CONFIG } from '../config/currencyConfig.js';

export interface ExchangeRateConfig {
  USD_TO_INR: number;
}

export function assertSupportedCurrency(currency: string): CurrencyCode {
  if (!CURRENCY_CONFIG.SUPPORTED_CURRENCIES.includes(currency as CurrencyCode)) {
    throw new AppError('VALIDATION_ERROR', `Unsupported currency: ${currency}`);
  }
  return currency as CurrencyCode;
}

export function convertCurrency(
  amountCents: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rateConfig: ExchangeRateConfig = CURRENCY_CONFIG
): number {
  if (fromCurrency === toCurrency) {
    return amountCents;
  }

  if (amountCents <= 0) {
    throw new AppError('VALIDATION_ERROR', 'Amount must be positive');
  }

  if (fromCurrency === 'USD' && toCurrency === 'INR') {
    return Math.round(amountCents * rateConfig.USD_TO_INR);
  }

  if (fromCurrency === 'INR' && toCurrency === 'USD') {
    return Math.round(amountCents / rateConfig.USD_TO_INR);
  }

  throw new AppError('VALIDATION_ERROR', `Cannot convert from ${fromCurrency} to ${toCurrency}`);
}

export function resolveExchangeRateUsed(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rateConfig: ExchangeRateConfig = CURRENCY_CONFIG
): number | null {
  if (fromCurrency === toCurrency) {
    return null;
  }
  return rateConfig.USD_TO_INR;
}
