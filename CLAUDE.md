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

```bash
node tools/build-sw.js       # regenerate the service worker's cache list after adding a file
```

There is **no build step and no dependencies**. Open `index.html` in a browser to run the app —
the service worker won't register over `file://`, which is fine and expected.

It is also a **PWA**: `manifest.json`, `sw.js` and four icons. Served over HTTPS it installs to a
phone's home screen and runs offline. See `DEPLOY.md`.

**The brand.** Every icon is generated from the real logo — a flame over crossed logs, three flat
tones (`#F5C37A` gold, `#E8843A` orange, `#533A2A` log brown) that are already the palette's own
accents. `logo-mark.png` is the transparent mark, sized in CSS against the wordmark it sits beside
so the two stay one lockup; the icons sit on `#17120f`, the manifest's own background, so the
install splash doesn't seam. There is one mark for all three themes, which is what the brand sheet
specifies. **Adding an image means adding it to `tools/build-sw.js`'s static list and re-running it**
— a file the page loads but the worker doesn't cache works perfectly until the phone loses signal.

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

Order: identity primitives (`identity.js`, which declares nothing but `makeId`/`sameId`/`deviceId`
and depends on nothing) → reference data (`srd-*.js`, now several files — races, classes, equipment, magic items and
two halves of the spell list, split to stay under the `structure` suite's 1,500-line cap) →
character data → `demo-character.js` (the sheet the app opens with, split out of character-data.js at
the 1,500-line cap: it is pure data, everything left behind is calculation, and it loads *after* its
parent because it reads constants declared there) → shared machinery (`dice-history`, `roll`, `ui`, `theme`, `characters`, `tutorial`,
`creator`, `party-protocol`, `party-net`, `party`, `content`, `rests`, `choices`, `help`) → one file
per tab (plus `inventory-give.js`, split off when tab-inventory hit the 1,500-line cap: everything
about the moment something leaves your sheet for somebody else's, none of which is needed to draw an
inventory) → one file per tab → `app.js`, which is
~50 lines of tab switching and boot.

All top-level `function` and `const` declarations share one global scope. Two files declaring the
same name is a real hazard (`let`/`const` throws at load; `function` silently shadows) — the
`structure` suite guards against it.

### Three layers

- **`srd-data.js`** — static tables only. Conditions, damage types, SRD-shaped races/classes/
  backgrounds/kits, and the fixed lists forms are built from. No functions, no DOM. This is a
  stand-in for content a real build would load rather than hardcode.
- **`character-data.js`** — the character object plus every calculation. **Zero DOM references in
  1,297 lines.** This layer is the actual output of the POC and ports to any platform unchanged.
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
- **A bonus can be dice, and dice ride in the roll rather than the total.** Bless adds 1d4 to attack
  rolls and saving throws, which is not a number you can fold into "your attack bonus is +7" — the
  whole point is that it is rolled fresh each time. So `effect.value.amount` may be a dice string;
  `effectAmount()` resolves it to 0 (it contributes nothing flat, and still shows in the breakdown at
  zero so the player can see it is there), and `effectDice()` / `statBonusDice()` /
  `savingThrowBonusDice()` / `skillBonusDice()` collect it for `withBonusDice()` to append to the
  notation and to the pill: `+7+1d4`, rolled as `1d20+7+1d4`.
  Collected **at the roll site rather than inside the calculators**, which is why five calculation
  functions and their tests were left alone.
- **Where that number shows is a setting; what it comes to is not.** `sheetBonusLabel()` respects
  `settings.showBonusRange`: off (the default) the sheet keeps the steady modifier it has when
  nothing temporary is up, and the range appears when you go to roll; on, the sheet reads `+8~11`
  everywhere. The **roll window always** carries a "Total bonus" line under the notation, whichever
  way the setting is set — `1d20+7+1d4` is what you are throwing, `+8~11` is what it means, and
  working that out in your head at a table is the job the app exists to do.
  A Saving Throw effect can name `"All"`, because Bless lifts every save and writing that as six
  separate modifiers is six things that can drift apart.
- **`APP_VERSION` in app.js is shown under Development in the menu, and is bumped by hand.** Bump it
  whenever you change something a player would notice, so "which build is this phone running" has an
  answer during a demo instead of a guess.
- **Any item can be made a container** from its detail view, next to Track under Resources — a
  barrel, a chest, a saddlebag. `ignoresContentWeight` is the second toggle: a bag of holding
  reports only its own weight, and `weightlessContainerFor()` is what the weight sum asks about each
  item, so nothing else in the app needs to know which bags are magic. Turning the toggle off tips
  the contents out rather than stranding them pointing at something that no longer holds anything.
- **A pack is a real container.** The relationship lives on the *child* — `item.inside` holds the
  container's id — rather than as a nested array on the parent, so the inventory stays one flat
  list and everything that already walks `character.inventory` (weight, attacks, effects, giving,
  persistence) keeps working without knowing containers exist.
  A contained item's `category` is kept equal to its container's, and **that one rule is what makes
  the rest of the app correct for free**: a longsword inside a pack sitting in Carrying provides no
  attacks, because Carrying provides none, without a word about containers appearing anywhere near
  the attack code.
  All seven SRD packs carry a real `contents` list, so adding one creates the pack *and* the crowbar
  and the ten torches. A pack reports the weight of what is in it rather than its own nothing — an
  Explorer's Pack is 59 lb, not 0. Packs never merge (`canMergeStacks` refuses them: two packs hold
  different things, and a stack of 2 would strand one lot of contents), deleting one takes its
  contents with it, and giving one hands over everything inside.
