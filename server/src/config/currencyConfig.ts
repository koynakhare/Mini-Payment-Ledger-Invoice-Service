export const CURRENCY_CONFIG = {
  USD_TO_INR: 95.39,
  DEFAULT_CURRENCY: 'USD',
  SUPPORTED_CURRENCIES: ['USD', 'INR'] as const,
} as const;

export type CurrencyCode = (typeof CURRENCY_CONFIG.SUPPORTED_CURRENCIES)[number];
