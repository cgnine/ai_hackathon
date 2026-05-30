let subjects = [];

const profiles = [
  "김우찬",
  "김현수",
  "윤정하",
  "이상미"
];

const PAGE_URLS = {
  login: "login.html",
  profile: "subjects.html",
  subjects: "subjects.html",
  mock: "mock.html",
  result: "result.html",
  analysis: "analysis.html",
  wrongPractice: "wrong-practice.html",
  wrong: "wrong.html",
  harness: "harness.html"
};

const STATE_KEY = "kbCbtState";
const RESULT_NAV_KEY = "kbCbtResultNavigation";

const defaultState = {
  screen: "profile",
  profileName: "",
  questionCount: 20,
  subjectId: null,
  activeQuestions: [],
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
      activeQuestions: saved.activeQuestions || [],
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
let backendWrongNotes = null;
let backendWrongSubjects = null;
let backendWrongNotesLoading = false;
let subjectHoverScrollLockedUntil = 0;
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

function saveResultNavigation(payload) {
  sessionStorage.setItem(RESULT_NAV_KEY, JSON.stringify(payload || {}));
}

function loadResultNavigation() {
  try {
    return JSON.parse(sessionStorage.getItem(RESULT_NAV_KEY) || "null");
  } catch {
    return null;
  }
}

function clearResultNavigation() {
  sessionStorage.removeItem(RESULT_NAV_KEY);
}

const $ = (id) => document.getElementById(id);

const els = {
  screens: document.querySelectorAll(".screen"),
  navBtns: document.querySelectorAll(".nav-btn"),
  profileSearch: $("profileSearch"),
  loginForm: $("loginForm"),
  memberIdInput: $("memberIdInput"),
  passwordInput: $("passwordInput"),
  loginSubmitBtn: $("loginSubmitBtn"),
  loginMessage: $("loginMessage"),
  profileSelect: $("profileSelect"),
  profileOptions: $("profileOptions"),
  profileSelectBox: $("profileSelectBox"),
  startPracticeBtn: $("startPracticeBtn"),
  profileSummary: $("profileSummary"),
  subjectPageTitle: $("subjectPageTitle"),
  subjectGrid: $("subjectGrid"),
  startSelectedSubjectBtn: $("startSelectedSubjectBtn"),
  subjectLoading: $("subjectLoading"),
  subjectLoadingBar: $("subjectLoadingBar"),
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
  resultHero: $("resultHero"),
  resultLoading: $("resultLoading"),
  resultLoadingBar: $("resultLoadingBar"),
  resultContent: $("resultContent"),
  resultSummary: $("resultSummary"),
  resultCommentary: $("resultCommentary"),
  resultList: $("resultList"),
  resultDiagnosis: $("resultDiagnosis"),
  wrongReviewSection: $("wrongReviewSection"),
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
  wrongReviewTop: $("wrongReviewTop"),
  reviewSubject: $("reviewSubject"),
  reviewQuestionNumber: $("reviewQuestionNumber"),
  reviewDifficulty: $("reviewDifficulty"),
  reviewQuestionType: $("reviewQuestionType"),
  reviewQuestionText: $("reviewQuestionText"),
  reviewScenarioBox: $("reviewScenarioBox"),
  reviewChoices: $("reviewChoices"),
  reviewSubmitBtn: $("reviewSubmitBtn"),
  reviewFeedback: $("reviewFeedback"),
  reviewQuestionPanel: $("reviewQuestionPanel"),
  wrongReviewLoading: $("wrongReviewLoading"),
  wrongReviewLoadingBar: $("wrongReviewLoadingBar"),
  reviewCompletePanel: $("reviewCompletePanel"),
  reviewCompleteSummary: $("reviewCompleteSummary"),
  reviewBackBtn: $("reviewBackBtn"),
  reviewRestartBtn: $("reviewRestartBtn"),
  reviewProgress: $("reviewProgress"),
  reviewProgressCount: $("reviewProgressCount"),
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
