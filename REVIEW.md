# Campfire: Player — Review Handoff

**Written:** end of the session that added SRD spells, the onboarding tutorial, and the three
un-stubbed app-menu items.
**HEAD at time of writing:** `3affc51` — *Un-stub the app menu: Export, Dice History, Help & Rules*
**Automated suite:** `node tests/run.js` → **1203 passing, 0 failing.**

This document exists so the next reviewer doesn't start cold. It says what's been verified, *how*
it was verified, what was found, and — most importantly — **what has not been checked at all.**

Read `CLAUDE.md` first for architecture. This file is about *state and confidence*, not design.

---

## 1. The single most important thing to understand

**The 1203-test suite proves less than it looks like it proves.**

`tests/harness.js` evaluates the app behind a DOM stub that does not build a page.
`querySelectorAll` returns `[]` and `getElementById` returns a permissive proxy, so **no event
listener in the app is ever invoked by that suite.** It asserts on returned markup strings and on
calculations. A rendered button with no matching line in its `wire*()` function looks identical to a
working one, and the suite stays green either way.

So: green suite ⇒ the maths is right and the markup is well-formed. Green suite ⇏ the app works.

To close that gap, this session added a **second, throwaway testing layer** (section 3) that runs
the real app in a real DOM where listeners genuinely fire. Four agents drove it. **It found 34 bugs
in code the 1203 tests were perfectly happy with**, including two of the three worst items below.
That is the expected result, not an anomaly — it's the exact blind spot documented above.

---

## 2. Confidence by area

| Area | Confidence | Basis |
|---|---|---|
| Calculations, effects, rests, death saves, concentration, exhaustion | **High** | Real unit tests, plus live click-through confirmed ~60 core-tab behaviours |
| SRD content data (319 spells, 281 magic items, races/classes/feats/equipment) | **High** | 491 data-linting assertions; counts pinned; schools/rarities/classes validated |
| Inventory model (stacks, containers, category rules) | **High** | Live-verified: refill moves units, category rules genuinely drive AC/attacks/weight |
| Character creator | **Medium-Low** | Walks end-to-end, but 12 bugs found including double-applied racial ASI |
| Level-up | **Low** | Multiclass preview shows numbers it doesn't apply; spell slots never created |
| Spells tab + Add Spell picker | **Medium** | Picker works well; but spells can become invisible and unreachable |
| Onboarding tutorial | **Medium** | Happy path works end-to-end; edge cases leave it stuck or pointing at nothing |
| Dice history, Help & Rules | **High** | Every rule tested held up under live clicking |
| **Visual / layout / contrast** | **NONE** | ⚠️ Never checked. See section 6. |

---

## 3. The live-test harness (use this)

Checked in at `review-findings/live-dom-harness.js`. It is **not application code** — nothing loads
it, it isn't in `index.html`, and the app keeps its "no build step and no dependencies" property.
It serves the app over a local HTTP server and loads it in **jsdom** with
`runScripts: "dangerously"`, so every `addEventListener` the app attaches is live and a dispatched
click genuinely runs the handler. Needs `npm install jsdom` somewhere outside the repo.

```js
const { boot } = require('.../livetest/boot');
const a = await boot();
// a.w      -> window; top-level let/const are bridged onto it (a.w.character,
//             a.w.activeTab, a.w.creatorState, a.w.tutorialState, a.w.rollHistory …)
// a.click(sel)  -> dispatches a REAL bubbling click
// a.modal()     -> open modal's text     a.errors -> console/window errors so far
```

Two shims are applied in `beforeParse` — `Element.prototype.scrollIntoView` and
`URL.createObjectURL`. jsdom implements neither; both are real browser APIs the app legitimately
uses. **Those shims correct the test environment; they are not papering over app bugs.**

Detailed per-area findings — steps, expected vs actual, and the responsible file/function for every
bug — are in `review-findings/`: `findings-creator.md`, `findings-tutorial-levelup.md`,
`findings-spells-history-help.md`, `findings-core-tabs.md`.

**What this layer still cannot see:** anything visual. Layout, overlap, clipping, contrast,
scroll behaviour, whether a thing looks right. jsdom has no layout engine.

---

## 4. Bug inventory

