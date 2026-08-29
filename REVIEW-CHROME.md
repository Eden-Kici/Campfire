# Campfire: Player — Chrome/Chromium review pass

> **Status: superseded by the fix pass.** Everything in sections 3-5 below has since
> been fixed on top of `731baa2`, except the items listed under "Deferred" in that
> commit's notes. Suite went 1203 -> 1357. This file is kept as the record of what a
> real browser found and how, not as an open to-do list.

**Written:** the session that finally did the visual pass `REVIEW.md` §6 marked as never checked.
**HEAD:** `731baa2` — *Review handoff: REVIEW.md + live-DOM findings*. Working tree clean.
**Automated suite:** `node tests/run.js` → **1203 passing, 0 failing** (unchanged).
**New layer:** real Chromium via Playwright, `file://`, 430×880 @2x, all three themes.
Four agents drove it. **Zero uncaught exceptions in any run** — that part of the handoff holds.

Read `CLAUDE.md` for architecture and `REVIEW.md` for the logic review this builds on. This file is
about **what a browser sees that jsdom could not**, plus verification of every H-bug on the old list.

---

## 1. Headline

`REVIEW.md` §6 said the rendered pixels had never been reviewed. They have now.

**Nothing on the old bug list was refuted.** All ten H-items and every Medium reproduce in a real
browser. Several are worse than described. The visual pass added one Fix-First item that outranks
most of the existing list, and it is not a bug in any single feature — it is the light theme.

**The one genuinely new insight:** H2 (missing `<meta charset>`) is **not cosmetic**. It silently
breaks live code. Two `=== "—"` comparisons compare an escaped em-dash against a *literal* one
that the browser decoded as windows-1252 into three characters, so the branch is permanently dead:

- `tab-combat.js:182` tries to suppress the recharge tag on resources that don't recharge. It never
  matches, so **"Arrows" and "Quiver" render a garbage `â€"` tag** the code was written to hide.
- `tab-inventory.js:620` has the identical comparison for item detail "Recharges" rows.

So H2 is a one-line fix that repairs glyphs across ~15 screens *and* two dead branches. It should be
commit #1, exactly as `REVIEW.md` suggested — but for a stronger reason than it knew.

**Chrome does not rescue you.** `REVIEW.md` hedged that Chrome's encoding auto-detection might mask
H2. It does not: `document.characterSet === "windows-1252"` in Chromium over `file://`, and the
mojibake is on the Combat tab, first screen, before any interaction.

---

## 2. Confidence table, revised

| Area | Was | Now | Why it moved |
|---|---|---|---|
| Calculations, rests, death saves, concentration, exhaustion | High | **High** | Spot-checked 12 behaviours in Chromium; all held |
| SRD content data | High | **High** | Unchanged |
| Inventory model | High | **High** | Unchanged |
| Character creator | Medium-Low | **Low** | H1 confirmed with exact numbers; 7 new findings |
| Level-up | Low | **Low** | H9 confirmed; applied numbers differ from the old report |
| Spells tab + picker | Medium | **Low** | H4 + H10 + dead stat boxes + creator-built casters unusable |
| Onboarding tutorial | Medium | **Low** | Modal eviction is worse than documented |
| Dice history, Help & Rules | High | **High** | Every functional rule held; both have layout problems only |
| **Visual / layout / contrast** | **NONE** | **Medium** | Done. Ember and fantasy are fine. **Light theme is broken.** |

---

## 3. Fix first

### C1 (new). Light theme has no cards. `--frame` and `--surface` are both `#FFFFFF`.

`style.css:96-100`. Every surface in the app is `var(--surface)` sitting on `var(--frame)`, with
`border-width: 0`. In ember the contrast ratio between them is 1.062, in fantasy 1.082 — subtle, but
it reads. **In light it is 1.000. Pixel-identical.** Not "flat" — *absent*.

Measured at 1.000 in light: `.char-card`, `.hp-card`, `.stat-box`, `.res-row`, `.collapse-card`,
`.item-row`, `.skill-card`, `.member-row`.

Genuinely broken screens (structure is lost, not just charm):
**the character selector** — the first screen of the app, where the only character is a tappable card
with no visible boundary; **Combat** — HP card, the six-box stat grid, exhaustion, concentration and
every resource row merge into one white sheet; **Spells**; **Inventory** — rows keep their card
padding but lose their cards, so it reads as a sparse list with unexplained gaps; **Party roster**.

Flat but usable: Character, Notes, Manage Content, Dice History. Actually fine: the creator and the
Options/Theme sheets, because their controls use `--control` (`#F1EDE6`) rather than `--surface`.

Two things make this worse than a palette slip. The Theme modal shows "Background" and "Cards" as two
identical white swatches, so the picker cannot show the user the cause. And a related bug is
**theme-independent**: `.modal-box` is also `--surface`, so `.collapse-card` measures 1.000 inside
every modal in *all three* themes — Help & Rules' accordion has no card background anywhere.

