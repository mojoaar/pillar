'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Sun, Moon, Terminal } from 'lucide-react';
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
  const { theme, toggleTheme } = useTheme();
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
        </div>
      </div>
    </header>
  );
}
