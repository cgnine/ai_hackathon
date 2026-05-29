function renderSingle() {
  const subject = currentSubject();
  const questions = currentQuestions();
  const question = questions[state.index];
  const answered = state.singleAnswers[state.index];

  els.singleSubject.textContent = subject.name;
  els.singleProgress.textContent = `${Object.keys(state.singleAnswers).length} / ${questions.length}`;
  els.singleQuestionNumber.textContent = `Q${state.index + 1}`;
  els.singleDifficulty.textContent = question.difficulty;
  els.singleQuestionText.textContent = question.text;
  els.singlePrevBtn.disabled = state.index === 0;
  els.singleNextBtn.disabled = state.index === questions.length - 1;
  renderChoices(els.singleChoices, question, answered, (choiceNumber) => {
    state.selected = choiceNumber;
    saveState();
    renderSingle();
  });
  renderSingleFeedback(question, answered);
  renderQuestionGrid(els.singleQuestionGrid, questions, state.singleAnswers, state.index, moveSingle);
}

function renderSingleFeedback(question, answered) {
  els.singleResultBadge.className = "result-badge";
  if (!answered) {
    els.singleResultBadge.textContent = "대기";
    els.singleFeedbackTitle.textContent = question.type === "coding" ? "코드를 입력하면 채점 힌트가 표시됩니다." : "답안을 선택하면 결과가 표시됩니다.";
    els.singleExplanation.textContent = question.type === "coding" ? "현재 화면에서는 브라우저 안에서 코드를 실행하지 않고, 핵심 구현 키워드 기반으로 간단히 확인합니다." : "정답 확인을 누르면 채점 결과와 해설을 볼 수 있습니다.";
    return;
  }

  if (question.type === "coding") {
    els.singleResultBadge.classList.add(answered.correct ? "correct" : "wrong");
    els.singleResultBadge.textContent = answered.correct ? "제출 확인" : "보완 필요";
    els.singleFeedbackTitle.textContent = answered.correct ? "핵심 구현 요소가 포함되어 있습니다." : "코드를 조금 더 보완해보세요.";
    els.singleExplanation.textContent = `${question.explanation}\n\n모범답안\n${question.sampleSolution}`;
  } else if (answered.correct) {
    els.singleResultBadge.classList.add("correct");
    els.singleResultBadge.textContent = "정답";
    els.singleFeedbackTitle.textContent = "맞았습니다.";
  } else {
    els.singleResultBadge.classList.add("wrong");
    els.singleResultBadge.textContent = "오답";
    els.singleFeedbackTitle.textContent = `선택 ${answered.selected}번 · 정답 ${question.answer}번`;
  }
  els.singleExplanation.textContent = question.explanation;
}

function submitSingle() {
  if (!state.selected) {
    els.singleFeedbackTitle.textContent = "먼저 답안을 선택하세요.";
    els.singleExplanation.textContent = "보기 또는 코드 답안을 입력한 다음 정답 확인을 누르면 바로 확인합니다.";
    return;
  }

  const question = currentQuestions()[state.index];
  const correct = question.type === "coding" ? evaluateCodingAnswer(question, state.selected) : state.selected === question.answer;
  state.singleAnswers[state.index] = { selected: state.selected, correct };
  if (!correct) addWrongNote(state.index, false);
  saveState();
  renderTopStats();
  renderSingle();
}

function moveSingle(index) {
  state.index = Math.max(0, Math.min(index, currentQuestions().length - 1));
  state.selected = state.singleAnswers[state.index]?.selected || null;
  saveState();
  renderSingle();
}

