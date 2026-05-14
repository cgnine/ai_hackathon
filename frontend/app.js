const API_BASE = "";

function makeQuestions(rows) {
  return rows.map(([difficulty, text, choices, answer, explanation]) => ({
    difficulty,
    text,
    choices,
    answer,
    explanation
  }));
}

function makeCodingQuestions(rows) {
  return rows.map(([difficulty, text, sampleSolution, keywords, explanation]) => ({
    type: "coding",
    difficulty,
    text,
    sampleSolution,
    keywords,
    explanation
  }));
}

const subjects = [
  {
    id: "ai-engineering",
    name: "AI Engineering",
    desc: "LLM, RAG, 프롬프트, 평가, MLOps, 안전성",
    questions: makeQuestions([
      ["중", "RAG 시스템에서 검색 단계의 주된 목적은 무엇인가요?", ["모델 파라미터를 수정한다", "관련 근거 문서를 제공한다", "GPU 온도를 제어한다", "CSS를 최적화한다"], 2, "RAG는 검색된 근거를 생성 입력에 포함해 최신성과 정확도를 높입니다."],
      ["중", "LLM 출력을 JSON 스키마로 검증해야 하는 이유는 무엇인가요?", ["속도만 높이기 위해", "구조화된 출력과 후처리 안정성을 확보하기 위해", "프롬프트를 제거하기 위해", "로그를 없애기 위해"], 2, "스키마 검증은 불완전한 모델 응답이 시스템에 그대로 들어가는 것을 막습니다."],
      ["상", "LLM-as-Judge 운영에서 중요한 원칙은 무엇인가요?", ["항상 정답으로 처리한다", "평가 기준과 샘플을 고정하고 결과를 모니터링한다", "규칙 검증을 모두 제거한다", "점수만 저장한다"], 2, "Judge도 모델이므로 명확한 기준, 샘플 검증, 로그 추적과 함께 사용해야 합니다."],
      ["중", "Bedrock 호출 실패 시 적절한 복구 전략은 무엇인가요?", ["무한 재시도한다", "제한된 횟수만 재시도하고 실패 로그를 남긴다", "성공으로 처리한다", "검증을 건너뛴다"], 2, "무한 재시도는 비용과 장애를 키우므로 제한된 복구와 명확한 실패 처리가 필요합니다."]
    ])
  },
  {
    id: "cloud-developer",
    name: "Cloud for Developer",
    desc: "개발자를 위한 클라우드 배포, API, 컨테이너, 운영",
    questions: makeQuestions([
      ["중", "Docker 이미지를 사용하는 주된 이유는 무엇인가요?", ["실행 환경을 일관되게 배포하기 위해", "코드를 자동 작성하기 위해", "DB 정규화를 생략하기 위해", "모니터 밝기를 높이기 위해"], 1, "컨테이너 이미지는 애플리케이션과 의존성을 묶어 환경 차이를 줄입니다."],
      ["하", "REST API에서 404 상태 코드는 일반적으로 무엇을 의미하나요?", ["리소스를 찾을 수 없음", "요청 성공", "서버 내부 오류", "인증 필요"], 1, "404는 요청한 리소스가 존재하지 않거나 찾을 수 없음을 뜻합니다."],
      ["중", "API 호출에서 idempotency가 중요한 이유는 무엇인가요?", ["재시도 시 중복 처리를 줄이기 위해", "응답을 느리게 하기 위해", "모든 요청을 실패시키기 위해", "프론트 색상을 바꾸기 위해"], 1, "멱등성은 같은 요청이 여러 번 수행되어도 결과가 중복 생성되지 않게 합니다."],
      ["상", "운영 로그에 correlation id를 남기는 이유는 무엇인가요?", ["같은 요청 흐름을 여러 로그에서 추적하기 위해", "CSS 선택자를 줄이기 위해", "이미지 해상도를 높이기 위해", "DB 정규화를 자동화하기 위해"], 1, "상관 ID는 분산된 로그 사이에서 하나의 요청 경로를 추적하게 해줍니다."]
    ])
  },
  {
    id: "cloud-architecture",
    name: "Cloud for Architecture",
    desc: "아키텍처 설계, 가용성, 네트워크, 보안, 비용",
    questions: makeQuestions([
      ["중", "고가용성 설계의 핵심 목표는 무엇인가요?", ["장애 시에도 서비스를 지속한다", "서버 수를 항상 1대로 유지한다", "로그를 제거한다", "사용자 입력을 금지한다"], 1, "중요 구성요소 장애에도 서비스가 계속 동작하도록 설계하는 것이 핵심입니다."],
      ["중", "VPC의 주된 역할은 무엇인가요?", ["격리된 가상 네트워크 제공", "코드 자동 생성", "데이터 모델 학습", "PDF 추출"], 1, "VPC는 클라우드 리소스를 논리적으로 격리된 네트워크 안에 배치합니다."],
      ["중", "RPO는 무엇을 나타내나요?", ["허용 가능한 데이터 손실 시간", "복구 서버 수", "요청 처리 속도", "암호 길이"], 1, "RPO는 장애 시점에서 어느 정도 과거 데이터 손실까지 허용하는지 나타냅니다."],
      ["상", "SPOF를 줄이는 방법으로 적절한 것은 무엇인가요?", ["중요 구성 요소를 이중화한다", "모든 트래픽을 한 서버에 고정한다", "백업을 제거한다", "모니터링을 중지한다"], 1, "이중화와 분산 배치는 하나의 구성 요소 장애가 전체 장애가 되는 것을 줄입니다."]
    ])
  },
  {
    id: "software-engineering",
    name: "소프트웨어공학",
    desc: "요구사항, 설계, 테스트, 형상관리, 유지보수",
    questions: makeQuestions([
      ["중", "소프트웨어 개발 생명주기(SDLC)의 주요 목적은 무엇인가요?", ["개발 과정을 체계적으로 관리하기 위해", "코드를 무조건 짧게 만들기 위해", "테스트를 생략하기 위해", "사용자 요구를 숨기기 위해"], 1, "SDLC는 요구사항 분석부터 설계, 구현, 테스트, 배포, 유지보수까지 개발 과정을 체계적으로 관리합니다."],
      ["중", "요구사항 분석 단계에서 가장 중요한 활동은 무엇인가요?", ["사용자와 이해관계자의 필요를 명확히 파악한다", "서버 사양만 먼저 결정한다", "코드를 바로 배포한다", "테스트 결과를 삭제한다"], 1, "요구사항이 명확해야 설계와 구현이 실제 문제 해결 방향에 맞게 진행됩니다."],
      ["상", "응집도는 높고 결합도는 낮게 설계하는 이유는 무엇인가요?", ["변경과 유지보수를 쉽게 하기 위해", "모든 기능을 한 파일에 넣기 위해", "테스트를 어렵게 만들기 위해", "문서 작성을 금지하기 위해"], 1, "높은 응집도와 낮은 결합도는 모듈의 책임을 명확히 하고 변경 영향 범위를 줄입니다."],
      ["중", "회귀 테스트의 목적은 무엇인가요?", ["변경 후 기존 기능이 깨지지 않았는지 확인한다", "새 기능만 수동으로 설명한다", "빌드 시간을 무조건 늘린다", "요구사항을 삭제한다"], 1, "회귀 테스트는 수정이나 추가 작업 이후 기존 기능의 정상 동작을 확인합니다."]
    ])
  }
];

