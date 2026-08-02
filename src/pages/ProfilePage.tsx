import { LogOut } from 'lucide-react';
import { AppShell, PageHeader } from '../components/layout/AppShell';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui/Toast';

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const { show } = useToast();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'You';
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined);

  async function onSignOut() {
    try {
      await signOut();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Sign-out failed', 'error');
    }
  }

  return (
    <AppShell>
      <PageHeader title="Profile" />
      <div className="px-4 space-y-3">
        <Card>
          <CardBody className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-accent-soft text-accent flex items-center justify-center font-semibold uppercase">
                {displayName.slice(0, 2)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-xs text-slate-500 space-y-1">
            <p>
              Kosha stores your data in Supabase. Sharing an account gives editors
              full read/write access; only the owner can delete or revoke members.
            </p>
            <p>Manual refresh only — pull the refresh icon on each screen after changes.</p>
          </CardBody>
        </Card>

        <Button variant="danger" size="lg" className="w-full" onClick={onSignOut}>
          <LogOut size={16} /> Sign out
        </Button>
      </div>
    </AppShell>
  );
}
