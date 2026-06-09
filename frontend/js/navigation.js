function getQuestionType(question, index) {
  return String(question?.scenario || "").trim() ? "실무형" : "이론형";
}

function showScreen(name) {
  state.screen = name;
  if (name === "wrong") {
    state.wrongSubjectId = null;
    state.wrongOpenDateKey = null;
  }
  saveState();
  const targetScreen = $(`${name}Screen`);
  if (!targetScreen && PAGE_URLS[name]) {
    window.location.href = PAGE_URLS[name];
    return;
  }
  els.screens.forEach((screen) => screen.classList.toggle("active", screen.id === `${name}Screen`));
  els.navBtns.forEach((button) => button.classList.toggle("active", button.dataset.screen === name));
  if (name === "wrong") loadBackendWrongNotes();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function profileInitial(name) {
  return String(name || "U").trim().slice(0, 1).toUpperCase();
}

function formatProfileDate(value) {
  if (!value) return "-";
  const text = String(value);
  const normalized = text.length === 8 && /^\d{8}$/.test(text)
    ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
    : text.replace("T", " ").slice(0, 16);
  return normalized || "-";
}

async function loadProfileMenuSummary(target, latestExamTarget = null) {
  const memberId = currentMemberId();
  if (!memberId || !target) return;

  target.innerHTML = renderProfileInsightSummary();

  try {
    const response = await fetch(`${API_BASE}/results/analysis?member_id=${encodeURIComponent(memberId)}&include_commentary=false`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const summary = data.summary || {};
    if (latestExamTarget) {
      latestExamTarget.textContent = formatProfileDate(summary.latestExamAt);
    }
    target.innerHTML = renderProfileInsightSummary(summary);
  } catch {
    target.innerHTML = renderProfileInsightSummary();
  }
}

function renderProfileInsightSummary(summary = {}) {
  const averageScore = Number(summary.averageScore || 0);
  const wrongTotal = Number(summary.wrongTotal || 0);
  const strength = averageScore >= 70 ? "Cloud Computing" : "AI 기초";
  const needsReview = wrongTotal > 0 ? ["Security", "Networking"] : ["실무형 문제", "오답 복습"];

  return `
    <div class="profile-insight-summary">
      <strong>AI 분석 요약</strong>
      <div class="profile-insight-tags">
        <span class="good">강점</span>
        <span>${strength}</span>
      </div>
      <div class="profile-insight-tags">
        <span class="warn">보완 필요</span>
        ${needsReview.map((item) => `<span>${item}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderProfileButton() {
  const topbar = document.querySelector(".topbar");
  const stats = document.querySelector(".top-stats");
  if (!topbar || document.getElementById("profileButton")) return;

  const actions = document.querySelector("[data-profile-slot]") || document.createElement("div");
  const button = document.createElement("button");
  const menu = document.createElement("div");
  const header = document.createElement("div");
  const summary = document.createElement("div");
  const menuList = document.createElement("div");
  const logoutButton = document.createElement("button");
  const memberName = currentMemberName() || state.profileName || profiles[0];
  const memberId = currentMemberId();

  actions.className = "profile-actions";
  actions.dataset.profileSlot = "true";
  button.type = "button";
  button.className = "profile-button";
  button.id = "profileButton";
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = `
    <span class="profile-image-wrap" aria-hidden="true">
      <img src="assets/brand/profile-avatar.png" alt="" />
    </span>
  `;

  menu.className = "profile-menu";
  menu.id = "profileMenu";
  menu.hidden = true;
  header.className = "profile-menu-head";
  header.innerHTML = `
    <h2>내 정보</h2>
    <div class="profile-menu-user">
      <span class="profile-menu-photo" aria-hidden="true">
        <img src="assets/brand/profile-avatar.png" alt="" />
      </span>
      <div>
        <strong>${memberName}</strong>
        <small>마지막 응시 <em data-profile-latest-exam>-</em></small>
      </div>
    </div>
  `;
  summary.className = "profile-summary-card";
  menuList.className = "profile-menu-list";
  menuList.innerHTML = `
    <a href="${PAGE_URLS.myInfo}">내정보</a>
    <a href="${PAGE_URLS.examHistory}">응시내역</a>
    <a href="${PAGE_URLS.analysis}">종합평가</a>
  `;

  logoutButton.type = "button";
  logoutButton.className = "logout-button";
  logoutButton.textContent = "로그아웃";
  logoutButton.addEventListener("click", logout);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextOpen = menu.hidden;
    menu.hidden = !nextOpen;
    button.setAttribute("aria-expanded", String(nextOpen));
    if (nextOpen) loadProfileMenuSummary(summary, menu.querySelector("[data-profile-latest-exam]"));
  });

  menu.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });

  menu.append(header, summary, menuList, logoutButton);
  actions.replaceChildren(button, menu);
  if (!actions.parentElement) topbar.insertBefore(actions, stats || null);
}