const profiles = [
  "김우찬",
  "김현수",
  "윤정하",
  "이상미"
];

const PAGE_URLS = {
  profile: "index.html",
  subjects: "subjects.html",
  mock: "mock.html",
  result: "result.html",
  analysis: "analysis.html",
  wrong: "wrong.html",
  harness: "harness.html"
};

const STATE_KEY = "kbCbtState";

const defaultState = {
  screen: "profile",
  profileName: "",
  questionCount: 20,
  subjectId: null,
  mode: null,
  index: 0,
  selected: null,
  singleAnswers: {},
  mockAnswers: {},
  wrongNotes: new Map(),
  lastResult: null,
  attemptHistory: [],
  recommendationAnswer: null
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    return {
      ...defaultState,
      ...saved,
      singleAnswers: saved.singleAnswers || {},
      mockAnswers: saved.mockAnswers || {},
      wrongNotes: new Map(saved.wrongNotes || []),
      lastResult: saved.lastResult || null,
      attemptHistory: saved.attemptHistory || [],
      recommendationAnswer: saved.recommendationAnswer || null
    };
  } catch {
    return { ...defaultState, wrongNotes: new Map() };
  }
}

const state = loadState();

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify({
    ...state,
    wrongNotes: Array.from(state.wrongNotes.entries())
  }));
}

