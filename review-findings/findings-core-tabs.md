# Live-DOM findings — Combat, Inventory, Character, Notes, Rests, Manage Content

Driven with jsdom via `livetest/boot.js` + `livetest/mylib.js` (`sheet()` = boot → skip
tutorial → open the demo character). Every click below dispatched a real `MouseEvent`
through the app's own listeners. Repro scripts: `c*.js d*.js e*.js f*.js g*.js h1b/h2b.js
i*.js j*.js k*.js` in `/sessions/adoring-great-fermi/mnt/outputs/livetest/`.

---

## CONFIRMED WORKING

### Combat (`tab-combat.js`)
- **HP calculator arithmetic.** Digits, `d4..d20` (auto-inserting `+` between dice),
  operators, backspace and Clear all update `#calc-expr` correctly. `2d6+3` built as
  `1d6+1d6+3` and applied within range.
- **Damage / heal / temp.** Damage 10 from 47 → 37. TEMP 5 → `temp:5`; a second TEMP 3 correctly
  kept 5 (max, not sum). Damage 3 consumed temp first (`temp 5→2`, current unchanged).
  Heal 100 capped at max 62. Never went below 0 or above max.
- **Massive damage.** 99 damage at 5 HP → HP 0, death saves set to 3 failures, toast
  "Killed outright — 94 past zero, against a maximum of 62".
- **Damage at 0 HP** records one death-save failure.
- **Death save tracker.** Appears at 0 HP. Pip 1 → 1, pip 2 → 2, re-tapping pip 2 → 1 (undo works).
  3 successes → status "Stable"; Clear resets; 3 failures → status "Dead" + `.death-card.dead`.
  *(But see BUG-1 — this only holds while the HP calculator is closed.)*
- **Conditions.** Add Effect → combo name + `Condition` modifier saved a real group;
  chip rendered; detail modal listed Duration/Modifiers; Remove Effect deleted the group.
- **Exhaustion.** Stepper raises the level; the effect appears as a real group; Speed
  breakdown correctly showed `Base speed +30 / Exhaustion 2 −15 / Total 15 ft` at level 3.
- **Concentration drop.** `#concentration-drop` removed the whole Bless group — the WIS-save
  breakdown lost its `Bless +1` source and dropped 2 → 1. Toast fired, conc row disappeared.
- **Damage-while-concentrating** correctly opened the CON concentration save with DC 10 and
  Keep it / Lose it decisions.
- **Attacks.** To-hit pill rolled with full breakdown (incl. auto "Disadvantage from Prone");
  damage pill rolled multi-part damage; grip toggle flipped 1H↔2H and updated `weapon.twoHanded`;
  attack detail modal showed proficiency/finesse/versatile blocks; off-hand switch toggled and
  the Attacks row picked up the `OFF-HAND` tag.
- **Stow.** Stowing Longsword to Camp Storage moved `item.category`, removed it from Attacks,
  and **kept it in `character.inventory`**. When every category had `providesAttacks`, the
  "Nowhere to stow it" fallback created a new category and stowed into it.
- **Resources.** Over-max and negative both allowed by design (1/1 → +8 → 9/1 → −20 → −11).
  Spell slots increment past max. Ammunition: a Shortbow to-hit spent one arrow from the Quiver.
- **Add / edit / remove resource** all persist; scaling-max override UI present.

### Rests (`rests.js`)
- **Short rest.** Hit-dice steppers clamp at the pool's `current` (tapping + five times on a
  3-die pool stopped at 3). Spending 2×d10 healed 17 HP and left `d10:1/4`.
  SR resources restored (3 of them), LR resources and spell slots correctly untouched,
  "Short Rest"/"Rounds" effects cleared, temp HP kept.
- **Long rest.** HP 0 → 62, temp cleared, death saves reset ("back on your feet"),
  all SR **and** LR resources restored, all spell slots restored, exhaustion 3 → 2,
  hit dice half back (`0/4,0/2,0/2` → `2/4,1/2,1/2`).
- **Custom recharge is deliberately NOT restored.** A resource with `recharge.on:"Dawn"`
  stayed at 0/3 through both a short and a long rest. Correct per the data-model contract.

### Inventory (`tab-inventory.js`)
- Collapse/expand per category; add custom gear/weapon/armour; the shared item form's type
  toggle swaps in weapon/armour blocks.
