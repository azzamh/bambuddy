import { describe, it, expect } from 'vitest';
import { formatCurrency, getCurrencySymbol, SUPPORTED_CURRENCIES } from '../../utils/currency';

describe('getCurrencySymbol', () => {
  it('returns $ for USD', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
  });

  it('returns € for EUR', () => {
    expect(getCurrencySymbol('EUR')).toBe('€');
  });

  it('returns £ for GBP', () => {
    expect(getCurrencySymbol('GBP')).toBe('£');
  });

  it('returns ₹ for INR', () => {
    expect(getCurrencySymbol('INR')).toBe('₹');
  });

  it('returns HK$ for HKD', () => {
    expect(getCurrencySymbol('HKD')).toBe('HK$');
  });

  it('returns RM for MYR', () => {
    expect(getCurrencySymbol('MYR')).toBe('RM');
  });

  it('returns ₴ for UAH', () => {
    expect(getCurrencySymbol('UAH')).toBe('₴');
  });

  it('returns the code itself for unknown currencies', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
  });

  it('is case-insensitive', () => {
    expect(getCurrencySymbol('usd')).toBe('$');
    expect(getCurrencySymbol('eur')).toBe('€');
  });
});

describe('SUPPORTED_CURRENCIES', () => {
  it('contains INR', () => {
    expect(SUPPORTED_CURRENCIES.find((c) => c.code === 'INR')).toBeDefined();
  });

  it('contains MYR', () => {
    expect(SUPPORTED_CURRENCIES.find((c) => c.code === 'MYR')).toBeDefined();
  });

  it('lists every supported currency', () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(30);
    expect(SUPPORTED_CURRENCIES).toContainEqual({ code: 'IDR', label: 'IDR (Rp)' });
  });
});

describe('formatCurrency', () => {
  it('uses two decimals and separators for a normal currency', () => {
    expect(formatCurrency(4665355.17, 'USD')).toBe('$4,665,355.17');
  });

  it('drops the meaningless decimals for rupiah', () => {
    // Nobody quotes fractions of a rupiah, and the totals run to eight digits
    expect(formatCurrency(4665355.17, 'IDR')).toBe('Rp\u00a04,665,355');
  });

  it('puts a space after word-like symbols but not after glyphs', () => {
    expect(formatCurrency(10, 'IDR')).toBe('Rp\u00a010');
    expect(formatCurrency(10, 'MYR')).toBe('RM\u00a010.00');
    expect(formatCurrency(10, 'EUR')).toBe('€10.00');
  });

  it('also drops decimals for the other currencies without a minor unit', () => {
    expect(formatCurrency(1500, 'JPY')).toBe('¥1,500');
    expect(formatCurrency(1500, 'KRW')).toBe('₩1,500');
  });

  it('defaults to USD when no currency is set', () => {
    expect(formatCurrency(5, null)).toBe('$5.00');
    expect(formatCurrency(5, undefined)).toBe('$5.00');
  });

  it('treats a missing or broken amount as zero', () => {
    expect(formatCurrency(null, 'USD')).toBe('$0.00');
    expect(formatCurrency(NaN, 'USD')).toBe('$0.00');
  });

  it('is case insensitive about the currency code', () => {
    expect(formatCurrency(10, 'idr')).toBe('Rp\u00a010');
  });
});
