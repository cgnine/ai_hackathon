function analysisScoreColor(score) {
  if (score >= 80) return "#4f8f46";
  if (score >= 60) return "#ffcc00";
  return "#d89b00";
}

const ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000;

function analysisCacheKey(memberId, name) {
  return `analysis:${name}:${memberId}`;
}

function readAnalysisCache(memberId, name) {
  try {
    const raw = localStorage.getItem(analysisCacheKey(memberId, name));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.cachedAt || Date.now() - cached.cachedAt > ANALYSIS_CACHE_TTL_MS) {
      localStorage.removeItem(analysisCacheKey(memberId, name));
      return null;
    }
    return cached.data || null;
  } catch {
    return null;
  }
}

function writeAnalysisCache(memberId, name, data) {
  try {
    localStorage.setItem(analysisCacheKey(memberId, name), JSON.stringify({
      cachedAt: Date.now(),
      data
    }));
  } catch {
    // Cache failure should not block the page.
  }
}

function clearAnalysisCache(memberId = currentMemberId()) {
  if (!memberId) return;
  localStorage.removeItem(analysisCacheKey(memberId, "stats"));
  localStorage.removeItem(analysisCacheKey(memberId, "commentary"));
}

async function loadAnalysisData() {
  const memberId = currentMemberId();
  if (!memberId) {
    throw new Error("로그인 정보가 없습니다.");
  }

  const response = await fetch(`${API_BASE}/results/analysis?member_id=${encodeURIComponent(memberId)}&include_commentary=false`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${response.status}`);
  }
  const data = await response.json();
  writeAnalysisCache(memberId, "stats", data);
  return data;
}

async function loadAnalysisCommentary() {
  const memberId = currentMemberId();
  if (!memberId) {
    throw new Error("로그인 정보가 없습니다.");
  }

  const response = await fetch(`${API_BASE}/results/analysis/commentary?member_id=${encodeURIComponent(memberId)}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${response.status}`);
  }
  const data = await response.json();
  writeAnalysisCache(memberId, "commentary", data);
  return data;
}

function renderAnalysisData(data, useCachedCommentary = false) {
  if (els.analysisName) els.analysisName.textContent = `${data.summary.memberName || currentMemberName() || "응시자"}님의 학습 분석`;
  renderRadar(data.subjectStats || []);
  renderSubjectBars(data.subjectStats || []);
  renderSkillMetrics(data.summary || {}, data.typeStats || [], data.unitStats || []);
  renderExamTrend(data.examTrend || []);
  renderExamHighlights(data.examHighlights || {}, data.examTrend || []);
  renderRecommendation(data.subjectStats || [], data.unitStats || [], data.summary || {});

  const memberId = currentMemberId();
  const cachedCommentary = useCachedCommentary && memberId
    ? readAnalysisCache(memberId, "commentary")
    : null;
  if (cachedCommentary) {
    renderAnalysisText(cachedCommentary.commentary || [], data.subjectStats || []);
    return true;
  }

  els.analysisText.innerHTML = "<p>Bedrock AI총평을 준비하고 있습니다.</p>";
  return false;
}

function refreshAnalysisCommentary(subjectStats, keepExistingOnError = false) {
  loadAnalysisCommentary()
    .then((commentaryData) => {
      renderAnalysisText(commentaryData.commentary || [], subjectStats);
    })
    .catch((error) => {
      if (keepExistingOnError) return;
      const p = document.createElement("p");
      p.textContent = `AI총평을 불러오지 못했습니다. (${error.message})`;
      els.analysisText.innerHTML = "";
      els.analysisText.appendChild(p);
    });
}

async function renderAnalysisPage() {
  if (!els.radarChart || !els.subjectBars || !els.analysisText || !els.skillMetrics || !els.recommendationCard) return;

  if (els.analysisName) els.analysisName.textContent = `${currentMemberName() || state.profileName || "응시자"}님의 학습 분석`;
  renderAnalysisLoading();

  const memberId = currentMemberId();
  const cachedData = memberId ? readAnalysisCache(memberId, "stats") : null;
  if (cachedData) {
    renderAnalysisData(cachedData, true);
  }

  try {
    const data = await loadAnalysisData();
    const hasCachedCommentary = renderAnalysisData(data, true);
    refreshAnalysisCommentary(data.subjectStats || [], hasCachedCommentary);
  } catch (error) {
    if (cachedData) {
      showToast(`분석 데이터를 갱신하지 못했습니다. (${error.message})`);
      return;
    }
    renderAnalysisEmpty(`분석 데이터를 불러오지 못했습니다. (${error.message})`);
  }
}

function renderAnalysisLoading() {
  els.radarChart.innerHTML = "<p class=\"item-sub\">DB 풀이 기록을 분석하고 있습니다.</p>";
  els.subjectBars.innerHTML = "<p class=\"item-sub\">과목별 점수를 계산 중입니다.</p>";
  els.skillMetrics.innerHTML = "";
  if (els.examTrend) els.examTrend.innerHTML = "<p class=\"item-sub\">회차별 점수 그래프를 계산 중입니다.</p>";
  if (els.examHighlights) els.examHighlights.innerHTML = "";
  els.analysisText.innerHTML = "<p>Bedrock AI총평을 준비하고 있습니다.</p>";
  els.recommendationCard.innerHTML = "<p class=\"item-sub\">추천 문제를 고르는 중입니다.</p>";
}

function renderAnalysisEmpty(message) {
  els.radarChart.innerHTML = "<p class=\"item-sub\">표시할 풀이 기록이 없습니다.</p>";
  els.subjectBars.innerHTML = "";
  els.skillMetrics.innerHTML = "";
  if (els.examTrend) els.examTrend.innerHTML = "";
  if (els.examHighlights) els.examHighlights.innerHTML = "";
  els.analysisText.innerHTML = `<p>${message}</p>`;
  els.recommendationCard.innerHTML = "<p class=\"item-sub\">모의고사를 완료하면 AI 맞춤형 추천 문제 안내가 표시됩니다.</p>";
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

function renderExamTrend(examTrend) {
  if (!els.examTrend) return;
  if (!examTrend.length) {
    els.examTrend.innerHTML = "<p class=\"item-sub\">아직 회차별 점수 그래프를 만들 응시 기록이 없습니다.</p>";
    return;
  }

  const palette = ["#5a401f", "#d89b00", "#4f8f46", "#1d4ed8", "#8b5cf6", "#be5a2a"];
  const subjectColors = {};
  Array.from(new Set(examTrend.map((item) => item.subjectName || item.subjectCode || "응시 결과")))
    .forEach((name, index) => {
      subjectColors[name] = palette[index % palette.length];
    });
  const width = 360;
  const height = 210;
  const padding = { top: 22, right: 22, bottom: 44, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxIndex = Math.max(examTrend.length - 1, 1);
  const pointFor = (item, index) => {
    const score = Math.max(0, Math.min(100, item.score || 0));
    const x = padding.left + (plotWidth * index / maxIndex);
    const y = padding.top + plotHeight - (plotHeight * score / 100);
    return { x, y, score };
  };
  const points = examTrend.map(pointFor);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const latest = examTrend[examTrend.length - 1];
  const best = examTrend.reduce((acc, item) => (item.score || 0) > (acc.score || 0) ? item : acc, examTrend[0]);
  const average = Math.round(examTrend.reduce((sum, item) => sum + (item.score || 0), 0) / examTrend.length);
  const segments = points.slice(1).map((point, index) => {
    const from = points[index];
    const item = examTrend[index + 1];
    const subjectName = item.subjectName || item.subjectCode || "응시 결과";
    return `<line x1="${from.x}" y1="${from.y}" x2="${point.x}" y2="${point.y}" class="score-segment" style="stroke:${subjectColors[subjectName]}"></line>`;
  }).join("");
  const legend = Object.entries(subjectColors).map(([name, color]) => `
    <span class="score-legend-item"><i style="background:${color}"></i>${name}</span>
  `).join("");

  els.examTrend.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="회차별 점수 선그래프">
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotHeight}" class="score-axis" />
      <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${padding.left + plotWidth}" y2="${padding.top + plotHeight}" class="score-axis" />
      <line x1="${padding.left}" y1="${padding.top + plotHeight * 0.25}" x2="${padding.left + plotWidth}" y2="${padding.top + plotHeight * 0.25}" class="score-grid" />
      <line x1="${padding.left}" y1="${padding.top + plotHeight * 0.5}" x2="${padding.left + plotWidth}" y2="${padding.top + plotHeight * 0.5}" class="score-grid" />
      <line x1="${padding.left}" y1="${padding.top + plotHeight * 0.75}" x2="${padding.left + plotWidth}" y2="${padding.top + plotHeight * 0.75}" class="score-grid" />
      <text x="12" y="${padding.top + 5}" class="score-label">100</text>
      <text x="18" y="${padding.top + plotHeight * 0.5 + 4}" class="score-label">50</text>
      <text x="24" y="${padding.top + plotHeight + 4}" class="score-label">0</text>
      <path d="${path}" class="score-line-shadow"></path>
      ${segments}
      ${points.map((point, index) => {
        const item = examTrend[index];
        const subjectName = item.subjectName || item.subjectCode || "응시 결과";
        return `
        <g class="score-point-group" tabindex="0">
          <circle cx="${point.x}" cy="${point.y}" r="5" class="score-dot" style="fill:${subjectColors[subjectName]}"></circle>
          <g class="score-tooltip" transform="translate(${Math.min(Math.max(point.x - 54, 6), width - 112)} ${Math.max(point.y - 48, 8)})">
            <rect width="108" height="36" rx="7"></rect>
            <text x="8" y="15">${subjectName}</text>
            <text x="8" y="29">${item.score || 0}점 · ${item.correct || 0}/${item.answered || 0}</text>
          </g>
        </g>
        <text x="${point.x}" y="${height - 20}" class="score-x-label">${index + 1}회</text>
      `}).join("")}
    </svg>
    <div class="score-legend">${legend}</div>
    <div class="score-line-summary">
      <div><span>최근 점수</span><strong>${latest.score || 0}점</strong><small>${latest.subjectName || "응시 결과"}</small></div>
      <div><span>최고 점수</span><strong>${best.score || 0}점</strong><small>${best.subjectName || "응시 결과"}</small></div>
      <div><span>평균 흐름</span><strong>${average}점</strong><small>최근 ${examTrend.length}회 기준</small></div>
    </div>
  `;
}

function renderExamHighlights(highlights, examTrend) {
  if (!els.examHighlights) return;
  const best = highlights.bestExam || null;
  const weakest = highlights.weakestExam || null;
  const latest = examTrend.length ? examTrend[examTrend.length - 1] : null;

  if (!best && !weakest && !latest) {
    els.examHighlights.innerHTML = "<p class=\"item-sub\">응시 기록이 쌓이면 최고점과 보완 회차가 표시됩니다.</p>";
    return;
  }

  const cards = [
    best && {
      label: "최고 점수",
      title: `${best.score || 0}점`,
      text: `${best.subjectName || "응시 결과"} · ${formatProfileDate(best.createdAt || best.examDate)}`
    },
    weakest && {
      label: "보완 필요 회차",
      title: `${weakest.score || 0}점`,
      text: `${weakest.subjectName || "응시 결과"} · 오답 ${weakest.wrong || 0}문항`
    },
    latest && {
      label: "최근 응시",
      title: `${latest.score || 0}점`,
      text: `${latest.subjectName || "응시 결과"} · ${latest.correct || 0}/${latest.answered || 0}`
    }
  ].filter(Boolean);

  els.examHighlights.innerHTML = cards.map((card) => `
    <div class="highlight-card">
      <span>${card.label}</span>
      <strong>${card.title}</strong>
      <p>${card.text}</p>
    </div>
  `).join("");
}

function analysisSubjectNames(subjectStats = []) {
  return Array.from(new Set(
    subjectStats
      .map((item) => String(item.subjectName || "").trim())
      .filter(Boolean)
  )).sort((a, b) => b.length - a.length);
}

function appendTextWithStrongSubjects(parent, text, subjectNames) {
  const source = String(text || "");
  if (!source || subjectNames.length === 0) {
    parent.textContent = source;
    return;
  }

  const lowerSource = source.toLocaleLowerCase();
  const lowerSubjectNames = subjectNames.map((name) => ({
    name,
    lowerName: name.toLocaleLowerCase()
  }));
  let cursor = 0;

  while (cursor < source.length) {
    let matchIndex = -1;
    let matchName = "";

    lowerSubjectNames.forEach(({ name, lowerName }) => {
      const found = lowerSource.indexOf(lowerName, cursor);
      if (found === -1) return;
      if (
        matchIndex === -1 ||
        found < matchIndex ||
        (found === matchIndex && name.length > matchName.length)
      ) {
        matchIndex = found;
        matchName = name;
      }
    });

    if (matchIndex === -1) {
      parent.appendChild(document.createTextNode(source.slice(cursor)));
      break;
    }

    if (matchIndex > cursor) {
      parent.appendChild(document.createTextNode(source.slice(cursor, matchIndex)));
    }

    const strong = document.createElement("strong");
    strong.textContent = source.slice(matchIndex, matchIndex + matchName.length);
    parent.appendChild(strong);
    cursor = matchIndex + matchName.length;
  }
}

function renderAnalysisText(commentary, subjectStats = []) {
  const lines = commentary.length
    ? commentary
    : ["아직 AI총평을 만들 풀이 기록이 없습니다. 모의고사를 완료하면 Bedrock 기반 AI총평이 표시됩니다."];
  const subjectNames = analysisSubjectNames(subjectStats);
  els.analysisText.innerHTML = "";
  lines.forEach((line) => {
    const p = document.createElement("p");
    appendTextWithStrongSubjects(p, line, subjectNames);
    els.analysisText.appendChild(p);
  });
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

function renderRecommendation(subjectStats, unitStats, summary = {}) {
  const wrongTotal = summary.wrongTotal || 0;
  if (!summary.answeredTotal) {
    els.recommendationCard.innerHTML = "<p class=\"item-sub\">아직 풀이 기록이 없습니다. 모의고사를 완료하면 AI가 필요한 보완 문제를 안내합니다.</p>";
    return;
  }
  if (!wrongTotal) {
    els.recommendationCard.innerHTML = "<p class=\"item-sub\">최근 풀이에서 뚜렷한 오답 약점이 없습니다. AI 맞춤형 문제는 필요한 경우에만 생성합니다.</p>";
    return;
  }

  const weakUnit = (unitStats || [])[0];
  const weakSubject = weakUnit
    || (subjectStats || []).slice().sort((a, b) => (a.score || 0) - (b.score || 0))[0];
  const subjectName = weakSubject?.subjectName || "취약 과목";
  const unit = weakUnit?.unit || weakSubject?.majorUnit || "오답이 반복된 영역";

  els.recommendationCard.innerHTML = "";
  const card = document.createElement("article");
  const head = document.createElement("div");
  const title = document.createElement("strong");
  const badge = document.createElement("span");
  const note = document.createElement("p");
  const action = document.createElement("a");

  card.className = "recommend-card ai-recommend-guide";
  head.className = "recommend-card-head";
  title.textContent = `${subjectName} · ${unit}`;
  badge.textContent = "AI 분석";
  note.className = "recommend-question";
  note.textContent = `${subjectName}의 ${unit} 부분이 부족해 보여요. 실제 문제 풀이는 별도 탭에서 AI가 오답 이력을 보고 새 문제를 생성합니다.`;
  action.className = "primary-btn";
  action.href = "ai-recommend.html";
  action.dataset.screen = "aiRecommend";
  action.textContent = "AI 맞춤형 추천문제 풀기";

  head.append(title, badge);
  card.append(head, note, action);
  els.recommendationCard.appendChild(card);
}
