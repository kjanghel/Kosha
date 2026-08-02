import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Plus, RefreshCw } from 'lucide-react';
import { AppShell, FAB, IconButton, PageHeader } from '../components/layout/AppShell';
import { Card, CardBody } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../lib/auth';
import { formatINR, formatPercent } from '../lib/format';
import {
  fetchAccounts,
  fetchAllTransactionsForAccounts,
  type Account,
} from '../lib/queries';
import {
  investmentMetrics,
  loanMetrics,
  portfolioCashflows,
  xirr,
  type TxnRow,
} from '../lib/finance';

interface AccountRollup {
  account: Account;
  currentValue: number;
  outstanding: number;
  netInvested: number;
  pl: number;
  returnPct: number | null;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const nav = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txnsByAccount, setTxnsByAccount] = useState<Record<string, TxnRow[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const accs = await fetchAccounts();
      setAccounts(accs);
      const txns = await fetchAllTransactionsForAccounts(accs.map((a) => a.id));
      const grouped: Record<string, TxnRow[]> = {};
      for (const t of txns) (grouped[t.account_id] ??= []).push(t);
      setTxnsByAccount(grouped);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Load failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    load();
  }, [load]);

  const {
    investmentsValue,
    investmentsCost,
    investmentsPL,
    investmentsReturn,
    loansOutstanding,
    loansInterestPaid,
    loansPrincipalPaid,
    netWorth,
    portfolioXirr,
    topGainer,
    topLoser,
    accountCount,
    trend,
  } = useMemo(() => summarize(accounts, txnsByAccount), [accounts, txnsByAccount]);

  const greeting = user?.email ? user.email.split('@')[0] : 'there';

  return (
    <AppShell>
      <PageHeader
        title={`Hi, ${greeting}`}
        subtitle="Your money at a glance"
        right={
          <IconButton label="Refresh" onClick={load}>
            <RefreshCw size={18} />
          </IconButton>
        }
      />

      <div className="px-4 space-y-4">
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Net worth</p>
            <p
              className={`text-3xl font-semibold mt-1 ${
                netWorth >= 0 ? 'text-slate-900' : 'text-red-600'
              }`}
            >
              {formatINR(netWorth)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Investments {formatINR(investmentsValue)} · Loans {formatINR(loansOutstanding)}
            </p>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardBody>
              <p className="text-xs text-slate-500">Investments</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatINR(investmentsValue)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Invested {formatINR(investmentsCost)}
              </p>
              <p
                className={`text-xs font-medium mt-1 ${
                  investmentsPL >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {investmentsPL >= 0 ? '+' : ''}
                {formatINR(investmentsPL)} · {formatPercent(investmentsReturn)}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs text-slate-500">Loans</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatINR(loansOutstanding)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Principal paid {formatINR(loansPrincipalPaid)}
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">
                Interest paid {formatINR(loansInterestPaid)}
              </p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Portfolio XIRR</p>
              <p className="text-xl font-semibold text-slate-900">
                {formatPercent(portfolioXirr)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-500">Accounts</p>
              <p className="text-lg font-semibold text-slate-900">{accountCount}</p>
            </div>
          </CardBody>
        </Card>

        {(topGainer || topLoser) && (
          <div className="grid grid-cols-2 gap-3">
            <TopCard label="Top gainer" rollup={topGainer} tone="up" />
            <TopCard label="Top loser" rollup={topLoser} tone="down" />
          </div>
        )}

        {trend.length > 1 && (
          <Card>
            <CardBody>
              <p className="text-xs text-slate-500 mb-2">Contributions vs value</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="valFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      minTickGap={30}
                    />
                    <YAxis hide />
                    <Tooltip
                      formatter={(v: number) => formatINR(Number(v))}
                      labelStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#4f46e5"
                      fill="url(#valFill)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="invested"
                      stroke="#94a3b8"
                      fill="transparent"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        )}

        {!loading && accounts.length === 0 && (
          <Card>
            <CardBody className="text-center py-8">
              <p className="text-sm text-slate-600 mb-2">
                Nothing here yet. Add your first account.
              </p>
              <Link
                to="/accounts/new"
                className="inline-block text-sm font-medium text-accent"
              >
                Create account →
              </Link>
            </CardBody>
          </Card>
        )}
      </div>

      <FAB label="New account" onClick={() => nav('/accounts/new')}>
        <Plus size={22} />
      </FAB>
    </AppShell>
  );
}

function TopCard({
  label,
  rollup,
  tone,
}: {
  label: string;
  rollup: AccountRollup | null;
  tone: 'up' | 'down';
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-slate-500">{label}</p>
        {rollup ? (
          <Link to={`/accounts/${rollup.account.id}`} className="block">
            <p className="text-sm font-medium text-slate-900 truncate mt-0.5">
              {rollup.account.name}
            </p>
            <p
              className={`text-xs font-medium mt-1 ${
                tone === 'up' ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {rollup.pl >= 0 ? '+' : ''}
              {formatINR(rollup.pl)} · {formatPercent(rollup.returnPct)}
            </p>
          </Link>
        ) : (
          <p className="text-sm text-slate-400 mt-1">—</p>
        )}
      </CardBody>
    </Card>
  );
}

