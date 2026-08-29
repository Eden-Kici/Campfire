# Campfire: Player — app-wide review

**Written:** after the three UX rounds, against a working tree of `731baa2` + uncommitted changes.
**Suite:** `node tests/run.js` → **1522 passing.**
**Method:** three passes in real Chromium at 390×812 across all three themes — consistency, clarity,
and a code-level readiness assessment for six planned features. Nothing here is implemented.
**Second pass** (sections D–G, items 45–55) added after the properties bug turned out to be real:
a spec-parser diagnosis, an app-wide sweep for the same class of bug, and an independent audit of
section C that corrected nine of its claims.

Everything below is a proposal. Approve, reject or amend item by item; the numbering is stable so
you can just say "do 1, 4, 9–12, skip 6". **Item 45 is a live bug, not a proposal.**

---

## 0. First, the four things you flagged

**Weapon properties — I was wrong, and the real cause is worse. See items 45 and 46.**
My first answer (stale CSS) was wrong: your `style.css`, `tab-combat.js`, `ui.js` and `index.html`
are byte-identical to mine (md5 `3702c744…` etc.). The picker emits **a `<button>` inside a
`<button>`**, which is invalid HTML, and browsers disagree about it. Chromium 141 tolerates the
nesting, which is why my Chromium check passed and I called it stale CSS. A spec-compliant parser
does not — it auto-closes the outer button — and the result is exactly your screenshot. Verified
against `parse5` (the WHATWG reference parser) and reproduced pixel-for-pixel in the app.

**Small pills still in use** — confirmed, three of them, and they now mean three different things.
Items 4–6.

**Spells not matching weapon attack rows** — confirmed, and worse than it looks. Items 1–3.

**Weight hidden on non-carrying categories** — confirmed, and it's wrong in two places, not one.
Item 9. **`HOLDS Arrows`** — confirmed off, item 11.

---

## A. Consistency

### Worth doing

**1. `Cast` wears the "tap to roll" pill but spends a resource.**
`tab-spells.js` `renderSpellRow()`. Filled pills mean "this costs nothing and gives you a number"
everywhere else. On a pinned Spiritual Weapon row three identical filled pills sit under the weapon
rows: `Cast` (spends a slot, sometimes also rolls), `+4` (free), `1d8+3` (free). The only
irreversible one looks like the other two — and on Bless it produces no dice at all, so `Cast` is
inconsistent with itself. → Make it `.pill-outline`, the shape `Refill` already uses for exactly
this reason. *Cheap.*

**2. Pinned spell rows don't align with the weapon rows above them.**
Three ragged left edges in one list (weapon name at x=83 behind an emoji, levelled spell at x=80
behind a prepared dot, cantrip at x=58 behind nothing); pill widths differ (`+8` is 50px on a
weapon, `+4` is 33px on a spell, because `[data-spell-view] .atk-pill { min-width: 0 }` overrides
it); and nothing shares a column. → Give the spell row the same three fixed slots as a weapon row
— leading glyph / to-hit / damage — and leave a slot empty rather than collapsing it.
*Cheap-to-moderate, one render function.*

**3. A spell with no stored `damage` puts its to-hit bonus in the damage column.**
This is every character saved before that field existed — including yours, which is why Fire Bolt
showed only `+4` in your screenshot. With `damage` absent the single `+4` pill lands at x=339–372,
the exact slot where `1d8+3` sits on the weapon row above. Scanning the right-hand column you read
a to-hit bonus as a damage die. → Falls out of item 2. *Cheap.*

**4. `.chip` now covers three different interaction contracts.**
A condition chip opens a detail modal on body-tap and deletes on ✕; a language chip only deletes;
a gear-bonus chip does nothing at all. Identical shape, two sizes, three behaviours. → Pin `.chip`
to one meaning — *a removable token* — and move the other two off it (items 5 and 6).
*Structural but small.*

**5. Condition chips are the wrong component.** `tab-combat.js`.
A condition is the only "chip" with a whole record behind it: duration, concentration, a note, a
modifier list, a Remove button. And its delete target is **10×14 px** inside a 71×27 chip,
unconfirmed, a few pixels from the benign tap that opens the detail. Every other permanent delete
in the app is a full-width button or asks first. → Render conditions as compact rows — `.conc-row`
one section below is already the right shape — and drop the inline ✕, since the detail modal
already has Remove. *Moderate.*

**6. Gear-bonus chips aren't controls, and duplicate the line 100px below.**
"+1 AC Cloak of Protection" is inert text wearing a control's shape, and the Cloak of Protection
row beneath it already prints "+1 AC". The CSS comment says the old orange callout was removed for
duplicating the item rows; the duplication survived, it just got quieter. → Delete the chip row.
*Cheap.*

