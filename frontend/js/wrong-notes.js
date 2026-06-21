let wrongPageLoadingTimer = null;
let wrongPageLoadingProgress = 0;
const WRONG_SUBJECT_ORDER = ["AI", "CA", "CD", "DE", "SW"];
const WRONG_SUBJECT_NAMES = {
  AI: "AI Engineering",
  CA: "Cloud for Architect(Pro)",
  CD: "Cloud for Developer(Pro)",
  DE: "Data Engineering",
  SW: "Software Engineering"
};

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
  startWrongPageLoading();

  try {
    const memberId = currentMemberId();
    const query = memberId ? `?member_id=${encodeURIComponent(memberId)}` : "";
    const response = await fetch(`${API_BASE}/results/wrong-notes/saved${query}`);
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
    finishWrongPageLoading();
    renderTopStats();
    renderWrongNotes();
  }
}

function startWrongPageLoading() {
  const loading = document.getElementById("wrongPageLoading");
  const content = document.getElementById("wrongContent");
  const bar = document.getElementById("wrongPageLoadingBar");
  wrongPageLoadingProgress = 0;
  if (loading) loading.hidden = false;
  if (content) content.hidden = true;
  if (bar) bar.style.width = "0%";

  clearInterval(wrongPageLoadingTimer);
  wrongPageLoadingTimer = setInterval(() => {
    const ceiling = wrongPageLoadingProgress < 45 ? 45 : wrongPageLoadingProgress < 78 ? 78 : 92;
    const step = wrongPageLoadingProgress < 45 ? 8 : wrongPageLoadingProgress < 78 ? 4 : 1;
    wrongPageLoadingProgress = Math.min(ceiling, wrongPageLoadingProgress + step);
    if (bar) bar.style.width = `${wrongPageLoadingProgress}%`;
  }, 150);
}

function finishWrongPageLoading() {
  const loading = document.getElementById("wrongPageLoading");
  const content = document.getElementById("wrongContent");
  const bar = document.getElementById("wrongPageLoadingBar");
  clearInterval(wrongPageLoadingTimer);
  wrongPageLoadingTimer = null;
  if (bar) bar.style.width = "100%";
  window.setTimeout(() => {
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
  }, 180);
}