Fix is a palette change (`--surface: #FAF7F2` or a hairline `--border`), not a structural one.

### H2. No `<meta charset="utf-8">`. Confirmed, and it breaks logic.

See §1. `document.characterSet` is windows-1252. Files mix `\uXXXX` escapes (safe) with literals
(broken), which is why the same glyph renders correctly and incorrectly on one screen —
`tab-combat.js` uses `−` in the HP calculator keypad and a literal `−` in the exhaustion stepper
directly below it.

Places it is visible, observed not inferred: Combat exhaustion stepper `âˆ'` · Arrows/Quiver recharge
tags `â€"` · language chips and weapon property chips `âœ•` · **every select caret in the app** `âŒ„`
(`ui.js:167` — three garbled carets on one Add Spell screen) · every combo's "No match â€"" ·
the roll window's reroll `â†»` and its mode text · **every row in Dice History**, twice (`Â·`) ·
Help & Rules' open-accordion indicator `âˆ'` · the creator's choice cards (`â€"`, `âˆ'`, `âœ"`) ·
inventory item delete `ðŸ—'` · every Party roster line `Â·` · **the entire Level Up modal**
(`Level 8 â†' 9`, `Fighter (Champion) 4 â†' 5 Â· d10`) · Short Rest's `Â½ LR` tags · most toasts.

One line in `<head>`.

### H1. Racial ASI applied twice. Confirmed with exact numbers.

Dragonborn Fighter, base STR 15, wizard's +2 → STR:

| | wizard's Ability step | resulting sheet |
|---|---|---|
| STR | 17 | **19** (mod +4) |
| CHA | 9 | **10** |

Human inflates all six by 1 (wizard `17/14/14/12/10/8` → sheet `18/15/15/13/11/9`).

`creator.js:826` bakes `finalScoreFor()` into `abilities`; `asTraitEntry` (~`:848`) carries the
race's `Ability Score Increase` feature into `traits["Race Traits"]` with `.effects` intact;
`character-data.js:662 effectiveAbilityScore()` adds them again.

**The HP half is confirmed too.** Hill Dwarf Fighter (Dwarf CON +2): wizard shows CON 14, sheet shows
CON **16** (+3), and `baseMaxHP = 12` = d10 + `abilityModifier(14)`. Should be 13. The Combat tab
reads `12 / 12` while the Character tab says CON 16. Cause is `creator.js:868` reading pre-effect CON.

And it stacks past the cap: the wizard's stepper clamps at 20, then the race effect pushes the
effective score to **22** on a level-1 character.

### H3. Combo injection. Confirmed, executing.

`ui.js:246`, the `No match` branch of `wireCombo`'s `draw()`, into `innerHTML`. The match branch one
line above *is* escaped — the split is exactly as reported. Typing
`<img src=x onerror="window.__pwned=1">` into Add Spell's name field set `window.__pwned === 1`; a
second payload rewrote the modal heading to `XSS OWNED`. Fires in all three named combos (Add Spell,
Add Language, Add Effect → Condition), and by the same code path in `tab-inventory.js` and
`rests.js`.

**Calibration the old report didn't make:** a payload *saved* as a spell name is escaped on render, so
this is self-XSS / paste-driven, not stored-XSS. It still runs arbitrary JS in an origin holding
every saved character. `comboFieldHtml`'s unescaped `placeholder` is real but has no live vector
today — all eight call sites pass literals.

### H5/H6. Document-wide wiring. Confirmed, and it is *two* live symptoms, not three.

`tab-combat.js:70 wireDeathSaveControls()` queries `document`-wide. With the HP calculator open:

| action | expected | observed |
|---|---|---|
| sheet 2nd success pip from 0/0 | 2 | **1** |
| sheet 1st success pip from 0/0 | 1 | **0 (no-op)** |
| calculator "Roll Death Save" | rolls | **nothing — 0 listeners** |
| calculator "Clear" | clears | **nothing — 0 listeners** |

Both hard-coded ids are duplicated, so the calculator's **Clear** is dead too, not just Roll. And the
calculator's pips misbehave **even with no sheet card on screen**, because `redrawDeathPanel()` wires
the panel and then calls `renderContent()`, whose `wireCombatTab()` reaches back into the open modal.
The calculator's death panel also goes stale — model 2 failures, sheet card 2 pips, calc panel 0.

The exhaustion symptom is real but the reported trigger is wrong. It is not the Exhaustion modal —
`openEffectDetailModal` (`tab-combat.js:787`) queries `[data-exhaustion-step]` unconditionally, so
**any condition chip** adds a listener, cumulatively: baseline +1, after one chip +2, after four +4,
with a stacked toast per listener.

