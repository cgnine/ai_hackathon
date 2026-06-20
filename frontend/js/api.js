function currentSubject() {
  return subjects.find((subject) => subject.id === state.subjectId) || subjects[0];
}

function currentQuestions() {
  const count = Number(state.questionCount) || 20;
  const usingApiQuestions = Array.isArray(state.activeQuestions) && state.activeQuestions.length > 0;
  const source = usingApiQuestions ? state.activeQuestions : [];
  if (source.length >= count) return source.slice(0, count);
  return source.slice();
}

function normalizeApiQuestion(item) {
  const scenario = item.question_text_extra || "";
  return {
    id: item.question_id,
    subjectCode: item.subject_code,
    majorUnit: item.major_unit || "문제",
    difficulty: item.major_unit || "문제",
    text: item.question_text,
    scenario,
    choices: item.choices || [],
    answer: Number(item.answer_number),
    explanation: item.explanation,
    questionType: String(scenario).trim() ? "실무형" : "이론형"
  };
}

async function loadSubjectQuestions(subject, count) {
  if (!subject?.subjectCode) {
    state.activeQuestions = [];
    saveState();
    return;
  }

  const response = await fetch(`${API_BASE}/quiz/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject_code: subject.subjectCode,
      count
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const data = await response.json();
  state.activeQuestions = (data.items || []).map(normalizeApiQuestion);
  saveState();
}

function buildSubjectFromApi(item) {
  return {
    id: String(item.subject_code).toLowerCase(),
    name: item.subject_name || item.subject_code,
    subjectCode: item.subject_code,
    desc: item.subject_description || `등록된 문제 ${item.question_count}문항`,
    questionCount: item.question_count,
    questions: []
  };
}

async function loadAvailableSubjects() {
  const response = await fetch(`${API_BASE}/quiz/subjects`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items.map(buildSubjectFromApi) : [];
  if (items.length > 0) {
    subjects = items;
  }
}

async function saveMockExamResult(subject, questions, answers) {
  const memberId = currentMemberId();
  if (!memberId) {
    throw new Error("로그인 정보가 없어 응시 결과를 저장할 수 없습니다.");
  }
  if (!subject?.subjectCode) {
    throw new Error("과목 정보가 없어 응시 결과를 저장할 수 없습니다.");
  }

  const response = await fetch(`${API_BASE}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      member_id: memberId,
      subject_code: subject.subjectCode,
      answers: questions.map((question, index) => ({
        question_id: question.id,
        selected_number: answers[index] || null
      }))
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (typeof clearAnalysisCache === "function") {
    clearAnalysisCache(memberId);
  }
  return data;
}

async function saveExamResultPayload(payload) {
  const response = await fetch(`${API_BASE}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (typeof clearAnalysisCache === "function") {
    clearAnalysisCache(payload.member_id);
  }
  return data;
}

async function generateResultCommentary(examId, examHistoryIds = []) {
  const historyQuery = Array.isArray(examHistoryIds) && examHistoryIds.length
    ? `?history_ids=${encodeURIComponent(examHistoryIds.join(","))}`
    : "";
  const response = await fetch(`${API_BASE}/results/${encodeURIComponent(examId)}/commentary${historyQuery}`, {
    method: "POST"
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${response.status}`);
  }

  return response.json();
}
