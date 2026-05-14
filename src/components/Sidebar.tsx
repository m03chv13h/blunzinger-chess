import type { ReactNode } from 'react';
import { useState } from 'react';
import type { ThemeMode } from '../hooks/useTheme';
import { BlutwurstIcon } from './BlutwurstIcon';
import './Sidebar.css';

export type NavSection = 'quick-start' | 'new-game' | 'online' | 'games' | 'analyse' | 'simulate' | 'rules' | 'profile';

interface SidebarProps {
  activeSection: NavSection | 'playing';
  onNavigate: (section: NavSection) => void;
  gameCount: number;
  /** Whether the app is running in connected (backend) mode. */
  isConnected?: boolean;
  /** Display name of the authenticated user (connected mode). */
  userName?: string;
  /** Avatar display element of the authenticated user (connected mode). */
  userAvatar?: ReactNode;
  /** Logout handler (connected mode only). */
  onLogout?: () => void;
  /** Current theme mode. */
  theme?: ThemeMode;
  /** Theme change handler. */
  onThemeChange?: (theme: ThemeMode) => void;
}

export function Sidebar({ activeSection, onNavigate, gameCount, isConnected, userName, userAvatar, onLogout, theme, onThemeChange }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (section: NavSection) => {
    onNavigate(section);
    setMobileOpen(false);
  };

  return (
    <>
      <button
        className="sidebar-hamburger"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <nav className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <h2><BlutwurstIcon /> Blunzinger Chess</h2>
        </div>

        <ul className="sidebar-nav">
          <li>
            <button
              className={`sidebar-item ${activeSection === 'quick-start' ? 'sidebar-item--active' : ''}`}
              onClick={() => handleNav('quick-start')}
            >
              <span className="sidebar-icon">⚡</span>
              <span className="sidebar-label">Quick Start</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar-item ${activeSection === 'new-game' ? 'sidebar-item--active' : ''}`}
              onClick={() => handleNav('new-game')}
            >
              <span className="sidebar-icon">🎮</span>
              <span className="sidebar-label">New Game</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar-item ${activeSection === 'online' ? 'sidebar-item--active' : ''}`}
              onClick={() => handleNav('online')}
              disabled={!isConnected}
              title={!isConnected ? 'Online play requires a backend connection' : undefined}
            >
              <span className="sidebar-icon">🌐</span>
              <span className="sidebar-label">Lobby (join online Game)</span>
              {!isConnected && <span className="sidebar-badge sidebar-badge--offline">offline</span>}
            </button>
          </li>
          <li>
            <button
              className={`sidebar-item ${activeSection === 'games' ? 'sidebar-item--active' : ''}`}
              onClick={() => handleNav('games')}
            >
              <span className="sidebar-icon">🏆</span>
              <span className="sidebar-label">Games</span>
              {gameCount > 0 && <span className="sidebar-badge">{gameCount}</span>}
            </button>
          </li>
          <li>
            <button
              className={`sidebar-item ${activeSection === 'analyse' ? 'sidebar-item--active' : ''}`}
              onClick={() => handleNav('analyse')}
            >
              <span className="sidebar-icon">📊</span>
              <span className="sidebar-label">Analyse</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar-item ${activeSection === 'simulate' ? 'sidebar-item--active' : ''}`}
              onClick={() => handleNav('simulate')}
            >
              <span className="sidebar-icon">🔬</span>
              <span className="sidebar-label">Simulate</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar-item ${activeSection === 'rules' ? 'sidebar-item--active' : ''}`}
              onClick={() => handleNav('rules')}
            >
              <span className="sidebar-icon">📖</span>
              <span className="sidebar-label">Rules</span>
            </button>
          </li>
        </ul>

        <div className="sidebar-theme">
          <label className="sidebar-theme-label" htmlFor="theme-select">
            <span className="sidebar-icon">🎨</span>
            Theme
          </label>
          <select
            id="theme-select"
            className="sidebar-theme-select"
            value={theme ?? 'system'}
            onChange={(e) => onThemeChange?.(e.target.value as ThemeMode)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="blunznstyle">Blunznstyle</option>
          </select>
        </div>

        {isConnected && userName && (
          <div className="sidebar-user">
            <button
              className={`sidebar-user-profile-btn ${activeSection === 'profile' ? 'sidebar-user-profile-btn--active' : ''}`}
              onClick={() => handleNav('profile')}
              title="Profile settings"
            >
              <span className="sidebar-user-avatar">{userAvatar ?? '👤'}</span>
              <span className="sidebar-user-name">{userName}</span>
            </button>
            {onLogout && (
              <button className="sidebar-logout-btn" onClick={onLogout}>
                Sign out
              </button>
            )}
          </div>
        )}
      </nav>
    </>
  );
}
