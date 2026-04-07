import { useEffect, useState } from 'react';

/**
 * Toast — lightweight notification popup.
 * Props:
 *   message: string — shown inside the toast
 *   type: 'error' | 'warn' | 'info'  (default 'warn')
 *   duration: ms to auto-dismiss (default 3500)
 *   onClose: callback
 */
export default function Toast({ message, type = 'warn', duration = 3500, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    // Small delay so CSS transition plays
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // wait for fade-out
    }, duration);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [message, duration, onClose]);

  if (!message) return null;

  const colors = {
    error: { bg: 'rgba(255,80,80,0.12)', border: 'rgba(255,80,80,0.35)', text: '#ff7070' },
    warn:  { bg: 'rgba(255,190,61,0.12)', border: 'rgba(255,190,61,0.35)', text: '#ffb93d' },
    info:  { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)', text: '#a78bfa' },
  };
  const c = colors[type] ?? colors.warn;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.75rem',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '1rem'})`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        padding: '0.65rem 1.25rem',
        borderRadius: '0.6rem',
        fontSize: '0.85rem',
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
        maxWidth: '90vw',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </div>
  );
}