const $ = (id) => document.getElementById(id);

const els = {
  screens: document.querySelectorAll(".screen"),
  navBtns: document.querySelectorAll(".nav-btn"),
  profileSearch: $("profileSearch"),
  profileSelect: $("profileSelect"),
  profileOptions: $("profileOptions"),
  profileSelectBox: $("profileSelectBox"),
  questionCountInput: $("questionCountInput"),
  startPracticeBtn: $("startPracticeBtn"),
  profileSummary: $("profileSummary"),
  subjectGrid: $("subjectGrid"),
  selectedSubjectEyebrow: $("selectedSubjectEyebrow"),
  selectedSubjectTitle: $("selectedSubjectTitle"),
  startMockBtn: $("startMockBtn"),
  singleSubject: $("singleSubject"),
  singleProgress: $("singleProgress"),
  singleQuestionGrid: $("singleQuestionGrid"),
  singleQuestionNumber: $("singleQuestionNumber"),
  singleDifficulty: $("singleDifficulty"),
  singleQuestionText: $("singleQuestionText"),
  singleChoices: $("singleChoices"),
  singleSubmitBtn: $("singleSubmitBtn"),
  singleWrongBtn: $("singleWrongBtn"),
  singlePrevBtn: $("singlePrevBtn"),
  singleNextBtn: $("singleNextBtn"),
  singleResultBadge: $("singleResultBadge"),
  singleFeedbackTitle: $("singleFeedbackTitle"),
  singleExplanation: $("singleExplanation"),
  mockSubject: $("mockSubject"),
  mockProgress: $("mockProgress"),
  mockQuestionGrid: $("mockQuestionGrid"),
  mockQuestionNumber: $("mockQuestionNumber"),
  mockDifficulty: $("mockDifficulty"),
  mockQuestionType: $("mockQuestionType"),
  mockQuestionText: $("mockQuestionText"),
  mockChoices: $("mockChoices"),
  mockPrevBtn: $("mockPrevBtn"),
  mockNextBtn: $("mockNextBtn"),
  gradeMockBtn: $("gradeMockBtn"),
  resultScore: $("resultScore"),
  resultVerdict: $("resultVerdict"),
  resultSummary: $("resultSummary"),
  resultCommentary: $("resultCommentary"),
  resultList: $("resultList"),
  chatToggleBtn: $("chatToggleBtn"),
  chatCloseBtn: $("chatCloseBtn"),
  chatPanel: $("chatPanel"),
  chatMessages: $("chatMessages"),
  chatForm: $("chatForm"),
  chatInput: $("chatInput"),
  analysisName: $("analysisName"),
  radarChart: $("radarChart"),
  subjectBars: $("subjectBars"),
  analysisText: $("analysisText"),
  skillMetrics: $("skillMetrics"),
  recommendationCard: $("recommendationCard"),
  wrongList: $("wrongList"),
  wrongTopCount: $("wrongTopCount"),
  todayCount: $("todayCount"),
  homeLink: $("homeLink"),
  toast: $("toast"),
  generateBtn: $("generateBtn"),
  loading: $("loading"),
  apiResult: $("apiResult")
};

function currentSubject() {
  return subjects.find((subject) => subject.id === state.subjectId) || subjects[0];
}

function currentQuestions() {
  const count = Number(state.questionCount) || 20;
  const source = currentSubject().questions;
  if (source.length >= count) return source.slice(0, count);
  return Array.from({ length: count }, (_, index) => source[index % source.length]);
}

function getQuestionType(question, index) {
  if (question.questionType) return question.questionType;
  const types = ["자격증연계형", "실무형", "이론형"];
  return types[index % types.length];
}

