# Character Creator — live-DOM findings

Driven end to end in jsdom via `livetest/boot.js`, every listener firing for real.
Builds walked: Human Fighter, Dragonborn Barbarian, High Elf Wizard, Half-Elf Rogue,
Human Rogue (Expertise), Half-Orc Cleric, Monk + custom subclass, plus back/forward
and abuse cases. Driver scripts: `livetest/cr1.js` … `cr12.js`, helpers `lib.js`, `walk.js`.

**`a.errors` was empty for every single scenario.** No thrown exceptions, no console errors,
no jsdom errors anywhere in the creator. Everything below is a logic/wiring bug, not a crash.

---

## CONFIRMED WORKING

- **Entry path.** `#new-char-button` → "Build a Character" → step 1 renders. Both start-screen
  buttons are wired; the hidden file input is wired for Import.
- **Navigation.** Next/Back genuinely move `creatorState.step`; every step's Back button exists
  and works (except the Race step, deliberately — see BUG-8). Step keys are recomputed on every
  redraw, so a step appearing/disappearing mid-wizard never leaves you on the wrong screen
  (verified: Half-Elf Fighter → back to Race → switch to Human drops the "Choices" step and the
  wizard stays coherent, `cr12.js`).
- **Every Next-button guard fires.** Race with no race, race with subraces and no subrace, class
  with no class, subclass with none, background with none, an unresolved choice card, an
  undecided equipment choice, and an empty/whitespace-only name — all blocked with the right
  toast and the step index unchanged.
