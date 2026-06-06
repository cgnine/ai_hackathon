function appendResultItem(question, index, selected, correct, meta = {}) {
  if (!els.resultList) return;

  const item = document.createElement("article");
  const toggle = document.createElement("button");
  const status = document.createElement("span");
  const body = document.createElement("div");
  const title = document.createElement("div");
  const explanation = createResultDetail({
    choices: question.choices,
    scenario: question.scenario,
    selected,
    answer: question.answer,
    explanation: question.explanation,
    sampleSolution: question.sampleSolution,
    saved: state.wrongNotes.has(meta.attemptId ? `${meta.attemptId}-${currentSubject().id}-${index}` : `${currentSubject().id}-${index}`),
    onSave: () => addWrongNote(index, true, meta)
  });

  item.className = "result-item";
  toggle.type = "button";
  toggle.className = "result-toggle";
  toggle.setAttribute("aria-expanded", "false");
  status.className = `status-dot ${correct ? "" : "wrong"}`;
  status.textContent = correct ? "O" : "X";
  title.className = "item-title";
  title.textContent = `${index + 1}. ${question.text}`;
  body.append(title);
  toggle.append(status, body);
  toggle.addEventListener("click", () => {
    toggleResultItem(item, toggle, explanation);
  });
  item.append(toggle, explanation);
  els.resultList.appendChild(item);
}

function toggleResultItem(item, toggle, detail) {
  const isOpen = item.classList.toggle("open");
  const title = item.querySelector(".item-title");
  toggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    detail.style.maxHeight = "none";
    focusResultFirstChoice(detail);
  } else {
    detail.style.maxHeight = "0px";
  }
  if (title?.dataset.previewText && title.dataset.fullText) {
    title.textContent = isOpen ? title.dataset.fullText : title.dataset.previewText;
  }
  updateToggleAllExplanationsButton();
}

function focusResultItem(item) {
  if (!item) return;
  if (!item.hasAttribute("tabindex")) item.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => {
    item.focus({ preventScroll: true });
    item.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function focusResultFirstChoice(detail) {
  const firstChoice = detail?.querySelector(".result-choice");
  if (!firstChoice) {
    focusResultItem(detail?.closest(".result-item"));
    return;
  }
  if (!firstChoice.hasAttribute("tabindex")) firstChoice.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => {
    firstChoice.focus({ preventScroll: true });
    firstChoice.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function setResultItemOpen(item, isOpen) {
  const toggle = item.querySelector(".result-toggle");
  const title = item.querySelector(".item-title");
  const detail = item.querySelector(".result-explanation");
  if (!toggle || !detail) return;
  item.classList.toggle("open", isOpen);
  toggle.setAttribute("aria-expanded", String(isOpen));
  detail.style.maxHeight = isOpen ? "none" : "0px";
  if (title?.dataset.previewText && title.dataset.fullText) {
    title.textContent = isOpen ? title.dataset.fullText : title.dataset.previewText;
  }
}

function toggleAllResultExplanations() {
  if (!els.resultList) return;
  const items = Array.from(els.resultList.querySelectorAll(".result-item"));
  if (items.length === 0) return;
  const shouldOpen = items.some((item) => !item.classList.contains("open"));
  items.forEach((item) => setResultItemOpen(item, shouldOpen));
  updateToggleAllExplanationsButton();
  els.wrongReviewSection?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateToggleAllExplanationsButton() {
  if (!els.toggleAllExplanationsBtn || !els.resultList) return;
  const items = Array.from(els.resultList.querySelectorAll(".result-item"));
  const hasItems = items.length > 0;
  const allOpen = hasItems && items.every((item) => item.classList.contains("open"));
  els.toggleAllExplanationsBtn.style.display = hasItems ? "inline-flex" : "none";
  els.toggleAllExplanationsBtn.disabled = !hasItems;
  els.toggleAllExplanationsBtn.textContent = allOpen ? "문제 모두 접기" : "문제 모두 펼치기";
}

function cleanExplanationText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^[\s\u00a0\u3000]+/, ""))
    .join("\n")
    .trimStart();
}

function createResultDetail({
  choices = [],
  scenario = "",
  selected,
  answer,
  explanation,
  sampleSolution,
  saved = false,
  onSave = null
}) {
  const detail = document.createElement("div");
  const hasChoices = Array.isArray(choices) && choices.length > 0;
  detail.className = "result-explanation";

  const answerSection = document.createElement("div");
  const answerSummary = document.createElement("p");
  const scenarioText = String(scenario || "").trim();

  if (scenarioText) {
    const scenarioBox = document.createElement("div");
    scenarioBox.className = "question-scenario-box result-scenario-box";
    scenarioBox.textContent = scenarioText;
    detail.appendChild(scenarioBox);
  }

  answerSection.className = "result-detail-section result-answer-section";
  answerSummary.className = "result-answer-summary";
  answerSummary.append(
    createAnswerLabel("선택한 답:"),
    document.createTextNode(` ${formatAnswerNumber(selected)}  `),
    createAnswerLabel("정답:"),
    document.createTextNode(` ${formatAnswerNumber(answer)}`)
  );
  answerSection.appendChild(answerSummary);

  if (hasChoices) {
    const choiceSection = document.createElement("div");
    const choiceTitle = document.createElement("strong");
    const choiceList = document.createElement("ol");

    choiceSection.className = "result-detail-section";
    choiceTitle.className = "result-detail-title";
    choiceTitle.textContent = "보기";
    choiceList.className = "result-choice-list";

    choices.forEach((choice, choiceIndex) => {
      const choiceNumber = choiceIndex + 1;
      const row = document.createElement("li");
      const num = document.createElement("span");
      const text = document.createElement("span");

      row.className = "result-choice";
      if (choiceNumber === answer) row.classList.add("correct");
      if (choiceNumber === selected && choiceNumber !== answer) row.classList.add("selected-wrong");
      num.className = "choice-num";
      num.textContent = choiceNumber;
      text.textContent = choice;
      row.append(num, text);
      choiceList.appendChild(row);
    });

    choiceSection.append(choiceTitle, choiceList);
    detail.appendChild(choiceSection);
  }

  detail.appendChild(answerSection);

  const explanationSection = document.createElement("div");
  const explanationText = document.createElement("span");
  const cleanedExplanation = cleanExplanationText(explanation);
  const cleanedSampleSolution = cleanExplanationText(sampleSolution);

  explanationSection.className = "result-detail-section result-explanation-line";
  explanationText.textContent = cleanedSampleSolution
    ? `${cleanedExplanation}\n\n모범답안\n${cleanedSampleSolution}`
    : cleanedExplanation;

  explanationSection.appendChild(explanationText);
  detail.appendChild(explanationSection);

  if (onSave) {
    const action = document.createElement("div");
    const button = document.createElement("button");
    action.className = "result-detail-actions";
    button.type = "button";
    button.className = "secondary-btn result-save-btn";
    button.textContent = saved ? "오답노트 저장됨" : "오답노트 저장";
    button.disabled = saved;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await onSave();
        renderSaveWrongAllButton(latestApiResult || state.lastResult);
        button.textContent = "오답노트 저장됨";
      } catch (error) {
        button.disabled = false;
        showToast(`오답노트 저장에 실패했습니다. (${error.message})`);
      }
    });
    action.appendChild(button);
    detail.appendChild(action);
  }

  return detail;
}

