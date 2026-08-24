# Live-DOM findings — Spells tab, Add Spell picker, Dice History, Help & Rules

Driven with jsdom via `livetest/boot.js`; every listener the app attaches was genuinely fired.
Demo character (Sigrid of Chester) is a Wizard/Cleric multiclass, so the two-caster paths were
exercised as well as the single-caster ones. `a.errors` was collected after every scenario.

---

## CONFIRMED WORKING

### Spells tab
- Spell Attack / Spell DC stat boxes render per caster class (Wizard and Cleric each get their own
  pair) and both open the breakdown modal on click. Breakdown sums correctly (`+3 prof +1 INT = +4`)
  and the Spell Attack modal offers a Roll button; Spell DC correctly does not.
- Prepared dots: clicking toggles `spell.prepared` in the model **and** the `prof` class in the DOM.
  Verified Shield `true -> false` with `prof-dot prof` -> `prof-dot`.
- All / Prepared filter: `spellFilter` flips, the `active` class moves, and the row list actually
  changes (Shield disappears from the Prepared view once unprepared, cantrips always stay).
- Per-level collapse headers: clicking `[data-spelllevel-toggle="1"]` hides the 4 first-level rows
  (12 -> 8), flips the caret from `−` to `+`, and clicking again restores them. `openSpellLevels`
  tracks correctly.
- Casting a leveled spell decrements the right slot (`3/4 -> 2/4`), and an `attackRoll` spell
  (Spiritual Weapon) also opens the roll window, applies derived disadvantage from the Prone
  condition, and logs to dice history.
- Casting with 0 slots left: shows the toast "No 1st-level slots left" and still lets the count go
  to `-1`, exactly as documented.
- Edit slots pencil (`[data-edit-slots]`): opens with current values, `stopPropagation` keeps the
  collapse header from also firing, saving writes both `current` and `max`, header updates
  (`5/7 slots`), persists to `campfire.characters`.
- **Add Spell picker.** `#add-spell-button` opens the modal; the Name field is a real combo. Focus
  draws all 319 SRD spells; typing `fireb` narrows to `Fireball` + `Delayed Blast Fireball`. The
  widget listens for `pointerdown` (not `click`) — dispatching a bubbling `PointerEvent` picks the
  option, fills the input, hides the list.
- Auto-fill from a picked SRD spell is correct on every field tested:
  - `Fireball` -> level 3 / "3rd Level", Action, desc 594 chars, attack toggle off (Dex save).
  - `Ray of Frost` -> Cantrip, Action, **attack toggle ON** (`spellLikelyAttackRoll` matched
    "ranged spell attack"), full desc.
  - `Healing Word` -> level 1, **Bonus Action** (`spellCastingTimeCode` correct), class switched
    from Wizard to **Cleric** (`matchedClass`), attack off.
- **`setSelectValue` keeps the hidden input and the visible label in sync** — checked all three
  selects on every pick above (`#spell-form-level.value === "3"` alongside
  `.select-value === "3rd Level"`). No mismatch. The `active` option class also moves.
- Saving writes a well-formed spell (`id`, `attackRoll`, `name`, `level`, `classSource`,
  `castingTime`, `desc`, `prepared:false` only for level > 0).
- Homebrew: a name not in the SRD saves as a valid spell, with the combo showing the
  "will be used as a custom entry" hint. Level/time/class chosen by hand all persist.
- Edit (`openSpellDetailModal`) uses a **plain `textFieldHtml`, not the combo**
  (`#spell-form-name-list` absent), pre-fills every field including the attack toggle, Save Changes
  writes through, Remove deletes and closes.
- Escaping on the sheet is correct: `Kici’s <b>Zap</b>` renders as `&lt;b&gt;` in `.atk-name`.

### Dice History
- Every roll path tested lands a sensible entry: Longsword To Hit (`1d20+8`, kind `attack`,
  mode `disadvantage`, `dropped:23`), Longsword Damage (`1d8+3`, `damage`), Arcana (`check`),
  Dexterity Save (`save`), HP-calculator Damage, Hit Die – d10 (`1d10+2`), spell casts.
  `detail` strings match the roll window's own breakdown.
- `#menu-dice-history` opens the modal; entries render **newest-first**, matching array order.
- **Reroll adds a second entry, never replaces.** Three `↻` presses produced three entries; a mode
  change to ADV added a fourth tagged `advantage`.
- **A DC roll does not log until rolled.** The forced concentration save opened showing `—` with
  history untouched; pressing "Roll 1d20+5" added exactly one entry.
