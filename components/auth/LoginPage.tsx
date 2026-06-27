import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface LoginPageProps {
  onSwitchToSignup: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToSignup }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const autofill = (role: string) => {
      setEmail(`${role.toLowerCase()}@test.com`);
      setPassword("password");
  };

  return (
    <div className="flex bg-background h-screen w-full items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-8 shadow-xl">
        <h2 className="text-3xl font-bold text-white mb-2 text-center">Hire Sphere AI</h2>
        <p className="text-muted-foreground text-center mb-6">Login to access your portal</p>
        
        {error && <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
             <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
             <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-input border border-border text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
          </div>
          <div>
             <label className="block text-sm font-medium text-muted-foreground mb-1">Password</label>
             <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-input border border-border text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
          </div>
          <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 rounded-lg transition mt-4">
            Sign In
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border flex flex-col gap-2">
            <p className="text-xs text-muted-foreground text-center mb-2">Demo Logins:</p>
            <div className="grid grid-cols-3 gap-2">
               <button type="button" onClick={() => autofill('Candidate')} className="text-xs bg-card hover:bg-white/10 text-white rounded p-1 border border-border">Candidate</button>
               <button type="button" onClick={() => autofill('Employer')} className="text-xs bg-card hover:bg-white/10 text-white rounded p-1 border border-border">Employer</button>
               <button type="button" onClick={() => autofill('Admin')} className="text-xs bg-card hover:bg-white/10 text-white rounded p-1 border border-border">Admin</button>
            </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account? <button onClick={onSwitchToSignup} className="text-primary hover:underline">Sign up</button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;