function createAnswerLabel(text) {
  const label = document.createElement("span");
  label.className = "answer-label";
  label.textContent = text;
  return label;
}

function formatAnswerNumber(value) {
  return value ? `${value}번` : "-";
}

function previewQuestionText(text, index) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const firstSentence = normalized.match(/.*?[.?!。？！]|.+?(?=\s|$)/)?.[0]?.trim() || normalized;
  return `${index + 1}. ${firstSentence}`;
}

function fullQuestionText(text, index) {
  return `${index + 1}. ${String(text || "").trim()}`;
}

function appendApiResultItem(item, index, resultMeta) {
  if (!els.resultList) return;

  const row = document.createElement("article");
  const toggle = document.createElement("button");
  const status = document.createElement("span");
  const body = document.createElement("div");
  const title = document.createElement("div");
  const explanation = createResultDetail({
    choices: item.choices,
    scenario: item.questionScenario,
    selected: item.selected,
    answer: item.answer,
    explanation: item.explanation,
    saved: state.wrongNotes.has(apiWrongNoteKey(resultMeta, item, index)) || item.wrongNoteSaved,
    onSave: () => saveApiResultItemToWrongNote(resultMeta, item, index)
  });

  row.className = "result-item";
  toggle.type = "button";
  toggle.className = "result-toggle";
  toggle.setAttribute("aria-expanded", "false");
  status.className = `status-dot ${item.correct ? "" : "wrong"}`;
  status.textContent = item.correct ? "O" : "X";
  title.className = "item-title";
  title.dataset.previewText = previewQuestionText(item.questionText, index);
  title.dataset.fullText = fullQuestionText(item.questionText, index);
  title.textContent = title.dataset.previewText;
  body.append(title);
  toggle.append(status, body);
  toggle.addEventListener("click", () => {
    toggleResultItem(row, toggle, explanation);
  });
  row.append(toggle, explanation);
  els.resultList.appendChild(row);
}

function setResultScoreText(scoreText) {
  if (els.resultScore) els.resultScore.textContent = scoreText;
  if (els.resultScoreCardValue) els.resultScoreCardValue.textContent = scoreText;
}

