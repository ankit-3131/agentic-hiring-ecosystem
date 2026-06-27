import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../types';

interface SignupPageProps {
  onSwitchToLogin: () => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onSwitchToLogin }) => {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Candidate');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signup(name, email, password, role);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex bg-background h-screen w-full items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-8 shadow-xl">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">Create Account</h2>
        {error && <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
             <label className="block text-sm font-medium text-muted-foreground mb-1">Name</label>
             <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-input border border-border text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
          </div>
          <div>
             <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
             <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-input border border-border text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
          </div>
          <div>
             <label className="block text-sm font-medium text-muted-foreground mb-1">Password</label>
             <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-input border border-border text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
          </div>
          <div>
             <label className="block text-sm font-medium text-muted-foreground mb-1">Select Role</label>
             <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full bg-input border border-border text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition">
                <option value="Candidate">Candidate (Job Seeker)</option>
                <option value="Employer">Employer (Recruiter/Company)</option>
                <option value="Admin">Admin</option>
             </select>
          </div>
          <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 rounded-lg transition mt-4">
            Sign Up
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <button onClick={onSwitchToLogin} className="text-primary hover:underline">Log in</button>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;