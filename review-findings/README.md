# Review findings — session ending at commit 3affc51

Supporting detail for `../REVIEW.md`. **Nothing here is application code.** None of it is
loaded by `index.html`, none of it runs in the test suite, and the app keeps its
"no build step and no dependencies" property untouched.

- `findings-*.md` — per-area bug reports from four agents that drove the live app in a real
  DOM. Each bug has steps, expected vs actual, and the file/function responsible.
- `live-dom-harness.js` — the harness those agents used. Serves the app over a local HTTP
  server and loads it in jsdom with `runScripts: "dangerously"`, so every listener the app
  attaches is live and a dispatched click genuinely runs the handler. This is the layer that
  found the bugs the 1203-test suite could not.

To use it: `npm install jsdom` somewhere outside this repo, point `require` at it, then see
the usage block in `../REVIEW.md` section 3.

The two `beforeParse` shims (`scrollIntoView`, `URL.createObjectURL`) exist because jsdom
implements neither, and both are real browser APIs the app legitimately uses. They correct the
test environment; they are not hiding app bugs.
