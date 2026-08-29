# Campfire: Player — getting it onto two phones in two days

**Written:** after a ship-readiness audit of the working tree. 1,814 tests passing.
**Constraint:** a couple of days, an exam demo, two phones, and someone other than Eden writing the code.

---

## The headline

Three things, in order of how much they change the plan.

**1. The party feature does not exist.** It is not partly built. `party.js` renders three hardcoded
parties (`FAKE_PARTIES`) and joins one with a 1,200ms `setTimeout`. There is no networking anywhere
in the app — no `fetch`, no WebSocket, no peer connection, nothing. Making two phones see each other
is not a porting task; it is the one genuinely new thing that has to be built.

The good news is that the *hard* part of a party feature is already done and is the best-designed
thing in the file: the visibility model. `partyMemberDetailLine()` renders a member entirely from
`party.settings`, so the same member data renders differently at two different tables, and
`myPartyIdentity()` already carries a roster *snapshot* rather than a live reference — with a comment
saying that is because a real build sends it over the wire. That instinct was right. What's missing
is a transport under it.

**2. For a two-day deadline, the answer is a PWA, not an App Store app.** Not a compromise — the
right call. "Add to Home Screen" in Safari gives you a real home-screen icon, full screen, no browser
chrome, and no App Store at all: no Apple Developer account, no Mac, no Xcode, no review queue. App
Store review alone takes longer than you have. And this app is unusually close to being a PWA
already — no build step, no dependencies, one HTML file and a script list.

**3. Bluetooth is out, and so is direct phone-to-phone over wifi.** iOS Safari has never supported
Web Bluetooth (the WebKit request has been open since 2012), and a browser cannot accept an inbound
connection from another device, so "two phones on the same wifi talking directly" isn't a thing a web
app can do. Both phones have to talk *through* something. That something can be tiny and can live on
a laptop in the room — see the party plan below.

---

## Must fix before any demo

These are bugs in what already exists. Two of them would show up in front of an examiner.

**A. A schema bump silently deletes saved characters.** Verified in a browser: plant a v7 save,
reload, and `campfire.characters` has been overwritten with the demo character — while the toast says
the saves "weren't loaded", implying they are still there. `loadCharacters()` refuses the blob, then
`showScreen("selector")` → `renderSelectorScreen()` → `persistCharacters()` overwrites it, before the
toast is even shown. CLAUDE.md documents the opposite ("set aside rather than loaded"). *Fix: don't
write on the render after a refused load; rename the key to `campfire.characters.v7` instead of
overwriting.* **Small, and it is real data loss.**

**B. Share and Give are empty on every character you create.** They don't run off the party screen at
all — they read `character.partyMembers`, a separate hardcoded array of four name strings that only
the shipped demo character has. `creator.js` gives new characters `partyMembers: []`. So: build a
character in the creator, open a note, tap Share, and the list is blank. Same for giving an item.
*If you demo with a character you made on stage, both features are visibly dead.* This is also the
seam where the real party has to plug in.

**C. Scrolling is broken in Inventory and Notes on touch.** `touch-action: none` is set inline on 14
rows to make hold-to-drag reordering work. On a phone that means a finger drag starting on a row —
most of the screen — does not scroll the list. It is set even when drag-reordering isn't wired.
*Fix: `touch-action: pan-y`, which keeps vertical scrolling and still allows the hold-drag.*

**D. No viewport meta, and `.phone` is a fixed 390×812 box.** Already a known gap. On a real phone it
renders as a zoomed-out desktop page. *Fix: add the viewport meta, and make `.phone` full-bleed on
small screens while keeping the framed look on a desktop.* Also bump form inputs from 14px to 16px:
below 16px, iOS zooms the page on focus and jerks the layout mid-demo.

**E. A profile photo can silently stop the app saving.** One camera photo stored as a data URL in
`character.profilePic` serialises to ~4MB against a ~5MB localStorage quota, and `persistCharacters()`
swallows the failure into a `console.warn`. The player keeps playing against state that is no longer
being written, and loses it on next launch. *Fix for the demo: downscale the image to ~256px on
upload. That's a dozen lines and removes the whole class of problem.*

---

## The party, as small as it can honestly be

**Architecture: one tiny relay, both phones connect out to it.** Neither phone listens; both open a
WebSocket to a relay that echoes messages to everyone else in the room. That is the entire server —
roughly 40 lines. It holds no state worth protecting and needs no database.

