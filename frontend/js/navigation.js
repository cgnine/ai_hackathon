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

function renderProfileButton() {
  const topbar = document.querySelector(".topbar");
  const stats = document.querySelector(".top-stats");
  if (!topbar || document.getElementById("profileButton")) return;

  const actions = document.createElement("div");
  const button = document.createElement("button");
  const logoutButton = document.createElement("button");

  actions.className = "profile-actions";
  button.type = "button";
  button.className = "profile-button";
  button.id = "profileButton";
  button.textContent = currentMemberName() || state.profileName || profiles[0];
  button.addEventListener("click", () => showScreen("analysis"));

  logoutButton.type = "button";
  logoutButton.className = "logout-button";
  logoutButton.textContent = "로그아웃";
  logoutButton.addEventListener("click", logout);

  actions.append(button, logoutButton);
  topbar.insertBefore(actions, stats || null);
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
      image: "assets/subjects/sian.png",
      className: "subject-theme-sian"
    },
    CD: {
      title: "Clode",
      subjectTitle: "Cloud for Developer",
      description: "클라우드 환경에서 애플리케이션 시스템을 프로비저닝, 운영 및 관리합니다.",
      jobs: "DevOps 엔지니어, 시스템 관리자, SW개발자",
      stack: "Docker, Kubernetes, CI/CD, AWS CodePipeline, AWS Lambda",
      image: "assets/subjects/clode.png",
      className: "subject-theme-clode"
    },
    CA: {
      title: "Carite",
      subjectTitle: "Cloud for Architect",
      description: "클라우드를 기반으로 최적화된 솔루션을 설계하고 전략을 수립합니다.",
      jobs: "클라우드 아키텍트, 컨설턴트, 시스템 엔지니어",
      stack: "가상화, 자동화, AWS RDS, API Gateway, Azure SQL Database, RTO/RPO",
      image: "assets/subjects/carite.png",
      className: "subject-theme-carite"
    },
    DE: {
      title: "Derin",
      subjectTitle: "Data Engineering",
      description: "데이터 수집, 저장, 처리와 데이터 파이프라인을 설계합니다.",
      jobs: "데이터 엔지니어, 백엔드 개발자, 데이터 관리자",
      stack: "SQL, Python, Pandas, NumPy, Matplotlib, Seaborn, 데이터 파이프라인",
      image: "assets/subjects/derin.png",
      className: "subject-theme-derin"
    },
    AI: {
      title: "Arin",
      subjectTitle: "AI Engineering",
      description: "데이터 처리와 AI 모델링으로 실무의 AI 활용 역량을 진단합니다.",
      jobs: "AI 엔지니어, 머신러닝 엔지니어, 데이터 과학자",
      stack: "MLflow, Scikit-learn, TensorFlow, XGBoost, LightGBM",
      image: "assets/subjects/arin.png",
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
