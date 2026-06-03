const AUTH_SESSION_KEY = "kbCbtAuthSession";
const AUTH_TTL_MS = 12 * 60 * 60 * 1000;
const SIGNUP_PREFILL_KEY = "kbCbtSignupPrefill";
const RESET_PASSWORD_PREFILL_KEY = "kbCbtResetPasswordPrefill";

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

function saveSignupPrefill(payload) {
  sessionStorage.setItem(SIGNUP_PREFILL_KEY, JSON.stringify(payload || {}));
}

function readSignupPrefill() {
  try {
    return JSON.parse(sessionStorage.getItem(SIGNUP_PREFILL_KEY) || "null");
  } catch {
    return null;
  }
}

function clearSignupPrefill() {
  sessionStorage.removeItem(SIGNUP_PREFILL_KEY);
}

function saveResetPasswordPrefill(payload) {
  sessionStorage.setItem(RESET_PASSWORD_PREFILL_KEY, JSON.stringify(payload || {}));
}

function readResetPasswordPrefill() {
  try {
    return JSON.parse(sessionStorage.getItem(RESET_PASSWORD_PREFILL_KEY) || "null");
  } catch {
    return null;
  }
}

function clearResetPasswordPrefill() {
  sessionStorage.removeItem(RESET_PASSWORD_PREFILL_KEY);
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
  return PAGE_URLS.login || "index.html";
}

function signupUrl() {
  return PAGE_URLS.signup || "signup.html";
}

function resetPasswordUrl() {
  return PAGE_URLS.resetPassword || "reset-password.html";
}

function requireLogin(page) {
  if (page === "login" || page === "signup" || page === "reset-password") return true;
  if (syncAuthState()) return true;
  window.location.href = loginUrl();
  return false;
}

function setLoginMessage(message, isError = false) {
  if (!els.loginMessage) return;
  els.loginMessage.textContent = message;
  els.loginMessage.classList.toggle("error", isError);
}

function setSignupMessage(message, isError = false) {
  if (!els.signupMessage) return;
  els.signupMessage.textContent = message;
  els.signupMessage.classList.toggle("error", isError);
}

function setResetPasswordMessage(message, isError = false) {
  if (!els.resetPasswordMessage) return;
  els.resetPasswordMessage.textContent = message;
  els.resetPasswordMessage.classList.toggle("error", isError);
}

function normalizeRequestError(error, fallbackMessage) {
  if (error instanceof TypeError) {
    return "서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.";
  }
  return error?.message || fallbackMessage;
}

function moveToResetPasswordPage() {
  const memberId = (els.memberIdInput?.value || "").trim();
  saveResetPasswordPrefill({ memberId });
  window.location.href = resetPasswordUrl();
}

async function submitLogin(event) {
  event.preventDefault();
  const memberId = (els.memberIdInput?.value || "").trim();
  const password = els.passwordInput?.value || "";

  if (!memberId) {
    setLoginMessage("사번을 입력해주세요.", true);
    els.memberIdInput?.focus();
    return;
  }

  if (!password.trim()) {
    setLoginMessage("비밀번호를 입력해주세요.", true);
    els.passwordInput?.focus();
    return;
  }

  if (els.loginSubmitBtn) els.loginSubmitBtn.disabled = true;
  setLoginMessage("로그인 정보를 확인하고 있습니다.");

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, password })
    });

    if (response.status === 404) {
      const data = await response.json().catch(() => ({}));
      saveSignupPrefill({
        memberId,
        message: data.detail || "등록된 사번이 없습니다."
      });
      window.location.href = signupUrl();
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "로그인에 실패했습니다.");
    }

    const data = await response.json();
    clearSignupPrefill();
    clearResetPasswordPrefill();
    saveAuthSession(data.member_id, data.member_name);
    window.location.href = PAGE_URLS.subjects;
  } catch (error) {
    setLoginMessage(normalizeRequestError(error, "로그인에 실패했습니다."), true);
  } finally {
    if (els.loginSubmitBtn) els.loginSubmitBtn.disabled = false;
  }
}

