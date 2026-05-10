const API_BASE = "";

const subjects = [
  {
    id: "design",
    name: "소프트웨어 설계",
    desc: "요구사항, UML, 객체지향 설계, 인터페이스 설계",
    questions: [
      {
        difficulty: "중",
        text: "객체지향 설계에서 하나의 객체가 여러 형태로 동작할 수 있게 하는 특징은 무엇인가?",
        choices: ["캡슐화", "상속", "다형성", "추상화"],
        answer: 3,
        explanation: "다형성은 동일한 메시지나 인터페이스가 객체의 실제 타입에 따라 서로 다른 방식으로 동작할 수 있게 하는 특성입니다."
      },
      {
        difficulty: "하",
        text: "UML 다이어그램 중 시스템의 기능과 외부 행위자 간 관계를 표현하는 것은 무엇인가?",
        choices: ["클래스 다이어그램", "유스케이스 다이어그램", "시퀀스 다이어그램", "배치 다이어그램"],
        answer: 2,
        explanation: "유스케이스 다이어그램은 사용자나 외부 시스템 같은 액터와 시스템 기능 사이의 관계를 표현합니다."
      },
      {
        difficulty: "상",
        text: "모듈 간 결합도는 낮추고 응집도는 높이는 설계가 좋은 이유는 무엇인가?",
        choices: ["화면을 화려하게 만들기 위해", "변경 영향 범위를 줄이기 위해", "데이터베이스 용량을 키우기 위해", "네트워크 속도를 고정하기 위해"],
        answer: 2,
        explanation: "낮은 결합도와 높은 응집도는 수정, 테스트, 재사용을 쉽게 만들어 유지보수성을 높입니다."
      }
    ]
  },
  {
    id: "database",
    name: "데이터베이스 구축",
    desc: "정규화, 키, 트랜잭션, SQL 기본 개념",
    questions: [
      {
        difficulty: "하",
        text: "관계형 데이터베이스에서 튜플을 유일하게 식별할 수 있는 속성 또는 속성 집합은 무엇인가?",
        choices: ["외래키", "기본키", "도메인", "뷰"],
        answer: 2,
        explanation: "기본키는 테이블의 각 행을 유일하게 구분하는 식별자이며 NULL 값을 가질 수 없습니다."
      },
      {
        difficulty: "중",
        text: "데이터 중복을 줄이고 이상 현상을 방지하기 위해 릴레이션을 분해하는 과정은 무엇인가?",
        choices: ["정규화", "역정규화", "인덱싱", "로깅"],
        answer: 1,
        explanation: "정규화는 데이터 중복과 삽입, 삭제, 갱신 이상을 줄이기 위한 릴레이션 구조화 과정입니다."
      },
      {
        difficulty: "중",
        text: "트랜잭션의 ACID 특성 중 작업이 모두 수행되거나 전혀 수행되지 않아야 한다는 성질은 무엇인가?",
        choices: ["일관성", "독립성", "원자성", "지속성"],
        answer: 3,
        explanation: "원자성은 트랜잭션 연산이 모두 반영되거나 모두 취소되어야 한다는 성질입니다."
      }
    ]
  },
  {
    id: "language",
    name: "프로그래밍 언어 활용",
    desc: "운영체제, 자료구조, 언어 문법, 프로세스",
    questions: [
      {
        difficulty: "중",
        text: "프로세스보다 생성 비용이 낮고 같은 프로세스의 메모리 공간을 공유하는 실행 단위는 무엇인가?",
        choices: ["스레드", "세마포어", "교착상태", "스케줄러"],
        answer: 1,
        explanation: "스레드는 프로세스 내부의 실행 흐름이며 코드, 데이터, 힙 영역을 공유하고 각자 스택을 가집니다."
      },
      {
        difficulty: "중",
        text: "둘 이상의 프로세스가 서로 상대방이 가진 자원을 기다리며 무한히 대기하는 상태는 무엇인가?",
        choices: ["기아 상태", "교착상태", "문맥 교환", "라운드 로빈"],
        answer: 2,
        explanation: "교착상태는 여러 프로세스가 서로의 자원을 기다리며 더 이상 진행하지 못하는 상태입니다."
      },
      {
        difficulty: "하",
        text: "후입선출 방식으로 데이터를 삽입하고 삭제하는 자료구조는 무엇인가?",
        choices: ["큐", "스택", "트리", "그래프"],
        answer: 2,
        explanation: "스택은 마지막에 삽입된 데이터가 가장 먼저 삭제되는 LIFO 구조입니다."
      }
    ]
  },
  {
    id: "harness",
    name: "AI 문제 생성 Harness",
    desc: "입력 통제, 출력 검증, Judge 평가, 로그 체계",
    questions: [
      {
        difficulty: "상",
        text: "AI 문제 생성 Harness에서 원문 근거가 약하거나 정답이 애매한 문항을 실패 처리하는 주된 이유는 무엇인가?",
        choices: ["응답 속도 향상", "비용 절감만을 위해", "문항 신뢰성 확보", "화면 렌더링 최적화"],
        answer: 3,
        explanation: "Harness는 생성 결과를 그대로 신뢰하지 않고 근거성, 단일 정답성, 해설 충분성 등을 검증해 운영 신뢰성을 높입니다."
      },
      {
        difficulty: "중",
        text: "Bedrock 호출 실패 시 무한 재시도를 피해야 하는 가장 직접적인 이유는 무엇인가?",
        choices: ["로그 파일을 줄이기 위해", "비용과 장애 전파를 통제하기 위해", "CSS 충돌을 막기 위해", "PDF 파일명을 바꾸기 위해"],
        answer: 2,
        explanation: "무한 재시도는 비용을 증가시키고 장애 상황을 악화시킬 수 있으므로 제한된 복구 정책이 필요합니다."
      },
      {
        difficulty: "중",
        text: "LLM-as-Judge가 평가하기에 가장 적절한 항목은 무엇인가?",
        choices: ["버튼 색상", "문항의 근거성과 단일 정답성", "서버 포트 번호", "브라우저 확대 비율"],
        answer: 2,
        explanation: "LLM-as-Judge는 규칙만으로 판단하기 어려운 원문 근거성, 정답 명확성, 해설 충분성 등을 평가하는 데 사용합니다."
      }
    ]
  }
];

