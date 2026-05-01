const API_BASE = "http://localhost:8000";

const btn        = document.getElementById("generateBtn");
const loadingEl  = document.getElementById("loading");
const resultEl   = document.getElementById("result");
const errorEl    = document.getElementById("error");

btn.addEventListener("click", async () => {
  setLoading(true);
  hide(resultEl);
  hide(errorEl);

  try {
    const res = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_start: 1, page_end: 15 }),
    });

    const data = await res.json();
    renderResult(data);
  } catch (err) {
    showError("서버에 연결하지 못했습니다. backend가 실행 중인지 확인하세요.\n" + err.message);
  } finally {
    setLoading(false);
  }
});

function setLoading(on) {
  btn.disabled = on;
  loadingEl.style.display = on ? "block" : "none";
}

function hide(el) { el.style.display = "none"; }
function show(el) { el.style.display = "block"; }

function showError(msg) {
  document.getElementById("errorMsg").textContent = msg;
  show(errorEl);
}

function renderResult(d) {
  // 상태 뱃지
  const badgeEl = document.getElementById("statusBadge");
  badgeEl.textContent = d.final_status;
  badgeEl.className = "badge " + (d.final_status === "PASS" ? "pass" : "fail");

  document.getElementById("runId").textContent = "run_id: " + (d.run_id || "-");

  if (!d.question) {
    // FAIL이고 문제 자체가 없는 경우
    document.getElementById("questionText").textContent = "문제를 생성하지 못했습니다.";
    document.getElementById("choicesList").innerHTML = "";
  } else {
    document.getElementById("questionText").textContent = d.question;
    renderChoices(d.choices || [], d.answer);
  }

  document.getElementById("answerNum").textContent  = d.answer ? d.answer + "번" : "-";
  document.getElementById("explanation").textContent = d.explanation || "-";
  document.getElementById("sourceSummary").textContent = d.source_summary || "-";

  // 태그 & 난이도
  const metaEl = document.getElementById("metaTags");
  metaEl.innerHTML = "";
  if (d.difficulty) {
    const sp = document.createElement("span");
    sp.className = "difficulty";
    sp.textContent = d.difficulty;
    metaEl.appendChild(sp);
  }
  (d.tags || []).forEach(t => {
    const sp = document.createElement("span");
    sp.className = "tag";
    sp.textContent = t;
    metaEl.appendChild(sp);
  });

  // Rule Validation
  renderRuleResult(d.rule_validation_result);

  // Judge
  renderJudgeResult(d.judge_result);

  // 메타
  const rr = document.getElementById("recoveryRow");
  rr.innerHTML = `
    <span>recovery: ${d.recovery_used ? "사용됨" : "미사용"}</span>
    <span>retry: ${d.retry_count}회</span>
    <span>log: ${d.log_ref || "-"}</span>
  `;

  show(resultEl);
}

function renderChoices(choices, answer) {
  const ul = document.getElementById("choicesList");
  ul.innerHTML = "";
  choices.forEach((c, i) => {
    const li = document.createElement("li");
    li.className = "choice-item" + (i + 1 === answer ? " correct" : "");
    li.innerHTML = `<span class="choice-num">${i + 1}.</span><span>${c}</span>`;
    ul.appendChild(li);
  });
}

function renderRuleResult(rule) {
  const el = document.getElementById("ruleResult");
  if (!rule) { el.innerHTML = "<span class='muted'>-</span>"; return; }

  const icon = rule.passed ? "✅ 통과" : "❌ 실패";
  let html = `<div>${icon}</div>`;
  if (rule.errors && rule.errors.length > 0) {
    html += `<ul class="rule-errors">${rule.errors.map(e => `<li>${e}</li>`).join("")}</ul>`;
  }
  el.innerHTML = html;
}

function renderJudgeResult(judge) {
  const el = document.getElementById("judgeResult");
  if (!judge) { el.innerHTML = "<span class='muted'>-</span>"; return; }

  const score = judge.score ?? 0;
  const pct = Math.round(score * 100);
  const checks = judge.checks || {};

  const checkItems = [
    ["grounded_in_source",       "원문 근거"],
    ["single_correct_answer",    "단일 정답"],
    ["choices_are_valid",        "선택지 유효"],
    ["explanation_is_sufficient","해설 충분"],
    ["no_hallucination",         "환각 없음"],
  ];

  let html = `
    <div class="score-bar-wrap">
      <div class="score-bar"><div class="score-fill" style="width:${pct}%"></div></div>
      <div class="score-label">점수: ${score.toFixed(2)} (${pct}%)</div>
    </div>
    <div class="harness-grid">
  `;
  checkItems.forEach(([key, label]) => {
    const ok = checks[key];
    html += `<div class="check-item"><span class="check-icon">${ok ? "✅" : "❌"}</span>${label}</div>`;
  });
  html += `</div>`;

  if (judge.reasons && judge.reasons.length > 0) {
    html += `<ul class="reasons-list">${judge.reasons.map(r => `<li>${r}</li>`).join("")}</ul>`;
  }

  el.innerHTML = html;
}
