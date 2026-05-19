'use strict';

// ========== State ==========
let session = {
  pool: [],
  index: 0,
  correct: 0,
  results: [],
  category: 'all',
  count: 20,
};

const CATEGORY_COLORS = {
  '宅建業法': '#2563eb',
  '民法・権利関係': '#7c3aed',
  '法令上の制限': '#0891b2',
  '税・その他': '#0d9488',
  '土地・建物': '#65a30d',
};

// ========== Storage ==========
function getStats() {
  return JSON.parse(localStorage.getItem('takken_stats') || '{}');
}
function saveStats(stats) {
  localStorage.setItem('takken_stats', JSON.stringify(stats));
}
function getFlags() {
  return JSON.parse(localStorage.getItem('takken_flags') || '[]');
}
function saveFlags(flags) {
  localStorage.setItem('takken_flags', JSON.stringify(flags));
}

function recordAnswer(qid, correct) {
  const stats = getStats();
  if (!stats[qid]) stats[qid] = { answered: 0, correct: 0 };
  stats[qid].answered++;
  if (correct) stats[qid].correct++;
  saveStats(stats);
}

// ========== Navigation ==========
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  window.scrollTo(0, 0);
}

function goHome() {
  renderHome();
  showScreen('home');
}

// ========== Home ==========
function renderHome() {
  const stats = getStats();
  const flags = getFlags();

  let totalAnswered = 0, totalCorrect = 0;
  Object.values(stats).forEach(s => { totalAnswered += s.answered; totalCorrect += s.correct; });

  document.getElementById('stat-answered').textContent = totalAnswered;
  document.getElementById('stat-rate').textContent =
    totalAnswered > 0 ? Math.round(totalCorrect / totalAnswered * 100) + '%' : '—';
  document.getElementById('stat-weak').textContent = flags.length;

  document.getElementById('count-all').textContent = questions.length + '問';
  const weakQ = questions.filter(q => flags.includes(q.id));
  document.getElementById('count-weak').textContent = weakQ.length + '問';

  const categories = [...new Set(questions.map(q => q.category))];
  const list = document.getElementById('category-list');
  list.innerHTML = '';

  categories.forEach(cat => {
    const catQ = questions.filter(q => q.category === cat);
    const catStats = catQ.map(q => stats[q.id]).filter(Boolean);
    const catAnswered = catStats.reduce((a, s) => a + s.answered, 0);
    const catCorrect = catStats.reduce((a, s) => a + s.correct, 0);
    const rate = catAnswered > 0 ? Math.round(catCorrect / catAnswered * 100) : null;
    const color = CATEGORY_COLORS[cat] || '#6b7280';

    const btn = document.createElement('button');
    btn.className = 'category-item';
    btn.onclick = () => openCategoryModal(cat);

    let rateHtml = rate !== null
      ? `<span class="cat-rate" style="background:${color}22;color:${color}">${rate}%</span>`
      : `<span class="cat-rate" style="background:#f3f4f6;color:#9ca3af">未学習</span>`;

    btn.innerHTML = `
      <span class="cat-dot" style="background:${color}"></span>
      <span class="cat-info">
        <span class="cat-name">${cat}</span>
        <span class="cat-progress">${catQ.length}問 ${catAnswered > 0 ? '/ 解答済 ' + catAnswered + '問' : ''}</span>
      </span>
      ${rateHtml}
      <span class="cat-arrow">›</span>
    `;
    list.appendChild(btn);
  });
}

// ========== Modal ==========
let pendingCategory = 'all';

function openCategoryModal(cat) {
  pendingCategory = cat;
  const catQ = cat === 'all' ? questions : cat === 'weak'
    ? questions.filter(q => getFlags().includes(q.id))
    : questions.filter(q => q.category === cat);

  document.getElementById('modal-title').textContent =
    cat === 'all' ? '全分野ランダム' : cat === 'weak' ? '苦手問題' : cat;
  document.getElementById('modal-desc').textContent = `全 ${catQ.length} 問から出題`;
  document.getElementById('modal-settings').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-settings').classList.add('hidden');
}