**7. The property checklist is the fourth shape for "pick from a fixed list".**
The app now has: the creator's skill grid (checkbox right, 46px), pending-choice option cards
(✓ right, accent-filled), Manage Content's wrapping `.toggle-btn` pill grids, and this
(checkbox left, 37px, hairline). Same job, four appearances. *Moderate.*

**8. The checklist itself is the wrong size and mixes two semantics.**
Eleven rows — 406px — in a form that is already 1,670px against a 752px viewport, for a median of
**two** properties per SRD weapon (distribution across 41 weapons: 0:4, 1:10, 2:16, 3:8, 4:2, 5:1).
And the "Your own" rows share `.prop-row` and its rule line but have no checkbox, indent
differently, delete on ✕ rather than untick, and can't be unticked. Also: tapping
`Versatile (1d10)` removes it rather than letting you edit the qualifier, which is the one thing
the row's text invites. → **My recommendation:** collapse the block behind a summary line
(`Properties · Versatile (1d10)`) that opens a dedicated picker, and build that picker out of
`.creator-option` so the app has one list-picker shape. Cheaper fallback: keep it inline, restyle
`.prop-row` to match `.creator-option`, and separate the custom block. *Structural but contained.*

**9. Manage Content's forms still use the pill palette the property picker just abandoned.**
Eighteen `.toggle-btn` pills wrapping into six ragged lines, ~430px tall — the exact pattern the
new picker's comment describes as the thing it replaced. Same feature area, opposite answer.
→ Whatever item 7/8 settles on, apply here. This is why the property change currently looks
arbitrary. *Moderate.*

**10. Two confirmation dialogs, and the item one destroys the form that raised it.**
`confirmDeleteItem` (`tab-inventory.js`) stacks Remove above Cancel with a ✕; `confirmModal`
(`ui.js`) puts Cancel left, Confirm right, no ✕. Worse: `confirmDeleteItem` is built on
`openModal`, which begins by closing whatever is open. **Verified: open Edit Item, change the
name, tap 🗑, tap Cancel — the edit form and your unsaved change are both gone.** → Delete
`confirmDeleteItem` and call `confirmModal`. *Cheap, and it fixes the bug as a side effect.*

**11. `HOLDS Arrows` is the wrong tag saying the wrong half.**
It wears the identical `.res-tag` as the `LR`/`SR` recharge tags on the six rows above, so it
parses as "recharges on HOLDS Arrows". It says the obvious (a quiver holds arrows) and omits the
news (where Refill draws from and whether that source has anything left) — which lives in a
`title=` tooltip, unreachable on a phone. Meanwhile the Inventory tab never shows the Quiver's 20,
so a player reads their arrow supply as 60 when it's 80 across two pools. → Put the source on the
button: `Refill from Arrows (60)`. Stop using `.res-tag` for anything that isn't a recharge
trigger. *Cheap.*

### Smaller, all cheap

**12.** `.modal-heading` and `.breakdown-title` are byte-identical CSS used interchangeably (61 vs
9 uses, mixed within the same files). Collapse to one.
**13.** The same breakdown labels the same quantities two ways — a weapon says `Strength modifier`
then `Proficiency (Martial)`; a spell says `Proficiency Bonus` then `Intelligence Modifier`.
Different word, different casing, reversed order, under the same "To Hit" heading.
**14.** Three secondary buttons are hand-styled inline instead of `.btn-secondary`, one shade off
the real thing (Give ×2, Stow).
**15.** `Drop` (concentration) is a `.toggle-btn` — the segmented-control shape — but is a one-shot
irreversible action and never enters an active state.
**16.** "Conditions", "Effects" and "Modifiers" are three names for two things: tapping `+ Add`
under **Conditions** lands you in **Add Effect**. CLAUDE.md's GM-sync plan makes this vocabulary
load-bearing.
**17.** The override mechanic is described three ways: "Set it manually", "Override bonus",
"Override the scaled max" — three modals of the same family.
**18.** Sibling edit modals say both "Save" and "Save Changes"; `tab-character.js` and
`tab-notes.js` each use both.
**19.** "Remove" and "Delete" both mean permanent destruction, while "Stow" and "Stop tracking"
mean the non-destructive thing — so the Remove/Delete split reads as if it carried that meaning.
**20.** Some permanent deletions confirm, some don't. Unguarded: Remove Effect, Remove resource,
Remove feature, and the condition chip's ✕ — all destroy user-authored records, all wear the same
`.btn-danger` as the guarded ones.
**21.** `.mini-edit` (the pencil class, 7 other uses) renders a ✕ delete in Manage Content, in the
slot where other rows show a harmless `View`.
**22.** Row title sizes drift by tab: 14px on Combat/Spells, 13.5px on Inventory/Notes, 13px on
Character. The containers match perfectly; only the titles don't, and 13.5px isn't a scale value.
**23.** The tutorial's "next" is `.btn-primary` in the welcome modal and `.tutorial-next` in the
banner — same action, consecutive steps.
**24.** `.res-tag` has five ad-hoc inline colour variants; the 3PP triple is copy-pasted across
three files.

