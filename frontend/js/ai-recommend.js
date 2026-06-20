// AI 맞춤형 추천문제 - 개인 문제 풀 방식
// 최대 5개 문제 유지, 정답 시 제거 + 새 문제 자동 생성, 오답 시 재도전

const MAX_POOL = 5;

// ─── API 호출 ────────────────────────────────────────────────

function memberId() {
  return currentMemberId();
}

async function apiGetPool() {
  const mid = memberId();
  if (!mid) throw new Error("로그인 정보가 없습니다.");
  const res = await fetch(`${API_BASE}/ai-recommend/pool?member_id=${encodeURIComponent(mid)}`);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiFillOne() {
  const mid = memberId();
  const res = await fetch(`${API_BASE}/ai-recommend/fill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member_id: mid }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiAnswer(questionId, selectedOptionNo) {
  const mid = memberId();
  const res = await fetch(`${API_BASE}/ai-recommend/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question_id: questionId,
      member_id: mid,
      selected_option_no: selectedOptionNo,
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── 상태 메시지 ─────────────────────────────────────────────

function setPoolStatus(text) {
  const el = document.getElementById("aiPoolStatusMsg");
  if (!el) return;
  const message = String(text || "").trim();
  el.textContent = message;
  el.closest(".ai-pool-header")?.classList.toggle("is-pending", !message);
  const list = document.getElementById("aiPoolList");
  if (list) list.hidden = message === "생성 가능한 추천 문제가 없습니다.";
}

function recommendErrorMessage(detail) {
  if (detail === "NO_HISTORY") {
    return "모의고사 응시 이력이 있어야 AI 맞춤형 문제를 생성할 수 있습니다.";
  }
  if (detail === "NO_WEAKNESS") {
    return "추천할 응시 데이터가 부족합니다. 모의고사를 한 번 더 응시해 주세요.";
  }
  if (String(detail || "").includes("UnrecognizedClientException")) {
    return "AWS 인증 토큰이 유효하지 않습니다. EC2의 AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_SESSION_TOKEN을 확인해 주세요.";
  }
  if (String(detail || "").includes("AccessDeniedException")) {
    return "Bedrock 호출 권한이 없습니다. 해당 IAM 사용자/키에 bedrock:InvokeModel 권한을 확인해 주세요.";
  }
  if (String(detail || "").startsWith("BEDROCK_")) {
    return `Bedrock 호출 실패: ${detail}`;
  }
  if (detail === "AI_RECOMMEND_FILL_FAILED") {
    return "추천문제 생성 중 서버 오류가 발생했습니다. 백엔드 로그를 확인해 주세요.";
  }
  return `문제 생성 실패: ${detail}`;
}

// ─── 카드 생성 ───────────────────────────────────────────────

function buildCard(question) {
  const card = document.createElement("article");
  card.className = "ai-pool-card";
  card.dataset.id = question.id;

  if (question.isCorrect === false) {
    card.classList.add("wrong");
    renderWrongCard(card, question);
  } else {
    renderUnansweredCard(card, question);
  }
  return card;
}

function buildSkeletonCard(label) {
  const card = document.createElement("article");
  card.className = "ai-pool-card generating";
  card.innerHTML = `
    <div class="ai-pool-card-head">
      <span class="ai-pool-badge generating">생성 중</span>
      <span class="ai-pool-label">${label}</span>
    </div>
    <p class="ai-pool-skeleton"></p>
    <p class="ai-pool-skeleton short"></p>
  `;
  return card;
}

function renderUnansweredCard(card, question) {
  const area = parseWeakArea(question.weakArea);
  const diffLabel = question.difficulty === "hard" ? "심화" : "기본";

  card.innerHTML = `
    <div class="ai-pool-card-head">
      <span class="ai-pool-badge new">NEW</span>
      <span class="ai-pool-label">${area}</span>
      <span class="ai-pool-diff ${question.difficulty}">${diffLabel}</span>
    </div>
    ${question.scenario ? `<p class="ai-pool-scenario">${escapeHtml(question.scenario)}</p>` : ""}
    <p class="ai-pool-question-text">${escapeHtml(question.questionText)}</p>
    ${question.reason ? `<p class="ai-pool-reason">${escapeHtml(question.reason)}</p>` : ""}
    <div class="ai-pool-choices"></div>
    <div class="ai-pool-feedback" hidden></div>
  `;

  const choicesEl = card.querySelector(".ai-pool-choices");
  renderPoolChoices(card, question, choicesEl);
}

function renderPoolChoices(card, question, choicesEl) {
  choicesEl.innerHTML = "";
  if (!Array.isArray(question.options) || question.options.length === 0) return;
  question.options.forEach((opt, idx) => {
    const no = idx + 1;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ai-pool-choice-btn";
    btn.innerHTML = `<span class="choice-num">${no}</span><span>${escapeHtml(opt)}</span>`;
    btn.addEventListener("click", () => handleAnswer(card, question, no));
    choicesEl.appendChild(btn);
  });
}

function renderWrongCard(card, question) {
  const area = parseWeakArea(question.weakArea);

  card.innerHTML = `
    <div class="ai-pool-card-head">
      <span class="ai-pool-badge wrong">오답</span>
      <span class="ai-pool-label">${area}</span>
    </div>
    ${question.scenario ? `<p class="ai-pool-scenario">${escapeHtml(question.scenario)}</p>` : ""}
    <p class="ai-pool-question-text">${escapeHtml(question.questionText)}</p>
    ${question.explanation ? `<div class="ai-pool-wrong-info"><p class="ai-pool-explanation">${escapeHtml(question.explanation)}</p></div>` : ""}
    <div class="ai-pool-choices retry"></div>
    <div class="ai-pool-feedback" hidden></div>
  `;

  const choicesEl = card.querySelector(".ai-pool-choices");
  renderPoolChoices(card, question, choicesEl);
}

// ─── 답변 처리 ───────────────────────────────────────────────

async function handleAnswer(card, question, selectedNo) {
  card.querySelectorAll(".ai-pool-choice-btn").forEach(b => { b.disabled = true; });

  let result;
  try {
    result = await apiAnswer(question.id, selectedNo);
  } catch (err) {
    showToast(`제출 실패: ${err.message}`);
    card.querySelectorAll(".ai-pool-choice-btn").forEach(b => { b.disabled = false; });
    return;
  }

  // 선택지 오답 색상만 표시 (정답 번호 노출 안 함)
  card.querySelectorAll(".ai-pool-choice-btn").forEach((btn, idx) => {
    const no = idx + 1;
    if (no === selectedNo && !result.isCorrect) btn.classList.add("wrong");
  });

  // 피드백 배너 표시
  const feedback = card.querySelector(".ai-pool-feedback");
  if (feedback) {
    feedback.hidden = false;
    if (result.isCorrect) {
      feedback.className = "ai-pool-feedback correct";
      feedback.textContent = "✓ 정답입니다!";
    } else {
      feedback.className = "ai-pool-feedback wrong";
      feedback.textContent = "✗ 오답입니다.";
    }
  }

  if (result.isCorrect) {
    handleCorrect(card, question, result);
  } else {
    handleWrong(card, question, result, selectedNo);
  }

  updatePoolStatus(result.poolSize);
}

function handleCorrect(card, question, result) {
  card.classList.add("correct-done");
  const actions = card.querySelector(".ai-pool-actions");
  if (actions) {
    actions.innerHTML = `<span class="ai-pool-correct-label">✓ 정답 — 새 문제를 생성합니다</span>`;
  }

  showToast("정답! 새 문제를 생성합니다.");

  setTimeout(async () => {
    card.classList.add("fade-out");
    setTimeout(() => card.remove(), 400);
    const added = await fillOneSlot();
    if (!added) {
      const list = document.getElementById("aiPoolList");
      const remaining = list ? list.querySelectorAll(".ai-pool-card:not(.generating)").length : 0;
      if (remaining <= 1) setPoolStatus("더 이상 풀 문제가 없어요");
    }
  }, 1200);
}

function handleWrong(card, question, result, selectedNo) {
  const updatedQuestion = {
    ...question,
    isCorrect: false,
    correctOptionNo: result.correctOptionNo,
    explanation: result.explanation,
    selectedOptionNo: selectedNo,
  };

  const feedbackEl = card.querySelector(".ai-pool-feedback");
  if (feedbackEl) {
    const frag = document.createDocumentFragment();
    if (result.explanation) {
      const expEl = document.createElement("p");
      expEl.className = "ai-pool-explanation";
      expEl.textContent = result.explanation;
      frag.appendChild(expEl);
    }
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "ai-pool-retry-btn";
    retryBtn.textContent = "재도전";
    retryBtn.addEventListener("click", () => {
      card.className = "ai-pool-card wrong";
      renderWrongCard(card, updatedQuestion);
    });
    frag.appendChild(retryBtn);
    feedbackEl.after(frag);
  }
}

// ─── 풀 채우기 ───────────────────────────────────────────────

// true = 계속 채우기, false = 중단
async function fillOneSlot() {
  const list = document.getElementById("aiPoolList");
  if (!list) return false;

  const skeleton = buildSkeletonCard("AI 분석 중...");
  list.appendChild(skeleton);

  try {
    const question = await apiFillOne();
    skeleton.remove();
    const card = buildCard(question);
    card.classList.add("slide-in");
    list.appendChild(card);
    updatePoolStatus(list.querySelectorAll(".ai-pool-card:not(.generating)").length);
    return true;
  } catch (err) {
    skeleton.remove();
    const detail = err.message;
    if (detail === "POOL_FULL") return false;
    if (detail === "NO_HISTORY") {
      setPoolStatus(recommendErrorMessage(detail));
      return false;
    }
    if (detail === "NO_WEAKNESS") {
      setPoolStatus(recommendErrorMessage(detail));
      return false;
    }
    const errCard = document.createElement("div");
    errCard.className = "ai-pool-error-msg";
    errCard.textContent = recommendErrorMessage(detail);
    list.appendChild(errCard);
    return false;
  }
}

async function fillPool(currentSize) {
  const needed = MAX_POOL - currentSize;
  for (let i = 0; i < needed; i++) {
    const canContinue = await fillOneSlot();
    if (!canContinue) break;
  }

  const list = document.getElementById("aiPoolList");
  const cardCount = list ? list.querySelectorAll(".ai-pool-card:not(.generating)").length : 0;
  if (cardCount === 0) {
    setPoolStatus("생성 가능한 추천 문제가 없습니다.");
  }
}

// ─── 풀 상태 텍스트 ──────────────────────────────────────────

function updatePoolStatus(poolSize) {
  setPoolStatus(`${poolSize} / ${MAX_POOL}개 · 정답을 맞추면 새 문제로 교체됩니다.`);
}

// ─── 유틸 ────────────────────────────────────────────────────

function parseWeakArea(weakArea) {
  if (!weakArea) return "AI 추천";
  const parts = weakArea.split("|");
  return parts.length >= 2 ? parts[1] : parts[0];
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── 페이지 진입점 ───────────────────────────────────────────

async function renderAiRecommendPage() {
  const list = document.getElementById("aiPoolList");
  if (!list) return;

  list.innerHTML = "";
  setPoolStatus("");

  try {
    const pool = await apiGetPool();
    const questions = pool.questions || [];
    const poolSize = pool.poolSize ?? 0;

    questions.forEach(q => list.appendChild(buildCard(q)));

    if (pool.canGenerate === false && poolSize < MAX_POOL) {
      if (poolSize === 0) {
        setPoolStatus("생성 가능한 추천 문제가 없습니다.");
      } else {
        updatePoolStatus(poolSize);
      }
      return;
    }

    updatePoolStatus(poolSize);

    if (poolSize < MAX_POOL) {
      await fillPool(poolSize);
    }
  } catch (err) {
    setPoolStatus(`불러오기 실패: ${err.message}`);
  }
}

// ─── 이벤트 바인딩 ───────────────────────────────────────────

function initAiRecommendActions() {}
