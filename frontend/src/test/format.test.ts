import { describe, expect, it } from 'vitest';

import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatRange,
  humanize,
  parseIsoDate,
} from '@/utils/format';

describe('formatting helpers', () => {
  it('formats currency with the configured locale', () => {
    const formatted = formatCurrency(124000);
    expect(formatted).toContain('1,24,000');
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(Number.NaN)).toBe('—');
  });

  it('formats compact currency for axis ticks', () => {
    expect(formatCompactCurrency(150000)).toMatch(/1\.5/);
  });

  it('formats numbers and percentages', () => {
    expect(formatNumber(1234567)).toBe('12,34,567');
    expect(formatPercent(24.56)).toBe('24.6%');
    expect(formatPercent(24.56, 2)).toBe('24.56%');
  });

  it('parses ISO dates without timezone drift', () => {
    const parsed = parseIsoDate('2024-01-31');
    expect(parsed?.getFullYear()).toBe(2024);
    expect(parsed?.getMonth()).toBe(0);
    expect(parsed?.getDate()).toBe(31);
    expect(formatDate('2024-01-31')).toContain('Jan');
    expect(formatDate(null)).toBe('—');
  });

  it('renders a date range and humanises identifiers', () => {
    expect(formatRange('2024-01-01', '2024-01-31')).toContain('→');
    expect(formatRange(null, null)).toBe('—');
    expect(humanize('average_transaction')).toBe('Average Transaction');
  });
});
