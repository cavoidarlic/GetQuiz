import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Toast — lightweight notification popup.
 * Props:
 *   message: string — shown inside the toast
 *   type: 'error' | 'warn' | 'info' | 'success' (default 'warn')
 *   duration: ms to auto-dismiss (default 3500)
 *   onClose: callback
 *   actionText: optional string for an action button
 *   onAction: optional callback when action is clicked
 *   autoClose: boolean to dictate if it auto dismisses (default true)
 */
// + description: Add actionText, onAction, autoClose props, and close icon functionality
// + input: actionText (string), onAction (function), autoClose (boolean) passed from parent
// + output: renders UI and manages close/action events propagating to parent
export default function Toast({ message, type = 'warn', duration = 3500, onClose, actionText, onAction, autoClose = true }) {
  const [visible, setVisible] = useState(false);

  // + description: Modified to only auto-close if autoClose is true
  // + input: message, duration, onClose, autoClose props
  // + output: timeout timers to set visible state and call onClose
  useEffect(() => {
    if (!message) return;
    // Small delay so CSS transition plays
    const show = setTimeout(() => setVisible(true), 10);
    
    let hide;
    if (autoClose) {
      hide = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // wait for fade-out
      }, duration);
    }
    
    return () => { clearTimeout(show); if (hide) clearTimeout(hide); };
  }, [message, duration, onClose, autoClose]);

  if (!message) return null;

  const colors = {
    error: { bg: 'rgba(255,80,80,0.12)', border: 'rgba(255,80,80,0.35)', text: '#ff7070', actionBg: 'rgba(255,80,80,0.2)' },
    warn:  { bg: 'rgba(255,190,61,0.12)', border: 'rgba(255,190,61,0.35)', text: '#ffb93d', actionBg: 'rgba(255,190,61,0.2)' },
    info:  { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)', text: '#a78bfa', actionBg: 'rgba(139,92,246,0.2)' },
    success: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)', text: '#10b981', actionBg: 'rgba(16, 185, 129, 0.2)' },
  };
  const c = colors[type] ?? colors.warn;

  // + description: Manually dismiss the toast and call onClose callback
  // + input: click event from action button or X icon
  // + output: update visibility state and call onClose after fadeout
  const handleManualClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

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
        // + description: added flex layout to support text alongside buttons
        // + input: layout configurations based on internal CSS requirements
        // + output: correctly aligned UI elements
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}
    >
      <div style={{ flex: 1 }}>{message}</div>
      
      {/* + description: Action button like 'See now' that triggers action callback */}
      {/* + input: actionText, onAction from parent */}
      {/* + output: DOM click invokes onAction and then optionally handled close behavior */}
      {actionText && onAction && (
        <button
          onClick={onAction}
          style={{
            background: c.actionBg,
            border: `1px solid ${c.border}`,
            color: c.text,
            padding: '0.2rem 0.6rem',
            borderRadius: '0.4rem',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 'auto'
          }}
        >
          {actionText}
        </button>
      )}

      {/* + description: X icon for explicitly closing the toast without action */}
      {/* + input: standard user click event */}
      {/* + output: invokes handleManualClose to transition toast out */}
      <button 
        onClick={handleManualClose}
        style={{
          background: 'none',
          border: 'none',
          color: c.text,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.2rem',
          opacity: 0.8
        }}
        aria-label="Close notification"
      >
        <X size={15} />
      </button>
    </div>
  );
}