function summarize(
  accounts: Account[],
  txnsByAccount: Record<string, TxnRow[]>,
) {
  const investments = accounts.filter((a) => a.kind === 'investment');
  const loans = accounts.filter((a) => a.kind === 'loan');

  let investmentsValue = 0;
  let investmentsCost = 0;
  const rollups: AccountRollup[] = [];
  const currentValuesByAccount: Record<string, number> = {};
  const allInvestmentTxns: TxnRow[] = [];

  for (const a of investments) {
    const t = txnsByAccount[a.id] ?? [];
    const m = investmentMetrics(t);
    investmentsValue += m.current_value;
    investmentsCost += m.net_invested;
    currentValuesByAccount[a.id] = m.current_value;
    for (const tt of t) allInvestmentTxns.push(tt);
    rollups.push({
      account: a,
      currentValue: m.current_value,
      outstanding: 0,
      netInvested: m.net_invested,
      pl: m.unrealized_pl,
      returnPct: m.return_pct,
    });
  }
  const investmentsPL = investmentsValue - investmentsCost;
  const investmentsReturn =
    investmentsCost > 0 ? (investmentsPL / investmentsCost) * 100 : null;

  let loansOutstanding = 0;
  let loansInterestPaid = 0;
  let loansPrincipalPaid = 0;
  for (const a of loans) {
    const t = txnsByAccount[a.id] ?? [];
    const m = loanMetrics(t);
    loansOutstanding += m.outstanding;
    loansInterestPaid += m.interest_paid;
    loansPrincipalPaid += m.principal_paid;
  }

  const netWorth = investmentsValue - loansOutstanding;

  const portfolioRate = xirr(
    portfolioCashflows(allInvestmentTxns, currentValuesByAccount),
  );
  const portfolioXirr = portfolioRate === null ? null : portfolioRate * 100;

  const sortedByPL = [...rollups].sort((a, b) => b.pl - a.pl);
  const topGainer = sortedByPL[0] && sortedByPL[0].pl > 0 ? sortedByPL[0] : null;
  const topLoser =
    sortedByPL[sortedByPL.length - 1] && sortedByPL[sortedByPL.length - 1].pl < 0
      ? sortedByPL[sortedByPL.length - 1]
      : null;

  const trend = buildTrend(allInvestmentTxns, investmentsValue);

  return {
    investmentsValue,
    investmentsCost,
    investmentsPL,
    investmentsReturn,
    loansOutstanding,
    loansInterestPaid,
    loansPrincipalPaid,
    netWorth,
    portfolioXirr,
    topGainer,
    topLoser,
    accountCount: accounts.length,
    trend,
  };
}

interface TrendPoint {
  date: string;
  invested: number;
  value: number;
}

function buildTrend(txns: TxnRow[], currentValue: number): TrendPoint[] {
  if (txns.length === 0) return [];
  const sorted = [...txns].sort((a, b) => (a.txn_date < b.txn_date ? -1 : 1));
  const points: TrendPoint[] = [];
  let invested = 0;
  let running = 0;
  let latestValuationDate: string | null = null;
  for (const t of sorted) {
    if (t.txn_type === 'contribution') {
      invested += t.amount;
      running += t.amount;
    } else if (t.txn_type === 'withdrawal') {
      invested -= t.amount;
      running -= t.amount;
    } else if (t.txn_type === 'valuation') {
      running = t.amount;
      latestValuationDate = t.txn_date;
    }
    points.push({ date: t.txn_date.slice(0, 7), invested, value: running });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (points.length && (latestValuationDate === null || latestValuationDate < today)) {
    points.push({ date: today.slice(0, 7), invested, value: currentValue });
  }
  return dedupeByMonth(points);
}

function dedupeByMonth(points: TrendPoint[]): TrendPoint[] {
  const byMonth = new Map<string, TrendPoint>();
  for (const p of points) byMonth.set(p.date, p);
  return [...byMonth.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
