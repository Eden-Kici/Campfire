# Campfire: Player — handoff

**For:** a fresh session with no memory of how this got here.
**State:** 1,819 tests passing. Installable as a PWA. The party feature is not built.
**Deadline:** an exam demo in a couple of days, two iPhones, party working between them.

Read `CLAUDE.md` first — it is the architecture and the conventions, and it is accurate as of this
handoff. This file is the part that isn't in it: where things stand, what was decided and why, what
to do next, and the traps.

---

## 1. What this is

A D&D 5e character sheet, built as a proof of concept for a mobile app. Vanilla JS, no build step,
no dependencies, ~17,000 lines across 30 files. Its stated purpose is *to discover what a real build
needs*, so **the data model matters more than the polish** — prefer a change that reveals a
modelling requirement over one that makes the demo look nicer.

The owner (Eden) is not writing the code and does not want to. Work is expected to be done for them,
verified, and handed over working. They are sharp about UX and will notice detail — several of the
best decisions in this codebase came from them rejecting a first attempt.

**A second app, Campfire: Game Master, is planned as a desktop counterpart.** The two are meant to
sync. That is why the effect-group model is shaped the way it is, and it is the reason to keep the
`sources` contract intact.

---

## 2. The five things that will bite a fresh session

**1. The test suite cannot catch a UI bug.** 1,819 tests and not one of them fires a listener — the
harness has no layout engine and no events. A control that renders perfectly and does nothing passes
every test. **Every interaction bug in this repo was found by driving a real browser.** If you change
markup, wiring or CSS and only run the suite, you have verified nothing about whether it works.

**2. Chromium alone is not enough either.** The weapon property picker shipped a `<button>` nested
inside a `<button>` — invalid HTML that Chromium tolerates and every spec-compliant parser reshapes.
It looked right in Chromium, passed the whole suite, and was visibly broken on the owner's Firefox,
with the label outside the tap target and the checkbox wired to nothing. I diagnosed it as a stale
cache and was wrong. **When the owner says something is broken and your evidence says otherwise,
your evidence is probably from one engine.** The `structure` suite now fails on nested
`button`/`a`/`form`, but the general lesson stands.

**3. `renderContent()` persists.** Every mutation path gets saving for free, which is elegant — and
it means a render is a synchronous `JSON.stringify` of every character on every tap. It is also why
a failed load used to destroy data: the first render wrote over it.

**4. There is no event delegation.** A rendered control with no matching line in the `wireXTab()`
function looks perfect and does nothing. No test catches this. It is the single most common way to
half-finish a feature here.

**5. `index.html`'s script list is the dependency graph.** No modules; every top-level declaration is
a global. Adding a file means adding it there — and then running `node tools/build-sw.js`, or the
app breaks offline only. The `structure` suite enforces both, plus a 1,500-line cap per file that
`creator.js` (1,482) is close to.

---

## 3. Where things stand

**Done and verified in a browser:**

- The whole single-player app: calculations, effects, rests, levelling, death saves, concentration,
  exhaustion, inventory/resources, spells, notes, themes, character creator, onboarding tutorial,
  dice history, custom content, Help & Rules.
- **Money** — `purse`/`stash`, five denominations, optional coin weight, carrying capacity.
- **Starting equipment for all twelve classes** (only four had any; the other eight created
  characters with an empty inventory).
- **PWA**: manifest, service worker, icons. Verified offline — network disabled, reloaded, booted
  with all 319 spells and no errors.
- **Phone layout**: viewport meta, `.phone` full-bleed under 700px, `100dvh`, safe-area insets,
  16px inputs (below that iOS zooms on focus), `touch-action: pan-y` so lists scroll under a finger.
- **Rolls wait for you** by default — you see the notation and the modifiers, then tap Roll. Fast
  Rolls in Options restores roll-on-tap. Anything with a cost is spent by the throw, via
  `config.onRoll`, so backing out of a roll costs no ammunition.

**Not done, in the order it matters:**

1. **The party feature.** See §4 — this is the job.
2. Most of `REVIEW-APP-WIDE.md`. 55 numbered findings; roughly a third are done. The numbering is
   stable and the owner approves by number.
3. The six planned features in that document's section C (F1–F6), none started.

---

## 4. The next job: the party, for the exam

**It does not exist.** `party.js` renders three hardcoded parties (`FAKE_PARTIES`) and joins one
with a 1,200ms `setTimeout`. There is no `fetch`, no WebSocket, nothing, anywhere.

**What is already good and should be kept:** the visibility model. `partyMemberDetailLine()` renders
a member entirely from `party.settings`, so identical member data renders differently at two
different tables. `canSeeCustomBuilds()` gates on host vs guest. `myPartyIdentity()` builds a
**snapshot** rather than a live reference, with a comment saying that is because a real build sends
it over the wire. That instinct was right; it needs a transport under it.

**The decided architecture:** one small relay (~40 lines), both phones connect out to it over
WebSocket, relay echoes to the room. It runs on **Eden's laptop**, with the phones on **one phone's
hotspot** — chosen because exam wifi routinely blocks device-to-device traffic and a hotspot never
touches the venue's network. Make the relay address a setting rather than baking it in.

