import { apiFetch } from './client';

/** Fetch all quizzes for the current user. */
export async function getQuizzes(userId = 'anonymous') {
  return apiFetch(`/quizzes/?user_id=${encodeURIComponent(userId)}`);
}

/** Fetch a single quiz with full questions. */
export async function getQuiz(id) {
  return apiFetch(`/quizzes/${id}`);
}

/**
 * Save a manually-created quiz.
 * payload: { title, description, tags, difficulty, questions }
 */
export async function createQuiz(userId = 'anonymous', payload) {
  return apiFetch('/quizzes/', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, ...payload }),
  });
}

/** Delete a quiz by ID. */
export async function deleteQuiz(id, userId = 'anonymous') {
  return apiFetch(`/quizzes/${id}?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

/** Generate an AI quiz and save it (user_id sent in body). */
export async function generateQuiz(userId = 'anonymous', topic, count = 5) {
  return apiFetch('/quizzes/generate', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, topic, count }),
  });
}
