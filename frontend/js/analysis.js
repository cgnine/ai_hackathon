function analysisScoreColor(score) {
  if (score >= 80) return "#4f8f46";
  if (score >= 60) return "#ffcc00";
  return "#d89b00";
}

async function loadAnalysisData() {
  const memberId = currentMemberId();
  if (!memberId) {
    throw new Error("로그인 정보가 없습니다.");
  }

  const response = await fetch(`${API_BASE}/results/analysis?member_id=${encodeURIComponent(memberId)}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

async function renderAnalysisPage() {
  if (!els.radarChart || !els.subjectBars || !els.analysisText || !els.skillMetrics || !els.recommendationCard) return;

  if (els.analysisName) els.analysisName.textContent = `${currentMemberName() || state.profileName || "응시자"}님의 학습 분석`;
  renderAnalysisLoading();

  try {
    const data = await loadAnalysisData();
    if (els.analysisName) els.analysisName.textContent = `${data.summary.memberName || currentMemberName() || "응시자"}님의 학습 분석`;
    renderRadar(data.subjectStats || []);
    renderSubjectBars(data.subjectStats || []);
    renderSkillMetrics(data.summary || {}, data.typeStats || [], data.unitStats || []);
    renderAnalysisText(data.commentary || []);
    renderRecommendation(data.recommendations || []);
  } catch (error) {
    renderAnalysisEmpty(`분석 데이터를 불러오지 못했습니다. (${error.message})`);
  }
}

function renderAnalysisLoading() {
  els.radarChart.innerHTML = "<p class=\"item-sub\">DB 풀이 기록을 분석하고 있습니다.</p>";
  els.subjectBars.innerHTML = "<p class=\"item-sub\">과목별 점수를 계산 중입니다.</p>";
  els.skillMetrics.innerHTML = "";
  els.analysisText.innerHTML = "<p>Bedrock 총평을 준비하고 있습니다.</p>";
  els.recommendationCard.innerHTML = "<p class=\"item-sub\">추천 문제를 고르는 중입니다.</p>";
}

function renderAnalysisEmpty(message) {
  els.radarChart.innerHTML = "<p class=\"item-sub\">표시할 풀이 기록이 없습니다.</p>";
  els.subjectBars.innerHTML = "";
  els.skillMetrics.innerHTML = "";
  els.analysisText.innerHTML = `<p>${message}</p>`;
  els.recommendationCard.innerHTML = "<p class=\"item-sub\">모의고사를 완료하면 맞춤형 추천 문제가 표시됩니다.</p>";
}

function renderRadar(scores) {
  if (!scores.length) {
    els.radarChart.innerHTML = "<p class=\"item-sub\">아직 과목별 점수를 만들 풀이 기록이 없습니다.</p>";
    return;
  }

  const center = 120;
  const maxRadius = 82;
  const count = Math.max(scores.length, 3);
  const fullPoints = Array.from({ length: count }, (_, index) => {
    const angle = (-90 + index * (360 / count)) * Math.PI / 180;
    return [center + Math.cos(angle) * maxRadius, center + Math.sin(angle) * maxRadius];
  });
  const points = scores.map((item, index) => {
    const angle = (-90 + index * (360 / count)) * Math.PI / 180;
    const radius = maxRadius * ((item.score || 0) / 100);
    return [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius];
  });
  const axis = scores.map((item, index) => {
    const angle = (-90 + index * (360 / count)) * Math.PI / 180;
    const x = center + Math.cos(angle) * maxRadius;
    const y = center + Math.sin(angle) * maxRadius;
    const labelX = center + Math.cos(angle) * (maxRadius + 26);
    const labelY = center + Math.sin(angle) * (maxRadius + 26);
    return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" class="radar-axis" /><text x="${labelX}" y="${labelY}" class="radar-label">${item.subjectName}</text>`;
  }).join("");

  els.radarChart.innerHTML = `
    <svg viewBox="0 0 240 240" role="img" aria-label="과목별 점수 레이더 차트">
      <polygon points="${fullPoints.map(([x, y]) => `${x},${y}`).join(" ")}" class="radar-grid" />
      ${axis}
      <polygon points="${points.map(([x, y]) => `${x},${y}`).join(" ")}" class="radar-score" />
    </svg>
  `;
}

function renderSubjectBars(scores) {
  if (!scores.length) {
    els.subjectBars.innerHTML = "<p class=\"item-sub\">응시 기록이 없습니다.</p>";
    return;
  }

  els.subjectBars.innerHTML = "";
  scores.forEach((item) => {
    const score = item.score || 0;
    const row = document.createElement("div");
    row.className = "subject-bar";
    row.innerHTML = `
      <div class="subject-bar-head">
        <strong>${item.subjectName}</strong>
        <span>${score}점 · ${item.correct}/${item.answered}</span>
      </div>
      <div class="bar-track"><span style="width:${score}%; background:${analysisScoreColor(score)}"></span></div>
      <p class="analysis-row-note">오답 ${item.wrong}문항 · 최근 응시 ${item.latestExamAt || "-"}</p>
    `;
    els.subjectBars.appendChild(row);
  });
}

