import { useEffect, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../lib/auth';
import {
  createTransaction,
  updateTransaction,
  type CreateTxnInput,
} from '../../lib/queries';
import { validatePaymentSplit, type TxnRow, type TxnType } from '../../lib/finance';
import { todayISO } from '../../lib/format';
import type { AccountKind } from '../../lib/queries';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  accountId: string;
  accountKind: AccountKind;
  editing?: TxnRow | null;
}

const INVESTMENT_TYPES: { value: TxnType; label: string }[] = [
  { value: 'contribution', label: 'Contribution' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'valuation', label: 'Valuation' },
];

const LOAN_TYPES: { value: TxnType; label: string }[] = [
  { value: 'payment', label: 'Payment' },
  { value: 'disbursal', label: 'Disbursal' },
];

export function TxnFormSheet({
  open,
  onClose,
  onSaved,
  accountId,
  accountKind,
  editing,
}: Props) {
  const { user } = useAuth();
  const { show } = useToast();

  const types = accountKind === 'investment' ? INVESTMENT_TYPES : LOAN_TYPES;

  const [txnType, setTxnType] = useState<TxnType>(types[0].value);
  const [amount, setAmount] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTxnType(editing.txn_type);
      setAmount(editing.amount.toString());
      setPrincipal(editing.principal_component?.toString() ?? '');
      setInterest(editing.interest_component?.toString() ?? '');
      setDate(editing.txn_date);
      setNotes(editing.notes ?? '');
    } else {
      setTxnType(types[0].value);
      setAmount('');
      setPrincipal('');
      setInterest('');
      setDate(todayISO());
      setNotes('');
    }
    setSplitError(null);
    // Intentionally excluding `types` to avoid resetting mid-edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const amt = Number(amount);
    if (!isFinite(amt) || amt <= 0) {
      show('Enter a positive amount', 'error');
      return;
    }

    let principalNum: number | null = null;
    let interestNum: number | null = null;
    if (txnType === 'payment') {
      const hasPrincipal = principal !== '';
      const hasInterest = interest !== '';
      if (!hasPrincipal && !hasInterest) {
        principalNum = amt;
        interestNum = 0;
        show('No split provided — recorded as all principal', 'info');
      } else {
        principalNum = Number(principal || 0);
        interestNum = Number(interest || 0);
        if (!validatePaymentSplit(amt, principalNum, interestNum)) {
          setSplitError('Principal + interest must equal the amount');
          return;
        }
      }
    }

    const input: CreateTxnInput = {
      account_id: accountId,
      txn_type: txnType,
      amount: amt,
      principal_component: principalNum,
      interest_component: interestNum,
      txn_date: date,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateTransaction(editing.id, input, user.id);
      } else {
        await createTransaction(input, user.id);
      }
      show(editing ? 'Transaction updated' : 'Transaction added', 'success');
      onSaved();
      onClose();
    } catch (err) {
      show(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit transaction' : 'New transaction'}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setTxnType(t.value)}
              className={`px-3 h-9 rounded-full text-xs font-medium transition ${
                txnType === t.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Input
          label="Amount (₹)"
          type="number"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        {txnType === 'payment' && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Principal"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={principal}
              onChange={(e) => {
                setPrincipal(e.target.value);
                setSplitError(null);
              }}
            />
            <Input
              label="Interest"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={interest}
              onChange={(e) => {
                setInterest(e.target.value);
                setSplitError(null);
              }}
              error={splitError}
            />
          </div>
        )}

        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}
        </Button>
      </form>
    </Sheet>
  );
}