function showScreen(name) {
  state.screen = name;
  saveState();
  const targetScreen = $(`${name}Screen`);
  if (!targetScreen && PAGE_URLS[name]) {
    window.location.href = PAGE_URLS[name];
    return;
  }
  els.screens.forEach((screen) => screen.classList.toggle("active", screen.id === `${name}Screen`));
  els.navBtns.forEach((button) => button.classList.toggle("active", button.dataset.screen === name));
  if (name === "wrong") renderWrongNotes();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderProfileButton() {
  const topbar = document.querySelector(".topbar");
  const stats = document.querySelector(".top-stats");
  if (!topbar || document.getElementById("profileButton")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "profile-button";
  button.id = "profileButton";
  button.textContent = state.profileName || profiles[0];
  button.addEventListener("click", () => showScreen("analysis"));
  topbar.insertBefore(button, stats || null);
}

function renderProfileOptions(filter = "") {
  if (!els.profileSelect || !els.profileOptions) return;

  const normalized = filter.trim().toLowerCase();
  const matches = profiles.filter((name) => name.toLowerCase().includes(normalized));

  els.profileSelect.innerHTML = "";
  profiles.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === state.profileName;
    els.profileSelect.appendChild(option);
  });

  els.profileOptions.innerHTML = "";
  matches.forEach((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "select-option";
    button.textContent = name;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", name === state.profileName ? "true" : "false");
    button.addEventListener("click", () => selectProfile(name));
    els.profileOptions.appendChild(button);
  });

  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "select-empty";
    empty.textContent = "검색 결과가 없습니다.";
    els.profileOptions.appendChild(empty);
  }
}

function selectProfile(name) {
  state.profileName = name;
  if (els.profileSearch) els.profileSearch.value = name;
  if (els.profileSelect) els.profileSelect.value = name;
  if (els.profileOptions) els.profileOptions.classList.remove("open");
  if (els.profileSearch) els.profileSearch.setAttribute("aria-expanded", "false");
  saveState();
}

function initProfilePage() {
  const initialProfile = profiles.includes(state.profileName) ? state.profileName : profiles[0];
  state.profileName = initialProfile;
  if (!state.questionCount) state.questionCount = 20;
  if (els.profileSearch) els.profileSearch.value = initialProfile;
  renderProfileOptions();
  saveState();
}

function startPractice() {
  const typedName = (els.profileSearch?.value || "").trim();
  const selectedName = profiles.includes(typedName) ? typedName : state.profileName || profiles[0];

  state.profileName = selectedName;
  state.subjectId = null;
  state.index = 0;
  state.selected = null;
  state.singleAnswers = {};
  state.mockAnswers = {};
  state.lastResult = null;
  saveState();
  showScreen("subjects");
}

function renderSubjects() {
  if (!els.subjectGrid) return;
  els.subjectGrid.innerHTML = "";
  if (!state.questionCount) state.questionCount = 20;
  if (els.questionCountInput) els.questionCountInput.value = state.questionCount;
  if (els.profileSummary) {
    els.profileSummary.textContent = `${state.profileName || "응시자"} · 문제 수 선택`;
  }
  subjects.forEach((subject) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "subject-card";
    const availableCount = Number(state.questionCount) || 20;
    card.innerHTML = `
      <span class="subject-meta">${availableCount}문항</span>
      <strong>${subject.name}</strong>
      <small>${subject.desc}</small>
    `;
    card.addEventListener("click", () => selectSubject(subject.id));
    els.subjectGrid.appendChild(card);
  });
}

function selectSubject(subjectId) {
  const parsedCount = Number.parseInt(els.questionCountInput?.value || state.questionCount || "20", 10);
  state.questionCount = Number.isFinite(parsedCount) ? Math.max(1, Math.min(parsedCount, 100)) : 20;
  if (els.questionCountInput) els.questionCountInput.value = state.questionCount;
  state.subjectId = subjectId;
  state.index = 0;
  state.selected = null;
  state.singleAnswers = {};
  state.mockAnswers = {};
  const subject = currentSubject();
  if (els.selectedSubjectEyebrow) els.selectedSubjectEyebrow.textContent = "Selected Subject";
  if (els.selectedSubjectTitle) els.selectedSubjectTitle.textContent = subject.name;
  saveState();
  startMock();
}