function renderSkillMetrics(summary, typeStats, unitStats) {
  const typeHtml = typeStats.length
    ? typeStats.map((item) => `<div class="mini-stat"><span>${item.type}</span><strong>${item.score}점</strong><small>${item.correct}/${item.answered}</small></div>`).join("")
    : "<p class=\"item-sub\">유형별 기록이 없습니다.</p>";
  const weakUnits = unitStats.slice(0, 4);
  const unitHtml = weakUnits.length
    ? weakUnits.map((item) => `<div class="analysis-chip"><span>${item.subjectName}</span><strong>${item.unit}</strong><em>${item.score}점</em></div>`).join("")
    : "<p class=\"item-sub\">단원별 취약점이 없습니다.</p>";

  els.skillMetrics.innerHTML = `
    <div class="metric"><span>평균 점수</span><strong>${summary.averageScore || 0}점</strong></div>
    <div class="metric"><span>풀이 문항</span><strong>${summary.answeredTotal || 0}문항</strong></div>
    <div class="metric"><span>오답 수</span><strong>${summary.wrongTotal || 0}문항</strong></div>
    <div class="analysis-wide">
      <h3>유형별 점수</h3>
      <div class="mini-stat-grid">${typeHtml}</div>
    </div>
    <div class="analysis-wide">
      <h3>우선 복습 단원</h3>
      <div class="analysis-chip-list">${unitHtml}</div>
    </div>
  `;
}

function renderAnalysisText(commentary) {
  const lines = commentary.length
    ? commentary
    : ["아직 총평을 만들 풀이 기록이 없습니다. 모의고사를 완료하면 Bedrock 기반 총평이 표시됩니다."];
  els.analysisText.innerHTML = lines.map((line) => `<p>${line}</p>`).join("");
}

function explanationParagraphs(explanation) {
  const text = String(explanation || "").trim();
  if (!text) return ["등록된 해설이 없습니다."];

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines;

  return text
    .split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderRecommendationFeedback(target, question, selectedNumber) {
  const correct = selectedNumber === question.answer;
  target.className = `recommend-feedback ${correct ? "correct" : "wrong"}`;
  target.innerHTML = "";

  const head = document.createElement("div");
  const title = document.createElement("strong");
  const answer = document.createElement("span");
  const body = document.createElement("div");

  head.className = "recommend-feedback-head";
  title.textContent = correct ? "정답입니다" : "오답입니다";
  answer.textContent = `정답 ${question.answer}번`;
  body.className = "recommend-explanation";

  explanationParagraphs(question.explanation).forEach((paragraph) => {
    const p = document.createElement("p");
    p.textContent = paragraph;
    body.appendChild(p);
  });

  head.append(title, answer);
  target.append(head, body);
}

function renderRecommendation(recommendations) {
  if (!recommendations.length) {
    els.recommendationCard.innerHTML = "<p class=\"item-sub\">추천할 문제가 없습니다. 모의고사 기록이 쌓이면 취약 과목 기준으로 표시됩니다.</p>";
    return;
  }

  els.recommendationCard.innerHTML = "";
  recommendations.forEach((question, questionIndex) => {
    const card = document.createElement("article");
    const scenario = String(question.questionScenario || "").trim();
    card.className = "recommend-card";
    card.innerHTML = `
      <div class="recommend-card-head">
        <strong>${question.subjectName} · ${question.majorUnit}</strong>
        <span>${question.questionType}</span>
      </div>
      <p class="recommend-question">${question.questionText}</p>
      ${scenario ? `<div class="question-scenario-box mock-scenario-box">${scenario}</div>` : ""}
    `;

    const choices = document.createElement("ol");
    const feedback = document.createElement("div");
    choices.className = "choices recommendation-choices";
    feedback.className = "recommend-feedback";

    (question.choices || []).forEach((choice, index) => {
      if (!choice) return;
      const choiceNumber = index + 1;
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-btn";
      button.innerHTML = `<span class="choice-num">${choiceNumber}</span><span>${choice}</span>`;
      button.addEventListener("click", () => {
        const correct = choiceNumber === question.answer;
        choices.querySelectorAll(".choice-btn").forEach((item) => item.disabled = true);
        button.classList.add(correct ? "correct" : "wrong");
        renderRecommendationFeedback(feedback, question, choiceNumber);
      });
      li.appendChild(button);
      choices.appendChild(li);
    });

    card.append(choices, feedback);
    els.recommendationCard.appendChild(card);
  });
}