- **The catalogue sells one of a thing, and so does everything else.** Ammunition used to carry its
  bundle in the name — "Arrows (20)" — which made the row unusable for anything but buying exactly
  twenty. Names are singular, `qty` is 1, weight is per unit, and the bundle survives only in the
  price string ("1 gp per 20"). The plural is gone from the kits, the demo character and every
  weapon's `ammunition` too: a stack of sixty is "Arrow ×60". That is not cosmetic — `itemSource()`
  matches by name, so a stack called "Arrows" matched no catalogue row and reported itself homebrew.
- **Every item on the demo character is catalogue content.** It used to hold near-misses and two
  wholly invented items, which was invisible until source tags existed and then made most of the
  demo sheet claim to be homebrew. Three catalogue rows were the ones actually wrong and were fixed:
  Chain Shirt had no description; Cloak of Protection described a +1 to AC in prose while carrying
  no `acBonus` at all, an item that read correctly and did nothing; and neither Serpent's Fang nor
  Ring of Precision existed anywhere but on the demo sheet. Both are now `official: false` catalogue
  rows — which is what they always were — so they carry a 3PP tag rather than a CC one, and anyone
  can add one. "Spare Chainmail" was just Chain Mail kept in Camp Storage, and says so now.
- **`sheetSourceNames()` feeds both "Spends Ammunition From" and "Refills From"**: everything in your
  bags plus everything on the Resources list, minus the item doing the asking. The ammunition picker
  used to offer `character.resources` alone — the *standalone* list — so a bow could be pointed at
  Action Surge but not at your arrows, and the refill picker offered every resource row including the
  container itself, so a quiver would happily refill from itself. A typed name that matches nothing is
  left alone and marks nothing: point a bow at a stack you have not bought yet and it starts working
  when you do.
- **Add Item searches the catalogue** (`allInventoryItems()` in content-merge.js — five SRD tables
  plus your own, yours first). Picking a row fills the whole form. If you then change anything, the
  item is saved with "(Custom)" appended *and kept in your custom content for good*, so the next
  character can pick your version out of the same search.
  What counts as a change is measured against **what the form produced the moment you picked**, not
  against the catalogue row: a row carries a price, an official flag and a table that the form
  cannot express, so comparing directly would flag every pick as modified. Quantity and category are
  excluded — buying three is not inventing a new thing, and where it sits on your sheet is where you
  keep it rather than what it is. `stackSignature()` already ignores both, so it does the comparing.
  A variant **keeps the name it came from** and carries a `CC` tag instead of a "(Custom)" suffix,
  which made every variation read like a different weapon.
