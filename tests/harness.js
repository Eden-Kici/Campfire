/* Minimal test harness.

   The app is a handful of plain files loaded by a browser -- no modules, no
   build, no dependencies -- so the tests load them the same way the page does:
   take the script list straight out of index.html, read the source in that
   order, concatenate it after a small DOM stub, and evaluate the lot. That
   keeps the app free of test scaffolding and means the tests exercise exactly
   what ships.

   Run with:  node tests/run.js
*/

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

/* A DOM stand-in. It answers anything the app asks of it without rendering,
   which is enough to run every render function and open every modal -- the
   markup they produce is returned as strings and asserted against. */
function domStub() {
  const element = new Proxy({}, {
    get(target, prop) {
      if (prop === "style") return {};
      if (prop === "classList") return { toggle() {}, add() {}, remove() {}, contains() { return false; } };
      if (prop === "dataset") return {};
      if (prop === "files") return [];
      if (prop === "value" || prop === "textContent" || prop === "innerHTML") return "";
      if (prop === "checked") return false;
      if (typeof prop === "symbol") return undefined;
      return () => element;
    },
    set() { return true; }
  });

  // Every other key starts genuinely empty (a fresh install), and that's
  // the right default for tutorial.js's own tests. For every OTHER suite
  // it's just noise -- an unrelated test calling renderContent()/showScreen()
  // would otherwise also trip the onboarding tutorial's welcome modal on a
  // totally fresh boot, the same as a real first-ever launch would. Seeding
  // "already finished" here keeps every suite that isn't about the tutorial
  // decoupled from it, the same way __modals/__toasts get reset after boot
  // so an app-menu toast at load time doesn't leak into some other test's
  // "before/after" comparison.
  const store = {
    "campfire.tutorial": JSON.stringify({
      active: false, phase: "done",
      seenTabs: ["combat", "character", "spells", "inventory", "notes"],
      seenActions: ["roll", "hp", "spell"]
    })
  };
  return {
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    document: {
      documentElement: { setAttribute() {}, style: { setProperty() {}, removeProperty() {} } },
      querySelectorAll: () => [],
      querySelector: () => element,
      getElementById: () => element,
      createElement: () => element,
      addEventListener: () => {}
    },
    window: { addEventListener: () => {} },
    setTimeout: () => {},
    location: { reload: () => {} },
    localStorage: {
      getItem: key => (key in store ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: key => { delete store[key]; }
    },
    console: Object.assign({}, console)
  };
}

/* The page is the only place the load order is written down, so the tests read
   it from there rather than keeping a second list that can drift. */
function scriptFiles() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
}

/* Loads a fresh copy of the app. Every test file gets its own, so one test
   mutating the character can't affect another. */
function loadApp() {
  const context = vm.createContext(domStub());
  const source = scriptFiles()
    .map(file => fs.readFileSync(path.join(ROOT, file), "utf8"))
    .join("\n");

  /* `function` declarations become properties of the global object, but `let`
     and `const` at the top level of a script do not -- they're lexical
     bindings the outside world can't see. `character` is one of those, and the
     app reassigns it when you switch sheets.

     So every top-level lexical is bridged onto globalThis with a live getter
     and setter. Reads see the current value rather than a snapshot, and a test
     assigning to it writes through to the real binding. Assigning to a `const`
     throws, which is swallowed -- those are read-only by nature. */
  const lexicals = [...new Set(
    [...source.matchAll(/^(?:let|const)\s+([A-Za-z_$][\w$]*)/gm)].map(match => match[1])
  )];

  const bridge = lexicals.map(name => `
    Object.defineProperty(globalThis, ${JSON.stringify(name)}, {
      configurable: true,
      get() { return ${name}; },
      set(value) { try { ${name} = value; } catch (err) {} }
    });`).join("\n");

  vm.runInContext(source + "\n" + bridge, context, { filename: "campfire.js" });

  // toasts and dice rolls are noise in tests; capture rather than render
  context.__toasts = [];
  vm.runInContext(`
    showToast = message => { __toasts.push(message); };
    showRollToast = () => {};
  `, context);

  // capture the markup any modal would have rendered
  context.__modals = [];
  vm.runInContext(`
    var __realOpenModal = openModal;
    openModal = (mode, html) => { __modals.push({ mode, html }); return __realOpenModal(mode, html); };
  `, context);

  return context;
}

function readFile(name) {
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

/* ---------- assertions ---------- */

class Suite {
  constructor(name) {
    this.name = name;
    this.passed = 0;
    this.failures = [];
    this.current = "";
  }

  section(label) { this.current = label; }

  ok(label, condition, detail) {
    if (condition) this.passed++;
    else this.failures.push({ label: (this.current ? this.current + " / " : "") + label, detail });
  }

  is(label, actual, expected) {
    const same = JSON.stringify(actual) === JSON.stringify(expected);
    this.ok(label, same, same ? "" : "got " + JSON.stringify(actual) + ", expected " + JSON.stringify(expected));
  }

  near(label, actual, expected, tolerance) {
    const within = Math.abs(actual - expected) <= (tolerance === undefined ? 0.001 : tolerance);
    this.ok(label, within, within ? "" : "got " + actual + ", expected about " + expected);
  }

  throws(label, fn) {
    let threw = false;
    try { fn(); } catch (err) { threw = true; }
    this.ok(label, threw, "expected it to throw");
  }

  runs(label, fn) {
    try { fn(); this.passed++; }
    catch (err) { this.failures.push({ label: (this.current ? this.current + " / " : "") + label, detail: err.message }); }
  }
}

module.exports = { loadApp, readFile, scriptFiles, Suite, ROOT };
