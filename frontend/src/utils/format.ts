/** Locale-aware formatting helpers used across every page and chart. */

export const CURRENCY = import.meta.env.VITE_CURRENCY?.trim() || 'INR';
export const LOCALE = import.meta.env.VITE_LOCALE?.trim() || 'en-IN';

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const currencyPreciseFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Money as a whole unit: ₹1,24,000 */
export function formatCurrency(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return '—';
  return currencyFormatter.format(value);
}

/** Money with two decimals, used inside tables and tooltips. */
export function formatCurrencyPrecise(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return '—';
  return currencyPreciseFormatter.format(value);
}

/** Currency symbol exactly as Intl renders it for the configured currency. */
export const CURRENCY_SYMBOL =
  currencyFormatter.formatToParts(0).find((part) => part.type === 'currency')?.value ?? '';

const INDIAN_UNITS: Array<[number, string]> = [
  [1e7, 'Cr'],
  [1e5, 'L'],
  [1e3, 'K'],
];

const WESTERN_UNITS: Array<[number, string]> = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/**
 * Short money for axis ticks, e.g. ₹1.2L or $1.5M.
 *
 * Built by hand rather than with Intl's compact notation because en-IN mixes
 * scales in one axis (60,000 renders as "60T" next to "1.2L"), which is
 * ambiguous to read.
 */
export function formatCompactCurrency(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return '—';
  const absolute = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const units = CURRENCY === 'INR' ? INDIAN_UNITS : WESTERN_UNITS;

  for (const [size, suffix] of units) {
    if (absolute >= size) {
      const scaled = absolute / size;
      return `${sign}${CURRENCY_SYMBOL}${formatDecimal(scaled, scaled >= 100 ? 0 : 1)}${suffix}`;
    }
  }
  return `${sign}${CURRENCY_SYMBOL}${formatDecimal(absolute, 0)}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return '—';
  return numberFormatter.format(value);
}

export function formatDecimal(value: number | null | undefined, digits = 2): string {
  if (!isFiniteNumber(value)) return '—';
  if (digits === 2) return decimalFormatter.format(value);
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (!isFiniteNumber(value)) return '—';
  return `${formatDecimal(value, digits)}%`;
}

export function formatSignedCurrency(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return '—';
  const formatted = currencyFormatter.format(Math.abs(value));
  return value < 0 ? `−${formatted}` : `+${formatted}`;
}

/** Parse an ISO date (YYYY-MM-DD) in local time, avoiding UTC drift. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatDate(value: string | null | undefined): string {
  const date = parseIsoDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatShortDate(value: string | null | undefined): string {
  const date = parseIsoDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short' });
}

/** 2024-07 -> Jul 2024 (used when the backend already sends a label). */
export function formatMonth(value: string | null | undefined): string {
  if (!value) return '—';
  const [year, month] = value.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(LOCALE, { month: 'short', year: 'numeric' });
}

export function formatRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '—';
  return `${formatDate(start)} → ${formatDate(end)}`;
}

export function formatRatio(value: number | null | undefined, digits = 2): string {
  if (!isFiniteNumber(value)) return '—';
  return `${formatDecimal(value, digits)}×`;
}

/** Title-case a snake_case identifier for display. */
export function humanize(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