- **`itemSource()` works out where an item came from rather than remembering.** A row matching a
  catalogue entry of the same name *is* that entry; one that doesn't is yours. Nothing is stamped on
  an item when it is created, which is exactly what lets the tag beside the Name field appear the
  moment you change a preset and vanish again when you undo it (`wireLiveSourceTag`).
  `contentShape()` decides what "the same" means: it strips the catalogue's bookkeeping (`official`,
  `type`, `cost`, `contents`), the decisions you make about *your copy* rather than about the thing
  (tracking, container-ness, off-hand, a kit's starting loadout, **which stack a weapon spends
  from**) and empty values, because a blank box and a field that was never there say the same thing —
  without that last one, every item read as modified the instant its editor opened.
  `ammunition` is in that list because it names a row on *your* sheet rather than a property of the
  bow: the catalogue's value is a default, and pointing yours at a quiver instead of the loose stack
  is an arrangement, like which pocket you keep it in.
- **`settings.showSourceTags` turns on SRD and 3PP tags.** CC always shows: knowing a thing is not
  official content matters whether or not you asked. Tagging every row "SRD" on a sheet where nearly
  everything is would be noise, so that one is opt-in.
- **The Name field is the search field.** One box: typing a name searches the catalogue, picking a
  result fills the form and leaves the name where you were already looking. Two boxes asked the
  player to understand the difference before they had done anything.
- **Ids are `"<device>-<n>"` strings.** `identity.js` mints a six-character device id on first use
  and keeps it in `campfire.device`; `makeId(list)` still counts within the one array and prefixes
  it, so ids stay short and readable while being unique across installs. Saves written before this
  hold bare numbers, so **both shapes coexist** — `idSuffix()` reads either. Any lookup that starts
  from the DOM must use `sameId()`; `parseInt()` on an id is now a bug, because it returns `NaN` for
  the new shape and `NaN` matches nothing.
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
  and 5thsrd.org. Third-party entries carry `official: false` and render a 3PP tag. `KIT_ITEMS`
  entries mostly carry an `srd:` link naming a row in the equipment catalogue and inherit its facts;
  only seven background trinkets with no catalogue row keep their own fields.
- **The party is real, and two of the three old fakes are gone.** The work splits three ways:
  `party-protocol.js` is every rule as pure functions (roster merge, visibility, validating what
  arrives) and is covered by the `party` suite; `party-net.js` is the socket and nothing else;
  `party.js` is only screens. Phones meet in a room on a relay (`relay/`, deployed separately) that
  reads nothing it forwards, so every decision stays testable in the app.
  **Discovery is gone for good, and not for want of trying:** a web page cannot see what else is on
  the wifi, and a phone's browser cannot accept an incoming connection, so "parties near you" is
  something this app is structurally unable to offer. A typed four-character room code replaces it.
  The host passcode went too — the relay cannot enforce a second secret it deliberately never reads,
  so the room code is the only one, and one secret that works beats two where one is a prop.
  The relay is hosted rather than run on a laptop because a page served over HTTPS is not permitted
  to open a `ws://` connection to a local address; that throws at construction, before any network
  attempt.
- **Nothing in the party is faked any more.** Note sharing and item giving both cross the wire.
- **Notes are the easy case.** A note is a title and a body and refers to nothing on the reader's
  sheet, so it arrives correct. Where it *sits* is the reader's business, so `sectionId` never
  travels; an arrival lands in whichever section is flagged `receiveFrom` (one is created if none
  is), and a note the reader has since refiled stays refiled through later edits. Continuous sharing
  re-sends on edit through `partyResendNoteSoon`, which is debounced — the editor commits on every
  keystroke, and without it typing a sentence would be a message per letter. `removeSharedNote`
  refuses to touch a note the holder owns, so an unshare naming a guessed id cannot delete someone's
  own writing.
- **Sharing is a standing arrangement, not a single send**, and this is the part that was wrong
  first time. It is stored **by device**, because a name is not an address — two players can bring
  characters called the same thing. `partyResendNotesTo()` fires the moment a device appears on the
  roster, so a note shared with someone who was offline, or who joins later, reaches them. The share
  screen lists standing shares for people who aren't present under "Not at the table right now",
  because an arrangement you can't see is one you can't take back.
- **Auto-share belongs to the section, not to the instant the note was written.** A note made in an
  auto-share section while you were alone was shared with nobody, and used to stay that way for
  life — the likeliest reason a note "wasn't arriving". `enrolInAutoShares()` adds each arriving
  device to those notes. The one thing that overrules it is `note.autoShareOptOut`, set when a
  player stops a note's sharing by hand: a decision made deliberately outranks a rule set once.
