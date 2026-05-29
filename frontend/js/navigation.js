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
    const card = document.createElement("button");
    card.type = "button";
    card.className = "subject-card";
    card.innerHTML = `
      <strong>${subject.name}</strong>
      <small>${subject.desc}</small>
    `;
    card.addEventListener("click", () => selectSubject(subject.id));
    els.subjectGrid.appendChild(card);
  });
}

async function selectSubject(subjectId) {
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
    showToast(`DB 문제를 불러오지 못했습니다. (${error.message})`);
    return;
  }

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
