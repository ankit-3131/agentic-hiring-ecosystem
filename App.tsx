import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import { FullScreenLoader } from './components/Loader';
import CandidatePortal from './components/candidate/CandidatePortal';
import EmployerPortal from './components/employer/EmployerPortal';
import AdminPortal from './components/admin/AdminPortal';
import Header from './components/layout/Header';
import { Toaster } from 'react-hot-toast';

const App: React.FC = () => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [authPage, setAuthPage] = useState<'login' | 'signup'>('login');

  if (isAuthLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated || !user) {
     return authPage === 'login' 
       ? <LoginPage onSwitchToSignup={() => setAuthPage('signup')} />
       : <SignupPage onSwitchToLogin={() => setAuthPage('login')} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Toaster position="top-right" toastOptions={{ className: 'glass-card text-white' }} />
      <Header />
      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        {user.role === 'Candidate' && <CandidatePortal />}
        {user.role === 'Employer' && <EmployerPortal />}
        {user.role === 'Admin' && <AdminPortal />}
      </main>
    </div>
  );
};

export default App;