- **Category rules genuinely take effect.** Moving Chain Shirt Worn → Carrying changed AC
  from `Chain Shirt 13 + Dex 2 + Cloak 1 + Defence 1 = 17` to `Unarmoured 10 + … = 14`.
  A new Shield (`kind: shield`, base 2) in Worn added `+2` as its own AC source (17 → 19);
  moving it to Camp Storage dropped it back to 17 **and** carried weight stayed 46 lb
  (Camp Storage `countsWeight:false`).
- **Stacks vs containers.** Arrows (`max:0`) render as a bare `60`, never `60/0`.
  Quiver Refill: at 13/20 with 60 arrows → `Loaded 7 from Arrows`, quiver 20/20, arrows 53.
  Already-full → "Quiver is already full". Empty stack → "No Arrows left to load".
- Edit item, delete item (with cancel path), Give flow (quantity stepper clamps to qty,
  Confirm stays disabled until a recipient is picked, then decrements the stack),
  "Stop tracking as a resource" all work.
- Edit category: rename moves every item in it and preserves the open/closed state;
  toggling `providesAttacks` takes effect immediately.

### Character (`tab-character.js`)
- Ability edit (STR 16 → 20 updated the box, the modifier and every downstream breakdown).
- Ability-check / save / skill rows roll with full source breakdowns.
- Save proficiency toggle: WIS 0 → 1 changed the total 2 → 5 and added a `Proficiency +3` source.
- Skill proficiency → Expertise added an `Expertise +6` source; the override switch replaced the
  breakdown with a single `Manual override` source and rendered the `*` marker on the row.
- Add / rename / remove a language; add / edit / remove a feature; add a section.
- Pending-choices banner renders, `Resolve` opens the choice modal, confirming clears the entry
  and writes the result to the character.

### Notes (`tab-notes.js`)
- Sort chips (Custom / A–Z / Latest / Oldest) all re-sort live.
- New section (with auto-share), add note into it → the note was auto-shared with the whole
  party and the row picked up the `↑ Sharing` tag.
- Note editor commits title/body on input and on Save; Duplicate; Delete (confirm);
  edit + remove section (confirm, cascades to its notes).
- **Share flow is an honest mockup** — permission buttons cycle off→view→edit→off, Save writes
  only local `note.sharing` state, no network call, no "sent" claim anywhere. Nothing thrown.

### Manage Content (`content.js` / `content-forms.js`)
- All 11 categories browse with live counts (Races 9 … Magic Items 281, Spells 319, Conditions 45).
- Search works from both the top level (flat, cross-category, with a category label per row) and
  inside a category; filter chips All/SRD/Custom apply in both; the search input keeps focus.
- Duplicate an SRD entry → "Custom Elf" in `customContent.races`, opens its editor, rename +
  Save persists to `campfire.customContent`.
- Inline delete: first tap swaps the row for "Delete X? Cancel / Delete"; Cancel restores it;
  Delete removes it and re-persists.
- Created a race, class, background, subclass, standalone feature and item from scratch via `+ Add`.
- **A custom subclass really reaches the creator.** "Storm Knight" (`forClass: Fighter`, one level-3
  feature) appeared in the creator's Subclass step next to Champion, and selecting it rendered
  its feature. `subclassesForClass("Fighter") → ["Champion","Storm Knight"]`.

---

## BUGS

### BUG-1 — High — Death-save pips are double-wired whenever the HP calculator is open, so every tap undoes itself
**File:** `tab-combat.js` → `wireDeathSaveControls()` (line 70), called from `wireCombatTab()`
(line 235) and twice from `openHpCalculator()` (lines 395, 398).

`wireDeathSaveControls` queries `document.querySelectorAll("[data-death-pip]")` — **document-wide,
not scoped to the panel it is redrawing.** The Combat tab's death card and the calculator's
Death Saves panel both render pips with that attribute, so each function's call attaches a
listener to *both* sets.

**Steps**
1. Drop to 0 HP so the death card shows.
2. Tap the HP card to open the calculator.
3. Tap the 2nd Success pip — in the calculator *or* on the sheet behind it.

**Expected:** successes = 2.
**Actual:** successes = 1. Both handlers fire; the second sees `successes === count` and applies
`setDeathSaveTrack`'s undo branch (`count - 1`). Tapping pip 1 is a complete no-op (0 → 1 → 0).

Verified instrumentally (`j4.js`, counting `addEventListener` calls per element):

    [SHEET behind]  DOUBLE x2  death-pip  {"deathPip":"success","deathCount":"1"} … (all 6)

It escalates: after `redrawDeathPanel()` runs, its `renderContent()` re-enters `wireCombatTab`,
whose own document-wide query then double-wires the *modal's* freshly drawn pips too.
Repro: `c6.js`, `j4.js`.

