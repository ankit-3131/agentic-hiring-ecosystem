import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-card border-b border-border sticky top-0 z-10 w-full h-16 flex items-center justify-between px-6">
      <div className="flex items-center gap-3 text-white font-bold text-xl">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        Hire Sphere AI
      </div>

      {user && (
        <div className="flex items-center gap-4">
          <div className="text-right">
             <p className="text-sm font-medium text-white">{user.name}</p>
             <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button 
            onClick={logout}
            className="px-4 py-2 border border-border bg-background hover:bg-white/5 transition rounded-lg text-sm text-white font-medium"
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;