- **`normaliseNoteSharing()` runs on load** and clears sharing that was never real: entries carrying
  a name and no device, and incoming shares on notes whose id is a bare number — a note genuinely
  received keeps the sender's device-prefixed id, so a plain number can only be demo dressing from
  before any of this worked.
- **Items are the hard case, and the rules are the interesting part.** An item's `category` keys
  into the *holder's* `categoryRules`, so one in a category they have never created matches no rule
  and renders nowhere at all. `landingCategory()` therefore files every arrival under a category
  that neither equips nor arms — which also stops a handed-over cloak changing someone's AC before
  they chose to put it on. `ammunition` and `resource.refillFrom` are name lookups into the holder's
  sheet, so they are cut when the receiver has no match, and the receiver is told which link went.
  `isDefaultLoadout` and `category` are the sender's arrangement and never travel.
- **A roster entry is a snapshot, so `mergeRosterEntry()` replaces rather than layers.** Merging
  field by field looks harmless and is not: closing your sheet stops you reporting a class, a level
  and a hit point total, and a merge leaves all three frozen on everyone else's screen — a player
  who has put their sheet away still showing as a level 6 Fighter on 22 hit points. Only `you` and
  `pic` survive, because neither travels.
- **Avatars are their own message (`face`), not part of the roster entry.** Entries go out on every
  change to your sheet, so a picture riding along would be twenty kilobytes per point of damage
  taken. A face changes about once, so it is sent about once — on connect, on a change, and by
  everyone when somebody new arrives. `readAvatar()` is strict because the string lands in an
  `<img src>` on someone else's phone: it must be a `data:image/...;base64` URL under
  `MAX_AVATAR_BYTES`, which also rules out a remote URL that would have every phone at the table
  quietly fetch something from a stranger. A malformed picture drops the whole message rather than
  clearing the face that is already there.
- **`partyIdentityChanged()` is what "who I appear to be just changed" calls.** Renaming a character
  and changing your username both happen in modals that never re-render the sheet, so
  `announceMyPartyState()` — which rides on `renderContent` — never fired for either, and a new name
  sat on your own phone and nowhere else until you happened to take damage.
- **Editing works both ways.** A reader given `edit` sends their change to the note's *owner*
  (`note-edit`, addressed with `sharing.sharedByDevice`, which is why a received note records it),
  and the owner checks `canEditSharedNote()` before applying and passing it on to everyone else —
  skipping whoever sent it, so nobody's typing gets echoed back at them. One hub, so two editors
  cannot quietly diverge into two versions nobody reconciles. An edit naming a note that was never
  shared with that device, or shared read-only, is dropped without an answer.
- **`applySharedNote()` updates in place rather than replacing.** The note editor holds a reference
  to the object it opened, so swapping in a new one leaves whoever is reading it typing into an
  orphan. `refreshOpenNoteEditor()` then repaints the open fields, skipping whichever one has the
  cursor.
- **Coin can be handed over too**, through the same offer machinery — an `item-offer` carries either
  an `item` or a `coin` purse, and must carry one of them. Coin moves denomination by denomination
  and is never converted: 340 silver arrives as 340 silver, because turning it into 34 gold is the
  app overruling the player about what is in their own purse.
- **Giving asks first.** An item arriving uninvited is a change to someone's character that they did
  not make, so a give is an *offer*: `item-offer` out, an accept/decline prompt on the far side, and
  `item-reply` back. The giver watches a status window they may close — it reopens by itself when
  the answer lands, because a phone held up mid-demo should not be stuck on a spinner.
  The item leaves the giver's bag as soon as the offer is away, so the same sword cannot be promised
  to two people while one of them thinks about it, and `returnGivenItem()` puts it back on a decline
  or after `GIVE_ANSWER_TIMEOUT`. A phone with no character open declines immediately with a reason
  rather than leaving the giver waiting a minute for nothing. One offer is entertained at a time:
  two accept prompts stacked on a phone is a way to tap the wrong one.
- Persistence carries `SCHEMA_VERSION` and **sets aside** an older save under `campfire.characters.vN`
  rather than loading it. It used to merely refuse it — and then the first render's
  `persistCharacters()` wrote the demo character straight over it, so a schema bump silently deleted
  every character. Tutorial progress, dice history, theme, settings and custom content each keep
  their own key.

## Known gaps

- `grantFeatures` dedupes by feature name, so multiclassing into a second caster grants only one
  "Spellcasting" feature.
