// quiz.js
// UI-логика теста. Три экрана: welcome, question, result. Плюс модалка с типом.

import { calculateResult } from './scoring.js';
import {
  saveProgress,
  loadProgress,
  clearProgress,
  countAnswered,
  humanTimeAgo,
} from './storage.js';

// Метаданные для группировки 16 типов
const TYPE_GROUPS = [
  {
    id: 'analysts',
    title: 'Аналитики',
    desc: 'Рациональные и изобретательные мыслители.',
    codes: ['INTJ', 'INTP', 'ENTJ', 'ENTP'],
  },
  {
    id: 'diplomats',
    title: 'Дипломаты',
    desc: 'Эмпатичные и вдохновляющие идеалисты.',
    codes: ['INFJ', 'INFP', 'ENFJ', 'ENFP'],
  },
  {
    id: 'sentinels',
    title: 'Хранители',
    desc: 'Практичные и надёжные опоры общества.',
    codes: ['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'],
  },
  {
    id: 'explorers',
    title: 'Искатели',
    desc: 'Гибкие и спонтанные мастера момента.',
    codes: ['ISTP', 'ISFP', 'ESTP', 'ESFP'],
  },
];

// Подписи для пятой оси — модификатора A/T
const VARIANT_LABELS = {
  A: {
    title: 'Уверенный вариант',
    hint: 'Спокойно справляется со стрессом, редко сомневается в себе.',
  },
  T: {
    title: 'Осторожный вариант',
    hint: 'Чувствителен к стрессу, склонен к рефлексии и самокритике.',
  },
};

const state = {
  questions: [],
  types: {},
  answers: [],
  currentIndex: 0,
  currentType: null,
  currentCode: '',
  activeTab: 'overview',
  modalOpen: false,
  lastFocused: null,
  _pendingResume: null,
};

const el = {
  screens: {
    welcome:  document.getElementById('screen-welcome'),
    question: document.getElementById('screen-question'),
    result:   document.getElementById('screen-result'),
  },
  startBtn:       document.getElementById('start-btn'),
  resumeBtn:      document.getElementById('resume-btn'),
  resumeInfo:     document.getElementById('resume-info'),
  restartBtn:     document.getElementById('restart-btn'),
  backBtn:        document.getElementById('back-btn'),
  questionText:   document.getElementById('question-text'),
  answersBox:     document.getElementById('answers'),
  progressBar:    document.getElementById('progress-bar'),
  progressCurrent:document.getElementById('progress-current'),
  progressTotal:  document.getElementById('progress-total'),
  resultCode:     document.getElementById('result-code'),
  resultName:     document.getElementById('result-name'),
  resultDesc:     document.getElementById('result-description'),
  tabs:           document.querySelectorAll('[data-tab]'),
  tabContent:     document.getElementById('tab-content'),
  axisBars:       document.getElementById('axis-bars'),
  typeGroups:     document.getElementById('type-groups'),
  modalOverlay:   document.getElementById('modal-overlay'),
  modalContent:   document.getElementById('modal-content'),
  modalClose:     document.getElementById('modal-close'),
};

const ANSWER_LABELS = [
  'Полностью не согласен',
  'Не согласен',
  'Скорее не согласен',
  'Нейтрально',
  'Скорее согласен',
  'Согласен',
  'Полностью согласен',
];

// ---------------------------------------------------------------------------
// Инициализация
// ---------------------------------------------------------------------------

init();

async function init() {
  try {
    const [qRes, tRes] = await Promise.all([
      fetch('data/questions.json'),
      fetch('data/types.json'),
    ]);
    state.questions = await qRes.json();
    state.types = await tRes.json();
  } catch (err) {
    console.error('Не удалось загрузить данные:', err);
    el.questionText.textContent =
      'Ошибка загрузки данных. Проверьте, что файлы questions.json и types.json доступны.';
    return;
  }

  el.progressTotal.textContent = state.questions.length;
  el.startBtn.addEventListener('click', startQuiz);
  el.resumeBtn.addEventListener('click', resumeQuiz);
  el.restartBtn.addEventListener('click', restart);
  el.backBtn.addEventListener('click', goBack);
  el.tabs.forEach(t =>
    t.addEventListener('click', () => switchTab(t.dataset.tab))
  );

  // Модальное окно
  el.modalClose.addEventListener('click', closeTypeModal);
  el.modalOverlay.addEventListener('click', (e) => {
    if (e.target === el.modalOverlay) closeTypeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.modalOpen) closeTypeModal();
  });

  // Клик по чипу типа — открыть модалку (делегирование)
  el.typeGroups.addEventListener('click', (e) => {
    const chip = e.target.closest('.type-chip');
    if (!chip) return;
    openTypeModal(chip.dataset.code);
  });

  buildAnswerButtons();
  renderTypeGroups();
  prepareWelcome();
  showScreen('welcome');
}

