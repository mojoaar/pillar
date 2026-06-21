'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Terminal, 
  Settings, 
  BookOpen, 
  Code, 
  ShieldAlert, 
  LogOut,
  ChevronRight
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  user: {
    name: string;
    email: string;
    username: string;
    role: string;
  };
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  // Helper to determine if a route is currently active
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  // Extract initials from user's display name for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    // Gotcha #10: Use hard window.location.href transition to fully clean session headers
    await signOut({ redirect: false });
    window.location.href = '/login';
  };

  return (
    <aside className={styles.sidebar}>
      {/* Logo branding section */}
      <div className={styles.logoSection}>
        <div className={styles.logoIcon}>
          <Terminal size={26} strokeWidth={2.5} />
        </div>
        <span className={styles.logoTitle}>PILLAR</span>
      </div>

      {/* Navigation menu list */}
      <nav className={styles.navSection}>
        <Link 
          href="/dashboard" 
          className={`${styles.navItem} ${isActive('/dashboard') ? styles.navItemActive : ''}`}
        >
          <LayoutDashboard size={20} />
          <span className={styles.navText}>Dashboard</span>
        </Link>

        <Link 
          href="/connections" 
          className={`${styles.navItem} ${isActive('/connections') ? styles.navItemActive : ''}`}
        >
          <Terminal size={20} />
          <span className={styles.navText}>Connections</span>
        </Link>

        <Link 
          href="/settings" 
          className={`${styles.navItem} ${isActive('/settings') ? styles.navItemActive : ''}`}
        >
          <Settings size={20} />
          <span className={styles.navText}>Settings</span>
        </Link>

        <Link 
          href="/docs" 
          className={`${styles.navItem} ${isActive('/docs') ? styles.navItemActive : ''}`}
        >
          <BookOpen size={20} />
          <span className={styles.navText}>Documentation</span>
        </Link>

        <Link 
          href="/apidocs" 
          className={`${styles.navItem} ${isActive('/apidocs') ? styles.navItemActive : ''}`}
        >
          <Code size={20} />
          <span className={styles.navText}>API Reference</span>
        </Link>

        {/* Separator block */}
        <div className={styles.separator} />

        {/* Dedicated Admin Console (ADMIN-role only) */}
        {user.role === 'ADMIN' && (
          <>
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              color: 'var(--text-muted)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em', 
              paddingLeft: '1rem',
              marginBottom: '0.5rem'
            }} className={styles.navText}>
              Administration
            </span>

            <Link 
              href="/admin" 
              className={`${styles.navItem} ${isActive('/admin') ? styles.navItemActive : ''}`}
            >
              <ShieldAlert size={20} />
              <span className={styles.navText}>Admin Panel</span>
            </Link>
          </>
        )}

        {/* Separator block */}
        <div className={styles.separator} />

        <a 
          href="/logout" 
          className={styles.navItem} 
          onClick={handleLogout}
          style={{ color: 'var(--danger)', marginTop: 'auto' }}
        >
          <LogOut size={20} />
          <span className={styles.navText}>Sign Out</span>
        </a>
      </nav>

      {/* User display badge */}
      <div className={styles.userSection}>
        <div className={styles.avatar}>
          {getInitials(user.name)}
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.name}</span>
          <span className={styles.userRole}>{user.role}</span>
        </div>
      </div>
    </aside>
  );
}
