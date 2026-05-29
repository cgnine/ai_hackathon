const API_BASE = (() => {
  const localHosts = new Set(["localhost", "127.0.0.1"]);
  if (window.location.protocol === "file:" || localHosts.has(window.location.hostname)) {
    return "http://localhost:8000";
  }
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

