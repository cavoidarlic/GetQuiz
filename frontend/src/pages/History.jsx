import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useUser, useAuth } from '@clerk/clerk-react';
import {
  ArrowLeft, Clock, CheckCircle, PlusCircle, Zap,
  BookOpen, ChevronRight, HelpCircle, Loader2, AlertCircle
} from 'lucide-react';
import '../styles/dashboard.css';
import { getQuizzes } from '../api/quizzes';
import { setTokenGetter } from '../api/client';
import Toast from '../components/Toast';

export default function History() {
  const { theme } = useTheme();
  const { user } = useUser();
  const { getToken } = useAuth();
  const userId = user?.id ?? null;
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Inject Clerk token so the API client is authenticated
  useEffect(() => { setTokenGetter(getToken); }, [getToken]);

  // Fetch all quizzes for this user
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await getQuizzes(userId);
      if (!cancelled) {
        if (res.ok && Array.isArray(res.data)) {
          // Sort newest first (API already does this but guarantee it client-side too)
          setQuizzes([...res.data].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          ));
        }
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function handleQuizClick(quiz) {
    // Navigate to dashboard and ask it to open this specific quiz
    navigate('/dashboard', { state: { openQuizId: quiz.id } });
  }

  // Partition quizzes by score availability (we don't store scores yet,
  // so all show as "Created" events — ready for attempt data later)
  const groups = groupByDate(quizzes);

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
              Your complete quiz library — click any quiz to open it.
            </p>
          </div>
        </header>

        {/* Stats bar */}
        {!loading && quizzes.length > 0 && (
          <div className="db-stats-row" style={{ marginBottom: '1.75rem' }}>
            <div className="db-stat-card db-stat-accent">
              <div className="db-stat-icon"><BookOpen size={18} /></div>
              <div>
                <p className="db-stat-value">{quizzes.length}</p>
                <p className="db-stat-label">Total Quizzes</p>
              </div>
            </div>
            <div className="db-stat-card db-stat-cold">
              <div className="db-stat-icon"><HelpCircle size={18} /></div>
              <div>
                <p className="db-stat-value">
                  {quizzes.reduce((s, q) => s + (q.questionCount ?? q.questions?.length ?? 0), 0)}
                </p>
                <p className="db-stat-label">Total Questions</p>
              </div>
            </div>
            <div className="db-stat-card db-stat-warn">
              <div className="db-stat-icon"><CheckCircle size={18} /></div>
              <div>
                <p className="db-stat-value">
                  {quizzes.length
                    ? Math.round(
                        quizzes.reduce((s, q) => s + (q.questionCount ?? q.questions?.length ?? 0), 0)
                        / quizzes.length
                      )
                    : 0}
                </p>
                <p className="db-stat-label">Avg. Questions</p>
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
        ) : quizzes.length === 0 ? (
          <div className="db-empty">
            <div className="db-empty-icon"><AlertCircle size={40} /></div>
            <p className="db-empty-msg">No quizzes yet. Head to the dashboard to create your first one!</p>
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
                  {items.map(quiz => (
                    <li key={quiz.id}>
                      <button
                        className="hist-card"
                        onClick={() => handleQuizClick(quiz)}
                        title={`Open "${quiz.title}" in dashboard`}
                      >
                        {/* Action badge */}
                        <span className="hist-badge hist-badge-created">
                          <PlusCircle size={11} /> Created
                        </span>

                        {/* Quiz info */}
                        <div className="hist-card-body">
                          <p className="hist-card-title">{quiz.title}</p>
                          {quiz.description && (
                            <p className="hist-card-desc">{quiz.description}</p>
                          )}
                          <div className="hist-card-meta">
                            <span>
                              <HelpCircle size={11} />
                              {quiz.questionCount ?? quiz.questions?.length ?? '?'} questions
                            </span>
                            <span>
                              <Clock size={11} />
                              {quiz.createdAt}
                            </span>
                            {quiz.tags?.slice(0, 3).map(t => (
                              <span key={t} className="db-tag">{t}</span>
                            ))}
                          </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight size={16} className="hist-card-arrow" />
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByDate(quizzes) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  const groups = {};
  quizzes.forEach(quiz => {
    const d = new Date(quiz.createdAt);
    d.setHours(0, 0, 0, 0);
    let label;
    if (d >= today)          label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= lastWeek)  label = 'This Week';
    else {
      label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(quiz);
  });

  // Preserve logical order
  const ORDER = ['Today', 'Yesterday', 'This Week'];
  return Object.entries(groups)
    .sort(([a], [b]) => {
      const ai = ORDER.indexOf(a);
      const bi = ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return new Date(b) - new Date(a); // month groups: newest first
    })
    .map(([label, items]) => ({ label, items }));
}