34 bugs found. Nothing below has been fixed — this is a review handoff, and the agents were
instructed not to touch app files. Severities are the testing agents'; I've deduplicated across
reports and reordered by my own judgement of blast radius.

### Fix before anyone else sees the app

**H1. Racial ability score increases are applied twice — every race, every build.**
`creator.js` bakes the +2/+1 overlay into `abilities` via `finalScoreFor()`, *and* copies the race's
"Ability Score Increase" feature into `traits` with `.effects` intact, where `effectiveAbilityScore()`
adds them again. Dragonborn STR reads 19 instead of 17; Human gets +1 twice on all six. Knock-on:
max HP is computed from the *pre-effect* CON, so displayed CON and actual HP disagree. The
sources-sum-to-total contract still holds — the number being summed is just wrong.
→ *Every character ever built with this app has wrong ability scores.*

**H2. No `<meta charset="utf-8">` in `index.html`.**
`document.characterSet` resolves to windows-1252, so every literal non-ASCII byte in the JS renders
as mojibake: `Â·`, `â€”`, `âœ“`. Hits the ✓ on selected choice options, em-dashes in "From X — pick 1",
the − collapse glyph, rest toasts. Characters written as `\uXXXX` escapes survive, which is exactly
why it's inconsistent and easy to miss. One line in `<head>` fixes all of it. **Confirm in a real
browser first** — Chrome's encoding auto-detection may mask it for some users.

**H3. HTML injection in `wireCombo`'s no-match branch (`ui.js` ~line 246).**
`` `…"${input.value.trim()}" will be used as a custom entry` `` goes into `innerHTML` unescaped.
Typing `<img src=x onerror=…>` into any combo field inserts a live element. Affects every combo in
the app (Add Spell name, Add Effect / condition, Add Language). Match options *are* escaped; only
the no-match branch isn't. The `escaping` suite can't catch it because it never fires the `input`
listener. Also `comboFieldHtml` writes `placeholder="${placeholder}"` unescaped — latent, dev-fed
only today.

### High

**H4. A spell whose level has no slot entry is invisible and permanently unreachable.**
`renderSpellsTab()` builds level headers from `Object.keys(character.spellSlots)`. Add Fireball to
the demo character (who has only level 1–2 slots): it saves and persists but never renders, so there
is no row to tap and it can never be edited or deleted. It still counts toward the prepared limit —
observed "7 / 6 prepared" with 6 visible dots. Trivially reachable: the picker offers all 319 spells
with no gating.

**H5 / H6. Death-save controls are double-wired and partly dead.**
`wireDeathSaveControls()` queries `document`-wide instead of scoping to the panel it's redrawing, so
with the HP calculator open both the sheet's death card and the calculator's panel get every
handler. Each pip tap fires twice and the second hits the undo branch — tapping the 2nd success pip
yields 1; tapping the 1st is a no-op. Separately, `deathSaveControlHtml()` hard-codes
`id="roll-death-save"`, so with two panels on screen `getElementById` returns the sheet's copy and
**the calculator's "Roll Death Save" button receives zero listeners and does nothing.** Same
document-wide pattern makes the Combat tab's exhaustion stepper move by 2 after opening an
Exhaustion detail modal.

**H7. "Sleight of Hand" proficiency is silently lost.** Three different key spellings for one skill:
`skillKey()` produces `SleightofHand`, `SKILL_ABILITY_MAP` uses `SleightOfHand`, and
`applyChoiceResolution` writes the raw label `"Sleight of Hand"`. It's the only SRD skill with a
lower-case interior word, so it's the only one affected. Rogue with Expertise in it shows +4 instead
of +8.

**H8. Half-Elf "Skill Versatility" grants Expertise on skills you already have.** It shares
`kind: "skill"` with Rogue's Expertise, but needs the opposite semantics (two *new* proficiencies).
The option list is restricted to already-known skills and `applyChoiceResolution` hardcodes `= 2`.

**H9. Level-up preview shows a number it does not apply (multiclassing).** `wireLevelUp()`'s class
combo sets `levelUpState.newClass` but never calls `redrawLevelUp()`, so the whole preview renders
against the empty-name fallback (`hitDie: "d8"`). Picking Barbarian previews "Level 0 → Level 1",
"No new features", +6 HP — then Confirm applies **9** HP and grants Rage. The user confirms a
number that isn't the number applied.