---

## B. Clarity

### Worth doing

**25. Weight is hidden in both places it should appear.** `tab-inventory.js`.
Spare Chainmail, 55 lb, in Camp Storage:

| Surface | Now | Should read |
|---|---|---|
| Inventory row | `No weight` | `55 lb · not carried` |
| Item detail | `not carried` | `55 lb — not counted (Camp Storage)` |
| `Carried weight:` total | `46 lb` (correctly excludes it) | unchanged |

`No weight` is a claim about the *object*, not the category — the wrong sentence in the wrong
place. The two surfaces don't even agree with each other, and the number survives only inside the
edit form. A player deciding what to leave at camp can't see what it costs to take back.
*Cheap: two template strings.*

**26. Spell slots — the problem isn't the two copies, it's that neither is where the action is.**
On the Spells tab the count is 12px `--text-dim`, right-aligned on a section heading, beside an
11px pencil so it reads as part of the edit affordance — and **neither level heading is on screen
when you arrive** (1st Level at y=688, 2nd at y=955, in a 591px viewport). The `Cast` button that
moves the number is a filled pill at full contrast. The control is loud; the state it changes is a
whisper on a header that has scrolled away. On Combat the rows *are* visible on arrival but are
filed under **Resources** next to Second Wind and Arrows — the word "slots" never appears as a
heading anywhere. And casting is **silent on success** and toasts only on failure, which is
inverted. → Two cheap changes, no third surface: promote the count on the level header to a
tappable pill at `Cast`'s weight, and make `castSpell` toast on success with the count it already
builds on failure (*"Misty Step cast · 1/3 second-level slots left"*). This is also most of
feature 4 below.

**27. Max HP is the only headline stat with no breakdown.**
AC, Initiative, Speed, Passive Perception and Prof Bonus all open one on tap. Tap Hit Points and
you get a keypad. `calculateMaxHP()` already returns `sources` that nothing renders — so at
Exhaustion 4 the max silently halves with the explanation sitting unused. This is the codebase's
flagship property failing on the number players care most about. *Cheap.*

**28. `Carried weight: 46 lb` has no denominator and no breakdown.** 46 out of what? There is no
carrying capacity anywhere in the app, so the number has no consequence. And unlike every other
total it can't explain itself, though it already computes the itemised list. → Make the line
tappable into `openBreakdownModal`. Adding capacity (STR × 15) is a small model addition and
exactly the kind of gap this POC exists to surface. *Cheap.*

**29. A new character's Combat tab reads as broken.** Resources and Attacks have no empty-hint
fallback where Conditions and every Inventory category do — so a fresh level-1 character sees
`Resources + Add` / `Attacks + Add` with nothing between them. Only 4 of 12 classes have a
`STARTING_KIT`, so **8 of 12 new characters** get this. It is the first screen of the app.
*Cheap.*

**30. A non-caster's Spells tab looks like a failed load** — a Barbarian sees an All/Prepared
filter, `0 / 0 prepared`, and a Cantrips heading over "Nothing here". Nothing says "you don't
cast". *Cheap.*

**31. Skill names render camelCase on the sheet** — `SleightOfHand`, `AnimalHandling` — while the
creator's skills step shows "Sleight of Hand" from `ALL_SKILLS`. Same skill, two spellings, two
screens apart. Display-only fix; the key is the data-model identity, don't touch it. *Cheap.*

**32. Numbers silently include temporary effects.** Wisdom shows **+2** beside a *hollow*
(not-proficient) dot when the WIS modifier is +1 — the row contradicts itself, and the missing +1
is Bless, visible only inside the roll modal. Dropping concentration moves Wisdom +2 → +1 and
Longsword +8 → +7 with no marker before or after. A player copies +8 onto a card and it's wrong
the moment concentration breaks. → Mark any total that includes an active effect group; the
information is already in `sources`. *Cheap.*

**33. Base values are printed as bonuses.** The shared `breakdownRowsHtml` applies `formatModifier`
to every source, so the AC breakdown's first row reads **`Chain Shirt +13`** — a false statement in
the app's best feature. (The Dex-cap row right below it is labelled correctly, so this is one gap,
not a pattern.) → Let a source opt out of the sign. *Cheap, one renderer.*

**34. The `!` on a non-proficient attack is a tooltip** — a red badge with no legend and a `title=`
that never fires on a phone. The detail modal says it properly, but you'd have to already suspect
something. → Say it in the range line that's already there. *Cheap.*

