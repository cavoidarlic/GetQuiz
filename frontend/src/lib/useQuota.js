/**
 * useQuota — tracks daily AI quiz generation usage.
 *
 * Plan tiers & limits (per day):
 *   free  → 10  generations / day
 *   pro   → 100 generations / day
 *   teams → Infinity (unlimited)
 *
 * Storage key: gq_quota_<userId>  →  { date: 'YYYY-MM-DD', used: number }
 * The plan is stored separately: gq_plan_<userId>  →  'free' | 'pro' | 'teams'
 * (demo: users can toggle plan in the UI for testing purposes)
 */

import { useState, useCallback } from 'react';

export const PLAN_LIMITS = {
  free:  10,
  pro:   100,
  teams: Infinity,
};

export const PLAN_LABELS = {
  free:  'Free',
  pro:   'Pro',
  teams: 'Teams',
};

/** Returns today's date as YYYY-MM-DD in the local timezone. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Read usage record from localStorage, reset if stale. */
function readUsage(userId) {
  try {
    const raw = localStorage.getItem(`gq_quota_${userId}`);
    if (!raw) return { date: today(), used: 0 };
    const parsed = JSON.parse(raw);
    // Reset on new day
    if (parsed.date !== today()) return { date: today(), used: 0 };
    return parsed;
  } catch {
    return { date: today(), used: 0 };
  }
}

function writeUsage(userId, record) {
  try {
    localStorage.setItem(`gq_quota_${userId}`, JSON.stringify(record));
  } catch { /* storage full — ignore */ }
}

function readPlan(userId) {
  try {
    const p = localStorage.getItem(`gq_plan_${userId}`);
    return p && PLAN_LIMITS[p] !== undefined ? p : 'free';
  } catch {
    return 'free';
  }
}

function writePlan(userId, plan) {
  try {
    localStorage.setItem(`gq_plan_${userId}`, plan);
  } catch { /* ignore */ }
}

/**
 * useQuota(userId)
 *
 * Returns:
 *   plan        — 'free' | 'pro' | 'teams'
 *   used        — number of AI quizzes generated today
 *   limit       — max per day for current plan (Infinity for teams)
 *   remaining   — limit - used  (clamped to 0)
 *   canGenerate — boolean
 *   consume()   — call after a successful generation to increment counter
 *   setPlan(p)  — change plan (demo toggle)
 */
export function useQuota(userId = 'anonymous') {
  const [plan, setPlanState] = useState(() => readPlan(userId));
  const [usage, setUsage] = useState(() => readUsage(userId));

  const limit = PLAN_LIMITS[plan] ?? 10;
  const used = usage.used;
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used);
  const canGenerate = remaining > 0;

  const consume = useCallback(() => {
    setUsage(prev => {
      const current = prev.date === today() ? prev : { date: today(), used: 0 };
      const next = { ...current, used: current.used + 1 };
      writeUsage(userId, next);
      return next;
    });
  }, [userId]);

  const setPlan = useCallback((p) => {
    if (!PLAN_LIMITS[p]) return;
    writePlan(userId, p);
    setPlanState(p);
  }, [userId]);

  return { plan, used, limit, remaining, canGenerate, consume, setPlan };
}
