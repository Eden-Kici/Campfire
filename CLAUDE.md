# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
node tests/run.js            # every suite
node tests/run.js rests      # one suite -- the argument is a substring match on the suite name
node --check <file>.js       # syntax check a single file; there is no linter
```

Suites live in `tests/` and are registered in the `SUITES` array in `tests/run.js`. Adding a
`*.test.js` file does nothing until it is listed there.

There is **no build step and no dependencies**. Open `index.html` in a browser to run the app.

## What this is

Campfire: Player — a D&D 5e character sheet, built as a proof of concept for a mobile app. The
stated purpose is *to discover exactly what needs to be built for real later*, so the data model
matters more than the polish. Prefer changes that reveal a modelling requirement over changes that
make the demo look better.

A second app, Campfire: Game Master, is planned as a desktop counterpart. The two are intended to
sync — a player targeting an ally with Bless should push that effect onto the ally's sheet, and a
GM should be able to send items into a player's inventory. Nothing in this repo implements that
yet, but the effect-group and inventory models were shaped with it in mind.

## Architecture

### Load order is the dependency graph

Plain `<script>` tags, no modules. The list in `index.html` **is** the dependency graph, and
`tests/harness.js` reads it from there rather than keeping its own copy — so the tests always load
exactly what the page loads. Adding a file means adding it to `index.html`.

Order: reference data (`srd-*.js`, now several files — races, classes, equipment, magic items and
two halves of the spell list, split to stay under the `structure` suite's 1,500-line cap) →
character data → shared machinery (`dice-history`, `roll`, `ui`, `theme`, `characters`, `tutorial`,
`creator`, `party`, `content`, `rests`, `choices`, `help`) → one file per tab → `app.js`, which is
~50 lines of tab switching and boot.

All top-level `function` and `const` declarations share one global scope. Two files declaring the
same name is a real hazard (`let`/`const` throws at load; `function` silently shadows) — the
`structure` suite guards against it.

### Three layers

- **`srd-data.js`** — static tables only. Conditions, damage types, SRD-shaped races/classes/
  backgrounds/kits, and the fixed lists forms are built from. No functions, no DOM. This is a
  stand-in for content a real build would load rather than hardcode.
- **`character-data.js`** — the character object plus every calculation. **One DOM reference in
  1,079 lines.** This layer is the actual output of the POC and ports to any platform unchanged.
- **everything else** — UI. Template literals into `innerHTML`. None of it survives a move to a
  real framework, so don't over-invest in it.

### The render/wire cycle

Every screen is a `renderXTab()` returning an HTML string, assigned to `innerHTML`, followed by a
`wireXTab()` that re-attaches listeners. Mutate `character`, then call `renderContent()`, which
re-renders the active tab and persists. There is no event delegation — a rendered control with no
matching line in the wire function looks correct and does nothing, and no test catches that.

`renderContent()` is also where saving happens, so every mutation path gets persistence for free.

### The sources contract

Every `calculate*()` returns `{ total, sources: [{ label, value }] }`, and for the derived-plus-
override stats also `overridden: true`. The breakdown must sum to the total — several tests assert
exactly that. This is the single most valuable property of the codebase: every number on screen can
explain itself, and an effect arriving from elsewhere (eventually, another player's phone) renders
identically to one added locally.

Keep it. A calculation that returns a bare number is a regression.

## Data model conventions

These are load-bearing and easy to break:

- **Derived plus override.** Skills, saving throws, weapon proficiency and proficiency bonus are
  calculated, with an optional stored override that replaces the result and sets `overridden`.
  `undefined`/`null` means *derive it*; `false` is a real value meaning *not proficient*. The
  distinction matters — see `weaponProficiency()`.
- **Classes are the record.** `classes: [{ name, level, subclass, hitDie }]`. Total level,
  proficiency bonus, hit dice pools and the line under the character's name are all derived from
  it. Only `hitDiceSpent` is stored separately.
- **Effect groups.** `{ id, name, note, concentration, duration, effects: [{ category, value }] }`.
  Conditions, buffs and debuffs are all this shape. Dropping concentration removes whole groups, so
  nothing can outlive its cause.
- **Recharge is an object**: `{ on: "SR" | "LR" | "none" | <custom string>, amount: "all" | "half" |
  <number> | <dice> }`. Only `SR` and `LR` are restored automatically; a custom trigger is the
  player's to track, and the form says so. Resources, spell slots and hit dice all share this.
- **Stacks vs containers.** An inventory item with `.resource` is tracked. Without `refillFrom`
  it's a *stack* and `qty` is the count (`max: 0` means uncapped — shows a bare number, not
  `60/0`). With `refillFrom` it's a *container*: `loaded` is what's in it and Refill moves units
  from the named stack. See Arrows and Quiver in the demo character.
- **`categoryRules`** decides what an inventory category does:
  `{ countsWeight, appliesEffects, providesAttacks }`. Armour only contributes AC from a category
  with `appliesEffects`; weapons only appear under Attacks from one with `providesAttacks`.
  Stowing a weapon moves its category, it never deletes anything.
- **Spell slots live only in `character.spellSlots`.** Combat renders them as resource rows and
  Spells renders them per level; both read the same object.
- Resources are allowed to exceed max or go negative. That is intentional — custom content and
  table rulings need the room.

## Escaping

Everything is built by interpolating into template literals, so any user-authored text must go
through `esc()` (defined in `character-data.js`). Two failure modes, both of which have happened:

1. Forgetting `esc()` on user text — the `escaping` suite poisons every writable field and renders
   every surface to catch it.
2. Calling `esc()` on markup the app built itself, which renders the tags as visible text. The same
   suite mirrors this by asserting no escaped tags appear on clean data.

Form controls are built by the primitives in `ui.js` (`textFieldHtml`, `numberFieldHtml`,
`textAreaFieldHtml`, `fieldLabelHtml`, `fieldHtml`, `toggleLineHtml`, `selectFieldHtml`,
`comboFieldHtml`), which escape for you. Hand-writing `class="field"` or `class="toggle-line"`
outside `ui.js` fails the `structure` suite.

`selectFieldHtml` and `comboFieldHtml` exist because native `<select>` and `<datalist>` open OS
pickers on mobile. Don't reintroduce either.

## Testing

`tests/harness.js` evaluates the app in a `vm` context behind a DOM stub, and bridges top-level
`let`/`const` onto `globalThis` with live getters so tests can read and reassign `character`.

**The stub does not build a page.** `querySelectorAll` returns `[]` and `getElementById` returns a
permissive proxy, so **no listener in the app is ever invoked by the tests**. They assert markup and
calculations; wiring is untested. Bear that in mind before any change to how handlers are attached
— the suite will stay green whether it works or not.

Modals are captured rather than rendered (`app.__modals`), as are toasts (`app.__toasts`) and
`showRollToast` calls (`app.__rollToasts`). `showRollToast` is a real roll, not just a notification,
so the harness still runs the roll and its dice-history recording — only the floating element is
skipped.

The harness seeds `campfire.tutorial` as already-finished. Without it every suite's first
`renderContent()`/`showScreen()` would trip the onboarding welcome modal, exactly as a real
first-ever launch does. Tutorial tests set `tutorialState` by hand instead.

## Real vs faked

- **Real:** all calculations, effects, rests, levelling, death saves, concentration, exhaustion,
  the inventory/resource model, themes, `localStorage` persistence, the onboarding tutorial, dice
  history, and Help & Rules.
- **Real content:** races, classes, subclasses, backgrounds, feats, equipment, magic items (281),
  spells (319) and conditions are imported SRD 5.1 text, sourced from the CC-BY mirrors 5esrd.com
  and 5thsrd.org. Third-party entries carry `official: false` and render a 3PP tag. `KIT_ITEMS` is
  still a small hand-written table serving `STARTING_KIT` only.
- **Faked:** the party finder (`FAKE_PARTIES`, no networking at all) and the note sharing built on
  top of it. That's the whole list — `MENU_STUBS` is empty, and Help & Rules says outright that the
  party screen is a mockup rather than describing an intention.
- Persistence carries `SCHEMA_VERSION` and **refuses** older saves rather than half-loading them. A
  real build needs migrations; a POC only needs to notice. Tutorial progress, dice history, theme,
  settings and custom content each keep their own key, so refusing a stale character save doesn't
  take any of them with it.

## Known gaps

- `grantFeatures` dedupes by feature name, so multiclassing into a second caster grants only one
  "Spellcasting" feature.
- `traits > Proficiencies > Weapons` is flavour text duplicating the authoritative
  `weaponProficiencies` list — the last known two-sources-of-truth.
- Emoji stand in for an icon set throughout.
- `index.html` has no `<meta viewport>` and `.phone` is a fixed 390×812 box, so on a real phone it
  renders as a zoomed-out desktop page. It is a phone mockup, not yet a phone app.

## Working in this repo

- Use targeted edits. Bulk edits driven by line arithmetic have destroyed large regions of these
  files twice; check `git diff --stat` against what you expected to change.
- Run the full suite after any change. It is fast.
- Comments here explain *why*, not *what*. Match that.