**Ruled out, with reasons — do not revisit:** Web Bluetooth (iOS Safari has never supported it),
direct phone-to-phone over wifi (a browser cannot accept an inbound connection), the App Store
(review takes longer than the deadline).

**The thin slice, in build order:**

1. **A stable identity per install** — `crypto.randomUUID()` device id, and prefix new ids with it.
   Today every id in the app is `Math.max(...) + 1` scoped to one array on one device, so two phones
   both produce id 4. **Do this first; everything else sits on it.**
2. **Host / join by code**, replacing the fake list. The screens already exist.
3. **A live roster** — name, class, level, HP, custom flag, through the existing visibility
   settings. Note that `refreshMyPartyIdentity()` currently runs only from `showScreen()`, so your
   own HP is stale the moment you take damage without changing screens.
4. **Push one effect group to another sheet.** Bless is the demo: it is already an effect group, and
   the receiving phone needs *no new rendering code at all* — it renders identically whether the
   group was added locally or arrived from elsewhere. That is the most impressive thing this
   codebase can show, and it is the payoff of the `sources` contract.

**Explicitly out of the slice** (say so in the write-up — a stated boundary reads better than a
broken feature): item giving across devices, note sharing, custom content sync, reconnection,
security.

**Before it touches a network:** `effectAmount()` resolves scaling tiers against the *holder's*
level, so a tiered effect from a level-9 caster recomputes at the recipient's level. Flat amounts
are fine. And effect groups carry no provenance, so a caster dropping concentration cannot remove
the group from the allies who received it — which is the invariant the model exists to protect.

**One trap:** wire `character.partyMembers` to the real roster as part of this. Note Share and item
Give read that array, *not* the party screen, and `creator.js` gives every created character `[]`.
Build a character live on stage and both features are visibly dead.

---

## 5. Conventions that were decided here, not inherited

These came out of the owner rejecting something. They are in `CLAUDE.md` too; the reasoning is here.

**Copy.** Say it in as few words as it takes. Three rules:
- *A warning always on screen is furniture* — ask at the decision point. The unspent-points warning
  was a banner on the step; it is now a confirm on Next.
- *Don't narrate state back at the player.* "Optional rule: your origin's increases go wherever you
  want them. Dragonborn's own increase is replaced — +2 Strength, +1 Charisma" became "Place them
  yourself instead of taking Dragonborn's."
- *Assume the player knows D&D.* "Martial", not "needs Martial proficiency". The exceptions are what
  *this app* decided (which category counts weight) and content the player wrote themselves.

**Don't warn about a control that can't work — disable it.** An uncapped stack has no maximum, so
"All" and "Half" are greyed rather than pickable-then-explained.

**Reuse the component that exists.** The creator grew its own item info boxes with hand-written
descriptions while `srdItemDetailHtml` already existed. Both now render through `itemFactsHtml()`.
The owner will notice duplication like this and it is right to be pulled up on it.

**One list-picker shape.** Approved but not done — the app still has several UIs for "pick from a
fixed list" (review items 7, 8, 9). Worth doing when touching that area.

---

## 6. Documents in the repo

| file | what it is |
|---|---|
| `CLAUDE.md` | architecture, data model, conventions, verification. Accurate. Read first. |
| `REVIEW-APP-WIDE.md` | 55 numbered findings + readiness assessment for six planned features. Approve by number. |
| `PORT-PLAN.md` | what stands between here and two phones; the party architecture and its reasoning. |
| `DEPLOY.md` | GitHub Pages + Add to Home Screen, step by step, with the traps. |
| `REVIEW.md`, `REVIEW-CHROME.md` | earlier reviews, superseded. |

---

## 7. Immediate to-do

1. **Push and deploy.** Repo: `https://github.com/Eden-Kici/Campfire` (empty, so the first push is
   clean). Work lives in `H:\Files\Code\Campfire-Player-Demo`, which holds the history.
   `push-campfire.bat` on the Desktop does the commit and push; `DEPLOY.md` has the rest, including
   the Pages toggle and the Add-to-Home-Screen steps. Address will be
   `https://eden-kici.github.io/Campfire/`.
2. Install on both iPhones via **Safari** (not Chrome — other browsers add a bookmark instead), and
   confirm it runs in Aeroplane Mode. That is the test that proves it is installed rather than saved.
3. Build the party (§4).

**A bridge quirk worth knowing:** this repo is reached over a mount that forbids deleting files, and
git cannot work under that — it creates `.git/index.lock` and `HEAD.lock` and then cannot remove
them, so every commit fails halfway. Run git from a normal Windows terminal instead. If a
`.lock` file is ever stuck, moving it aside is enough; there are some in
`_to_delete/stale-git-locks/`, and ~192 `tmp_obj_*` files in `.git/objects` that `git gc` will
clear. None of it affects the working tree.

Two things to raise with Eden rather than decide: the Pages repo must be **public** on a free plan,
which publishes the source and the SRD content; and **no attribution ships in the app** — no LICENSE
file, no credits screen, while CC-BY requires attribution in the distributed work. Ten minutes to
fix, and an examiner asking "where did the content come from" is a question worth a good answer.
