import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ChevronRight } from 'lucide-react';
import { generateQuiz } from '../api/quizzes';
import LoadingOverlay from './LoadingOverlay';

// Lightweight star field using pure CSS/JS — no library needed
function StarField({ count = 80 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.15 + 0.05,
      phase: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      stars.forEach(s => {
        s.x = Math.random() * canvas.width;
        s.y = Math.random() * canvas.height;
      });
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = t / 1000;
      stars.forEach(s => {
        const alpha = 0.15 + 0.35 * Math.abs(Math.sin(time * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 160, 255, ${alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}

// Dashboard mockup inside the hero
function DashboardMockup() {
  return (
    <div className="hero-visual">
      {/* Floating stat badge - top right */}
      <div className="mockup-float-badge mockup-float-badge-1">
        <div className="float-badge-icon" style={{ background: 'rgba(61,255,160,0.15)' }}>
          ⚡
        </div>
        <div>
          <div className="float-badge-text">3.2s</div>
          <div className="float-badge-sub">Avg. generation</div>
        </div>
      </div>

      <div className="mockup">
        {/* Scan line animation */}
        <div className="mockup-scan" aria-hidden="true" />

        {/* Window chrome */}
        <div className="mockup-header">
          <div className="mockup-dot mockup-dot-red" />
          <div className="mockup-dot mockup-dot-yellow" />
          <div className="mockup-dot mockup-dot-green" />
          <div className="mockup-title">GetQuiz — AI Generator</div>
        </div>

        <div className="mockup-body">
          {/* Prompt bar */}
          <div className="mockup-prompt-bar">
            <Sparkles size={14} color="var(--cold)" />
            <span className="mockup-prompt-text">
              "10-question quiz on photosynthesis for 8th grade"
              <span className="mockup-cursor" />
            </span>
          </div>

          {/* Generated question */}
          <div className="mockup-question">
            <div className="mockup-q-label">QUESTION 01 / 10</div>
            <div className="mockup-q-text">
              What is the primary pigment in plant leaves responsible for capturing light energy?
            </div>
            {[
              { label: 'A', text: 'Carotenoid', correct: false },
              { label: 'B', text: 'Chlorophyll', correct: true },
              { label: 'C', text: 'Anthocyanin', correct: false },
              { label: 'D', text: 'Xanthophyll', correct: false },
            ].map(opt => (
              <div
                key={opt.label}
                className={`mockup-option${opt.correct ? ' correct' : ''}`}
              >
                <div className="mockup-option-bullet">
                  {opt.correct && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3 5.5L6.5 2" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                {opt.label}. {opt.text}
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="mockup-eta">
            <span className="mockup-eta-text">Generating… 7/10 complete</span>
            <div className="mockup-progress">
              <div className="mockup-progress-fill" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating stat badge - bottom left */}
      <div className="mockup-float-badge mockup-float-badge-2">
        <div className="float-badge-icon" style={{ background: 'rgba(124,92,252,0.15)' }}>
          📊
        </div>
        <div>
          <div className="float-badge-text">98.4% accuracy</div>
          <div className="float-badge-sub">AI precision score</div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef(null);

  //Add 3 loading state
  const navigate = useNavigate();
  const [loadingState, setLoadingState] = useState('idle'); // 'idle' | 'checking' | 'generating'

  const EXAMPLE_PROMPTS = [
    'Make a 10-question quiz about the Solar System',
    '5 MCQs on the French Revolution for high school',
    'Create a marketing quiz about our new product launch',
  ];
  const [exampleIndex, setExampleIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setExampleIndex(i => (i + 1) % EXAMPLE_PROMPTS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      inputRef.current?.focus();
      return;
    }
    //Add executing process of 3 added states

    try {
      // 1. Open Overlay
      setLoadingState('checking');

      // (UX Optional) slightly delay to prevent UI flicker
      // then switch to a generating state
      setTimeout(() => {
        setLoadingState(prev => prev === 'checking' ? 'generating' : prev);
      }, 1500);

      // 2. Call API endpoint
      const res = await generateQuiz(prompt, 10);

      if (!res.ok) {
        setLoadingState('idle');
        alert("Failed: " + res.error);
        return;
      }

      // 3. Close Overlay
      setLoadingState('idle');

      // 4. Pass API client result payload
      navigate('/dashboard', { state: { generatedQuiz: res.data.data } });

    } catch (err) {
      setLoadingState('idle');
      alert("Server connection error. Please ensure FastAPI is running.");
    }
  }, [prompt, navigate]);

  return (
    // Loading style (blur screen + loading animation + loading text)
    <>
      <LoadingOverlay loadingState={loadingState} />

      <section className="hero" id="hero" aria-labelledby="hero-heading">
        {/* Ambient background */}
        <div className="hero-bg" aria-hidden="true">
          <StarField count={100} />
          <div className="hero-blob-1" />
          <div className="hero-blob-2" />
        </div>

        <div className="hero-content" style={{ width: '100%' }}>
          <div className="hero-inner">
            {/* Left column: copy & CTA */}
            <div>
              {/* Badge */}
              <div className="hero-badge anim-fade-up" aria-label="Platform status">
                <span className="hero-badge-dot" />
                <span>Now in Public Beta — 10,000+ quizzes generated</span>
              </div>

              {/* Headline */}
              <h1
                id="hero-heading"
                className="hero-title anim-fade-up anim-delay-1"
              >
                Turn any prompt{' '}
                <br />
                into a{' '}
                <span className="gradient-text">perfect quiz</span>
                <br />
                in seconds.
              </h1>

              {/* Sub */}
              <p className="hero-sub anim-fade-up anim-delay-2">
                GetQuiz uses AI to instantly generate high-quality quizzes from text, documents, or URLs.
                Then refine with our powerful editor — no setup, no friction.
              </p>

              {/* CTA Input */}
              <div className="anim-fade-up anim-delay-3">
                <div
                  className="hero-input-group"
                  role="search"
                  aria-label="Quiz generation prompt"
                >
                  <input
                    ref={inputRef}
                    id="hero-prompt-input"
                    className="hero-input"
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder={EXAMPLE_PROMPTS[exampleIndex]}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    aria-label="Enter a quiz prompt"
                  />
                  <button
                    id="hero-generate-btn"
                    className="btn btn-primary"
                    onClick={handleGenerate}
                    aria-label="Generate quiz"
                  >
                    <Sparkles size={15} />
                    Generate
                  </button>
                </div>
                <p style={{
                  marginTop: '0.625rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-3)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  No credit card required · Free forever plan available
                </p>
              </div>

              {/* Stats */}
              <div className="hero-stats anim-fade-up anim-delay-4">
                {[
                  { num: '67K+', label: 'Educators' },
                  { num: '67M+', label: 'Quizzes made' },
                  { num: '6.7★', label: 'Avg rating' },
                ].map(({ num, label }) => (
                  <div key={label}>
                    <div className="hero-stat-num">{num}</div>
                    <div className="hero-stat-label">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column: visual */}
            <div className="anim-fade-up anim-delay-5">
              <DashboardMockup />
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          style={{
            position: 'absolute',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.35rem',
            color: 'var(--text-3)',
            animation: 'fadeIn 1s 1.5s both',
          }}
          aria-hidden="true"
        >
          <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
            SCROLL
          </span>
          <ChevronRight
            size={16}
            style={{ transform: 'rotate(90deg)', animation: 'float 2s ease-in-out infinite' }}
          />
        </div>
      </section>
    </>
  );
}