function startMock() {
  state.mode = "mock";
  state.index = 0;
  state.selected = state.mockAnswers[0] || null;
  saveState();
  if (!els.mockSubject) {
    showScreen("mock");
    return;
  }
  renderMock();
  showScreen("mock");
}

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
  const question = questions[state.index];
  const answered = state.mockAnswers[state.index];

  els.mockSubject.textContent = subject.name;
  els.mockProgress.textContent = `${Object.keys(state.mockAnswers).length} / ${questions.length}`;
  els.mockQuestionNumber.textContent = `Q${state.index + 1}`;
  els.mockDifficulty.textContent = question.difficulty;
  if (els.mockQuestionType) els.mockQuestionType.textContent = getQuestionType(question, state.index);
  els.mockQuestionText.textContent = question.text;
  els.mockPrevBtn.disabled = state.index === 0;
  els.mockNextBtn.disabled = state.index === questions.length - 1;
  renderChoices(els.mockChoices, question, null, (choiceNumber) => {
    state.mockAnswers[state.index] = choiceNumber;
    state.selected = choiceNumber;
    saveState();
    renderTopStats();
    renderMock();
  }, answered);
  renderQuestionGrid(els.mockQuestionGrid, questions, state.mockAnswers, state.index, moveMock);
}

function moveMock(index) {
  state.index = Math.max(0, Math.min(index, currentQuestions().length - 1));
  state.selected = state.mockAnswers[state.index] || null;
  saveState();
  renderMock();
}

function gradeMock() {
  const questions = currentQuestions();
  let correctCount = 0;
  const resultRows = [];
  if (els.resultList) els.resultList.innerHTML = "";

  questions.forEach((question, index) => {
    const selected = state.mockAnswers[index];
    const correct = question.type === "coding" ? evaluateCodingAnswer(question, selected) : selected === question.answer;
    if (correct) correctCount += 1;
    if (!correct) addWrongNote(index, false);
    resultRows.push({ index, selected, correct });

    appendResultItem(question, index, selected, correct);
  });

  const score = Math.round((correctCount / questions.length) * 100);
  state.lastResult = {
    profileName: state.profileName,
    subjectId: state.subjectId,
    correctCount,
    total: questions.length,
    score,
    rows: resultRows
  };
  state.attemptHistory.push({
    id: `${Date.now()}-${state.subjectId}`,
    profileName: state.profileName,
    subjectId: state.subjectId,
    subjectName: currentSubject().name,
    score,
    correctCount,
    total: questions.length,
    rows: resultRows,
    createdAt: new Date().toISOString()
  });
  saveState();
  renderResultPage();
  renderTopStats();
  showScreen("result");
}

