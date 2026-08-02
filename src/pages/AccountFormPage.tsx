import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, TrendingUp, Banknote } from 'lucide-react';
import { AppShell, PageHeader } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../lib/auth';
import {
  createAccount,
  fetchAccount,
  updateAccount,
  type Account,
  type AccountKind,
} from '../lib/queries';
import { todayISO } from '../lib/format';

export function AccountFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const nav = useNavigate();
  const { user } = useAuth();
  const { show } = useToast();

  const [kind, setKind] = useState<AccountKind | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<Account | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState<string>(todayISO());
  const [notes, setNotes] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [originalPrincipal, setOriginalPrincipal] = useState('');
  const [tenureMonths, setTenureMonths] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchAccount(id).then((a) => {
      if (!a) {
        show('Account not found', 'error');
        nav('/accounts', { replace: true });
        return;
      }
      setExisting(a);
      setKind(a.kind);
      setName(a.name);
      setCategory(a.category ?? '');
      setStartDate(a.start_date ?? todayISO());
      setNotes(a.notes ?? '');
      setInterestRate(a.interest_rate?.toString() ?? '');
      setOriginalPrincipal(a.original_principal?.toString() ?? '');
      setTenureMonths(a.tenure_months?.toString() ?? '');
      setLoading(false);
    }).catch((e) => {
      show(e instanceof Error ? e.message : 'Failed to load', 'error');
      setLoading(false);
    });
  }, [id, nav, show]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !kind) return;
    if (!name.trim()) {
      show('Give the account a name', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        kind,
        name: name.trim(),
        category: category.trim() || null,
        start_date: startDate || null,
        notes: notes.trim() || null,
        interest_rate: kind === 'loan' && interestRate ? Number(interestRate) : null,
        original_principal:
          kind === 'loan' && originalPrincipal ? Number(originalPrincipal) : null,
        tenure_months: kind === 'loan' && tenureMonths ? Number(tenureMonths) : null,
      };
      if (isEdit && existing) {
        await updateAccount(existing.id, payload, user.id);
        show('Saved', 'success');
        nav(`/accounts/${existing.id}`, { replace: true });
      } else {
        const acc = await createAccount(payload, user.id);
        show('Account created', 'success');
        nav(`/accounts/${acc.id}`, { replace: true });
      }
    } catch (err) {
      show(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Loading…" />
      </AppShell>
    );
  }

  if (!kind && !isEdit) {
    return (
      <AppShell>
        <PageHeader
          title="New account"
          right={
            <button
              type="button"
              onClick={() => nav(-1)}
              className="text-sm text-slate-500"
            >
              Cancel
            </button>
          }
        />
        <div className="px-4 space-y-3">
          <p className="text-sm text-slate-500 mb-1">What are you tracking?</p>
          <button className="w-full" onClick={() => setKind('investment')}>
            <Card>
              <CardBody className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-slate-900">Investment</p>
                  <p className="text-xs text-slate-500">
                    Stocks, mutual funds, deposits, real estate…
                  </p>
                </div>
              </CardBody>
            </Card>
          </button>
          <button className="w-full" onClick={() => setKind('loan')}>
            <Card>
              <CardBody className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Banknote size={20} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-slate-900">Loan</p>
                  <p className="text-xs text-slate-500">
                    Home loan, personal loan, car loan…
                  </p>
                </div>
              </CardBody>
            </Card>
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={isEdit ? 'Edit account' : `New ${kind}`}
        right={
          <button
            type="button"
            onClick={() => nav(-1)}
            className="text-sm text-slate-500 flex items-center gap-0.5"
          >
            <ChevronLeft size={16} /> Back
          </button>
        }
      />
      <form onSubmit={onSubmit} className="px-4 space-y-3">
        <Card>
          <CardBody className="space-y-4">
            <Input
              label="Name"
              placeholder={kind === 'investment' ? 'e.g. Nifty 50 Index Fund' : 'e.g. Home Loan'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Category (optional)"
              placeholder={kind === 'investment' ? 'Stocks / Real Estate…' : 'Home / Personal / Car…'}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <Input
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            {kind === 'loan' && (
              <>
                <Input
                  label="Interest rate (%)"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                />
                <Input
                  label="Original principal (₹)"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={originalPrincipal}
                  onChange={(e) => setOriginalPrincipal(e.target.value)}
                />
                <Input
                  label="Tenure (months)"
                  type="number"
                  inputMode="numeric"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(e.target.value)}
                />
              </>
            )}
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering"
            />
          </CardBody>
        </Card>
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create account'}
        </Button>
      </form>
    </AppShell>
  );
}
