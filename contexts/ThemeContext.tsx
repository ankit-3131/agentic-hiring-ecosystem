import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';

type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

interface ThemeContextType {
  theme: Theme;
  themePreference: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');

  const applyTheme = useCallback((preference: ThemePreference) => {
    const root = window.document.documentElement;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let currentTheme: Theme;

    if (preference === 'system') {
      currentTheme = systemPrefersDark ? 'dark' : 'light';
    } else {
      currentTheme = preference;
    }
    
    root.classList.remove('light', 'dark');
    root.classList.add(currentTheme);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const initialTheme = (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') ? savedTheme as ThemePreference : 'system';
    setThemePreference(initialTheme);
    applyTheme(initialTheme);
  }, [applyTheme]);


  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const savedTheme = localStorage.getItem('theme') as ThemePreference || 'system';
      if (savedTheme === 'system') {
        applyTheme('system');
      }
    }
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyTheme]);

  const setTheme = useCallback((newPreference: ThemePreference) => {
    localStorage.setItem('theme', newPreference);
    setThemePreference(newPreference);
    applyTheme(newPreference);
  }, [applyTheme]);
  
  const getEffectiveTheme = useCallback((preference: ThemePreference): Theme => {
      if(preference === 'system') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return preference;
  }, []);

  const value = useMemo(() => ({ 
    theme: getEffectiveTheme(themePreference),
    themePreference,
    setTheme
  }), [themePreference, getEffectiveTheme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};