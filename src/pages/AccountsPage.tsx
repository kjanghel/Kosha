import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, TrendingUp, Banknote } from 'lucide-react';
import { AppShell, FAB, IconButton, PageHeader } from '../components/layout/AppShell';
import { Card, CardBody } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import { formatINR, formatPercent } from '../lib/format';
import {
  fetchAccounts,
  fetchAllTransactionsForAccounts,
  type Account,
} from '../lib/queries';
import { investmentMetrics, loanMetrics, type TxnRow } from '../lib/finance';

type Filter = 'all' | 'investment' | 'loan';

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txnsByAccount, setTxnsByAccount] = useState<Record<string, TxnRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const { show } = useToast();
  const nav = useNavigate();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const accs = await fetchAccounts();
      setAccounts(accs);
      const txns = await fetchAllTransactionsForAccounts(accs.map((a) => a.id));
      const grouped: Record<string, TxnRow[]> = {};
      for (const t of txns) {
        (grouped[t.account_id] ??= []).push(t);
      }
      setTxnsByAccount(grouped);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed to load accounts', 'error');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () => (filter === 'all' ? accounts : accounts.filter((a) => a.kind === filter)),
    [accounts, filter],
  );

  return (
    <AppShell>
      <PageHeader
        title="Accounts"
        right={
          <IconButton label="Refresh" onClick={load}>
            <RefreshCw size={18} />
          </IconButton>
        }
      />

      <div className="px-4 flex gap-2 mb-3">
        {(['all', 'investment', 'loan'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 h-8 rounded-full text-xs font-medium capitalize transition ${
              filter === f
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'investment' ? 'Investments' : 'Loans'}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500 py-8 text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          filtered.map((a) => (
            <AccountRow key={a.id} account={a} txns={txnsByAccount[a.id] ?? []} />
          ))
        )}
      </div>

      <FAB label="New account" onClick={() => nav('/accounts/new')}>
        <Plus size={22} />
      </FAB>
    </AppShell>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  return (
    <Card>
      <CardBody className="py-10 text-center">
        <p className="text-sm text-slate-500">
          No {filter === 'all' ? 'accounts' : filter === 'investment' ? 'investments' : 'loans'} yet.
        </p>
        <Link
          to="/accounts/new"
          className="inline-block mt-3 text-sm font-medium text-accent"
        >
          Create your first account →
        </Link>
      </CardBody>
    </Card>
  );
}

function AccountRow({ account, txns }: { account: Account; txns: TxnRow[] }) {
  const isInvestment = account.kind === 'investment';
  const inv = isInvestment ? investmentMetrics(txns) : null;
  const loan = !isInvestment ? loanMetrics(txns) : null;

  return (
    <Link to={`/accounts/${account.id}`} className="block">
      <Card>
        <CardBody className="flex items-center gap-3">
          <div
            className={`h-11 w-11 rounded-xl flex items-center justify-center ${
              isInvestment ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            {isInvestment ? <TrendingUp size={20} /> : <Banknote size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-900 truncate">{account.name}</p>
            <p className="text-xs text-slate-500 truncate">
              {account.category ?? (isInvestment ? 'Investment' : 'Loan')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">
              {formatINR(isInvestment ? inv!.current_value : loan!.outstanding)}
            </p>
            <p
              className={`text-[11px] ${
                isInvestment
                  ? (inv!.unrealized_pl ?? 0) >= 0
                    ? 'text-emerald-600'
                    : 'text-red-600'
                  : 'text-slate-500'
              }`}
            >
              {isInvestment
                ? `${(inv!.unrealized_pl ?? 0) >= 0 ? '+' : ''}${formatPercent(inv!.return_pct)}`
                : `${formatPercent(loan!.progress_pct, 0)} paid`}
            </p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
