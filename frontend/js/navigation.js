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

  target.innerHTML = `
    <div class="profile-summary-tile"><span>총 응시</span><strong>-</strong></div>
    <div class="profile-summary-tile"><span>평균 점수</span><strong>-</strong></div>
  `;

  try {
    const response = await fetch(`${API_BASE}/results/analysis?member_id=${encodeURIComponent(memberId)}&include_commentary=false`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const summary = data.summary || {};
    if (latestExamTarget) {
      latestExamTarget.textContent = formatProfileDate(summary.latestExamAt);
    }
    target.innerHTML = `
      <div class="profile-summary-tile"><span>총 응시</span><strong>${summary.examCount || 0}회</strong></div>
      <div class="profile-summary-tile"><span>평균 점수</span><strong>${summary.averageScore || 0}점</strong></div>
      <div class="profile-summary-tile"><span>풀이 문항</span><strong>${summary.answeredTotal || 0}</strong></div>
      <div class="profile-summary-tile"><span>오답</span><strong>${summary.wrongTotal || 0}</strong></div>
    `;
  } catch {
    target.innerHTML = `
      <div class="profile-summary-tile"><span>총 응시</span><strong>0회</strong></div>
      <div class="profile-summary-tile"><span>평균 점수</span><strong>0점</strong></div>
    `;
  }
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
    <span class="profile-avatar large">${profileInitial(memberName)}</span>
    <div>
      <strong>${memberName}</strong>
      <p>사번 ${memberId || "-"}</p>
      <small>마지막 응시 <em data-profile-latest-exam>-</em></small>
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

function renderMyExamHistory(items) {
  if (!els.myExamHistoryList) return;

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
        <span>오답 ${item.wrongCount || 0}</span>
      </div>
      <button type="button" data-exam-id="${item.examId}">결과 보기</button>
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
}

async function loadMyExamHistory() {
  if (!els.myExamHistoryList) return;

  const memberId = currentMemberId();
  if (!memberId) {
    renderMyExamHistory([]);
    return;
  }

  els.myExamHistoryList.innerHTML = `
    <div class="my-history-empty">
      <strong>응시내역을 불러오는 중입니다.</strong>
      <p>잠시만 기다려주세요.</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_BASE}/results/history?member_id=${encodeURIComponent(memberId)}&limit=10`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    renderMyExamHistory(data.items || []);
  } catch (error) {
    els.myExamHistoryList.innerHTML = `
      <div class="my-history-empty error">
        <strong>응시내역을 불러오지 못했습니다.</strong>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function renderMyInfoPage() {
  if (!els.myInfoName || !els.myInfoMemberId || !els.myInfoMetrics) return;
  const memberName = currentMemberName() || state.profileName || "응시자";
  const memberId = currentMemberId() || "-";
  els.myInfoName.textContent = memberName;
  if (els.myInfoAvatar) els.myInfoAvatar.textContent = profileInitial(memberName);
  els.myInfoMemberId.textContent = memberId;
  loadProfileMenuSummary(els.myInfoMetrics);
}

function renderExamHistoryPage() {
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
