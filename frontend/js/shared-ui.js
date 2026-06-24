function shouldShowAnswerCheck(question, choiceNumber) {
  const memberId = String(currentMemberId() || "").trim().toUpperCase();
  const isExistingAnswerMember = ["D150363", "D230251", "B249201", "A220495"].includes(memberId);
  const isMockAnswerMember = document.body?.dataset.page === "mock"
    && (memberId.startsWith("A") || memberId === "D170241");
  return (isExistingAnswerMember || isMockAnswerMember)
    && Array.isArray(question.choices)
    && question.choices.length >= 4
    && Number(question.answer) === choiceNumber;
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
    const answerMark = document.createElement("span");

    button.type = "button";
    button.className = "choice-btn";
    if (selectedOnly === choiceNumber) button.classList.add("selected");
    if (checkedAnswer) {
      if (choiceNumber === question.answer) button.classList.add("correct");
      if (choiceNumber === checkedAnswer.selected && !checkedAnswer.correct) button.classList.add("wrong");
    }
    num.className = "choice-num";
    num.textContent = choiceNumber;
    answerMark.className = "choice-answer-mark";
    answerMark.textContent = "정답";
    answerMark.hidden = !shouldShowAnswerCheck(question, choiceNumber);
    text.textContent = choice;
    button.append(num, text, answerMark);
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