function startQuiz(cat) {
  pendingCategory = cat;
  if (cat === 'weak') {
    const weakQ = questions.filter(q => getFlags().includes(q.id));
    if (weakQ.length === 0) {
      alert('苦手問題がありません。問題を解いて☆でフラグを立てると追加されます。');
      return;
    }
  }
  openCategoryModal(cat);
}

function confirmStart(count) {
  closeModal();
  const cat = pendingCategory;
  let pool;
  if (cat === 'all') {
    pool = [...questions];
  } else if (cat === 'weak') {
    const flags = getFlags();
    pool = questions.filter(q => flags.includes(q.id));
  } else {
    pool = questions.filter(q => q.category === cat);
  }

  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  if (count > 0) pool = pool.slice(0, count);

  session = { pool, index: 0, correct: 0, results: [], category: cat, count: pool.length };
  renderQuestion();
  showScreen('quiz');
}

// ========== Quiz ==========
function renderQuestion() {
  const q = session.pool[session.index];
  const flags = getFlags();
  const total = session.pool.length;
  const num = session.index + 1;
  const pct = (session.index / total * 100).toFixed(1);

  document.getElementById('q-category').textContent = q.subcategory ? `${q.category} › ${q.subcategory}` : q.category;
  document.getElementById('q-progress').textContent = `${num} / ${total}`;
  document.getElementById('q-text').textContent = q.question;
  document.getElementById('progress-fill').style.width = pct + '%';

  const flagBtn = document.getElementById('flag-btn');
  flagBtn.textContent = flags.includes(q.id) ? '★' : '☆';
  flagBtn.classList.toggle('flagged', flags.includes(q.id));
}

function submitAnswer(userAnswer) {
  const q = session.pool[session.index];
  const correct = (userAnswer === q.answer);
  if (correct) session.correct++;
  session.results.push({ q, userAnswer, correct });
  recordAnswer(q.id, correct);

  renderResult(q, userAnswer, correct);
  showScreen('result');
}

// ========== Result ==========
function renderResult(q, userAnswer, correct) {
  const flags = getFlags();
  const total = session.pool.length;
  const num = session.index + 1;
  const pct = (num / total * 100).toFixed(1);

  // Header
  document.getElementById('r-category').textContent = q.subcategory ? `${q.category} › ${q.subcategory}` : q.category;
  document.getElementById('r-progress').textContent = `${num} / ${total}`;
  document.getElementById('r-progress-fill').style.width = pct + '%';

  const rFlagBtn = document.getElementById('r-flag-btn');
  rFlagBtn.textContent = flags.includes(q.id) ? '★' : '☆';
  rFlagBtn.classList.toggle('flagged', flags.includes(q.id));

  // Verdict
  const verdict = document.getElementById('result-verdict');
  verdict.className = 'result-verdict ' + (correct ? 'correct' : 'incorrect');
  document.getElementById('verdict-icon').textContent = correct ? '○' : '×';
  document.getElementById('verdict-text').textContent = correct ? '正解！' : '不正解';

  // Question review
  document.getElementById('r-q-text').textContent = q.question;
  const ansBox = document.getElementById('correct-ans');
  ansBox.textContent = `正解：${q.answer ? '○（正しい）' : '×（誤り）'}`;
  ansBox.className = 'correct-ans ' + (q.answer ? 'was-true' : 'was-false');

  // Explanation
  document.getElementById('explanation').textContent = q.explanation;

  // Next button
  const isLast = session.index + 1 >= session.pool.length;
  const nextBtn = document.getElementById('btn-next');
  if (isLast) {
    nextBtn.textContent = '結果を見る';
    nextBtn.onclick = showSummary;
  } else {
    nextBtn.textContent = '次の問題 →';
    nextBtn.onclick = nextQuestion;
  }
}

function nextQuestion() {
  session.index++;
  renderQuestion();
  showScreen('quiz');
}

// ========== Flag ==========
function toggleFlag() {
  const q = session.pool[session.index];
  const flags = getFlags();
  const idx = flags.indexOf(q.id);
  if (idx >= 0) flags.splice(idx, 1);
  else flags.push(q.id);
  saveFlags(flags);

  ['flag-btn', 'r-flag-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.textContent = flags.includes(q.id) ? '★' : '☆';
      btn.classList.toggle('flagged', flags.includes(q.id));
    }
  });
}