- `traits > Proficiencies > Weapons` is flavour text duplicating the authoritative
  `weaponProficiencies` list — the last known two-sources-of-truth.
- Emoji stand in for an icon set throughout.
- A container's contents are one level deep. `putInContainer()` refuses a pack inside a pack, and
  `readItem()` flattens one that arrives claiming otherwise, so nothing here has to guard against a
  structure that nests forever.
- **No user identity.** There is a device id now, but it identifies an *installation*, not a
  person: reinstall and you are someone new, and `settings.username` is "Adventurer" on every fresh
  install.
- A given item never stacks *automatically* with one the receiver already has, which keeps repeated
  deliveries idempotent. **Merging is a drag instead**: hold a stack and every pile it could join is
  outlined, the one under the finger fills in, and dropping there combines them. What counts as "the
  same thing" is `stackSignature()` — the whole item apart from id, quantity and category — because
  name alone would fold a +1 longsword into a plain one and destroy the magic weapon. The outer
  quarters of a row still reorder, so dropping a stack *between* two others is unaffected.
- A give is answered, not guaranteed. If the reply is lost in flight the giver gets the item back
  while the receiver keeps it too, which duplicates rather than destroys — the safer of the two
  directions, and the reason it was built that way round.
- A player who closes their sheet shows on the roster as `settings.username`, with no class, level,
  hit points or picture. That is deliberate and was confirmed as wanted: the selector is the app's
  "no character chosen" state, and reporting a character you are no longer looking at would be a
  lie. The cost is that `settings.username` defaults to "Adventurer", so a player who never set one
  reads as a stranger the moment they put their sheet down.
- `effectAmount()` resolves scaling tiers against the *holder's* level. That is right for an effect
  you own and wrong for one handed to you, so a pushed effect is flattened to a plain number at the
  sender's level before it leaves (`wireEffectGroup`) — the wire format carries numbers, never
  tables. A received group carries `fromName` but still no `sourceCharacterId`, so nothing can go
  back and ask the caster's sheet a question about it later.
- Three backgrounds (Soldier, Sage, Criminal) are PHB text, not SRD 5.1 — only Acolyte is in the
  SRD. They carry `official: false` and render a "3PP" tag, which says *third-party homebrew* when
  the truth is *unlicensed WotC*. The comment at the table says so.
- No attribution ships anywhere in the app: every mention of CC-BY, the SRD and 5esrd.com is in a
  source comment. No LICENSE file, no credits screen. CC-BY requires attribution in the distributed
  work.

- **One list pattern for "type a name, pick what matches"** — `searchListHtml` / `wireSearchList` in
  ui.js, used by Add Item, the effect editor's Name field and a Condition modifier. It sits under the
  field and pushes the form down rather than floating over it, because a dropdown is fine under a
  mouse and a poor target for a thumb. Three different ways of picking a thing off a list is three
  things to learn.

## Casting

`spell-cast.js` — split from tab-spells.js because casting turned out to be a conversation rather
than a button. A cantrip still resolves on the tap; anything with a level opens a window.

- **The upcast preview is the SRD's own words.** There is no structured upcast data anywhere: 53 of
  the 169 spells carry an "At Higher Levels" paragraph and the other 116 genuinely gain nothing. So
  `spellUpcastText()` lifts that paragraph verbatim and prefixes how far above base you are. The 116
  get the yellow banner instead, which is true rather than a guess.
- **`spellTargetLimit()` reads the count out of the spell's own sentence** — "up to three creatures"
  is prose, not a field — and applies the "one additional creature for each slot level above" rule
  when the text says so. It returns **null for anything it does not recognise, and null means no
  warning**: a limit we are unsure of is worse than no limit, because a warning that fires wrongly
  teaches people to ignore warnings.
- **Downcasting warns and allows.** The app has never refused a cast — a table ruling can put a
  character outside the slot economy entirely — and a sheet that argues with the person holding it
  is a sheet they stop using.
- **A spell can carry what it does.** `spell.heal` is a dice notation, `spell.healMod` adds the
  caster's own spellcasting modifier, and `spell.effects` is an effect group's modifier list living
  on the spell — the same rows the condition editor builds, so a spell that grants Bless builds
  exactly the thing Bless is on a sheet. All three are read out of the SRD description to *pre-fill*
  the form (`suggestedSpellHealing()`, `spellHealingAddsModifier()`) and are the player's from
  there, same rule `damage` has always followed. `tidySpellFields()` deletes them when blank, so a
  spell that heals nothing carries no keys about healing.
