import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, XCircle, ChevronDown, RotateCcw, Home, Zap, Trophy } from 'lucide-react';
import '../styles/quiz.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function ScoreRing({ pct }) {
  const r = 50;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const colour = pct >= 80 ? '#3dffa0' : pct >= 60 ? '#9d7fff' : pct >= 40 ? '#ffbe3d' : '#ff7070';

  return (
    <div className="res-ring-wrap">
      <div className="res-ring">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle className="res-ring-bg" cx="60" cy="60" r={r} />
          <circle
            className="res-ring-fill"
            cx="60"
            cy="60"
            r={r}
            stroke={colour}
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="res-ring-label">
          <span className="res-ring-pct">{Math.round(pct)}</span>
          <span className="res-ring-pct-sym">%</span>
        </div>
      </div>
    </div>
  );
}

function GradeBadge({ pct }) {
  if (pct >= 80) return <span className="res-grade res-grade-excellent"><Trophy size={14} /> Excellent!</span>;
  if (pct >= 60) return <span className="res-grade res-grade-good"><CheckCircle size={14} /> Good Job</span>;
  if (pct >= 40) return <span className="res-grade res-grade-average"><CheckCircle size={14} /> Average</span>;
  return <span className="res-grade res-grade-poor"><XCircle size={14} /> Keep Practising</span>;
}

function BreakdownItem({ q, ans, idx }) {
  const [open, setOpen] = useState(false);

  const userAnswer = ans?.answer;
  const isCorrect = ans?.correct ?? false;

  function getAnswerLabel(q, val) {
    if (val === null || val === undefined) return 'No answer (timed out)';
    if (q.type === 'mcq') {
      const i = Number(val);
      return `${LETTERS[i]}. ${q.options?.[i] ?? val}`;
    }
    return val === true ? 'True' : 'False';
  }

  function getCorrectLabel(q) {
    if (q.type === 'mcq') {
      const i = q.correct_index;
      return `${LETTERS[i]}. ${q.options?.[i] ?? i}`;
    }
    return q.correct_answer === true ? 'True' : 'False';
  }

  return (
    <div className={`res-q-item ${isCorrect ? 'res-correct' : 'res-wrong'}`}>
      <div
        className="res-q-header"
        onClick={() => setOpen(o => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
      >
        <span className="res-q-icon">
          {isCorrect
            ? <CheckCircle size={16} color="var(--success)" />
            : <XCircle size={16} color="#ff7070" />}
        </span>
        <span className="res-q-num">Q{idx + 1}</span>
        <span className="res-q-text">{q.text}</span>
        <ChevronDown size={16} className={`res-q-chevron${open ? ' open' : ''}`} />
      </div>

      {open && (
        <div className="res-q-body">
          <div className="res-answer-row">
            <div className={`res-your-answer ${isCorrect ? 'ans-correct' : 'ans-wrong'}`}>
              {isCorrect ? <CheckCircle size={13} /> : <XCircle size={13} />}
              Your answer: {getAnswerLabel(q, userAnswer)}
            </div>
            {!isCorrect && (
              <div className="res-correct-answer">
                <CheckCircle size={13} />
                Correct: {getCorrectLabel(q)}
              </div>
            )}
          </div>
          {q.explanation && (
            <div style={{ marginTop: '0.75rem', padding: '0.625rem', backgroundColor: 'var(--surface-2)', borderRadius: '0.5rem', fontSize: '0.85rem', color: 'var(--text-1)' }}>
              <strong>Explanation:</strong> {q.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Results() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // State passed from QuizSession
  const { quiz, answers } = location.state ?? {};

  if (!quiz) {
    return (
      <div className="res-page">
        <div className="qs-center-msg">
          <p>No result data found.</p>
          <Link to="/dashboard" className="btn btn-ghost">Dashboard</Link>
        </div>
      </div>
    );
  }

  const questions = quiz.questions ?? [];
  const correct = answers?.filter(a => a.correct).length ?? 0;
  const total = questions.length;
  const pct = total > 0 ? (correct / total) * 100 : 0;

  return (
    <div className="res-page">
      {/* Top bar */}
      <div className="res-topbar">
        <Link to="/" className="qs-topbar-logo" aria-label="GetQuiz">
          <div className="qs-topbar-logo-icon">
            <Zap size={14} color="#f0eeff" strokeWidth={2.5} />
          </div>
          GetQuiz
        </Link>
      </div>

      {/* Score hero */}
      <div className="res-hero">
        <ScoreRing pct={pct} />
        <GradeBadge pct={pct} />
        <h1 className="res-quiz-title">{quiz.title}</h1>
        <p className="res-score-line">
          {correct} / {total} correct · {Math.round(pct)}%
        </p>

        <div className="res-actions">
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/dashboard')}
            id="results-dashboard-btn"
          >
            <Home size={16} /> Dashboard
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/quiz/${quiz.id}`)}
            id="results-retry-btn"
          >
            <RotateCcw size={16} /> Retry Quiz
          </button>
        </div>
      </div>

      {/* Question breakdown */}
      <div className="res-breakdown">
        <p className="res-breakdown-title">QUESTION BREAKDOWN</p>
        {questions.map((q, i) => (
          <BreakdownItem
            key={q.id ?? i}
            q={q}
            ans={answers?.[i]}
            idx={i}
          />
        ))}
      </div>
    </div>
  );
}