// ---------------------------------------------------------------------------
// Утилиты для типа
// ---------------------------------------------------------------------------

// Берём базовый тип (4 буквы) и модификатор A/T (5-я буква, если есть)
function splitTypeCode(code) {
  const base = code.slice(0, 4);
  const variant = code.length > 4 ? code[4] : null;
  return { base, variant };
}

// Красивое отображение: ESTP-A
function prettyCode(code) {
  const { base, variant } = splitTypeCode(code);
  return variant ? `${base}-${variant}` : base;
}

// ---------------------------------------------------------------------------
// Приветственный экран
// ---------------------------------------------------------------------------

function renderTypeGroups() {
  if (!el.typeGroups) return;

  el.typeGroups.innerHTML = TYPE_GROUPS.map(group => {
    const chips = group.codes
      .map(code => {
        const type = state.types[code];
        const nameRu = type ? type.name_ru : code;
        return `
          <button type="button" class="type-chip" data-code="${code}">
            <span class="type-chip-info">
              <span class="type-chip-code">${code}</span>
              <span class="type-chip-name">${nameRu}</span>
            </span>
            <span class="type-chip-arrow" aria-hidden="true">→</span>
          </button>
        `;
      })
      .join('');

    return `
      <div class="type-group">
        <div class="type-group-header">
          <h3 class="type-group-title">${group.title}</h3>
          <p class="type-group-desc">${group.desc}</p>
        </div>
        <div class="type-group-chips">${chips}</div>
      </div>
    `;
  }).join('');
}

function prepareWelcome() {
  const saved = loadProgress(state.questions.length);

  if (!saved) {
    el.resumeBtn.hidden = true;
    el.resumeInfo.hidden = true;
    el.startBtn.textContent = 'Начать';
    state._pendingResume = null;
    return;
  }

  const answered = countAnswered(saved.answers);

  el.resumeBtn.hidden = false;
  el.resumeInfo.hidden = false;

  el.startBtn.textContent = 'Начать заново';
  el.resumeBtn.textContent = `Продолжить (вопрос ${saved.currentIndex + 1})`;
  el.resumeInfo.textContent =
    `Отвечено ${answered} из ${state.questions.length}. Сохранено ${humanTimeAgo(saved.savedAt)}.`;

  state._pendingResume = saved;
}

function resumeQuiz() {
  const saved = state._pendingResume;
  if (!saved) {
    startQuiz();
    return;
  }
  state.answers = saved.answers.slice();
  state.currentIndex = saved.currentIndex;
  state._pendingResume = null;
  showScreen('question');
  renderQuestion();
}

// ---------------------------------------------------------------------------
// Модальное окно типа
// ---------------------------------------------------------------------------

function openTypeModal(code) {
  // В чипах только базовые 4-буквенные коды — ищем напрямую
  const type = state.types[code];
  if (!type) return;

  state.lastFocused = document.activeElement;
  state.modalOpen = true;

  el.modalContent.innerHTML = renderTypeModal(type, code);
  el.modalOverlay.hidden = false;
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => el.modalClose.focus());
}

function closeTypeModal() {
  if (!state.modalOpen) return;

  el.modalOverlay.hidden = true;
  document.body.classList.remove('modal-open');
  state.modalOpen = false;

  if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
    state.lastFocused.focus();
  }
  state.lastFocused = null;
}

