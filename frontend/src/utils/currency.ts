const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'Fr.',
  JPY: '¥',
  CNY: '¥',
  CAD: '$',
  AUD: '$',
  IDR: 'Rp',
  INR: '₹',
  HKD: 'HK$',
  KRW: '₩',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  BRL: 'R$',
  TWD: 'NT$',
  SGD: 'S$',
  NZD: 'NZ$',
  MXN: 'MX$',
  MYR: 'RM',
  CZK: 'Kč',
  THB: '฿',
  ZAR: 'R',
  TRY: '₺',
  RUB: '₽',
  HUF: 'Ft',
  ILS: '₪',
  UAH: '₴',
};

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode;
}

export const SUPPORTED_CURRENCIES = Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => ({
  code,
  label: `${code} (${symbol})`,
}));

// Currencies whose minor unit is not used in everyday prices. Rendering
// "Rp 139.999,97" for a spool would imply a precision that does not exist —
// nobody quotes fractions of a rupiah.
const ZERO_DECIMAL_CURRENCIES = new Set(['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF']);

/** Decimal places to show for a currency (0 for the ones without a minor unit). */
export function getCurrencyDecimals(currencyCode: string): number {
  return ZERO_DECIMAL_CURRENCIES.has((currencyCode || '').toUpperCase()) ? 0 : 2;
}

/**
 * Format a money amount for display: correct decimals for the currency, and
 * thousand separators so large values stay readable (a rupiah total runs to
 * seven or eight digits).
 *
 * Word-like symbols ("Rp", "RM", "kr") get a space; glyphs ("$", "€") do not.
 */
export function formatCurrency(amount: number | null | undefined, currencyCode: string | null | undefined): string {
  const code = (currencyCode || 'USD').toUpperCase();
  const symbol = getCurrencySymbol(code);
  const decimals = getCurrencyDecimals(code);
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;

  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const needsSpace = /[\p{L}.]$/u.test(symbol);
  return `${symbol}${needsSpace ? '\u00a0' : ''}${formatted}`;
}