**Where to run it on the day, in order of exam-room risk:**

1. **One phone's hotspot + laptop relay.** The laptop and the other phone join the hotspot. Nothing
   depends on the venue's network, and nothing is blocked because it never touches their wifi. *This
   is the one I'd plan for.*
2. **Laptop relay on the venue wifi.** Fewer moving parts, but school and campus networks routinely
   block device-to-device traffic. Test it in the actual room beforehand or don't rely on it.
3. **A free hosted relay** (Render, Fly, Railway, Cloudflare). Works from anywhere including mobile
   data, and removes the laptop from the demo — but it's another account and another deploy step, and
   HTTPS/WSS pairing has to line up with wherever the PWA is served from.

**The thin slice worth building** — enough to be genuinely real, small enough to finish:

- **A stable identity per install.** There is none today: every install is `settings.username =
  "Adventurer"`, and every id in the app is `Math.max(...) + 1` scoped to one array on one device, so
  two phones both produce id 4 for the effect they each just made. Give each install a
  `crypto.randomUUID()` device id and prefix new ids with it. *Do this first — everything else is
  built on it.*
- **Host / join by code**, replacing the fake list. The screens already exist.
- **A live roster**: name, class, level, HP, custom-build flag, filtered through the visibility
  settings that are already written. Broadcast your snapshot on change rather than only on screen
  change — today `refreshMyPartyIdentity()` runs only when you move between the selector and the
  sheet, so your own HP on the party screen is stale the moment you take damage.
- **One thing that travels**, to prove the model: push an effect group to another player's sheet.
  Bless is the demo — it is already an effect group, and it already renders identically whether it
  was added locally or not. That is the single most impressive thing this codebase can show, because
  the receiving phone needs no new rendering code at all.

**Explicitly not in the slice:** item giving across devices (items reference the *recipient's*
category names and ammunition by name — a bow arrives pointing at a quiver that isn't there), note
sharing, custom content sync, reconnection, and any security. Say so in the write-up; a known,
stated boundary reads better than a broken feature.

**One thing to fix before it goes near a network:** `m.pic` and `profilePic` are interpolated raw
into `<img src="${...}">` with no `esc()`. Harmless while it's your own photo, an attribute-break the
moment that string arrives from another device.

---

## Suggested order

**Day 1 — make it a phone app.** Viewport + `.phone` full-bleed + 16px inputs (D), `touch-action`
(C), the save-deletion bug (A), photo downscaling (E). Then the PWA shell: `manifest.json`, icons, a
service worker, and serve it over HTTPS. At the end of day 1 it installs on both phones and works
offline, single-player. **That alone is a demonstrable app**, and it is the safe fallback if the
party runs out of time.

**Day 2 — the party.** Device ids, the relay, host/join by code, live roster, push an effect. Wire
`character.partyMembers` to the real roster so Share and Give stop being dead (B).

**Cut line, if day 2 goes badly:** ship the roster without the effect push. Two phones showing each
other's live HP is still a working networked feature.

---

## What is needed from Eden

- **Somewhere to host it over HTTPS.** Required for both "Add to Home Screen" and service workers.
  GitHub Pages is free, takes minutes, and the repo is already a git repo.
- **Both phones** — model and iOS version, since that decides how the install flow looks.
- **A laptop that can be in the room**, if the relay runs locally.

---

## Not blockers, but say them out loud in the write-up

- **Attribution ships nowhere.** Every mention of CC-BY, the SRD, and 5esrd.com is in a source
  comment. There is no LICENSE file and no credits screen. CC-BY requires attribution *in the
  distributed work*. For a local mockup this is moot; for an app installed on phones and shown
  publicly it is worth the ten minutes — and an examiner asking "where did the content come from" is
  a question you want a good answer to.
- **Three backgrounds are PHB text, not SRD** (Soldier, Sage, Criminal — only Acolyte is in SRD 5.1).
  The code comments already say this. They currently render a "3PP" tag, which says *third-party
  homebrew* when the truth is *unlicensed WotC*. Fine for an exam; not fine for a public release.
- **The 1,814 tests never fire a listener.** The harness has no layout engine and no events, so every
  wiring bug in this document was found in a browser, not by the suite. Worth knowing before trusting
  a green run on the day.