// ========== Summary ==========
function showSummary() {
  const total = session.pool.length;
  const correct = session.correct;
  const rate = Math.round(correct / total * 100);

  let icon = '😊';
  if (rate >= 80) icon = '🎉';
  else if (rate >= 60) icon = '😊';
  else if (rate >= 40) icon = '😅';
  else icon = '😓';

  document.getElementById('summary-icon').textContent = icon;
  document.getElementById('summary-score').innerHTML = `
    <span class="score-big">${correct}<span class="score-denom"> / ${total}</span></span>
    <span class="score-rate">${rate}%</span>
  `;

  // Category breakdown
  const catMap = {};
  session.results.forEach(r => {
    const cat = r.q.category;
    if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0 };
    catMap[cat].total++;
    if (r.correct) catMap[cat].correct++;
  });

  const barsEl = document.getElementById('summary-bars');
  barsEl.innerHTML = '';
  Object.entries(catMap).forEach(([cat, d]) => {
    const r = Math.round(d.correct / d.total * 100);
    const fillClass = r >= 70 ? 'good' : r >= 50 ? 'mid' : 'low';
    const color = CATEGORY_COLORS[cat] || '#6b7280';
    barsEl.innerHTML += `
      <div class="summary-bar-item">
        <div class="bar-label" style="color:${color}">${cat}</div>
        <div class="bar-track">
          <div class="bar-fill ${fillClass}" style="width:0%" data-w="${r}%"></div>
        </div>
        <div class="bar-rate">${d.correct} / ${d.total}問 正解 (${r}%)</div>
      </div>`;
  });

  showScreen('summary');
  // Animate bars after DOM updates
  setTimeout(() => {
    document.querySelectorAll('.bar-fill[data-w]').forEach(el => {
      el.style.width = el.dataset.w;
    });
  }, 100);
}

function restartQuiz() {
  confirmStart(session.count);
}

// ========== Stats Screen ==========
function showStats() {
  const stats = getStats();
  const categories = [...new Set(questions.map(q => q.category))];
  const body = document.getElementById('stats-body');
  body.innerHTML = '';

  categories.forEach(cat => {
    const catQ = questions.filter(q => q.category === cat);
    const color = CATEGORY_COLORS[cat] || '#6b7280';
    let catAnswered = 0, catCorrect = 0;
    catQ.forEach(q => {
      const s = stats[q.id];
      if (s) { catAnswered += s.answered; catCorrect += s.correct; }
    });
    const rate = catAnswered > 0 ? Math.round(catCorrect / catAnswered * 100) : null;

    const subcats = [...new Set(catQ.map(q => q.subcategory).filter(Boolean))];
    let subcatHtml = '';
    subcats.forEach(sub => {
      const subQ = catQ.filter(q => q.subcategory === sub);
      let subAns = 0, subCor = 0;
      subQ.forEach(q => {
        const s = stats[q.id];
        if (s) { subAns += s.answered; subCor += s.correct; }
      });
      const subRate = subAns > 0 ? Math.round(subCor / subAns * 100) + '%' : '—';
      subcatHtml += `<div class="stats-row"><span>${sub}</span><span>${subRate}</span></div>`;
    });

    body.innerHTML += `
      <div class="stats-cat-card">
        <div class="stats-cat-name" style="color:${color}">${cat}</div>
        <div class="stats-row"><span>解答数</span><span>${catAnswered}問</span></div>
        <div class="stats-row"><span>正解数</span><span>${catCorrect}問</span></div>
        <div class="stats-row"><span>正答率</span><span>${rate !== null ? rate + '%' : '—'}</span></div>
        ${subcatHtml}
        <div class="stats-bar-row">
          <div class="bar-track" style="margin-top:8px">
            <div class="bar-fill ${rate >= 70 ? 'good' : rate >= 50 ? 'mid' : 'low'}" style="width:${rate || 0}%"></div>
          </div>
        </div>
      </div>`;
  });

  showScreen('stats');
}

// ========== Reset ==========
function resetConfirm() {
  if (confirm('全ての成績と苦手フラグをリセットしますか？')) {
    localStorage.removeItem('takken_stats');
    localStorage.removeItem('takken_flags');
    renderHome();
  }
}

// ========== Init ==========
window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  renderHome();
  showScreen('home');
});
