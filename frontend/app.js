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
  "wrong-notes",
  "harness",
  "init"
].forEach((name) => {
  document.write(`<script src="js/${name}.js"><\/script>`);
});
