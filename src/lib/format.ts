const inrCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrNumber = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

export function formatINR(n: number): string {
  if (!isFinite(n)) return '—';
  return inrCurrency.format(Math.round(n));
}

export function formatNumberIN(n: number): string {
  if (!isFinite(n)) return '—';
  return inrNumber.format(Math.round(n));
}

export function formatPercent(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatDate(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