A full sweep found no third live instance. Every other duplicate-id site is safe because `openModal()`
closes the previous overlay first. `wireHitDiceCalcRows` and `renderFeatureEffectsList` already use
the correct scoped pattern — the author knew it.

---

## 4. Corrections to REVIEW.md

Worth recording, because the numbers were used to argue severity.

- **H9's numbers are off.** Picking Barbarian previews **+7** max HP (d8 average 5 + CON 2), not +6,
  and applies **+9**. It grants **two** features (Rage *and* Unarmored Defense), not one. The preview
  also shows `2d8 → 3d8` and "The fixed average for a d8 is 5". Root cause is as reported —
  `rests.js:495` sets `levelUpState.newClass` without `redrawLevelUp()`, unlike every other control
  in that function. Extra trap: the combo's placeholder is `available[0]`, so the empty field reads
  as a greyed-out "Barbarian" and the stale preview looks like it belongs to it.
- **H4's "7 / 6 prepared" reproduces exactly**, through the real Add Spell UI. Confirmed that
  *nothing anywhere ever creates a `spellSlots` key*, so the level-3 bucket can never be conjured to
  expose the spell. The picker offers all 319 with no gating, on a level-1 Wizard too.
- **"Create a Wizard" is worse than "does not produce a usable Wizard".** A creator-built Wizard has
  `spellSlots: {}`, `spellcasting.classes: []`, and its **Add Spell form has an empty Class select**,
  so every spell added gets `classSource: ""` — which makes it invisible if `level > 0`, and is the
  exact precondition for H10's crash if the attack toggle is on. Four level-ups later: still `{}`.
- **H10 confirmed**, with the divergence visible: model went 3 → 2 → 1 while the UI kept reading
  `3/4 slots`, then "teleported" to `1/4` on the next unrelated render. No toast, no dice, nothing.
- **"Entities leak into `confirm()`" is three files, not two.** `tab-notes.js:294` has the identical
  defect alongside `tab-inventory.js:576` and `tab-character.js:403`. The call sites are category and
  section deletion, not item deletion.
- **Concentration cap:** confirmed nothing enforces it — but note `help.js:39` tells the user
  *"starting a second asks before dropping the first."* The in-app docs describe a feature that was
  never written.
- **Custom races/classes unreachable:** confirmed end-to-end through Manage Content. Custom
  *subclasses* do reach the creator, as claimed.

---

## 5. New findings

### Creator

- **ASI is uncapped and effects stack.** STR went 19 → 21 → 23 → 25 across three ASIs with no
  warning, on a feature whose own text says "Can't exceed 20". Worse: the level-10 second-fighting-
  style list isn't filtered, and **picking Defense twice creates two `Fighting Style: Defense` trait
  entries that both apply — measured AC 17 → 19.** `grantFeatures` dedupes by name, but
  choice-applied entries bypass it.
- **The step counter lies and mutates mid-wizard.** Race opens "Step 1 of 6"; pick Half-Elf → "of 7";
  pick Wizard → "of 9". `creatorStepKeys()` is recomputed every render.
- **Scroll position carries between steps.** `.modal-box` is never reset on `redrawCreator()`, so
  Next can land you at scrollTop 106 with the step heading already scrolled off.
- **The Class step also lists all 20 levels of features with no level shown** — same root cause as
  the subclass-step complaint. A Wizard applicant sees "Spell Mastery" and "Signature Spells" in the
  same undifferentiated list as Arcane Recovery.
- **The subclass step's own tutorial banner contradicts the app**: "Not every class picks a subclass
  at level 1 — this step only appears when yours does", on screen while a Wizard is forced to pick.
- **Toasts render over the thing they describe.** "Created Draco Test" covers the character's name in
  the header on the frame the creator hands you the sheet.

### Tutorial

- **Modal eviction is nastier than documented.** Real path, no synthetic calls: dismiss the welcome
  modal with ✕ → app menu → Options → tap "Always show death saves". That handler ends in
  `renderContent()`, which re-renders the tutorial, which calls `openModal()`, which closes the
  Options sheet. There are **86 `renderContent()` call sites**. The `done` modal is worse — `active`
  is only cleared inside its `onNext`, so ✕ leaves `{active: true, phase: "done"}` **forever**.
- **The tab counter is not progress.** Out-of-order visits produce "TAB 5 OF 5" second and
  "TAB 2 OF 5" fourth.
- **The stuck-creator escape silently eats the creation lesson.** Opening an existing character flips
  `creation → tabs` with no acknowledgement, so the user never sees any of the nine
  `TUTORIAL_CREATOR_STEPS`. A user who deleted the demo character has only one route out: re-enter
  the wizard.
- **The tutorial glow is clipped by the phone frame.** `.tutorial-glow` uses `outline` with an
  animated offset; on a `.tab-item` it runs under `.phone`'s `overflow:hidden` 30px corner radius.
  The tab tour's only pointing device is visibly broken on all five tabs.
