const AUTH_SESSION_KEY = "kbCbtAuthSession";
const AUTH_TTL_MS = 12 * 60 * 60 * 1000;

function readAuthSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "null");
    if (!saved?.memberId || !saved?.expiresAt) return null;
    if (Date.now() > Number(saved.expiresAt)) {
      clearAuthSession();
      return null;
    }
    return saved;
  } catch {
    clearAuthSession();
    return null;
  }
}

function saveAuthSession(memberId, memberName) {
  const session = {
    memberId,
    memberName,
    expiresAt: Date.now() + AUTH_TTL_MS
  };
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  state.profileName = memberName || memberId;
  saveState();
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
}

function currentMemberId() {
  return readAuthSession()?.memberId || "";
}

function currentMemberName() {
  const session = readAuthSession();
  return session?.memberName || session?.memberId || "";
}

function syncAuthState() {
  const session = readAuthSession();
  if (!session?.memberId) return false;
  state.profileName = session.memberName || session.memberId;
  saveState();
  return true;
}

function loginUrl() {
  return "login.html";
}

function requireLogin(page) {
  if (page === "login") return true;
  if (syncAuthState()) return true;
  window.location.href = loginUrl();
  return false;
}

function setLoginMessage(message, isError = false) {
  if (!els.loginMessage) return;
  els.loginMessage.textContent = message;
  els.loginMessage.classList.toggle("error", isError);
}

async function submitLogin(event) {
  event.preventDefault();
  const memberId = (els.memberIdInput?.value || "").trim();
  const password = els.passwordInput?.value || "";

  if (!memberId) {
    setLoginMessage("사번을 입력하세요.", true);
    els.memberIdInput?.focus();
    return;
  }

  if (els.loginSubmitBtn) els.loginSubmitBtn.disabled = true;
  setLoginMessage("로그인 확인 중입니다.");

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
    saveAuthSession(data.member_id, data.member_name);
    window.location.href = PAGE_URLS.subjects;
  } catch (error) {
    setLoginMessage(error.message, true);
  } finally {
    if (els.loginSubmitBtn) els.loginSubmitBtn.disabled = false;
  }
}

function initLoginPage() {
  if (!els.loginForm) return;
  const memberId = currentMemberId();
  if (memberId) {
    window.location.href = PAGE_URLS.subjects;
    return;
  }
  els.loginForm.addEventListener("submit", submitLogin);
  els.memberIdInput?.focus();
}

function logout() {
  clearAuthSession();
  state.profileName = "";
  saveState();
  window.location.href = loginUrl();
}
