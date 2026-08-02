import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Plus,
  RefreshCw,
  Share2,
  MoreVertical,
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  Banknote,
  TrendingUp,
} from 'lucide-react';
import { AppShell, FAB, IconButton, PageHeader } from '../components/layout/AppShell';
import { Card, CardBody } from '../components/ui/Card';
import { Sheet } from '../components/ui/Sheet';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { TxnFormSheet } from '../components/account/TxnFormSheet';
import {
  fetchAccount,
  fetchTransactions,
  softDeleteAccount,
  softDeleteTransaction,
  type Account,
} from '../lib/queries';
import {
  investmentMetrics,
  loanMetrics,
  type TxnRow,
  type TxnType,
} from '../lib/finance';
import { formatDate, formatINR, formatPercent } from '../lib/format';

export function AccountDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { show } = useToast();

  const [account, setAccount] = useState<Account | null>(null);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [txnOpen, setTxnOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<TxnRow | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [a, t] = await Promise.all([fetchAccount(id), fetchTransactions(id)]);
      if (!a) {
        show('Account not found', 'error');
        nav('/accounts', { replace: true });
        return;
      }
      setAccount(a);
      setTxns(t);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, nav, show]);

  useEffect(() => {
    load();
  }, [load]);

  const isInvestment = account?.kind === 'investment';
  const inv = useMemo(
    () => (isInvestment ? investmentMetrics(txns) : null),
    [isInvestment, txns],
  );
  const loan = useMemo(
    () => (account?.kind === 'loan' ? loanMetrics(txns) : null),
    [account?.kind, txns],
  );

  if (loading || !account) {
    return (
      <AppShell>
        <PageHeader title="Loading…" />
      </AppShell>
    );
  }

  async function onDeleteAccount() {
    if (!account) return;
    if (!confirm('Delete this account? All its transactions will be hidden.')) return;
    try {
      await softDeleteAccount(account.id);
      show('Account deleted', 'success');
      nav('/accounts', { replace: true });
    } catch (e) {
      show(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  }

  async function onDeleteTxn(t: TxnRow) {
    if (!confirm('Delete this transaction?')) return;
    try {
      await softDeleteTransaction(t.id);
      show('Deleted', 'success');
      load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  }

  return (
    <AppShell>
      <PageHeader
        title={account.name}
        subtitle={account.category ?? (isInvestment ? 'Investment' : 'Loan')}
        right={
          <>
            <IconButton label="Back" onClick={() => nav('/accounts')}>
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton label="Refresh" onClick={load}>
              <RefreshCw size={18} />
            </IconButton>
            <IconButton label="Share" onClick={() => nav(`/accounts/${account.id}/share`)}>
              <Share2 size={18} />
            </IconButton>
            <IconButton label="More" onClick={() => setMoreOpen(true)}>
              <MoreVertical size={18} />
            </IconButton>
          </>
        }
      />

      <div className="px-4">
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500 mb-1">
              {isInvestment ? 'Current value' : 'Outstanding'}
            </p>
            <p className="text-3xl font-semibold text-slate-900">
              {formatINR(isInvestment ? inv!.current_value : loan!.outstanding)}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {isInvestment ? (
                <>
                  <Metric
                    label="P&L"
                    value={formatINR(inv!.unrealized_pl)}
                    tone={(inv!.unrealized_pl ?? 0) >= 0 ? 'up' : 'down'}
                  />
                  <Metric label="Return" value={formatPercent(inv!.return_pct)} />
                  <Metric label="XIRR" value={formatPercent(inv!.xirr)} />
                </>
              ) : (
                <>
                  <Metric label="Interest paid" value={formatINR(loan!.interest_paid)} />
                  <Metric label="Principal paid" value={formatINR(loan!.principal_paid)} />
                  <Metric
                    label="Progress"
                    value={formatPercent(loan!.progress_pct, 0)}
                  />
                </>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700">Transactions</h2>
          <p className="text-xs text-slate-500">{txns.length} total</p>
        </div>
        {txns.length === 0 ? (
          <Card>
            <CardBody className="py-8 text-center text-sm text-slate-500">
              No transactions yet. Add your first below.
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-2">
            {txns.map((t) => (
              <TxnRowView
                key={t.id}
                txn={t}
                onEdit={() => {
                  setEditingTxn(t);
                  setTxnOpen(true);
                }}
                onDelete={() => onDeleteTxn(t)}
              />
            ))}
          </div>
        )}
      </section>

      <FAB
        label="New transaction"
        onClick={() => {
          setEditingTxn(null);
          setTxnOpen(true);
        }}
      >
        <Plus size={22} />
      </FAB>

      <TxnFormSheet
        open={txnOpen}
        onClose={() => setTxnOpen(false)}
        onSaved={load}
        accountId={account.id}
        accountKind={account.kind}
        editing={editingTxn}
      />

      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Account options"
      >
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setMoreOpen(false);
              nav(`/accounts/${account.id}/edit`);
            }}
          >
            Edit details
          </Button>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              setMoreOpen(false);
              onDeleteAccount();
            }}
          >
            Delete account
          </Button>
        </div>
      </Sheet>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down';
}) {
  const color =
    tone === 'up' ? 'text-emerald-600' : tone === 'down' ? 'text-red-600' : 'text-slate-900';
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

const TYPE_LABEL: Record<TxnType, string> = {
  contribution: 'Contribution',
  withdrawal: 'Withdrawal',
  valuation: 'Valuation',
  disbursal: 'Disbursal',
  payment: 'Payment',
};

const TYPE_TONE: Record<TxnType, 'in' | 'out' | 'neutral'> = {
  contribution: 'in',
  disbursal: 'in',
  withdrawal: 'out',
  payment: 'out',
  valuation: 'neutral',
};

function typeIcon(type: TxnType) {
  const tone = TYPE_TONE[type];
  if (type === 'valuation') return <Gauge size={16} />;
  if (type === 'payment') return <Banknote size={16} />;
  if (type === 'disbursal') return <TrendingUp size={16} />;
  return tone === 'in' ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />;
}

function TxnRowView({
  txn,
  onEdit,
  onDelete,
}: {
  txn: TxnRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tone = TYPE_TONE[txn.txn_type];
  const toneClasses =
    tone === 'in'
      ? 'bg-emerald-50 text-emerald-600'
      : tone === 'out'
      ? 'bg-red-50 text-red-600'
      : 'bg-slate-100 text-slate-500';

  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <div
          className={`h-9 w-9 rounded-lg flex items-center justify-center ${toneClasses}`}
        >
          {typeIcon(txn.txn_type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">
            {TYPE_LABEL[txn.txn_type]}
          </p>
          <p className="text-xs text-slate-500">
            {formatDate(txn.txn_date)}
            {txn.notes ? ` · ${txn.notes}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">
            {formatINR(txn.amount)}
          </p>
          <div className="flex gap-2 justify-end mt-0.5">
            <button
              type="button"
              onClick={onEdit}
              className="text-[11px] text-slate-500 hover:text-slate-900"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-[11px] text-red-600 hover:text-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
