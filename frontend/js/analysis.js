function getQuestionsForSubject(subject, count) {
  const source = subject.id === state.subjectId && Array.isArray(state.activeQuestions) && state.activeQuestions.length
    ? state.activeQuestions
    : [];
  if (source.length >= count) return source.slice(0, count);
  return source.slice();
}

function currentProfileAttempts() {
  return (state.attemptHistory || []).filter((attempt) => attempt.profileName === state.profileName);
}

function latestSubjectScores() {
  const attempts = currentProfileAttempts();
  return subjects.map((subject) => {
    const subjectAttempts = attempts.filter((attempt) => attempt.subjectId === subject.id);
    const latest = subjectAttempts[subjectAttempts.length - 1];
    return {
      subject,
      score: latest ? latest.score : 0,
      attempts: subjectAttempts.length,
      correct: subjectAttempts.reduce((sum, attempt) => sum + attempt.correctCount, 0),
      total: subjectAttempts.reduce((sum, attempt) => sum + attempt.total, 0)
    };
  });
}

function renderAnalysisPage() {
  if (!els.radarChart || !els.subjectBars || !els.analysisText || !els.skillMetrics || !els.recommendationCard) return;

  const scores = latestSubjectScores();
  const attempts = currentProfileAttempts();
  const answeredTotal = attempts.reduce((sum, attempt) => sum + attempt.total, 0);
  const correctTotal = attempts.reduce((sum, attempt) => sum + attempt.correctCount, 0);
  const avgScore = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : 0;
  const best = scores.reduce((top, item) => item.score > top.score ? item : top, scores[0]);
  const weak = scores.reduce((low, item) => item.score < low.score ? item : low, scores[0]);

  if (els.analysisName) els.analysisName.textContent = `${state.profileName || profiles[0]}님의 학습 분석`;
  renderRadar(scores);
  renderSubjectBars(scores);
  renderSkillMetrics({ avgScore, answeredTotal, correctTotal, attempts: attempts.length });
  renderAnalysisText({ attempts, avgScore, best, weak });
  renderRecommendation(scores);
}

function renderRadar(scores) {
  const center = 120;
  const maxRadius = 92;
  const points = scores.map((item, index) => {
    const angle = (-90 + index * 90) * Math.PI / 180;
    const radius = maxRadius * (item.score / 100);
    return [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius];
  });
  const axis = scores.map((item, index) => {
    const angle = (-90 + index * 90) * Math.PI / 180;
    const x = center + Math.cos(angle) * maxRadius;
    const y = center + Math.sin(angle) * maxRadius;
    const labelX = center + Math.cos(angle) * (maxRadius + 22);
    const labelY = center + Math.sin(angle) * (maxRadius + 22);
    return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" class="radar-axis" /><text x="${labelX}" y="${labelY}" class="radar-label">${item.subject.name}</text>`;
  }).join("");
  els.radarChart.innerHTML = `
    <svg viewBox="0 0 240 240" role="img" aria-label="과목별 실력 사각형 차트">
      <polygon points="120,28 212,120 120,212 28,120" class="radar-grid" />
      <polygon points="120,58 182,120 120,182 58,120" class="radar-grid inner" />
      ${axis}
      <polygon points="${points.map(([x, y]) => `${x},${y}`).join(" ")}" class="radar-score" />
    </svg>
  `;
}

function renderSubjectBars(scores) {
  els.subjectBars.innerHTML = "";
  scores.forEach((item) => {
    const row = document.createElement("div");
    row.className = "subject-bar";
    row.innerHTML = `
      <div class="subject-bar-head"><strong>${item.subject.name}</strong><span>${item.score}점</span></div>
      <div class="bar-track"><span style="width:${item.score}%"></span></div>
    `;
    els.subjectBars.appendChild(row);
  });
}

function renderSkillMetrics({ avgScore, answeredTotal, correctTotal, attempts }) {
  const accuracy = answeredTotal ? Math.round((correctTotal / answeredTotal) * 100) : 0;
  els.skillMetrics.innerHTML = `
    <div class="metric"><span>평균 점수</span><strong>${avgScore}점</strong></div>
    <div class="metric"><span>정답률</span><strong>${accuracy}%</strong></div>
    <div class="metric"><span>풀이 횟수</span><strong>${attempts}회</strong></div>
  `;
}

function renderAnalysisText({ attempts, avgScore, best, weak }) {
  if (attempts.length === 0) {
    els.analysisText.innerHTML = "<p>아직 풀이 기록이 없습니다. 과목을 선택해 모의고사를 한 번 완료하면 분석이 생성됩니다.</p>";
    return;
  }
  els.analysisText.innerHTML = `
    <p>최근 기록 기준 평균 점수는 ${avgScore}점입니다. ${avgScore > 60 ? "합격권에 진입했지만 과목별 편차를 줄이면 더 안정적입니다." : "아직 합격권까지 보완이 필요합니다."}</p>
    <p>가장 강한 과목은 ${best.subject.name}(${best.score}점)입니다. 이 과목의 풀이 감각은 유지하면서 속도와 정확도를 함께 관리하세요.</p>
    <p>보완이 필요한 과목은 ${weak.subject.name}(${weak.score}점)입니다. 오답 해설에서 반복되는 개념을 짧게 정리하는 복습이 좋습니다.</p>
    <p>전체적으로 정답률을 끌어올리려면 틀린 문제의 선택지까지 비교하며 복습하는 방식이 효과적입니다.</p>
  `;
}

function renderRecommendation(scores) {
  if (currentProfileAttempts().length === 0) {
    els.recommendationCard.innerHTML = "<p class=\"item-sub\">아직 추천 문제를 만들 풀이 기록이 없습니다. 모의고사를 한 번 완료하면 자주 틀린 과목 기준으로 추천 문제가 표시됩니다.</p>";
    return;
  }

  const wrongCounts = scores.map((item) => {
    const wrongCount = currentProfileAttempts()
      .filter((attempt) => attempt.subjectId === item.subject.id)
      .reduce((sum, attempt) => sum + attempt.rows.filter((row) => !row.correct).length, 0);
    return { ...item, wrongCount };
  });
  const weak = wrongCounts.reduce((top, item) => item.wrongCount > top.wrongCount ? item : top, wrongCounts[0]);
  const attempts = currentProfileAttempts().filter((attempt) => attempt.subjectId === weak.subject.id);
  const wrongRows = attempts.flatMap((attempt) => attempt.rows.filter((row) => !row.correct));
  const latestWrong = wrongRows[wrongRows.length - 1];
  const sourceIndex = latestWrong?.index || 0;
  const question = getQuestionsForSubject(weak.subject, Math.max(state.questionCount || 20, sourceIndex + 1))[sourceIndex];

  state.recommendationAnswer = null;
  els.recommendationCard.innerHTML = "";
  const title = document.createElement("h3");
  const body = document.createElement("p");
  const choices = document.createElement("ol");
  const feedback = document.createElement("div");

  title.textContent = `추천 문제 · ${weak.subject.name}`;
  body.className = "recommend-question";
  body.textContent = question.text;
  choices.className = "choices recommendation-choices";
  feedback.className = "recommend-feedback";

  question.choices.forEach((choice, index) => {
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
      feedback.className = `recommend-feedback ${correct ? "correct" : "wrong"}`;
      feedback.textContent = `${correct ? "정답입니다." : `오답입니다. 정답은 ${question.answer}번입니다.`} ${question.explanation}`;
    });
    li.appendChild(button);
    choices.appendChild(li);
  });

  els.recommendationCard.append(title, body, choices, feedback);
}