function renderApiResultPage(result) {
  if (!els.resultList || !els.resultScore || !els.resultSummary) return;

  const passed = result.score > 60;
  latestApiResult = result;
  showResultContent();
  els.resultList.innerHTML = "";
  renderResultHeroAction(false);
  if (els.wrongReviewSection) els.wrongReviewSection.style.display = "";
  if (els.toggleAllExplanationsBtn) els.toggleAllExplanationsBtn.style.display = "inline-flex";
  setResultScoreText(`${result.score}점`);
  if (els.resultVerdict) {
    els.resultVerdict.textContent = passed ? "합격" : "불합격";
    els.resultVerdict.className = `verdict-badge ${passed ? "pass" : "fail"}`;
  }
  els.resultSummary.innerHTML = `${result.subjectName} ${result.total}문항 중 ${result.correctCount}문항을 맞혔습니다.<br>${passed ? "합격 기준을 통과했습니다." : "합격 기준인 60점을 넘지 못했습니다."}`;
  if (els.resultCommentary) {
    const commentary = buildResultCommentary(result.score);
    els.resultCommentary.style.display = commentary ? "" : "none";
    els.resultCommentary.textContent = commentary;
  }
  renderDiagnosis(normalizeDiagnosis(result.diagnosis, {
    profileName: result.profileName,
    subjectName: result.subjectName,
    score: result.score,
    createdAt: result.createdAt
  }));
  renderSaveWrongAllButton(result);
  result.items.forEach((item, index) => appendApiResultItem(item, index, result));
  updateToggleAllExplanationsButton();
}

function apiWrongNoteKey(result, item, index) {
  const attemptId = result?.attemptId || "api-result";
  const questionId = item.questionId || `q-${index + 1}`;
  return `${attemptId}-${questionId}`;
}

function toWrongNoteQuestion(item) {
  return {
    text: item.questionText,
    scenario: item.questionScenario || "",
    choices: item.choices || [],
    answer: item.answer,
    explanation: item.explanation,
    difficulty: item.difficulty,
    questionType: item.questionType
  };
}

async function updateWrongNoteSavedOnServer(result, questionIds) {
  if (!result?.attemptId || !Array.isArray(questionIds) || questionIds.length === 0) return;

  const response = await fetch(`${API_BASE}/results/${result.attemptId}/wrong-note`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_ids: questionIds })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function saveApiResultItemToWrongNote(result, item, index, notify = true, syncServer = true) {
  const key = apiWrongNoteKey(result, item, index);
  const alreadySaved = state.wrongNotes.has(key);
  if (syncServer) await updateWrongNoteSavedOnServer(result, [item.questionId]);
  item.wrongNoteSaved = true;
  state.wrongNotes.set(key, {
    profileName: result.profileName || state.profileName,
    subjectId: result.subjectId,
    subjectName: result.subjectName,
    attemptId: result.attemptId || "api-result",
    roundTitle: result.roundTitle || "AI문제생성 결과",
    createdAt: result.createdAt || new Date().toISOString(),
    index,
    question: toWrongNoteQuestion(item)
  });
  saveState();
  renderTopStats();
  renderSaveWrongAllButton(result);
  if (notify) {
    showToast(alreadySaved ? "이미 오답노트에 저장된 문제입니다." : "오답노트에 저장되었습니다.");
  }
}

function renderSaveWrongAllButton(result = latestApiResult) {
  if (!els.saveWrongAllBtn) return;
  const rows = getResultSaveRows(result);
  const unsavedCount = rows.filter((row) => !row.saved).length;
  els.saveWrongAllBtn.style.display = rows.length ? "inline-flex" : "none";
  els.saveWrongAllBtn.disabled = unsavedCount === 0;
  els.saveWrongAllBtn.textContent = unsavedCount === 0
    ? "오답노트 모두저장됨"
    : "오답노트 모두저장";
}

function getResultSaveRows(result = latestApiResult || state.lastResult) {
  if (!result) return [];

  if (Array.isArray(result.items)) {
    return result.items
      .map((item, index) => ({
        correct: item.correct,
        key: apiWrongNoteKey(result, item, index),
        questionId: item.questionId,
        saved: state.wrongNotes.has(apiWrongNoteKey(result, item, index)) || item.wrongNoteSaved,
        save: (notify = false, syncServer = true) => saveApiResultItemToWrongNote(result, item, index, notify, syncServer)
      }))
      .filter((row) => row.questionId);
  }

  if (Array.isArray(result.rows)) {
    const subject = subjects.find((item) => item.id === result.subjectId) || currentSubject();
    const attemptId = result.attemptId || "manual";
    return result.rows
      .map((row) => ({
        correct: row.correct,
        key: `${attemptId}-${subject.id}-${row.index}`,
        saved: state.wrongNotes.has(`${attemptId}-${subject.id}-${row.index}`),
        save: (notify = false) => addWrongNote(row.index, notify, {
          attemptId,
          roundTitle: result.roundTitle || "모의고사 결과",
          createdAt: result.createdAt || new Date().toISOString()
        })
      }));
  }

  return [];
}

