# Live-DOM findings — onboarding tutorial + level-up

Driven in jsdom against the real app (`boot.js` / `t8.js` seeded-localStorage variant), every
listener live. Scripts: `t1.js`–`t10.js` (tutorial), `l1.js`–`l5.js` (level-up).
No app file was modified. `a.errors` was empty in **every** scenario below — nothing throws.

---

## CONFIRMED WORKING

**Tutorial**
- Fresh boot (no `campfire.tutorial` key) auto-opens the welcome modal on the selector screen and
  writes `{active:true,phase:"welcome",...}` to localStorage immediately.
- "Start Tutorial" flips phase to `creation` *and* opens the character creator in one tap.
- The inline banner renders inside the creator modal and its title tracks `currentStepKey()`
  exactly: Race → Class → Subclass → Background → Ability Scores → Skills → Equipment →
  Finishing Touches (walked a Dragonborn Fighter through all eight; every step matched
  `TUTORIAL_CREATOR_STEPS`). Skip button present on each.
- Completing a character lands on the sheet and flips `phase` to `tabs` (verified both via the
  creator and via re-opening an existing character from the selector).
- Tabs phase: floating banner lands in `#tutorial-overlay`, eyebrow counts "Tab N of 5" using
  `TUTORIAL_TAB_ORDER`, and `.tutorial-glow` lands on exactly one element — the matching
  `[data-tab=...]` button, every time. Auto-advances to `actions` on the fifth tab.
- Actions phase on the demo character: all three banners appear in order, glow targets
  (`[data-roll-tohit]`, `#hp-card`, `[data-spell-cast]`) all exist and resolve to one element;
  the "Head to the X tab" nudge glows the right tab button; three "Got It" taps advance to `done`.
- Done modal: "Got It" sets `active:false` and persists; overlay ends empty, no glow, no modal.
- Skip Tutorial from welcome / creation / tabs / actions: all four clear the banner, clear the
  glow, leave no dangling modal, and persist `active:false`.
