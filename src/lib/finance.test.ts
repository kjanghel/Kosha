import { describe, expect, it } from 'vitest';
import {
  investmentMetrics,
  loanMetrics,
  validatePaymentSplit,
  xirr,
  type TxnRow,
} from './finance';

function txn(partial: Partial<TxnRow> & Pick<TxnRow, 'txn_type' | 'amount' | 'txn_date'>): TxnRow {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    account_id: partial.account_id ?? 'a1',
    principal_component: partial.principal_component ?? null,
    interest_component: partial.interest_component ?? null,
    created_at: partial.created_at ?? `${partial.txn_date}T00:00:00Z`,
    notes: partial.notes ?? null,
    ...partial,
  };
}

describe('xirr', () => {
  it('returns null for fewer than 2 flows', () => {
    expect(xirr([{ amount: -100, date: new Date('2026-01-01') }])).toBeNull();
  });

  it('returns null when all flows are the same sign', () => {
    expect(
      xirr([
        { amount: -100, date: new Date('2026-01-01') },
        { amount: -100, date: new Date('2026-06-01') },
      ]),
    ).toBeNull();
  });

  it('solves a doubling in one year → ~100% rate', () => {
    const rate = xirr([
      { amount: -100, date: new Date('2026-01-01') },
      { amount: 200, date: new Date('2027-01-01') },
    ]);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0.99);
    expect(rate!).toBeLessThan(1.01);
  });

  it('returns near-zero for break-even after one year', () => {
    const rate = xirr([
      { amount: -100, date: new Date('2026-01-01') },
      { amount: 100, date: new Date('2027-01-01') },
    ]);
    expect(rate).not.toBeNull();
    expect(Math.abs(rate!)).toBeLessThan(1e-3);
  });

  it('returns null when all flows fall within one day (span too tiny)', () => {
    const rate = xirr([
      { amount: -10000, date: new Date('2026-08-02T00:00:00Z') },
      { amount: 10500, date: new Date('2026-08-02T12:00:00Z') },
    ]);
    expect(rate).toBeNull();
  });

  it('does not diverge to absurd rates on short spans', () => {
    const rate = xirr([
      { amount: -10000, date: new Date('2026-08-02T00:00:00Z') },
      { amount: 10500, date: new Date('2026-08-10T00:00:00Z') },
    ]);
    // Whatever it returns, it must be inside a sane range.
    if (rate !== null) {
      expect(rate).toBeGreaterThan(-1);
      expect(rate).toBeLessThan(100);
    }
  });

  it('handles a realistic SIP-like stream', () => {
    const flows = [
      { amount: -10000, date: new Date('2025-01-01') },
      { amount: -10000, date: new Date('2025-07-01') },
      { amount: -10000, date: new Date('2026-01-01') },
      { amount: 33000, date: new Date('2026-08-01') },
    ];
    const rate = xirr(flows);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0.03);
    expect(rate!).toBeLessThan(0.3);
  });
});

describe('investmentMetrics', () => {
  it('computes total contributed/withdrawn and current value from latest valuation', () => {
    const txns: TxnRow[] = [
      txn({ txn_type: 'contribution', amount: 1000, txn_date: '2026-01-01' }),
      txn({ txn_type: 'contribution', amount: 500, txn_date: '2026-03-01' }),
      txn({ txn_type: 'withdrawal', amount: 200, txn_date: '2026-04-01' }),
      txn({ txn_type: 'valuation', amount: 1600, txn_date: '2026-07-01' }),
    ];
    const m = investmentMetrics(txns, new Date('2026-08-01'));
    expect(m.total_contributed).toBe(1500);
    expect(m.total_withdrawn).toBe(200);
    expect(m.net_invested).toBe(1300);
    expect(m.current_value).toBe(1600);
    expect(m.unrealized_pl).toBe(300);
    expect(m.return_pct).toBeCloseTo(20, 5);
  });

  it('falls back to net_invested when no valuation exists', () => {
    const txns: TxnRow[] = [
      txn({ txn_type: 'contribution', amount: 1000, txn_date: '2026-01-01' }),
    ];
    const m = investmentMetrics(txns);
    expect(m.current_value).toBe(1000);
    expect(m.unrealized_pl).toBe(0);
  });

  it('picks the most recent valuation by date then created_at', () => {
    const txns: TxnRow[] = [
      txn({ txn_type: 'contribution', amount: 1000, txn_date: '2026-01-01' }),
      txn({
        txn_type: 'valuation',
        amount: 1500,
        txn_date: '2026-06-01',
        created_at: '2026-06-01T10:00:00Z',
      }),
      txn({
        txn_type: 'valuation',
        amount: 1800,
        txn_date: '2026-06-01',
        created_at: '2026-06-01T18:00:00Z',
      }),
    ];
    const m = investmentMetrics(txns);
    expect(m.current_value).toBe(1800);
  });
});

describe('loanMetrics', () => {
  it('computes outstanding as disbursed minus principal paid', () => {
    const txns: TxnRow[] = [
      txn({ txn_type: 'disbursal', amount: 100000, txn_date: '2026-01-01' }),
      txn({
        txn_type: 'payment',
        amount: 12000,
        principal_component: 10000,
        interest_component: 2000,
        txn_date: '2026-02-01',
      }),
      txn({
        txn_type: 'payment',
        amount: 12000,
        principal_component: 10500,
        interest_component: 1500,
        txn_date: '2026-03-01',
      }),
    ];
    const m = loanMetrics(txns);
    expect(m.disbursed).toBe(100000);
    expect(m.principal_paid).toBe(20500);
    expect(m.interest_paid).toBe(3500);
    expect(m.total_paid).toBe(24000);
    expect(m.outstanding).toBe(79500);
    expect(m.progress_pct).toBeCloseTo(20.5, 5);
  });

  it('reports 0 for empty', () => {
    const m = loanMetrics([]);
    expect(m.disbursed).toBe(0);
    expect(m.outstanding).toBe(0);
    expect(m.progress_pct).toBe(0);
  });
});

describe('validatePaymentSplit', () => {
  it('accepts sums within tolerance', () => {
    expect(validatePaymentSplit(100, 60, 40)).toBe(true);
    expect(validatePaymentSplit(100, 60.005, 39.995)).toBe(true);
  });
  it('rejects sums outside tolerance', () => {
    expect(validatePaymentSplit(100, 60, 41)).toBe(false);
  });
});