function renderWrongNotes() {
  if (!els.wrongList && !els.wrongSubjectGrid) return;

  const notes = currentProfileWrongNotes();
  const groups = groupWrongNotes(notes);
  const groupBySubject = new Map(groups.map((group) => [String(group.subjectId || "").toUpperCase(), group]));
  const subjectOptions = WRONG_SUBJECT_ORDER.map((code) => {
    const backendSubject = (backendWrongSubjects || []).find((subject) =>
      String(subject.subjectCode || subject.subjectId || "").toUpperCase() === code
    );
    const catalogSubject = subjects.find((subject) =>
      String(subject.subjectCode || subject.id || "").toUpperCase() === code
    );
    const group = groups.find((item) => String(item.subjectId || "").toUpperCase() === code);
    const subject = backendSubject || catalogSubject || {};
    return {
      id: code,
      code,
      name: getWrongSubjectName(subject) || WRONG_SUBJECT_NAMES[code],
      desc: subject.subjectDescription || subject.desc || subject.subjectName || WRONG_SUBJECT_NAMES[code],
      total: subject.wrongCount ?? subject.total ?? group?.total ?? 0,
      roundCount: subject.roundCount ?? subject.rounds?.length ?? group?.rounds?.length ?? 0
    };
  });
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
  const roundPager = document.getElementById("wrongRoundPagination");
  if (roundPager) roundPager.innerHTML = "";
  if (els.wrongRoundSection) {
    els.wrongRoundSection.hidden = !selectedGroup;
    els.wrongRoundSection.setAttribute("aria-hidden", String(!selectedGroup));
    els.wrongRoundSection.style.display = selectedGroup ? "grid" : "none";
  }

  if (notes.length === 0 && subjectOptions.length === 0) {
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
    const subjectCode = subject.code || subject.subjectCode || group.subjectId;
    const characterImages = getWrongSubjectCharacterImages(subjectCode);
    const card = document.createElement("button");
    card.type = "button";
    card.className = `subject-card wrong-subject-card ${visual.className}`;
    card.style.setProperty("--wrong-card-accent", visual.color);
    if (selectedGroup && String(group.subjectId || "").toUpperCase() === selectedSubject.id) card.classList.add("active");
    card.innerHTML = `
      <span class="wrong-subject-visual" aria-hidden="true">
        <img class="wrong-subject-character" src="${characterImages.defaultSrc}" alt="" data-default-src="${characterImages.defaultSrc}" ${characterImages.hoverSrc ? `data-hover-src="${characterImages.hoverSrc}"` : ""} />
        <span class="wrong-subject-code">${subjectCode}</span>
      </span>
      <span class="wrong-subject-info">
        <small>${roundCount ? `${roundCount}개 오답세트` : "저장된 세트 없음"}</small>
        <span class="wrong-subject-count">${total}개 문항 저장</span>
      </span>
    `;
    const character = card.querySelector(".wrong-subject-character");
    card.addEventListener("mouseenter", () => {
      if (character?.dataset.hoverSrc) character.src = character.dataset.hoverSrc;
    });
    card.addEventListener("mouseleave", () => {
      if (character?.dataset.defaultSrc) character.src = character.dataset.defaultSrc;
    });
    card.addEventListener("focus", () => {
      if (character?.dataset.hoverSrc) character.src = character.dataset.hoverSrc;
    });
    card.addEventListener("blur", () => {
      if (character?.dataset.defaultSrc) character.src = character.dataset.defaultSrc;
    });
    card.addEventListener("click", () => {
      state.wrongSubjectId = subject.id;
      state.wrongOpenDateKey = null;
      state.wrongRoundPage = 1;
      saveState();
      renderWrongNotes();
    });
    els.wrongSubjectGrid?.appendChild(card);
  });

  if (!selectedGroup) {
    if (els.selectedWrongSubjectTitle) {
      setSelectedWrongSubjectTitle("날짜별 오답 세트");
    }
    return;
  }

  if (els.selectedWrongSubjectTitle) {
    const selectedSummary = subjectOptions.find((subject) =>
      subject.id === String(selectedGroup.subjectId || "").toUpperCase()
    );
    setSelectedWrongSubjectTitle(selectedSummary?.name || selectedGroup.subjectName);
  }

  if (selectedGroup.rounds.length === 0) {
    renderWrongRoundPlaceholder("저장된 오답 세트가 없습니다.");
    return;
  }

  const sortedRounds = selectedGroup.rounds
    .slice()
    .sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0));
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sortedRounds.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(state.wrongRoundPage || 1)), totalPages);
  const pageRounds = sortedRounds.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  state.wrongRoundPage = currentPage;
  pageRounds.forEach((roundGroup) => {
    els.wrongRoundList?.appendChild(createWrongSetCard(selectedGroup, roundGroup));
  });
  renderWrongRoundPagination(currentPage, totalPages);
}

function renderWrongRoundPagination(page, totalPages) {
  const pager = document.getElementById("wrongRoundPagination");
  if (!pager) return;
  pager.innerHTML = "";
  if (totalPages <= 1) return;

  const prev = document.createElement("button");
  prev.type = "button";
  prev.textContent = "‹";
  prev.disabled = page <= 1;
  prev.addEventListener("click", () => moveWrongRoundPage(page - 1));
  pager.appendChild(prev);

  Array.from({ length: totalPages }, (_, index) => index + 1).forEach((pageNumber) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(pageNumber);
    button.classList.toggle("active", pageNumber === page);
    button.addEventListener("click", () => moveWrongRoundPage(pageNumber));
    pager.appendChild(button);
  });

  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "›";
  next.disabled = page >= totalPages;
  next.addEventListener("click", () => moveWrongRoundPage(page + 1));
  pager.appendChild(next);
}

function moveWrongRoundPage(page) {
  state.wrongRoundPage = Math.max(1, Number(page) || 1);
  saveState();
  renderWrongNotes();
}

function setSelectedWrongSubjectTitle(title) {
  if (!els.selectedWrongSubjectTitle) return;
  els.selectedWrongSubjectTitle.innerHTML = "";
  const icon = document.createElement("img");
  const label = document.createElement("span");
  icon.className = "wrong-round-title-icon";
  icon.src = "assets/subjects/wrong-round-title-transparent.png";
  icon.alt = "";
  label.className = "wrong-round-title-label";
  label.textContent = title;
  els.selectedWrongSubjectTitle.append(icon, label);
}