- **"Skip Tutorial" fails contrast in all three themes** — 2.55 (ember) / 2.97 (fantasy) / 2.58
  (light) against a 4.5:1 floor. It is the tour's only escape hatch and reads as disabled body text.
- The banner costs 23% of content height and re-renders on every step; the creator's Half-Elf race
  step reaches 3.2 screenfuls of scroll to reach Next. Nothing clips or overflows, and the tab bar is
  never pushed off-screen — that specific worry in `REVIEW.md` §6 is **refuted**.

### Layout

- **Toast stacking is broken.** `roll.js:165` uses a fixed 78px stride, but a 3–4 line toast is
  taller, so stacked toasts overlap. `.roll-toast` is `z-index: 200` vs `.modal-overlay`'s `100`, so
  any toast raised while a modal is open lands on the modal's title.
- **"Confirm Level Up" is off-screen** whenever "Take a level in something new" is selected.
- **The HP calculator overflows the viewport** — Hit Dice and Death Saves are entirely below the
  fold, so the (dead) Roll Death Save button is only reachable by scrolling inside the modal. Its
  dice row is a 4-column grid holding 6 dice, so d12/d20 sit alone on a second row.
- **The Quiver row wraps and collides** — the `HOLDS Arrows` tag breaks to a second line while the
  Refill pill stays on the first.
- **Dice History long names touch the total** — `.res-row` is `space-between` with no `gap`; measured
  0px between the label's right edge and the value's left edge.
- **Death-save pips are ~28px**, under the 44px tap-target floor, and nearly outline-less in light.
- **Scrolled content clips mid-glyph** under the opaque sticky header with no fade. Harmless-looking
  in dark themes; reads as a rendering fault in light.
- **The Add Spell dropdown design claim holds** — in-flow, 176px, scrolls internally, never clipped
  by the modal. Two nits: focusing Name shoves the rest of the form down ~180px, and the 176px window
  cuts the 5th row mid-glyph with no scroll affordance.
- **Manage Content → Spells is fine** — 319 rows, ~600ms, scrolls cleanly.

### Data integrity

- `creator.js:78`'s import validates only `parsed.name && parsed.abilities` before pushing into
  `savedCharacters`. This is what makes H10's mismatched `classSource` and the `&`-in-class-name bug
  reachable rather than theoretical — a shared character file is enough.
- **Death doesn't drop concentration.** Three failures leaves "Concentrating · Bless" intact.

---

## 6. Revised order of work

1. **H2 charset.** One line. Fixes ~15 screens of mojibake *and* two dead branches. Do it first.
2. **C1 light theme palette.** `--surface` must differ from `--frame`, and `.collapse-card` needs its
   own treatment inside modals in all themes. Cheap, and it is the difference between "a theme" and
   "a broken theme" on the app's first screen.
3. **H1 double ASI.** Corrupts every character ever built. Strip `.effects` from the race's ASI
   feature in `asTraitEntry`, or stop baking the overlay into `abilities` — pick one owner. Fix
   `creator.js:868` to read the post-effect CON in the same commit.
4. **H3 combo injection.** Small, contained, and it is a security hole.
5. **H5/H6 scoped wiring.** One pattern, two live symptoms. Scope the queries to the panel and stop
   hard-coding ids in a builder that renders twice.
6. **The spell-slot hole** — H4, "nothing ever creates a slot", and the empty Class select are one
   design decision, not three bugs. Decide the model, then fix them together. Until then the creator
   cannot produce a working caster, which is a bigger hole than any single item above.
7. **Tutorial lifecycle** — `closeModal()` must clear `tutorialState`. The eviction bug makes the app
   feel broken to a first-time user, which is precisely the audience the tutorial exists for.
8. Everything else, roughly in the order listed in §5.

---

## 7. How to re-run this

The Chromium harness is not checked in and does not need to be — it is ~40 lines and has no bearing
on the app's no-build-step property. Rebuild it with:

```bash
npm install playwright                # chromium at /opt/pw-browsers, or npx playwright install chromium
node drive.js <script.js> <outDirName>
```

`drive.js` launches Chromium at 430×880 @2x, loads `index.html` over `file://`, collects console and
page errors, and hands the script `{ page, ctx, browser, shot, errors }`. Top-level `let`/`const` in
the app are reachable as `page.evaluate(() => character)` because there are no modules.

**Test over `file://`, not a local HTTP server.** A server that sends
`Content-Type: text/html; charset=utf-8` masks H2 entirely — and `file://` is how this app is
actually opened.

The old advice stands and now has a second layer: the 1203 tests were green for every bug in
`REVIEW.md`, and the live-DOM layer was blind to every bug in §3 C1 and §5 Layout above. Three layers
now, each blind to what the last one caught.
