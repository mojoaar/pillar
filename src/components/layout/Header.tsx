'use client';

import React, { useEffect, useState } from 'react';
import { useTheme, ThemeName, FontName } from '@/components/theme/ThemeProvider';
import { Sun, Moon, Terminal, Radio } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  user: {
    name: string;
    email: string;
    username: string;
    role: string;
  };
}

export default function Header({ user }: HeaderProps) {
  const { theme, font, setTheme, setFont, toggleTheme } = useTheme();
  const [sessionCount, setSessionCount] = useState(0);

  // Poll for active SSH session counts
  useEffect(() => {
    const fetchSessionCount = async () => {
      try {
        const res = await fetch('/api/admin/metrics');
        if (res.ok) {
          const data = await res.json();
          if (data && data.data && data.data.activeSessions !== undefined) {
            setSessionCount(data.data.activeSessions);
          }
        }
      } catch (err) {
        // Silently capture errors
      }
    };

    fetchSessionCount();
    const interval = setInterval(fetchSessionCount, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, []);

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value as ThemeName);
  };

  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFont(e.target.value as FontName);
  };

  return (
    <header className={styles.header}>
      {/* Page Title & Breadcrumbs */}
      <div className={styles.leftSection}>
        <span className={styles.pageTitle}>Homelab Portal</span>
      </div>

      {/* Control items & selectors */}
      <div className={styles.rightSection}>
        {/* Active sessions diagnostic indicator */}
        <div className={styles.activeSessionsBadge} title="Active terminal gateway sessions">
          <div className={styles.activeIndicator} />
          <span>{sessionCount} SSH session{sessionCount !== 1 ? 's' : ''}</span>
        </div>

        <div className={styles.controlGroup}>
          {/* Quick sun/moon toggle */}
          <button 
            onClick={toggleTheme} 
            className={styles.themeToggleBtn}
            title="Toggle theme (Light / Dark)"
          >
            {theme.endsWith('-dark') ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Theme select dropdown */}
          <select 
            value={theme} 
            onChange={handleThemeChange}
            className={styles.selectDropdown}
            title="Select visual theme"
          >
            <option value="dracula-dark">Dracula (Dark)</option>
            <option value="dracula-light">Dracula (Light)</option>
            <option value="nord-dark">Nord (Dark)</option>
            <option value="nord-light">Nord (Light)</option>
            <option value="cyberpunk-dark">Cyberpunk (Dark)</option>
            <option value="cyberpunk-light">Cyberpunk (Light)</option>
            <option value="github-dark">GitHub (Dark)</option>
            <option value="github-light">GitHub (Light)</option>
          </select>

          {/* Monospace Font select dropdown */}
          <select 
            value={font} 
            onChange={handleFontChange}
            className={styles.selectDropdown}
            title="Select terminal coding font"
          >
            <option value="jetbrains-mono">JetBrains Mono</option>
            <option value="fira-code">Fira Code</option>
            <option value="source-code-pro">Source Code Pro</option>
            <option value="inconsolata">Inconsolata</option>
            <option value="roboto-mono">Roboto Mono</option>
            <option value="ubuntu-mono">Ubuntu Mono</option>
            <option value="ibm-plex-mono">IBM Plex Mono</option>
            <option value="anonymous-pro">Anonymous Pro</option>
            <option value="cascadia-code">Cascadia Mono</option>
            <option value="sf-mono">SF Mono (System)</option>
          </select>
        </div>
      </div>
    </header>
  );
}
