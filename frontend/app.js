const API_BASE = "http://localhost:8000";

const DEMO_ATTEMPT_ID = "demo-attempt";

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
  wrongPractice: "wrong-practice.html",
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
  recommendationAnswer: null,
  reviewQuestion: null,
  reviewAnswer: null,
  wrongSubjectId: null,
  wrongOpenDateKey: null,
  wrongReviewSet: null
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
      recommendationAnswer: saved.recommendationAnswer || null,
      reviewQuestion: saved.reviewQuestion || null,
      reviewAnswer: saved.reviewAnswer || null,
      wrongSubjectId: saved.wrongSubjectId || null,
      wrongOpenDateKey: saved.wrongOpenDateKey || null,
      wrongReviewSet: saved.wrongReviewSet || null
    };
  } catch {
    return { ...defaultState, wrongNotes: new Map() };
  }
}

const state = loadState();
let latestApiResult = null;
const SAMPLE_WRONG_ATTEMPT_ID = "sample-wrong-ai-engineering";
const SAMPLE_WRONG_COUNT = 3;
const SAMPLE_WRONG_DATES = [
  "2026-05-16",
  "2026-05-18",
  "2026-05-22"
];
const SAMPLE_WRONG_ROUND_TIMES = [
  "10:15:00",
  "14:20:00",
  "18:05:00"
];

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
  mockQuestionList: $("mockQuestionList"),
  mockQuestionType: $("mockQuestionType"),
  gradeMockBtn: $("gradeMockBtn"),
  resultScore: $("resultScore"),
  resultVerdict: $("resultVerdict"),
  resultSummary: $("resultSummary"),
  resultCommentary: $("resultCommentary"),
  resultList: $("resultList"),
  resultDiagnosis: $("resultDiagnosis"),
  diagnosisProgramTitle: $("diagnosisProgramTitle"),
  diagnosisSubject: $("diagnosisSubject"),
  diagnosisLevelName: $("diagnosisLevelName"),
  diagnosisLevel: $("diagnosisLevel"),
  diagnosisScore: $("diagnosisScore"),
  diagnosisName: $("diagnosisName"),
  diagnosisDate: $("diagnosisDate"),
  diagnosisCourse: $("diagnosisCourse"),
  diagnosisChart: $("diagnosisChart"),
  diagnosisBars: $("diagnosisBars"),
  diagnosisSummary: $("diagnosisSummary"),
  toggleAllExplanationsBtn: $("toggleAllExplanationsBtn"),
  saveWrongAllBtn: $("saveWrongAllBtn"),
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
  reviewSubject: $("reviewSubject"),
  reviewQuestionNumber: $("reviewQuestionNumber"),
  reviewDifficulty: $("reviewDifficulty"),
  reviewQuestionType: $("reviewQuestionType"),
  reviewQuestionText: $("reviewQuestionText"),
  reviewChoices: $("reviewChoices"),
  reviewSubmitBtn: $("reviewSubmitBtn"),
  reviewFeedback: $("reviewFeedback"),
  reviewQuestionPanel: $("reviewQuestionPanel"),
  reviewCompletePanel: $("reviewCompletePanel"),
  reviewCompleteSummary: $("reviewCompleteSummary"),
  reviewBackBtn: $("reviewBackBtn"),
  reviewRestartBtn: $("reviewRestartBtn"),
  reviewProgress: $("reviewProgress"),
  reviewPrevBtn: $("reviewPrevBtn"),
  reviewNextBtn: $("reviewNextBtn"),
  wrongList: $("wrongList"),
  wrongSubjectGrid: $("wrongSubjectGrid"),
  wrongRoundSection: $("wrongRoundSection"),
  wrongRoundList: $("wrongRoundList"),
  selectedWrongSubjectTitle: $("selectedWrongSubjectTitle"),
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
  if (name === "wrong") {
    state.wrongSubjectId = null;
    state.wrongOpenDateKey = null;
  }
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
  if (els.profileSearch) {
    els.profileSearch.setAttribute("aria-expanded", "false");
    els.profileSearch.blur();
  }
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

  els.mockSubject.textContent = subject.name;
  els.mockProgress.textContent = `${Object.keys(state.mockAnswers).length} / ${questions.length}`;
  if (!els.mockQuestionList) return;

  els.mockQuestionList.innerHTML = "";
  questions.forEach((question, index) => {
    const panel = document.createElement("article");
    const head = document.createElement("div");
    const number = document.createElement("span");
    const tags = document.createElement("div");
    const difficulty = document.createElement("span");
    const type = document.createElement("span");
    const text = document.createElement("p");
    const choices = document.createElement("ol");

    panel.className = "question-panel mock-question-panel";
    panel.id = `mock-question-${index + 1}`;
    head.className = "question-head";
    number.className = "question-number";
    number.textContent = `Q${index + 1}`;
    tags.className = "question-tags";
    difficulty.className = "pill";
    difficulty.textContent = question.difficulty;
    type.className = "pill type-pill";
    type.textContent = getQuestionType(question, index);
    text.className = "question-text";
    text.textContent = question.text;
    choices.className = "choices";

    tags.append(difficulty, type);
    head.append(number, tags);
    panel.append(head, text, choices);
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

function gradeMock() {
  const questions = currentQuestions();
  let correctCount = 0;
  const resultRows = [];
  const subject = currentSubject();
  const subjectAttemptCount = (state.attemptHistory || []).filter((attempt) => attempt.subjectId === state.subjectId).length;
  const attemptId = `${Date.now()}-${state.subjectId}`;
  const roundTitle = `${subjectAttemptCount + 1}회차`;
  const createdAt = new Date().toISOString();
  if (els.resultList) els.resultList.innerHTML = "";

  questions.forEach((question, index) => {
    const selected = state.mockAnswers[index];
    const correct = question.type === "coding" ? evaluateCodingAnswer(question, selected) : selected === question.answer;
    if (correct) correctCount += 1;
    resultRows.push({ index, selected, correct });

    appendResultItem(question, index, selected, correct, { attemptId, roundTitle, createdAt });
  });

  const score = Math.round((correctCount / questions.length) * 100);
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
  showScreen("result");
}

function appendResultItem(question, index, selected, correct, meta = {}) {
  if (!els.resultList) return;

  const item = document.createElement("article");
  const toggle = document.createElement("button");
  const status = document.createElement("span");
  const body = document.createElement("div");
  const title = document.createElement("div");
  const result = document.createElement("strong");
  const explanation = createResultDetail({
    choices: question.choices,
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
  result.textContent = correct ? "정답" : "오답";
  body.append(title);
  toggle.append(status, body, result);
  toggle.addEventListener("click", () => {
    toggleResultItem(item, toggle, explanation);
  });
  item.append(toggle, explanation);
  els.resultList.appendChild(item);
}

function toggleResultItem(item, toggle, detail) {
  const isOpen = item.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    detail.style.maxHeight = "none";
  } else {
    detail.style.maxHeight = "0px";
  }
  updateToggleAllExplanationsButton();
}

function setResultItemOpen(item, isOpen) {
  const toggle = item.querySelector(".result-toggle");
  const detail = item.querySelector(".result-explanation");
  if (!toggle || !detail) return;
  item.classList.toggle("open", isOpen);
  toggle.setAttribute("aria-expanded", String(isOpen));
  detail.style.maxHeight = isOpen ? "none" : "0px";
}

function toggleAllResultExplanations() {
  if (!els.resultList) return;
  const items = Array.from(els.resultList.querySelectorAll(".result-item"));
  if (items.length === 0) return;
  const shouldOpen = items.some((item) => !item.classList.contains("open"));
  items.forEach((item) => setResultItemOpen(item, shouldOpen));
  updateToggleAllExplanationsButton();
}

function updateToggleAllExplanationsButton() {
  if (!els.toggleAllExplanationsBtn || !els.resultList) return;
  const items = Array.from(els.resultList.querySelectorAll(".result-item"));
  const hasItems = items.length > 0;
  const allOpen = hasItems && items.every((item) => item.classList.contains("open"));
  els.toggleAllExplanationsBtn.style.display = hasItems ? "inline-flex" : "none";
  els.toggleAllExplanationsBtn.disabled = !hasItems;
  els.toggleAllExplanationsBtn.textContent = allOpen ? "해설 모두 접기" : "해설 모두 펼치기";
}

function createResultDetail({
  choices = [],
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
  const explanationTitle = document.createElement("strong");
  const explanationText = document.createElement("span");

  explanationSection.className = "result-detail-section result-explanation-line";
  explanationTitle.className = "result-detail-title";
  explanationTitle.textContent = "해설";
  explanationText.textContent = sampleSolution
    ? `${explanation}\n\n모범답안\n${sampleSolution}`
    : explanation;

  explanationSection.append(explanationTitle, explanationText);
  detail.appendChild(explanationSection);

  if (onSave) {
    const action = document.createElement("div");
    const button = document.createElement("button");
    action.className = "result-detail-actions";
    button.type = "button";
    button.className = "secondary-btn result-save-btn";
    button.textContent = saved ? "오답노트 저장됨" : "오답노트 저장";
    button.disabled = saved;
    button.addEventListener("click", () => {
      onSave();
      renderSaveWrongAllButton(latestApiResult || state.lastResult);
      button.textContent = "오답노트 저장됨";
      button.disabled = true;
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

function appendApiResultItem(item, index, resultMeta) {
  if (!els.resultList) return;

  const row = document.createElement("article");
  const toggle = document.createElement("button");
  const status = document.createElement("span");
  const body = document.createElement("div");
  const title = document.createElement("div");
  const result = document.createElement("strong");
  const explanation = createResultDetail({
    choices: item.choices,
    selected: item.selected,
    answer: item.answer,
    explanation: item.explanation,
    saved: state.wrongNotes.has(apiWrongNoteKey(resultMeta, item, index)),
    onSave: () => saveApiResultItemToWrongNote(resultMeta, item, index)
  });

  row.className = "result-item";
  toggle.type = "button";
  toggle.className = "result-toggle";
  toggle.setAttribute("aria-expanded", "false");
  status.className = `status-dot ${item.correct ? "" : "wrong"}`;
  status.textContent = item.correct ? "O" : "X";
  title.className = "item-title";
  title.textContent = `${index + 1}. ${item.questionText}`;
  result.textContent = item.correct ? "정답" : "오답";
  body.append(title);
  toggle.append(status, body, result);
  toggle.addEventListener("click", () => {
    toggleResultItem(row, toggle, explanation);
  });
  row.append(toggle, explanation);
  els.resultList.appendChild(row);
}

function renderApiResultPage(result) {
  if (!els.resultList || !els.resultScore || !els.resultSummary) return;

  const passed = result.score > 60;
  latestApiResult = result;
  els.resultList.innerHTML = "";
  els.resultScore.textContent = `${result.score}점`;
  if (els.resultVerdict) {
    els.resultVerdict.textContent = passed ? "합격" : "불합격";
    els.resultVerdict.className = `verdict-badge ${passed ? "pass" : "fail"}`;
  }
  els.resultSummary.textContent = `${result.subjectName} ${result.total}문항 중 ${result.correctCount}문항을 맞혔습니다. ${passed ? "합격 기준을 통과했습니다." : "합격 기준인 60점을 넘지 못했습니다."}`;
  if (els.resultCommentary) els.resultCommentary.textContent = buildResultCommentary(result.score);
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
    choices: item.choices || [],
    answer: item.answer,
    explanation: item.explanation,
    difficulty: item.difficulty,
    questionType: item.questionType
  };
}

function saveApiResultItemToWrongNote(result, item, index, notify = true) {
  const key = apiWrongNoteKey(result, item, index);
  const alreadySaved = state.wrongNotes.has(key);
  state.wrongNotes.set(key, {
    profileName: result.profileName || state.profileName,
    subjectId: result.subjectId,
    subjectName: result.subjectName,
    attemptId: result.attemptId || "api-result",
    roundTitle: result.roundTitle || "PDF 생성 결과",
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
  const unsavedCount = rows.filter((row) => !state.wrongNotes.has(row.key)).length;
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
        save: (notify = false) => saveApiResultItemToWrongNote(result, item, index, notify)
      }));
  }

  if (Array.isArray(result.rows)) {
    const subject = subjects.find((item) => item.id === result.subjectId) || currentSubject();
    const attemptId = result.attemptId || "manual";
    return result.rows
      .map((row) => ({
        correct: row.correct,
        key: `${attemptId}-${subject.id}-${row.index}`,
        save: (notify = false) => addWrongNote(row.index, notify, {
          attemptId,
          roundTitle: result.roundTitle || "모의고사 결과",
          createdAt: result.createdAt || new Date().toISOString()
        })
      }));
  }

  return [];
}

function saveAllWrongApiResultItems() {
  const result = latestApiResult || state.lastResult;
  const rows = getResultSaveRows(result);
  let savedCount = 0;
  rows.forEach((row) => {
    if (state.wrongNotes.has(row.key)) return;
    row.save(false);
    savedCount += 1;
  });
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
  if (els.diagnosisProgramTitle) els.diagnosisProgramTitle.textContent = `${new Date().getFullYear()} KB디지털역량평가 모의고사`;
  if (els.diagnosisSubject) els.diagnosisSubject.textContent = diagnosis.subjectName || "응시 과목";
  if (els.diagnosisLevelName) els.diagnosisLevelName.textContent = level.name;
  if (els.diagnosisLevel) els.diagnosisLevel.textContent = `Level ${level.level}`;
  if (els.diagnosisScore) els.diagnosisScore.textContent = `${diagnosis.score || 0} / 100점`;
  if (els.diagnosisName) els.diagnosisName.textContent = diagnosis.profileName || "응시자";
  if (els.diagnosisDate) els.diagnosisDate.textContent = formatFullDate(diagnosis.createdAt || new Date().toISOString());
  if (els.diagnosisCourse) els.diagnosisCourse.textContent = diagnosis.subjectName || "-";
  els.diagnosisSummary.textContent = diagnosis.summary || "영역별 점수를 기준으로 강점과 약점을 확인하세요.";
  renderDiagnosisRadar(getSampleRadarAxes());
  renderDiagnosisBars(axes);
}

function getSampleRadarAxes() {
  return [
    { name: "기초 이해", score: 63 },
    { name: "클라우드 분석", score: 63 },
    { name: "문제 해결", score: 42 },
    { name: "보안 적용", score: 35 },
    { name: "CI/CD Pipeline", score: 26 },
  ];
}

function renderDiagnosisRadar(axes) {
  const center = 120;
  const maxRadius = 82;
  const count = axes.length;
  const axisPoints = axes.map((axis, index) => {
    const angle = (-90 + index * (360 / count)) * Math.PI / 180;
    const outerX = center + Math.cos(angle) * maxRadius;
    const outerY = center + Math.sin(angle) * maxRadius;
    const scoreRadius = maxRadius * (axis.score / 100);
    const scoreX = center + Math.cos(angle) * scoreRadius;
    const scoreY = center + Math.sin(angle) * scoreRadius;
    const labelX = center + Math.cos(angle) * (maxRadius + 24);
    const labelY = center + Math.sin(angle) * (maxRadius + 24);
    return { axis, outerX, outerY, scoreX, scoreY, labelX, labelY };
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
    <text x="${point.labelX}" y="${point.labelY}" class="diagnosis-radar-label">${point.axis.name}</text>
  `).join("");

  const scoreMarkup = axisPoints.map((point) => `
    <text x="${point.scoreX}" y="${point.scoreY - 5}" class="diagnosis-radar-value">${point.axis.score}</text>
  `).join("");

  const scorePoints = axisPoints.map((point) => `${point.scoreX},${point.scoreY}`).join(" ");

  els.diagnosisChart.innerHTML = `
    <svg viewBox="0 0 240 240" role="img" aria-label="출제 영역 진단 레이더 차트">
      ${grid}
      ${axesMarkup}
      <polygon points="${scorePoints}" class="diagnosis-radar-score" />
      ${scoreMarkup}
    </svg>
  `;
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
  const theory = mergeAxes("이론형 문항 종합 이해도", theorySource.length ? theorySource : sourceAxes);
  const practical = mergeAxes("실무형 문항 종합 이해도", practicalSource.length ? practicalSource : sourceAxes);

  return {
    ...meta,
    score: meta.score ?? Math.round(sourceAxes.reduce((sum, axis) => sum + axis.score, 0) / sourceAxes.length),
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

async function loadBackendResultPage() {
  if (!els.resultList || !els.resultScore || !els.resultSummary) return;

  const params = new URLSearchParams(window.location.search);
  const attemptId = params.get("attemptId") || DEMO_ATTEMPT_ID;

  els.resultScore.textContent = "...";
  els.resultSummary.textContent = "백엔드에서 채점 결과를 불러오는 중입니다.";
  if (els.resultCommentary) els.resultCommentary.textContent = "";
  if (els.saveWrongAllBtn) els.saveWrongAllBtn.style.display = "none";
  els.resultList.innerHTML = "";

  try {
    const response = await fetch(`${API_BASE}/results/${attemptId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    renderApiResultPage(result);
  } catch (error) {
    renderResultPage();
    showToast(`백엔드 결과를 불러오지 못해 로컬 결과를 표시합니다. (${error.message})`);
  }
}

function renderResultPage() {
  if (!els.resultList || !els.resultScore || !els.resultSummary) return;

  const result = state.lastResult;
  latestApiResult = null;
  els.resultList.innerHTML = "";
  if (!result) {
    renderSaveWrongAllButton(null);
    updateToggleAllExplanationsButton();
    if (els.resultDiagnosis) els.resultDiagnosis.style.display = "none";
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
    button.addEventListener("click", () => {
      onSelect(choiceNumber);
      target.querySelectorAll(".choice-btn").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    });
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

function addWrongNote(index, notify = true, meta = {}) {
  const subject = currentSubject();
  const key = meta.attemptId ? `${meta.attemptId}-${subject.id}-${index}` : `${subject.id}-${index}`;
  const question = currentQuestions()[index];
  const alreadySaved = state.wrongNotes.has(key);
  state.wrongNotes.set(key, {
    profileName: state.profileName,
    subjectId: subject.id,
    subjectName: subject.name,
    attemptId: meta.attemptId || "manual",
    roundTitle: meta.roundTitle || "직접 저장",
    createdAt: meta.createdAt || new Date().toISOString(),
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

function ensureSampleWrongNotes() {
  const subject = subjects[0];
  let changed = false;
  Array.from(state.wrongNotes.entries()).forEach(([key, note]) => {
    const isSample = note?.attemptId === SAMPLE_WRONG_ATTEMPT_ID || key.startsWith(SAMPLE_WRONG_ATTEMPT_ID);
    const isCurrentProfile = !note?.profileName || note.profileName === state.profileName;
    if (isSample && isCurrentProfile) {
      state.wrongNotes.delete(key);
      changed = true;
    }
  });

  buildSampleWrongNotes().forEach((note, sampleIndex) => {
    const key = `${note.attemptId}-${state.profileName}-${subject.id}-${sampleIndex}`;
    state.wrongNotes.set(key, note);
    changed = true;
  });
  if (changed) {
    state.wrongSubjectId = null;
    saveState();
  }
}

function buildSampleWrongNotes() {
  const subject = subjects[0];
  const notes = [];
  SAMPLE_WRONG_DATES.forEach((date, dateIndex) => {
    SAMPLE_WRONG_ROUND_TIMES.forEach((time, roundIndex) => {
      const attemptId = `${SAMPLE_WRONG_ATTEMPT_ID}-${dateIndex + 1}-${roundIndex + 1}`;
      subject.questions.slice(0, SAMPLE_WRONG_COUNT).forEach((question, questionIndex) => {
        const index = (roundIndex + questionIndex) % subject.questions.length;
        notes.push({
          profileName: state.profileName,
          subjectId: subject.id,
          subjectName: subject.name,
          attemptId,
          roundTitle: `${roundIndex + 1}회차`,
          createdAt: `${date}T${time}+09:00`,
          index,
          question: subject.questions[index] || question
        });
      });
    });
  });
  return notes;
}

function renderWrongNotes() {
  if (!els.wrongList && !els.wrongSubjectGrid) return;

  const notes = currentProfileWrongNotes();
  const groups = groupWrongNotes(notes);
  const groupBySubject = new Map(groups.map((group) => [group.subjectId, group]));
  const selectedSubject = state.wrongSubjectId
    ? subjects.find((subject) => subject.id === state.wrongSubjectId)
    : null;
  const selectedGroup = selectedSubject
    ? groupBySubject.get(selectedSubject.id) || {
      subjectId: selectedSubject.id,
      subjectName: selectedSubject.name,
      total: 0,
      rounds: []
    }
    : null;

  if (state.wrongSubjectId && !selectedSubject) {
    state.wrongSubjectId = null;
    state.wrongOpenDateKey = null;
    saveState();
  }
  if (els.wrongList) els.wrongList.innerHTML = "";
  if (els.wrongSubjectGrid) els.wrongSubjectGrid.innerHTML = "";
  if (els.wrongRoundList) els.wrongRoundList.innerHTML = "";
  if (els.wrongRoundSection) els.wrongRoundSection.style.display = selectedGroup ? "grid" : "none";

  if (notes.length === 0) {
    renderWrongEmpty();
    return;
  }

  subjects.forEach((subject) => {
    const group = groupBySubject.get(subject.id) || {
      subjectId: subject.id,
      subjectName: subject.name,
      total: 0,
      rounds: []
    };
    const card = document.createElement("button");
    card.type = "button";
    card.className = "subject-card wrong-subject-card";
    if (selectedGroup && group.subjectId === selectedGroup.subjectId) card.classList.add("active");
    card.innerHTML = `
      <span class="subject-meta">${group.total}문항</span>
      <strong>${group.subjectName}</strong>
      <small>${group.rounds.length ? `${group.rounds.length}개 회차의 오답 세트가 있습니다.` : "아직 저장된 오답 세트가 없습니다."}</small>
    `;
    card.addEventListener("click", () => {
      state.wrongSubjectId = group.subjectId;
      state.wrongOpenDateKey = null;
      saveState();
      renderWrongNotes();
      focusWrongRoundSection();
    });
    els.wrongSubjectGrid?.appendChild(card);
  });

  if (!selectedGroup) {
    if (els.selectedWrongSubjectTitle) {
      els.selectedWrongSubjectTitle.textContent = "날짜별 오답 세트";
    }
    return;
  }

  if (els.selectedWrongSubjectTitle) {
    els.selectedWrongSubjectTitle.textContent = `${selectedGroup.subjectName} 오답 세트`;
  }

  if (selectedGroup.rounds.length === 0) {
    renderWrongRoundPlaceholder(`${selectedGroup.subjectName}에 저장된 오답 세트가 없습니다.`);
    return;
  }

  groupRoundsByDate(selectedGroup.rounds).forEach((dateGroup) => {
    const section = document.createElement("section");
    const head = document.createElement("button");
    const title = document.createElement("span");
    const count = document.createElement("span");
    const list = document.createElement("div");
    const isOpen = state.wrongOpenDateKey === dateGroup.key;

    section.className = `wrong-date-group ${isOpen ? "open" : ""}`;
    head.type = "button";
    head.className = "wrong-date-head";
    head.setAttribute("aria-expanded", String(isOpen));
    title.textContent = dateGroup.label;
    count.textContent = `${dateGroup.rounds.length}개 세트`;
    list.className = "wrong-date-sets";
    list.dataset.dateKey = dateGroup.key;
    list.tabIndex = -1;
    list.hidden = !isOpen;
    head.addEventListener("click", () => {
      const willOpen = !isOpen;
      state.wrongOpenDateKey = isOpen ? null : dateGroup.key;
      saveState();
      renderWrongNotes();
      if (willOpen) focusWrongDateSets(dateGroup.key);
    });
    head.append(title, count);
    section.append(head, list);

    dateGroup.rounds.forEach((roundGroup) => {
      list.appendChild(createWrongSetCard(selectedGroup, roundGroup));
    });

    els.wrongRoundList?.appendChild(section);
  });
}

function focusWrongRoundSection() {
  if (!els.wrongRoundSection) return;
  requestAnimationFrame(() => {
    els.wrongRoundSection.focus({ preventScroll: true });
    els.wrongRoundSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function focusWrongDateSets(dateKey) {
  requestAnimationFrame(() => {
    const target = document.querySelector(`.wrong-date-sets[data-date-key="${dateKey}"]`);
    if (!target || target.hidden) return;
    const firstRound = target.querySelector(".wrong-set-card");
    if (firstRound) {
      firstRound.focus({ preventScroll: true });
      firstRound.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function createWrongSetCard(selectedGroup, roundGroup) {
  const button = document.createElement("button");
  const titleWrap = document.createElement("div");
  const title = document.createElement("span");
  const time = document.createElement("small");
  const actions = document.createElement("div");
  const startAction = document.createElement("strong");
  const deleteAction = document.createElement("button");

  button.type = "button";
  button.className = "wrong-set-card";
  titleWrap.className = "wrong-set-title";
  title.textContent = roundGroup.roundTitle;
  time.textContent = `${formatTime(roundGroup.latestAt)} · ${roundGroup.notes.length}문항`;
  titleWrap.append(title, time);
  actions.className = "wrong-set-actions";
  startAction.textContent = "풀기";
  deleteAction.type = "button";
  deleteAction.className = "wrong-delete-btn";
  deleteAction.textContent = "삭제";
  deleteAction.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteWrongReviewSet(selectedGroup, roundGroup);
  });
  actions.append(startAction, deleteAction);
  button.append(titleWrap, actions);
  button.addEventListener("click", () => startWrongReviewSet(selectedGroup, roundGroup));
  return button;
}

function groupRoundsByDate(rounds) {
  const dateMap = new Map();
  rounds.forEach((roundGroup) => {
    const dateKey = formatDateKey(roundGroup.latestAt);
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {
        key: dateKey,
        label: formatDotDate(roundGroup.latestAt),
        latestAt: roundGroup.latestAt,
        rounds: []
      });
    }
    const dateGroup = dateMap.get(dateKey);
    dateGroup.rounds.push(roundGroup);
    if (new Date(roundGroup.latestAt || 0) > new Date(dateGroup.latestAt || 0)) {
      dateGroup.latestAt = roundGroup.latestAt;
    }
  });

  return Array.from(dateMap.values())
    .map((dateGroup) => ({
      ...dateGroup,
      rounds: dateGroup.rounds.sort((a, b) => {
        const roundCompare = getRoundOrder(a.roundTitle) - getRoundOrder(b.roundTitle);
        if (roundCompare !== 0) return roundCompare;
        return new Date(a.latestAt || 0) - new Date(b.latestAt || 0);
      })
    }))
    .sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0));
}

function getRoundOrder(roundTitle = "") {
  const match = String(roundTitle).match(/(\d+)\s*회차/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function deleteWrongReviewSet(subjectGroup, roundGroup) {
  const message = `${subjectGroup.subjectName} ${roundGroup.roundTitle} 오답 세트 ${roundGroup.notes.length}개 문항을 삭제할까요?`;
  if (!window.confirm(message)) return;

  const keysToDelete = [];
  state.wrongNotes.forEach((note, key) => {
    const sameProfile = !note.profileName || note.profileName === state.profileName;
    const sameSubject = (note.subjectId || note.subjectName) === subjectGroup.subjectId;
    const sameRound = (note.attemptId || note.roundTitle || "manual") === roundGroup.roundKey;
    if (sameProfile && sameSubject && sameRound) keysToDelete.push(key);
  });
  keysToDelete.forEach((key) => state.wrongNotes.delete(key));

  if (state.wrongReviewSet?.roundKey === roundGroup.roundKey) {
    state.wrongReviewSet = null;
    state.reviewQuestion = null;
    state.reviewAnswer = null;
  }
  saveState();
  renderTopStats();
  renderWrongNotes();
  showToast(`${keysToDelete.length}개 문항을 삭제했습니다.`);
}

function renderWrongRoundPlaceholder(message) {
  if (!els.wrongRoundList) return;
  const empty = document.createElement("article");
  empty.className = "wrong-item";
  empty.innerHTML = `
      <span class="status-dot">-</span>
      <div>
        <div class="item-title">${message}</div>
      </div>
  `;
  els.wrongRoundList.appendChild(empty);
}

function groupWrongNotes(notes) {
  const subjectMap = new Map();
  notes.forEach((note) => {
    const subjectKey = note.subjectId || note.subjectName || "unknown";
    if (!subjectMap.has(subjectKey)) {
      subjectMap.set(subjectKey, {
        subjectId: subjectKey,
        subjectName: note.subjectName || "미분류 과목",
        total: 0,
        roundMap: new Map()
      });
    }

    const subjectGroup = subjectMap.get(subjectKey);
    const roundKey = note.attemptId || note.roundTitle || "manual";
    if (!subjectGroup.roundMap.has(roundKey)) {
      subjectGroup.roundMap.set(roundKey, {
        roundKey,
        roundTitle: note.roundTitle || "직접 저장",
        latestAt: note.createdAt || null,
        notes: []
      });
    }

    const roundGroup = subjectGroup.roundMap.get(roundKey);
    subjectGroup.total += 1;
    roundGroup.notes.push(note);
    if (new Date(note.createdAt || 0) > new Date(roundGroup.latestAt || 0)) {
      roundGroup.latestAt = note.createdAt;
    }
  });

  return Array.from(subjectMap.values()).map((subjectGroup) => ({
    subjectId: subjectGroup.subjectId,
    subjectName: subjectGroup.subjectName,
    total: subjectGroup.total,
    rounds: Array.from(subjectGroup.roundMap.values()).sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0))
  }));
}

function currentProfileWrongNotes() {
  return Array.from(state.wrongNotes.values())
    .filter((note) => !note.profileName || note.profileName === state.profileName)
    .sort((a, b) => {
      const subjectCompare = (a.subjectName || "").localeCompare(b.subjectName || "", "ko");
      if (subjectCompare !== 0) return subjectCompare;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

function renderWrongEmpty() {
  const empty = document.createElement("article");
  empty.className = "wrong-item";
  empty.innerHTML = `
    <span class="status-dot">-</span>
    <div>
      <div class="item-title">저장된 오답이 없습니다.</div>
      <div class="item-sub">문제를 틀리거나 오답노트에 저장하면 과목별 복습 세트가 만들어집니다.</div>
    </div>
  `;
  els.wrongList?.appendChild(empty);
  els.wrongRoundList?.appendChild(empty.cloneNode(true));
}

function startWrongReviewSet(subjectGroup, roundGroup) {
  const isSampleSet = roundGroup.roundKey === SAMPLE_WRONG_ATTEMPT_ID;
  const notes = (isSampleSet && roundGroup.notes.length < SAMPLE_WRONG_COUNT
    ? buildSampleWrongNotes()
    : roundGroup.notes
  ).slice().sort((a, b) => a.index - b.index);
  state.wrongReviewSet = {
    subjectId: subjectGroup.subjectId,
    subjectName: subjectGroup.subjectName,
    roundKey: roundGroup.roundKey,
    roundTitle: roundGroup.roundTitle,
    latestAt: roundGroup.latestAt,
    notes,
    currentIndex: 0,
    answers: {},
    checked: {}
  };
  state.reviewQuestion = notes[0] || null;
  state.reviewAnswer = null;
  saveState();
  showScreen("wrongPractice");
}

function activeWrongReviewSet() {
  const set = state.wrongReviewSet;
  if (!set || !Array.isArray(set.notes) || set.notes.length === 0) return null;
  set.currentIndex = Math.max(0, Math.min(set.currentIndex || 0, set.notes.length));
  set.answers = set.answers || {};
  set.checked = set.checked || {};
  return set;
}

function syncWrongReviewQuestion() {
  const set = activeWrongReviewSet();
  if (!set) return null;
  const note = set.notes[set.currentIndex];
  state.reviewQuestion = note || null;
  state.reviewAnswer = set.answers[set.currentIndex] ?? null;
  return { set, note };
}

function selectWrongReviewAnswer(answer, set) {
  state.reviewAnswer = answer;
  if (set) {
    set.answers[set.currentIndex] = answer;
    delete set.checked[set.currentIndex];
  }
  if (els.reviewFeedback) {
    els.reviewFeedback.style.display = "none";
    els.reviewFeedback.className = "feedback-panel review-feedback";
  }
  if (els.reviewNextBtn) els.reviewNextBtn.disabled = !set;
  els.reviewChoices?.querySelectorAll(".choice-btn").forEach((button) => {
    button.classList.remove("correct", "wrong");
  });
  saveState();
}

function createWrongNoteItem(note) {
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
  title.textContent = `Q${note.index + 1} · ${note.question.difficulty || "난이도 미정"}`;
  sub.className = "item-sub";
  sub.textContent = note.question.text;
  action.textContent = "다시풀기";
  body.append(title, sub);
  item.append(status, body, action);
  item.addEventListener("click", () => {
    state.subjectId = note.subjectId;
    state.index = note.index;
    state.selected = null;
    state.mode = "wrong-practice";
    state.reviewAnswer = null;
    state.reviewQuestion = note;
    state.wrongReviewSet = null;
    saveState();
    showScreen("wrongPractice");
  });

  return item;
}

function formatShortDate(value) {
  if (!value) return "날짜 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 없음";
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function formatFullDate(value) {
  if (!value) return "날짜 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 없음";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function formatDotDate(value) {
  if (!value) return "날짜 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 없음";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function formatTime(value) {
  if (!value) return "시각 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시각 없음";
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function formatDateKey(value) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

function renderWrongPractice() {
  if (!els.reviewQuestionText || !els.reviewChoices || !els.reviewFeedback) return;

  const reviewState = syncWrongReviewQuestion();
  const set = reviewState?.set || null;
  if (set && set.currentIndex >= set.notes.length) {
    renderWrongReviewComplete(set);
    return;
  }

  if (els.reviewQuestionPanel) els.reviewQuestionPanel.hidden = false;
  if (els.reviewFeedback) els.reviewFeedback.hidden = false;
  if (els.reviewCompletePanel) els.reviewCompletePanel.hidden = true;

  const note = reviewState?.note || state.reviewQuestion;
  if (!note) {
    els.reviewSubject.textContent = "오답 문제";
    els.reviewQuestionText.textContent = "선택된 오답 문제가 없습니다. 오답노트에서 다시 풀 문제를 선택하세요.";
    els.reviewChoices.innerHTML = "";
    els.reviewSubmitBtn.disabled = true;
    if (els.reviewPrevBtn) els.reviewPrevBtn.disabled = true;
    if (els.reviewNextBtn) els.reviewNextBtn.disabled = true;
    if (els.reviewProgress) els.reviewProgress.textContent = "오답노트에서 복습할 세트를 선택하세요.";
    return;
  }

  const question = note.question;
  const checkedAnswer = set?.checked?.[set.currentIndex] || null;
  els.reviewSubject.textContent = note.subjectName;
  if (els.reviewQuestionNumber) els.reviewQuestionNumber.textContent = `${note.index + 1}`;
  if (els.reviewDifficulty) els.reviewDifficulty.textContent = question.difficulty;
  if (els.reviewQuestionType) els.reviewQuestionType.textContent = getQuestionType(question, note.index);
  els.reviewQuestionText.textContent = `${note.index + 1}. ${question.text}`;
  els.reviewFeedback.className = "feedback-panel review-feedback";
  els.reviewFeedback.style.display = "none";
  els.reviewSubmitBtn.disabled = false;
  if (els.reviewProgress) {
    els.reviewProgress.textContent = set
      ? `${set.roundTitle} · ${set.currentIndex + 1} / ${set.notes.length}`
      : "선택한 오답 문제 1개";
  }
  if (els.reviewPrevBtn) {
    els.reviewPrevBtn.disabled = !set || set.currentIndex === 0;
    els.reviewPrevBtn.style.display = "";
    els.reviewPrevBtn.style.visibility = !set || set.currentIndex === 0 ? "hidden" : "visible";
  }
  if (els.reviewNextBtn) {
    els.reviewNextBtn.disabled = !set;
    els.reviewNextBtn.textContent = set && set.currentIndex === set.notes.length - 1 ? "완료" : "다음";
  }
  renderChoices(els.reviewChoices, question, checkedAnswer, (choiceNumber) => {
    selectWrongReviewAnswer(choiceNumber, set);
  }, state.reviewAnswer);

  if (checkedAnswer) renderWrongPracticeFeedback(note, checkedAnswer);
}

function submitWrongPractice() {
  const note = state.reviewQuestion;
  const hasAnswer = typeof state.reviewAnswer === "string"
    ? state.reviewAnswer.trim().length > 0
    : Boolean(state.reviewAnswer);
  if (!note || !hasAnswer) {
    showToast("먼저 답안을 선택하세요.");
    return;
  }

  const question = note.question;
  const correct = question.type === "coding"
    ? evaluateCodingAnswer(question, state.reviewAnswer)
    : state.reviewAnswer === question.answer;
  const checkedAnswer = {
    selected: state.reviewAnswer,
    correct
  };
  const set = activeWrongReviewSet();
  if (set) {
    set.answers[set.currentIndex] = state.reviewAnswer;
    set.checked[set.currentIndex] = checkedAnswer;
  }
  saveState();
  renderChoices(els.reviewChoices, question, checkedAnswer, (choiceNumber) => {
    selectWrongReviewAnswer(choiceNumber, set);
  }, state.reviewAnswer);
  renderWrongPracticeFeedback(note, checkedAnswer);
  if (els.reviewNextBtn && set) els.reviewNextBtn.disabled = false;
}

function renderWrongPracticeFeedback(note, checkedAnswer) {
  const question = note.question;
  const selectedText = question.type === "coding"
    ? "코드 답안"
    : `선택 ${checkedAnswer.selected}번 · 정답 ${question.answer}번`;
  els.reviewFeedback.style.display = "grid";
  els.reviewFeedback.className = `feedback-panel review-feedback ${checkedAnswer.correct ? "correct" : "wrong"}`;
  els.reviewFeedback.innerHTML = `
    <div>
      <span class="result-badge ${checkedAnswer.correct ? "correct" : "wrong"}">${checkedAnswer.correct ? "정답" : "오답"}</span>
      <h3>${checkedAnswer.correct ? "다시 풀어서 맞혔습니다." : selectedText}</h3>
    </div>
    <p>${question.explanation}</p>
  `;
}

function moveWrongReview(delta) {
  const set = activeWrongReviewSet();
  if (!set) return;
  const nextIndex = set.currentIndex + delta;
  if (nextIndex >= set.notes.length) {
    set.currentIndex = set.notes.length;
    state.reviewQuestion = null;
    state.reviewAnswer = null;
    saveState();
    renderWrongReviewComplete(set);
    return;
  }
  set.currentIndex = Math.max(0, nextIndex);
  state.reviewQuestion = set.notes[set.currentIndex] || null;
  state.reviewAnswer = set.answers[set.currentIndex] ?? null;
  saveState();
  renderWrongPractice();
}

function renderWrongReviewComplete(set) {
  const correctCount = Object.values(set.checked || {}).filter((answer) => answer?.correct).length;
  if (els.reviewSubject) els.reviewSubject.textContent = "오답 리뷰 완료";
  if (els.reviewProgress) els.reviewProgress.textContent = `${set.roundTitle} · 복습 완료`;
  if (els.reviewQuestionPanel) els.reviewQuestionPanel.hidden = true;
  if (els.reviewFeedback) {
    els.reviewFeedback.hidden = true;
    els.reviewFeedback.style.display = "none";
  }
  if (els.reviewCompleteSummary) {
    els.reviewCompleteSummary.textContent = `총 ${set.notes.length}문항 중 ${correctCount}문항을 다시 맞혔습니다.`;
  }
  if (els.reviewCompletePanel) els.reviewCompletePanel.hidden = false;
}

function restartWrongReview() {
  const set = activeWrongReviewSet();
  if (!set) return;
  set.currentIndex = 0;
  set.answers = {};
  set.checked = {};
  state.reviewQuestion = set.notes[0] || null;
  state.reviewAnswer = null;
  saveState();
  renderWrongPractice();
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
  const scenario = data.scenario ? `\n\n상황:\n${data.scenario}` : "";
  const error = data.error ? `\n\n오류:\n${data.error}` : "";
  const log = data.log_ref || "-";
  const retry = data.retry_count ?? 0;
  els.apiResult.style.display = "block";
  els.apiResult.textContent = `${status} · ${question}${scenario}${error}\n\nretry: ${retry}회 · log: ${log}`;
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
  bindOptional(els.gradeMockBtn, "click", gradeMock);
  bindOptional(els.reviewSubmitBtn, "click", submitWrongPractice);
  bindOptional(els.reviewPrevBtn, "click", () => moveWrongReview(-1));
  bindOptional(els.reviewNextBtn, "click", () => moveWrongReview(1));
  bindOptional(els.reviewBackBtn, "click", () => showScreen("wrong"));
  bindOptional(els.reviewRestartBtn, "click", restartWrongReview);
  bindOptional(els.generateBtn, "click", runHarness);
  bindOptional(els.toggleAllExplanationsBtn, "click", toggleAllResultExplanations);
  bindOptional(els.saveWrongAllBtn, "click", saveAllWrongApiResultItems);

  if (!profiles.includes(state.profileName)) state.profileName = profiles[0];
  if (!state.questionCount) state.questionCount = 20;
  if (!state.subjectId) state.subjectId = subjects[0].id;
  ensureSampleWrongNotes();
  if (page === "profile") initProfilePage();
  if (page === "subjects") renderSubjects();
  if (page === "mock") renderMock();
  if (page === "result") {
    loadBackendResultPage();
    initResultChat();
  }
  if (page === "analysis") renderAnalysisPage();
  if (page === "wrong") {
    state.wrongSubjectId = null;
    state.wrongOpenDateKey = null;
    saveState();
    renderWrongNotes();
  }
  if (page === "wrong-practice") renderWrongPractice();

  renderProfileButton();
  renderTopStats();
}

initPage();
