// storage.js
// Сохранение и восстановление прогресса теста в localStorage.

const STORAGE_KEY = 'personality-quiz';
const VERSION = 1; // увеличивайте при изменении набора/порядка вопросов

/**
 * @param {{ answers: Array<number|null>, currentIndex: number }} state
 * @param {number} totalQuestions
 */
export function saveProgress(state, totalQuestions) {
  try {
    const payload = {
      version: VERSION,
      totalQuestions,
      currentIndex: state.currentIndex,
      answers: state.answers,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // приватный режим, переполнение — просто игнорируем
    console.warn('Не удалось сохранить прогресс:', err);
  }
}

/**
 * @param {number} totalQuestions
 * @returns {{ answers: Array<number|null>, currentIndex: number, savedAt: number } | null}
 */
export function loadProgress(totalQuestions) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);

    // Защита от несовместимых сохранений
    if (data.version !== VERSION) return null;
    if (data.totalQuestions !== totalQuestions) return null;
    if (!Array.isArray(data.answers) || data.answers.length !== totalQuestions) return null;
    if (typeof data.currentIndex !== 'number') return null;
    if (data.currentIndex < 0 || data.currentIndex >= totalQuestions) return null;

    return {
      answers: data.answers,
      currentIndex: data.currentIndex,
      savedAt: data.savedAt || 0,
    };
  } catch (err) {
    console.warn('Не удалось прочитать прогресс:', err);
    return null;
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Не удалось очистить прогресс:', err);
  }
}

/** Сколько вопросов уже отвечено (не null). */
export function countAnswered(answers) {
  return answers.reduce((acc, v) => acc + (v != null ? 1 : 0), 0);
}

/** Человекочитаемое «5 минут назад» для приветственного экрана. */
export function humanTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}