function appendResultItem(question, index, selected, correct) {
  if (!els.resultList) return;

  const item = document.createElement("article");
  const toggle = document.createElement("button");
  const status = document.createElement("span");
  const body = document.createElement("div");
  const title = document.createElement("div");
  const sub = document.createElement("div");
  const result = document.createElement("strong");
  const explanation = document.createElement("div");

  item.className = "result-item";
  toggle.type = "button";
  toggle.className = "result-toggle";
  toggle.setAttribute("aria-expanded", "false");
  status.className = `status-dot ${correct ? "" : "wrong"}`;
  status.textContent = correct ? "O" : "X";
  title.className = "item-title";
  title.textContent = `Q${index + 1}. ${question.text}`;
  sub.className = "item-sub";
  sub.textContent = question.type === "coding"
    ? `${question.difficulty} · ${getQuestionType(question, index)} · 제출 ${selected ? "완료" : "없음"}`
    : `${question.difficulty} · ${getQuestionType(question, index)} · 선택 ${selected || "-"}번 · 정답 ${question.answer}번`;
  result.textContent = correct ? "정답" : "오답";
  explanation.className = "result-explanation";
  explanation.textContent = question.type === "coding"
    ? `${question.explanation}\n\n모범답안\n${question.sampleSolution}`
    : question.explanation;
  body.append(title, sub);
  toggle.append(status, body, result);
  toggle.addEventListener("click", () => {
    const isOpen = item.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
  item.append(toggle, explanation);
  els.resultList.appendChild(item);
}

function renderResultPage() {
  if (!els.resultList || !els.resultScore || !els.resultSummary) return;

  const result = state.lastResult;
  els.resultList.innerHTML = "";
  if (!result) {
    els.resultScore.textContent = "0점";
    if (els.resultVerdict) {
      els.resultVerdict.textContent = "불합격";
      els.resultVerdict.className = "verdict-badge fail";
    }
    els.resultSummary.textContent = "아직 채점 결과가 없습니다.";
    if (els.resultCommentary) els.resultCommentary.textContent = "모의고사를 완료하면 점수에 맞춘 총평이 표시됩니다.";
    return;
  }

  const subject = subjects.find((item) => item.id === result.subjectId) || currentSubject();
  const questions = getQuestionsForSubject(subject, result.total);
  const passed = result.score > 60;
  els.resultScore.textContent = `${result.score}점`;
  if (els.resultVerdict) {
    els.resultVerdict.textContent = passed ? "합격" : "불합격";
    els.resultVerdict.className = `verdict-badge ${passed ? "pass" : "fail"}`;
  }
  els.resultSummary.textContent = `${subject.name} ${result.total}문항 중 ${result.correctCount}문항을 맞혔습니다. ${passed ? "합격 기준을 통과했습니다." : "합격 기준인 60점을 넘지 못했습니다."}`;
  if (els.resultCommentary) els.resultCommentary.textContent = buildResultCommentary(result.score);
  result.rows.forEach((row) => {
    appendResultItem(questions[row.index], row.index, row.selected, row.correct);
  });
}

function buildResultCommentary(score) {
  if (score >= 90) return "전체 개념 이해도가 매우 좋습니다. 실전에서는 시간 관리와 실수 방지에만 집중하면 안정적으로 고득점을 유지할 수 있습니다.";
  if (score >= 75) return "핵심 개념은 잘 잡혀 있습니다. 틀린 문항의 세부 조건과 용어 구분을 다시 확인하면 더 높은 점수를 기대할 수 있습니다.";
  if (score > 60) return "합격권에는 들어왔지만 아직 취약한 영역이 남아 있습니다. 오답 해설을 기준으로 헷갈린 개념을 짧게 정리해보세요.";
  if (score >= 40) return "기본 개념은 일부 파악했지만 안정적인 합격에는 부족합니다. 정답보다 오답 선택 이유를 먼저 확인하는 방식으로 복습하는 것이 좋습니다.";
  return "기초 개념부터 다시 다지는 단계입니다. 과목별 핵심 용어와 대표 사례를 먼저 정리한 뒤 같은 문제를 반복 풀이해보세요.";
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

function getQuestionsForSubject(subject, count) {
  const source = subject.questions;
  if (source.length >= count) return source.slice(0, count);
  return Array.from({ length: count }, (_, index) => source[index % source.length]);
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

function renderChoices(target, question, checkedAnswer, onSelect, selectedOnly = state.selected) {
  target.innerHTML = "";
  if (question.type === "coding") {
    renderCodingAnswer(target, question, checkedAnswer, onSelect, selectedOnly);
    return;
  }
  question.choices.forEach((choice, index) => {
    const choiceNumber = index + 1;
    const li = document.createElement("li");
    const button = document.createElement("button");
    const num = document.createElement("span");
    const text = document.createElement("span");

    button.type = "button";
    button.className = "choice-btn";
    if (selectedOnly === choiceNumber) button.classList.add("selected");
    if (checkedAnswer) {
      if (choiceNumber === question.answer) button.classList.add("correct");
      if (choiceNumber === checkedAnswer.selected && !checkedAnswer.correct) button.classList.add("wrong");
    }
    num.className = "choice-num";
    num.textContent = choiceNumber;
    text.textContent = choice;
    button.append(num, text);
    button.addEventListener("click", () => onSelect(choiceNumber));
    li.appendChild(button);
    target.appendChild(li);
  });
}

function renderCodingAnswer(target, question, checkedAnswer, onSelect, selectedValue) {
  const li = document.createElement("li");
  const wrap = document.createElement("div");
  const label = document.createElement("label");
  const textarea = document.createElement("textarea");
  const guide = document.createElement("p");

  wrap.className = "coding-answer";
  label.className = "coding-label";
  label.textContent = "답안 코드";
  textarea.className = "code-input";
  textarea.spellcheck = false;
  textarea.value = selectedValue || checkedAnswer?.selected || "";
  textarea.placeholder = "def solution(...):\n    # 여기에 코드를 작성하세요";
  textarea.addEventListener("input", () => onSelect(textarea.value));
  guide.className = "coding-guide";
  guide.textContent = "실제 실행 채점 대신 핵심 구현 요소를 확인하고, 정답 확인 후 모범답안을 보여줍니다.";

  wrap.append(label, textarea, guide);
  li.appendChild(wrap);
  target.appendChild(li);
}

function evaluateCodingAnswer(question, answer) {
  const normalized = String(answer || "").replace(/\s+/g, " ").toLowerCase();
  if (!normalized.trim()) return false;
  return question.keywords.every((keyword) => normalized.includes(String(keyword).toLowerCase()));
}

function renderQuestionGrid(target, questions, answers, activeIndex, onMove) {
  target.innerHTML = "";
  questions.forEach((question, index) => {
    const button = document.createElement("button");
    const answer = answers[index];
    button.type = "button";
    button.className = "question-jump";
    button.textContent = index + 1;
    if (index === activeIndex) button.classList.add("active");
    if (answer) {
      const isWrong = typeof answer === "object" && answer.correct === false;
      button.classList.add(isWrong ? "wrong" : "answered");
    }
    button.addEventListener("click", () => onMove(index));
    target.appendChild(button);
  });
}

function addWrongNote(index, notify = true) {
  const subject = currentSubject();
  const key = `${subject.id}-${index}`;
  const question = currentQuestions()[index];
  const alreadySaved = state.wrongNotes.has(key);
  state.wrongNotes.set(key, {
    profileName: state.profileName,
    subjectId: subject.id,
    subjectName: subject.name,
    index,
    question
  });
  saveState();
  renderTopStats();
  if (notify) {
    showToast(alreadySaved ? "이미 오답노트에 저장된 문제입니다." : "오답노트에 저장되었습니다.");
  }
}

let toastTimer;

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1800);
}

function renderWrongNotes() {
  els.wrongList.innerHTML = "";
  if (state.wrongNotes.size === 0) {
    const empty = document.createElement("article");
    const status = document.createElement("span");
    const body = document.createElement("div");
    const title = document.createElement("div");
    const sub = document.createElement("div");
    empty.className = "wrong-item";
    status.className = "status-dot";
    status.textContent = "-";
    title.className = "item-title";
    title.textContent = "저장된 오답이 없습니다.";
    sub.className = "item-sub";
    sub.textContent = "문제를 틀리거나 오답노트에 저장하면 여기에 표시됩니다.";
    body.append(title, sub);
    empty.append(status, body);
    els.wrongList.appendChild(empty);
    return;
  }

  state.wrongNotes.forEach((note) => {
    const item = document.createElement("button");
    const status = document.createElement("span");
    const body = document.createElement("div");
    const title = document.createElement("div");
    const sub = document.createElement("div");
    const action = document.createElement("strong");
    item.type = "button";
    item.className = "wrong-item";
    status.className = "status-dot wrong";
    status.textContent = "!";
    title.className = "item-title";
    title.textContent = `${note.subjectName} Q${note.index + 1}`;
    sub.className = "item-sub";
    sub.textContent = note.question.text;
    action.textContent = "다시풀기";
    body.append(title, sub);
    item.append(status, body, action);
    item.addEventListener("click", () => {
      state.subjectId = note.subjectId;
      state.index = note.index;
      state.selected = null;
      state.mode = "mock";
      saveState();
      if (els.mockSubject) renderMock();
      showScreen("mock");
    });
    els.wrongList.appendChild(item);
  });
}

function renderTopStats() {
  const totalSolved = Object.keys(state.mockAnswers).length;
  if (els.todayCount) els.todayCount.textContent = totalSolved;
  if (els.wrongTopCount) els.wrongTopCount.textContent = state.wrongNotes.size;
}

async function runHarness() {
  els.generateBtn.disabled = true;
  els.loading.style.display = "flex";
  els.apiResult.style.display = "none";
  els.apiResult.textContent = "";

  try {
    const response = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_start: 1, page_end: 15 })
    });
    const data = await response.json();
    renderApiResult(data);
  } catch (error) {
    els.apiResult.style.display = "block";
    els.apiResult.textContent = `서버에 연결하지 못했습니다. backend 실행 상태를 확인하세요. (${error.message})`;
  } finally {
    els.generateBtn.disabled = false;
    els.loading.style.display = "none";
  }
}

