function formatMonthlyScore(score) {
  const numeric = Number(score) || 0;
  return Number.isInteger(numeric) ? `${numeric}점` : `${numeric.toFixed(1)}점`;
}

const MAIN_AUTH_SESSION_KEY = "kbCbtAuthSession";
const MAIN_AUTH_TTL_MS = 12 * 60 * 60 * 1000;
let rankingLoadingTimer = null;
let rankingLoadingProgress = 0;
let monthlyRankingItems = [];
let monthlyRankingPage = 1;
let mainRankingAutoRollTimer = null;
let mainRankingAutoRollPaused = false;
let mainRankingResumeTimer = null;
let mainRankingAutoRollInitialized = false;
let latestRankingGoal = null;
let rankingGoalCommentaryRequest = null;
const RANKING_PAGE_SIZE = 17;
const RANKING_MAX_ITEMS = 50;
const MAIN_RANKING_PAGE_SIZE = 5;
const MAIN_RANKING_MAX_ITEMS = 10;
const MAIN_RANKING_AUTO_ROLL_MS = 4500;
const MAIN_RANKING_TIMEOUT_MS = 1800;

function setCurrentMonthTitle(monthLabel) {
  const title = document.getElementById("monthlyRankingTitle");
  if (!title) return;
  const currentMonth = monthLabel || `${new Date().getMonth() + 1}월`;
  title.textContent = `${currentMonth} 랭킹`;
}

function getMemberCompanyName(memberId) {
  const prefix = String(memberId || "").trim().toUpperCase().slice(0, 1);
  const companies = {
    A: "KB\uC99D\uAD8C",
    B: "KB\uAD6D\uBBFC\uC740\uD589",
    C: "KB\uC190\uD574\uBCF4\uD5D8",
    D: "KB\uB370\uC774\uD0C0\uC2DC\uC2A4\uD15C",
    E: "KB\uB77C\uC774\uD504\uC0DD\uBA85"
  };
  return companies[prefix] || "";
}

function renderRankingAffiliation(target, memberId, hasScore) {
  if (!target) return;
  const showAffiliation = hasScore ? getMemberCompanyName(memberId) : "";
  target.textContent = showAffiliation || "\u00a0";
  target.classList.toggle("is-empty", !showAffiliation);
}

function renderMonthlyRanking(items) {
  const list = document.getElementById("monthlyRankingList");
  if (!list) return;

  const pageType = document.body?.dataset.page;
  const isRankingPage = pageType === "ranking";
  const isMainPage = pageType === "main";
  const maxItems = isRankingPage ? RANKING_MAX_ITEMS : MAIN_RANKING_MAX_ITEMS;
  const pageSize = isRankingPage ? RANKING_PAGE_SIZE : MAIN_RANKING_PAGE_SIZE;
  const isPagedRanking = isRankingPage || isMainPage;
  monthlyRankingItems = Array.isArray(items) ? items.slice(0, maxItems) : [];
  const pageCount = isPagedRanking ? Math.max(1, Math.ceil(maxItems / pageSize)) : 1;
  const safePage = Math.max(1, Math.min(monthlyRankingPage, pageCount));
  monthlyRankingPage = safePage;
  const startIndex = isPagedRanking ? (safePage - 1) * pageSize : 0;
  const endIndex = isPagedRanking ? Math.min(startIndex + pageSize, maxItems) : pageSize;
  const rows = Array.from({ length: endIndex - startIndex }, (_, index) => {
    const itemIndex = startIndex + index;
    return monthlyRankingItems[itemIndex] || { rank: itemIndex + 1 };
  });
  if (isMainPage) {
    list.classList.remove("is-rolling");
    void list.offsetWidth;
    list.classList.add("is-rolling");
  }
  list.replaceChildren();

  rows.forEach((item, index) => {
    const row = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const affiliation = document.createElement("span");
    const score = document.createElement("strong");
    const hasScore = item.memberName || item.memberId;

    rank.className = "ranking-rank";
    name.className = "ranking-name";
    affiliation.className = "ranking-affiliation";
    row.classList.toggle("ranking-placeholder", !hasScore);
    rank.textContent = item.rank || startIndex + index + 1;
    name.textContent = hasScore ? (item.memberName || item.memberId) : "\u00a0";
    renderRankingAffiliation(affiliation, item.memberId, hasScore);
    score.textContent = hasScore ? formatMonthlyScore(item.averageScore) : "\u00a0";

    row.append(rank, name, affiliation, score);
    list.appendChild(row);
  });

  renderTopRankingPodium(items);
  renderRankingPagination();
}