function getWrongSubjectCharacterImages(subjectCode) {
  const code = String(subjectCode || "").toUpperCase();
  const images = {
    AI: {
      defaultSrc: "assets/subjects/wrong-subject-rabbit-ui34.png",
      hoverSrc: "assets/subjects/wrong-subject-ai-hover-ui35.png"
    },
    CA: {
      defaultSrc: "assets/subjects/wrong-subject-ca-default-ui36.png",
      hoverSrc: "assets/subjects/wrong-subject-ca-hover-ui37.png"
    },
    CD: {
      defaultSrc: "assets/subjects/wrong-subject-cd-default-ui38.png",
      hoverSrc: "assets/subjects/wrong-subject-cd-hover-ui39.png"
    },
    DE: {
      defaultSrc: "assets/subjects/wrong-subject-de-default-ui40.png",
      hoverSrc: "assets/subjects/wrong-subject-de-hover-ui41.png"
    },
    SW: {
      defaultSrc: "assets/subjects/wrong-subject-sa-default-ui42.png",
      hoverSrc: "assets/subjects/wrong-subject-sa-hover-ui43.png"
    },
    SA: {
      defaultSrc: "assets/subjects/wrong-subject-sa-default-ui42.png",
      hoverSrc: "assets/subjects/wrong-subject-sa-hover-ui43.png"
    }
  };
  return images[code] || {
    defaultSrc: "assets/subjects/wrong-subject-rabbit-ui34.png",
    hoverSrc: ""
  };
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
  window.setTimeout(() => {
    requestAnimationFrame(() => {
      const target = document.querySelector(`.wrong-date-sets[data-date-key="${dateKey}"]`);
      if (!target || target.hidden) return;
      const top = window.scrollY + target.getBoundingClientRect().top - 112;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
  }, 90);
}

function createWrongSetCard(selectedGroup, roundGroup) {
  const button = document.createElement("article");
  const dateCell = document.createElement("div");
  const dateIcon = document.createElement("span");
  const dateText = document.createElement("strong");
  const timeText = document.createElement("small");
  const roundCell = document.createElement("div");
  const roundBadge = document.createElement("span");
  const countText = document.createElement("small");
  const rateCell = document.createElement("div");
  const wrongCell = document.createElement("div");
  const actionCell = document.createElement("div");
  const retry = document.createElement("span");
  const deleteButton = document.createElement("button");
  const totalCount = roundGroup.totalCount || roundGroup.total || roundGroup.notes.length;
  const wrongCount = roundGroup.wrongCount || roundGroup.notes.length;
  const correctRate = roundGroup.correctRate ?? Math.max(0, Math.round(((totalCount - wrongCount) / Math.max(totalCount, 1)) * 100));

  button.className = "wrong-set-card";
  button.tabIndex = 0;
  button.setAttribute("role", "button");
  dateCell.className = "wrong-set-date-cell";
  dateIcon.className = "wrong-set-calendar";
  dateIcon.textContent = "▣";
  dateText.textContent = formatDotDate(roundGroup.latestAt);
  timeText.textContent = formatTime(roundGroup.latestAt);
  dateCell.append(dateIcon, dateText, timeText);

  roundCell.className = "wrong-set-round-cell";
  roundBadge.textContent = roundGroup.roundTitle;
  countText.textContent = `${totalCount}문항`;
  roundCell.append(roundBadge, countText);

  rateCell.className = "wrong-set-metric";
  rateCell.innerHTML = `<small>정답률</small><strong>${correctRate}%</strong>`;
  wrongCell.className = "wrong-set-metric wrong";
  wrongCell.innerHTML = `<small>오답</small><strong><span>${wrongCount}</span>문항</strong>`;
  actionCell.className = "wrong-set-action-cell";
  retry.textContent = "다시 풀기";
  deleteButton.type = "button";
  deleteButton.className = "wrong-set-delete-btn";
  deleteButton.setAttribute("aria-label", `${roundGroup.roundTitle} 오답노트 삭제`);
  deleteButton.textContent = "×";
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteWrongReviewSet(selectedGroup, roundGroup);
  });
  actionCell.append(retry, deleteButton);

  button.append(dateCell, roundCell, rateCell, wrongCell, actionCell);
  button.addEventListener("click", () => startWrongReviewSet(selectedGroup, roundGroup));
  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    startWrongReviewSet(selectedGroup, roundGroup);
  });
  return button;
}

