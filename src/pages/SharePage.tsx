import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, RefreshCw, Trash2, X } from 'lucide-react';
import { AppShell, IconButton, PageHeader } from '../components/layout/AppShell';
import { Card, CardBody } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../lib/auth';
import {
  cancelInvite,
  createInvite,
  fetchAccount,
  fetchAccountInvites,
  fetchAccountMembers,
  removeAccountMember,
  type Account,
  type AccountInvite,
  type AccountMember,
} from '../lib/queries';
import { formatDate } from '../lib/format';

export function SharePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { show } = useToast();

  const [account, setAccount] = useState<Account | null>(null);
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [invites, setInvites] = useState<AccountInvite[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [a, m, i] = await Promise.all([
        fetchAccount(id),
        fetchAccountMembers(id),
        fetchAccountInvites(id),
      ]);
      if (!a) {
        show('Account not found', 'error');
        nav('/accounts', { replace: true });
        return;
      }
      setAccount(a);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Load failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, nav, show]);

  useEffect(() => {
    load();
  }, [load]);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !user) return;
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      show('Enter a valid email', 'error');
      return;
    }
    setInviting(true);
    try {
      await createInvite(id, clean, user.id);
      show('Invite sent', 'success');
      setEmail('');
      load();
    } catch (err) {
      show(err instanceof Error ? err.message : 'Invite failed', 'error');
    } finally {
      setInviting(false);
    }
  }

  async function onCancel(inviteId: string) {
    try {
      await cancelInvite(inviteId);
      show('Invite cancelled', 'success');
      load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Cancel failed', 'error');
    }
  }

  async function onRemoveMember(m: AccountMember) {
    if (m.role === 'owner') return;
    if (!confirm(`Remove ${m.email ?? 'this member'} from ${account?.name}?`)) return;
    try {
      await removeAccountMember(m.account_id, m.user_id);
      show('Member removed', 'success');
      load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Remove failed', 'error');
    }
  }

  const owner = members.find((m) => m.role === 'owner');
  const isOwner = owner?.user_id === user?.id;

  if (loading || !account) {
    return (
      <AppShell>
        <PageHeader title="Loading…" />
      </AppShell>
    );
  }

  const pending = invites.filter((i) => i.status === 'pending');

  return (
    <AppShell>
      <PageHeader
        title="Share account"
        subtitle={account.name}
        right={
          <>
            <IconButton label="Back" onClick={() => nav(-1)}>
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton label="Refresh" onClick={load}>
              <RefreshCw size={18} />
            </IconButton>
          </>
        }
      />

      {isOwner && (
        <div className="px-4">
          <Card>
            <CardBody>
              <form onSubmit={onInvite} className="space-y-3">
                <Input
                  label="Invite by email"
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  hint="They'll get editor access once they sign in with this email."
                />
                <Button type="submit" className="w-full" disabled={inviting}>
                  {inviting ? 'Sending…' : 'Send invite'}
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      )}

      <section className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Members</h2>
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.user_id}>
              <CardBody className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold uppercase">
                  {(m.email ?? m.display_name ?? 'U').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {m.display_name || m.email || m.user_id}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">{m.role}</p>
                </div>
                {isOwner && m.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => onRemoveMember(m)}
                    className="p-2 text-slate-400 hover:text-red-600"
                    aria-label="Remove member"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {pending.length > 0 && (
        <section className="px-4 mt-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Pending invites</h2>
          <div className="space-y-2">
            {pending.map((i) => (
              <Card key={i.id}>
                <CardBody className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {i.invited_email}
                    </p>
                    <p className="text-xs text-slate-500">
                      Invited {formatDate(i.created_at)}
                    </p>
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => onCancel(i.id)}
                      className="p-2 text-slate-400 hover:text-red-600"
                      aria-label="Cancel invite"
                    >
                      <X size={16} />
                    </button>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