function renderRankingPagination() {
  const pagination = document.getElementById("rankingPagination");
  if (!pagination) return;

  pagination.replaceChildren();
  const pageCount = Math.ceil(RANKING_MAX_ITEMS / RANKING_PAGE_SIZE);
  for (let page = 1; page <= pageCount; page += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = page;
    button.classList.toggle("active", page === monthlyRankingPage);
    button.setAttribute("aria-label", `${page}페이지`);
    button.setAttribute("aria-current", page === monthlyRankingPage ? "page" : "false");
    button.addEventListener("click", () => {
      monthlyRankingPage = page;
      renderMonthlyRanking(monthlyRankingItems);
    });
    pagination.appendChild(button);
  }
}

function pageCountForMainRanking() {
  return Math.max(1, Math.ceil(Math.min(monthlyRankingItems.length, MAIN_RANKING_MAX_ITEMS) / MAIN_RANKING_PAGE_SIZE));
}

function pauseMainRankingAutoRoll(duration = 0) {
  mainRankingAutoRollPaused = true;
  if (!duration) return;
  window.clearTimeout(mainRankingResumeTimer);
  mainRankingResumeTimer = window.setTimeout(() => {
    mainRankingAutoRollPaused = false;
  }, duration);
}

function initMainRankingAutoRoll() {
  if (document.body?.dataset.page !== "main" || mainRankingAutoRollInitialized) return;
  const card = document.querySelector(".main-ranking");
  if (!card) return;
  mainRankingAutoRollInitialized = true;

  card.addEventListener("mouseenter", () => pauseMainRankingAutoRoll());
  card.addEventListener("mouseleave", () => {
    mainRankingAutoRollPaused = false;
  });

  window.clearInterval(mainRankingAutoRollTimer);
  mainRankingAutoRollTimer = window.setInterval(() => {
    if (mainRankingAutoRollPaused || monthlyRankingItems.length <= MAIN_RANKING_PAGE_SIZE) return;
    const pageCount = pageCountForMainRanking();
    monthlyRankingPage = monthlyRankingPage >= pageCount ? 1 : monthlyRankingPage + 1;
    renderMonthlyRanking(monthlyRankingItems);
  }, MAIN_RANKING_AUTO_ROLL_MS);
}

function renderRankingMoreList() {
  const list = document.getElementById("rankingMoreList");
  if (!list) return;

  const rows = Array.from({ length: 10 }, (_, index) => monthlyRankingItems[index] || { rank: index + 1 });
  list.replaceChildren();

  rows.forEach((item, index) => {
    const row = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const affiliation = document.createElement("span");
    const score = document.createElement("strong");
    const hasScore = item.memberName || item.memberId;

    rank.className = "ranking-rank";
    name.className = "ranking-name";
    affiliation.className = "ranking-affiliation";
    row.classList.toggle("ranking-placeholder", !hasScore);
    rank.textContent = item.rank || index + 1;
    name.textContent = hasScore ? (item.memberName || item.memberId) : "\u00a0";
    renderRankingAffiliation(affiliation, item.memberId, hasScore);
    score.textContent = hasScore ? formatMonthlyScore(item.averageScore) : "\u00a0";

    row.append(rank, name, affiliation, score);
    list.appendChild(row);
  });
}

function openRankingMoreModal() {
  const modal = document.getElementById("rankingMoreModal");
  if (!modal) return;
  renderRankingMoreList();
  modal.hidden = false;
}

function closeRankingMoreModal() {
  const modal = document.getElementById("rankingMoreModal");
  if (modal) modal.hidden = true;
}

