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
