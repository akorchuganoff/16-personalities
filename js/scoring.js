// scoring.js
// Логика подсчёта результата. Не зависит от DOM, легко тестируется.

const AXES = ['EI', 'SN', 'TF', 'JP', 'AT'];

// Какой полюс противоположен данному
const OPPOSITE = {
  E: 'I', I: 'E',
  S: 'N', N: 'S',
  T: 'F', F: 'T',
  J: 'P', P: 'J',
  A: 'T', T: 'A',
};

/**
 * @param {Array<number|null>} answers — массив значений 1..7, null = нет ответа
 * @param {Array<object>} questions — массив вопросов из questions.json
 * @returns {{ code: string, axes: object, scores: object }}
 */
export function calculateResult(answers, questions) {
  // Баллы по каждому полюсу каждой оси.
  // Каждая ось — свой изолированный «стакан»,
  // поэтому конфликт имён T (Thinking) и T (Turbulent) не возникает.
  const scores = {
    EI: { E: 0, I: 0 },
    SN: { S: 0, N: 0 },
    TF: { T: 0, F: 0 },
    JP: { J: 0, P: 0 },
    AT: { A: 0, T: 0 },
  };

  questions.forEach((q, i) => {
    const raw = answers[i];
    if (raw == null) return;

    // 1..7  →  -3..+3
    const value = raw - 4;
    const magnitude = Math.abs(value);
    if (magnitude === 0) return;

    // Если согласен — очко в сторону direction.
    // Если не согласен — очко в сторону противоположного полюса.
    const pole = value > 0 ? q.direction : OPPOSITE[q.direction];
    scores[q.axis][pole] += magnitude;
  });

  // Определяем победителя по каждой оси и считаем проценты
  const axes = {};
  for (const axis of AXES) {
    const [poleA, poleB] = Object.keys(scores[axis]);
    const sA = scores[axis][poleA];
    const sB = scores[axis][poleB];
    const total = sA + sB;

    const pctA = total === 0 ? 50 : Math.round((sA / total) * 100);
    const pctB = 100 - pctA;

    const winner = sA >= sB ? poleA : poleB;
    const loser  = winner === poleA ? poleB : poleA;

    axes[axis] = {
      winner,
      loser,
      percentage: winner === poleA ? pctA : pctB,
    };
  }

  const code = AXES.map(a => axes[a].winner).join('');

  return { code, axes, scores };
}