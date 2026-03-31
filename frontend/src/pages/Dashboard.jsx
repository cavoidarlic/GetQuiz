import { useState, useReducer, useCallback, useMemo, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Zap, Sun, Moon, LayoutDashboard, PlusCircle, ClipboardList,
  ChevronRight, Search, Trash2, Edit3, X, Plus, Check,
  ToggleLeft, CheckSquare, Clock, HelpCircle, ArrowLeft,
  AlertCircle, BookOpen, BarChart2, ChevronDown,
  Sparkles, Loader2
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { MOCK_QUIZZES } from '../data/mockQuizzes';
import '../styles/dashboard.css';
import { generateQuiz } from '../api/quizzes';
import LoadingOverlay from '../components/LoadingOverlay';


// ── Reducer for quiz state ─────────────────────────────────────
function quizzesReducer(state, action) {
  switch (action.type) {
    case 'ADD_QUIZ':
      if (state.some(q => q.id === action.quiz.id)) return state;
      return [action.quiz, ...state];
    case 'DELETE_QUIZ':
      return state.filter(q => q.id !== action.id);
    case 'UPDATE_QUIZ':
      return state.map(q => q.id === action.quiz.id ? action.quiz : q);
    default:
      return state;
  }
}

// ── Views ──────────────────────────────────────────────────────
const VIEWS = { HOME: 'home', CREATE: 'create', DETAIL: 'detail', AI_CREATE: 'ai_create' };

export default function Dashboard() {
  const { theme, toggle } = useTheme();
  const [quizzes, dispatch] = useReducer(quizzesReducer, MOCK_QUIZZES);
  const [view, setView] = useState(VIEWS.HOME);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [search, setSearch] = useState('');

  // Loading state for generating process
  const location = useLocation();

  useEffect(() => {
    const aiQuiz = location.state?.generatedQuiz;
    if (aiQuiz) {
      dispatch({ type: 'ADD_QUIZ', quiz: aiQuiz });
      setSelectedQuiz(aiQuiz);
      setView(VIEWS.DETAIL);
      // Clear state so that refresh doesn't duplicate the quiz
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.generatedQuiz]);

  const openDetail = useCallback((quiz) => {
    setSelectedQuiz(quiz);
    setView(VIEWS.DETAIL);
  }, []);

  const handleDelete = useCallback((id) => {
    dispatch({ type: 'DELETE_QUIZ', id });
    if (selectedQuiz?.id === id) setView(VIEWS.HOME);
  }, [selectedQuiz]);

  const handleCreate = useCallback((quiz) => {
    dispatch({ type: 'ADD_QUIZ', quiz });
    setView(VIEWS.HOME);
  }, []);

  const handleAiCreate = useCallback((quiz) => {
    dispatch({ type: 'ADD_QUIZ', quiz });
    setSelectedQuiz(quiz);
    setView(VIEWS.DETAIL);
  }, []);

  const filteredQuizzes = useMemo(() =>
    quizzes.filter(q =>
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase()) ||
      q.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    ), [quizzes, search]
  );

  return (
    <div className="db-root">
      {/* Sidebar */}
      <aside className="db-sidebar">
        <Link to="/" className="db-brand" aria-label="Go to homepage">
          <div className="db-brand-icon"><Zap size={16} color="#f0eeff" strokeWidth={2.5} /></div>
          <span>GetQuiz</span>
        </Link>

        <nav className="db-nav" aria-label="Dashboard navigation">
          <button
            className={`db-nav-item${view === VIEWS.HOME || view === VIEWS.DETAIL ? ' active' : ''}`}
            onClick={() => setView(VIEWS.HOME)}
          >
            <LayoutDashboard size={16} />
            My Quizzes
            <span className="db-nav-badge">{quizzes.length}</span>
          </button>
          <button
            className={`db-nav-item${view === VIEWS.CREATE ? ' active' : ''}`}
            onClick={() => setView(VIEWS.CREATE)}
          >
            <PlusCircle size={16} />
            Create Quiz
          </button>
          <button
            className={`db-nav-item${view === VIEWS.AI_CREATE ? ' active-ai' : ''}`}
            onClick={() => setView(VIEWS.AI_CREATE)}
          >
            <Sparkles size={16} />
            Quiz with AI
          </button>
        </nav>

        <div className="db-sidebar-footer">
          <button
            className="db-theme-toggle"
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <Link to="/" className="db-home-link">
            <ArrowLeft size={13} />
            Back to Home
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="db-main">
        {view === VIEWS.HOME && (
          <QuizList
            quizzes={filteredQuizzes}
            allCount={quizzes.length}
            search={search}
            onSearch={setSearch}
            onOpen={openDetail}
            onDelete={handleDelete}
            onCreate={() => setView(VIEWS.CREATE)}
            onAiCreate={() => setView(VIEWS.AI_CREATE)}
          />
        )}
        {view === VIEWS.CREATE && (
          <CreateQuiz
            onSave={handleCreate}
            onCancel={() => setView(VIEWS.HOME)}
          />
        )}
        {view === VIEWS.AI_CREATE && (
          <AiCreateQuiz
            onSave={handleAiCreate}
            onCancel={() => setView(VIEWS.HOME)}
          />
        )}
        {view === VIEWS.DETAIL && selectedQuiz && (
          <QuizDetail
            quiz={selectedQuiz}
            onBack={() => setView(VIEWS.HOME)}
            onDelete={() => handleDelete(selectedQuiz.id)}
          />
        )}
      </main>
    </div>
  );
}

// ── QuizList View ──────────────────────────────────────────────
function QuizList({ quizzes, allCount, search, onSearch, onOpen, onDelete, onCreate, onAiCreate }) {
  return (
    <div className="db-view">
      <header className="db-view-header">
        <div>
          <h1 className="db-view-title">My Quizzes</h1>
          <p className="db-view-sub">{allCount} quiz{allCount !== 1 ? 'zes' : ''} in your library</p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary db-create-btn" onClick={onCreate}>
            <Plus size={16} />
            New Quiz
          </button>
          <button className="btn-ai" onClick={onAiCreate} id="quiz-with-ai-btn">
            <Sparkles size={15} />
            Quiz with AI
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="db-search-wrap">
        <Search size={15} className="db-search-icon" />
        <input
          className="db-search"
          type="search"
          placeholder="Search quizzes, tags…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          aria-label="Search quizzes"
        />
      </div>

      {/* Stats row */}
      <div className="db-stats-row">
        <StatCard icon={<BookOpen size={18} />} label="Total Quizzes" value={allCount} color="accent" />
        <StatCard
          icon={<HelpCircle size={18} />}
          label="Total Questions"
          value={quizzes.reduce((s, q) => s + q.questions.length, 0)}
          color="cold"
        />
        <StatCard icon={<BarChart2 size={18} />} label="Avg. Questions" value={allCount ? Math.round(quizzes.reduce((s, q) => s + q.questions.length, 0) / allCount) : 0} color="warn" />
      </div>

      {/* Quiz cards */}
      {quizzes.length === 0 ? (
        <EmptyState message={search ? 'No quizzes match your search.' : 'No quizzes yet. Create your first one!'} onAction={!search ? onCreate : null} />
      ) : (
        <div className="db-quiz-grid">
          {quizzes.map(quiz => (
            <QuizCard key={quiz.id} quiz={quiz} onOpen={onOpen} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className={`db-stat-card db-stat-${color}`}>
      <div className="db-stat-icon">{icon}</div>
      <div>
        <p className="db-stat-value">{value}</p>
        <p className="db-stat-label">{label}</p>
      </div>
    </div>
  );
}

function QuizCard({ quiz, onOpen, onDelete }) {
  const mcqs = quiz.questions.filter(q => q.type === 'mcq').length;
  const tfs = quiz.questions.filter(q => q.type === 'tf').length;

  return (
    <article className="db-quiz-card">
      <div className="db-quiz-card-indicator" aria-hidden="true" />
      <header className="db-quiz-card-header">
        <h2 className="db-quiz-card-title" title={quiz.title}>{quiz.title}</h2>
        <button
          className="db-quiz-card-delete"
          onClick={e => { e.stopPropagation(); onDelete(quiz.id); }}
          aria-label={`Delete ${quiz.title}`}
        >
          <Trash2 size={14} />
        </button>
      </header>
      <p className="db-quiz-card-desc">{quiz.description}</p>

      <div className="db-quiz-card-tags">
        {quiz.tags.map(t => <span key={t} className="db-tag">{t}</span>)}
      </div>

      <div className="db-quiz-card-meta">
        <span className="db-meta-chip db-meta-mcq">
          <CheckSquare size={11} /> {mcqs} MCQ
        </span>
        <span className="db-meta-chip db-meta-tf">
          <ToggleLeft size={11} /> {tfs} T/F
        </span>
        <span className="db-quiz-card-date">
          <Clock size={11} /> {quiz.createdAt}
        </span>
      </div>

      <button className="db-quiz-card-open" onClick={() => onOpen(quiz)}>
        View Questions <ChevronRight size={14} />
      </button>
    </article>
  );
}

function EmptyState({ message, onAction }) {
  return (
    <div className="db-empty">
      <div className="db-empty-icon"><ClipboardList size={40} /></div>
      <p className="db-empty-msg">{message}</p>
      {onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          <Plus size={15} /> Create First Quiz
        </button>
      )}
    </div>
  );
}

// ── QuizDetail View ────────────────────────────────────────────
function QuizDetail({ quiz, onBack, onDelete }) {
  const mcqs = quiz.questions.filter(q => q.type === 'mcq').length;
  const tfs = quiz.questions.filter(q => q.type === 'tf').length;
  const navigate = useNavigate();

  return (
    <div className="db-view">
      <header className="db-view-header">
        <div>
          <button className="db-back-btn" onClick={onBack}>
            <ArrowLeft size={14} /> All Quizzes
          </button>
          <h1 className="db-view-title">{quiz.title}</h1>
          <p className="db-view-sub">{quiz.description}</p>
        </div>
        <div className="res-actions" style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/quiz/${quiz.id}`, { state: { quiz } })}
            id={`quiz-start-btn-${quiz.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            Start Quiz
          </button>
          <button
            className="btn db-delete-btn"
            onClick={onDelete}
            aria-label="Delete quiz"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Trash2 size={14} /> Delete Quiz
          </button>
        </div>
      </header>

      <div className="db-detail-meta">
        <span className="db-meta-chip db-meta-mcq"><CheckSquare size={12} /> {mcqs} MCQ</span>
        <span className="db-meta-chip db-meta-tf"><ToggleLeft size={12} /> {tfs} T/F</span>
        <span className="db-quiz-card-date"><Clock size={12} /> {quiz.createdAt}</span>
        {quiz.tags.map(t => <span key={t} className="db-tag">{t}</span>)}
      </div>

      <div className="db-questions-list">
        {quiz.questions.map((q, idx) => (
          <QuestionCard key={q.id} question={q} index={idx} />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ question, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`db-question-card${expanded ? ' expanded' : ''}`}>
      <button className="db-question-header" onClick={() => setExpanded(e => !e)}>
        <span className="db-question-num">Q{index + 1}</span>
        <span className={`db-question-type-badge db-type-${question.type}`}>
          {question.type === 'mcq' ? <CheckSquare size={11} /> : <ToggleLeft size={11} />}
          {question.type === 'mcq' ? 'MCQ' : 'True / False'}
        </span>
        <span className="db-question-text">{question.text}</span>
        <ChevronDown size={15} className={`db-question-chevron${expanded ? ' rotated' : ''}`} />
      </button>

      {expanded && (
        <div className="db-question-body">
          {question.type === 'mcq' ? (
            <ul className="db-options-list">
              {question.options.map((opt, i) => (
                <li key={i} className={`db-option${i === question.correctIndex ? ' correct' : ''}`}>
                  <span className="db-option-letter">{String.fromCharCode(65 + i)}</span>
                  {opt}
                  {i === question.correctIndex && <Check size={13} className="db-option-check" />}
                </li>
              ))}
            </ul>
          ) : (
            <div className="db-tf-answer">
              <span className={`db-tf-badge db-tf-${question.correct ? 'true' : 'false'}`}>
                {question.correct ? <Check size={14} /> : <X size={14} />}
                Correct answer: <strong>{question.correct ? 'True' : 'False'}</strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── CreateQuiz View ────────────────────────────────────────────
const EMPTY_MCQ = () => ({ id: Date.now() + Math.random(), type: 'mcq', text: '', options: ['', '', '', ''], correctIndex: 0 });
const EMPTY_TF = () => ({ id: Date.now() + Math.random(), type: 'tf', text: '', correct: true });

function CreateQuiz({ onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [questions, setQuestions] = useState([]);
  const [errors, setErrors] = useState({});

  const addQuestion = (type) => {
    setQuestions(qs => [...qs, type === 'mcq' ? EMPTY_MCQ() : EMPTY_TF()]);
  };

  const removeQuestion = (id) => {
    setQuestions(qs => qs.filter(q => q.id !== id));
  };

  const updateQuestion = (id, patch) => {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q));
  };

  const updateOption = (qid, oIdx, value) => {
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid) return q;
      const options = [...q.options];
      options[oIdx] = value;
      return { ...q, options };
    }));
  };

  const validate = () => {
    const e = {};
    if (!title.trim()) e.title = 'Quiz title is required.';
    if (questions.length === 0) e.questions = 'Add at least one question.';
    questions.forEach((q, i) => {
      if (!q.text.trim()) e[`q${i}_text`] = `Question ${i + 1} needs a prompt.`;
      if (q.type === 'mcq') {
        q.options.forEach((o, oi) => {
          if (!o.trim()) e[`q${i}_o${oi}`] = `Q${i + 1} Option ${String.fromCharCode(65 + oi)} is empty.`;
        });
      }
    });
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const quiz = {
      id: Date.now(),
      title: title.trim(),
      description: description.trim() || 'No description provided.',
      createdAt: new Date().toISOString().slice(0, 10),
      questionCount: questions.length,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      questions: questions.map((q, i) => ({ ...q, id: i + 1 }))
    };
    onSave(quiz);
  };

  return (
    <div className="db-view">
      <header className="db-view-header">
        <div>
          <button className="db-back-btn" onClick={onCancel}>
            <ArrowLeft size={14} /> Cancel
          </button>
          <h1 className="db-view-title">Create New Quiz</h1>
          <p className="db-view-sub">Add questions below and save when ready.</p>
        </div>
        <button className="btn btn-primary db-create-btn" onClick={handleSave}>
          <Check size={15} /> Save Quiz
        </button>
      </header>

      {/* Quiz metadata */}
      <section className="db-form-section">
        <h2 className="db-form-section-title">Quiz Details</h2>
        <div className="db-form-grid">
          <div className="db-form-field">
            <label className="db-label" htmlFor="quiz-title">Title *</label>
            <input
              id="quiz-title"
              className={`db-input${errors.title ? ' error' : ''}`}
              value={title}
              onChange={e => { setTitle(e.target.value); setErrors(err => ({ ...err, title: undefined })); }}
              placeholder="e.g. JavaScript Fundamentals"
            />
            {errors.title && <p className="db-error">{errors.title}</p>}
          </div>
          <div className="db-form-field">
            <label className="db-label" htmlFor="quiz-desc">Description</label>
            <input
              id="quiz-desc"
              className="db-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief summary of what this quiz covers…"
            />
          </div>
          <div className="db-form-field">
            <label className="db-label" htmlFor="quiz-tags">Tags <span className="db-label-hint">(comma-separated)</span></label>
            <input
              id="quiz-tags"
              className="db-input"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="JavaScript, React, Frontend"
            />
          </div>
        </div>
      </section>

      {/* Questions */}
      <section className="db-form-section">
        <div className="db-questions-header">
          <h2 className="db-form-section-title">
            Questions
            <span className="db-question-count">{questions.length}</span>
          </h2>
          <div className="db-add-btns">
            <button className="btn btn-ghost btn-sm" onClick={() => addQuestion('mcq')} id="add-mcq-btn">
              <CheckSquare size={14} /> Add MCQ
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => addQuestion('tf')} id="add-tf-btn">
              <ToggleLeft size={14} /> Add T/F
            </button>
          </div>
        </div>

        {errors.questions && <p className="db-error db-error-top">{errors.questions}</p>}

        {questions.length === 0 ? (
          <div className="db-empty db-empty-sm">
            <HelpCircle size={28} />
            <p>No questions yet. Add MCQ or True/False questions above.</p>
          </div>
        ) : (
          <div className="db-editor-list">
            {questions.map((q, idx) => (
              q.type === 'mcq'
                ? <MCQEditor key={q.id} q={q} idx={idx} errors={errors} onUpdate={updateQuestion} onOption={updateOption} onRemove={removeQuestion} />
                : <TFEditor key={q.id} q={q} idx={idx} errors={errors} onUpdate={updateQuestion} onRemove={removeQuestion} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MCQEditor({ q, idx, errors, onUpdate, onOption, onRemove }) {
  return (
    <div className="db-q-editor">
      <div className="db-q-editor-header">
        <span className="db-question-num">Q{idx + 1}</span>
        <span className="db-question-type-badge db-type-mcq"><CheckSquare size={11} /> MCQ</span>
        <button className="db-remove-btn" onClick={() => onRemove(q.id)} aria-label="Remove question">
          <X size={14} />
        </button>
      </div>

      <div className="db-form-field">
        <label className="db-label" htmlFor={`q-text-${q.id}`}>Question Prompt *</label>
        <textarea
          id={`q-text-${q.id}`}
          className={`db-input db-textarea${errors[`q${idx}_text`] ? ' error' : ''}`}
          value={q.text}
          onChange={e => onUpdate(q.id, { text: e.target.value })}
          placeholder="Enter your question…"
          rows={2}
        />
        {errors[`q${idx}_text`] && <p className="db-error">{errors[`q${idx}_text`]}</p>}
      </div>

      <div className="db-options-editor">
        <p className="db-label">Options — click the circle to mark correct answer</p>
        {q.options.map((opt, oi) => (
          <div key={oi} className={`db-option-editor${q.correctIndex === oi ? ' selected' : ''}`}>
            <button
              className="db-option-radio"
              onClick={() => onUpdate(q.id, { correctIndex: oi })}
              aria-label={`Mark option ${String.fromCharCode(65 + oi)} as correct`}
            >
              {q.correctIndex === oi ? <Check size={11} /> : null}
            </button>
            <span className="db-option-letter">{String.fromCharCode(65 + oi)}</span>
            <input
              className={`db-option-input${errors[`q${idx}_o${oi}`] ? ' error' : ''}`}
              value={opt}
              onChange={e => onOption(q.id, oi, e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TFEditor({ q, idx, errors, onUpdate, onRemove }) {
  return (
    <div className="db-q-editor">
      <div className="db-q-editor-header">
        <span className="db-question-num">Q{idx + 1}</span>
        <span className="db-question-type-badge db-type-tf"><ToggleLeft size={11} /> T/F</span>
        <button className="db-remove-btn" onClick={() => onRemove(q.id)} aria-label="Remove question">
          <X size={14} />
        </button>
      </div>

      <div className="db-form-field">
        <label className="db-label" htmlFor={`q-tf-text-${q.id}`}>Statement *</label>
        <textarea
          id={`q-tf-text-${q.id}`}
          className={`db-input db-textarea${errors[`q${idx}_text`] ? ' error' : ''}`}
          value={q.text}
          onChange={e => onUpdate(q.id, { text: e.target.value })}
          placeholder="Enter a true or false statement…"
          rows={2}
        />
        {errors[`q${idx}_text`] && <p className="db-error">{errors[`q${idx}_text`]}</p>}
      </div>

      <div className="db-tf-toggle-row">
        <p className="db-label">Correct Answer</p>
        <div className="db-tf-buttons">
          <button
            className={`db-tf-btn${q.correct === true ? ' active-true' : ''}`}
            onClick={() => onUpdate(q.id, { correct: true })}
          >
            <Check size={13} /> True
          </button>
          <button
            className={`db-tf-btn${q.correct === false ? ' active-false' : ''}`}
            onClick={() => onUpdate(q.id, { correct: false })}
          >
            <X size={13} /> False
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AiCreateQuiz View ──────────────────────────────────────────

function AiCreateQuiz({ onSave, onCancel }) {
  const [prompt, setPrompt] = useState('');
  const [numQ, setNumQ] = useState('5');
  const [mix, setMix] = useState('mixed');
  const [promptError, setPromptError] = useState('');
  const [loadingState, setLoadingState] = useState('idle');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setPromptError('Please describe a topic to generate questions about.');
      return;
    }
    setPromptError('');
    
    try {
      setLoadingState('checking');
      
      // Delay slightly (UX Optional) before switching text
      setTimeout(() => {
        setLoadingState(prev => prev === 'checking' ? 'generating' : prev);
      }, 1500);

      // Call real API endpoint
      const res = await generateQuiz(prompt, parseInt(numQ, 10));

      if (!res.ok) {
        setLoadingState('idle');
        alert("Failed: " + res.error);
        return;
      }

      setLoadingState('idle');
      // Pass the fully structured JSON quiz payload into Dashboard's library
      onSave(res.data.data);

    } catch (err) {
      setLoadingState('idle');
      alert("Server connection error. Please ensure FastAPI is running.");
    }
  };

  return (
    <div className="db-view">
      <LoadingOverlay loadingState={loadingState} />
      <header className="db-view-header">
        <div>
          <button className="db-back-btn" onClick={onCancel} disabled={loadingState !== 'idle'}>
            <ArrowLeft size={14} /> Cancel
          </button>
          <h1 className="db-view-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={22} color="#10c9a3" /> Quiz with AI
          </h1>
          <p className="db-view-sub">
            Describe a topic and let AI draft your questions.
          </p>
        </div>
      </header>

      <section className="db-form-section">
        <h2 className="db-form-section-title db-ai-section-title">Topic &amp; Prompt</h2>
        <div className="db-form-field" style={{ marginBottom: '1.25rem' }}>
          <label className="db-label" htmlFor="ai-prompt">
            What is this quiz about? *
          </label>
          <div className="db-ai-prompt-wrap">
            <textarea
              id="ai-prompt"
              className="db-ai-prompt"
              value={prompt}
              onChange={e => { setPrompt(e.target.value); setPromptError(''); }}
              placeholder="e.g. World War II history, React hooks, photosynthesis, the French Revolution…"
              rows={3}
              disabled={loadingState !== 'idle'}
            />
          </div>
          {promptError && <p className="db-error" style={{ marginTop: '0.375rem' }}>{promptError}</p>}
        </div>

        <h2 className="db-form-section-title db-ai-section-title" style={{ marginBottom: '0.75rem' }}>Options</h2>
        <div className="db-ai-config-row">
          <div className="db-ai-config-item">
            <label className="db-label" htmlFor="ai-num-q">Number of questions</label>
            <select id="ai-num-q" className="db-ai-select" value={numQ} onChange={e => setNumQ(e.target.value)} disabled={loadingState !== 'idle'}>
              <option value="3">3 questions</option>
              <option value="5">5 questions</option>
              <option value="8">8 questions</option>
              <option value="10">10 questions</option>
            </select>
          </div>
          <div className="db-ai-config-item">
            <label className="db-label" htmlFor="ai-mix">Question type</label>
            <select id="ai-mix" className="db-ai-select" value={mix} onChange={e => setMix(e.target.value)} disabled={loadingState !== 'idle'}>
              <option value="mixed">Mixed (MCQ + T/F)</option>
              <option value="mcq">Multiple Choice only</option>
              <option value="tf">True / False only</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '1.75rem' }}>
          <button className="btn-ai" onClick={handleGenerate} id="ai-generate-btn" disabled={loadingState !== 'idle'}>
            <Sparkles size={15} /> Generate Quiz
          </button>
        </div>
      </section>
    </div>
  );
}