async function saveAllWrongApiResultItems() {
  const result = latestApiResult || state.lastResult;
  const rows = getResultSaveRows(result);
  let savedCount = 0;
  const unsavedRows = rows.filter((row) => !row.saved);
  if (latestApiResult && unsavedRows.length > 0) {
    try {
      await updateWrongNoteSavedOnServer(result, unsavedRows.map((row) => row.questionId));
    } catch (error) {
      showToast(`오답노트 모두저장에 실패했습니다. (${error.message})`);
      return;
    }
  }
  for (const row of unsavedRows) {
    await row.save(false, !latestApiResult);
    savedCount += 1;
  }
  renderSaveWrongAllButton(result);
  if (latestApiResult) {
    renderApiResultPage(latestApiResult);
  } else {
    renderResultPage();
  }
  showToast(savedCount ? `문제 ${savedCount}개를 오답노트에 저장했습니다.` : "저장할 새 문제가 없습니다.");
}

function renderDiagnosis(diagnosis) {
  if (!els.resultDiagnosis || !els.diagnosisChart || !els.diagnosisBars || !els.diagnosisSummary) return;

  const axes = diagnosis?.axes || [];
  if (axes.length === 0) {
    els.resultDiagnosis.style.display = "none";
    return;
  }

  els.resultDiagnosis.style.display = "grid";
  const level = getScoreLevel(diagnosis.score || 0);
  if (els.diagnosisProgramTitle) {
    els.diagnosisProgramTitle.innerHTML = `<span>${new Date().getFullYear()} KB역량진단 모의고사</span>`;
  }
  if (els.diagnosisSubject) els.diagnosisSubject.textContent = diagnosis.subjectName || "응시 과목";
  if (els.diagnosisLevelName) els.diagnosisLevelName.textContent = level.name;
  if (els.diagnosisLevel) els.diagnosisLevel.textContent = `Level ${level.level}`;
  if (els.diagnosisScore) els.diagnosisScore.textContent = `${diagnosis.score || 0} / 100점`;
  if (els.diagnosisName) els.diagnosisName.textContent = diagnosis.profileName || "응시자";
  if (els.diagnosisDate) els.diagnosisDate.textContent = formatFullDate(diagnosis.createdAt || new Date().toISOString());
  if (els.diagnosisCourse) els.diagnosisCourse.textContent = diagnosis.subjectName || "-";
  els.diagnosisSummary.textContent = diagnosis.summary || "영역별 점수를 기준으로 강점과 약점을 확인하세요.";
  renderDiagnosisRadar(diagnosis.radarAxes?.length ? diagnosis.radarAxes : axes);
  renderDiagnosisBars(axes);
}

function renderDiagnosisRadar(axes) {
  const center = 140;
  const maxRadius = 76;
  const labelRadius = 108;
  const count = axes.length;
  const axisPoints = axes.map((axis, index) => {
    const angle = (-90 + index * (360 / count)) * Math.PI / 180;
    const outerX = center + Math.cos(angle) * maxRadius;
    const outerY = center + Math.sin(angle) * maxRadius;
    const scoreRadius = maxRadius * (axis.score / 100);
    const scoreX = center + Math.cos(angle) * scoreRadius;
    const scoreY = center + Math.sin(angle) * scoreRadius;
    const valueRadius = Math.min(maxRadius + 12, Math.max(scoreRadius + 14, 24));
    const valueX = center + Math.cos(angle) * valueRadius;
    const valueY = center + Math.sin(angle) * valueRadius;
    const labelX = center + Math.cos(angle) * labelRadius;
    const labelY = center + Math.sin(angle) * labelRadius;
    return { axis, outerX, outerY, scoreX, scoreY, valueX, valueY, labelX, labelY };
  });

  const grid = [1, 0.66, 0.33].map((scale) => {
    const points = axisPoints.map((_, index) => {
      const angle = (-90 + index * (360 / count)) * Math.PI / 180;
      const radius = maxRadius * scale;
      return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
    }).join(" ");
    return `<polygon points="${points}" class="diagnosis-radar-grid" />`;
  }).join("");

  const axesMarkup = axisPoints.map((point) => `
    <line x1="${center}" y1="${center}" x2="${point.outerX}" y2="${point.outerY}" class="diagnosis-radar-axis" />
    ${renderRadarLabel(point)}
  `).join("");

  const scoreMarkup = axisPoints.map((point) => `
    <text x="${point.valueX}" y="${point.valueY + 3}" class="diagnosis-radar-value">${point.axis.score}</text>
  `).join("");

  const scorePoints = axisPoints.map((point) => `${point.scoreX},${point.scoreY}`).join(" ");

  els.diagnosisChart.innerHTML = `
    <svg viewBox="0 0 280 280" role="img" aria-label="출제 영역 진단 레이더 차트">
      ${grid}
      ${axesMarkup}
      <polygon points="${scorePoints}" class="diagnosis-radar-score" />
      ${scoreMarkup}
    </svg>
  `;
}

