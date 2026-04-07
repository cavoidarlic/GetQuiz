import { apiFetch } from './client';

/** Fetch all quizzes for the current user (user_id defaults to 'anonymous' on backend). */
export async function getQuizzes() {
  return apiFetch('/quizzes/');
}

/** Fetch a single quiz with full questions. */
export async function getQuiz(id) {
  return apiFetch(`/quizzes/${id}`);
}

/**
 * Save a manually-created quiz to the database.
 * payload: { title, description, tags, difficulty, questions }
 */
export async function createQuiz(payload) {
  return apiFetch('/quizzes/', {
    method: 'POST',
    body: JSON.stringify({ user_id: 'anonymous', ...payload }),
  });
}

/** Delete a quiz by ID. */
export async function deleteQuiz(id) {
  return apiFetch(`/quizzes/${id}?user_id=anonymous`, { method: 'DELETE' });
}

/** Generate an AI quiz and save it. */
export async function generateQuiz(topic, count = 5) {
  return apiFetch('/quizzes/generate', {
    method: 'POST',
    body: JSON.stringify({ topic, count }),
  });
}