- **Healing is one roll, spent on everyone it lands on**, because that is what the spell says:
  `castHealNotation()` builds `1d8 + 1d8 + 1` at the level being cast (the upcast die is read from
  "the healing increases by 1d8 for each slot level above"), `showRollToast()` hands the total back
  so the number applied is the number shown, and `applyHp("heal", ...)` puts it on your own sheet
  only when you were a target. A spell with no target list at all — "you regain" — heals the only
  person it could be about; picking nobody from a list you *were* shown rolls it and stops, since
  that is a number you are about to say out loud to someone who isn't on the app.
- **The target list shows hit points, under the party's own rule.** `partyHpLabel()` is the single
  place that decides what you may know about someone's hit points — exact numbers, one word
  (Bloodied / Dying / Dead / Stable), or nothing — and both the roster and the cast window ask it,
  so the cast window can't leak what the roster wouldn't. Your own row is exempt: it is your sheet,
  and it was never a secret from you. A heal is aimed at whoever is worst off, and making someone
  leave the window to find that out is how the wrong person gets healed.
- **Somebody else's hit points are theirs.** Healing travels as a settled number (`partySendHeal`
  → the `heal` message), never as dice, because re-rolling on arrival would give two people two
  answers to one spell — and it arrives as an offer with Take it / No thanks, since a heal that
  lands without asking lands on a character who was already dead, or holding temps, or at a table
  that rules it differently.
- **A concentration spell aimed at other players lands on their sheets**, and the caster's own copy
  records `castOn` so that dropping concentration can clear it again (`partyRevokeEffect` →
  `effect-revoke`). The caster's copy carries the spell's modifiers **only when the caster is a
  target**: holding Bless for three other people should not quietly bless the cleric, so the group
  on your sheet tracks the concentration with an empty modifier list while their copy — same id,
  because the id is what takes it back — carries the real thing.
  The far side is *told*, not asked — the spell is over either way — but gets a window it must
  acknowledge, because a bonus quietly vanishing mid-fight is how people end up rolling with numbers
  that stopped being true.
- **`openAddEffectModal(existing)` doubles as the editor.** An effect could be created and removed
  but never corrected, so a typo meant rebuilding it — and rebuilding lost the id, which is what the
  party uses to take a pushed effect back. Editing does `Object.assign(existing, shape)` and keeps
  it, and the concentration clash check excludes the effect being edited from its own question.
  Prefilling a row goes through `setSelectValue()`: the app's select keeps its value in a hidden
  input and its label in a span, so writing the input alone left "+1d4 Attack Rolls" reading "AC" the
  moment you opened it — a wrong answer that saved itself the moment you touched anything else.
- `settings.autoSpendSlots` (on) spends the slot and names it in a toast; `settings.visualSpellSlots`
  (on) draws slots as tappable pips instead of a fraction, in both tabs and in Combat's Spells
  section.

## Icons

`icons.js` — 120 line icons on a 24x24 grid, the table that guesses which one a
thing wants, and the picker.

- **An icon is markup, not a file.** Each one is a string of SVG paths with no colour and no size
  of its own; `iconSvg()` wraps it in an `<svg>` that strokes with `currentColor`. That is the whole
  theming story: an icon takes the colour of the row it sits in, so a dimmed row dims its icon and
  all three themes work off one set of drawings. The suite fails any icon that carries its own
  `fill` or `stroke`, because one filled shape would sit on the Light theme as a dark blob that no
  CSS could reach.
- **They were drawn at the size they are used.** 18-24px next to a name, 32 in the picker. Anything
  that needed more detail than that to read was cut rather than shipped as a smudge, which is why
  there is no crossbow, halberd or gauntlet in the set: each was drawn three or four times, never
  read as itself at 24px, and the name maps onto a near neighbour instead (a crossbow gets the bow).
  **The only way to know whether an icon works is to render it and look at it** — every one of these
  was reviewed on a contact sheet, several times, and about a third of the first drafts were thrown
  away.