function renderMock() {
  const subject = currentSubject();
  const questions = currentQuestions();

  els.mockSubject.textContent = subject.name;
  els.mockProgress.textContent = `${Object.keys(state.mockAnswers).length} / ${questions.length}`;
  if (!els.mockQuestionList) return;

  els.mockQuestionList.innerHTML = "";
  if (questions.length === 0) {
    const empty = document.createElement("article");
    empty.className = "question-panel mock-question-panel";
    empty.textContent = "표시할 DB 문제가 없습니다. 백엔드와 DB 데이터를 확인하세요.";
    els.mockQuestionList.appendChild(empty);
    renderMockProgress();
    return;
  }
  questions.forEach((question, index) => {
    const panel = document.createElement("article");
    const head = document.createElement("div");
    const number = document.createElement("span");
    const tags = document.createElement("div");
    const difficulty = document.createElement("span");
    const type = document.createElement("span");
    const scenario = document.createElement("div");
    const text = document.createElement("p");
    const choices = document.createElement("ol");
    const scenarioText = String(question.scenario || "").trim();

    panel.className = "question-panel mock-question-panel";
    panel.id = `mock-question-${index + 1}`;
    head.className = "question-head";
    number.className = "question-number";
    number.textContent = `${index + 1}.`;
    tags.className = "question-tags";
    difficulty.className = "pill";
    difficulty.textContent = question.difficulty;
    type.className = "pill type-pill";
    type.textContent = getQuestionType(question, index);
    scenario.className = "question-scenario-box mock-scenario-box";
    scenario.hidden = !scenarioText;
    scenario.textContent = scenarioText;
    text.className = "question-text";
    text.textContent = question.text;
    choices.className = "choices";

    tags.append(difficulty, type);
    head.append(number, tags);
    panel.append(head);
    panel.appendChild(text);
    if (scenarioText) panel.appendChild(scenario);
    panel.appendChild(choices);
    renderChoices(choices, question, null, (choiceNumber) => {
      state.mockAnswers[index] = choiceNumber;
      state.selected = choiceNumber;
      state.index = index;
      saveState();
      renderTopStats();
      renderMockProgress();
    }, state.mockAnswers[index]);
    els.mockQuestionList.appendChild(panel);
  });

  renderMockProgress();
}

function moveMock(index) {
  state.index = Math.max(0, Math.min(index, currentQuestions().length - 1));
  state.selected = state.mockAnswers[state.index] || null;
  saveState();
  document.getElementById(`mock-question-${state.index + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  renderMockProgress();
}

function renderMockProgress() {
  const questions = currentQuestions();
  if (els.mockProgress) els.mockProgress.textContent = `${Object.keys(state.mockAnswers).length} / ${questions.length}`;
  renderQuestionGrid(els.mockQuestionGrid, questions, state.mockAnswers, state.index, moveMock);
}

async function gradeMock() {
  const questions = currentQuestions();
  if (questions.length === 0) {
    showToast("채점할 DB 문제가 없습니다.");
    return;
  }
  let correctCount = 0;
  const resultRows = [];
  const subject = currentSubject();
  const subjectAttemptCount = (state.attemptHistory || []).filter((attempt) => attempt.subjectId === state.subjectId).length;
  let attemptId = `${Date.now()}-${state.subjectId}`;
  let roundTitle = `${subjectAttemptCount + 1}회차`;
  const createdAt = new Date().toISOString();
  if (els.resultList) els.resultList.innerHTML = "";

  questions.forEach((question, index) => {
    const selected = state.mockAnswers[index];
    const correct = question.type === "coding" ? evaluateCodingAnswer(question, selected) : selected === question.answer;
    if (correct) correctCount += 1;
    resultRows.push({ index, selected, correct });
  });

  const score = Math.round((correctCount / questions.length) * 100);
  let savedResult;
  try {
    savedResult = await saveMockExamResult(subject, questions, state.mockAnswers);
    attemptId = savedResult.attemptId || attemptId;
    roundTitle = savedResult.roundTitle || roundTitle;
    showToast("응시 결과를 저장했습니다.");
  } catch (error) {
    showToast(`응시 결과 저장에 실패했습니다. (${error.message})`);
    return;
  }

  state.lastResult = {
    attemptId,
    profileName: state.profileName,
    subjectId: state.subjectId,
    subjectName: subject.name,
    roundTitle,
    correctCount,
    total: questions.length,
    score,
    rows: resultRows,
    createdAt
  };
  state.attemptHistory.push({
    id: attemptId,
    profileName: state.profileName,
    subjectId: state.subjectId,
    subjectName: subject.name,
    roundTitle,
    score,
    correctCount,
    total: questions.length,
    rows: resultRows,
    createdAt
  });
  saveState();
  renderResultPage();
  renderTopStats();
  window.location.href = `${PAGE_URLS.result}?attemptId=${encodeURIComponent(attemptId)}`;
}