**35. `Quiver 20` on the Shortbow row** sits in the same dot-separated list as `80/320 ft` and
`Piercing`, so it parses as another weapon property. Combined with item 11: the player's arrow
count reads as 60 when it's 80 in two pools. *Cheap.*

**36. Armour in a storage category doesn't say it isn't applying.** The weapon branch prints
*"Stowed in Camp Storage, so it isn't on your Attacks list"*; the armour branch prints `Base AC 16`
with no note — for the highest base AC the character owns, contributing nothing. The app already
knows how to say this. *Cheap.*

**37. Collapsible sections have no disclosure indicator and no counts.** Tapping `Skills` makes 18
rows vanish and the heading is byte-identical before and after. `Class Features` (11 entries) and
`Feats` (1) are indistinguishable while closed, so there's no reason to open either. *This is the
cost of removing the +/− you asked me to remove* — I removed the indicators without replacing the
affordance. → A rotating chevron plus a count on the head (`Class Features 11`). *Cheap.*

**38. An overridden stat shows `*` with no legend**, and its breakdown then shows only
`Manual override 9` — the derived value it replaced is gone. This is the app's own most important
data-model distinction rendered as unexplained punctuation. → A small `SET` tag, and show the
derived value alongside (`Would be +2`). *Cheap.*

### Judgement calls — your decision

**39.** Prepared count sums across casting classes: `6 / 6 prepared` could be 5 Wizard + 1 Cleric,
which isn't legal. The per-class data already exists (`maxPreparedByClass`), so
`Wizard 3/3 · Cleric 3/3` is nearly free — costs one line on a header-heavy tab.
**40.** Tapping a skill or saving throw **rolls immediately**; there is no look-without-rolling
path, and every glance logs a die. Every other tappable thing on the sheet shows first and acts
second — `tab-inventory.js` states that split as a principle. Fast at a table; inconsistent.
**41.** The HP bar is always red, unconditionally — a new character at 11/11 shows a full red bar.
One colour is calmer than a traffic light, but red at full health inverts the signal players scan
for.
**42.** The creator will finish a character with **the entire point-buy pool unspent** — I walked
through with defaults and got a Barbarian with every score at 9 and no warning. The step
deliberately allows going *over*; under-spending is the direction nobody handled.
**43.** Toasts land at the top over the character name, and stack duplicates — two identical
"No 2nd-level slots left" toasts, triggered by a button at the bottom of the screen. De-duplicating
repeats within the 3s window costs nothing.
**44.** Hit dice are identified only by die size (`d10`, `d6`, `d8`) — a multiclass player must
already know Fighter = d10 to spend the right one.

### Deliberate — leave alone

Resources and slots going negative (documented, and custom content needs the room; item 26's fix is
to make `-2/3` *legible*, not to clamp it) · the `A`/`B`/`R` casting-time codes (considered density
trade, and the detail says the full word) · Camp Storage not counting weight (that's the point of
`categoryRules`; item 25 is about wording) · the party finder and note sharing being fake · the
existing empty hints, which are good and are what items 29 and 30 should copy · the attack detail,
Level Up and effect modals — these are the best screens in the app and the standard the rest should
be judged against.

**One pattern worth naming:** nine of the clarity findings are the same failure — *the app knows the
number and chooses not to show it*. Weight is in `item.weight`. Max HP has `sources`. Prepared
limits are per-class. Proper skill names are in `ALL_SKILLS`. The Bless contribution is in
`sources`. The proficiency warning and the refill source are both in `title=` attributes. The data
model is doing its job; the render layer is discarding its output. For a POC whose purpose is
discovering what the real build needs, that's the cheapest class of fix and the one that most
changes what the demo proves.

---

## C. The six features you plan to build

### F1 — Multi-recipient item giving. **Small–medium.**

**Supports it:** `openGiveQuantityModal` → `openGiveToModal` is already a two-step flow, and
`partyRosterForGiving()` already builds the roster with GM/Player roles. `.recipient-row` and
`.radio-dot` exist.
**Blocks it:** the radio dot is single-select by construction (`let selected = null`), and the
quantity step runs *before* recipient selection — the wrong order for a split, since you can't
divide until you know among how many.
**The modelling decision:** invert the flow (pick recipients → then split), and decide whether a
split is *N equal shares with a remainder* or *N editable amounts seeded with an equal split*. I'd
do the latter: an equal-split button that fills editable fields, so "equal" is a shortcut rather
than a mode. Also decide what happens to a remainder that doesn't divide (4 arrows among 3).
**Ripple:** none on persistence — giving is already fake (nothing leaves the sheet but the
quantity). This stays a UI change until the GM app is real.
**Order:** independent.

### F2 — Note formatting. **Medium, and the one that collides with an invariant.**