function simplifyRadarLabel(name) {
  return String(name || "-")
    .replace(/^Chapter\s*\d+\.\s*/i, "")
    .replace(/^챕터\s*\d+\.\s*/i, "")
    .trim();
}

function splitRadarLabel(name) {
  const label = simplifyRadarLabel(name);
  if (label.length <= 6) return [label];
  const words = label.split(/\s+/);
  if (words.length >= 2) {
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > 8 && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
    return lines;
  }
  return [label.slice(0, 6), label.slice(6, 12), label.slice(12)].filter(Boolean);
}

function renderRadarLabel(point) {
  const lines = splitRadarLabel(point.axis.name);
  const lineHeight = 10;
  const startY = point.labelY - ((lines.length - 1) * lineHeight) / 2;
  const tspans = lines.map((line, index) => (
    `<tspan x="${point.labelX}" y="${startY + index * lineHeight}">${line}</tspan>`
  )).join("");
  return `<text class="diagnosis-radar-label">${tspans}</text>`;
}

function renderDiagnosisBars(axes) {
  els.diagnosisBars.innerHTML = "";
  axes.forEach((axis) => {
    const criteria = getAxisCriteria(axis.name);
    const row = document.createElement("div");
    row.className = "diagnosis-bar";
    row.innerHTML = `
      <div class="diagnosis-bar-head">
        <strong>${axis.name}</strong>
        <span>* ${criteria.text}</span>
      </div>
      <div class="report-score-track" style="grid-template-columns:${criteria.basic}fr ${criteria.middle}fr ${criteria.high}fr">
        <span class="range basic">기초</span>
        <span class="range middle">중급</span>
        <span class="range high">상급</span>
        <i class="score-bubble" style="left:${axis.score}%">${axis.score}</i>
      </div>
      <div class="score-ticks">
        <span>0</span>
        <span style="left:${criteria.first}%">${criteria.first}</span>
        <span style="left:${criteria.second}%">${criteria.second}</span>
        <span>100</span>
      </div>
      <p>${axis.comment || buildAxisComment(axis)}</p>
    `;
    els.diagnosisBars.appendChild(row);
  });
}

function getAxisCriteria(name) {
  if (name.includes("실무")) {
    return {
      first: 30,
      second: 70,
      basic: 30,
      middle: 40,
      high: 30,
      text: "기준: ~30%, 중급: ~70%, 상급: 70% 이상"
    };
  }

  return {
    first: 70,
    second: 85,
    basic: 70,
    middle: 15,
    high: 15,
    text: "기준: ~70%, 중급: ~85%, 상급: 85% 이상"
  };
}

function normalizeDiagnosis(diagnosis, meta = {}) {
  const sourceAxes = diagnosis?.axes || [];
  if (sourceAxes.length === 0) {
    return {
      ...meta,
      axes: [],
      summary: diagnosis?.summary || ""
    };
  }

  const theorySource = sourceAxes.filter((axis) => axis.name.includes("이론"));
  const practicalSource = sourceAxes.filter((axis) => !axis.name.includes("이론"));
  const theory = mergeAxes("이론형 문항 종합 이해도", theorySource);
  const practical = mergeAxes("실무형 문항 종합 이해도", practicalSource);

  return {
    ...meta,
    score: meta.score ?? Math.round(sourceAxes.reduce((sum, axis) => sum + axis.score, 0) / sourceAxes.length),
    radarAxes: diagnosis?.radarAxes || [],
    axes: [
      { ...theory, comment: buildAxisComment(theory) },
      { ...practical, comment: buildAxisComment(practical) }
    ],
    summary: diagnosis?.summary || buildDiagnosisSummary([theory, practical])
  };
}

function buildLocalDiagnosis(result, questions, subject) {
  const buckets = [
    { name: "이론형 문항 종합 이해도", rows: [] },
    { name: "실무형 문항 종합 이해도", rows: [] }
  ];

  result.rows.forEach((row) => {
    const question = questions[row.index];
    const type = getQuestionType(question, row.index);
    const bucket = type === "이론형" ? buckets[0] : buckets[1];
    bucket.rows.push(row);
  });

  const axes = buckets.map((bucket) => {
    const total = bucket.rows.length;
    const correct = bucket.rows.filter((row) => row.correct).length;
    const score = total ? Math.round((correct / total) * 100) : 0;
    return {
      name: bucket.name,
      score,
      correct,
      total,
      comment: buildAxisComment({ name: bucket.name, score, correct, total })
    };
  });

  return {
    profileName: result.profileName || state.profileName,
    subjectName: subject.name,
    score: result.score,
    createdAt: result.createdAt || new Date().toISOString(),
    axes,
    summary: buildDiagnosisSummary(axes)
  };
}

