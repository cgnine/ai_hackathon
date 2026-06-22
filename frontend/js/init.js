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

function initMobileMenu() {
  const page = document.body.dataset.page || "";
  if (page === "main" || page === "login" || page === "signup" || page === "reset-password") return;

  const topbar = document.querySelector(".topbar");
  const nav = document.querySelector(".main-nav");
  if (!topbar || !nav || document.getElementById("mobileMenuBtn")) return;
  nav.querySelectorAll(".nav-btn").forEach((link) => {
    link.classList.add("desktop-nav-item");
  });

  const button = document.createElement("button");
  const memberLabel = document.createElement("span");
  const overlay = document.createElement("div");
  const mobileItems = [
    { label: "내정보", href: PAGE_URLS.myInfo },
    { label: "시험응시", href: PAGE_URLS.profile },
    { label: "오답노트", href: PAGE_URLS.wrong },
    { label: "AI 맞춤형 추천문제", href: PAGE_URLS.aiRecommend },
    { label: "응시내역", href: PAGE_URLS.examHistory },
    { label: "종합평가", href: PAGE_URLS.analysis },
    { label: "AI 랭킹", href: PAGE_URLS.ranking },
  ];

  button.type = "button";
  button.id = "mobileMenuBtn";
  button.className = "mobile-menu-btn";
  button.setAttribute("aria-label", "메뉴 열기");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = "<span></span><span></span><span></span>";
  memberLabel.className = "mobile-menu-member";
  memberLabel.textContent = `${currentMemberName() || state.profileName || "응시자"}님`;

  overlay.className = "mobile-menu-overlay";
  overlay.hidden = true;

  const closeMenu = () => {
    document.body.classList.remove("mobile-menu-open");
    button.setAttribute("aria-expanded", "false");
    overlay.hidden = true;
  };

  const openMenu = () => {
    document.body.classList.add("mobile-menu-open");
    button.setAttribute("aria-expanded", "true");
    overlay.hidden = false;
  };

  button.addEventListener("click", () => {
    if (document.body.classList.contains("mobile-menu-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });
  overlay.addEventListener("click", closeMenu);
  nav.appendChild(memberLabel);
  mobileItems.forEach((item) => {
    const link = document.createElement("a");
    link.className = "nav-btn mobile-nav-item";
    link.href = item.href;
    link.textContent = item.label;
    link.addEventListener("click", closeMenu);
    nav.appendChild(link);
  });
  const logoutMenuButton = document.createElement("button");
  logoutMenuButton.type = "button";
  logoutMenuButton.className = "nav-btn mobile-nav-item mobile-logout-btn";
  logoutMenuButton.textContent = "로그아웃";
  logoutMenuButton.addEventListener("click", () => {
    closeMenu();
    logout();
  });
  nav.appendChild(logoutMenuButton);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  topbar.insertBefore(button, nav);
  document.body.appendChild(overlay);
}

function initPrintDownloadButtons() {
  document.querySelectorAll(".analysis-pdf-btn").forEach((button) => {
    if (button.dataset.printBound === "true") return;
    button.dataset.printBound = "true";
    button.addEventListener("click", () => {
      window.print();
    });
  });
}

function renderFooter() {
  if (document.querySelector(".main-footer")) return;
  const footerPages = new Set(["harness", "ai-recommend", "wrong", "wrong-practice", "subjects", "mock", "result", "ranking"]);
  const page = document.body.dataset.page || "";
  if (!footerPages.has(page)) return;

  const footer = document.createElement("footer");
  footer.className = "main-footer";
  footer.innerHTML = `
    <div class="main-footer-inner">
      <strong class="main-footer-logo">KB Masters</strong>
      <div class="main-footer-info">
        <p>대표 : CGNINE</p>
        <p>주소 : 서울특별시 중구 수표동 47-1 청계IT타워 9층</p>
        <p>TEL : 02-6936-8547&nbsp;&nbsp;&nbsp; Email : contact@kbmasters.co.kr</p>
      </div>
    </div>
    <div class="main-footer-copy">© CGNINE. All Rights Reserved.</div>
  `;
  document.body.appendChild(footer);
}

async function loadSubjectsForPage(page, waitForSubjects) {
  const load = async () => {
    try {
      await loadAvailableSubjects();
      if (!state.subjectId || !subjects.some((subject) => subject.id === state.subjectId)) {
        state.subjectId = subjects[0]?.id || state.subjectId;
      }
      if (subjects.length) ensureSampleWrongNotes();
      saveState();
      renderTopStats();
      if (page === "wrong") renderWrongNotes();
    } catch (error) {
      showToast(`DB 과목 목록을 불러오지 못했습니다. (${error.message})`);
    }
  };

  if (waitForSubjects) {
    await load();
    return;
  }

  load();
}

async function initPage() {
  const page = document.body.dataset.page || "subjects";
  if (page === "subjects" && "scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  if (page === "login") {
    initLoginPage();
    return;
  }

  if (page === "signup") {
    initSignupPage();
    return;
  }

  if (page === "reset-password") {
    initResetPasswordPage();
    return;
  }

  renderFooter();

  if (!requireLogin(page)) return;

  initMobileMenu();
  bindScreenLinks();
  bindOptional(els.homeLink, "click", (event) => {
    event.preventDefault();
    window.location.href = PAGE_URLS.subjects || "subjects.html";
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
  bindOptional(els.startSelectedSubjectBtn, "click", startSelectedSubject);
  bindOptional(els.startMockBtn, "click", startMock);
  bindOptional(els.singleSubmitBtn, "click", submitSingle);
  bindOptional(els.singleWrongBtn, "click", () => addWrongNote(state.index));
  bindOptional(els.singlePrevBtn, "click", () => moveSingle(state.index - 1));
  bindOptional(els.singleNextBtn, "click", () => moveSingle(state.index + 1));
  bindOptional(els.gradeMockAiBtn, "click", () => gradeMock(true));
  bindOptional(els.reviewSubmitBtn, "click", submitWrongPractice);
  bindOptional(els.reviewPrevBtn, "click", () => moveWrongReview(-1));
  bindOptional(els.reviewNextBtn, "click", () => moveWrongReview(1));
  bindOptional(els.reviewBackBtn, "click", () => showScreen("wrong"));
  bindOptional(els.reviewRestartBtn, "click", restartWrongReview);
  bindOptional(els.generateBtn, "click", runHarness);
  bindOptional(els.toggleAllExplanationsBtn, "click", toggleAllResultExplanations);
  bindOptional(els.saveWrongAllBtn, "click", saveAllWrongApiResultItems);
  initAiRecommendActions();

  const memberId = currentMemberId();
  if (memberId) {
    state.profileName = currentMemberName();
  } else if (profiles.length && !profiles.includes(state.profileName)) {
    state.profileName = profiles[0];
  }
  state.questionCount = 20;
  const waitForSubjects = page === "subjects" || page === "mock";
  if (waitForSubjects) {
    await loadSubjectsForPage(page, true);
  }
  if (page === "subjects") {
    state.subjectId = null;
    saveState();
  } else if (waitForSubjects && (!state.subjectId || !subjects.some((subject) => subject.id === state.subjectId))) {
    state.subjectId = subjects[0]?.id || null;
  }
  if (waitForSubjects && subjects.length) ensureSampleWrongNotes();
  if (page === "profile") initProfilePage();
  if (page === "subjects") {
    renderSubjects();
    scrollSubjectsToTop();
    requestAnimationFrame(scrollSubjectsToTop);
  }
  if (page === "mock") renderMock();
  if (page === "result") {
    loadBackendResultPage();
    initResultChat();
  }
  if (page === "analysis") renderAnalysisPage();
  if (page === "my-info") renderMyInfoPage();
  if (page === "exam-history") renderExamHistoryPage();
  if (page === "ai-recommend") renderAiRecommendPage();
  if (page === "wrong") {
    state.wrongSubjectId = "AI";
    state.wrongOpenDateKey = null;
    state.wrongRoundPage = 1;
    saveState();
    loadBackendWrongNotes();
  }
  if (page === "wrong-practice") renderWrongPractice();

  initPrintDownloadButtons();
  renderProfileButton();
  renderTopStats();
  // Ensure top nav reflects the current page when loading static pages
  (function setActiveTopNav() {
    const pageName = document.body.dataset.page || "";
    const pageFileMap = {
      main: "index.html",
      subjects: "index.html",
      "my-info": "profile.html",
      "exam-history": "history.html",
      analysis: "index.html",
      wrong: "wrong.html",
      "wrong-practice": "wrong.html",
      result: "index.html",
      ranking: "ranking.html",
      "ai-recommend": "ai-recommend.html",
      harness: "index.html",
      mock: "index.html",
    };
    const targetFile = pageFileMap[pageName];
    if (!targetFile) return;
    document.querySelectorAll(".main-nav .nav-btn").forEach((btn) => {
      btn.classList.toggle("active", (btn.getAttribute("href") || "").includes(targetFile));
    });
  })();
}

function scrollSubjectsToTop() {
  subjectHoverScrollLockedUntil = Date.now() + 1200;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  window.addEventListener("load", () => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, { once: true });
  window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 80);
}

initPage();
