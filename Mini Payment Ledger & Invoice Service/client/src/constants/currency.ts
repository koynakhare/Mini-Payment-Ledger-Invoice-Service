export const CURRENCY_CONFIG = {
  USD_TO_INR: 83,
  DEFAULT_CURRENCY: 'USD',
} as const;

export const SUPPORTED_CURRENCIES = ['USD', 'INR'] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_OPTIONS: Array<{ value: CurrencyCode; label: string }> = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'INR', label: 'INR — Indian Rupee' },
];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  INR: '₹',
};