- Clear History empties `rollHistory`, writes `[]` to `campfire.rollHistory`, redraws in place,
  shows the empty state.
- **50-entry cap holds**: 60 recorded rolls left `length === 50`, newest kept (R59..R10); persisted
  array likewise capped.
- Persistence verified: clearing the in-memory array and re-running `loadRollHistory()` restored all
  50 entries in order, and they rendered.
- **Character-name-only-on-mixed-list rule works.** Single-character log:
  `historyShowsCharacters() === false`, no name rendered. After switching characters and rolling
  again it returns `true` and both rows show their owner.

### Help & Rules
- `#menu-help` opens; both tabs switch on click, `active` class moves, `helpTab` updates.
- All 12 `HELP_TOPICS` render as cards.
- Accordion: **exactly one open at a time** (opening `rests` closed `effects`); clicking an open card
  closes it (`helpOpenTopic -> null`, 0 open bodies). Caret flips `+`/`−`.
- Conditions tab is driven by `SRD_CONDITIONS`: **45 cards for 45 entries**, count line reads
  "45 conditions", and exactly the 30 `official: false` entries carry the `3PP` tag.
- **Search keeps focus and value.** Typing `p`,`o`,`i`,`s` one keystroke at a time:
  `document.activeElement === input` after every event, value intact, the input is the *same DOM
  node* throughout (only `#help-condition-results` is replaced), results narrow 10 -> 3 -> 1 -> 1
  (`Poisoned`). Opening a condition card from filtered results preserves both search text and focus.
  "zzzz" produces "0 conditions / Nothing matches."

No console errors or exceptions in any of the above.

---

## BUGS

### 1. HIGH — A spell at a level the character has no slot for vanishes from the sheet entirely
**File/function:** `tab-spells.js` -> `renderSpellsTab()` (line ~72)
```js
const levels = [0].concat(Object.keys(character.spellSlots).map(n => parseInt(n)).sort(...));
```
**Steps:** Spells tab -> `+ Add` -> pick `Fireball` (auto-fills level 3) -> Add Spell. Sigrid has
only level 1 and 2 slots.
**Expected:** Fireball appears (as a "3rd Level" group, presumably with no slot counter), or the app
declines to add it.
**Actual:** the spell is pushed into `character.spells` and persisted to `campfire.characters`, but
`renderSpellsTab()` builds headers only for levels present in `character.spellSlots`, so there is no
3rd-Level section and the spell is never rendered. It is invisible **and unreachable** — no row means
no `openSpellDetailModal`, so it can never be edited or removed through the UI. It reappears only if
a slot of that level is later added (verified: adding `spellSlots[5]` made a hidden level-5 spell
visible again).
**Worse:** the invisible spell still counts toward the prepared limit. With one hidden prepared
level-5 spell the counter read **"7 / 6 prepared"** with only 6 visible dots — a wrong number with no
visible cause.
Trivially reachable: the picker offers all 319 SRD spells and the Level select offers 1–9, with no
gating on what the character can cast.

### 2. HIGH — `wireCombo` injects unescaped user input into the DOM (HTML injection)
**File/function:** `ui.js` -> `wireCombo()` -> `draw()` (line 246)
```js
: `<div class="combo-empty">No match — "${input.value.trim()}" will be used as a custom entry</div>`;
```
**Steps:** Spells tab -> `+ Add` -> type `zzz<img src=x onerror="window.__pwned=true">` into Name.
**Expected:** the typed text rendered literally, via `esc()`.
**Actual:** `list.innerHTML` becomes
`<div class="combo-empty">No match — "zzz<img src="x" onerror="window.__pwned=true">" ...</div>`
and a real `<img>` element is inserted into the document (confirmed:
`#spell-form-name-list img` is non-null). In a real browser the failing image load fires `onerror`.
This is exactly failure mode #1 in CLAUDE.md's Escaping section, and the repo's `escaping` suite
cannot catch it because it never fires the `input` listener.
**Blast radius is not just spells:** the same `wireCombo` backs the Add Effect / condition field
(`tab-combat.js:695`, `ui.js:281`) and every other combo. Match options *are* escaped
(`esc(option)`); only the no-match branch is not.
Note also `comboFieldHtml` (ui.js:230) writes `placeholder="${placeholder}"` unescaped — only ever
fed developer strings today, but the same latent hole.

