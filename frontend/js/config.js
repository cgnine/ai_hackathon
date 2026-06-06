const API_BASE = (() => {
  const { protocol, hostname, port } = window.location;
  const localHosts = new Set(["", "localhost", "127.0.0.1"]);

  // Local development:
  // - file:// open
  // - localhost / 127.0.0.1 static server
  // In all of these cases, use the local FastAPI server directly.
  if (protocol === "file:" || localHosts.has(hostname)) {
    return "http://127.0.0.1:8000";
  }

  // Deployed EC2 setup serves the backend on the same host's 8000 port.
  if (protocol === "http:") {
    return `http://${hostname}:8000`;
  }

  // Fallback for same-origin deployments behind a reverse proxy.
  return "";
})();

const DEMO_ATTEMPT_ID = "123456789";

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
