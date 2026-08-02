import { describe, expect, it } from 'vitest';
import { formatINR, formatNumberIN, formatPercent, formatDate } from './format';

describe('formatINR', () => {
  it('formats with Indian comma grouping', () => {
    expect(formatINR(1234567)).toMatch(/12,34,567/);
  });
  it('rounds to whole rupees', () => {
    expect(formatINR(99.6)).toMatch(/100/);
  });
  it('returns em-dash for non-finite', () => {
    expect(formatINR(Number.NaN)).toBe('—');
    expect(formatINR(Infinity)).toBe('—');
  });
});

describe('formatNumberIN', () => {
  it('formats plain numbers with Indian grouping', () => {
    expect(formatNumberIN(1234567)).toBe('12,34,567');
  });
});

describe('formatPercent', () => {
  it('formats with two decimals by default', () => {
    expect(formatPercent(12.345)).toBe('12.35%');
  });
  it('returns em-dash for null/NaN', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('formatDate', () => {
  it('formats an ISO date', () => {
    expect(formatDate('2026-08-01')).toMatch(/2026/);
  });
  it('returns em-dash for invalid input', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });
});