async function submitSignup(event) {
  event.preventDefault();
  const memberId = (els.signupMemberIdInput?.value || "").trim();
  const memberName = (els.signupMemberNameInput?.value || "").trim();
  const password = els.signupPasswordInput?.value || "";

  if (!memberId) {
    setSignupMessage("사번을 입력해주세요.", true);
    els.signupMemberIdInput?.focus();
    return;
  }

  if (!memberName) {
    setSignupMessage("사용자명을 입력해주세요.", true);
    els.signupMemberNameInput?.focus();
    return;
  }

  if (!password.trim()) {
    setSignupMessage("비밀번호를 입력해주세요.", true);
    els.signupPasswordInput?.focus();
    return;
  }

  if (els.signupSubmitBtn) els.signupSubmitBtn.disabled = true;
  setSignupMessage("회원가입 정보를 저장하고 있습니다.");

  try {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: memberId,
        member_name: memberName,
        password
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "회원가입에 실패했습니다.");
    }

    const data = await response.json();
    clearAuthSession();
    saveSignupPrefill({
      memberId: data.member_id,
      message: "회원가입이 완료되었습니다. 로그인해주세요."
    });
    window.location.href = loginUrl();
  } catch (error) {
    setSignupMessage(normalizeRequestError(error, "회원가입에 실패했습니다."), true);
  } finally {
    if (els.signupSubmitBtn) els.signupSubmitBtn.disabled = false;
  }
}

async function submitResetPassword(event) {
  event.preventDefault();
  const memberId = (els.resetMemberIdInput?.value || "").trim();
  const password = els.resetPasswordInput?.value || "";
  const passwordConfirm = els.resetPasswordConfirmInput?.value || "";

  if (!memberId) {
    setResetPasswordMessage("사번을 먼저 입력해주세요.", true);
    els.resetMemberIdInput?.focus();
    return;
  }

  if (!password.trim()) {
    setResetPasswordMessage("새 비밀번호를 입력해주세요.", true);
    els.resetPasswordInput?.focus();
    return;
  }

  if (!passwordConfirm.trim()) {
    setResetPasswordMessage("비밀번호를 다시 입력해주세요.", true);
    els.resetPasswordConfirmInput?.focus();
    return;
  }

  if (password !== passwordConfirm) {
    setResetPasswordMessage("비밀번호와 비밀번호 재입력이 일치하지 않습니다.", true);
    els.resetPasswordConfirmInput?.focus();
    return;
  }

  if (els.resetPasswordSubmitBtn) els.resetPasswordSubmitBtn.disabled = true;
  setResetPasswordMessage("비밀번호를 재설정하고 있습니다.");

  try {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: memberId,
        password
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "비밀번호 재설정에 실패했습니다.");
    }

    clearAuthSession();
    clearResetPasswordPrefill();
    saveSignupPrefill({
      memberId,
      message: "비밀번호가 재설정되었습니다. 로그인해주세요."
    });
    window.location.href = loginUrl();
  } catch (error) {
    setResetPasswordMessage(normalizeRequestError(error, "비밀번호 재설정에 실패했습니다."), true);
  } finally {
    if (els.resetPasswordSubmitBtn) els.resetPasswordSubmitBtn.disabled = false;
  }
}

function initLoginPage() {
  if (!els.loginForm) return;
  const memberId = currentMemberId();
  if (memberId) {
    window.location.href = PAGE_URLS.subjects;
    return;
  }

  const prefill = readSignupPrefill();
  if (prefill?.memberId && els.memberIdInput) {
    els.memberIdInput.value = prefill.memberId;
  }
  if (prefill?.message) {
    setLoginMessage(prefill.message, false);
  }

  els.loginForm.addEventListener("submit", submitLogin);
  bindOptional(document.getElementById("resetPasswordLink"), "click", (event) => {
    event.preventDefault();
    moveToResetPasswordPage();
  });

  if (prefill?.memberId) {
    els.passwordInput?.focus();
  } else {
    els.memberIdInput?.focus();
  }
}

function initSignupPage() {
  if (!els.signupForm) return;
  const memberId = currentMemberId();
  if (memberId) {
    window.location.href = PAGE_URLS.subjects;
    return;
  }

  const prefill = readSignupPrefill();
  if (prefill?.memberId && els.signupMemberIdInput) {
    els.signupMemberIdInput.value = prefill.memberId;
  }
  if (prefill?.message) {
    setSignupMessage(prefill.message, true);
  }

  els.signupForm.addEventListener("submit", submitSignup);
  if (prefill?.memberId) {
    els.signupMemberNameInput?.focus();
  } else {
    els.signupMemberIdInput?.focus();
  }
}

function initResetPasswordPage() {
  if (!els.resetPasswordForm) return;
  clearAuthSession();

  const prefill = readResetPasswordPrefill();
  if (prefill?.memberId && els.resetMemberIdInput) {
    els.resetMemberIdInput.value = prefill.memberId;
  }

  els.resetPasswordForm.addEventListener("submit", submitResetPassword);
  if (prefill?.memberId) {
    els.resetPasswordInput?.focus();
  } else {
    els.resetMemberIdInput?.focus();
  }
}

function logout() {
  clearAuthSession();
  clearExamSessionState();
  state.profileName = "";
  saveState();
  window.location.href = loginUrl();
}