**Supports it:** notes are plain text in `note.body`, rendered through `esc()`.
**Blocks it:** *that's exactly the point.* Everything in this app goes through `esc()` into
`innerHTML`, and the `escaping` suite poisons every writable field and re-renders every surface to
prove it. Any rich text means deliberately **not** escaping something — which is the one rule the
codebase enforces hardest, and CLAUDE.md names forgetting it as failure mode #1.
**The modelling decision — and it's the important one:**
- **A markdown subset with your own renderer** — `esc()` first, then convert a fixed whitelist
  (`**bold**`, `*italic*`, `- list`, `# heading`) on the *escaped* string. Nothing user-authored
  ever reaches `innerHTML` unescaped; the transform only ever adds tags the app itself chose. This
  preserves the invariant exactly and is the option I'd take.
- **`contenteditable` rich text** — stores HTML, which means storing user-authored markup and
  sanitising it on the way out. That breaks the invariant, needs a sanitiser (a real dependency, or
  a hand-rolled one you now own), and makes every future "is this escaped?" question harder. I'd
  not do this.
**Ripple:** the escaping suite needs a case proving the transform can't be escaped *through*
(`**<img src=x>**` must still render an inert `<img` as text inside `<strong>`). Export/import
unaffected (still a string). Note sharing is fake, so no sync concern yet.
**Order:** independent.

### F3 — Visual spell slots (boxes). **Small.**

**Supports it:** `{ current, max, recharge }` already carries everything a pip row needs; the
death-save pips are an existing pip component with correct 38px tap targets.
**Blocks it:** nothing structural. Two render sites (`tab-combat.js` resource rows,
`tab-spells.js` level headers) and a setting.
**The modelling decision:** where the preference lives. Settings already has its own storage key
separate from the character — that's the right home (a display preference, not character data), and
it means it survives the "refuse old saves" behaviour. Second decision: what a pip row does when
`current` exceeds `max` or goes negative, which the app explicitly allows. Suggest: pips for the
normal range, and fall back to the number when out of range, so the affordance never lies.
**Ripple:** `themes`/`smoke` suites touch these renders; a new setting needs a default for existing
installs.
**Order:** do **F4 first** — F3 is a second presentation of the same number, and it isn't worth
building two presentations of something still hard to find.

### F4 — Make the slot numbers obvious. **Small.** See item 26 — same work, already specified.
**Order:** do this first of the two.

### F5 — More functional user-authored effects. **Large, and the one to scope down.**

**Supports it:** the effect-group model is genuinely good — `{ category, value }` with seven
categories, `getAllEffects()` gathering from every source, and every consumer filtering by category
(`e.category === "Bonus" && e.value.stat === statName`). Adding a category is a data change plus one
consumer.
**Blocks it:** every existing category is a **static modifier** — a number added to a value the
sheet already computes. Disciple of Life is a different shape: it's a *trigger* ("when you cast a
healing spell of 1st level or higher") with a *formula* ("2 + the spell's level") applied to an
*event* (healing another creature) the app doesn't model at all. There is no event bus, no concept
of a target, and healing done to someone else isn't a quantity the sheet has.
**The modelling decision — the real fork:**
- **A rules engine** (triggers, events, targets, formulas) is a different application. Don't.
- **A "reminder" category** — an effect that surfaces prose at the right moment rather than
  computing anything: *when this spell is cast, show "Disciple of Life: +2 + spell level healing"*.
  Cheap, honest, and it's what a table actually needs, since the player is telling the DM a number
  anyway.
- **Middle ground, and my recommendation:** extend the *existing* static-modifier vocabulary where
  the sheet already computes the value — a `Damage` category (weapon/spell damage bonuses),
  `Healing` (a flat or formula add to a healing roll you make), `Resistance`, `Speed`, `Max HP`.
  Each is one new category, one consumer, and stays inside the "it's a number on something the
  sheet already knows" boundary. Disciple of Life then becomes a `Healing` effect with a
  level-scaled amount — *which the app can already express*: `resolveScalingValue()` exists and
  handles level-scaled amounts today.
**Ripple:** `EFFECT_CATEGORIES_GENERAL`/`_FEATURE` in `srd-data.js`, the effect form in
`tab-combat.js`, `featureEffectSummary()` and `effectSummaryLabel()` (both switch on category), the
`content-data` suite which validates categories, and the custom-content editors.
**Order:** after F6 if you want damage categories to interact with item types; otherwise
independent.

### F6 — Expanding item categories. **Depends entirely on which you mean — and they're different.**

The app has **two** things called categories, and this is worth separating before you build:
- **Item *type*** — `isWeapon` / `armour` / neither. Drives which form fields appear and whether the
  item produces an attack or contributes AC. Three values, hardcoded in the form's segmented
  control and in `readItemFields`.