function renderApiResult(data) {
  const status = data.final_status || "UNKNOWN";
  const question = data.question || "문제 생성 결과가 없습니다.";
  const log = data.log_ref || "-";
  const retry = data.retry_count ?? 0;
  els.apiResult.style.display = "block";
  els.apiResult.textContent = `${status} · ${question} · retry: ${retry}회 · log: ${log}`;
}

function bindScreenLinks() {
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      showScreen(button.dataset.screen);
    });
  });
}

function bindOptional(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

function initPage() {
  const page = document.body.dataset.page || "subjects";

  bindScreenLinks();
  bindOptional(els.homeLink, "click", (event) => {
    event.preventDefault();
    showScreen("profile");
  });
  bindOptional(els.profileSearch, "focus", () => {
    els.profileOptions?.classList.add("open");
    els.profileSearch?.setAttribute("aria-expanded", "true");
    renderProfileOptions(els.profileSearch.value);
  });
  bindOptional(els.profileSearch, "input", () => {
    els.profileOptions?.classList.add("open");
    els.profileSearch?.setAttribute("aria-expanded", "true");
    renderProfileOptions(els.profileSearch.value);
  });
  bindOptional(els.profileSelect, "change", () => selectProfile(els.profileSelect.value));
  document.addEventListener("click", (event) => {
    if (!els.profileSelectBox || els.profileSelectBox.contains(event.target)) return;
    els.profileOptions?.classList.remove("open");
    els.profileSearch?.setAttribute("aria-expanded", "false");
  });
  bindOptional(els.questionCountInput, "input", () => {
    const parsedCount = Number.parseInt(els.questionCountInput.value || "20", 10);
    state.questionCount = Number.isFinite(parsedCount) ? Math.max(1, Math.min(parsedCount, 100)) : 20;
    saveState();
    if (els.subjectGrid) renderSubjects();
  });
  bindOptional(els.startPracticeBtn, "click", startPractice);
  bindOptional(els.startMockBtn, "click", startMock);
  bindOptional(els.singleSubmitBtn, "click", submitSingle);
  bindOptional(els.singleWrongBtn, "click", () => addWrongNote(state.index));
  bindOptional(els.singlePrevBtn, "click", () => moveSingle(state.index - 1));
  bindOptional(els.singleNextBtn, "click", () => moveSingle(state.index + 1));
  bindOptional(els.mockPrevBtn, "click", () => moveMock(state.index - 1));
  bindOptional(els.mockNextBtn, "click", () => moveMock(state.index + 1));
  bindOptional(els.gradeMockBtn, "click", gradeMock);
  bindOptional(els.generateBtn, "click", runHarness);

  if (!profiles.includes(state.profileName)) state.profileName = profiles[0];
  if (!state.questionCount) state.questionCount = 20;
  if (!state.subjectId) state.subjectId = subjects[0].id;
  if (page === "profile") initProfilePage();
  if (page === "subjects") renderSubjects();
  if (page === "mock") renderMock();
  if (page === "result") {
    renderResultPage();
    initResultChat();
  }
  if (page === "analysis") renderAnalysisPage();
  if (page === "wrong") renderWrongNotes();

  renderProfileButton();
  renderTopStats();
}

initPage();