- **The choice accordion is correct.** Clicking an option header expands exactly one card and
  collapses the previously open one (verified by reading `.collapse-body.open` on the option
  cards after real clicks, `cr2.js`). "Choose this" selects without collapsing, flips its own
  label to "Selected", gains `.active`, and adds the ✓ to the header. Two different pendings on
  the same step keep independent expansion state (High Elf's Cantrip and Extra Language).
- **Over-picking is refused.** Picking a second option for a `count: 1` choice toasts
  "You can only pick 1" and leaves the answer alone. Clicking a selected option deselects it.
- **The manual free-text escape hatch works.** Typing into `choice-manual-<Feature>` records
  `{manual: "..."}` and satisfies the Next guard, exactly as `firstUnresolvedChoice` intends.
- **Choice-clearing on source change is exactly right** (`cr8.js`). Changing race clears only the
  race's answers and leaves the Fighting Style answer intact; changing class clears class +
  subclass answers and leaves Draconic Ancestry intact; changing subrace clears subrace answers.
  30 rapid race switches left no stale answers, no duplicated buttons, no listener leak.
- **Skill mutual exclusion works.** A background skill renders a "BG" tag and no checkbox at all;
  a skill taken by race is `disabled` for class and vice versa; once a source's count is spent
  every unselected box for that source is `disabled`. Clicking a disabled box does nothing
  (verified — the `disabled` attribute really does suppress the handler). No overlap was ever
  produced between `raceSkillChoices` and `classSkillChoices`.
- **Point buy.** "Use Recommended" fills the standard array, sets +2/+1 to the class main /
  secondary ability, and lands on exactly 27 spent. Steppers show `finalScoreFor` (base + overlay).
  Exceeding 27 (or leaving 8–15) shows the ⚠ warning and sets `customBuild: true` on the built
  character; the confirm toast says "(custom build)". +2 and +1 can't sit on the same ability —
  setting +2 where +1 is clears the +1, and setting +1 where +2 is toasts and refuses.
- **Equipment step.** Kit options select per-group, "Also carried" chips render, Back/forward
  preserves `creatorState.equipment`, stackables merge and weapons stay as separate rows.
- **Creation.** Lands on the sheet, `character` is repointed, the new entry is in
  `savedCharacters`, HP = max hit die + CON mod, saves/proficiencies/traits/inventory populate,
  and **`pendingChoices` is `[]` in every build tested** — the wizard really does answer everything.
- **Escaping is clean.** A name of `<img src=x onerror=alert(1)>Bob` produced zero injected
  elements. A custom subclass feature description containing `<b>bold</b> & stuff` renders escaped
  on the subclass step.
- **Custom subclasses work end to end** — a `customContent.subclasses` entry for Monk appears on
  the Subclass step, its `kind: "custom"` choice renders, resolves, and annotates the trait.
- **`creatorState` is fully reset** by a second `openCharacterCreator()`.

---

## BUGS

### BUG-1 (High) — "Sleight of Hand" proficiency is silently lost: key-casing mismatch
**Did:** Human Rogue; on the Skills step ticked Sleight of Hand, Stealth, Acrobatics, Perception;
on the Choices step took Expertise in Sleight of Hand and Stealth; created the character.
**Expected:** sheet shows Sleight of Hand with proficiency doubled (Expertise).
**Actually:** sheet shows **Sleight of Hand +4 — no proficiency bonus at all**, while Stealth
correctly shows +8. The built character carries three keys for one skill:

```
skillProficiency = { ..., "SleightofHand": 1, "Stealth": 2, "Sleight of Hand": 2 }
```

and the canonical key `SleightOfHand` (the one `SKILL_ABILITY_MAP` and the whole sheet use) is
absent. `calculateSkill(c, "SleightOfHand")` returns `{total: 4, sources: [Dexterity, ASI]}` — no
Proficiency or Expertise source.

Two independent defects combine here:
- `skillKey()` in `creator.js:796` does `name.replace(/[^a-zA-Z]/g, "")`, which turns
  `"Sleight of Hand"` into `"SleightofHand"` (lower-case `o`), but `SKILL_ABILITY_MAP`
  (`character-data.js:9`) spells it `"SleightOfHand"`. Sleight of Hand is the only SRD skill with
  a lower-case interior word, so it is the only one affected — which is why nothing else looks broken.
- `applyChoiceResolution` for `kind: "skill"` (`choices.js:227`) writes `skillProficiency[name] = 2`
  using the *raw* option label. The creator's option list (`creatorChoiceOptionsFor`, `creator.js:210`)
  is built from display names with spaces, so this writes `"Sleight of Hand"`. The live-character
  path (`choiceOptionsFor`, `choices.js:67`) reads `Object.keys(character.skillProficiency)` and so
  passes stripped keys — the two callers of the same function disagree about the key format.

Repro script: `livetest/cr11.js`.

### BUG-2 (High) — racial ability score increases are applied twice
**Did:** any build. e.g. Dragonborn Barbarian, "Use Recommended" (STR 15, +2 overlay on STR).
**Expected:** STR 17 (or 16 if the overlay is meant to *be* the racial bonus).
**Actually:** raw `abilities.STR = 17`, effective **19**. The creator's BG3-style +2/+1 overlay is
baked into `abilities` by `finalScoreFor()` (`creator.js:100`), *and* the race's own
"Ability Score Increase" feature is copied into `traits["Race Traits"]` **with its `.effects`
intact** (`asTraitEntry`, `creator.js:847`), where `effectiveAbilityScore()` adds them again.
Confirmed on every race tested:

| build | ability | raw | effective | note |
|---|---|---|---|---|
| Human Fighter | all six | 17/15/13/12/10/8 | 18/16/14/13/11/9 | +1 each double-counted |
| Dragonborn Barbarian | STR / CHA | 17 / 8 | 19 / 9 | +2/+1 double-counted |
| High Elf Wizard | DEX / INT | 13 / 17 | 15 / 18 | +2/+1 double-counted |
| Half-Elf Rogue | CHA | 8 | 10 | +2 double-counted |

Knock-on: the skill breakdown lists a source literally labelled "Ability Score Increase (+1 score)",
and **max HP is computed from the pre-effect CON** (`creator.js:868` uses `abilities.CON`), so the
Human Fighter got 11 HP while the sheet displays CON 14 (+2), which should be 12. The sheet's
own "sources must sum to the total" contract holds; the number being summed is just wrong.

Half-Elf's chosen "+1 to two abilities" choice is *also* applied this way — it is the only one
that is arguably correct, since the creator has no other mechanism for it.

### BUG-3 (High) — Half-Elf "Skill Versatility" grants Expertise on skills you already have, not two new proficiencies
**Did:** Half-Elf Rogue; on the trailing Choices step, Skill Versatility ("Choose two skills")
offered `["Athletics", "Intimidation", "Acrobatics", "Sleight of Hand", "Stealth", "Investigation"]`
— i.e. **only skills the character already has**. Picked Athletics + Intimidation.
**Expected:** proficiency in two skills the character does *not* have.
**Actually:** `skillProficiency = {Athletics: 2, Intimidation: 2, ...}` — the two background skills
were promoted to Expertise. Sheet shows Athletics +7 with an "Expertise +4" source.
Cause: `kind: "skill"` is treated as Expertise-only in two places —
`creatorChoiceOptionsFor` (`creator.js:208-212`) restricts the option list to already-known skills,
and `applyChoiceResolution` (`choices.js:227`) hardcodes `= 2`. Half-Elf's Skill Versatility
(`srd-races.js:213`) and Rogue's Expertise share the same `kind` but need opposite semantics.
Related: nothing stops the *same* skill being picked for both Skill Versatility and Expertise on
the same step — I did exactly that and got no warning.

### BUG-4 (Medium/High) — every class is forced to pick a subclass at level 1
**Did:** created a level-1 Fighter, Barbarian, Rogue, Wizard, Monk.
**Expected:** per SRD only Cleric, Sorcerer and Warlock choose at 1st level (Fighter 3, Rogue 3,
Barbarian 3, Wizard 2, Monk 3).
**Actually:** the Subclass step appears for all 12 classes and **Next is blocked until you pick one**.
The built character records `classes: [{name: "Fighter", level: 1, subclass: "Champion", ...}]`.
Nothing is granted (`featuresAtLevel(..., 1)` returns no subclass features for those classes), so
the pick is pure lock-in — and the step shows the subclass's *entire* feature list, levels 3–18
included, as if you were getting it now. `creatorStepKeys()` (`creator.js:222`) gates on
`subclassesForClass(cls.name).length` with no level check.

### BUG-5 (Medium) — no `<meta charset>`: every literal non-ASCII character renders as mojibake
**Did:** loaded `index.html` over HTTP with no charset in the Content-Type (the common static-server
case, and the same as `file://`). `document.characterSet === "windows-1252"`.
**Expected:** "Bronze — Lightning … ✓", "Step 7 of 8 · Starting Gear", "Resolve “…” to continue".
**Actually:** `âœ“`, `â€”`, `Â·`, `â€œâ€`. The ✓ that marks a selected choice option, the em-dash in
"From <Feature> — pick 1", the − collapse glyph, the toast quotes, and the equipment/choices step
separators are all affected. `index.html` declares no `<meta charset="utf-8">` (`index.html:3-6`), so
the classic scripts inherit the document's fallback encoding. The codebase is inconsistent about
this — places that use `·`/`−` JS escapes survive, places with literal UTF-8 bytes don't
(13 literal non-ASCII chars in `creator.js`, 9 in `choices.js`, 3 in `ui.js`).
*Verify in a real browser — Chrome's encoding auto-detector may mask it for some users, which would
make this an intermittent-looking rendering bug rather than a constant one.*

### BUG-6 (Medium) — custom races and custom classes are unreachable from the creator
**Did:** pushed a race into `customContent.races` and a class into `customContent.classes`, then
opened the creator.
**Expected:** they appear alongside the SRD entries, the way a custom subclass does.
**Actually:** neither appears. `raceStepHtml` (`creator.js:266`) maps `SRD_RACES` and
`classStepHtml` (`creator.js:320`) maps `SRD_CLASSES` directly, while the Subclass step goes
through `subclassesForClass()` and *does* pick up custom entries. So Custom Content can author a
race or class that no character can ever be built with — an asymmetry a user will hit immediately.

### BUG-7 (Medium) — no spellcasting is set up for a caster
**Did:** created a level-1 Wizard and a level-1 Cleric.
**Expected:** some spell slots and/or a cantrip/prepared-spell step.
**Actually:** `spellSlots: {}`, `spellcasting: {classes: []}`, `spells: []` (the High Elf Wizard's
only spell is the *racial* cantrip from Elf's Cantrip choice). The wizard has a "Spellcasting"
class feature on the sheet and no way to cast anything. There is no cantrip/spell step in the
wizard at all. Plausibly a known POC gap, but it means "create a Wizard" does not produce a
usable Wizard.

### BUG-8 (Medium) — one stray tap on the backdrop discards the whole wizard, no confirmation
**Did:** mid-wizard, dispatched a click on `#modal-overlay` (the area outside the modal box).
**Expected:** at minimum a confirm, given a full character build is in progress.
**Actually:** modal closes, `creatorState` is thrown away, back to the selector with nothing saved.
`openModal` (`ui.js:21`) attaches an unconditional backdrop-close; `modal-full` also gets a
drag-to-dismiss handle. Compounding it: the Race step is the only step with **no Back button**
(`raceStepHtml`, `creator.js:279` renders a bare Next rather than `creatorNavHtml()`), and there is
no Cancel/X anywhere in the wizard, so the backdrop is the *only* exit — which is presumably why
it stays armed, but it's also the accidental-loss path.

### BUG-9 (Low) — 8 of 12 classes create a character with an empty inventory
`STARTING_KIT` only has Fighter, Rogue, Wizard and Cleric, so `creatorStepKeys()` skips the
Equipment step for the other eight and `buildStartingInventory()` returns `[]`. A newly created
Barbarian owns nothing at all — not even the "Also carried" basics — with no indication that a
step was skipped.

### BUG-10 (Low) — the Race step's "Step 1 of N" is wrong until a class is picked
On the Race step it reads "Step 1 of 6"; after picking Fighter it becomes "of 8", after Half-Elf +
Fighter "of 9". `creatorStepKeys()` can't know the total before the class is chosen, but the number
shown to the user is confidently wrong at the point they first read it.

### BUG-11 (Low) — dead code in `buildCharacterFromCreator`
`creator.js:822` computes `const subclass = cls && cls.subclasses ? cls.subclasses.find(...)` and
never uses the result — and it would fail to find a *custom* subclass anyway, since it searches
`cls.subclasses` rather than `subclassesForClass()`. Harmless today because the value is unused,
but it's a trap for the next person who reaches for it.

### BUG-12 (Low) — Elf builds show two identically-named "Ability Score Increase" traits
An Elf's race feature and its subrace feature are both called "Ability Score Increase" and both
land in `traits["Race Traits"]`, producing a visible duplicate on the sheet. Worse in principle:
`grantPendingChoice` dedupes by `featureName` + `traitCategory`, so if a race and its subrace ever
carried same-named features *with* choices, only one choice would be granted. Not reachable with
current SRD data, but the collision is already half-present.

---

## SUSPICIOUS / NEEDS HUMAN EYES

- **Is the +2/+1 overlay meant to replace racial bonuses?** BUG-2 assumes yes (BG3 style, which the
  code comment claims). If the intent is instead "point buy, then racial bonuses on top", then the
  overlay is the redundant part and the fix goes the other way. Someone has to decide which.
- **The Class step and Subclass step print every level's features**, not just level 1. Reads as a
  class preview, but next to "pick one now" it looks like a list of what you're getting.
- **Wall-of-text on the Class step.** All 12 class buttons stay rendered above the selected class's
  full feature list, so the selected-class detail is far below the fold. Can't judge scroll
  position from a DOM.
- **Nothing tells you the Equipment step was skipped** for a Barbarian — visually you just go
  Skills → Name and never learn you have no gear.
- **Toasts stack and persist** for several seconds; while driving I repeatedly caught a *stale*
  toast from two steps earlier still on screen. Whether that reads as confusing on a real phone
  needs eyes.
- **`pointBuyCost(v)` returns 0 for any score below 8**, so dropping a score to 1 refunds nothing
  but silently flags the build custom. Deliberate per the "custom content needs room" rule, but a
  player who fat-fingers − once and back + once is fine, whereas one who parks a score at 7 gets a
  "not legal" label for what they may read as a free choice.
- **Import from File** was not exercised (needs a real `File`/`FileReader`); the wiring is present
  and the handlers look sane, but it is untested here.
