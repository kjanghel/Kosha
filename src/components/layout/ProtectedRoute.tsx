import { Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth } from '../../lib/auth';

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}