function mergeAxes(name, axes) {
  const total = axes.reduce((sum, axis) => sum + (axis.total || 0), 0);
  const correct = axes.reduce((sum, axis) => sum + (axis.correct || 0), 0);
  return {
    name,
    total,
    correct,
    score: total ? Math.round((correct / total) * 100) : 0
  };
}

function getScoreLevel(score) {
  if (score >= 80) return { level: 5, name: "Expert" };
  if (score >= 70) return { level: 4, name: "Proficient" };
  if (score >= 60) return { level: 3, name: "Utilizer 2" };
  if (score >= 50) return { level: 2, name: "Utilizer 1" };
  if (score >= 30) return { level: 1, name: "Finder" };
  return { level: 0, name: "Beginner" };
}

function buildAxisComment(axis) {
  const domain = axis.name.includes("이론") ? "개념과 용어 이해" : "상황 판단과 적용";
  if (axis.total === 0) return `${domain} 문항 데이터가 없어 추가 응시 후 진단이 가능합니다.`;
  if (axis.score >= 80) return `${domain} 역량이 안정적입니다. 오답 문항의 세부 조건만 점검하면 고득점 유지가 가능합니다.`;
  if (axis.score >= 60) return `${domain}의 기본기는 갖추었습니다. 틀린 선택지의 근거를 비교하며 보완하면 좋습니다.`;
  return `${domain}에서 보완이 필요합니다. 해설을 기준으로 핵심 개념과 실제 적용 흐름을 다시 정리하세요.`;
}

function buildDiagnosisSummary(axes) {
  const strongest = axes.reduce((best, axis) => axis.score > best.score ? axis : best, axes[0]);
  const weakest = axes.reduce((low, axis) => axis.score < low.score ? axis : low, axes[0]);
  return `${strongest.name}는 ${strongest.score}점으로 상대적으로 강점입니다. ${weakest.name}는 ${weakest.score}점으로 우선 복습이 필요합니다. 오답 해설에서 틀린 선택지의 판단 근거를 다시 확인하세요.`;
}

let resultLoadingTimer = null;
let resultLoadingDoneTimer = null;
let resultLoadingProgress = 0;

function startResultLoading() {
  resultLoadingProgress = 0;
  if (els.resultContent) els.resultContent.style.visibility = "hidden";
  if (els.resultHero) els.resultHero.style.visibility = "hidden";
  if (els.resultLoading) els.resultLoading.style.display = "grid";
  if (els.resultLoadingBar) els.resultLoadingBar.style.width = "0%";
  clearInterval(resultLoadingTimer);
  clearTimeout(resultLoadingDoneTimer);
  resultLoadingTimer = setInterval(() => {
    const ceiling = resultLoadingProgress < 35 ? 35 : resultLoadingProgress < 72 ? 72 : 88;
    const step = resultLoadingProgress < 35 ? 7 : resultLoadingProgress < 72 ? 3 : 1;
    resultLoadingProgress = Math.min(ceiling, resultLoadingProgress + step);
    if (els.resultLoadingBar) els.resultLoadingBar.style.width = `${resultLoadingProgress}%`;
  }, 220);
}

function showResultContent() {
  clearInterval(resultLoadingTimer);
  clearTimeout(resultLoadingDoneTimer);
  resultLoadingTimer = null;
  if (els.resultLoadingBar) els.resultLoadingBar.style.width = "100%";
  resultLoadingDoneTimer = window.setTimeout(() => {
    if (els.resultLoading) els.resultLoading.style.display = "none";
    if (els.resultContent) els.resultContent.style.visibility = "visible";
    if (els.resultHero) els.resultHero.style.visibility = "visible";
  }, 180);
}

