import React, { createContext, useState, useEffect, useMemo } from 'react';
import { User, Role } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: Role) => Promise<void>;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'hire_sphere_ai_session_v2';
const API_BASE = 'http://localhost:8000/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = () => {
      try {
        const session = localStorage.getItem(SESSION_STORAGE_KEY);
        if (session) {
          setUser(JSON.parse(session));
        }
      } catch (error) {
        console.error("Failed to parse session:", error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = async (email: string, pass: string): Promise<void> => {
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password: pass })
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || "Login failed");
        }
        
        const data = await res.json();
        const userToSave: User = {
            id: String(data.id),
            name: data.name,
            email: data.email,
            role: data.role as Role
        };
        
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userToSave));
        setUser(userToSave);
    } catch(err: any) {
        throw new Error(err.message || "Invalid email or password.");
    }
  };

  const signup = async (name: string, email: string, pass: string, role: Role): Promise<void> => {
    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, email, password: pass, role })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || "A registration error occurred.");
        }

        const data = await res.json();
        const userToSave: User = {
            id: String(data.id),
            name: data.name,
            email: data.email,
            role: data.role as Role
        };

        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userToSave));
        setUser(userToSave);
    } catch (err: any) {
         throw new Error(err.message || "An error occurred.");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const updateUser = (updatedData: Partial<User>) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      const updatedUser = { ...prevUser, ...updatedData };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  const value = useMemo(() => ({ user, isAuthenticated: !!user, isLoading, login, signup, logout, updateUser }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};