export interface Cashflow {
  amount: number;
  date: Date;
}

export type TxnType =
  | 'contribution'
  | 'withdrawal'
  | 'valuation'
  | 'disbursal'
  | 'payment';

export interface TxnRow {
  id: string;
  account_id: string;
  txn_type: TxnType;
  amount: number;
  principal_component: number | null;
  interest_component: number | null;
  txn_date: string;
  created_at: string;
  notes: string | null;
}

export interface InvestmentMetrics {
  total_contributed: number;
  total_withdrawn: number;
  net_invested: number;
  current_value: number;
  unrealized_pl: number;
  return_pct: number | null;
  xirr: number | null;
  first_date: string | null;
}

export interface LoanMetrics {
  disbursed: number;
  principal_paid: number;
  interest_paid: number;
  total_paid: number;
  outstanding: number;
  progress_pct: number;
}

const MS_PER_YEAR = 365 * 24 * 3600 * 1000;

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (24 * 3600 * 1000);
}

const XIRR_MAX_RATE = 100; // 10000% — anything higher is meaningless noise
const XIRR_MIN_RATE = -0.999;

/**
 * XIRR via Newton-Raphson. Cashflow sign convention: money out = negative, money in = positive.
 * Returns null when:
 * - fewer than 2 flows, or all same sign
 * - the cashflow span is under a day (solver diverges on tiny spans)
 * - the solver fails to converge or lands on a wildly out-of-range rate
 */
export function xirr(cashflows: Cashflow[]): number | null {
  if (cashflows.length < 2) return null;

  const signs = new Set<number>();
  for (const cf of cashflows) {
    if (cf.amount > 0) signs.add(1);
    else if (cf.amount < 0) signs.add(-1);
  }
  if (signs.size < 2) return null;

  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date;
  const spanYears =
    (sorted[sorted.length - 1].date.getTime() - t0.getTime()) / MS_PER_YEAR;

  // Under one day → any rate the solver produces is noise, not signal.
  if (spanYears < 1 / 365) return null;

  let rate = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0;
    let dNpv = 0;
    for (const cf of sorted) {
      const years = (cf.date.getTime() - t0.getTime()) / MS_PER_YEAR;
      const base = 1 + rate;
      if (base <= 0) return null;
      const factor = Math.pow(base, years);
      npv += cf.amount / factor;
      dNpv += (-years * cf.amount) / (factor * base);
    }
    if (Math.abs(npv) < 1e-6) {
      return rate > XIRR_MAX_RATE || rate < XIRR_MIN_RATE ? null : rate;
    }
    if (dNpv === 0) return null;
    let next = rate - npv / dNpv;
    if (!Number.isFinite(next)) return null;
    // Damp steps that would push the rate out of a sensible band.
    if (next > XIRR_MAX_RATE) next = (rate + XIRR_MAX_RATE) / 2;
    if (next < XIRR_MIN_RATE) next = (rate + XIRR_MIN_RATE) / 2;
    if (Math.abs(next - rate) < 1e-8) {
      return next > XIRR_MAX_RATE || next < XIRR_MIN_RATE ? null : next;
    }
    rate = next;
  }
  return null;
}

export function investmentCashflows(
  txns: TxnRow[],
  currentValue: number,
  asOf: Date = new Date(),
): Cashflow[] {
  const flows: Cashflow[] = [];
  for (const t of txns) {
    if (t.txn_type === 'contribution') {
      flows.push({ amount: -t.amount, date: new Date(t.txn_date) });
    } else if (t.txn_type === 'withdrawal') {
      flows.push({ amount: t.amount, date: new Date(t.txn_date) });
    }
  }
  if (currentValue > 0) {
    flows.push({ amount: currentValue, date: asOf });
  }
  return flows;
}

export function investmentMetrics(
  txns: TxnRow[],
  asOf: Date = new Date(),
): InvestmentMetrics {
  const contributions = txns.filter((t) => t.txn_type === 'contribution');
  const withdrawals = txns.filter((t) => t.txn_type === 'withdrawal');
  const valuations = txns.filter((t) => t.txn_type === 'valuation');

  const total_contributed = sum(contributions.map((t) => t.amount));
  const total_withdrawn = sum(withdrawals.map((t) => t.amount));
  const net_invested = total_contributed - total_withdrawn;

  const latestValuation = [...valuations].sort((a, b) => {
    if (a.txn_date !== b.txn_date) return a.txn_date < b.txn_date ? 1 : -1;
    return a.created_at < b.created_at ? 1 : -1;
  })[0];
  const current_value = latestValuation ? latestValuation.amount : net_invested;

  const unrealized_pl = current_value - net_invested;
  const return_pct =
    total_contributed > 0 ? (unrealized_pl / total_contributed) * 100 : null;

  const flows = investmentCashflows(txns, current_value, asOf);
  const rate = xirr(flows);
  const xirrPct = rate === null ? null : rate * 100;

  const first_date = [...txns]
    .filter((t) => t.txn_type === 'contribution')
    .map((t) => t.txn_date)
    .sort()[0] ?? null;

  return {
    total_contributed,
    total_withdrawn,
    net_invested,
    current_value,
    unrealized_pl,
    return_pct,
    xirr: xirrPct,
    first_date,
  };
}

export function loanMetrics(txns: TxnRow[]): LoanMetrics {
  const disbursals = txns.filter((t) => t.txn_type === 'disbursal');
  const payments = txns.filter((t) => t.txn_type === 'payment');

  const disbursed = sum(disbursals.map((t) => t.amount));
  const principal_paid = sum(payments.map((t) => t.principal_component ?? 0));
  const interest_paid = sum(payments.map((t) => t.interest_component ?? 0));
  const total_paid = sum(payments.map((t) => t.amount));
  const outstanding = Math.max(0, disbursed - principal_paid);
  const progress_pct = disbursed > 0 ? (principal_paid / disbursed) * 100 : 0;

  return {
    disbursed,
    principal_paid,
    interest_paid,
    total_paid,
    outstanding,
    progress_pct,
  };
}

export function portfolioCashflows(
  investmentTxns: TxnRow[],
  currentValuesByAccount: Record<string, number>,
  asOf: Date = new Date(),
): Cashflow[] {
  const flows: Cashflow[] = [];
  for (const t of investmentTxns) {
    if (t.txn_type === 'contribution') {
      flows.push({ amount: -t.amount, date: new Date(t.txn_date) });
    } else if (t.txn_type === 'withdrawal') {
      flows.push({ amount: t.amount, date: new Date(t.txn_date) });
    }
  }
  for (const v of Object.values(currentValuesByAccount)) {
    if (v > 0) flows.push({ amount: v, date: asOf });
  }
  return flows;
}

export function validatePaymentSplit(
  amount: number,
  principal: number,
  interest: number,
  tolerance = 0.01,
): boolean {
  return Math.abs(principal + interest - amount) < tolerance;
}

function sum(nums: number[]): number {
  let total = 0;
  for (const n of nums) total += n;
  return total;
}

export { daysBetween };