function getWrongRoundWeakKeyword(roundGroup) {
  const candidates = (roundGroup.notes || [])
    .map((note) => note.weakKeyword || note.minorUnit || note.diagnosisArea || note.question?.minorUnit || note.question?.topic || "")
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return candidates[0] || "오답 복습";
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
        const roundCompare = getRoundOrder(b.roundTitle) - getRoundOrder(a.roundTitle);
        if (roundCompare !== 0) return roundCompare;
        return new Date(b.latestAt || 0) - new Date(a.latestAt || 0);
      })
    }))
    .sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0));
}

function getRoundOrder(roundTitle = "") {
  const match = String(roundTitle).match(/(\d+)\s*회차/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function deleteWrongReviewSet(subjectGroup, roundGroup) {
  const message = `${subjectGroup.subjectName} ${roundGroup.roundTitle} 오답노트를 삭제할까요?`;
  if (!window.confirm(message)) return;

  const keysToDelete = [];
  state.wrongNotes.forEach((note, key) => {
    const sameProfile = !note.profileName || note.profileName === state.profileName;
    const sameSubject = (note.subjectId || note.subjectName) === subjectGroup.subjectId;
    const sameRound = (note.attemptId || note.roundTitle || "manual") === roundGroup.roundKey;
    if (sameProfile && sameSubject && sameRound) keysToDelete.push(key);
  });
  keysToDelete.forEach((key) => state.wrongNotes.delete(key));
  if (Array.isArray(backendWrongNotes)) {
    backendWrongNotes = backendWrongNotes.filter((note) => {
      const sameSubject = (note.subjectId || note.subjectName) === subjectGroup.subjectId;
      const sameRound = (note.attemptId || note.roundTitle || "manual") === roundGroup.roundKey;
      return !(sameSubject && sameRound);
    });
  }

  if (state.wrongReviewSet?.roundKey === roundGroup.roundKey) {
    state.wrongReviewSet = null;
    state.reviewQuestion = null;
    state.reviewAnswer = null;
  }
  saveState();
  renderTopStats();
  renderWrongNotes();
  showToast("오답노트를 삭제했습니다.");
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
        totalCount: Number(note.total || note.totalCount || 0),
        wrongCount: Number(note.wrongCount || 0),
        correctRate: note.correctRate ?? null,
        notes: []
      });
    }

    const roundGroup = subjectGroup.roundMap.get(roundKey);
    subjectGroup.total += 1;
    roundGroup.notes.push(note);
    roundGroup.totalCount = Math.max(roundGroup.totalCount || 0, Number(note.total || note.totalCount || 0));
    roundGroup.wrongCount = Math.max(roundGroup.wrongCount || 0, Number(note.wrongCount || 0));
    if (roundGroup.correctRate === null && note.correctRate !== undefined) {
      roundGroup.correctRate = note.correctRate;
    }
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