const state = {
  screen: "subjects",
  subjectId: null,
  mode: null,
  index: 0,
  selected: null,
  singleAnswers: {},
  mockAnswers: {},
  wrongNotes: new Map()
};

const $ = (id) => document.getElementById(id);

const els = {
  screens: document.querySelectorAll(".screen"),
  navBtns: document.querySelectorAll(".nav-btn"),
  subjectGrid: $("subjectGrid"),
  selectedSubjectEyebrow: $("selectedSubjectEyebrow"),
  selectedSubjectTitle: $("selectedSubjectTitle"),
  startSingleBtn: $("startSingleBtn"),
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
  mockQuestionText: $("mockQuestionText"),
  mockChoices: $("mockChoices"),
  mockPrevBtn: $("mockPrevBtn"),
  mockNextBtn: $("mockNextBtn"),
  gradeMockBtn: $("gradeMockBtn"),
  resultScore: $("resultScore"),
  resultSummary: $("resultSummary"),
  resultList: $("resultList"),
  wrongList: $("wrongList"),
  wrongTopCount: $("wrongTopCount"),
  todayCount: $("todayCount"),
  homeLink: $("homeLink"),
  generateBtn: $("generateBtn"),
  loading: $("loading"),
  apiResult: $("apiResult")
};

function currentSubject() {
  return subjects.find((subject) => subject.id === state.subjectId) || subjects[0];
}

function currentQuestions() {
  return currentSubject().questions;
}