async function loadBackendResultPage() {
  if (!els.resultList || !els.resultScore || !els.resultSummary) return;

  const navigation = loadResultNavigation();
  const attemptId = navigation?.examId || null;
  const examHistoryIds = Array.isArray(navigation?.examHistoryIds) && navigation.examHistoryIds.length > 0
    ? navigation.examHistoryIds
    : [];

  startResultLoading();
  setResultScoreText("-");
  if (els.resultVerdict) {
    els.resultVerdict.textContent = "결과 없음";
    els.resultVerdict.className = "verdict-badge neutral";
  }
  els.resultSummary.textContent = "표시할 응시 결과가 없습니다.";
  if (els.resultCommentary) els.resultCommentary.textContent = "";
  if (els.resultCommentary) els.resultCommentary.style.display = "none";
  if (els.resultDiagnosis) els.resultDiagnosis.style.display = "none";
  if (els.wrongReviewSection) els.wrongReviewSection.style.display = "none";
  if (els.toggleAllExplanationsBtn) els.toggleAllExplanationsBtn.style.display = "none";
  if (els.saveWrongAllBtn) els.saveWrongAllBtn.style.display = "none";
  els.resultList.innerHTML = "";

  if (!attemptId) {
    renderResultEmptyState();
    return;
  }

  try {
    const historyQuery = examHistoryIds.length
      ? `?history_ids=${encodeURIComponent(examHistoryIds.join(","))}`
      : "";
    const url = `${API_BASE}/results/${attemptId}${historyQuery}`;
    const response = await fetch(url);
    if (response.status === 404) {
      renderResultEmptyState();
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    renderApiResultPage(result);
  } catch (error) {
    renderResultEmptyState({
      title: "결과를 불러오지 못했습니다",
      summary: "일시적인 연결 문제로 응시 결과를 확인하지 못했습니다.",
      detail: "잠시 후 다시 시도하거나 시험응시 화면에서 새 응시를 시작하세요."
    });
  }
}

function renderResultEmptyState({
  title = "표시할 응시 결과가 없습니다.",
  summary = "",
  detail = ""
} = {}) {
  latestApiResult = null;
  showResultContent();
  els.resultList.innerHTML = "";
  setResultScoreText("-");
  if (els.resultVerdict) {
    els.resultVerdict.textContent = "결과 없음";
    els.resultVerdict.className = "verdict-badge neutral";
  }
  els.resultSummary.textContent = title;
  if (els.resultCommentary) {
    els.resultCommentary.textContent = "";
    els.resultCommentary.style.display = "none";
  }
  if (els.resultDiagnosis) els.resultDiagnosis.style.display = "none";
  if (els.wrongReviewSection) els.wrongReviewSection.style.display = "none";
  if (els.saveWrongAllBtn) els.saveWrongAllBtn.style.display = "none";
  if (els.toggleAllExplanationsBtn) els.toggleAllExplanationsBtn.style.display = "none";
  renderResultHeroAction(true);
  updateToggleAllExplanationsButton();
}

function renderResultHeroAction(show) {
  if (!els.resultHero) return;
  els.resultHero.querySelector(".result-hero-actions")?.remove();
}

function renderResultPage() {
  if (!els.resultList || !els.resultScore || !els.resultSummary) return;

  const result = state.lastResult;
  latestApiResult = null;
  showResultContent();
  els.resultList.innerHTML = "";
  renderResultHeroAction(false);
  if (!result) {
    renderSaveWrongAllButton(null);
    updateToggleAllExplanationsButton();
    if (els.resultDiagnosis) els.resultDiagnosis.style.display = "none";
    if (els.wrongReviewSection) els.wrongReviewSection.style.display = "none";
    if (els.toggleAllExplanationsBtn) els.toggleAllExplanationsBtn.style.display = "none";
    setResultScoreText("-");
    if (els.resultVerdict) {
      els.resultVerdict.textContent = "결과 없음";
      els.resultVerdict.className = "verdict-badge neutral";
    }
    els.resultSummary.textContent = "아직 채점 결과가 없습니다.";
    if (els.resultCommentary) {
      els.resultCommentary.style.display = "none";
      els.resultCommentary.textContent = "";
    }
    return;
  }

  const subject = subjects.find((item) => item.id === result.subjectId) || currentSubject();
  const questions = getQuestionsForSubject(subject, result.total);
  const passed = result.score > 60;
  renderResultHeroAction(false);
  if (els.wrongReviewSection) els.wrongReviewSection.style.display = "";
  if (els.toggleAllExplanationsBtn) els.toggleAllExplanationsBtn.style.display = "inline-flex";
  setResultScoreText(`${result.score}점`);
  if (els.resultVerdict) {
    els.resultVerdict.textContent = passed ? "합격" : "불합격";
    els.resultVerdict.className = `verdict-badge ${passed ? "pass" : "fail"}`;
  }
  els.resultSummary.innerHTML = `${subject.name} ${result.total}문항 중 ${result.correctCount}문항을 맞혔습니다.<br>${passed ? "합격 기준을 통과했습니다." : "합격 기준인 60점을 넘지 못했습니다."}`;
  if (els.resultCommentary) {
    const commentary = buildResultCommentary(result.score);
    els.resultCommentary.style.display = commentary ? "" : "none";
    els.resultCommentary.textContent = commentary;
  }
  renderDiagnosis(buildLocalDiagnosis(result, questions, subject));
  renderSaveWrongAllButton(result);
  const meta = {
    attemptId: result.attemptId || "manual",
    roundTitle: result.roundTitle || "모의고사 결과",
    createdAt: result.createdAt || new Date().toISOString()
  };
  result.rows.forEach((row) => {
    appendResultItem(questions[row.index], row.index, row.selected, row.correct, meta);
  });
  updateToggleAllExplanationsButton();
}

function buildResultCommentary(score) {
  if (score >= 90) return "전체 개념 이해도가 매우 좋습니다. 실전에서는 시간 관리와 실수 방지에만 집중하면 안정적으로 고득점을 유지할 수 있습니다.";
  if (score >= 75) return "핵심 개념은 잘 잡혀 있습니다. 틀린 문항의 세부 조건과 용어 구분을 다시 확인하면 더 높은 점수를 기대할 수 있습니다.";
  if (score > 60) return "합격권에는 들어왔지만 아직 취약한 영역이 남아 있습니다. 오답 해설을 기준으로 헷갈린 개념을 짧게 정리해보세요.";
  if (score >= 40) return "기본 개념은 일부 파악했지만 안정적인 합격에는 부족합니다. 정답보다 오답 선택 이유를 먼저 확인하는 방식으로 복습하는 것이 좋습니다.";
  return "";
}

function initResultChat() {
  if (!els.chatToggleBtn || !els.chatPanel || !els.chatMessages || !els.chatForm || !els.chatInput) return;

  appendChatMessage("assistant", "결과에 대해 궁금한 점을 물어보세요. 점수, 합격 여부, 오답 복습 방향을 바로 정리해드릴게요.");

  els.chatToggleBtn.addEventListener("click", () => {
    const open = els.chatPanel.classList.toggle("open");
    els.chatToggleBtn.setAttribute("aria-expanded", String(open));
    if (open) els.chatInput.focus();
  });

  bindOptional(els.chatCloseBtn, "click", () => {
    els.chatPanel.classList.remove("open");
    els.chatToggleBtn.setAttribute("aria-expanded", "false");
  });

  els.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = els.chatInput.value.trim();
    if (!question) return;
    appendChatMessage("user", question);
    els.chatInput.value = "";
    setTimeout(() => {
      appendChatMessage("assistant", buildChatAnswer(question));
    }, 180);
  });
}

