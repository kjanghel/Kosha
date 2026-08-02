import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="max-w-app mx-auto pb-28">{children}</div>
      <BottomNav />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="px-4 pt-6 pb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-1">{right}</div>}
    </header>
  );
}

export function IconButton({
  onClick,
  children,
  label,
}: {
  onClick?: () => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="p-2 rounded-xl text-slate-600 hover:bg-slate-100"
    >
      {children}
    </button>
  );
}

export function FAB({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed bottom-24 inset-x-0 z-20 pointer-events-none">
      <div className="max-w-app mx-auto flex justify-end pr-5">
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="pointer-events-auto h-14 w-14 rounded-full bg-accent text-white shadow-lg hover:bg-indigo-600 flex items-center justify-center active:scale-95 transition"
        >
          {children}
        </button>
      </div>
    </div>
  );
}