const examHistoryState = {
  selectedSubjectCode: "all",
  page: 1,
  pageSize: 10
};

function renderHistorySubjectTabs(subjectFilters = [], total = 0, selectedSubjectCode = "all") {
  if (!els.historySubjectTabs) return;

  if (!subjectFilters.length) {
    els.historySubjectTabs.innerHTML = "";
    return;
  }

  const tabItems = [
    { code: "all", name: "전체", count: total },
    ...subjectFilters.map((subject) => ({
      code: subject.subjectCode,
      name: subject.subjectName || subject.subjectCode || "기타",
      count: subject.count || 0
    }))
  ];

  els.historySubjectTabs.innerHTML = tabItems.map((subject) => `
    <button type="button" class="${subject.code === selectedSubjectCode ? "active" : ""}" data-subject-code="${subject.code}">
      <span>${subject.name}</span>
      <strong>${subject.count}</strong>
    </button>
  `).join("");

  els.historySubjectTabs.querySelectorAll("[data-subject-code]").forEach((button) => {
    button.addEventListener("click", () => {
      loadMyExamHistory(1, button.dataset.subjectCode || "all");
    });
  });
}

function renderMyExamHistory(items, selectedSubjectCode = "all", meta = {}) {
  if (!els.myExamHistoryList) return;
  renderHistorySubjectTabs(meta.subjectFilters || [], meta.totalAll || meta.total || 0, selectedSubjectCode);

  if (!items.length) {
    els.myExamHistoryList.innerHTML = `
      <div class="my-history-empty">
        <strong>응시내역이 없습니다.</strong>
        <p>시험을 응시하면 최근 결과가 여기에 표시됩니다.</p>
      </div>
    `;
    return;
  }

  els.myExamHistoryList.innerHTML = items.map((item) => `
    <article class="my-history-card">
      <div>
        <span class="my-history-date">${formatProfileDate(item.createdAt || item.examDate)}</span>
        <h3>${item.subjectName || item.subjectCode || "시험 결과"}</h3>
        <p>${item.roundTitle || "응시 결과"} · ${item.correctCount || 0}/${item.total || 0}문항 정답</p>
      </div>
      <div class="my-history-score">
        <strong>${item.score || 0}점</strong>
      </div>
      <button type="button" data-exam-id="${item.examId}" class="result-btn" aria-label="진단리포트">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l4.99 5L20.49 19l-4.99-5zM9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" fill="currentColor"/>
        </svg>
        <span>진단리포트</span>
      </button>
    </article>
  `).join("");

  els.myExamHistoryList.querySelectorAll("[data-exam-id]").forEach((button) => {
    button.addEventListener("click", () => {
      saveResultNavigation({
        examId: button.dataset.examId,
        examHistoryIds: []
      });
      window.location.href = PAGE_URLS.result;
    });
  });

  renderExamHistoryPagination(meta.page || 1, meta.totalPages || 1);
}

