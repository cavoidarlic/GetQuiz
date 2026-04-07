import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Zap, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  SignedIn, SignedOut,
  SignInButton, SignUpButton, UserButton,
} from '@clerk/clerk-react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNav = (href) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <nav className={`nav${scrolled ? ' scrolled' : ''}`} role="banner">
        <div className="nav-inner">
          {/* Logo */}
          <Link className="nav-logo" to="/" aria-label="GetQuiz Home">
            <div className="nav-logo-icon" aria-hidden="true">
              <Zap size={16} color="#f0eeff" strokeWidth={2.5} />
            </div>
            GetQuiz
          </Link>

          {/* Desktop links */}
          <ul className="nav-links" role="navigation" aria-label="Main navigation">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}>
                <button
                  className="nav-link"
                  onClick={() => handleNav(href)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="nav-actions">
            <button
              className="nav-theme-btn"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Signed-in state: Dashboard link + Clerk UserButton */}
            <SignedIn>
              <Link to="/dashboard" className="btn btn-ghost" id="nav-dashboard-btn">
                Dashboard
              </Link>
              {/* UserButton provides Account, Manage, Sign Out from Clerk */}
              <UserButton afterSignOutUrl="/" />
            </SignedIn>

            {/* Signed-out state: Sign In + Sign Up */}
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn btn-ghost" id="nav-login-btn">Log in</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn btn-primary" id="nav-signup-btn">Get Started Free</button>
              </SignUpButton>
            </SignedOut>
          </div>

          {/* Mobile toggle */}
          <button
            className="nav-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed',
            top: 'var(--nav-height)',
            left: 0,
            right: 0,
            background: 'rgba(8,8,16,0.97)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--border)',
            padding: 'var(--space-3) var(--space-4)',
            zIndex: 99,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            animation: 'fadeUp 0.2s ease-out both',
          }}
        >
          {NAV_LINKS.map(({ label, href }) => (
            <button
              key={href}
              onClick={() => handleNav(href)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-2)',
                fontSize: '1rem',
                fontFamily: 'var(--font-display)',
                fontWeight: '500',
                padding: '0.625rem 0',
                textAlign: 'left',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {label}
            </button>
          ))}
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Log in</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Get Started</button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link to="/dashboard" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                Dashboard
              </Link>
            </SignedIn>
          </div>
        </div>
      )}
    </>
  );
}
