# Campfire: Player

A Dungeons & Dragons 5e character sheet, built as a phone-first web app.

**Live:** https://eden-kici.github.io/Campfire/ — open it on a phone and add it to
your home screen; it installs and runs offline.

Campfire is the sheet a player actually holds at the table. It does the arithmetic
you would otherwise do in your head every turn — proficiency, ability modifiers, a
condition that adds a d4 to every attack until it ends — and it does it while your
hands are busy holding dice. Everything is one thumb away, and nothing needs a
connection.

## Running it

```
git clone https://github.com/Eden-Kici/Campfire.git
cd Campfire
open index.html          # that's it
```

There is **no build step and no dependencies**. `index.html` loads plain JavaScript
files in order; that list is the whole dependency graph. Opening the file directly
works — the service worker will not register over `file://`, which is expected.

```
node tests/run.js        # 2,283 tests, well under a second
node tests/run.js icons  # one suite
```

The tests load the app the same way the browser does and assert against the markup
the render functions return, so they exercise exactly what ships. See
`tests/README.md`.

## What it does

- **The full sheet** — abilities, skills, saves, hit points, death saves, hit dice,
  attacks, spells, inventory and notes, across five tabs.
- **A character creator** covering the SRD: races, classes, subclasses, backgrounds,
  levelling to 20, and every choice each of those asks you to make.
- **Conditions that actually apply.** A condition is a named group of modifiers, and
  they reach the numbers they should — including dice, so Bless reads `+8~11` and
  rolls `1d20+7+1d4`. Concentration holds one at a time and says so.
- **Spells** with a casting window: pick the slot level, see what upcasting changes
  in the spell's own words, choose who it lands on, and watch the slot go.
- **Inventory** with real containers, stack merging, weight, attunement and
  ammunition that tracks itself.
- **A party over the network.** Host or join with a room code and the table shares
  notes, hands over items and coin, pushes conditions onto each other's sheets, and
  takes them back when concentration breaks. Everything that changes another
  player's sheet asks them first.
- **Your own content.** Anything the SRD does not have you can add — items, spells,
  races, classes, backgrounds, features — and it behaves like everything else.
- **Four themes**, 121 hand-drawn icons, and it all works offline.

## The shape of it

| | |
|---|---|
| `index.html` | the page, and the load order for everything else |
| `character-data.js` | every calculation; no rendering, no DOM |
| `tab-*.js` | one file per tab, each returning markup as a string |
| `srd-*.js` | the reference content |
| `icons.js` | the icon set, the picker, and the name-to-icon guesser |
| `party-protocol.js` | the party rules as pure functions |
| `party-net.js` | the socket, and nothing else |
| `relay/` | a ~40-line message relay (the only part with a dependency) |
| `tests/` | the suite |
| `campfire-icons.zip` | the icon set as an asset pack |

**`CLAUDE.md` is the architecture document.** It explains the conventions, and more
usefully it records *why* things are the way they are — including the decisions that
were wrong the first time.

Deploying is in `DEPLOY.md`. The party relay is a separate small service; see
`relay/README.md`.

## Content

Game content is from the D&D 5e **System Reference Document 5.1**, published by
Wizards of the Coast under the Creative Commons Attribution 4.0 licence. Anything
you add yourself stays on your own device.

The icons were drawn from scratch for this project — no icon library was copied or
imported.