function renderExamHistoryPagination(page, totalPages) {
  if (!els.myExamHistoryPagination) return;
  if (totalPages <= 1) {
    els.myExamHistoryPagination.innerHTML = "";
    return;
  }

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  els.myExamHistoryPagination.innerHTML = `
    <button type="button" ${page <= 1 ? "disabled" : ""} data-page="${page - 1}">이전</button>
    ${pages.map((pageNumber) => `
      <button type="button" class="${pageNumber === page ? "active" : ""}" data-page="${pageNumber}">${pageNumber}</button>
    `).join("")}
    <button type="button" ${page >= totalPages ? "disabled" : ""} data-page="${page + 1}">다음</button>
  `;

  els.myExamHistoryPagination.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPage = Number(button.dataset.page || "1");
      if (!button.disabled && nextPage) loadMyExamHistory(nextPage, examHistoryState.selectedSubjectCode);
    });
  });
}

async function loadMyExamHistory(page = examHistoryState.page, subjectCode = examHistoryState.selectedSubjectCode) {
  if (!els.myExamHistoryList) return;

  const memberId = currentMemberId();
  if (!memberId) {
    renderMyExamHistory([]);
    return;
  }

  examHistoryState.page = Math.max(1, Number(page) || 1);
  examHistoryState.selectedSubjectCode = subjectCode || "all";
  els.myExamHistoryList.innerHTML = `
    <div class="my-history-empty">
      <strong>응시내역을 불러오는 중입니다.</strong>
      <p>잠시만 기다려주세요.</p>
    </div>
  `;
  if (els.myExamHistoryPagination) els.myExamHistoryPagination.innerHTML = "";

  try {
    // Fetch a larger page to enable client-side subject filtering and paging
    const response = await fetch(`${API_BASE}/results/history?member_id=${encodeURIComponent(memberId)}&limit=100`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const items = data.items || [];
    // persist to state for client-side filtering/paging
    state.attemptHistory = items;
    saveState();
    // ensure subjects are loaded so tabs show proper names
    if (!Array.isArray(subjects) || subjects.length === 0) {
      try {
        await loadAvailableSubjects();
      } catch (e) {
        // ignore subject load errors, fallback to items
      }
    }
    renderExamTabs((subjects || []).slice(0, 5));
    renderExamHistoryList(items, 1, 8);
  } catch (error) {
    els.myExamHistoryList.innerHTML = `
      <div class="my-history-empty error">
        <strong>응시내역을 불러오지 못했습니다.</strong>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function renderExamTabs(list) {
  const container = document.getElementById("examHistoryTabs");
  if (!container) return;
  container.innerHTML = "";


  // helper to convert hex to rgba
  function hexToRgba(hex, alpha) {
    if (!hex) return '';
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0,2),16);
    const g = parseInt(c.substring(2,4),16);
    const b = parseInt(c.substring(4,6),16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // helper to darken a hex color slightly (amount 0..1)
  function darkenHex(hex, amount) {
    if (!hex) return hex;
    const c = hex.replace('#', '');
    const r = Math.max(0, Math.min(255, Math.floor(parseInt(c.substring(0,2),16) * (1 - amount))));
    const g = Math.max(0, Math.min(255, Math.floor(parseInt(c.substring(2,4),16) * (1 - amount))));
    const b = Math.max(0, Math.min(255, Math.floor(parseInt(c.substring(4,6),16) * (1 - amount))));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  // add 'All' tab
  const allTab = document.createElement('button');
  allTab.type = 'button';
  allTab.className = 'subject-tab' + (state.examHistorySubjectId ? '' : ' active');
  allTab.textContent = 'ALL';
  allTab.style.color = '#374151';
  allTab.style.background = 'rgba(15,23,42,0.06)';
  allTab.addEventListener('click', () => {
    state.examHistorySubjectId = null;
    saveState();
    container.querySelectorAll('.subject-tab').forEach((t) => t.classList.remove('active'));
    allTab.classList.add('active');
    renderExamHistoryList(state.attemptHistory || [], 1, 8);
  });
  container.appendChild(allTab);

  (list || []).forEach((subject) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'subject-tab' + (String(state.examHistorySubjectId || '').toUpperCase() === String(subject.subjectCode || subject.id || '').toUpperCase() ? ' active' : '');
    // show subject code only
    const code = subject.subjectCode || subject.subjectCode || subject.id || (subject.name || '').slice(0,3).toUpperCase();
    btn.textContent = String(code).toUpperCase();

    // style color based on subject visual (reuse wrong-notes helper)
    const visual = typeof getWrongSubjectVisual === 'function' ? getWrongSubjectVisual(subject) : { color: '#60a5fa' };
    // text: slightly darker than visual color for readability
    try {
      btn.style.color = darkenHex(visual.color || '#60a5fa', 0.18);
    } catch (e) {
      btn.style.color = visual.color || '#60a5fa';
    }
    btn.style.borderRadius = '8px';
    // default pastel background based on visual color
    btn.style.background = hexToRgba(visual.color || '#60a5fa', 0.12);
    // if this tab is active from state, apply active background
    if (String(state.examHistorySubjectId || '').toUpperCase() === String(code || '').toUpperCase()) {
      btn.classList.add('active');
      btn.style.background = hexToRgba(visual.color || '#60a5fa', 0.28);
    }

    btn.addEventListener('click', () => {
      state.examHistorySubjectId = code;
      saveState();
      // update active styles
      container.querySelectorAll('.subject-tab').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      // active background tint (slightly stronger for visibility)
      btn.style.background = hexToRgba(visual.color || '#60a5fa', 0.18);
      renderExamHistoryList(state.attemptHistory || [], 1, 8);
    });
    container.appendChild(btn);
  });
}

function renderExamHistoryList(items = [], page = 1, pageSize = 8) {
  const target = document.getElementById('myExamHistoryList');
  const pager = document.getElementById('examHistoryPagination');
  if (!target) return;

  const compactSubjects = ['AI', 'CA', 'CD', 'DE', 'SW'];
  const isCompactView = Boolean(state.examHistorySubjectId) && compactSubjects.includes(String(state.examHistorySubjectId || '').toUpperCase());

  // filter
  const filtered = state.examHistorySubjectId
    ? (items || []).filter(i => String((i.subjectCode || i.subjectId || i.subjectName || '')).toUpperCase() === String(state.examHistorySubjectId || '').toUpperCase())
    : (items || []).slice();

  // sort by date desc
  filtered.sort((a, b) => new Date(b.createdAt || b.examDate || 0) - new Date(a.createdAt || a.examDate || 0));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  if (pageItems.length === 0) {
    target.innerHTML = `
      <div class="my-history-empty">
        <strong>응시내역이 없습니다.</strong>
        <p>선택한 과목의 응시내역이 없습니다.</p>
      </div>
    `;
  } else {
    target.innerHTML = pageItems.map((item) => {
      if (isCompactView) {
        const dateText = formatProfileDate(item.createdAt || item.examDate);
        const round = item.roundTitle || '';
        const correct = item.correctCount || item.correct || 0;
        const totalItems = item.total || 0;
        return `
          <article class="my-history-card compact">
            <div>
              <span class="my-history-compact">${dateText} ${round} ${correct}/${totalItems}문항</span>
            </div>
            <div class="my-history-score">
              <strong>${item.score || item.totalScore || 0}점</strong>
            </div>
            <button type="button" data-exam-id="${item.examId || item.id || ''}" class="result-btn" aria-label="진단리포트">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l4.99 5L20.49 19l-4.99-5zM9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" fill="currentColor"/>
              </svg>
              <span>진단리포트</span>
            </button>
          </article>
        `;
      }
      return `
        <article class="my-history-card">
          <div>
            <h3>${item.subjectName || item.subjectCode || '시험 결과'}</h3>
            <span class="my-history-meta">${formatProfileDate(item.createdAt || item.examDate)} ${item.roundTitle || ''} ${item.correctCount || item.correct || 0}/${item.total || 0}문항</span>
          </div>
          <div class="my-history-score">
            <strong>${item.score || item.totalScore || 0}점</strong>
          </div>
          <button type="button" data-exam-id="${item.examId || item.id || ''}" class="result-btn" aria-label="진단리포트">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l4.99 5L20.49 19l-4.99-5zM9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" fill="currentColor"/>
            </svg>
            <span>진단리포트</span>
          </button>
        </article>
      `;
    }).join('');

    // attach click handlers
    target.querySelectorAll('[data-exam-id]').forEach((button) => {
      button.addEventListener('click', () => {
        saveResultNavigation({ examId: button.dataset.examId, examHistoryIds: [] });
        window.location.href = PAGE_URLS.result;
      });
    });
  }

  // render pagination
  if (pager) {
    pager.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(i);
      if (i === currentPage) btn.classList.add('active');
      btn.addEventListener('click', () => renderExamHistoryList(items, i, pageSize));
      pager.appendChild(btn);
    }
  }

}

async function loadMyInfoMetrics(target) {
  const memberId = currentMemberId();
  if (!target) return;
  target.innerHTML = renderMyInfoMetricCards();
  if (!memberId) return;

        return `
          <article class="my-history-card compact">
            <div>
              <h3>${item.subjectName || item.subjectCode || '시험 결과'}</h3>
              <span class="my-history-meta">${dateText} ${round} ${correct}/${totalItems}문항</span>
            </div>
            <div class="my-history-score">
              <strong>${item.score || item.totalScore || 0}점</strong>
            </div>
            <button type="button" data-exam-id="${item.examId || item.id || ''}" class="result-btn" aria-label="진단리포트">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l4.99 5L20.49 19l-4.99-5zM9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" fill="currentColor"/>
              </svg>
              <span>진단리포트</span>
            </button>
          </article>
        `;
  const topGap = Math.max(0, topScore - averageScore);
  const predictedRank = summary.predictedRank || 12;

  return `
    <article class="my-info-score-card rank">
      <span>내 순위</span>
      <strong>17<small>위</small></strong>
      <p>전체 1,248명 중</p>
      <em>▲ 지난주 23위</em>
    </article>
    <article class="my-info-score-card score">
      <span>내 점수</span>
      <strong>${averageScore}<small>점</small></strong>
      <p>상위 25%</p>
      <em>▲ 지난주 72점</em>
    </article>
    <article class="my-info-score-card target">
      <span>상위 10% 기준</span>
      <strong>${topScore}<small>점</small></strong>
      <p>상위 10% 진입까지<br />${topGap}점 남았어요!</p>
    </article>
    <article class="my-info-score-card growth">
      <span>이번 주 성장률</span>
      <strong>+15<small>점</small></strong>
      <p>전체 2위</p>
    </article>
    <article class="my-info-score-card predict">
      <span>AI 예측 순위</span>
      <small>(향후 1주)</small>
      <strong>${predictedRank}<small>위</small></strong>
      <p>▲ 5계단 상승 예상</p>
    </article>
    <article class="my-info-score-card exams">
      <span>총 응시</span>
      <strong>${examCount}<small>회</small></strong>
      <p>누적 응시 횟수</p>
    </article>
    <article class="my-info-score-card answered">
      <span>풀이 문항</span>
      <strong>${answeredTotal}</strong>
      <p>전체 풀이 문항 수</p>
    </article>
    <article class="my-info-score-card wrong">
      <span>오답</span>
      <strong>${wrongTotal}</strong>
      <p>복습이 필요한 문항</p>
      <em>오답노트 확인 추천</em>
    </article>
  `;
}

// Render HTML for the 8 metric cards shown on the My Info page.
function renderMyInfoMetricCards() {
  const averageScore = Math.round(state.averageScore || 72);
  const topScore = Math.round(state.topScore || 90);
  const topGap = Math.max(0, topScore - averageScore);
  const predictedRank = state.predictedRank || 12;
  const examCount = state.examCount || 5;
  const answeredTotal = state.answeredTotal || 420;
  const wrongTotal = state.wrongTotal || 8;

  return `
    <article class="my-info-score-card rank">
      <span>내 순위</span>
      <strong>17<small>위</small></strong>
      <p>전체 1,248명 중</p>
      <em>▲ 지난주 23위</em>
    </article>
    <article class="my-info-score-card score">
      <span>내 점수</span>
      <strong>${averageScore}<small>점</small></strong>
      <p>상위 25%</p>
      <em>▲ 지난주 72점</em>
    </article>
    <article class="my-info-score-card target">
      <span>상위 10% 기준</span>
      <strong>${topScore}<small>점</small></strong>
      <p>상위 10% 진입까지<br />${topGap}점 남았어요!</p>
    </article>
    <article class="my-info-score-card growth">
      <span>이번 주 성장률</span>
      <strong>+15<small>점</small></strong>
      <p>전체 2위</p>
    </article>
    <article class="my-info-score-card predict">
      <span>AI 예측 순위</span>
      <small>(향후 1주)</small>
      <strong>${predictedRank}<small>위</small></strong>
      <p>▲ 5계단 상승 예상</p>
    </article>
    <article class="my-info-score-card exams">
      <span>총 응시</span>
      <strong>${examCount}<small>회</small></strong>
      <p>누적 응시 횟수</p>
    </article>
    <article class="my-info-score-card answered">
      <span>풀이 문항</span>
      <strong>${answeredTotal}</strong>
      <p>전체 풀이 문항 수</p>
    </article>
    <article class="my-info-score-card wrong">
      <span>오답</span>
      <strong>${wrongTotal}</strong>
      <p>복습이 필요한 문항</p>
      <em>오답노트 확인 추천</em>
    </article>
  `;
}

function renderMyInfoPage() {
  const target = document.getElementById('myInfoMetrics');
  if (!target) return;
  // populate with existing cached values immediately
  target.innerHTML = renderMyInfoMetricCards();
  // then load live metrics (if logged in)
  loadMyInfoMetrics(target);
}

function renderExamHistoryPage() {
  // Ensure the 'ALL' tab is selected by default when opening the Exam History page
  state.examHistorySubjectId = null;
  saveState();
  loadMyExamHistory();
}

function renderProfileOptions(filter = "") {
  if (!els.profileSelect || !els.profileOptions) return;

  const normalized = filter.trim().toLowerCase();
  const matches = profiles.filter((name) => name.toLowerCase().includes(normalized));

  els.profileSelect.innerHTML = "";
  profiles.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === state.profileName;
    els.profileSelect.appendChild(option);
  });

  els.profileOptions.innerHTML = "";
  matches.forEach((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "select-option";
    button.textContent = name;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", name === state.profileName ? "true" : "false");
    button.addEventListener("click", () => selectProfile(name));
    els.profileOptions.appendChild(button);
  });

  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "select-empty";
    empty.textContent = "검색 결과가 없습니다.";
    els.profileOptions.appendChild(empty);
  }
}

function selectProfile(name) {
  state.profileName = name;
  if (els.profileSearch) els.profileSearch.value = name;
  if (els.profileSelect) els.profileSelect.value = name;
  if (els.profileOptions) els.profileOptions.classList.remove("open");
  if (els.profileSearch) {
    els.profileSearch.setAttribute("aria-expanded", "false");
    els.profileSearch.blur();
  }
  saveState();
}

function initProfilePage() {
  const initialProfile = profiles.includes(state.profileName) ? state.profileName : profiles[0];
  state.profileName = initialProfile;
  state.questionCount = 20;
  if (els.profileSearch) els.profileSearch.value = initialProfile;
  renderProfileOptions();
  saveState();
}

function startPractice() {
  const typedName = (els.profileSearch?.value || "").trim();
  const selectedName = profiles.includes(typedName) ? typedName : state.profileName || profiles[0];

  state.profileName = selectedName;
  state.questionCount = 20;
  state.subjectId = null;
  state.activeQuestions = [];
  state.index = 0;
  state.selected = null;
  state.singleAnswers = {};
  state.mockAnswers = {};
  state.lastResult = null;
  saveState();
  showScreen("subjects");
}

function renderSubjects() {
  if (!els.subjectGrid) return;
  els.subjectGrid.innerHTML = "";
  state.questionCount = 20;
  if (els.profileSummary) {
    els.profileSummary.textContent = `${state.profileName || "응시자"} · 20문제`;
  }
  if (subjects.length === 0) {
    const empty = document.createElement("article");
    empty.className = "subject-card";
    empty.innerHTML = `
      <strong>과목 없음</strong>
      <small>subject_tb 에 등록된 과목을 불러오지 못했습니다.</small>
    `;
    els.subjectGrid.appendChild(empty);
    return;
  }
  subjects.forEach((subject) => {
    const visual = getSubjectVisual(subject);
    const card = document.createElement("button");
    card.type = "button";
    card.className = `subject-card subject-course-card ${visual.className}`;
    card.setAttribute("aria-pressed", String(state.subjectId === subject.id));
    if (state.subjectId === subject.id) card.classList.add("selected");
    card.innerHTML = `
      <span class="subject-select-dot" aria-hidden="true"></span>
      <span class="subject-title-row">
        <strong>${visual.subjectTitle}</strong>
      </span>
      <span class="subject-illustration" aria-hidden="true">
        <img src="${visual.image}" alt="" />
      </span>
      <span class="subject-character-name">${visual.title}</span>
      <span class="subject-copy">${visual.description}</span>
      <span class="subject-meta-list">
        <span><b>관련직무</b>${visual.jobs}</span>
        <span><b>기술스택</b>${visual.stack}</span>
      </span>
    `;
    card.addEventListener("mouseenter", () => {
      if (Date.now() < subjectHoverScrollLockedUntil) return;
      card.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
    card.addEventListener("click", () => chooseSubject(subject.id));
    els.subjectGrid.appendChild(card);
  });
}

function chooseSubject(subjectId) {
  state.subjectId = subjectId;
  state.activeQuestions = [];
  state.index = 0;
  state.selected = null;
  state.singleAnswers = {};
  state.mockAnswers = {};
  saveState();
  renderSubjects();
}

function startSelectedSubject() {
  const subjectId = state.subjectId;
  if (!subjectId) {
    showToast("응시할 과목을 선택해주세요.");
    return;
  }
  selectSubject(subjectId);
}

function setSubjectLoading(isLoading) {
  if (els.subjectLoading) els.subjectLoading.hidden = !isLoading;
  if (els.subjectLoadingBar) {
    els.subjectLoadingBar.style.width = isLoading ? "82%" : "0%";
  }
  if (els.subjectPageTitle) els.subjectPageTitle.hidden = isLoading;
  if (els.subjectGrid) els.subjectGrid.style.display = isLoading ? "none" : "";
  if (els.startSelectedSubjectBtn) els.startSelectedSubjectBtn.disabled = isLoading;
}

function getSubjectVisual(subject) {
  const code = String(subject.subjectCode || subject.id || "").toUpperCase();
  const normalizedName = String(subject.name || "").toLowerCase();
  const name = subject.name || code;
  const base = {
    title: code || name,
    subjectTitle: name,
    description: subject.desc || "과목별 역량 문제를 풀이합니다.",
    jobs: "역량 진단 대상 직무",
    stack: "문제은행 기반 역량 진단",
    image: "assets/subjects/arin.png",
    className: "subject-theme-ai"
  };
  const visuals = {
    SIAN: {
      title: "Sian",
      subjectTitle: "SW 분석설계",
      description: "SW개발 지식과 관련 분야의 기술을 기반으로 분석과 설계를 수행합니다.",
      jobs: "응용SW 엔지니어, SW개발 관리자, 조직 관리자",
      stack: "ERD, 흐름도, 설계 및 디자인 패턴, DDD, 소프트웨어 테스트",
      image: "assets/subjects/subject-sa-ui22-transparent.png",
      className: "subject-theme-sian"
    },
    CD: {
      title: "Clode",
      subjectTitle: "Cloud for Developer",
      description: "클라우드 환경에서 애플리케이션 시스템을 프로비저닝, 운영 및 관리합니다.",
      jobs: "DevOps 엔지니어, 시스템 관리자, SW개발자",
      stack: "Docker, Kubernetes, CI/CD, AWS CodePipeline, AWS Lambda",
      image: "assets/subjects/subject-cd-ui21-transparent.png",
      className: "subject-theme-clode"
    },
    CA: {
      title: "Carite",
      subjectTitle: "Cloud for Architect",
      description: "클라우드를 기반으로 최적화된 솔루션을 설계하고 전략을 수립합니다.",
      jobs: "클라우드 아키텍트, 컨설턴트, 시스템 엔지니어",
      stack: "가상화, 자동화, AWS RDS, API Gateway, Azure SQL Database, RTO/RPO",
      image: "assets/subjects/subject-ca-ui19-transparent.png",
      className: "subject-theme-carite"
    },
    DE: {
      title: "Derin",
      subjectTitle: "Data Engineering",
      description: "데이터 수집, 저장, 처리와 데이터 파이프라인을 설계합니다.",
      jobs: "데이터 엔지니어, 백엔드 개발자, 데이터 관리자",
      stack: "SQL, Python, Pandas, NumPy, Matplotlib, Seaborn, 데이터 파이프라인",
      image: "assets/subjects/subject-de-ui20-transparent.png",
      className: "subject-theme-derin"
    },
    AI: {
      title: "Arin",
      subjectTitle: "AI Engineering",
      description: "데이터 처리와 AI 모델링으로 실무의 AI 활용 역량을 진단합니다.",
      jobs: "AI 엔지니어, 머신러닝 엔지니어, 데이터 과학자",
      stack: "MLflow, Scikit-learn, TensorFlow, XGBoost, LightGBM",
      image: "assets/subjects/subject-ai-ui18-transparent.png",
      className: "subject-theme-arin"
    }
  };
  const matchedKey = visuals[code]
    ? code
    : code === "SW" || normalizedName.includes("software") || normalizedName.includes("analysis") || normalizedName.includes("sian") || normalizedName.includes("분석")
      ? "SIAN"
      : normalizedName.includes("developer") || normalizedName.includes("clode")
        ? "CD"
        : normalizedName.includes("architect") || normalizedName.includes("carite")
          ? "CA"
          : normalizedName.includes("data") || normalizedName.includes("derin")
            ? "DE"
            : normalizedName.includes("ai") || normalizedName.includes("arin")
              ? "AI"
              : code;
  return { ...base, ...(visuals[matchedKey] || {}) };
}

async function selectSubject(subjectId) {
  setSubjectLoading(true);
  state.questionCount = 20;
  state.subjectId = subjectId;
  state.activeQuestions = [];
  state.index = 0;
  state.selected = null;
  state.singleAnswers = {};
  state.mockAnswers = {};
  const subject = currentSubject();
  if (els.selectedSubjectEyebrow) els.selectedSubjectEyebrow.textContent = "Selected Subject";
  if (els.selectedSubjectTitle) els.selectedSubjectTitle.textContent = subject.name;
  saveState();

  try {
    await loadSubjectQuestions(subject, state.questionCount);
    if (state.activeQuestions.length === 0) {
      showToast(`${subject.name} 과목의 DB 문제가 없습니다.`);
      return;
    }
    if (subject.subjectCode && state.activeQuestions.length < state.questionCount) {
      showToast(`${subject.name} 문제는 ${state.activeQuestions.length}문항까지 불러왔습니다.`);
    }
  } catch (error) {
    state.activeQuestions = [];
    saveState();
    setSubjectLoading(false);
    showToast(`DB 문제를 불러오지 못했습니다. (${error.message})`);
    return;
  }

  if (els.subjectLoadingBar) els.subjectLoadingBar.style.width = "100%";
  startMock();
}

function startMock() {
  state.mode = "mock";
  state.index = 0;
  state.selected = state.mockAnswers[0] || null;
  saveState();
  if (!els.mockSubject) {
    showScreen("mock");
    return;
  }
  renderMock();
  showScreen("mock");
}
