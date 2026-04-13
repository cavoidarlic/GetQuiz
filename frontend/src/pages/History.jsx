import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useUser, useAuth } from '@clerk/clerk-react';
import {
  ArrowLeft, Clock, CheckCircle, PlusCircle, Zap,
  BookOpen, ChevronRight, HelpCircle, Loader2, AlertCircle,
  Trash2, Trophy, RotateCcw
} from 'lucide-react';
import '../styles/dashboard.css';
import { getHistory } from '../api/quizzes';
import { setTokenGetter } from '../api/client';
import Toast from '../components/Toast';

export default function History() {
  const { theme } = useTheme();
  const { user } = useUser();
  const { getToken } = useAuth();
  const userId = user?.id ?? 'anonymous';
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Inject Clerk token so the API client is authenticated
  useEffect(() => { setTokenGetter(getToken); }, [getToken]);

  // Fetch the unified activity log
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await getHistory(userId);
      if (!cancelled) {
        if (res.ok && Array.isArray(res.data)) {
          setEvents(res.data);
        }
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function handleEventClick(event) {
    if (event.type === 'quiz_deleted') {
      setToast({ message: 'This quiz has been deleted and no longer exists.', type: 'warn' });
      return;
    }
    if (event.quizId) {
      navigate('/dashboard', { state: { openQuizId: event.quizId } });
    }
  }

  // Derived stats from events
  const quizCreations = events.filter(e => e.type === 'quiz_created').length;
  const quizAttempts  = events.filter(e => e.type === 'quiz_attempted').length;
  const bestScore     = events
    .filter(e => e.type === 'quiz_attempted' && e.score != null)
    .reduce((max, e) => Math.max(max, e.score), -1);

  const groups = groupByDate(events);

  return (
    <div className="db-root">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Sidebar */}
      <aside className="db-sidebar">
        <Link to="/" className="db-brand" aria-label="Go to homepage">
          <div className="db-brand-icon"><Zap size={16} color="#f0eeff" strokeWidth={2.5} /></div>
          <span>GetQuiz</span>
        </Link>
        <div className="db-sidebar-footer" style={{ marginTop: 'auto' }}>
          <Link to="/dashboard" className="db-home-link">
            <ArrowLeft size={13} />
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="db-main db-view">
        <header className="db-view-header">
          <div>
            <h1 className="db-view-title">Activity History</h1>
            <p className="db-view-sub">
              Full log of quiz creations, attempts, and deletions.
            </p>
          </div>
        </header>

        {/* Stats bar */}
        {!loading && events.length > 0 && (
          <div className="db-stats-row" style={{ marginBottom: '1.75rem' }}>
            <div className="db-stat-card db-stat-accent">
              <div className="db-stat-icon"><PlusCircle size={18} /></div>
              <div>
                <p className="db-stat-value">{quizCreations}</p>
                <p className="db-stat-label">Quizzes Created</p>
              </div>
            </div>
            <div className="db-stat-card db-stat-cold">
              <div className="db-stat-icon"><RotateCcw size={18} /></div>
              <div>
                <p className="db-stat-value">{quizAttempts}</p>
                <p className="db-stat-label">Total Attempts</p>
              </div>
            </div>
            <div className="db-stat-card db-stat-warn">
              <div className="db-stat-icon"><Trophy size={18} /></div>
              <div>
                <p className="db-stat-value">{bestScore >= 0 ? `${bestScore}%` : '—'}</p>
                <p className="db-stat-label">Best Score</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="db-empty">
            <Loader2 size={32} className="spin" style={{ color: 'var(--accent-2)', opacity: 0.7 }} />
            <p className="db-empty-msg">Loading your history…</p>
          </div>
        ) : events.length === 0 ? (
          <div className="db-empty">
            <div className="db-empty-icon"><AlertCircle size={40} /></div>
            <p className="db-empty-msg">No activity yet. Head to the dashboard to create your first quiz!</p>
            <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="hist-timeline">
            {groups.map(({ label, items }) => (
              <div key={label} className="hist-group">
                <p className="hist-group-label">{label}</p>
                <ul className="hist-list">
                  {items.map(event => (
                    <li key={event.id}>
                      <button
                        className="hist-card"
                        onClick={() => handleEventClick(event)}
                        title={event.type === 'quiz_deleted' ? 'Quiz deleted' : `Open "${event.quizTitle}" in dashboard`}
                        style={event.type === 'quiz_deleted' ? { cursor: 'default', opacity: 0.75 } : {}}
                      >
                        {/* Badge */}
                        <EventBadge type={event.type} />

                        {/* Info */}
                        <div className="hist-card-body">
                          <p className="hist-card-title">{event.quizTitle}</p>
                          <div className="hist-card-meta">
                            {event.type === 'quiz_attempted' && event.score != null && (
                              <span style={{ color: scoreColour(event.score), fontWeight: 600 }}>
                                <Trophy size={11} /> {event.score}%
                              </span>
                            )}
                            <span>
                              <Clock size={11} />
                              {formatTime(event.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Arrow (not for deleted) */}
                        {event.type !== 'quiz_deleted' && (
                          <ChevronRight size={16} className="hist-card-arrow" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EventBadge({ type }) {
  if (type === 'quiz_created') {
    return (
      <span className="hist-badge hist-badge-created">
        <PlusCircle size={11} /> Created
      </span>
    );
  }
  if (type === 'quiz_attempted') {
    return (
      <span className="hist-badge hist-badge-attempted">
        <RotateCcw size={11} /> Attempted
      </span>
    );
  }
  return (
    <span className="hist-badge hist-badge-deleted">
      <Trash2 size={11} /> Deleted
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColour(pct) {
  if (pct >= 80) return '#3dffa0';
  if (pct >= 60) return '#9d7fff';
  if (pct >= 40) return '#ffbe3d';
  return '#ff7070';
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function groupByDate(events) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  const groups = {};
  events.forEach(event => {
    const d = new Date(event.createdAt);
    d.setHours(0, 0, 0, 0);
    let label;
    if (d >= today)          label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= lastWeek)  label = 'This Week';
    else {
      label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(event);
  });

  const ORDER = ['Today', 'Yesterday', 'This Week'];
  return Object.entries(groups)
    .sort(([a], [b]) => {
      const ai = ORDER.indexOf(a);
      const bi = ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return new Date(b) - new Date(a);
    })
    .map(([label, items]) => ({ label, items }));
}