---

### BUG-2 — High — "Roll Death Save" inside the HP calculator does nothing (duplicate element id)
**File:** `tab-combat.js` → `deathSaveControlHtml()` (line 66) + `wireDeathSaveControls()` (line 78).

`deathSaveControlHtml()` hard-codes `id="roll-death-save"` and `id="clear-death-saves"`. When the
Combat tab's death card and the calculator's panel are both on screen those ids exist **twice**;
`document.getElementById` returns the first in document order, which is the sheet's card
(`#modal-overlay` is appended last). The calculator's buttons therefore receive **zero** listeners
while the sheet's receive three.

**Steps:** drop to 0 HP → open the HP calculator → tap "Roll Death Save" inside it.
**Expected:** a d20 is rolled and the track updates.
**Actual:** nothing at all. `deathSaves` unchanged, `hp` unchanged, no toast.

    roll buttons: [ 'CARD', 'MODAL' ]
    after clicking MODAL Roll Death Save: {"successes":0,"failures":0} hp 0 toasts 0

Same for the calculator's "Clear" button. Repro: `c7.js`, and `j4.js` reports the modal button as
`DEAD` (own listener count 0). This is a control that renders correctly and does nothing — the
string-only suite cannot see it.

---

### BUG-3 — Medium — Exhaustion stepper on the Combat tab moves by 2 after opening an Exhaustion effect's detail
**File:** `tab-combat.js` → `openEffectDetailModal()` (line 787) uses
`document.querySelectorAll("[data-exhaustion-step]")`, which also matches the stepper
`exhaustionRowHtml()` already put on the Combat tab (wired at line 224).

**Steps**
1. Set exhaustion to 2 (so an Exhaustion effect group exists).
2. Tap the Exhaustion chip to open its detail modal.
3. Dismiss it by tapping the backdrop / dragging the handle (i.e. `closeModal()` with no re-render).
4. Tap `+` on the Combat tab's Exhaustion row.

**Expected:** level 3. **Actual:** level 4. Repro: `j5.js` (`EXPECT 3 GOT 4`).

The stale listener survives until the next `renderContent()`, so any backdrop-dismiss leaves the
sheet's stepper double-armed.

---

### BUG-4 — Medium — A second concentration effect can be started with no prompt to drop the first
**File:** `tab-combat.js` → `openAddEffectModal()`'s save handler (line 720).

The demo character concentrates on Bless. Adding a second effect with the Concentration switch on
pushes it straight in.

**Expected:** a prompt ("You're already concentrating on Bless — drop it?"), or the first group
dropped automatically. 5e allows exactly one concentration effect.
**Actual:** `concentrationGroups(character) → ["Bless","Hex"]`, no modal, no toast. The conc row
reads "Concentrating · Bless, Hex" and a single Drop then ends both at once.

Repro: `d2.js`. Nothing in `character-data.js` enforces the cap either, so this is a data-model
gap, not just UI.

---

### BUG-5 — Medium — No `<meta charset>`: every literal non-ASCII character in the source renders as mojibake
**File:** `index.html` (lines 1–6 — no `<meta charset="utf-8">`); the server/`file://` sends no
charset either.

`document.characterSet` resolves to **windows-1252**, and classic `<script>`s inherit the document
encoding, so the UTF-8 bytes written literally in the JS files are mis-decoded. Characters written
as `\uXXXX` escapes are fine, which is exactly why it is easy to miss.

    charset: windows-1252
    exhaustion minus button label: "âˆ’"   (should be "−")
    chip-remove label:             "✕"    (written as ✕ — fine)

Affected literals found by byte scan: `tab-combat.js` 16 lines, `rests.js` 12, `tab-inventory.js` 4,
`ui.js` 3 — `·`, `–`, `—`, `−`, `✕`. Visible in real strings: `"Short rest Â· 2 hit dice…"`,
`"Killed outright â€” 94 past zero"`, `"Concentration dropped Â· Bless ended"`,
`"Difficulty Class 10 â€” Constitution"`.

CLAUDE.md says the app is run by opening `index.html` in a browser; Chrome/Firefox default to the
legacy locale encoding for HTML with no charset, so this reproduces outside jsdom. One line in
`<head>` fixes all of it.

---

### BUG-6 — Low — HTML entities leak into native `confirm()` dialogs (`esc()` applied to plain text)
**Files:** `tab-inventory.js:576-577` (remove category), `tab-character.js:403-404` (remove
feature section). Both build a `confirm()` message with `esc(name)` in it.