**H10. `castSpell` throws and silently eats a slot** when a spell's `classSource` doesn't match a
caster class (`cls.ability` on undefined). The decrement happens before the throw and the re-render
after it, so the model loses a slot while the screen still shows the old count.

### Medium

- **No path in the app ever creates a spell slot.** `applyLevelUp()` never touches
  `character.spellSlots` and the creator ships `{}`. A creator-built Wizard levelled to 20 has zero
  slots forever. Combined with the creator setting up no `spellcasting.classes` either, **"create a
  Wizard" does not produce a usable Wizard.**
- **Every class is forced to pick a subclass at level 1.** Per SRD only Cleric/Sorcerer/Warlock do.
  `creatorStepKeys()` gates on `subclassesForClass().length` with no level check, and the step shows
  the subclass's entire level 3–18 feature list as if you were getting it now.
- **Custom races and classes are unreachable from the creator** — `raceStepHtml`/`classStepHtml` map
  `SRD_RACES`/`SRD_CLASSES` directly. Custom *subclasses* work (they go through
  `subclassesForClass()`). So you can author a race no character can be built with.
- **One stray backdrop tap discards the whole wizard**, no confirmation. Compounded by the Race step
  having no Back button and no Cancel/X anywhere, so the backdrop is the only exit.
- **A second concentration effect can be started with no prompt.** Data-model gap, not just UI —
  nothing in `character-data.js` enforces the cap either.
- **ASI choices are uncapped at 20.** Taking Strength +2 at every Fighter ASI reached an effective 32,
  despite the feature text saying "Can't exceed 20". The level-10 second-fighting-style list also
  isn't filtered against the one already taken.
- **Attack cantrips can never be edited or removed** — the row click always rolls, and cantrips render
  no dot and no Cast button, so `openSpellDetailModal` is unreachable for them.
- **Spell attack/DC boxes are dead for class names containing `&`, `<`, `>` or `"`** — the selector
  searches for the encoded value while the parsed DOM holds the decoded one.
- **Tutorial: the fifth tab's banner never shows.** `renderTutorialOverlay()` marks the tab seen and
  flips to `actions` in the same pass, so whichever tab is visited last is never explained.
- **Tutorial: the actions phase tells a Fighter to cast a spell**, with no glow target on screen.
  `TUTORIAL_ACTIONS` has no "does this target exist?" filter.
- **Tutorial: a welcome/done modal dismissed by ✕ or backdrop comes straight back**, because
  `closeModal()` doesn't touch `tutorialState`. The welcome modal then reopens on *every*
  `renderContent()` — and since `openModal()` starts with `closeModal()`, it evicts whatever the user
  had open.
- **Tutorial: closing the creator mid-`creation` leaves it invisible and unskippable** — no banner, no
  modal, no Skip button anywhere, on a screen with no app menu.

### Low

- HTML entities leak into native `confirm()` dialogs — `esc()` applied to plain text
  (`tab-inventory.js`, `tab-character.js`). CLAUDE.md's documented failure mode #2.
- App menu hint reads "1 rolls" — no singular case.
- Multiclass level row reads "Level 0 → Level 1". There is no level 0.

---

## 5. What *is* solid

Worth stating plainly, because the list above is long and unbalanced without it. Live-verified:

- HP arithmetic, expression input, temp-HP-absorbs-first, caps, massive-damage instant death.
- Death save pips / undo / stable / dead — *when the calculator isn't also open*.
- Conditions and exhaustion applying real effects with correct breakdowns.
- Concentration dropping removing the whole effect group.
- Attack rolls, grip, off-hand, and stow-not-delete.
- Resources over max and negative (intentional), and full short/long rest behaviour including a
  custom-recharge resource correctly *not* restoring.
- Category rules genuinely driving AC, attacks and weight; the Arrows/Quiver stack-vs-container refill.
- All Character and Notes CRUD; Manage Content browse/search/duplicate/create/delete.
- A custom subclass actually reaching the creator's Subclass step.
- The Add Spell combo: `pointerdown` picks fill level/casting time/class/attack toggle/description,
  and `setSelectValue` keeps hidden input and visible label in sync.