- **`character.categoryRules`** — named containers (Worn, Equipped, Camp Storage) with
  `{ countsWeight, appliesEffects, providesAttacks }`. **Already fully user-extensible** — you can
  add categories today.

You almost certainly mean the **type**. Candidates: Consumable (charges, "use" spends one — the
`resource` model already exists), Ammunition (partly modelled via `refillFrom`), Tool/Kit
(proficiency-linked), Focus, Container (a real one, with capacity).
**Blocks it:** the type is a three-way branch, not a table. `readItemFields` and `itemFormFieldsHtml`
switch on it, and `TYPE_ONLY_FIELDS` lists which fields to strip when the type changes.
**The modelling decision:** make type a **data-driven registry** — each type declares its extra
fields, its form section and its behaviour hooks — rather than adding a fourth and fifth branch. One
refactor now, then each new type is a data entry. The alternative (keep branching) is cheaper twice
and worse forever.
**Ripple:** `SCHEMA_VERSION` bump (the app refuses old saves rather than migrating — worth deciding
whether that's still acceptable once you're adding types regularly), the Manage Content item form
which shares the same fields, import validation, and the `equipment` suite.
**Order:** do this **before** F5's damage categories if you want them to interact.

### Recommended sequence

1. **F4** (slot visibility) — cheap, and half of it is item 26 which you may approve anyway.
2. **F1** (multi-recipient) — self-contained, no model risk.
3. **F6** (item types, as a registry) — the refactor that makes later additions cheap.
4. **F3** (visual slots) — trivial once F4 has settled where the number lives.
5. **F5** (effects, scoped to new *static* categories) — after F6.
6. **F2** (note formatting) — last, not because it's hard, but because the markdown-subset decision
   deserves to be made deliberately rather than under momentum.

**The one I'd push back on:** F5 as stated. "Users can replicate Disciple of Life" implies a trigger
system, and that's a different product. The scoped version — new static categories plus a reminder
effect — gets you most of the table value for a fraction of the surface, and it's the version that
stays true to the POC's stated job of *discovering* what the real build needs rather than building
it.


---

# Second pass

You said the properties were still broken and asked me to re-check this document with the feature
agent. Both were worth doing: **item 0 was wrong**, and the agent found nine false claims in
section C. Everything below is new. Numbering continues from 44 so the earlier list stays stable.

## D. The property picker — what is actually wrong

**45. `renderPropertyPicker` emits a `<button>` inside a `<button>`. This is the bug.**
`tab-combat.js:998–1003`. Each row is `<button class="prop-row">` and the checkbox inside it is
`miniCheckboxHtml()` (`ui.js:229`), which returns another `<button>`. Nested buttons are invalid
HTML, and the parsers disagree:

| | result |
|---|---|
| Chromium 141 (what I tested on) | keeps the nesting; 11 rows at 342×37, renders correctly |
| WHATWG spec / `parse5` 8.0.1 | auto-closes the outer button at the inner one |

Under the spec the `.prop-list` (which is `display:flex; flex-direction:column`) receives **three
siblings per property** instead of one row: an empty `.prop-row` button, the checkbox, and the
label. **33 flex items, 605px tall, checkbox stacked above its own label.** That is your
screenshot. I rebuilt the DOM that way in Chromium and it matches your image exactly.

It is not only cosmetic. In that tree:

- the label is no longer inside the button — `button .prop-row-name` count goes from 11 to **0**
- `data-prop-check` has no listener anywhere (the checkbox was only ever decoration inside a
  clickable row), so **tapping the checkbox does nothing**
- the only clickable thing left is an empty 342×19 strip sitting above each checkbox

So on your browser the picker is not merely ugly, it is close to unusable — you have to hit a blank
19px band to toggle a property. **Confirmed by Eden: Firefox.** Switching to Chrome hides it, because
Chromium tolerates the invalid nesting — it does not fix it. Safari/WebKit follows the spec the same
way Firefox does, so for an app aimed at phones this is broken on every iPhone.

**The fix:** make the row a non-button — `<div class="prop-row" role="button" tabindex="0">` — or
make the checkbox a `<span>` rather than a `<button>`. I'd do the second: `miniCheckboxHtml` is
already driven by a click listener rather than by being a real control, so it gains nothing from
being a `<button>`, and changing it there fixes the class of bug rather than this instance.
*Cheap. This should go first, ahead of everything else in this document.*

**46. Nothing in the suite can catch this, and something should.**
I swept every surface in the app in Chromium — five tabs, the selector, ~40 modals, the content
manager's six forms, and every creator step — for nested interactive elements. **The property
picker is the only violation**, so this is contained rather than systemic. But it survived a unit
suite, a Chromium pass and an agent review, because the DOM stub never parses markup, Chromium
tolerates it, and the markup *looks* right in source. → The `structure` suite can catch it with no
dependency: scan each render function's output for a `<button` opening while another is still open.
Same for `<a>` inside `<a>` and `<form>` inside `<form>`. *Cheap, and it closes a hole the whole
three-layer verification approach has.*