### 3. MEDIUM/HIGH — `castSpell` throws (and silently eats a spell slot) when a spell's `classSource` no longer names a caster class
**File/function:** `tab-spells.js` -> `castSpell()` (lines 120–126); same lookup in `wireSpellsTab`'s
`[data-spell-view]` handler (line 178).
```js
const cls = character.spellcasting.classes.find(c => c.name === spell.classSource);
const atk = calculateSpellAttack(character, cls.ability);   // cls can be undefined
```
**Steps:** a spell with `attackRoll: true` whose `classSource` matches no entry in
`character.spellcasting.classes` (rename a caster class, remove one, or a spell arriving from
elsewhere) -> press Cast.
**Expected:** graceful fallback or a message.
**Actual:** uncaught `TypeError: Cannot read properties of undefined (reading 'ability')`. The slot
decrement happens *before* the throw and `renderContent()` after it, so the model loses a slot
(`2/3 -> 1/3`) while the screen still shows **2/3** — a silent state/UI desync lasting until the next
unrelated re-render. The button just looks dead. Same crash from tapping an attack cantrip's row.

### 4. MEDIUM — Attack cantrips can never be edited or removed
**File/function:** `tab-spells.js` -> `wireSpellsTab()`, `[data-spell-view]` handler (lines 177–184)
**Steps:** Spells tab -> tap `Fire Bolt` (or any cantrip with `attackRoll: true`, e.g. a Ray of Frost
you just added via the picker).
**Expected:** some route to `openSpellDetailModal`.
**Actual:** the row click always rolls the attack instead. Cantrips render no prepared dot and no
Cast button, so the row *is* the only control — `openSpellDetailModal` is unreachable for these
spells. They cannot be renamed, re-levelled, re-described or deleted through the UI at all.
(Non-attack cantrips like Mage Hand open the editor normally, which is the giveaway.)

### 5. MEDIUM — Spell attack / DC stat boxes are dead for a class whose name contains `&`, `<`, `>` or `"`
**File/function:** `tab-spells.js` -> `wireSpellsTab()` lines 131 and 137
```js
document.querySelector(`[data-spell-atk="${esc(cls.name)}"]`)
```
**Steps:** give a spellcasting class a name containing `&` (custom classes are user-authored via the
creator / Manage Content), open Spells, tap its Spell Attack box.
**Expected:** breakdown modal. **Actual:** nothing happens.
The attribute is written as `data-spell-atk="${esc(cls.name)}"`, so the parsed DOM value is the
decoded `War & Peace`, but the selector searches for the *encoded* `War &amp; Peace` and matches
nothing. `querySelector` returns null, the `if (atkBox)` guard swallows it, and the box renders
identically to a working one. Verified live: box present, click produced no modal and no error.
A name containing `"` would break the attribute markup outright.

### 6. LOW — App menu hint reads "1 rolls"
**File/function:** `rests.js` -> `openAppMenu()`
(`${rollHistory.length ? rollHistory.length + " rolls" : ""}`) — no singular case. Verified live.

---

## SUSPICIOUS / NEEDS HUMAN EYES

- **The SRD picker silently mis-files spells for classes you don't have.** `openAddSpellModal`'s
  comment says an unmatched class is "left for the player to pick, since offering a class they don't
  have would be worse than offering none" — but `selectFieldHtml` has no "none" state; it defaults to
  `items[0]`. Picking a Ranger-only spell on a Wizard/Cleric leaves the Class select reading
  **Wizard**, and it saves that way. The intended "left for the player" outcome doesn't exist.
  Worth an explicit "—" option — and it feeds bug 3's crash path.
- **Flat HP-calculator numbers are logged as rolls.** Entering `8` and pressing DAMAGE writes
  `Damage | 8 | (8)` to dice history. Deliberate ("every roll the app resolves") or noise?
- **Hit-dice history detail is formatted differently from the roll window's.** `showRollToast`
  records the raw breakdown (`1d10(4) + 2`); `recordCurrentRoll` strips the dice prefix (`(4) + 2`).
  The history list shows two notation styles side by side.
- **`wireCombo`'s `input` listener calls `announce()` on every keystroke**, so typing a full SRD name
  by hand auto-fills without touching the list. Probably desirable — but it also means that after
  picking a spell and then *editing* the name to something homebrew, the auto-filled level, casting
  time, description and attack toggle all silently persist (`if (!known) return;` never undoes
  anything). Easy to end up with "My Custom Bolt" carrying Fireball's full SRD text.
- **Spell rows show the raw casting-time code** (`A`/`B`/`R`) in `.spell-tag` rather than
  "Action"/"Bonus Action"/"Reaction". Consistent with the stored model, cryptic on screen.
- **`spellFilter` and `openSpellLevels` are module-level, not per-character.** Switching characters
  keeps whichever filter and collapsed levels the previous sheet was left in. Noting it since
  character switching / GM sync is on the roadmap.
