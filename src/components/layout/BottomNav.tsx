import { NavLink } from 'react-router-dom';
import { Home, Wallet, User } from 'lucide-react';

const tabs = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet, end: false },
  { to: '/profile', label: 'Profile', icon: User, end: false },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 pointer-events-none">
      <div className="max-w-app mx-auto pointer-events-auto">
        <div className="mx-3 mb-3 rounded-2xl bg-white/95 backdrop-blur shadow-lg border border-slate-100 flex">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[11px] ${
                  isActive ? 'text-accent' : 'text-slate-500'
                }`
              }
            >
              <Icon size={20} />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
