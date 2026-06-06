const _v = Date.now();
[
  "config",
  "state",
  "api",
  "auth",
  "navigation",
  "quiz",
  "result",
  "analysis",
  "shared-ui",
  "ai-recommend",
  "wrong-notes",
  "harness",
  "init"
].forEach((name) => {
  document.write(`<script src="js/${name}.js?v=${_v}"><\/script>`);
});
