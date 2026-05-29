function bindScreenLinks() {
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      showScreen(button.dataset.screen);
    });
  });
}

function bindOptional(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

async function initPage() {
  const page = document.body.dataset.page || "subjects";

  if (page === "login") {
    initLoginPage();
    return;
  }

  if (!requireLogin(page)) return;

  bindScreenLinks();
  bindOptional(els.homeLink, "click", (event) => {
    event.preventDefault();
    showScreen("profile");
  });
  bindOptional(els.profileSearch, "focus", () => {
    els.profileOptions?.classList.add("open");
    els.profileSearch?.setAttribute("aria-expanded", "true");
    renderProfileOptions(els.profileSearch.value);
  });
  bindOptional(els.profileSearch, "input", () => {
    els.profileOptions?.classList.add("open");
    els.profileSearch?.setAttribute("aria-expanded", "true");
    renderProfileOptions(els.profileSearch.value);
  });
  bindOptional(els.profileSelect, "change", () => selectProfile(els.profileSelect.value));
  document.addEventListener("click", (event) => {
    if (!els.profileSelectBox || els.profileSelectBox.contains(event.target)) return;
    els.profileOptions?.classList.remove("open");
    els.profileSearch?.setAttribute("aria-expanded", "false");
  });
  bindOptional(els.startPracticeBtn, "click", startPractice);
  bindOptional(els.startMockBtn, "click", startMock);
  bindOptional(els.singleSubmitBtn, "click", submitSingle);
  bindOptional(els.singleWrongBtn, "click", () => addWrongNote(state.index));
  bindOptional(els.singlePrevBtn, "click", () => moveSingle(state.index - 1));
  bindOptional(els.singleNextBtn, "click", () => moveSingle(state.index + 1));
  bindOptional(els.gradeMockBtn, "click", gradeMock);
  bindOptional(els.reviewSubmitBtn, "click", submitWrongPractice);
  bindOptional(els.reviewPrevBtn, "click", () => moveWrongReview(-1));
  bindOptional(els.reviewNextBtn, "click", () => moveWrongReview(1));
  bindOptional(els.reviewBackBtn, "click", () => showScreen("wrong"));
  bindOptional(els.reviewRestartBtn, "click", restartWrongReview);
  bindOptional(els.generateBtn, "click", runHarness);
  bindOptional(els.toggleAllExplanationsBtn, "click", toggleAllResultExplanations);
  bindOptional(els.saveWrongAllBtn, "click", saveAllWrongApiResultItems);

  const memberId = currentMemberId();
  if (memberId) {
    state.profileName = currentMemberName();
  } else if (!profiles.includes(state.profileName)) {
    state.profileName = profiles[0];
  }
  state.questionCount = 20;
  try {
    await loadAvailableSubjects();
  } catch (error) {
    showToast(`DB 과목 목록을 불러오지 못했습니다. (${error.message})`);
  }
  if (!state.subjectId || !subjects.some((subject) => subject.id === state.subjectId)) {
    state.subjectId = subjects[0]?.id || null;
  }
  ensureSampleWrongNotes();
  if (page === "profile") initProfilePage();
  if (page === "subjects") renderSubjects();
  if (page === "mock") renderMock();
  if (page === "result") {
    loadBackendResultPage();
    initResultChat();
  }
  if (page === "analysis") renderAnalysisPage();
  if (page === "wrong") {
    state.wrongSubjectId = null;
    state.wrongOpenDateKey = null;
    saveState();
    loadBackendWrongNotes();
  }
  if (page === "wrong-practice") renderWrongPractice();

  renderProfileButton();
  renderTopStats();
}

initPage();