function appendChatMessage(role, message) {
  const bubble = document.createElement("div");
  bubble.className = `chat-message ${role}`;
  bubble.textContent = message;
  els.chatMessages.appendChild(bubble);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function buildChatAnswer(question) {
  const result = state.lastResult;
  if (!result) return "아직 채점 결과가 없어서 분석할 내용이 없습니다. 모의고사를 먼저 완료해 주세요.";

  const subject = subjects.find((item) => item.id === result.subjectId) || currentSubject();
  const questions = getQuestionsForSubject(subject, result.total);
  const wrongRows = result.rows.filter((row) => !row.correct);
  const wrongTopics = wrongRows.slice(0, 3).map((row) => `Q${row.index + 1}`).join(", ") || "없음";
  const normalized = question.toLowerCase();

  if (normalized.includes("합격") || normalized.includes("불합격") || normalized.includes("왜")) {
    return result.score > 60
      ? `${result.score}점이라 합격입니다. ${result.total}문항 중 ${result.correctCount}문항을 맞혔고, 남은 오답(${wrongTopics})만 복습하면 안정권으로 갈 수 있어요.`
      : `${result.score}점이라 불합격입니다. 기준은 60점 초과이고, 현재는 ${result.total}문항 중 ${result.correctCount}문항 정답입니다. 먼저 ${wrongTopics} 해설을 펼쳐서 오답 원인을 확인하세요.`;
  }

  if (normalized.includes("공부") || normalized.includes("복습") || normalized.includes("뭘") || normalized.includes("추천")) {
    const firstWrong = wrongRows[0];
    if (!firstWrong) return "이번 시험은 오답이 없습니다. 같은 과목을 문제 수를 늘려 다시 풀면서 속도와 안정성을 점검해보세요.";
    const wrongQuestion = questions[firstWrong.index];
    return `우선 ${subject.name}의 Q${firstWrong.index + 1}부터 복습하세요. 이 문제는 "${wrongQuestion.text}"이고, 핵심 해설은 "${wrongQuestion.explanation}"입니다. 비슷한 개념을 한 번 더 풀어보는 게 좋습니다.`;
  }

  if (normalized.includes("점수") || normalized.includes("몇")) {
    return `현재 점수는 ${result.score}점입니다. ${result.total}문항 중 ${result.correctCount}문항을 맞혔고, 정답률은 ${Math.round((result.correctCount / result.total) * 100)}%입니다.`;
  }

  if (normalized.includes("오답") || normalized.includes("틀린")) {
    return wrongRows.length
      ? `틀린 문제는 ${wrongTopics}입니다. 결과 목록에서 해당 문항을 클릭하면 해설이 아래로 펼쳐집니다.`
      : "틀린 문제가 없습니다. 좋은 결과예요. 다음에는 다른 과목이나 더 많은 문제 수로 확인해보세요.";
  }

  return `${subject.name} 결과 기준으로 보면 ${result.score}점입니다. 지금은 오답 문항(${wrongTopics}) 해설을 먼저 보고, 헷갈린 선택지가 왜 틀렸는지 비교하는 복습이 가장 효과적입니다.`;
}
