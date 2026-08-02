import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { ToastProvider } from './components/ui/Toast';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AccountsPage } from './pages/AccountsPage';
import { AccountDetailPage } from './pages/AccountDetailPage';
import { AccountFormPage } from './pages/AccountFormPage';
import { SharePage } from './pages/SharePage';
import { ProfilePage } from './pages/ProfilePage';

function protect(element: React.ReactElement) {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={protect(<DashboardPage />)} />
        <Route path="/accounts" element={protect(<AccountsPage />)} />
        <Route path="/accounts/new" element={protect(<AccountFormPage />)} />
        <Route path="/accounts/:id" element={protect(<AccountDetailPage />)} />
        <Route path="/accounts/:id/edit" element={protect(<AccountFormPage />)} />
        <Route path="/accounts/:id/share" element={protect(<SharePage />)} />
        <Route path="/profile" element={protect(<ProfilePage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
