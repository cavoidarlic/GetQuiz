import { apiFetch } from './client';

export async function startSession(quizId, userId = 'anonymous') {
  return apiFetch('/sessions/', {
    method: 'POST',
    body: JSON.stringify({ quiz_id: quizId, user_id: userId }),
  });
}

export async function submitAnswer(sessionId, questionId, answer) {
  return apiFetch(`/sessions/${sessionId}/answers`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId, answer }),
  });
}

/**
 * Finish a session, persisting score and raw answers.
 * @param {string} sessionId
 * @param {number} score       - percentage 0-100
 * @param {Array}  answers     - [{question_id, option_id}]
 */
export async function finishSession(sessionId, score = 0, answers = []) {
  return apiFetch(`/sessions/${sessionId}/finish`, {
    method: 'POST',
    body: JSON.stringify({ score, answers }),
  });
}

export async function getSessionList(userId = 'anonymous') {
  return apiFetch(`/sessions/?user_id=${encodeURIComponent(userId)}`);
}

export async function getSession(sessionId) {
  return apiFetch(`/sessions/${sessionId}`);
}