function showScreen(name) {
  state.screen = name;
  els.screens.forEach((screen) => screen.classList.toggle("active", screen.id === `${name}Screen`));
  els.navBtns.forEach((button) => button.classList.toggle("active", button.dataset.screen === name));
  if (name === "wrong") renderWrongNotes();
}

function renderSubjects() {
  els.subjectGrid.innerHTML = "";
  subjects.forEach((subject) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "subject-card";
    card.innerHTML = `
      <span class="subject-meta">${subject.questions.length}문항</span>
      <strong>${subject.name}</strong>
      <small>${subject.desc}</small>
    `;
    card.addEventListener("click", () => selectSubject(subject.id));
    els.subjectGrid.appendChild(card);
  });
}

function selectSubject(subjectId) {
  state.subjectId = subjectId;
  state.index = 0;
  state.selected = null;
  state.singleAnswers = {};
  state.mockAnswers = {};
  const subject = currentSubject();
  els.selectedSubjectEyebrow.textContent = "Selected Subject";
  els.selectedSubjectTitle.textContent = subject.name;
  showScreen("mode");
}

function startSingle() {
  state.mode = "single";
  state.index = 0;
  state.selected = null;
  renderSingle();
  showScreen("single");
}

function startMock() {
  state.mode = "mock";
  state.index = 0;
  state.selected = state.mockAnswers[0] || null;
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
    renderSingle();
  });
  renderSingleFeedback(question, answered);
  renderQuestionGrid(els.singleQuestionGrid, questions, state.singleAnswers, state.index, moveSingle);
}

function renderSingleFeedback(question, answered) {
  els.singleResultBadge.className = "result-badge";
  if (!answered) {
    els.singleResultBadge.textContent = "대기";
    els.singleFeedbackTitle.textContent = "답안을 선택하면 결과가 표시됩니다.";
    els.singleExplanation.textContent = "한 문제씩 풀기에서는 정답 확인 즉시 채점과 해설을 볼 수 있습니다.";
    return;
  }

  if (answered.correct) {
    els.singleResultBadge.classList.add("correct");
    els.singleResultBadge.textContent = "정답";
    els.singleFeedbackTitle.textContent = "맞았습니다.";
  } else {
    els.singleResultBadge.classList.add("wrong");
    els.singleResultBadge.textContent = "오답";
    els.singleFeedbackTitle.textContent = `선택 ${answered.selected}번, 정답 ${question.answer}번`;
  }
  els.singleExplanation.textContent = question.explanation;
}

function submitSingle() {
  if (!state.selected) {
    els.singleFeedbackTitle.textContent = "먼저 답안을 선택해주세요.";
    els.singleExplanation.textContent = "보기 중 하나를 고른 다음 정답 확인을 누르면 바로 채점됩니다.";
    return;
  }

  const question = currentQuestions()[state.index];
  const correct = state.selected === question.answer;
  state.singleAnswers[state.index] = { selected: state.selected, correct };
  if (!correct) addWrongNote(state.index);
  renderTopStats();
  renderSingle();
}

function moveSingle(index) {
  state.index = Math.max(0, Math.min(index, currentQuestions().length - 1));
  state.selected = state.singleAnswers[state.index]?.selected || null;
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
  els.mockQuestionText.textContent = question.text;
  els.mockPrevBtn.disabled = state.index === 0;
  els.mockNextBtn.disabled = state.index === questions.length - 1;
  renderChoices(els.mockChoices, question, null, (choiceNumber) => {
    state.mockAnswers[state.index] = choiceNumber;
    state.selected = choiceNumber;
    renderTopStats();
    renderMock();
  }, answered);
  renderQuestionGrid(els.mockQuestionGrid, questions, state.mockAnswers, state.index, moveMock);
}

function moveMock(index) {
  state.index = Math.max(0, Math.min(index, currentQuestions().length - 1));
  state.selected = state.mockAnswers[state.index] || null;
  renderMock();
}