function initRankingMoreModal() {
  const button = document.querySelector(".ranking-table-card .ranking-more-btn");
  if (button) button.addEventListener("click", openRankingMoreModal);

  document.querySelectorAll("[data-ranking-modal-close]").forEach((target) => {
    target.addEventListener("click", closeRankingMoreModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeRankingMoreModal();
  });
}

function renderTopRankingPodium(items) {
  const podium = document.getElementById("topRankingPodium");
  if (!podium) return;

  const order = [1, 0, 2];
  const cards = Array.from(podium.querySelectorAll(".podium-user"));
  cards.forEach((card, cardIndex) => {
    const item = items[order[cardIndex]];
    const hasScore = item?.memberName || item?.memberId;
    const avatar = card.querySelector(".podium-avatar");
    const name = card.querySelector("strong");
    const score = card.querySelector("b");

    if (avatar) avatar.textContent = hasScore ? String(item.memberName || item.memberId).trim().slice(0, 1) : "?";
    if (name) name.textContent = hasScore ? (item.memberName || item.memberId) : "-";
    if (score) score.textContent = hasScore ? formatMonthlyScore(item.averageScore) : "-";
  });
}

function readMainCurrentMemberId() {
  if (typeof currentMemberId === "function") {
    return currentMemberId();
  }

  try {
    const saved = JSON.parse(localStorage.getItem(MAIN_AUTH_SESSION_KEY) || "null");
    return saved?.memberId || "";
  } catch {
    return "";
  }
}

function formatRankingNumber(value) {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function setRankingText(id, value) {
  const target = document.getElementById(id);
  if (target) target.textContent = value;
}

function formatMainCount(value) {
  const numeric = Number(value) || 0;
  return numeric.toLocaleString("ko-KR");
}

function setMainStatText(id, value) {
  const target = document.getElementById(id);
  if (target) target.textContent = formatMainCount(value);
}

async function loadMainStats() {
  if (!document.getElementById("mainQuestionCount")) {
    document.body?.classList.remove("main-stats-loading");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/results/main/stats`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    setMainStatText("mainQuestionCount", data.questionCount);
    setMainStatText("mainExamCount", data.examCount);
    setMainStatText("mainReportCount", data.reportCount);
  } catch {
    // Keep the static fallback values on the landing page.
  } finally {
    document.body?.classList.remove("main-stats-loading");
  }
}

function maskKoreanName(name) {
  const text = String(name || "").trim();
  if (text.length < 3) return text || "-";
  return `${text[0]}○${text.slice(2)}`;
}

function renderRankingSubjectTargets(subjectTargets) {
  const items = Array.isArray(subjectTargets) ? subjectTargets.slice(0, 2) : [];
  if (!items.length) return;

  const targetList = document.getElementById("rankingSubjectTargets");
  if (targetList) {
    const title = targetList.querySelector(":scope > span");
    targetList.replaceChildren();
    if (title) targetList.appendChild(title);

    items.forEach((item) => {
      const row = document.createElement("p");
      const name = document.createElement("strong");
      const bar = document.createElement("i");
      const fill = document.createElement("b");
      const up = document.createElement("em");
      const targetScore = Math.max(0, Math.min(100, Number(item.targetSubjectScore) || 0));

      name.textContent = item.subjectCode || item.subjectName || "-";
      fill.style.width = `${targetScore}%`;
      up.textContent = `+${formatRankingNumber(item.expectedUpScore)}점 필요`;

      bar.appendChild(fill);
      row.append(name, bar, up);
      targetList.appendChild(row);
    });
  }

}

function renderRankingGoalActions(actions, subjectTargets) {
  const recommendationList = document.getElementById("rankingSubjectRecommendations");
  if (!recommendationList) return;

  const fallback = (Array.isArray(subjectTargets) ? subjectTargets.slice(0, 2) : []).map((item) => ({
    title: item.recommendTitle || `${item.subjectName || item.subjectCode || "과목"} 집중 학습`,
    expected: `+${formatRankingNumber(item.expectedUpScore)}점 예상`
  }));
  const items = Array.isArray(actions) && actions.length === 2 ? actions : fallback;
  if (!items.length) return;

  recommendationList.replaceChildren();
  items.slice(0, 2).forEach((item) => {
    const row = document.createElement("li");
    const title = document.createElement("span");
    const score = document.createElement("strong");

    title.textContent = item.title || "핵심 과목 집중 학습";
    score.textContent = item.expected || "+1점 예상";
    row.append(title, score);
    recommendationList.appendChild(row);
  });
}

function renderRankingRival(rival) {
  if (!rival) return;

  const rivalName = rival.rivalName || rival.rivalId || "-";
  const displayRivalName = maskKoreanName(rivalName);
  const rivalRank = Number(rival.rivalRank) || 0;
  const rivalScore = formatRankingNumber(rival.rivalScore);
  const scoreGap = formatRankingNumber(rival.scoreGap);
  const avatar = document.getElementById("rankingRivalAvatar");
  const affiliation = document.getElementById("rankingRivalAffiliation");

  if (avatar) avatar.alt = `${displayRivalName} 프로필 이미지`;
  if (affiliation) {
    const showAffiliation = getMemberCompanyName(rival.rivalId);
    affiliation.textContent = showAffiliation;
    affiliation.hidden = !showAffiliation;
  }
  setRankingText("rankingRivalName", displayRivalName);
  setRankingText("rankingRivalRank", rivalRank);
  setRankingText("rankingRivalScore", rivalScore);
  setRankingText("rankingRivalScoreGap", scoreGap);
  setRankingText(
    "rankingRivalNote",
    rival.rivalCoachMessage || `${displayRivalName}님과 평균 점수 차이가 ${scoreGap}점으로 가장 가깝습니다.`
  );

  const comparisons = Array.isArray(rival.subjectComparisons) ? rival.subjectComparisons : [];
  const head = document.getElementById("rankingRivalTableHead");
  const body = document.getElementById("rankingRivalTableBody");
  if (!head || !body || !comparisons.length) return;

  const headerRow = document.createElement("tr");
  headerRow.appendChild(document.createElement("th"));
  comparisons.forEach((item) => {
    const th = document.createElement("th");
    th.textContent = item.subjectCode || item.subjectName || "-";
    headerRow.appendChild(th);
  });

  const myRow = document.createElement("tr");
  const myLabel = document.createElement("th");
  myLabel.textContent = "나";
  myRow.appendChild(myLabel);

  const rivalRow = document.createElement("tr");
  const rivalLabel = document.createElement("th");
  rivalLabel.textContent = displayRivalName;
  rivalRow.appendChild(rivalLabel);

  comparisons.forEach((item) => {
    const myCell = document.createElement("td");
    const rivalCell = document.createElement("td");
    myCell.textContent = formatRankingNumber(item.myScore);
    rivalCell.textContent = formatRankingNumber(item.rivalScore);
    myRow.appendChild(myCell);
    rivalRow.appendChild(rivalCell);
  });

  head.replaceChildren(headerRow);
  body.replaceChildren(myRow, rivalRow);
}

function renderRankingStrengthKeywords(keywords) {
  if (!keywords) return;

  const target = document.getElementById("rankingStrengthTags");
  if (!target) return;

  const strongKeyword = keywords.strongKeyword || "강점 분석중";
  const weakKeyword = keywords.weakKeyword || "취약 분석중";
  const strong = document.createElement("span");
  const strongLabel = document.createElement("b");
  const strongValue = document.createElement("em");
  const weak = document.createElement("span");
  const weakLabel = document.createElement("b");
  const weakValue = document.createElement("em");

  strongValue.className = "ranking-keyword";
  weakValue.className = "ranking-keyword";
  strongLabel.textContent = "강점";
  strongValue.textContent = strongKeyword;
  strong.append(strongLabel, strongValue);
  weak.className = "weak";
  weakLabel.textContent = "취약";
  weakValue.textContent = weakKeyword;
  weak.append(weakLabel, weakValue);
  target.replaceChildren(strong, weak);
}

function renderRankingLearningPattern(pattern) {
  if (!pattern) return;

  const list = document.getElementById("rankingLearningList");
  if (!list) return;

  const recommendations = Array.isArray(pattern.recommendations) ? pattern.recommendations.slice(0, 4) : [];
  if (recommendations.length === 4) {
    list.replaceChildren();
    recommendations.forEach((recommendation) => {
      const row = document.createElement("li");
      const icon = document.createElement("span");
      const copy = document.createElement("div");
      const title = document.createElement("strong");

      icon.className = "learning-icon";
      icon.textContent = "•";
      title.textContent = recommendation;
      copy.appendChild(title);
      row.append(icon, copy);
      list.appendChild(row);
    });
    return;
  }

  const items = [
    `상위권 평균 ${formatRankingNumber(pattern.avgExamCount)}회 응시`,
    `평균 ${formatRankingNumber(pattern.avgSubjectCount)}개 과목 학습`,
    `실무형 문제 비중 ${formatRankingNumber(pattern.avgPracticalRate)}%`,
    `${pattern.weakSubject || "취약 과목"} 집중 보완`
  ];

  list.replaceChildren();
  items.forEach((item) => {
    const row = document.createElement("li");
    const icon = document.createElement("span");
    const copy = document.createElement("div");
    const title = document.createElement("strong");

    icon.className = "learning-icon";
    icon.textContent = "•";
    title.textContent = item;
    copy.appendChild(title);
    row.append(icon, copy);
    list.appendChild(row);
  });
}

function renderRankingGoal(goal) {
  latestRankingGoal = goal;
  const myRank = Number(goal.myRank) || 0;
  const myScore = formatRankingNumber(goal.myScore);
  const targetRank = Number(goal.targetRank) || 0;
  const targetScore = formatRankingNumber(goal.targetScore);
  const gapScore = formatRankingNumber(goal.gapScore);
  const successRate = Number(goal.successRate) || 0;

  setRankingText("rankingMyRank", myRank);
  setRankingText("rankingChangeMyRank", myRank);
  setRankingText("rankingChangeTargetRank", targetRank);
  setRankingText("rankingSuccessRate", successRate);
  setRankingText("rankingGoalMyRank", myRank);
  setRankingText("rankingGoalMyScore", myScore);
  setRankingText("rankingGoalTargetRankLabel", targetRank);
  setRankingText("rankingGoalTargetScore", targetScore);
  setRankingText("rankingGoalGapScore", gapScore);
  setRankingText("rankingGoalTargetRank", targetRank);
  setRankingText("rankingGoalGapScoreRing", gapScore);
  if (goal.goalCoachMessage) setRankingText("rankingGoalCoach", goal.goalCoachMessage);
  renderRankingSubjectTargets(goal.subjectTargets);
  renderRankingGoalActions(goal.goalActions, goal.subjectTargets);
  renderRankingRival(goal.rival);
  renderRankingStrengthKeywords(goal.strengthKeywords);
  renderRankingLearningPattern(goal.learningPattern);
}

function createRankingInlineLoading(message) {
  const loading = document.createElement("div");
  const spinner = document.createElement("span");
  const text = document.createElement("span");
  loading.className = "ai-inline-loading ranking-ai-loading";
  loading.setAttribute("role", "status");
  loading.setAttribute("aria-live", "polite");
  spinner.className = "ai-inline-spinner";
  spinner.setAttribute("aria-hidden", "true");
  text.className = "ai-inline-loading-text";
  text.textContent = message;
  loading.append(spinner, text);
  return loading;
}

function setRankingAiLoading(isLoading) {
  document.querySelectorAll(".ranking-ai-loading").forEach((item) => item.remove());
  if (!isLoading) return;
  const coach = document.getElementById("rankingGoalCoach");
  const learning = document.querySelector(".ranking-learning-card");
  if (coach) coach.appendChild(createRankingInlineLoading("AI가 최신 랭킹 코멘트를 업데이트하고 있습니다."));
  if (learning) learning.appendChild(createRankingInlineLoading("상위권 학습 패턴을 다시 정리하고 있습니다."));
}

function applyRankingGoalCommentary(commentary) {
  if (!commentary || !latestRankingGoal) return;
  if (commentary.goalCoachMessage) {
    setRankingText("rankingGoalCoach", commentary.goalCoachMessage);
  }
  if (Array.isArray(commentary.goalActions)) {
    renderRankingGoalActions(commentary.goalActions, latestRankingGoal.subjectTargets);
  }
  if (latestRankingGoal.rival && commentary.rivalCoachMessage) {
    latestRankingGoal.rival.rivalCoachMessage = commentary.rivalCoachMessage;
    renderRankingRival(latestRankingGoal.rival);
  }
  if (latestRankingGoal.learningPattern && Array.isArray(commentary.learningRecommendations)) {
    latestRankingGoal.learningPattern.recommendations = commentary.learningRecommendations;
    renderRankingLearningPattern(latestRankingGoal.learningPattern);
  }
}

function refreshRankingGoalCommentary() {
  const memberId = readMainCurrentMemberId();
  if (!memberId || rankingGoalCommentaryRequest) return rankingGoalCommentaryRequest;
  setRankingAiLoading(true);
  rankingGoalCommentaryRequest = fetch(`${API_BASE}/results/ranking/goal/commentary?member_id=${encodeURIComponent(memberId)}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      applyRankingGoalCommentary(data);
    })
    .catch(() => {
      // Keep the fast fallback ranking goal visible.
    })
    .finally(() => {
      rankingGoalCommentaryRequest = null;
      setRankingAiLoading(false);
    });
  return rankingGoalCommentaryRequest;
}

function startRankingLoading() {
  const loading = document.getElementById("rankingLoading");
  const content = document.getElementById("rankingContent");
  const bar = document.getElementById("rankingLoadingBar");

  rankingLoadingProgress = 0;
  if (loading) loading.hidden = false;
  if (content) content.hidden = true;
  if (bar) bar.style.width = "0%";

  clearInterval(rankingLoadingTimer);
  rankingLoadingTimer = setInterval(() => {
    const ceiling = rankingLoadingProgress < 45 ? 45 : rankingLoadingProgress < 78 ? 78 : 92;
    const step = rankingLoadingProgress < 45 ? 8 : rankingLoadingProgress < 78 ? 4 : 1;
    rankingLoadingProgress = Math.min(ceiling, rankingLoadingProgress + step);
    if (bar) bar.style.width = `${rankingLoadingProgress}%`;
  }, 180);
}

function finishRankingLoading() {
  const loading = document.getElementById("rankingLoading");
  const content = document.getElementById("rankingContent");
  const bar = document.getElementById("rankingLoadingBar");

  clearInterval(rankingLoadingTimer);
  rankingLoadingTimer = null;
  if (bar) bar.style.width = "100%";

  setTimeout(() => {
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
  }, 180);
}

async function loadRankingGoal() {
  const memberId = readMainCurrentMemberId();
  if (!memberId) return;

  try {
    const response = await fetch(`${API_BASE}/results/ranking/goal?member_id=${encodeURIComponent(memberId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    renderRankingGoal(data);
    refreshRankingGoalCommentary();
  } catch {
    // Keep the static fallback values when the member has no ranking data yet.
  }
}

async function initRankingPage() {
  const pageType = document.body?.dataset.page;
  if (pageType !== "ranking") {
    loadMonthlyRanking();
    return;
  }

  startRankingLoading();
  await Promise.all([
    loadMonthlyRanking(),
    loadRankingGoal()
  ]);
  finishRankingLoading();
}

async function loadMonthlyRanking() {
  setCurrentMonthTitle();
  const isRankingPage = document.body?.dataset.page === "ranking";
  const limit = isRankingPage ? RANKING_MAX_ITEMS : MAIN_RANKING_MAX_ITEMS;
  const controller = new AbortController();
  const timeout = !isRankingPage
    ? window.setTimeout(() => controller.abort(), MAIN_RANKING_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch(`${API_BASE}/results/ranking/monthly?limit=${limit}`, {
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    setCurrentMonthTitle(data.monthLabel);
    renderMonthlyRanking(data.items || []);
  } catch {
    const list = document.getElementById("monthlyRankingList");
    if (list) {
      renderMonthlyRanking([]);
    }
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

function setMainMiniLoginMessage(message, isError = false) {
  const messageTarget = document.getElementById("mainMiniLoginMessage");
  if (!messageTarget) return;
  messageTarget.textContent = message;
  messageTarget.classList.toggle("error", isError);
}

function saveMainAuthSession(memberId, memberName) {
  const session = {
    memberId,
    memberName,
    expiresAt: Date.now() + MAIN_AUTH_TTL_MS
  };
  localStorage.setItem(MAIN_AUTH_SESSION_KEY, JSON.stringify(session));
  sessionStorage.setItem(MAIN_AUTH_SESSION_KEY, JSON.stringify(session));
}

async function submitMainMiniLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const memberIdInput = document.getElementById("mainMiniMemberId");
  const passwordInput = document.getElementById("mainMiniPassword");
  const submitButton = form.querySelector("button[type='submit']");
  const memberId = (memberIdInput?.value || "").trim();
  const password = passwordInput?.value || "";

  if (!memberId) {
    setMainMiniLoginMessage("사번을 입력해주세요.", true);
    memberIdInput?.focus();
    return;
  }
  if (!password.trim()) {
    setMainMiniLoginMessage("비밀번호를 입력해주세요.", true);
    passwordInput?.focus();
    return;
  }

  if (submitButton) submitButton.disabled = true;
  setMainMiniLoginMessage("로그인 중입니다.");

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, password })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "로그인에 실패했습니다.");
    }

    const data = await response.json();
    saveMainAuthSession(data.member_id, data.member_name);
    window.location.href = "subjects.html";
  } catch (error) {
    setMainMiniLoginMessage(error.message || "로그인에 실패했습니다.", true);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function initMainMiniLogin() {
  const form = document.getElementById("mainMiniLoginForm");
  if (form) form.addEventListener("submit", submitMainMiniLogin);
}

initMainMiniLogin();
initRankingMoreModal();
initMainRankingAutoRoll();
initRankingPage();
loadMainStats();
