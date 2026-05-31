async function runHarness() {
  els.generateBtn.disabled = true;
  els.loading.style.display = "flex";
  els.apiResult.style.display = "none";
  els.apiResult.innerHTML = "";

  try {
    const response = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_start: 1,
        page_end: 15,
        system_prompt: els.systemPromptInput?.value || ""
      })
    });
    const data = await response.json();
    renderApiResult(data);
  } catch (error) {
    els.apiResult.style.display = "block";
    els.apiResult.innerHTML = `
      <div class="generated-empty error">
        <strong>서버에 연결하지 못했습니다.</strong>
        <p>backend 실행 상태를 확인하세요. (${error.message})</p>
      </div>
    `;
  } finally {
    els.generateBtn.disabled = false;
    els.loading.style.display = "none";
  }
}

function renderApiResult(data) {
  const status = data.final_status || "UNKNOWN";
  const log = data.log_ref || "-";
  const retry = data.retry_count ?? 0;
  const passed = status === "PASS";

  els.apiResult.style.display = "block";
  els.apiResult.innerHTML = "";

  const card = document.createElement("article");
  const meta = document.createElement("div");
  const badge = document.createElement("span");
  const retryInfo = document.createElement("span");
  const title = document.createElement("h2");
  const question = document.createElement("p");
  const choices = document.createElement("ol");
  const detail = document.createElement("div");

  card.className = `generated-question-card ${passed ? "pass" : "fail"}`;
  meta.className = "generated-meta";
  badge.className = `generated-status ${passed ? "pass" : "fail"}`;
  badge.textContent = passed ? "검증 통과" : "검증 실패";
  retryInfo.textContent = `재시도 ${retry}회`;
  title.textContent = "생성된 문제";
  question.className = "generated-question-text";
  question.textContent = data.question || "문제 생성 결과가 없습니다.";
  choices.className = "generated-choice-list";

  meta.append(badge, retryInfo);
  card.append(meta, title, question);

  if (Array.isArray(data.choices) && data.choices.length) {
    data.choices.forEach((choice, index) => {
      const choiceNumber = index + 1;
      const li = document.createElement("li");
      const number = document.createElement("span");
      const text = document.createElement("span");
      li.className = choiceNumber === data.answer ? "answer" : "";
      number.className = "choice-num";
      number.textContent = choiceNumber;
      text.textContent = choice;
      li.append(number, text);
      choices.appendChild(li);
    });
    card.appendChild(choices);
  }

  detail.className = "generated-detail";
  if (data.answer) {
    const answer = document.createElement("p");
    answer.innerHTML = `<strong>정답</strong><span>${data.answer}번</span>`;
    detail.appendChild(answer);
  }
  if (data.explanation) {
    const explanation = document.createElement("p");
    explanation.innerHTML = `<strong>해설</strong><span></span>`;
    explanation.querySelector("span").textContent = data.explanation;
    detail.appendChild(explanation);
  }
  if (data.source_summary) {
    const source = document.createElement("p");
    source.innerHTML = `<strong>근거 요약</strong><span></span>`;
    source.querySelector("span").textContent = data.source_summary;
    detail.appendChild(source);
  }
  if (data.chunk_info) {
    const chunk = data.chunk_info;
    const chunkDetail = document.createElement("div");
    const chunkTitle = chunk.chunk_title || chunk.section_title || chunk.chapter_title || `Chunk ${chunk.id}`;
    const pageLabel = chunk.page_start && chunk.page_end
      ? `p.${chunk.page_start}-${chunk.page_end}`
      : "";
    const sectionLabel = [
      chunk.chapter_no ? `Chapter ${chunk.chapter_no}` : "",
      chunk.section_no ? `Section ${chunk.section_no}` : "",
      chunk.chunk_no ? `Chunk ${chunk.chunk_no}` : ""
    ].filter(Boolean).join(" · ");

    chunkDetail.className = "generated-source";
    chunkDetail.innerHTML = `
      <strong>참고한 DB 청크</strong>
      <div>
        <span>${chunkTitle}</span>
        <small>${[sectionLabel, pageLabel].filter(Boolean).join(" · ")}</small>
      </div>
    `;
    detail.appendChild(chunkDetail);
  }
  if (data.error) {
    const error = document.createElement("p");
    error.className = "generated-error";
    error.innerHTML = `<strong>오류</strong><span></span>`;
    error.querySelector("span").textContent = data.error;
    detail.appendChild(error);
  }
  if (detail.childElementCount) card.appendChild(detail);

  const foot = document.createElement("div");
  foot.className = "generated-foot";
  foot.textContent = `log: ${log}`;
  card.appendChild(foot);
  els.apiResult.appendChild(card);
}
