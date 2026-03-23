import { useState } from 'react';
import './Sidebar.css';

export type NavSection = 'quick-start' | 'new-game' | 'analyse' | 'simulate' | 'rules';

interface SidebarProps {
  activeSection: NavSection | 'playing';
  onNavigate: (section: NavSection) => void;
  gameCount: number;
}

export function Sidebar({ activeSection, onNavigate, gameCount }: SidebarProps) {
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
          <h2>♟ Blunziger Chess</h2>
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
              className={`sidebar-item ${activeSection === 'analyse' ? 'sidebar-item--active' : ''}`}
              onClick={() => handleNav('analyse')}
            >
              <span className="sidebar-icon">📊</span>
              <span className="sidebar-label">Analyse</span>
              {gameCount > 0 && <span className="sidebar-badge">{gameCount}</span>}
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
      </nav>
    </>
  );
}
