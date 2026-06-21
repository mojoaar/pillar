'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeName =
  | 'dracula-dark'
  | 'dracula-light'
  | 'nord-dark'
  | 'nord-light'
  | 'cyberpunk-dark'
  | 'cyberpunk-light'
  | 'github-dark'
  | 'github-light';

export type FontName =
  | 'jetbrains-mono'
  | 'fira-code'
  | 'source-code-pro'
  | 'inconsolata'
  | 'roboto-mono'
  | 'ubuntu-mono'
  | 'ibm-plex-mono'
  | 'anonymous-pro'
  | 'cascadia-code'
  | 'sf-mono';

interface ThemeContextType {
  theme: ThemeName;
  font: FontName;
  setTheme: (theme: ThemeName) => void;
  setFont: (font: FontName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('dracula-dark');
  const [font, setFontState] = useState<FontName>('jetbrains-mono');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read persisted selections from localStorage on mount
    const savedTheme = localStorage.getItem('pillar-theme') as ThemeName;
    const savedFont = localStorage.getItem('pillar-font') as FontName;

    if (savedTheme) {
      setThemeState(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dracula-dark');
    }

    if (savedFont) {
      setFontState(savedFont);
      document.documentElement.setAttribute('data-font', savedFont);
    } else {
      document.documentElement.setAttribute('data-font', 'jetbrains-mono');
    }

    setMounted(true);
  }, []);

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    localStorage.setItem('pillar-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const setFont = (newFont: FontName) => {
    setFontState(newFont);
    localStorage.setItem('pillar-font', newFont);
    document.documentElement.setAttribute('data-font', newFont);
  };

  const toggleTheme = () => {
    const defaultPairs: Record<ThemeName, ThemeName> = {
      'dracula-dark': 'dracula-light',
      'dracula-light': 'dracula-dark',
      'nord-dark': 'nord-light',
      'nord-light': 'nord-dark',
      'cyberpunk-dark': 'cyberpunk-light',
      'cyberpunk-light': 'cyberpunk-dark',
      'github-dark': 'github-light',
      'github-light': 'github-dark',
    };
    
    setTheme(defaultPairs[theme] || 'dracula-dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, font, setTheme, setFont, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
