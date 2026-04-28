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
export async function generateQuiz(userId = 'anonymous', topic, count = 5, signal = null) {
  // Input: userId (string), topic (string), count (number), signal (AbortSignal) from Dashboard
  // Output: Promise resolving to the API response ({ ok, data, error, isAborted }), sent back to Dashboard
  return apiFetch('/quizzes/generate', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, topic, count }),
    signal,
  });
}

/** Get the unified activity log (created / attempted / deleted) for a user. */
export async function getHistory(userId = 'anonymous') {
  return apiFetch(`/history/?user_id=${encodeURIComponent(userId)}`);
}

/** Get deleted quizzes for a user */
export async function getDeletedQuizzes(userId = 'anonymous') {
  // description: Fetch danh sách quiz đã xóa mềm
  // input: userId
  // output: danh sách quizzes (is_deleted=True)
  return apiFetch(`/quizzes/?user_id=${encodeURIComponent(userId)}&is_deleted=true`);
}

/** Restore a soft-deleted quiz */
export async function restoreQuiz(id, userId = 'anonymous') {
  // description: Khôi phục quiz đã bị xóa mềm
  // input: quiz id, userId
  // output: trạng thái restore
  return apiFetch(`/quizzes/${id}/restore?user_id=${encodeURIComponent(userId)}`, {
    method: 'PATCH',
  });
}

/** Permanently delete a quiz */
export async function permanentDeleteQuiz(id, userId = 'anonymous') {
  // description: Xóa vĩnh viễn quiz
  // input: quiz id, userId
  // output: trạng thái xóa vĩnh viễn
  return apiFetch(`/quizzes/${id}/permanent?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

/** Get detailed attempt history for a user */
export async function getDetailedAttempts(userId = 'anonymous') {
  // description: Lấy lịch sử làm bài chi tiết kèm lời giải thích
  // input: userId
  // output: danh sách attempt chi tiết
  return apiFetch(`/history/attempts?user_id=${encodeURIComponent(userId)}`);
}
