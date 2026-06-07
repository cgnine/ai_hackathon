function formatMonthlyScore(score) {
  const numeric = Number(score) || 0;
  return Number.isInteger(numeric) ? `${numeric}점` : `${numeric.toFixed(1)}점`;
}

const MAIN_AUTH_SESSION_KEY = "kbCbtAuthSession";
const MAIN_AUTH_TTL_MS = 12 * 60 * 60 * 1000;

function setCurrentMonthTitle(monthLabel) {
  const title = document.getElementById("monthlyRankingTitle");
  if (!title) return;
  const currentMonth = monthLabel || `${new Date().getMonth() + 1}월`;
  title.textContent = `${currentMonth} 랭킹`;
}

function renderMonthlyRanking(items) {
  const list = document.getElementById("monthlyRankingList");
  if (!list) return;

  const rows = Array.from({ length: 5 }, (_, index) => items[index] || { rank: index + 1 });
  const elements = Array.from(list.querySelectorAll("li"));

  rows.forEach((item, index) => {
    const row = elements[index];
    if (!row) return;
    const hasScore = item.memberName || item.memberId;
    const rank = row.querySelector(".ranking-rank");
    const name = row.querySelector(".ranking-name");
    const score = row.querySelector("strong");

    row.classList.toggle("ranking-placeholder", !hasScore);
    if (rank) rank.textContent = item.rank || index + 1;
    if (name) name.textContent = hasScore ? (item.memberName || item.memberId) : "\u00a0";
    if (score) score.textContent = hasScore ? formatMonthlyScore(item.averageScore) : "\u00a0";
  });
}

async function loadMonthlyRanking() {
  setCurrentMonthTitle();

  try {
    const response = await fetch(`${API_BASE}/results/ranking/monthly?limit=5`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    setCurrentMonthTitle(data.monthLabel);
    renderMonthlyRanking(data.items || []);
  } catch {
    const list = document.getElementById("monthlyRankingList");
    if (list) {
      renderMonthlyRanking([]);
    }
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
loadMonthlyRanking();
