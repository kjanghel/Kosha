import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

export function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const nav = useNavigate();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav('/', { replace: true });
  }, [user, loading, nav]);

  async function onGoogle() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Sign-in failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-app text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-6">
          <Coins size={30} />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Kosha</h1>
        <p className="text-sm text-slate-500 mt-2 mb-8">
          Track your investments and loans, all in one place.
        </p>
        <Button
          size="lg"
          onClick={onGoogle}
          disabled={busy}
          className="w-full bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
        >
          <GoogleG />
          Continue with Google
        </Button>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44a5.51 5.51 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.3a7.19 7.19 0 0 1 0-4.6V6.61H1.29a12 12 0 0 0 0 10.78l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.61l4 3.09C6.23 6.86 8.88 4.75 12 4.75z"
      />
    </svg>
  );
}
