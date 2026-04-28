import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  ArrowLeft, Clock, CheckSquare, ToggleLeft,
  Check, X, ChevronDown, Zap, Loader2
} from 'lucide-react';
import '../styles/dashboard.css';
import { getQuiz } from '../api/quizzes';
import { useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// QuizPreview page — standalone route: /quiz-preview/:quizId
// Shows quiz info, question list, and a "Start Quiz" button.
// Accessible from both History (CREATED tab) and Dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export default function QuizPreview() {
  const { quizId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();

  // description: Thử lấy quiz data từ location.state trước (truyền từ History)
  // input: location.state.quiz (nếu có), fallback fetch từ API nếu không có
  // output: quiz object đầy đủ để render giao diện preview
  const [quiz, setQuiz] = useState(location.state?.quiz ?? null);
  const [loading, setLoading] = useState(!location.state?.quiz);
  const userId = location.state?.userId ?? user?.id ?? 'anonymous';

  // description: Nếu không có data từ state (user truy cập URL trực tiếp), fetch từ API
  // input: quizId từ URL params
  // output: cập nhật state quiz
  useEffect(() => {
    if (quiz) return; // đã có data, bỏ qua
    (async () => {
      setLoading(true);
      const { ok, data } = await getQuiz(quizId);
      if (ok && data) setQuiz(data);
      setLoading(false);
    })();
  }, [quizId]);

  if (loading) {
    return (
      <div className="db-root" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 size={36} className="spin" style={{ color: 'var(--accent-1)' }} />
        <p style={{ marginTop: '1rem', opacity: 0.6 }}>Loading quiz...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="db-root" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ opacity: 0.6 }}>Quiz not found.</p>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginTop: '1rem' }}>
          <ArrowLeft size={14} /> Go Back
        </button>
      </div>
    );
  }

  const mcqs = quiz.questions.filter(q => q.type === 'mcq').length;
  const tfs = quiz.questions.filter(q => q.type === 'tf').length;

  return (
    /*
      Description: Trang QuizPreview độc lập — hiển thị thông tin quiz và nút "Start Quiz"
      Input: quiz object (từ location.state hoặc fetch API), userId
      Output: giao diện preview đầy đủ với sidebar và main content
    */
    <div className="db-root">
      {/* Sidebar */}
      <aside className="db-sidebar">
        <div className="db-brand">
          <div className="db-brand-icon"><Zap size={16} color="#f0eeff" strokeWidth={2.5} /></div>
          <span>GetQuiz</span>
        </div>
        <div className="db-sidebar-footer" style={{ marginTop: 'auto' }}>
          <button className="db-home-link" onClick={() => navigate(-1)}>
            <ArrowLeft size={13} /> Back
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="db-main db-view">
        <header className="db-view-header">
          <div>
            {/*
              Description: Nút back điều hướng trở về trang trước (History hoặc Dashboard)
              Input: browser history stack
              Output: navigate(-1)
            */}
            <button className="db-back-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={14} /> Back
            </button>
            <h1 className="db-view-title">{quiz.title}</h1>
            <p className="db-view-sub">{quiz.description}</p>
          </div>

          {/*
            Description: Nút Start Quiz — navigate tới /quiz/:id với đầy đủ dữ liệu
            Input: quiz object, userId
            Output: navigate('/quiz/:id', { state: { quiz, userId } })
          */}
          <div className="res-actions" style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/quiz/${quiz.id}`, { state: { quiz, userId } })}
              id={`quiz-preview-start-${quiz.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              Start Quiz
            </button>
          </div>
        </header>

        {/*
          Description: Meta thông tin quiz (số MCQ, T/F, ngày tạo, tags)
          Input: quiz.questions, quiz.tags, quiz.createdAt
          Output: các chip thông tin hiển thị bên dưới header
        */}
        <div className="db-detail-meta">
          <span className="db-meta-chip db-meta-mcq"><CheckSquare size={12} /> {mcqs} MCQ</span>
          <span className="db-meta-chip db-meta-tf"><ToggleLeft size={12} /> {tfs} T/F</span>
          <span className="db-quiz-card-date"><Clock size={12} /> {quiz.createdAt}</span>
          {(quiz.tags ?? []).map(t => <span key={t} className="db-tag">{t}</span>)}
        </div>

        {/*
          Description: Danh sách tất cả câu hỏi trong quiz — có thể mở rộng từng câu
          Input: quiz.questions
          Output: render QuestionCard cho từng câu hỏi
        */}
        <div className="db-questions-list">
          {quiz.questions.map((q, idx) => (
            <QuestionCard key={q.id ?? idx} question={q} index={idx} />
          ))}
        </div>
      </main>
    </div>
  );
}

// ── QuestionCard ─────────────────────────────────────────────────────────────
/*
  Description: Card hiển thị từng câu hỏi, có thể mở rộng để xem đáp án
  Input: question object (text, type, options/correct), index
  Output: render câu hỏi với nút toggle mở rộng xem options/đáp án đúng
*/
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
