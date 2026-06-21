'use client';

import React, { useState, useEffect } from 'react';
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
  Server,
  Puzzle,
  ChevronLeft,
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
    avatarUrl: string | null;
    allowedPlugins?: string | null;
    isPveEnabled?: boolean;
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

  // Sidebar collapse state (persisted across sessions)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pillar-sidebar-collapsed') === '1';
    }
    return false;
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('pillar-sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  };

  // Global keyboard shortcut: Cmd/Ctrl+B toggles sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyB' && (e.metaKey || e.ctrlKey)) {
        // Ignore when focus is inside input, textarea, or contenteditable
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
          return;
        }
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`} style={{ position: 'relative' }}>
      {/* Collapse toggle button */}
      <button
        className={styles.collapseBtn}
        onClick={toggleSidebar}
        title={isCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

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

        {user.isPveEnabled && (user.role === 'ADMIN' || user.allowedPlugins?.includes('proxmox-ve')) && (
          <Link 
            href="/proxmox" 
            className={`${styles.navItem} ${isActive('/proxmox') ? styles.navItemActive : ''}`}
          >
            <Server size={20} />
            <span className={styles.navText}>Proxmox Console</span>
          </Link>
        )}

        {/* Dedicated Admin Console (ADMIN-role only) */}
        {user.role === 'ADMIN' && (
          <>
            {/* Separator block */}
            <div className={styles.separator} />
            
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

            <Link 
              href="/admin/plugins" 
              className={`${styles.navItem} ${isActive('/admin/plugins') ? styles.navItemActive : ''}`}
            >
              <Puzzle size={20} />
              <span className={styles.navText}>Manage Plugins</span>
            </Link>
          </>
        )}
      </nav>

      {/* Sidebar Footer Wrapper (Finding #nav-reorder) */}
      <div className={styles.sidebarFooter}>
        {/* Clickable User profile card section */}
        <Link href="/settings" className={styles.userSection} title="Navigate to Profile Settings">
          <div className={styles.avatar}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className={styles.avatarImage} />
            ) : (
              getInitials(user.name)
            )}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>{user.role}</span>
          </div>
        </Link>

        {/* Sign Out link positioned cleanly at the absolute bottom */}
        <a 
          href="/logout" 
          className={styles.signOutLink} 
          onClick={handleLogout}
          title="Sign Out of Gateway Session"
        >
          <LogOut size={20} />
          <span className={styles.signOutText}>Sign Out</span>
        </a>
      </div>
    </aside>
  );
}
