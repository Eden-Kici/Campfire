#!/usr/bin/env node
/* Runs every suite. No dependencies, no config.
   Usage:  node tests/run.js  [name]
   Passing a name runs only suites matching it, e.g. `node tests/run.js rests`. */

const { Suite } = require("./harness");

const SUITES = [
  ["calculations", "./calculations.test.js"],
  ["rests", "./rests.test.js"],
  ["resources", "./resources.test.js"],
  ["deathsaves", "./deathsaves.test.js"],
  ["concentration", "./concentration.test.js"],
  ["exhaustion", "./exhaustion.test.js"],
  ["levels", "./levels.test.js"],
  ["equipment", "./equipment.test.js"],
  ["themes", "./themes.test.js"],
  ["escaping", "./escaping.test.js"],
  ["persistence", "./persistence.test.js"],
  ["content-data", "./content-data.test.js"],
  ["structure", "./structure.test.js"],
  ["creator-fixes", "./creator-fixes.test.js"],
  ["creator-ux", "./creator-ux.test.js"],
  ["origin-rule", "./origin-rule.test.js"],
  ["combat-fixes", "./combat-fixes.test.js"],
  ["ui-fixes", "./ui-fixes.test.js"],
  ["spells-ux", "./spells-ux.test.js"],
  ["round1", "./round1.test.js"],
  ["round2", "./round2.test.js"],
  ["round3", "./round3.test.js"],
  ["party", "./party.test.js"],
  ["smoke", "./smoke.test.js"]
];

const filter = process.argv[2];
const selected = filter ? SUITES.filter(([name]) => name.includes(filter)) : SUITES;

if (!selected.length) {
  console.log("No suite matching \"" + filter + "\". Available: " + SUITES.map(s => s[0]).join(", "));
  process.exit(1);
}

let totalPassed = 0;
const allFailures = [];

console.log("");
selected.forEach(([name, file]) => {
  const suite = new Suite(name);
  const started = Date.now();

  try {
    require(file)(suite);
  } catch (err) {
    suite.failures.push({ label: "suite crashed", detail: err.stack.split("\n").slice(0, 3).join("\n      ") });
  }

  const elapsed = Date.now() - started;
  totalPassed += suite.passed;
  suite.failures.forEach(f => allFailures.push({ suite: name, ...f }));

  const status = suite.failures.length ? "FAIL" : "  ok";
  console.log(
    "  " + status + "  " + name.padEnd(14) +
    String(suite.passed).padStart(3) + " passed" +
    (suite.failures.length ? ", " + suite.failures.length + " failed" : "") +
    "   " + elapsed + "ms"
  );
});

if (allFailures.length) {
  console.log("\n  failures:\n");
  allFailures.forEach(f => {
    console.log("    " + f.suite + " / " + f.label);
    if (f.detail) console.log("      " + f.detail);
  });
}

console.log(
  "\n  " + totalPassed + " passed" +
  (allFailures.length ? ", " + allFailures.length + " failed" : "") + "\n"
);

process.exit(allFailures.length ? 1 : 0);
