# Tests

```
node tests/run.js            # everything
node tests/run.js rests      # one suite
```

No dependencies. Runs in well under a second.

## How it works

The app is three plain files a browser loads in order, with no modules and no
build step. The tests load them the same way: read the source, evaluate it in a
`vm` context with a small DOM stand-in, and assert against the markup the render
functions return as strings.

That means the tests exercise exactly what ships — there is no test-only code
path in the app, and nothing to keep in sync.

Two wrinkles worth knowing about:

- **The DOM stub renders nothing.** It answers any question the app asks without
  drawing, which is enough to run every render function and open every modal.
  What it cannot do is tell you whether something *looks* right — that still
  needs eyes on a browser.
- **Top-level `let` and `const` are bridged.** Function declarations become
  properties of the global object; lexical declarations do not. `character` is
  one of those and gets reassigned when you switch sheets, so the harness
  defines live getters and setters for every top-level lexical.

## The suites

| Suite | What it protects |
| --- | --- |
| `calculations` | Every stat that explains itself: AC, skills, saves, attacks, spell DCs. Each total is checked *and* its breakdown is checked to sum to that total. |
| `rests` | The recharge vocabulary shared by resources, spell slots and hit dice, and which effect durations survive which rest. |
| `resources` | Stacks versus containers, and that refilling a quiver conserves arrows rather than creating them. |
| `escaping` | Poisons every user-authored field with markup and quotes, then renders everything and asserts the payload never survives. |
| `persistence` | That a save round-trips every nested shape, and that an older schema is refused rather than half-loaded. |
| `smoke` | Opens every tab and every modal. Catches the most common breakage by far — a render referring to a field that moved. |

## Adding a test

A suite is a function taking the assertion object:

```js
module.exports = function (suite) {
  const app = require("./harness").loadApp();   // a fresh character each time

  suite.section("what this group is about");
  suite.is("label", actual, expected);
  suite.ok("label", condition);
  suite.near("label", actual, expected, tolerance);
  suite.runs("label", () => somethingThatMustNotThrow());
};
```

Register it in the `SUITES` list in `run.js`.

Prefer asserting on behaviour over markup. `calculateAC(character).total` is
stable; the exact HTML around it is not, and a test pinned to markup will fail
every time someone adjusts a class name.
