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

  const shouldSeedSamples = new URLSearchParams(window.location.search).get("sampleWrong") === "1";
  if (!shouldSeedSamples) {
    if (changed) {
      state.wrongSubjectId = null;
      saveState();
    }
    return;
  }

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

async function loadBackendWrongNotes() {
  backendWrongNotesLoading = true;
  backendWrongNotes = null;

  try {
    const response = await fetch(`${API_BASE}/results/wrong-notes/saved`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    backendWrongNotes = Array.isArray(data.items) ? data.items : [];
    backendWrongSubjects = Array.isArray(data.subjects) ? data.subjects : [];
  } catch (error) {
    backendWrongNotes = [];
    backendWrongSubjects = [];
    showToast(`DB 오답노트를 불러오지 못했습니다. (${error.message})`);
  } finally {
    backendWrongNotesLoading = false;
    renderTopStats();
    renderWrongNotes();
  }
}

function renderWrongNotes() {
  if (!els.wrongList && !els.wrongSubjectGrid) return;

  const notes = currentProfileWrongNotes();
  const groups = groupWrongNotes(notes);
  const groupBySubject = new Map(groups.map((group) => [group.subjectId, group]));
  const useBackendNotes = Array.isArray(backendWrongNotes);
  const subjectOptions = useBackendNotes
    ? (backendWrongSubjects || groups.map((group) => ({
      subjectId: group.subjectId,
      subjectName: group.subjectName,
      total: group.total,
      rounds: group.rounds
    }))).map((subject) => ({
      id: subject.subjectId,
      code: subject.subjectCode || subject.subjectId,
      name: getWrongSubjectName(subject),
      desc: subject.subjectDescription || subject.subjectName || subject.subjectId,
      total: subject.wrongCount ?? subject.total ?? 0,
      roundCount: subject.roundCount ?? subject.rounds?.length ?? 0
    }))
    : subjects;
  if (!state.wrongSubjectId || !subjectOptions.some((subject) => subject.id === state.wrongSubjectId)) {
    const defaultSubject = subjectOptions.find((subject) => {
      const code = String(subject.code || subject.subjectCode || subject.id || "").toUpperCase();
      const name = String(subject.name || "").toLowerCase();
      return code === "AI" || name.includes("ai engineering");
    }) || subjectOptions[0];
    state.wrongSubjectId = defaultSubject?.id || null;
    state.wrongOpenDateKey = null;
    saveState();
  }
  const selectedSubject = state.wrongSubjectId
    ? subjectOptions.find((subject) => subject.id === state.wrongSubjectId)
    : null;
  const selectedGroup = selectedSubject
    ? groupBySubject.get(selectedSubject.id) || {
      subjectId: selectedSubject.id,
      subjectName: selectedSubject.name,
      total: 0,
      rounds: []
    }
    : null;

  if (els.wrongList) els.wrongList.innerHTML = "";
  if (els.wrongSubjectGrid) els.wrongSubjectGrid.innerHTML = "";
  if (els.wrongRoundList) els.wrongRoundList.innerHTML = "";
  if (els.wrongRoundSection) {
    els.wrongRoundSection.hidden = !selectedGroup;
    els.wrongRoundSection.setAttribute("aria-hidden", String(!selectedGroup));
    els.wrongRoundSection.style.display = selectedGroup ? "grid" : "none";
  }

  if (notes.length === 0) {
    renderWrongEmpty();
    return;
  }

  subjectOptions.forEach((subject) => {
    const group = groupBySubject.get(subject.id) || {
      subjectId: subject.id,
      subjectName: subject.name,
      total: subject.total || 0,
      rounds: []
    };
    const total = subject.total ?? group.total;
    const roundCount = subject.roundCount ?? group.rounds.length;
    const visual = getWrongSubjectVisual(subject);
    const card = document.createElement("button");
    card.type = "button";
    card.className = `subject-card wrong-subject-card ${visual.className}`;
    card.style.setProperty("--wrong-card-accent", visual.color);
    if (selectedGroup && group.subjectId === selectedGroup.subjectId) card.classList.add("active");
    card.innerHTML = `
      <span class="wrong-subject-visual" aria-hidden="true">
        <span class="wrong-subject-code">${subject.code || subject.subjectCode || group.subjectId}</span>
      </span>
      <span class="wrong-subject-info">
        <small>${roundCount ? `${roundCount}개 오답세트` : "저장된 세트 없음"}</small>
        <span class="wrong-subject-count">${total}개 문항 저장</span>
      </span>
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
    const selectedSummary = subjectOptions.find((subject) => subject.id === selectedGroup.subjectId);
    els.selectedWrongSubjectTitle.textContent = selectedSummary?.name || selectedGroup.subjectName;
  }

  if (selectedGroup.rounds.length === 0) {
    renderWrongRoundPlaceholder("저장된 오답 세트가 없습니다.");
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
    });
    head.append(title, count);
    section.append(head, list);

    dateGroup.rounds.forEach((roundGroup) => {
      list.appendChild(createWrongSetCard(selectedGroup, roundGroup));
    });

    els.wrongRoundList?.appendChild(section);
  });
}

function getWrongSubjectName(subject) {
  const subjectId = subject.subjectId || subject.id;
  const subjectCode = subject.subjectCode || subject.code || subjectId;
  const dbSubject = subjects.find((item) =>
    item.id === subjectId ||
    item.subjectCode === subjectCode ||
    item.id === subjectCode
  );
  const subjectName = subject.subjectName || subject.name;
  const isCodeLikeName = String(subjectName || "").toUpperCase() === String(subjectCode || "").toUpperCase();
  return (!isCodeLikeName ? subjectName : "") || dbSubject?.name || subject.subjectDescription || dbSubject?.desc || subjectId;
}

function getWrongSubjectVisual(subject) {
  const code = String(subject.code || subject.subjectCode || subject.id || "").toUpperCase();
  const name = String(subject.name || "").toLowerCase();
  const icons = {
    SW: {
      color: "#9fb8f4",
      className: "wrong-theme-sw"
    },
    CD: {
      color: "#a7d9b8",
      className: "wrong-theme-cd"
    },
    CA: {
      color: "#c7b7f4",
      className: "wrong-theme-ca"
    },
    DE: {
      color: "#f4c98b",
      className: "wrong-theme-de"
    },
    AI: {
      color: "#d9a0c2",
      className: "wrong-theme-ai"
    }
  };
  const key = icons[code]
    ? code
    : name.includes("developer")
      ? "CD"
      : name.includes("architect")
        ? "CA"
        : name.includes("data")
          ? "DE"
          : name.includes("sw") || name.includes("software") || name.includes("분석")
            ? "SW"
            : "AI";
  return icons[key];
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
  actions.append(startAction);
  deleteAction.type = "button";
  deleteAction.className = "wrong-delete-btn";
  deleteAction.textContent = "삭제";
  deleteAction.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteWrongReviewSet(selectedGroup, roundGroup);
  });
  actions.append(deleteAction);
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
  empty.className = "wrong-item wrong-round-placeholder";
  empty.innerHTML = `
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
  if (Array.isArray(backendWrongNotes)) {
    return backendWrongNotes.slice().sort((a, b) => {
      const subjectCompare = (a.subjectName || "").localeCompare(b.subjectName || "", "ko");
      if (subjectCompare !== 0) return subjectCompare;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }

  return Array.from(state.wrongNotes.values())
    .filter((note) => !note.profileName || note.profileName === state.profileName)
    .sort((a, b) => {
      const subjectCompare = (a.subjectName || "").localeCompare(b.subjectName || "", "ko");
      if (subjectCompare !== 0) return subjectCompare;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

function renderWrongEmptyMessage(title, subtitle) {
  const empty = document.createElement("article");
  empty.className = "empty-state wrong-empty-state";
  empty.innerHTML = `
    <div>
      <h3>${title}</h3>
      ${subtitle ? `<p>${subtitle}</p>` : ""}
    </div>
  `;
  els.wrongList?.appendChild(empty);
  els.wrongRoundList?.appendChild(empty.cloneNode(true));
}

function renderWrongEmpty() {
  renderWrongEmptyMessage(
    "복습할 오답이 없습니다",
    ""
  );
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
    els.reviewFeedback.hidden = true;
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

function showWrongPracticeScreen() {
  const screen = $("wrongPracticeScreen");
  if (screen) screen.style.visibility = "visible";
}

let wrongPracticeLoadingStarted = false;
let wrongPracticeLoadingTimer = null;

function showWrongPracticeLoading() {
  showWrongPracticeScreen();
  $("wrongPracticeScreen")?.classList.add("wrong-practice-loading");
  if (els.wrongReviewLoading) els.wrongReviewLoading.hidden = false;
  if (els.wrongReviewLoadingBar) {
    els.wrongReviewLoadingBar.style.width = "0%";
    requestAnimationFrame(() => {
      els.wrongReviewLoadingBar.style.width = "82%";
    });
  }
  if (els.reviewQuestionPanel) els.reviewQuestionPanel.hidden = true;
  if (els.reviewFeedback) {
    els.reviewFeedback.hidden = true;
    els.reviewFeedback.style.display = "none";
  }
  if (els.reviewCompletePanel) els.reviewCompletePanel.hidden = true;
}

function hideWrongPracticeLoading() {
  clearTimeout(wrongPracticeLoadingTimer);
  wrongPracticeLoadingTimer = null;
  $("wrongPracticeScreen")?.classList.remove("wrong-practice-loading");
  if (els.wrongReviewLoadingBar) els.wrongReviewLoadingBar.style.width = "100%";
  if (els.wrongReviewLoading) els.wrongReviewLoading.hidden = true;
}

function renderWrongPractice() {
  if (!els.reviewQuestionText || !els.reviewChoices || !els.reviewFeedback) return;

  if (els.wrongReviewLoading && !wrongPracticeLoadingStarted) {
    wrongPracticeLoadingStarted = true;
    showWrongPracticeLoading();
    wrongPracticeLoadingTimer = window.setTimeout(() => {
      hideWrongPracticeLoading();
      renderWrongPractice();
    }, 360);
    return;
  }

  hideWrongPracticeLoading();

  const reviewState = syncWrongReviewQuestion();
  const set = reviewState?.set || null;
  if (set && set.currentIndex >= set.notes.length) {
    renderWrongReviewComplete(set);
    showWrongPracticeScreen();
    return;
  }

  if (els.reviewQuestionPanel) els.reviewQuestionPanel.hidden = false;
  if (els.reviewFeedback) els.reviewFeedback.hidden = true;
  if (els.reviewCompletePanel) els.reviewCompletePanel.hidden = true;

  const note = reviewState?.note || state.reviewQuestion;
  if (!note) {
    els.reviewSubject.textContent = "오답 문제";
    els.reviewQuestionText.textContent = "선택된 오답 문제가 없습니다. 오답노트에서 다시 풀 문제를 선택하세요.";
    els.reviewChoices.innerHTML = "";
    if (els.reviewScenarioBox) {
      els.reviewScenarioBox.hidden = true;
      els.reviewScenarioBox.textContent = "";
    }
    if (els.reviewFeedback) {
      els.reviewFeedback.hidden = true;
      els.reviewFeedback.style.display = "none";
    }
    els.reviewSubmitBtn.disabled = true;
    if (els.reviewPrevBtn) els.reviewPrevBtn.disabled = true;
    if (els.reviewNextBtn) els.reviewNextBtn.disabled = true;
    if (els.reviewProgress) els.reviewProgress.textContent = "오답노트에서 복습할 세트를 선택하세요.";
    if (els.reviewProgressCount) els.reviewProgressCount.textContent = "- / -";
    showWrongPracticeScreen();
    return;
  }

  const question = note.question;
  const checkedAnswer = set?.checked?.[set.currentIndex] || null;
  els.reviewSubject.textContent = note.subjectName;
  if (els.reviewProgressCount) {
    els.reviewProgressCount.textContent = set
      ? `${set.currentIndex + 1} / ${set.notes.length}`
      : "1 / 1";
  }
  if (els.reviewQuestionNumber) els.reviewQuestionNumber.textContent = `${note.index + 1}`;
  if (els.reviewDifficulty) els.reviewDifficulty.textContent = question.difficulty;
  if (els.reviewQuestionType) els.reviewQuestionType.textContent = getQuestionType(question, note.index);
  els.reviewQuestionText.textContent = `${note.index + 1}. ${question.text}`;
  if (els.reviewScenarioBox) {
    const scenario = String(question.scenario || "").trim();
    els.reviewScenarioBox.textContent = scenario;
    els.reviewScenarioBox.hidden = !scenario;
  }
  els.reviewFeedback.className = "feedback-panel review-feedback";
  els.reviewFeedback.style.display = "none";
  els.reviewFeedback.hidden = true;
  els.reviewSubmitBtn.disabled = false;
  if (els.reviewProgress) {
    els.reviewProgress.textContent = set
      ? `${formatDotDate(set.latestAt)} ${set.roundTitle}`
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
  els.reviewChoices.classList.add("wrong-review-choice-list");

  if (checkedAnswer) renderWrongPracticeFeedback(note, checkedAnswer);
  showWrongPracticeScreen();
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
  renderWrongPracticeFeedback(note, checkedAnswer, true);
  if (els.reviewNextBtn && set) els.reviewNextBtn.disabled = false;
}

function renderWrongPracticeFeedback(note, checkedAnswer, shouldFocus = false) {
  const question = note.question;
  els.reviewFeedback.style.display = "block";
  els.reviewFeedback.hidden = false;
  els.reviewFeedback.className = "feedback-panel review-feedback wrong-review-detail";
  els.reviewFeedback.innerHTML = `
    <div class="result-detail-section result-answer-section">
      <p class="result-answer-summary"><span class="answer-label">선택한 답:</span> ${formatAnswerNumber(checkedAnswer.selected)}  <span class="answer-label">정답:</span> ${formatAnswerNumber(question.answer)}</p>
    </div>
    <div class="result-detail-section result-explanation-line">
      <span>${cleanExplanationText(question.explanation)}</span>
    </div>
  `;
  requestAnimationFrame(() => {
    els.reviewFeedback.classList.add("open");
    if (shouldFocus) focusWrongReviewFeedback();
  });
}

function focusWrongReviewFeedback() {
  if (!els.reviewFeedback) return;
  window.setTimeout(() => {
    const top = window.scrollY + els.reviewFeedback.getBoundingClientRect().top - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, 360);
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
  focusWrongReviewQuestion();
}

function focusWrongReviewQuestion() {
  if (!els.reviewQuestionPanel) return;
  if (!els.reviewQuestionPanel.hasAttribute("tabindex")) els.reviewQuestionPanel.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => {
    els.reviewQuestionPanel.focus({ preventScroll: true });
    els.reviewQuestionPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function renderWrongReviewComplete(set) {
  const correctCount = Object.values(set.checked || {}).filter((answer) => answer?.correct).length;
  if (els.reviewSubject) els.reviewSubject.textContent = "오답 리뷰 완료";
  if (els.reviewProgress) els.reviewProgress.textContent = `${set.roundTitle} · 복습 완료`;
  if (els.reviewProgressCount) els.reviewProgressCount.textContent = `${set.notes.length} / ${set.notes.length}`;
  if (els.reviewQuestionPanel) els.reviewQuestionPanel.hidden = true;
  if (els.reviewFeedback) {
    els.reviewFeedback.hidden = true;
    els.reviewFeedback.style.display = "none";
  }
  if (els.reviewCompleteSummary) {
    els.reviewCompleteSummary.textContent = `총 ${set.notes.length}문항 중 ${correctCount}문항을 다시 맞혔습니다.`;
  }
  if (els.reviewCompletePanel) els.reviewCompletePanel.hidden = false;
  showWrongPracticeScreen();
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
  const wrongCount = Array.isArray(backendWrongNotes) ? backendWrongNotes.length : state.wrongNotes.size;
  if (els.todayCount) els.todayCount.textContent = totalSolved;
  if (els.wrongTopCount) els.wrongTopCount.textContent = wrongCount;
}