- Dice History on every rule tested: newest-first, reroll appends, DC rolls don't log until rolled,
  50-cap, persistence, mixed-character naming.
- Help & Rules: strictly single-open accordion, and the conditions search genuinely preserves focus.
- The creator's Next-guards, choice accordion, choice-clearing on race/class switch, skill mutual
  exclusion, point-buy, and `pendingChoices: []` on completion.
- **Zero uncaught exceptions or console errors in any scenario across all four agents.**

---

## 6. ⚠️ Not checked at all: the visual pass

**No one has ever looked at this app's rendered pixels in a review capacity.** jsdom has no layout
engine, so every finding above is logic-only.

I attempted this and was blocked: the Chrome extension connects, but `navigate` forces an `https://`
scheme onto `file://` URLs, and Chrome extensions additionally need *"Allow access to file URLs"*
explicitly enabled at `chrome://extensions`. Worth retrying — enable that toggle, or serve the folder
(`python3 -m http.server` in the repo directory) and point the browser at `http://localhost:8000`,
which sidesteps the scheme problem entirely. **Note that serving it over HTTP with a proper
`Content-Type` may also mask bug H2** — check the charset issue via `file://` too.

Specific things to look at, highest-suspicion first:

1. **The inline tutorial banner inside the character creator.** The creator modal is already 94% of
   the phone height; a banner was prepended to its content. Does it crowd the wizard, and are
   Back/Next still reachable without awkward scrolling?
2. **The tab-tour banner** in `#tutorial-overlay`, which sits between `#content` and the tab bar.
   Does it push the tab bar off-screen? Is `.tutorial-glow` visible and on the right element?
3. **The Draconic Ancestry accordion** — 10 options, long descriptions. Clipping? Overflow?
4. **Light theme contrast.** Most likely place for an unreadable-text problem.
5. **Help & Rules conditions tab** — long descriptions, check wrapping.
6. **Manage Content → Spells** — 319 rows, check the list scrolls sanely.
7. **The Add Spell suggestion dropdown** — it renders in normal flow specifically so a modal can't
   clip it. Verify that actually holds.
8. **Confirm H2 (mojibake)** visually — this is the fastest way to know if it's real for end users.

---

## 7. Known and accepted — do **not** report these as bugs

From `CLAUDE.md`'s own Known Gaps, plus deliberate POC scope:

- **It is a phone mockup, not a phone app.** `.phone` is a fixed 390×812 box and there's no
  `<meta viewport>`, so on a real phone it renders as a zoomed-out desktop page. Known.
- **Emoji stand in for an icon set** throughout. Known.
- **The party finder and note sharing are entirely faked** — `FAKE_PARTIES`, no networking at all.
  This is the only remaining faked feature, and Help & Rules says so outright in-app.
- `grantFeatures` dedupes by feature name, so multiclassing into a second caster grants only one
  "Spellcasting" feature.
- `traits > Proficiencies > Weapons` is flavour text duplicating the authoritative
  `weaponProficiencies` list.
- Persistence **refuses** older saves rather than migrating them. A real build needs migrations; a
  POC only needs to notice.
- Resources are allowed to exceed max and go negative. Intentional — custom content and table
  rulings need the room.

---

## 8. Suggested order of work

1. **H2 (charset)** — one line, and it makes everything else easier to look at. Verify in a browser first.
2. **H1 (double ASI)** — corrupts every character; the longer it stands the more saved characters are wrong.
3. **H3 (combo injection)** — small, contained, and it's a security hole.
4. **H5/H6 (document-wide `querySelectorAll` in wiring)** — one root cause, three symptoms; fixing the
   pattern fixes death pips, the dead Roll button, and the exhaustion stepper together. Worth grepping
   for the same pattern elsewhere.
5. **The spell-slot hole** (H4 + the "nothing ever creates a slot" medium) — decide the model first, then fix both.
6. **The visual pass** (section 6) before beta testers, since it's pure unknown.
7. Everything else.

A note on process: the live-DOM layer found these in about an hour of agent time. Whatever gets
fixed, **re-run that layer rather than trusting the 1203 tests** — they were green for every single
bug in this document.
