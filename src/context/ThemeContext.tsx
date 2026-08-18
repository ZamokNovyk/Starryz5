import React, { createContext, useContext, useEffect, useState } from 'react';

export type AppTheme = 'night' | 'day';

interface ThemeContextType {
  theme: AppTheme;
  toggleTheme: () => void;
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('starryz_theme') as AppTheme | null;
      if (saved === 'day' || saved === 'night') return saved;
    }
    return 'night';
  });

  const applyTheme = (currentTheme: AppTheme) => {
    const root = document.documentElement;
    const body = document.body;
    if (currentTheme === 'day') {
      root.classList.add('light-theme');
      body.classList.add('light-theme');
      root.classList.remove('dark-theme');
      body.classList.remove('dark-theme');
    } else {
      root.classList.remove('light-theme');
      body.classList.remove('light-theme');
      root.classList.add('dark-theme');
      body.classList.add('dark-theme');
    }
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: AppTheme = theme === 'night' ? 'day' : 'night';
    setThemeState(nextTheme);
    localStorage.setItem('starryz_theme', nextTheme);
    applyTheme(nextTheme);
  };

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('starryz_theme', newTheme);
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
