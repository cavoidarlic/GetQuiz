import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle, X, Zap, Clock } from 'lucide-react';
import { getQuiz } from '../api/quizzes';
import { startSession, submitAnswer, finishSession } from '../api/sessions';
import { getMockQuiz } from '../data/mockQuizzes';
import '../styles/quiz.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const TIME_PER_Q = 30; // seconds

/* ── Mock session fallback when backend is unavailable ── */
function buildMockSession(quizId) {
  return { id: 'mock-session-' + quizId };
}

export default function QuizSession() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const stateQuiz = location.state?.quiz;

  const [quiz, setQuiz] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);   // user's pick
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState([]);        // {questionId, answer, correct}
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef(null);

  /* ── Load quiz & start session ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Use router state if passed directly from Dashboard, skipping memory database backend necessity
      if (stateQuiz) {
        setQuiz(stateQuiz);
        setSessionId(buildMockSession(quizId).id);
        setLoading(false);
        return;
      }

      const { ok, data, error: e } = await getQuiz(quizId);
      if (cancelled) return;

      if (!ok || !data) {
        // Backend offline — look up the quiz from shared mock data by id
        const mockQuiz = getMockQuiz(quizId) ?? {
          id: quizId,
          title: 'Quiz',
          questions: [],
        };
        setQuiz(mockQuiz);
        setSessionId(buildMockSession(quizId).id);
        setLoading(false);
        return;
      }

      // Try to start session
      const { ok: sOk, data: sData } = await startSession(quizId);
      if (!cancelled) {
        setQuiz(data);
        setSessionId(sOk && sData?.id ? sData.id : buildMockSession(quizId).id);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [quizId]);

  /* ── Countdown timer ── */
  useEffect(() => {
    if (!quiz || revealed) return;

    setTimeLeft(TIME_PER_Q);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleReveal(null);    // time's up → auto-reveal with no answer
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, quiz]);

  if (loading) {
    return (
      <div className="qs-page">
        <div className="qs-center-msg">
          <div className="qs-spinner" />
          Loading quiz…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="qs-page">
        <div className="qs-center-msg">
          <X size={36} />
          <p>{error}</p>
          <Link to="/dashboard" className="btn btn-ghost">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const questions = quiz?.questions ?? [];
  const q = questions[current];
  const progress = (current / questions.length) * 100;
  const timerClass = timeLeft <= 5 ? 'danger' : timeLeft <= 10 ? 'warn' : '';

  /* ── Option selection ── */
  function handleSelect(val) {
    if (revealed) return;
    setSelected(val);
  }

  /* ── Check answer & reveal ── */
  async function handleReveal(val) {
    clearInterval(timerRef.current);
    const answer = val ?? selected;

    // Determine correctness
    let correct = false;
    if (q.type === 'mcq') {
      correct = answer === q.correctIndex;
    } else {
      correct = answer === q.correct;
    }

    setAnswers(prev => [...prev, { questionId: q.id, answer, correct }]);
    setRevealed(true);

    // Fire-and-forget API call (works even if mock session)
    if (!sessionId?.startsWith('mock')) {
      submitAnswer(sessionId, q.id, String(answer)).catch(() => {});
    }
  }

  /* ── Next question or finish ── */
  async function handleNext() {
    if (current + 1 >= questions.length) {
      // Finish session
      setSubmitting(true);
      const allAnswers = answers; // already includes current

      if (!sessionId?.startsWith('mock')) {
        await finishSession(sessionId);
      }

      // Navigate to results with state
      navigate(`/results/${sessionId}`, {
        state: {
          quiz,
          answers: allAnswers,
          sessionId,
        },
      });
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
      setRevealed(false);
    }
  }

  /* ── Correct answer value ── */
  function getCorrectDisplay() {
    if (q.type === 'mcq') {
      const idx = q.correctIndex;
      return `${LETTERS[idx]}. ${q.options[idx]}`;
    }
    return q.correct === true ? 'True' : 'False';
  }

  const isLast = current + 1 >= questions.length;

  return (
    <div className="qs-page">
      {/* Top Bar */}
      <div className="qs-topbar">
        <Link to="/" className="qs-topbar-logo" aria-label="GetQuiz">
          <div className="qs-topbar-logo-icon">
            <Zap size={14} color="#f0eeff" strokeWidth={2.5} />
          </div>
          GetQuiz
        </Link>

        <span className="qs-counter">
          Question {current + 1} / {questions.length}
        </span>

        <button
          className="qs-exit-btn"
          onClick={() => navigate('/dashboard')}
          id="quiz-exit-btn"
        >
          <X size={14} /> Exit
        </button>
      </div>

      {/* Progress */}
      <div className="qs-progress-wrap">
        <div className="qs-progress-track">
          <div className="qs-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className={`qs-timer${timerClass ? ` ${timerClass}` : ''}`}>
          <Clock size={12} />
          {timeLeft}s remaining
        </div>
      </div>

      {/* Question Card */}
      <div className="qs-card" key={current}>
        <p className="qs-q-label">Q{current + 1} — {q.type === 'mcq' ? 'Multiple Choice' : 'True / False'}</p>
        <p className="qs-q-text">{q.text}</p>

        {/* MCQ options */}
        {q.type === 'mcq' && (
          <div className="qs-options">
            {(q.options ?? []).map((opt, i) => {
              let cls = '';
              if (revealed) {
                if (i === q.correctIndex) cls = 'correct';
                else if (i === selected && i !== q.correctIndex) cls = 'wrong';
              } else if (i === selected) {
                cls = 'selected';
              }

              return (
                <button
                  key={i}
                  className={`qs-option ${cls}`}
                  onClick={() => !revealed && handleSelect(i)}
                  disabled={revealed}
                  id={`quiz-option-${i}`}
                >
                  <span className="qs-option-letter">{LETTERS[i]}</span>
                  {opt}
                  {revealed && i === q.correctIndex && (
                    <CheckCircle size={16} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* T/F buttons */}
        {q.type === 'tf' && (
          <div className="qs-tf-row">
            {[true, false].map(val => {
              const label = val ? 'True' : 'False';
              let cls = '';
              if (revealed) {
                if (val === q.correct) cls = `correct-${label.toLowerCase()}`;
                else if (val === selected && val !== q.correct) cls = `wrong-${label.toLowerCase()}`;
              } else if (val === selected) {
                cls = `selected-${label.toLowerCase()}`;
              }

              return (
                <button
                  key={String(val)}
                  className={`qs-tf-btn ${cls}`}
                  onClick={() => !revealed && handleSelect(val)}
                  disabled={revealed}
                  id={`quiz-tf-${label.toLowerCase()}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Reveal if selected but not yet confirmed */}
        {!revealed && selected !== null && (
          <div className="qs-next-row">
            <button
              className="btn btn-primary qs-next-btn"
              onClick={() => handleReveal(selected)}
              id="quiz-confirm-btn"
            >
              Confirm <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Next / Finish */}
        {revealed && (
          <div className="qs-next-row">
            <button
              className="btn btn-primary qs-next-btn"
              onClick={handleNext}
              disabled={submitting}
              id="quiz-next-btn"
            >
              {submitting ? 'Saving…' : isLast ? 'See Results' : 'Next'}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