Steps: rename an inventory category to `Ben & Jerry's`, then Edit Category → Remove.
**Expected:** `… Remove "Ben & Jerry's"?`
**Actual:**

    This category contains 2 items that will also be deleted. Remove "Ben &amp; Jerry&#39;s"?

This is failure mode #2 from CLAUDE.md ("calling `esc()` on markup the app built itself" — here, on
text that never enters HTML at all) and the `escaping` suite cannot see it because the string never
reaches the DOM. Repro: `f5.js`.

Secondary point on the same lines: these five `confirm()` calls (`tab-inventory.js`,
`tab-character.js`, `tab-notes.js` ×3) are the only native browser dialogs in an app that
otherwise builds every confirmation as a themed modal — and `tab-inventory.js`'s
`confirmDeleteItem` right below already shows the in-app pattern.

---

### BUG-7 — Low — Renaming a category / trait section silently sends it to the bottom of the list
**Files:** `tab-inventory.js:559-561`, `tab-character.js:388-391`.

Both rename by `delete rules[old]; rules[new] = …`, and the render order is
`Object.keys(character.categoryRules)`. Renaming `Carrying` → `Backpack` moved it from position 3
to position 4:

    before: Worn, Equipped, Carrying, Camp Storage
    after:  Worn, Equipped, Camp Storage, Backpack

The order is user-controlled (drag-to-reorder writes it back as key order in
`wireSectionDragging`), so a rename quietly discards a deliberate arrangement. Repro: `f4.js`.

---

### BUG-8 — Low — Healing revives a character who has already died
**File:** `tab-combat.js` → `applyHp("heal", …)` (line 429). It resets the death saves whenever
`wasDown`, without checking `deathSaveState(character).dead`.

Steps: take massive damage (→ 3 failures, "Killed outright"), then HEAL 5.
**Actual:** HP 5, `deathSaves {successes:0,failures:0}`, standing. No resurrection involved.
Repro: `k1.js`. Arguably a deliberate POC permissiveness (resources are allowed out of range on
purpose), but unlike those it is silent — the sheet gives no sign it just undid a death.

---

## SUSPICIOUS / NEEDS HUMAN EYES

- **`wireDeathSaveControls` / `openEffectDetailModal` are the only two document-wide
  `querySelectorAll` calls whose selector is also rendered by a tab.** I scanned every
  `document.querySelectorAll("[data-…]")` in the codebase; `data-death-pip` (3 call sites) and
  `data-exhaustion-step` (2) are the complete list. `data-item-type`, `data-member-btn`,
  `data-cat-body`, `data-note-sec-body`, `data-cc-filter`, `data-choice-expand` each have two call
  sites but never coexist on screen. Worth a convention (pass a root element) rather than
  case-by-case fixes.
- **Attunement is metadata only.** `attunement` is authored and displayed in Manage Content
  (`content-forms.js:326`, `content.js:665`) but nothing on the character sheet tracks attuned
  items or the 3-item limit — an inventory item has no attunement field at all. A modelling gap
  the POC probably wants to record.
- **Off-hand and two-handed are properties of the item, not of a loadout.** Two weapons can both
  be `offHand: true` and both `twoHanded: true` simultaneously; nothing reconciles them.
- **Manage Content forms always return to the top-level list on Save/Back**, never to the category
  screen you drilled in from — and the previous search text is still live, so after saving a race
  from Races/"elf" you land on flat cross-category results including two spells. Confusing, but
  the search-persistence is explicitly a design decision in `content.js`'s header comment.
- **`applyRest`'s "concentration broken" summary line rarely appears.** The duration filter runs
  first, so an effect whose duration is Rounds/Short Rest is removed before
  `concentrationGroups()` is consulted; only a Permanent concentration effect ever reports it.
  The demo's Bless was silently swept as a duration effect. Cosmetic, but the summary is the only
  feedback a rest gives.
- **`data-cc-row` / `data-cc-delete` refs are string-split on `:`** (`content.js:215`). SRD refs
  are indices and custom refs are ids, so a category key containing a colon would break the parse.
  Not reachable today (keys are hard-coded) — just fragile.
- **The note share flow never claims to have sent anything** (good), but a shared note's row and
  editor read "↑ Sharing with Aldric (GM) (edit)" with no hint that this is local-only. Given
  Help & Rules is explicit that the party screen is a mockup, the note surface may want the same.
- **No console errors or thrown exceptions anywhere in my area**, other than jsdom's
  "Not implemented: Window's confirm()" — an environment limitation, not an app fault, though
  it is what surfaced BUG-6.
