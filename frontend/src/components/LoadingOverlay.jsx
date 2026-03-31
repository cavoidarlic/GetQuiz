import React from 'react';

export default function LoadingOverlay({ loadingState }) {
  if (loadingState === 'idle') return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 5, 20, 0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        width: '60px',
        height: '60px',
        border: '4px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '1.5rem'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
        {loadingState === 'checking' ? 'Analyzing Prompt...' : 'Generating Quiz...'}
      </h3>
      <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem', textAlign: 'center', maxWidth: '400px' }}>
        {loadingState === 'checking'
          ? 'Checking prompt constraints and topics...'
          : 'Our AI is crafting your tailored questions. Please wait...'}
      </p>
    </div>
  );
}
