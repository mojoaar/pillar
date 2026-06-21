'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useTheme, ThemeName, FontName } from '@/components/theme/ThemeProvider';
import { 
  Search, 
  Terminal, 
  Palette, 
  Type, 
  Compass, 
  X,
  HelpCircle,
  ArrowRight,
  Server
} from 'lucide-react';
import styles from './CommandPalette.module.css';

interface ConnectionAction {
  id: string;
  name: string;
  host: string;
  username: string;
  port: number;
  tags?: string[];
  protocol?: string;
}

interface CommandItem {
  id: string;
  category: 'Connections' | 'Themes' | 'Fonts' | 'Navigation';
  title: string;
  subtitle?: string;
  icon: React.JSX.Element;
  action: () => void;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [connections, setConnections] = useState<ConnectionAction[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const { setTheme, setFont } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch available connections on mount to populate search targets
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch('/api/connections');
        if (res.ok) {
          const data = await res.json();
          setConnections(data.data || []);
        }
      } catch (err) {
        // Silently capture fetch failures
      }
    };
    
    fetchConnections();
  }, [isOpen]); // Re-fetch on open to keep catalog updated

  // 2. Traps modifier-independent custom chords: Cmd + K / Ctrl + K (Gotcha #18, #19) and custom window events (Finding #search-trigger)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Physical key mapping ensures layout/language independence (Gotcha #18)
      const isChord = e.code === 'KeyK' && (e.metaKey || e.ctrlKey);
      
      if (isChord) {
        e.preventDefault(); // Suppress browser-reserved search bars (Gotcha #19)
        setIsOpen((prev) => !prev);
        setSearch('');
        setActiveIndex(0);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    const handleCustomToggle = () => {
      setIsOpen((prev) => !prev);
      setSearch('');
      setActiveIndex(0);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('toggle-command-palette', handleCustomToggle);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('toggle-command-palette', handleCustomToggle);
    };
  }, [isOpen]);

  // Focus input automatically on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // 3. Define static navigation, theme-swapping, and font-mapping action spec
  const staticCommands: CommandItem[] = [
    // Navigation Commands
    {
      id: 'nav-dashboard',
      category: 'Navigation',
      title: 'Go to Dashboard',
      subtitle: 'Analyze server metrics and connections',
      icon: <Compass size={18} />,
      action: () => { window.location.href = '/dashboard'; }
    },
    {
      id: 'nav-connections',
      category: 'Navigation',
      title: 'Go to Connections',
      subtitle: 'Manage saved SSH connection profiles',
      icon: <Terminal size={18} />,
      action: () => { window.location.href = '/connections'; }
    },
    {
      id: 'nav-settings',
      category: 'Navigation',
      title: 'Go to Settings',
      subtitle: 'Configure profiles, passwords, and MFA',
      icon: <SettingsIcon />,
      action: () => { window.location.href = '/settings'; }
    },
    {
      id: 'nav-docs',
      category: 'Navigation',
      title: 'Go to Documentation',
      subtitle: 'Read gateway administration and user guides',
      icon: <BookOpenIcon />,
      action: () => { window.location.href = '/docs'; }
    },
    {
      id: 'nav-apidocs',
      category: 'Navigation',
      title: 'Go to API Reference',
      subtitle: 'Inspect and test REST API endpoints',
      icon: <CodeIcon />,
      action: () => { window.location.href = '/apidocs'; }
    },
    {
      id: 'nav-proxmox',
      category: 'Navigation',
      title: 'Go to Proxmox VE',
      subtitle: 'Monitor virtual machines and cluster nodes',
      icon: <ServerIcon />,
      action: () => { window.location.href = '/proxmox'; }
    },

    // Theme Hot-Swappers
    {
      id: 'theme-dracula-dark',
      category: 'Themes',
      title: 'Switch to Dracula Dark',
      subtitle: 'Classic vampire aesthetic',
      icon: <Palette size={18} />,
      action: () => setTheme('dracula-dark')
    },
    {
      id: 'theme-dracula-light',
      category: 'Themes',
      title: 'Switch to Dracula Light',
      subtitle: 'Clean light contrast',
      icon: <Palette size={18} />,
      action: () => setTheme('dracula-light')
    },
    {
      id: 'theme-nord-dark',
      category: 'Themes',
      title: 'Switch to Nord Dark',
      subtitle: 'Icy cold scandinavian tones',
      icon: <Palette size={18} />,
      action: () => setTheme('nord-dark')
    },
    {
      id: 'theme-nord-light',
      category: 'Themes',
      title: 'Switch to Nord Light',
      subtitle: 'Snow-capped light colors',
      icon: <Palette size={18} />,
      action: () => setTheme('nord-light')
    },
    {
      id: 'theme-cyberpunk-dark',
      category: 'Themes',
      title: 'Switch to Cyberpunk Dark',
      subtitle: 'Fluorescent neon glowing bars',
      icon: <Palette size={18} />,
      action: () => setTheme('cyberpunk-dark')
    },
    {
      id: 'theme-cyberpunk-light',
      category: 'Themes',
      title: 'Switch to Cyberpunk Light',
      subtitle: 'Pink and violet pastel colors',
      icon: <Palette size={18} />,
      action: () => setTheme('cyberpunk-light')
    },
    {
      id: 'theme-github-dark',
      category: 'Themes',
      title: 'Switch to GitHub Dark',
      subtitle: 'Standard repository dark color-set',
      icon: <Palette size={18} />,
      action: () => setTheme('github-dark')
    },
    {
      id: 'theme-github-light',
      category: 'Themes',
      title: 'Switch to GitHub Light',
      subtitle: 'Clean code light contrast',
      icon: <Palette size={18} />,
      action: () => setTheme('github-light')
    },

    // Font Hot-Mappers
    {
      id: 'font-jetbrains-mono',
      category: 'Fonts',
      title: 'Set Font: JetBrains Mono',
      subtitle: 'Default professional coding font',
      icon: <Type size={18} />,
      action: () => setFont('jetbrains-mono')
    },
    {
      id: 'font-fira-code',
      category: 'Fonts',
      title: 'Set Font: Fira Code',
      subtitle: 'Modern monospace with ligatures',
      icon: <Type size={18} />,
      action: () => setFont('fira-code')
    },
    {
      id: 'font-source-code-pro',
      category: 'Fonts',
      title: 'Set Font: Source Code Pro',
      subtitle: 'Highly readable code alignment',
      icon: <Type size={18} />,
      action: () => setFont('source-code-pro')
    },
    {
      id: 'font-inconsolata',
      category: 'Fonts',
      title: 'Set Font: Inconsolata',
      subtitle: 'Elegant narrow coding letters',
      icon: <Type size={18} />,
      action: () => setFont('inconsolata')
    },
    {
      id: 'font-roboto-mono',
      category: 'Fonts',
      title: 'Set Font: Roboto Mono',
      subtitle: 'Clear android-style monospace',
      icon: <Type size={18} />,
      action: () => setFont('roboto-mono')
    },
    {
      id: 'font-ubuntu-mono',
      category: 'Fonts',
      title: 'Set Font: Ubuntu Mono',
      subtitle: 'Classic warm linux-styled font',
      icon: <Type size={18} />,
      action: () => setFont('ubuntu-mono')
    },
    {
      id: 'font-ibm-plex-mono',
      category: 'Fonts',
      title: 'Set Font: IBM Plex Mono',
      subtitle: 'Industrial corporate-styled letters',
      icon: <Type size={18} />,
      action: () => setFont('ibm-plex-mono')
    },
    {
      id: 'font-anonymous-pro',
      category: 'Fonts',
      title: 'Set Font: Anonymous Pro',
      subtitle: 'Vintage typewriter styling',
      icon: <Type size={18} />,
      action: () => setFont('anonymous-pro')
    },
  ];

  // Helper icons to prevent cyclic dependencies
  function SettingsIcon() { return <Type size={18} />; }
  function BookOpenIcon() { return <Type size={18} />; }
  function CodeIcon() { return <Type size={18} />; }
  function ServerIcon() { return <Server size={18} />; }

  // 4. Map dynamic connections into Action schema format
  const connectionCommands: CommandItem[] = connections.map((conn) => ({
    id: `connect-${conn.id}`,
    category: 'Connections',
    title: `Launch SSH: ${conn.name}`,
    subtitle: `${conn.username}@${conn.host}:${conn.port}`,
    icon: <Terminal size={18} style={{ color: 'var(--accent)' }} />,
    action: () => { window.location.href = `/connections/${conn.id}`; }
  }));

  // Group filtered results by category for organized rendering
  const categories: ('Connections' | 'Themes' | 'Fonts' | 'Navigation')[] = [
    'Connections',
    'Navigation',
    'Themes',
    'Fonts',
  ];

  // Combine lists and sort dynamically to guarantee perfect keyboard navigation sequence (Finding #palette-sort)
  const allCommands = [...connectionCommands, ...staticCommands].sort((a, b) => {
    return categories.indexOf(a.category) - categories.indexOf(b.category);
  });

  // 5. Filter search queries inside Combined catalog in real-time
  const filteredCommands = allCommands.filter((cmd) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return (
      cmd.title.toLowerCase().includes(query) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(query)) ||
      cmd.category.toLowerCase().includes(query)
    );
  });

  // 6. Navigate using arrow keys and execute on Enter
  useEffect(() => {
    const handleNavigationKeys = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(filteredCommands.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(filteredCommands.length, 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeCommand = filteredCommands[activeIndex];
        if (activeCommand) {
          activeCommand.action();
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleNavigationKeys);
    return () => window.removeEventListener('keydown', handleNavigationKeys);
  }, [isOpen, activeIndex, filteredCommands]);

  if (!isOpen) return null;

  // Calculate absolute index positions inside categories to map active classes properly
  let absoluteItemCounter = 0;

  return (
    <div className={styles.overlay} onClick={() => setIsOpen(false)}>
      {/* Palette container */}
      <div className={styles.paletteBox} onClick={(e) => e.stopPropagation()}>
        {/* Search header bar */}
        <div className={styles.searchSection}>
          <Search size={22} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search connections, themes, fonts, or actions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveIndex(0); }}
          />
          <kbd className={styles.escBadge}>ESC</kbd>
        </div>

        {/* Results List */}
        <div className={styles.resultsSection}>
          {filteredCommands.length === 0 ? (
            <div className={styles.emptyState}>
              <HelpCircle size={36} className={styles.emptyIcon} />
              <p style={{ fontWeight: 600 }}>No results found</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                We couldn't find anything matching "{search}"
              </p>
            </div>
          ) : (
            categories.map((cat) => {
              const catItems = filteredCommands.filter((cmd) => cmd.category === cat);
              if (catItems.length === 0) return null;

              return (
                <div key={cat} className={styles.categoryGroup}>
                  <span className={styles.categoryHeader}>{cat}</span>
                  {catItems.map((cmd) => {
                    const currentAbsoluteIndex = absoluteItemCounter++;
                    const isActive = currentAbsoluteIndex === activeIndex;

                    return (
                      <button
                        key={cmd.id}
                        className={`${styles.resultItem} ${isActive ? styles.resultItemActive : ''}`}
                        onClick={() => { cmd.action(); setIsOpen(false); }}
                        onMouseEnter={() => setActiveIndex(currentAbsoluteIndex)}
                      >
                        <div className={styles.resultItemLeft}>
                          <span className={styles.resultItemIcon}>{cmd.icon}</span>
                          <div className={styles.resultItemText}>
                            <span className={styles.resultItemTitle}>{cmd.title}</span>
                            {cmd.subtitle && (
                              <span className={styles.resultItemSubtitle}>{cmd.subtitle}</span>
                            )}
                          </div>
                        </div>
                        <kbd className={styles.enterBadge}>↵ Enter</kbd>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