function renderWrongLoading() {
  if (!els.wrongList && !els.wrongSubjectGrid) return;
  if (els.wrongList) els.wrongList.innerHTML = "";
  if (els.wrongSubjectGrid) els.wrongSubjectGrid.innerHTML = "";
  if (els.wrongRoundList) els.wrongRoundList.innerHTML = "";
  const roundPager = document.getElementById("wrongRoundPagination");
  if (roundPager) roundPager.innerHTML = "";
  if (els.wrongRoundSection) {
    els.wrongRoundSection.hidden = true;
    els.wrongRoundSection.setAttribute("aria-hidden", "true");
    els.wrongRoundSection.style.display = "none";
  }
  renderWrongEmptyMessage("오답노트를 불러오는 중입니다", "");
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
  document.body.classList.remove("wrong-review-finished");

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
  if (els.wrongReviewTop) els.wrongReviewTop.hidden = false;
  $("wrongPracticeScreen")?.classList.remove("wrong-review-complete");

  const note = reviewState?.note || state.reviewQuestion;
  if (!note) {
    els.reviewSubject.textContent = "오답 문제";
    els.reviewQuestionText.textContent = "선택된 오답 문제가 없습니다. 오답노트에서 다시 풀 문제를 선택하세요.";
    if (els.reviewQuestionMeta) els.reviewQuestionMeta.hidden = true;
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
  const majorUnit = String(question.majorUnit || question.difficulty || "").trim();
  const questionType = String(question.questionType || getQuestionType(question, note.index) || "").trim();
  if (els.reviewDifficulty) {
    els.reviewDifficulty.textContent = majorUnit;
    els.reviewDifficulty.hidden = !majorUnit;
  }
  if (els.reviewQuestionType) {
    els.reviewQuestionType.textContent = questionType;
    els.reviewQuestionType.hidden = !questionType;
  }
  if (els.reviewQuestionMeta) els.reviewQuestionMeta.hidden = !majorUnit && !questionType;
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
  const answerSection = document.createElement("div");
  const answerSummary = document.createElement("p");
  const explanationSection = document.createElement("div");
  const explanationText = document.createElement("span");

  els.reviewFeedback.style.display = "block";
  els.reviewFeedback.hidden = false;
  els.reviewFeedback.className = "feedback-panel review-feedback wrong-review-detail";
  els.reviewFeedback.replaceChildren();

  answerSection.className = "result-detail-section result-answer-section";
  answerSummary.className = "result-answer-summary";
  answerSummary.append(
    createAnswerLabel("선택한 답:"),
    document.createTextNode(` ${formatAnswerNumber(checkedAnswer.selected)}  `),
    createAnswerLabel("정답:"),
    document.createTextNode(` ${formatAnswerNumber(question.answer)}`)
  );
  answerSection.appendChild(answerSummary);

  explanationSection.className = "result-detail-section result-explanation-line";
  explanationText.textContent = cleanExplanationText(question.explanation);
  explanationSection.appendChild(explanationText);
  els.reviewFeedback.append(answerSection, explanationSection);

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
  const hasAnswer = typeof state.reviewAnswer === "string"
    ? state.reviewAnswer.trim().length > 0
    : Boolean(state.reviewAnswer);
  if (delta > 0 && !hasAnswer) {
    showToast("먼저 답안을 선택하세요.");
    return;
  }
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
  });
}

function getReviewMessage(correctCount, totalCount) {
  const rate = totalCount === 0 ? 0 : (correctCount / totalCount) * 100;

  if (rate === 100) {
    return {
      title: "완벽하게 리뷰했어요!",
      desc: "모든 오답을 정확히 해결했어요. 복습이 실력으로 연결되고 있어요."
    };
  }
  if (rate >= 80) {
    return {
      title: "정말 잘했어요!",
      desc: "대부분의 오답을 꼼꼼히 리뷰했어요. 실력이 확실히 올라가고 있어요."
    };
  }
  if (rate >= 60) {
    return {
      title: "복습 효과가 보이기 시작했어요!",
      desc: "오답 리뷰를 통해 약점이 점점 줄어들고 있어요."
    };
  }
  if (rate >= 40) {
    return {
      title: "기본 개념을 확인했어요!",
      desc: "헷갈린 문제를 다시 풀어보면 더 안정적으로 잡힐 거예요."
    };
  }
  if (rate > 0) {
    return {
      title: "조금씩 감이 오고 있어요!",
      desc: "틀린 문제를 다시 보는 과정이 실력 향상의 시작이에요."
    };
  }
  return {
    title: "다시 시작해도 괜찮아요!",
    desc: "오답을 확인한 것만으로도 학습은 이미 시작됐어요."
  };
}

function renderWrongReviewComplete(set) {
  const correctCount = Object.values(set.checked || {}).filter((answer) => answer?.correct).length;
  const totalCount = set.notes.length;
  const message = getReviewMessage(correctCount, totalCount);
  document.body.classList.add("wrong-review-finished");
  $("wrongPracticeScreen")?.classList.add("wrong-review-complete");
  if (els.wrongReviewTop) els.wrongReviewTop.hidden = true;
  if (els.reviewQuestionPanel) els.reviewQuestionPanel.hidden = true;
  if (els.reviewFeedback) {
    els.reviewFeedback.hidden = true;
    els.reviewFeedback.style.display = "none";
  }
  if (els.reviewCompleteSummary) {
    els.reviewCompleteSummary.textContent = `총 ${totalCount}문항 중 ${correctCount}문항을 다시 맞혔습니다.`;
  }
  if (els.reviewCompleteTitle) els.reviewCompleteTitle.textContent = message.title;
  if (els.reviewCompleteDescription) els.reviewCompleteDescription.textContent = message.desc;
  if (els.reviewCompleteCorrect) els.reviewCompleteCorrect.textContent = `${correctCount}문항`;
  if (els.reviewCompleteTotal) els.reviewCompleteTotal.textContent = `${totalCount}문항`;
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