- **Nothing is iconless, and almost nothing has to be chosen.** `guessIcon()` reads the name against
  `ICON_KEYWORDS` and the first match wins, so a fresh sheet is fully decorated on its first run
  instead of after a trip through forty rows. A stored `icon` overrides it (`iconFor()`), and a
  stored name that no longer exists falls back to the guess rather than rendering a gap — an icon can
  be retired without emptying every sheet that picked it.
- **Order in that table is load-bearing.** Weapons are read first, so a Flame Tongue is a sword;
  then damage types, so a Fire Bolt is a fire and not a bolt; then healing above poison, so a Potion
  of Healing does not get the venom flask. The three collisions that actually bit are pinned in
  `icons.test.js` by name.
- **The picker searches that same keyword table**, not just icon names, so "fire" finds the flame
  and "armor" finds the cloak. Matching names alone made the search a spelling test for a vocabulary
  only this file knows.
- **It opens on its own layer** (`#icon-overlay`), the way `confirmModal` does, because it is nearly
  always opened from a half-filled form and `openModal` would replace that form and throw the typing
  away.
- **A picked icon does not make an item homebrew.** `contentShape()` drops `icon` along with the
  other decisions you make about your copy rather than about the thing: choosing a flame for your
  torch is not a claim about what a torch is.

## Gestures on a phone

Long-pressing a row to drag it also asks iOS to select the text under the finger and pop the callout
menu, which cancels the pointer stream halfway through — so a hold-drag or a sideways swipe works,
then doesn't, with nothing visible to tell the two apart. Selection and the tap highlight are turned
off on the things you drag and tap (`.item-row`, `.note-row`, chips, tabs, coin cells) and left alone
on inputs and textareas. `#content` carries `touch-action: pan-y`, which hands vertical panning to
the browser and keeps horizontal for the swipe handler rather than racing it.

**None of this can be verified here.** Chromium under Playwright does not reproduce iOS's selection
and callout behaviour, so a green browser run says nothing about whether a gesture feels right under
a thumb. Test gestures on the phone.

## Writing copy

Say the thing in as few words as it takes. A confirmation is "Are you sure you want to
continue?", not a paragraph explaining what continuing means. The player is holding a phone at a
table, not reading documentation.

Two rules that came out of getting this wrong:

- **A warning that is always on screen is not a warning.** If something needs the player's
  attention at a decision point, ask at the decision point -- a confirm on Next, not a banner that
  is already there when the step loads. A banner the player has been staring at since the page
  loaded is furniture.
- **Don't narrate state back at the player.** A description that reads "Optional rule: your
  origin's increases go wherever you want them. Dragonborn's own increase is replaced -- +2
  Strength, +1 Charisma" is telling them three things they can already see, in a sentence they have
  to parse. Name the rule, stop.

- **Assume the player knows D&D.** This is a character sheet, not a tutorial. Someone equipping a
  weapon knows what "Martial" is; someone casting knows what a spell slot does. Name the thing and
  stop -- "Martial", not "needs Martial proficiency". The exceptions are what *this app* has
  decided (which category counts weight, what a custom origin does to your race's increase) and
  content the player wrote themselves, because neither is knowable from the rules.

Applies to warnings, hints, empty states, confirmations and field notes alike. Long explanatory
prose belongs in Help & Rules, where someone has chosen to go and read.

## Verification

**The suite cannot catch a UI bug.** The harness has no layout engine and fires no listener, so a
control that renders perfectly and does nothing passes. Every interaction bug found in this repo was
found by driving a real browser, not by the tests.

So: after any change to markup, wiring or CSS, drive it in Chromium. `/home/claude/drive.js` in the
authoring environment is one way; any Playwright script that loads `index.html` and clicks the thing
you changed is equivalent. Assert the DOM, not the source.

And Chromium alone is not enough. The weapon property picker shipped a `<button>` inside a
`<button>` — invalid HTML that Chromium tolerates and every spec-compliant parser reshapes. It
rendered correctly in Chromium, passed 1,522 tests, and was visibly broken in Firefox with the tap
target in the wrong place. The `structure` suite now fails on nested `<button>`/`<a>`/`<form>`, but
the lesson generalises: **a green suite and a good screenshot are weaker evidence than they feel.**

## Working in this repo

- Use targeted edits. Bulk edits driven by line arithmetic have destroyed large regions of these
  files twice; check `git diff --stat` against what you expected to change.
- Run the full suite after any change. It is fast.
- Comments here explain *why*, not *what*. Match that.