- Skipping mid-creator correctly redraws the wizard in place — banner gone, wizard step intact,
  creator stays open (`skipTutorial()`'s `redrawCreator()` branch does fire).
- Replay Tutorial (`#menu-tutorial`) closes the drawer, resets to `welcome` and reopens the
  welcome modal. Drawer hint reads "in progress" while active.
- Persistence across a reload is genuine: seeded `tabs`/`actions`/`creation` states all resume
  with `seenTabs`/`seenActions` intact and the right banner on the right tab.

**Level-up**
- Existing class (demo Fighter 4→5): class entry, total level, header class line, `baseMaxHP`
  (+8 = d10 average 6 + CON 2), current HP, hit-dice pool (4d10→5d10), proficiency bonus (3→4)
  and Class Features (Extra Attack added) all update, modal closes, toast fires.
- Multiclass: new `{name, level:1, subclass:null, hitDie}` entry appended, total level and class
  line correct, new hit-die pool created, level-1 features granted (Rage / Unarmoured Defense,
  Rogue Expertise).
- Choices granted by the level are asked immediately in the same flow (Fighter 4 ASI, Fighter 10
  second Fighting Style, Rogue 1 Expertise) and `character.pendingChoices` is empty afterwards.
- Guards all work live: "Roll for hit points first", "Enter the hit points gained", "Pick a class",
  "You already have levels in X" (case-insensitive), manual-HP over-die warning, and the manual
  total row updating in place without stealing focus.
- 1 → 20 in a single class (fresh Fighter, 19 consecutive level-ups): no exception, HP +8 every
  level, hit-dice pool ends 20d10, `pendingChoices` empty at every step, and proficiency bonus
  follows 5e exactly (+2 @1-4, +3 @5-8, +4 @9-12, +5 @13-16, +6 @17-20).
- A typed non-SRD class name ("Warlord") multiclasses cleanly as a custom entry at d8.

---

## BUGS

### 1. HIGH — Level-up "What you gain" panel is stale for a new class; the HP it promises is not the HP you get
`rests.js`, `wireLevelUp()`:
```js
wireCombo("levelup-new-class", ..., value => { levelUpState.newClass = value; });   // no redrawLevelUp()
```
Every other control in the modal (`[data-levelup-target]`, `[data-hp-mode]`, `#levelup-roll`)
redraws; the class combo does not. So the whole preview is rendered against `newClass === ""`,
i.e. `levelUpTarget()`'s fallback (`name: "—"`, `srd: undefined`, `hitDie: "d8"`).

Steps: menu → Level Up → "Take a level in something new" → pick **Barbarian** from the dropdown.
- Expected: "Level 1 · Barbarian", features Rage + Unarmoured Defense, hit dice `0d12 → 1d12`,
  "The fixed average for a d12 is 7", Maximum hit points 62 → 71.
- Actual: "Level 0 → Level 1", "No new features at this level.", "Hit dice 2d8 → 3d8",
  "The fixed average for a d8 is 5", "Maximum hit points 62 → 69".
  Confirm then applies **9** HP (d12 average 7 + CON 2), not the 6/69 shown.

The user is shown, and confirms, a number that is not the number applied. It also silently
suppresses the `Saving throws / Armour / Weapons` rows the code builds for `target.isNew`, and the
features list, for every multiclass. One-line fix: `redrawLevelUp()` in the combo's onChange
(re-focus the input afterwards, since the combo is a text input).

### 2. MEDIUM-HIGH — Levelling up never touches `character.spellSlots`
`applyLevelUp()` (`rests.js`) adjusts classes, HP and features and nothing else. Verified: Wizard
2→3 on the demo character left `spellSlots` byte-identical; multiclassing into a full caster added
no slot levels at all. Combined with the creator, which ships `spellSlots: {}` for every character
it builds (`creator.js:923`), and the fact that both the Combat and Spells tabs only iterate
`Object.keys(character.spellSlots)` — **there is no path in the app that ever creates a slot
level.** A Wizard built in the creator and levelled to 20 has zero spell slots forever, and the
level-up modal never mentions them. The file's own header comment predates the feature list
(it says level-up "deliberately does NOT grant the features of the new level", which it now does),
so this looks like an oversight rather than a documented gap.

### 3. MEDIUM — The fifth tab's tutorial banner is never shown
`renderTutorialOverlay()` marks the tab seen and, in the same pass, sees all five in `seenTabs`
and flips to `actions` before `tutorialContentFor()` runs. Visiting Combat → Character → Spells →
Inventory → Notes shows banners 1–4; on Notes the banner that appears is already the `actions`
phase "One more to try". Whichever tab is visited last never gets explained — on the natural
left-to-right order that is always Notes. Expected: show "Tab 5 of 5 · Notes", advance on the
*next* interaction.

### 4. MEDIUM — Actions phase tells a non-caster to cast a spell, with nothing to point at
The tutorial's own happy path (Welcome → build a character → tabs → actions) most commonly ends
with a martial class. Built a Human Fighter through the tutorial, walked the tabs, reached
`actions`: on the Spells tab the banner reads "Cast a spell — Tap Cast on a leveled spell to roll
it and spend a slot" while the tab reads "Cantrips — Nothing here" and
`document.querySelectorAll('.tutorial-glow').length === 0`. `TUTORIAL_ACTIONS` is a fixed list
with no `when` predicate. The banner should be filtered out when its `target` does not exist
(that filter also fixes the `[data-roll-tohit]` case for a character with no attacks).

### 5. MEDIUM — A modal-phase tutorial banner dismissed by the ✕ or the backdrop comes straight back
`welcome` and `done` are real modals opened by `renderTutorialOverlay()`, but `closeModal()` does
not touch `tutorialState`. Only the modal's own "Start Tutorial"/"Got It"/"Skip Tutorial" buttons
change state, and `openModal("center", …)` gives every centre modal a ✕ plus backdrop-to-close.
- Welcome: ✕ or backdrop → `active` stays `true`, `phase` stays `welcome`. The modal then reopens
  on **every** `showScreen()`/`renderContent()` — open a character and it is there on the sheet;
  go back and it is there on the selector. Verified both.
- Done: ✕ → reopens on the next tab switch. Verified.
Since `openModal()` starts with `closeModal()`, a re-fired tutorial modal will also evict whatever
modal the user has open at the time (any mutation path ends in `renderContent()`).

### 6. MEDIUM — Closing the creator mid-`creation` leaves the tutorial invisible and unskippable
Welcome → Start Tutorial → drag/tap the creator's handle to close it. `tutorialState` stays
`{active:true, phase:"creation"}`, `tutorialContentFor()` returns `null` (no `creatorState.started`
after a fresh creator, or the creator simply isn't on screen), `#tutorial-overlay` is empty, and
the selector screen has no app menu — so there is no banner, no modal, and **no Skip button
anywhere**. Same state after a reload seeded with `phase:"creation"`. It is recoverable (opening
any character flips it to `tabs`, and New Character re-opens the wizard with the banner), but a
first-run user who backs out of the wizard is left with a silently-running tour and no affordance.

### 7. MEDIUM — ASI choices are uncapped (level-up path)
Taking "Strength +2" at every Fighter ASI (4, 6, 8, 12, 14, 16, 19) drove STR to a raw 17 → an
effective **32**, despite the feature text in `srd-classes.js` reading "Can't exceed 20". Nothing
in `applyChoiceResolution()`/the Ability Score effect clamps at 20. Also, the level-10 "Choose a
second fighting style" list is not filtered against the style already taken, so Class Features can
end up with two identical "Fighting Style: Defense" entries.

### 8. LOW — Multiclass preview mislabels the level row
`changes.push(["Level", "Level " + target.from + " → Level " + target.to])` renders
"Level 0 → Level 1" for a brand-new class. There is no level 0.

---

## SUSPICIOUS / NEEDS HUMAN EYES

- **Mojibake in the level-up modal.** `Level 8 â†’ 9`, `Â·`, `â€”` throughout — `index.html` has no
  `<meta charset>`, so UTF-8 arrows/middots/em-dashes in `rests.js` render as Latin-1. Visible in
  the modal text, the class rows and the level-up toast. Not tutorial/level-up-specific (it will
  hit every screen with a non-ASCII literal), but it is glaring on this screen.
- The `tabs` banner sits in `#tutorial-overlay` between `#content` and the tab bar; the `actions`
  banners glow controls that may be scrolled off-screen inside `#content` (e.g. `[data-spell-cast]`
  on a long spell list). Whether the glow is actually visible needs a real viewport.
- Skipping mid-creator leaves `phase:"creation"` frozen in localStorage with `active:false`.
  Harmless today (Replay resets to `welcome`), but it means the persisted phase and the persisted
  active flag can disagree.
- Fighter is offered a subclass at level 1 by the creator and gets no subclass prompt at level 3;
  levelling a subclass-less multiclass entry (Rogue 1 → 3) never offers one either — `applyLevelUp`
  has no subclass-selection step at all. Whether that's in scope for the POC is a product call.
- The tutorial's `actions` phase advances on a "Got It" tap, not on the real action — deliberate
  per the file header, but it means a tester can finish the tour without ever rolling anything.