Worth saying plainly: my Chromium checks are weaker evidence than I have been treating them as.
Anything that renders correctly there can still be broken markup.

## E. Corrections to section C

The feature agent found nine claims in section C that don't survive contact with the code. Four
change a recommendation.

**C-F5 was built on a false premise.** I wrote that Disciple of Life "the app can already express"
because `resolveScalingValue()` handles level-scaled amounts. It does (`character-data.js:686`) —
but its tiers are keyed on **character level**, and every caller resolves against
`totalLevel(character)` (`:695`). Disciple of Life scales with the **slot level of the spell being
cast**, which is not a character-level tier table. The scoped-down F5 is still the right call; it is
just not nearly free.

**C-F5's "add a reminder category" already exists.** `openAddEffectModal` says "Leave the list empty
for a label-only reminder" (`tab-combat.js:740`) and the detail modal renders it (`:852`). The gap
is that a reminder never surfaces *at cast time*.

**C-F5's proposed `Damage` category also already exists.** `MODIFIER_STATS` (`srd-data.js:124`)
includes `Damage Rolls`, folded into `calculateAttack` with a `sources` row
(`character-data.js:1164`). Of the five categories I proposed, only `Healing`, `Resistance` and
`Max HP` are actually new — and `Max HP` collides with `character.maxHpModifiers`
(`character-data.js:63`, read at `:922`), which **nothing in the app writes**. Dead mechanism;
decide whether to wire it or delete it.

**C-F5's `content-data` ripple is invented.** That suite never validates effect categories — it's
an SRD-table linter. It *is* relevant, but to F6.

**C-F6 named three functions that don't exist.** There is no `readItemFields`, no
`itemFormFieldsHtml`, no `TYPE_ONLY_FIELDS`. The real code is `commonItemFieldsHtml`
(`tab-inventory.js:231`), `readCommonItemFields` (`:300`), `applyItemType` (`:403`),
`renderItemTypeFields` (`:416`), and the "strip list" is an anonymous array inline at `:408`.

**C-F6's central claim is backwards — and this is the useful correction.** I said the type toggle is
hardcoded. It isn't: `itemTypeToggleHtml` maps `ITEM_TYPES` (`srd-data.js:355`) and
`wireItemTypeToggle` is generic. The agent pushed a fourth entry into `ITEM_TYPES` in the live page:
**a fourth button rendered, wired and clicked — and the saved item silently lost its type**
(`itemType()` returned `"gear"`). So half the registry already exists, in a state where adding a
type appears to work and quietly corrupts the item. The real branch sites are four, not one:
`applyItemType`, `renderItemTypeFields`, `itemType()` at **`character-data.js:844`** — which is in
the portable layer, so the registry can't live in the UI as I implied — and `stackable` in
`creator.js:1402`.

**C-F3 undercounted the render sites** (three, not two: `tab-combat.js:190`, `tab-spells.js:134`,
`openEditSlotsModal` at `tab-spells.js:296`) **and named the wrong ripple.** The `themes` suite
doesn't touch these renders; it's a palette linter, so the real constraint is that new pip CSS may
contain no hex literal and any new `--var` needs all three themes. And "a new setting needs a
default" is already handled — `loadSettings` does `Object.assign` (`theme.js:44`).

