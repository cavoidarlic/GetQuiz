import { useState, useReducer, useCallback, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Zap, Sun, Moon, LayoutDashboard, PlusCircle, ClipboardList,
  ChevronRight, Search, Trash2, Edit3, X, Plus, Check,
  ToggleLeft, CheckSquare, Clock, HelpCircle, ArrowLeft,
  AlertCircle, BookOpen, BarChart2, ChevronDown,
  Sparkles, Loader2, Trophy, RotateCcw
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useUser, useAuth } from '@clerk/clerk-react';
import '../styles/dashboard.css';
import { generateQuiz, getQuizzes, createQuiz, deleteQuiz, getHistory } from '../api/quizzes';
import { setTokenGetter } from '../api/client';
import LoadingOverlay from '../components/LoadingOverlay';
import Toast from '../components/Toast';


// ── Mock recent activity feed (replaced by live quiz state — see sidebar below)



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
  const { user } = useUser();
  const { getToken } = useAuth();
  const userId = user?.id ?? 'anonymous';
  const navigate = useNavigate();

  const [quizzes, dispatch] = useReducer(quizzesReducer, []);
  const [recentActivities, setRecentActivities] = useState([]);
  const [view, setView] = useState(VIEWS.HOME);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [search, setSearch] = useState('');
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [toast, setToast] = useState(null); // { message, type, options }
  // + description: Allow generic options mapping to Toast features like action buttons
  // + input: message (str), type (str), options (object from caller)
  // + output: setState containing toast configurations propagated to Toast element
  const showToast = (message, type = 'warn', options = {}) => setToast({ message, type, options });

  // ── Inject Clerk token into the API client once ───────────────
  useEffect(() => { setTokenGetter(getToken); }, [getToken]);

  // ── [Thêm useRef] Lưu lại các tiến trình có thể huỷ (AbortController)
  // Description: Chứa dictionary key-value { [quizId]: controller } để abort request khi Cancel/Edit
  // Input: không có. Output: Cung cấp dictionary quản lý abort controller theo id.
  const abortControllers = useRef({});

  const [initialAiConfig, setInitialAiConfig] = useState(null);

  // ── [Cập nhật] Xử lý F5 và Offline: Đọc localStorage khi mount
  // Description: Quét localStorage xem có task nào đang bị dở dang không, nếu có thì nạp lại vào state với trạng thái isFailed.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('getquiz_pending_tasks_v2');
      if (stored) {
        const pending = JSON.parse(stored);
        pending.forEach(q => {
          // Bất kì task nào lấy từ bộ nhớ tạm đều mặc định bị đứt kết nối (isFailed = true) do F5
          dispatch({ type: 'ADD_QUIZ', quiz: { ...q, isFailed: true } });
        });
      }
    } catch { /* parse error */ }
  }, []);

  // ── Load quizzes and history from backend on mount ───────────────────────
  useEffect(() => {
    if (!userId || userId === 'anonymous') return;
    let cancelled = false;
    async function loadData() {
      const resQuizzes = await getQuizzes(userId);
      if (!cancelled && resQuizzes.ok && Array.isArray(resQuizzes.data)) {
        resQuizzes.data.forEach(quiz => dispatch({ type: 'ADD_QUIZ', quiz }));
      }

      const resHistory = await getHistory(userId);
      if (!cancelled && resHistory.ok && Array.isArray(resHistory.data)) {
        setRecentActivities(resHistory.data);
      }

      if (!cancelled) setLoadingQuizzes(false);
    }
    loadData();
    return () => { cancelled = true; };
  }, [userId]);

  const location = useLocation();

  // + description: Điều hướng người dùng tới History.jsx và truyền data activity để mở đúng tab/modal
  // + input: đối tượng activity lấy từ danh sách recentActivities
  // + output: chuyển route sang /history kèm theo state targetActivity
  const handleActivityClick = useCallback((activity) => {
    navigate('/history', { state: { targetActivity: activity } });
  }, [navigate]);

  // ── Handle AI-generated quiz state passed via navigation ──────
  useEffect(() => {
    const aiQuiz = location.state?.generatedQuiz;
    if (aiQuiz) {
      dispatch({ type: 'ADD_QUIZ', quiz: aiQuiz });
      setSelectedQuiz(aiQuiz);
      setView(VIEWS.DETAIL);
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.generatedQuiz]);

  // ── [Mới] Handle openView state passed via navigation (from Hero) ──
  // Description: Nếu được điều hướng kèm openView ('create' hoặc 'generate'), Dashboard sẽ tự động mở view tương ứng.
  // Input: location.state.openView
  // Output: setView(VIEWS.CREATE hoặc VIEWS.AI_CREATE)
  useEffect(() => {
    const ov = location.state?.openView;
    if (ov === 'create') {
      setView(VIEWS.CREATE);
    } else if (ov === 'generate') {
      setView(VIEWS.AI_CREATE);
    }
    if (ov) window.history.replaceState({}, document.title);
  }, [location.state?.openView]);

  // ── Handle navigation from History page: open a specific quiz ──

  useEffect(() => {
    const openId = location.state?.openQuizId;
    if (!openId || quizzes.length === 0) return;
    const quiz = quizzes.find(q => q.id === openId);
    if (quiz) {
      openDetail(quiz);
    } else {
      showToast('This quiz has been deleted and no longer exists.', 'warn');
    }
    window.history.replaceState({}, document.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.openQuizId, quizzes]);


  const openDetail = useCallback((quiz) => {
    setSelectedQuiz(quiz);
    setView(VIEWS.DETAIL);
  }, []);

  const handleDelete = useCallback(async (id) => {
    dispatch({ type: 'DELETE_QUIZ', id });
    if (selectedQuiz?.id === id) setView(VIEWS.HOME);
    await deleteQuiz(id, userId);
  }, [selectedQuiz, userId]);

  const handleCreate = useCallback(async (quiz) => {
    const res = await createQuiz(userId, {
      title: quiz.title,
      description: quiz.description,
      tags: quiz.tags,
      difficulty: quiz.difficulty || 'easy',
      questions: quiz.questions,
    });
    const savedQuiz = res.ok ? res.data : quiz;
    dispatch({ type: 'ADD_QUIZ', quiz: savedQuiz });
    setView(VIEWS.HOME);
  }, [userId]);

  // ── [Mới] Khởi chạy tiến trình tạo AI ngầm (Background Task)
  // Description: Thiết lập Skeleton card, ghi vào localStorage, thiết lập AbortController rồi call API fetch.
  // Input: prompt (string), numQ (string/number), mix (string), customId (optional string phục vụ retry)
  // Output: Update state quizzes, gửi request về backend, gọi dispatch / showToast phụ thuộc payload api trả về.
  const handleStartAiTask = useCallback(async (prompt, numQ, mix, customId = null) => {
    const tempId = customId || `loading_${Date.now()}`;
    const skeletonQuiz = {
      id: tempId,
      title: "Generating AI Quiz...",
      description: prompt,
      tags: ['AI', 'Generating'],
      questions: [],
      createdAt: new Date().toISOString().slice(0, 10),
      isLoading: true,
      isFailed: false,
      aiTaskParams: { prompt, numQ, mix } // Gắn kèm param gốc để phục vụ Edit/Retry
    };

    // Ghi vào state, dùng UPDATE_QUIZ để override card nếu đang là retry (tức isFailed = true trước đó)
    // Nếu chưa từng có trong state, UPDATE_QUIZ trong reducer cũ không thêm mới, nên gọi cả ADD_QUIZ nếu không có customId
    if (customId) {
      dispatch({ type: 'UPDATE_QUIZ', quiz: skeletonQuiz });
    } else {
      dispatch({ type: 'ADD_QUIZ', quiz: skeletonQuiz });
    }

    // Chuyển view về Home
    setView(VIEWS.HOME);
    showToast("We will announce when the task completed. Feel free to enjoy other tasks!", "success");

    // Ghi vào localStorage để chống F5
    const stored = JSON.parse(localStorage.getItem('getquiz_pending_tasks_v2') || '[]');
    const newStored = stored.filter(q => q.id !== tempId);
    newStored.push(skeletonQuiz);
    localStorage.setItem('getquiz_pending_tasks_v2', JSON.stringify(newStored));

    // Khởi tạo AbortController gắn vào danh sách
    const controller = new AbortController();
    abortControllers.current[tempId] = controller;

    try {
      const res = await generateQuiz(userId, prompt, parseInt(numQ, 10), controller.signal);

      // Request kết thúc, dọn dẹp controller
      delete abortControllers.current[tempId];

      if (res.isAborted) return; // Nếu bị abort chủ động (Cancel/Edit) thì code cancel bên dưới đã dọn UI, không cần xử lý nữa.

      if (res.ok) {
        // Request thành công, xoá task khỏi storage
        const currentStored = JSON.parse(localStorage.getItem('getquiz_pending_tasks_v2') || '[]');
        localStorage.setItem('getquiz_pending_tasks_v2', JSON.stringify(currentStored.filter(q => q.id !== tempId)));

        // Cập nhật giao diện: thế chỗ dummy quiz bằng quiz mới
        dispatch({ type: 'DELETE_QUIZ', id: tempId });
        dispatch({ type: 'ADD_QUIZ', quiz: res.data.data });

        // + description: Show success toast with 'See now' button which redirects to newly generated quiz
        // + input: recent generated quiz object from API payload
        // + output: triggers openDetail and removes toast on action
        showToast("AI Quiz generated successfully!", "success", {
          actionText: "See now",
          autoClose: false,
          onAction: () => {
            setToast(null);
            openDetail(res.data.data);
          }
        });
      } else {
        // Lỗi từ backend (hoặc parse failed)
        dispatch({ type: 'UPDATE_QUIZ', quiz: { ...skeletonQuiz, isLoading: false, isFailed: true } });
        showToast(`Failed: ${res.error}`, "error");
      }

    } catch (err) {
      if (err.name === 'AbortError') return; // React fetch abort chủ động
      // Mất mạng
      dispatch({ type: 'UPDATE_QUIZ', quiz: { ...skeletonQuiz, isLoading: false, isFailed: true } });
      showToast("Network error generating AI Quiz", "error");
    }
  }, [userId, dispatch]);

  // ── [Mới] Huỷ tiến trình tạo AI
  // Description: Gọi controller.abort() huỷ request và dẹp tan state skeleton.
  // Input: id (string) của thẻ quiz
  const handleCancelAiTask = useCallback((id) => {
    if (abortControllers.current[id]) {
      abortControllers.current[id].abort();
      delete abortControllers.current[id];
    }
    dispatch({ type: 'DELETE_QUIZ', id });
    const currentStored = JSON.parse(localStorage.getItem('getquiz_pending_tasks_v2') || '[]');
    localStorage.setItem('getquiz_pending_tasks_v2', JSON.stringify(currentStored.filter(q => q.id !== id)));
    showToast("Process Cancelled", "warn");
  }, []);

  // ── [Mới] Chỉnh sửa tiến trình AI đang tạo
  // Description: Tương tự Cancel nhưng bảo lưu input values vào màn hình Edit
  // Input: quiz thẻ (object) chứa thông tin aiTaskParams
  const handleEditAiTask = useCallback((quiz) => {
    if (abortControllers.current[quiz.id]) {
      abortControllers.current[quiz.id].abort();
      delete abortControllers.current[quiz.id];
    }
    dispatch({ type: 'DELETE_QUIZ', id: quiz.id });
    const currentStored = JSON.parse(localStorage.getItem('getquiz_pending_tasks_v2') || '[]');
    localStorage.setItem('getquiz_pending_tasks_v2', JSON.stringify(currentStored.filter(q => q.id !== quiz.id)));

    // Đẩy parameter cũ qua form
    setInitialAiConfig(quiz.aiTaskParams);
    setView(VIEWS.AI_CREATE);
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
      {/* Global toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          {...toast.options}
        />
      )}

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

          {/* Recent Activity — loaded from unified backend logs */}
          <div className="db-recent-section">
            <p className="db-recent-title">Recent Activity</p>
            {recentActivities.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', padding: '0.25rem 0' }}>
                No recent activity.
              </p>
            ) : (
              <ul className="db-recent-list">
                {recentActivities.slice(0, 5).map(activity => {
                  let label = 'Action';
                  let dotClass = '';
                  let color = 'var(--text-3)';

                  if (activity.type === 'quiz_created') {
                    label = 'CREATED';
                    dotClass = 'db-recent-dot-created';
                    color = '#4ff8e5'; // cyan color
                  } else if (activity.type === 'quiz_attempted') {
                    label = 'ATTEMPTED';
                    color = '#eab308'; // yellow-500
                  } else if (activity.type === 'quiz_deleted') {
                    label = 'DELETED';
                    color = '#ef4444'; // red-500
                  }

                  return (
                    <li key={activity.id}>
                      <button
                        className="db-recent-item"
                        onClick={() => handleActivityClick(activity)}
                        title={`Open ${activity.quizTitle}`}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', font: 'inherit' }}
                      >
                        <span className={`db-recent-dot ${dotClass}`} style={{ backgroundColor: dotClass ? undefined : color }} />
                        <div className="db-recent-info">
                          <span className="db-recent-label" title={activity.quizTitle}>{activity.quizTitle}</span>
                          <span className="db-recent-meta">
                            <span style={{ color, fontWeight: 'bold' }}>{label}</span>
                            {' · '}{activity.createdAt?.split('T')[0]}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link to="/history" className="db-recent-more">View History</Link>
          </div>
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
            onAiCreate={() => { setInitialAiConfig(null); setView(VIEWS.AI_CREATE); }}
            loading={loadingQuizzes}
            onCancelAiTask={handleCancelAiTask}
            onEditAiTask={handleEditAiTask}
            onRetryAiTask={handleStartAiTask}
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
            userId={userId}
            initialConfig={initialAiConfig}
            onSave={(prompt, numQ, mix) => { setInitialAiConfig(null); handleStartAiTask(prompt, numQ, mix); }}
            onCancel={() => { setInitialAiConfig(null); setView(VIEWS.HOME); }}
          />
        )}
        {view === VIEWS.DETAIL && selectedQuiz && (
          <QuizDetail
            quiz={selectedQuiz}
            userId={userId}
            onBack={() => setView(VIEWS.HOME)}
            onDelete={() => handleDelete(selectedQuiz.id)}
          />
        )}
      </main>
    </div>
  );
}

// ── QuizList View ──────────────────────────────────────────────
function QuizList({ quizzes, allCount, search, onSearch, onOpen, onDelete, onCreate, onAiCreate, loading, onCancelAiTask, onEditAiTask, onRetryAiTask }) {
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
      {loading ? (
        <div className="db-empty">
          <Loader2 size={32} className="spin" style={{ color: 'var(--accent-2)', opacity: 0.7 }} />
          <p className="db-empty-msg">Loading your quizzes…</p>
        </div>
      ) : quizzes.length === 0 ? (
        <EmptyState message={search ? 'No quizzes match your search.' : 'No quizzes yet. Create your first one!'} onAction={!search ? onCreate : null} />
      ) : (
        <div className="db-quiz-grid">
          {quizzes.map(quiz => (
            <QuizCard key={quiz.id} quiz={quiz} onOpen={onOpen} onDelete={onDelete} onCancelAiTask={onCancelAiTask} onEditAiTask={onEditAiTask} onRetryAiTask={onRetryAiTask} />
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

function QuizCard({ quiz, onOpen, onDelete, onCancelAiTask, onEditAiTask, onRetryAiTask }) {
  // ── [Thêm mới] Hiển thị Card Skeleton cho trạng thái Loading / Failed
  // Description: Khi quiz đang chạy background task hoặc bị lỗi, hiển thị UI riêng biệt.
  // Input: quiz (object) từ vòng lặp state, onCancelAiTask, onEditAiTask, onRetryAiTask (của list đẩy xuống)
  // Output: Trả về JSX/UI dành riêng cho background task
  if (quiz.isLoading || quiz.isFailed) {
    return (
      <article className="db-quiz-card db-quiz-card-loading" style={{ borderStyle: 'dashed' }}>
        <div className="db-quiz-card-indicator" aria-hidden="true" style={{ background: quiz.isFailed ? 'var(--error-1)' : 'var(--accent-1)' }} />
        <header className="db-quiz-card-header">
          <h2 className="db-quiz-card-title">{quiz.title}</h2>
          <button
            className="db-quiz-card-delete"
            style={{ color: 'var(--text-3)', cursor: 'default' }}
            disabled
          >
            <Trash2 size={14} />
          </button>
        </header>
        <p className="db-quiz-card-desc" style={{ opacity: 0.8 }}>{quiz.description}</p>

        <div className="db-quiz-card-meta" style={{ marginTop: '1rem', color: quiz.isFailed ? 'var(--error-1)' : 'var(--accent-2)' }}>
          {quiz.isFailed ? (
            <><AlertCircle size={15} /> <span style={{ fontWeight: 500 }}>Generation interrupted</span></>
          ) : (
            <><Loader2 size={15} className="spin" /> <span style={{ fontWeight: 500 }}>Generating...</span></>
          )}
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          {quiz.isFailed ? (
            <>
              <button className="btn btn-sm" onClick={() => onRetryAiTask(quiz.aiTaskParams.prompt, quiz.aiTaskParams.numQ, quiz.aiTaskParams.mix, quiz.id)} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '0.4em' }}>
                <RotateCcw size={13} /> Reload
              </button>
              <button className="btn btn-sm db-delete-btn" onClick={() => onCancelAiTask(quiz.id)} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '0.4em' }}>
                <X size={13} /> Cancel
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-sm" onClick={() => onEditAiTask(quiz)} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '0.4em' }}>
                <Edit3 size={13} /> Edit
              </button>
              <button className="btn btn-sm db-delete-btn" onClick={() => onCancelAiTask(quiz.id)} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '0.4em' }}>
                <X size={13} /> Cancel
              </button>
            </>
          )}
        </div>
      </article>
    );
  }

  const mcqs = quiz.questions.filter(q => q.type === 'mcq').length;
  const tfs = quiz.questions.filter(q => q.type === 'tf').length;
  const hasAttempts = quiz.attemptCount > 0;

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

      {/* Attempt stats row — only shown once at least one attempt exists */}
      {hasAttempts && (
        <div className="db-attempt-stats">
          <span className="db-attempt-chip">
            <RotateCcw size={10} /> {quiz.attemptCount} attempt{quiz.attemptCount !== 1 ? 's' : ''}
          </span>
          {quiz.bestScore != null && (
            <span className="db-attempt-chip db-attempt-best">
              <Trophy size={10} /> Best: {quiz.bestScore}%
            </span>
          )}
          {quiz.lastAttempted && (
            <span className="db-attempt-chip db-attempt-last">
              <Clock size={10} /> Last: {quiz.lastAttempted}
            </span>
          )}
        </div>
      )}

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
function QuizDetail({ quiz, userId, onBack, onDelete }) {
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
            onClick={() => navigate(`/quiz/${quiz.id}`, { state: { quiz, userId } })}
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

// Description: Form cấu hình tạo AI
// Input: initialConfig (nếu có để phục hồi Edit), userId (string)
function AiCreateQuiz({ userId = 'anonymous', initialConfig, onSave, onCancel }) {
  // Nếu có initialConfig (do người dùng bấm Edit), các trường sẽ được điền tự động
  const [prompt, setPrompt] = useState(initialConfig?.prompt || '');
  const [numQ, setNumQ] = useState(initialConfig?.numQ || '5');
  const [mix, setMix] = useState(initialConfig?.mix || 'mixed');
  const [promptError, setPromptError] = useState('');

  // Description: Handle Generate Quiz button
  // Input: event from button click
  // Output: Gọi onSave để khởi tạo Background task tại Dashboard
  const handleGenerate = () => {
    if (!prompt.trim()) {
      setPromptError('Please describe a topic to generate questions about.');
      return;
    }
    setPromptError('');

    // Gọi thẳng lên handleStartAiTask trên Dashboard
    onSave(prompt, numQ, mix);
  };

  return (
    <div className="db-view">
      {/* Background task pattern, không cần Loading Overlay full màn hình nữa */}
      <header className="db-view-header">
        <div>
          <button className="db-back-btn" onClick={onCancel}>
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
            />
          </div>
          {promptError && <p className="db-error" style={{ marginTop: '0.375rem' }}>{promptError}</p>}
        </div>

        <h2 className="db-form-section-title db-ai-section-title" style={{ marginBottom: '0.75rem' }}>Options</h2>
        <div className="db-ai-config-row">
          <div className="db-ai-config-item">
            <label className="db-label" htmlFor="ai-num-q">Number of questions</label>
            <select id="ai-num-q" className="db-ai-select" value={numQ} onChange={e => setNumQ(e.target.value)}>
              <option value="3">3 questions</option>
              <option value="5">5 questions</option>
              <option value="8">8 questions</option>
              <option value="10">10 questions</option>
            </select>
          </div>
          <div className="db-ai-config-item">
            <label className="db-label" htmlFor="ai-mix">Question type</label>
            <select id="ai-mix" className="db-ai-select" value={mix} onChange={e => setMix(e.target.value)}>
              <option value="mixed">Mixed (MCQ + T/F)</option>
              <option value="mcq">Multiple Choice only</option>
              <option value="tf">True / False only</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '1.75rem' }}>
          <button className="btn-ai" onClick={handleGenerate} id="ai-generate-btn">
            <Sparkles size={15} /> Generate Quiz
          </button>
        </div>
      </section>
    </div>
  );
}