function renderTypeModal(type, code) {
  const strengths = Array.isArray(type.strengths) ? type.strengths : [];
  const weaknesses = Array.isArray(type.weaknesses) ? type.weaknesses : [];
  const careers = Array.isArray(type.careers) ? type.careers : [];

  const sectionAbout = type.full_description
    ? `
      <section class="modal-section">
        <h3 class="modal-section-title">О типе</h3>
        <p class="modal-text">${type.full_description}</p>
      </section>
    `
    : '';

  const sectionTraits = (strengths.length || weaknesses.length)
    ? `
      <section class="modal-section">
        <div class="modal-grid">
          ${strengths.length ? `
            <div>
              <h4 class="modal-subtitle">Сильные стороны</h4>
              <ul class="modal-list">
                ${strengths.map(s => `<li>${s}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${weaknesses.length ? `
            <div>
              <h4 class="modal-subtitle">Слабые стороны</h4>
              <ul class="modal-list">
                ${weaknesses.map(s => `<li>${s}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </section>
    `
    : '';

  const sectionRelationships = type.relationships
    ? `
      <section class="modal-section">
        <h3 class="modal-section-title">В отношениях</h3>
        <p class="modal-text">${type.relationships}</p>
      </section>
    `
    : '';

  const sectionWorkplace = type.workplace
    ? `
      <section class="modal-section">
        <h3 class="modal-section-title">В работе</h3>
        <p class="modal-text">${type.workplace}</p>
      </section>
    `
    : '';

  const sectionCareers = careers.length
    ? `
      <section class="modal-section">
        <h3 class="modal-section-title">Подходящие профессии</h3>
        <div class="modal-chips">
          ${careers.map(c => `<span class="modal-chip">${c}</span>`).join('')}
        </div>
      </section>
    `
    : '';

  return `
    <header class="modal-header">
      <div class="modal-code">${code}</div>
      <h2 class="modal-name" id="modal-name">${type.name_ru || type.name || code}</h2>
      <p class="modal-desc">${type.description || ''}</p>
    </header>
    <div class="modal-body">
      ${sectionAbout}
      ${sectionTraits}
      ${sectionRelationships}
      ${sectionWorkplace}
      ${sectionCareers}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Экраны
// ---------------------------------------------------------------------------

function showScreen(name) {
  for (const [key, node] of Object.entries(el.screens)) {
    node.classList.toggle('active', key === name);
  }
}

// ---------------------------------------------------------------------------
// Прохождение теста
// ---------------------------------------------------------------------------

function startQuiz() {
  clearProgress();
  state._pendingResume = null;
  state.currentType = null;
  state.currentCode = '';
  state.activeTab = 'overview';
  state.answers = new Array(state.questions.length).fill(null);
  state.currentIndex = 0;
  saveProgress(state, state.questions.length);
  showScreen('question');
  renderQuestion();
}

function buildAnswerButtons() {
  el.answersBox.innerHTML = '';
  ANSWER_LABELS.forEach((label, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'answer-btn';
    btn.dataset.value = i + 1;
    btn.innerHTML = `
      <span class="answer-dot"></span>
      <span class="answer-label">${label}</span>
    `;
    btn.addEventListener('click', () => selectAnswer(i + 1));
    el.answersBox.appendChild(btn);
  });
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  el.questionText.textContent = q.text_ru;

  el.progressCurrent.textContent = state.currentIndex + 1;
  el.progressBar.style.width = `${(state.currentIndex / state.questions.length) * 100}%`;
  el.backBtn.disabled = state.currentIndex === 0;

  const current = state.answers[state.currentIndex];
  el.answersBox.querySelectorAll('.answer-btn').forEach(btn => {
    btn.classList.toggle('selected', Number(btn.dataset.value) === current);
  });
}

function selectAnswer(value) {
  state.answers[state.currentIndex] = value;

  el.answersBox.querySelectorAll('.answer-btn').forEach(btn => {
    btn.classList.toggle('selected', Number(btn.dataset.value) === value);
  });

  saveProgress(state, state.questions.length);

  setTimeout(() => {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex++;
      saveProgress(state, state.questions.length);
      renderQuestion();
    } else {
      finishQuiz();
    }
  }, 180);
}

function goBack() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    saveProgress(state, state.questions.length);
    renderQuestion();
  }
}

function restart() {
  clearProgress();
  state._pendingResume = null;
  state.currentType = null;
  state.currentCode = '';
  state.activeTab = 'overview';
  state.answers = [];
  state.currentIndex = 0;
  showScreen('welcome');
  prepareWelcome();
}

// ---------------------------------------------------------------------------
// Результат
// ---------------------------------------------------------------------------

function finishQuiz() {
  const result = calculateResult(state.answers, state.questions);
  const { base, variant } = splitTypeCode(result.code);

  // ← ГЛАВНОЕ ИСПРАВЛЕНИЕ: ищем базовый тип (4 буквы), а не 5-буквенный код
  const type = state.types[base] || null;

  state.currentType = type;
  state.currentCode = result.code;

  el.resultCode.textContent = prettyCode(result.code);

  if (type) {
    el.resultName.textContent = type.name_ru;
    el.resultDesc.textContent = type.description || '';
  } else {
    el.resultName.textContent = '';
    el.resultDesc.textContent = 'Описание для этого типа не найдено в types.json.';
  }

  // Подпись для A/T-модификатора
  const variantBox = document.getElementById('result-variant');
  if (variantBox) {
    if (variant && VARIANT_LABELS[variant]) {
      variantBox.innerHTML = `
        <span class="variant-title">${VARIANT_LABELS[variant].title}</span>
        <span class="variant-hint">${VARIANT_LABELS[variant].hint}</span>
      `;
      variantBox.hidden = false;
    } else {
      variantBox.innerHTML = '';
      variantBox.hidden = true;
    }
  }

  renderAxisBars(result);

  state.activeTab = 'overview';
  switchTab('overview');

  clearProgress();

  showScreen('result');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchTab(tabName) {
  const type = state.currentType;
  if (!type) {
    console.warn('Тип не найден — вкладки недоступны.');
    return;
  }

  state.activeTab = tabName;

  el.tabs.forEach(t => {
    const isActive = t.dataset.tab === tabName;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  const renderers = {
    overview: renderOverviewTab,
    relationships: renderRelationshipsTab,
    workplace: renderWorkplaceTab,
  };

  const render = renderers[tabName];
  if (!render) return;

  el.tabContent.innerHTML = render(type);
}

function renderOverviewTab(type) {
  const strengths = Array.isArray(type.strengths) ? type.strengths : [];
  const weaknesses = Array.isArray(type.weaknesses) ? type.weaknesses : [];
  const careers = Array.isArray(type.careers) ? type.careers : [];

  return `
    <p class="type-full-desc">${type.full_description || type.description || ''}</p>
    <div class="type-grid">
      <div class="type-col">
        <h4>Сильные стороны</h4>
        <ul>${strengths.map(s => `<li>${s}</li>`).join('')}</ul>
      </div>
      <div class="type-col">
        <h4>Слабые стороны</h4>
        <ul>${weaknesses.map(s => `<li>${s}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="type-col">
      <h4>Подходящие профессии</h4>
      <ul class="inline">${careers.map(c => `<li>${c}</li>`).join('')}</ul>
    </div>
  `;
}

function renderRelationshipsTab(type) {
  const text = type.relationships
    || 'Описание отношений для этого типа пока не добавлено.';
  return `<p class="type-full-desc">${text}</p>`;
}

function renderWorkplaceTab(type) {
  const text = type.workplace
    || 'Описание работы для этого типа пока не добавлено.';
  return `<p class="type-full-desc">${text}</p>`;
}

function renderAxisBars(result) {
  const axisMeta = {
    EI: ['E', 'I', 'Экстраверсия',    'Интроверсия'],
    SN: ['S', 'N', 'Сенсорика',       'Интуиция'],
    TF: ['T', 'F', 'Логика',          'Чувство'],
    JP: ['J', 'P', 'Судящий',         'Воспринимающий'],
    AT: ['A', 'T', 'Уверенный',       'Осторожный'],
  };

  el.axisBars.innerHTML = '';

  for (const axis of ['EI', 'SN', 'TF', 'JP', 'AT']) {
    const [poleA, poleB, nameA, nameB] = axisMeta[axis];
    const sA = result.scores[axis][poleA];
    const sB = result.scores[axis][poleB];
    const total = sA + sB;
    const pctA = total === 0 ? 50 : Math.round((sA / total) * 100);
    const pctB = 100 - pctA;
    const winner = result.axes[axis].winner;

    const row = document.createElement('div');
    row.className = 'axis-row';
    row.innerHTML = `
      <div class="axis-side ${winner === poleA ? 'winner' : ''}">
        <span class="axis-name">${nameA}</span>
        <span class="axis-pct">${pctA}%</span>
      </div>
      <div class="axis-bar">
        <div class="axis-bar-fill" style="width:${pctA}%"></div>
      </div>
      <div class="axis-side right ${winner === poleB ? 'winner' : ''}">
        <span class="axis-pct">${pctB}%</span>
        <span class="axis-name">${nameB}</span>
      </div>
    `;
    el.axisBars.appendChild(row);
  }
}