**C-F2's framing was wrong, and it changes the size.** I said notes are rendered through `esc()` and
that rich text collides with the escaping invariant. `note.body` reaches the DOM in exactly two
places: a 60-char list preview (`tab-notes.js:52`) and a `<textarea>` (`:349`). **There is no read
view of a note** — tapping a note opens the editor; the note *is* the editor. So the invariant isn't
currently in play (a textarea can't execute markup), and F2 is not "add a transform to a render
path", it's "build the display surface notes have never had, plus a read/edit mode switch". Bigger
than I said, and a different shape of work.

## F. New items

Prerequisites first — these are bugs the features would otherwise inherit.

**47. Any new effect category silently renders the *Bonus* form and stores a Bonus-shaped value.**
`ui.js:398` and `:429` — the `Bonus` case is the **fall-through default**, not a named branch, and
`effectSummaryLabel` falls through to `return effect.category` (`character-data.js:757`). Verified
live: adding `"Healing"` to the categories produced a Stat select defaulting to **AC**. A user
authors "Healing +3", the app stores `{stat:"AC", amount:3}`, **and their AC goes up.** No test
catches it — the harness fires no listeners and the markup is valid. → Make `Bonus` a named branch
and give unknown categories an explicit failure. *Small, and a hard prerequisite for F5.*

**48. A custom item with a new type disappears from Manage Content entirely.**
`content.js:121–123` buckets custom items by exact string (`i.type === "weapon"|"armour"|"gear"`),
and search is built on the same buckets (`:159`). An item saved with a fourth type is persisted,
un-listable, un-searchable and **un-deletable from the UI**. *Small, invisible until someone saves
one — prerequisite for F6.*

**49. `SCHEMA_VERSION` doesn't protect the store F6 would break.** `SCHEMA_VERSION = 8`
(`characters.js:24`) gates only `campfire.characters`. `campfire.customContent` is a separate key
with **no version and no shape validation** (`content.js:62–76`) — which is exactly where
old-shaped custom items live. My section C said "bump SCHEMA_VERSION"; that does nothing here.
*Small — but it's the opposite conclusion to the one I drew.*

**50. The Give flow already dead-ends on a new character.** `creator.js:1243` gives a created
character `partyMembers: []`, and `openGiveToModal` (`tab-inventory.js:786`) renders the roster with
**no empty-hint fallback**, unlike every other list in the app. Verified: the modal is literally
"Give to | Confirm", zero rows, Confirm permanently disabled, no cancel. Only the demo character has
a party. *Trivial — but F1 is a split UI built on top of this, so fix it inside F1.*

**51. `.radio-dot` and `.recipient-row` have a second consumer.** `openStowWeaponModal` reuses both
(`tab-combat.js:1176`) with shared CSS (`style.css:807`). F1 invites changing `.radio-dot` in place,
which would make the single-select Stow modal look multi-select. → Add a `.check-dot` rather than
mutating `.radio-dot`. *Trivial.*

**52. The note list preview leaks markdown and truncates mid-token.** `tab-notes.js:52` slices the
raw body to 60 chars. With a formatted body it renders `**Ambush** at the bridge - Mira scouts…`.
A markdown subset needs a strip-to-plain pass, applied *before* the 60-char cut. *Small — a second
renderer section C didn't count.*

**53. `creator.js` is at 1,486 lines against the 1,500-line cap** (`tests/structure.test.js:82`).
Fourteen lines of headroom, and both F5 (`creator.js:233`, `:260`) and F6 (`:1402`) touch it.
Whichever lands first pays for splitting the file. *Medium, and currently unbudgeted.*

**54. Two suites assert the slot header's literal wording.** `tests/ui-fixes.test.js:45` and
`tests/spells-ux.test.js:291` both assert `html.includes("no slots")`. Any F4 rewording breaks both.
*Trivial — but it's the concrete test cost of F4, which section C listed as having no ripple.*

**55. The death-save pips don't fit the Combat slot row, so F3 has a real design decision in it.**
Measured live at 390px: the `.res-row` is 342px, the name wrap runs to x=192, and the `.stepper`
occupies x=266–372 — **106px of free space**. Sigrid has four 1st-level slots; four 38px pips need
152px. So either the pips shrink below the tap target that justified reusing them, or the row
re-lays out — and the stepper is the only way to *decrement* a slot from Combat
(`tab-combat.js:343`). My "reuse the existing pip component, it already has correct tap targets"
doesn't survive the Combat surface. *This is the actual F3 decision, and section C didn't ask it.*

## G. Revised build order

Two changes from section C's sequence.

**F4 and F3 are one pass, not bookends.** I had two features between them, which means the Combat
row and the Spells header get rewritten, shipped, and rewritten, and the two `"no slots"`
assertions get updated twice. And item 55 shows F3 isn't trivial-after-F4 — it forces a layout
decision F4 should make once rather than inherit.

**F6 goes before F1.** I called F1 independent. It is, for a plain stack — but F1's whole deliverable
is a UI for splitting `item.qty` (`applyGive`, `tab-inventory.js:819`), and F6 introduces items where
a quantity is ambiguous: a charged consumable, a container with `loaded` (which `applyGive` never
touches). Build the split UI first and you answer "what does giving 2 of 5 mean" twice.

**F5 does not depend on F6.** That dependency rested on the `Damage` category, which already exists.

0. **Item 45** — the property picker. It's a live bug on your browser.
1. **F4 + F3 together** — one pass over the three slot surfaces, one stepper decision, one test update.
2. **F6** — as two commits: first make type a registry across all four branch sites plus the
   Manage Content filter (48) and a customContent version key (49); only then add types. Note the
   fourth-button hazard is live in `ITEM_TYPES` today.
3. **F1** — now that "quantity" has a settled meaning per type; fold in 50 and 51.
4. **F5** — scoped to `Healing` / `Resistance` / `Max HP`, with item 47 fixed first and
   `maxHpModifiers` either wired or deleted.
5. **F2** last — re-scoped from "add a markdown transform" to "build the read view notes have never
   had", plus 52.