function gradeMock() {
  const questions = currentQuestions();
  let correctCount = 0;
  els.resultList.innerHTML = "";

  questions.forEach((question, index) => {
    const selected = state.mockAnswers[index];
    const correct = selected === question.answer;
    if (correct) correctCount += 1;
    if (!correct) addWrongNote(index);

    const item = document.createElement("article");
    item.className = "result-item";
    item.innerHTML = `
      <span class="status-dot ${correct ? "" : "wrong"}">${correct ? "O" : "X"}</span>
      <div>
        <div class="item-title">Q${index + 1}. ${question.text}</div>
        <div class="item-sub">선택 ${selected || "-"}번 · 정답 ${question.answer}번 · ${question.explanation}</div>
      </div>
      <strong>${correct ? "정답" : "오답"}</strong>
    `;
    els.resultList.appendChild(item);
  });

  const score = Math.round((correctCount / questions.length) * 100);
  els.resultScore.textContent = `${score}점`;
  els.resultSummary.textContent = `${currentSubject().name} ${questions.length}문항 중 ${correctCount}문항을 맞혔습니다. 오답은 자동으로 오답노트에 저장됩니다.`;
  renderTopStats();
  showScreen("result");
}

function renderChoices(target, question, checkedAnswer, onSelect, selectedOnly = state.selected) {
  target.innerHTML = "";
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

function addWrongNote(index) {
  const subject = currentSubject();
  const key = `${subject.id}-${index}`;
  state.wrongNotes.set(key, {
    subjectId: subject.id,
    subjectName: subject.name,
    index,
    question: subject.questions[index]
  });
  renderTopStats();
}

function renderWrongNotes() {
  els.wrongList.innerHTML = "";
  if (state.wrongNotes.size === 0) {
    const empty = document.createElement("article");
    empty.className = "wrong-item";
    empty.innerHTML = `<span class="status-dot">-</span><div><div class="item-title">저장된 오답이 없습니다.</div><div class="item-sub">문제를 틀리거나 오답노트에 저장하면 이곳에 표시됩니다.</div></div>`;
    els.wrongList.appendChild(empty);
    return;
  }

  state.wrongNotes.forEach((note) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "wrong-item";
    item.innerHTML = `
      <span class="status-dot wrong">!</span>
      <div>
        <div class="item-title">${note.subjectName} Q${note.index + 1}</div>
        <div class="item-sub">${note.question.text}</div>
      </div>
      <strong>다시풀기</strong>
    `;
    item.addEventListener("click", () => {
      state.subjectId = note.subjectId;
      state.index = note.index;
      state.selected = null;
      renderSingle();
      showScreen("single");
    });
    els.wrongList.appendChild(item);
  });
}

function renderTopStats() {
  const totalSolved = Object.keys(state.singleAnswers).length + Object.keys(state.mockAnswers).length;
  els.todayCount.textContent = totalSolved;
  els.wrongTopCount.textContent = state.wrongNotes.size;
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
    els.apiResult.textContent = `서버에 연결하지 못했습니다. backend 실행 상태를 확인해주세요. (${error.message})`;
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

document.querySelectorAll("[data-screen]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.screen));
});

els.homeLink.addEventListener("click", (event) => {
  event.preventDefault();
  showScreen("subjects");
});
els.startSingleBtn.addEventListener("click", startSingle);
els.startMockBtn.addEventListener("click", startMock);
els.singleSubmitBtn.addEventListener("click", submitSingle);
els.singleWrongBtn.addEventListener("click", () => addWrongNote(state.index));
els.singlePrevBtn.addEventListener("click", () => moveSingle(state.index - 1));
els.singleNextBtn.addEventListener("click", () => moveSingle(state.index + 1));
els.mockPrevBtn.addEventListener("click", () => moveMock(state.index - 1));
els.mockNextBtn.addEventListener("click", () => moveMock(state.index + 1));
els.gradeMockBtn.addEventListener("click", gradeMock);
els.generateBtn.addEventListener("click", runHarness);

renderSubjects();
renderTopStats();
