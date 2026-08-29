/* Regressions for the Chromium review pass: the shared modal/combo machinery,
   the spells tab, level-up, and the onboarding tutorial's lifecycle.

   Several of these bugs are listener bugs, and this harness never fires a
   listener -- where that is true the assertion pins the *markup or state* the
   fix depends on, and the behaviour itself was verified in real Chromium. Each
   such case says so. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();

  suite.section("combo fields escape what the player types");

  suite.runs("the no-match message escapes the query", () => {
    // wireCombo's no-match branch went into innerHTML raw, so typing
    // `<img src=x onerror=...>` into any combo inserted a live element.
    // Verified firing in Chromium; here we pin that esc() is in the path.
    const src = require("fs").readFileSync(__dirname + "/../ui.js", "utf8");
    const line = src.split("\n").find(l => l.includes("combo-empty"));
    if (!line) throw new Error("expected a combo-empty branch in ui.js");
    if (!line.includes("esc(input.value")) throw new Error("expected the typed value to go through esc()");
  });

  suite.runs("comboFieldHtml escapes its placeholder", () => {
    const html = app.comboFieldHtml("x", "Label", 'PH"><b>bold</b>', "");
    if (html.includes("<b>bold</b>")) throw new Error("placeholder broke out of the attribute");
    if (!html.includes("&quot;")) throw new Error("expected the quote to be escaped");
  });

  suite.section("a spell can outrun its slots");

  suite.runs("a level with no slot entry still renders, so the spell stays reachable", () => {
    const c = app.character;
    const before = c.spells.length;
    c.spells.push({ id: 4242, name: "Fireball", level: 3, prepared: false,
                    classSource: "Wizard", castingTime: "A", attackRoll: false, desc: "" });
    const html = app.renderSpellsTab();
    c.spells.length = before;
    if (!html.includes('data-spell-view="4242"')) {
      throw new Error("expected a row -- without one the spell can never be edited or deleted");
    }
    if (!html.includes(app.levelLabel(3))) throw new Error("expected a 3rd-level header");
  });

  suite.runs("a level with no slots says so instead of showing a slot counter", () => {
    const c = app.character;
    const before = c.spells.length;
    c.spells.push({ id: 4243, name: "Fireball", level: 3, prepared: false,
                    classSource: "Wizard", castingTime: "A", attackRoll: false, desc: "" });
    const html = app.renderSpellsTab();
    c.spells.length = before;
    if (!html.includes("no slots")) throw new Error("expected the header to explain the missing slots");
  });

  suite.section("casting resolves before it spends");

  suite.runs("a spell naming a class you don't cast spends nothing", () => {
    const c = app.character;
    const spell = c.spells.find(s => s.level > 0);
    const savedClass = spell.classSource, savedAttack = spell.attackRoll;
    const level = spell.level;
    const before = c.spellSlots[level].current;

    spell.classSource = "Sorcerer";     // not one of this character's casters
    spell.attackRoll = true;
    app.castSpell(spell.id);            // used to decrement, then throw on cls.ability

    const after = c.spellSlots[level].current;
    spell.classSource = savedClass; spell.attackRoll = savedAttack;
    c.spellSlots[level].current = before;
    suite.is("slot untouched", after, before);
  });

  suite.runs("a normal cast still spends its slot", () => {
    const c = app.character;
    const spell = c.spells.find(s => s.level > 0);
    const before = c.spellSlots[spell.level].current;
    app.castSpell(spell.id);
    const after = c.spellSlots[spell.level].current;
    c.spellSlots[spell.level].current = before;
    suite.is("spent one", after, before - 1);
  });

  suite.section("attack cantrips can be edited");

  suite.runs("an attack cantrip renders its own Roll pill", () => {
    const c = app.character;
    const cantrip = c.spells.find(s => s.level === 0 && s.attackRoll);
    if (!cantrip) throw new Error("expected the demo character to have an attack cantrip");
    const html = app.renderSpellRow(cantrip);
    // the whole row used to roll, so openSpellDetailModal -- the only rename,
    // re-class, un-flag or delete route -- was unreachable for these
    if (!html.includes('data-spell-roll="' + cantrip.id + '"')) throw new Error("expected a Roll pill");
    if (!html.includes('data-spell-view="' + cantrip.id + '"')) throw new Error("expected the row to still open the spell");
  });

  suite.runs("a non-attack cantrip gets no pill", () => {
    const c = app.character;
    const cantrip = c.spells.find(s => s.level === 0 && !s.attackRoll);
    if (!cantrip) return;
    const html = app.renderSpellRow(cantrip);
    if (html.includes("data-spell-roll")) throw new Error("expected no Roll pill on a spell that doesn't attack");
  });

  suite.section("level-up");

  suite.runs("a new class reads as a new class, not level 0", () => {
    app.levelUpState = { target: "new", newClass: "Barbarian", hpMode: "average", hpRolled: null, hpManual: null };
    const html = app.levelUpHtml();
    if (html.includes("Level 0")) throw new Error("there is no level 0");
    if (!html.includes("New class")) throw new Error("expected the row to say this is a new class");
  });

  suite.runs("the preview uses the picked class's own hit die", () => {
    // the class combo set levelUpState.newClass without redrawing, so the
    // whole preview rendered against the empty-name d8 fallback and previewed
    // hit points that Confirm then didn't apply
    app.levelUpState = { target: "new", newClass: "Barbarian", hpMode: "average", hpRolled: null, hpManual: null };
    const target = app.levelUpTarget();
    suite.is("Barbarian is d12", target.hitDie, "d12");
    if (!app.levelUpHtml().includes("d12")) throw new Error("expected the preview to show d12");
  });

  suite.runs("levelling a caster creates spell slots", () => {
    // nothing in the app had ever created one: the creator shipped {} and
    // applyLevelUp never touched it, so a Wizard levelled to 20 had none
    const c = app.character;
    const saved = JSON.stringify({ slots: c.spellSlots, casting: c.spellcasting, prepared: c.maxPreparedByClass });
    c.spellSlots = {};
    c.spellcasting = { classes: [] };
    c.maxPreparedByClass = {};
    app.refreshSpellcastingForLevel({ name: "Wizard", level: 3, subclass: null, hitDie: "d6" });
    const levels = Object.keys(c.spellSlots).map(Number).sort((a, b) => a - b);
    const casters = c.spellcasting.classes.map(x => x.name);
    const restored = JSON.parse(saved);
    c.spellSlots = restored.slots; c.spellcasting = restored.casting; c.maxPreparedByClass = restored.prepared;
    suite.is("a Wizard 3 has 1st and 2nd level slots", levels, [1, 2]);
    suite.is("and is registered as a caster", casters, ["Wizard"]);
  });

  suite.runs("levelling again tops the maximum up without refilling what was spent", () => {
    const c = app.character;
    const saved = JSON.stringify({ slots: c.spellSlots, casting: c.spellcasting, prepared: c.maxPreparedByClass });
    c.spellSlots = {}; c.spellcasting = { classes: [] }; c.maxPreparedByClass = {};
    app.refreshSpellcastingForLevel({ name: "Wizard", level: 1, subclass: null, hitDie: "d6" });
    c.spellSlots[1].current = 0;                                   // spend them
    app.refreshSpellcastingForLevel({ name: "Wizard", level: 2, subclass: null, hitDie: "d6" });
    const first = { current: c.spellSlots[1].current, max: c.spellSlots[1].max };
    const restored = JSON.parse(saved);
    c.spellSlots = restored.slots; c.spellcasting = restored.casting; c.maxPreparedByClass = restored.prepared;
    suite.is("max grew 2 -> 3", first.max, 3);
    suite.is("and only the newly gained slot is available", first.current, 1);
  });

  suite.runs("a non-caster gains no slots", () => {
    const c = app.character;
    const saved = JSON.stringify({ slots: c.spellSlots, casting: c.spellcasting, prepared: c.maxPreparedByClass });
    c.spellSlots = {}; c.spellcasting = { classes: [] }; c.maxPreparedByClass = {};
    app.refreshSpellcastingForLevel({ name: "Barbarian", level: 5, subclass: null, hitDie: "d12" });
    const levels = Object.keys(c.spellSlots);
    const restored = JSON.parse(saved);
    c.spellSlots = restored.slots; c.spellcasting = restored.casting; c.maxPreparedByClass = restored.prepared;
    suite.is("no slots", levels, []);
  });

  suite.runs("one roll is not '1 rolls'", () => {
    const saved = app.rollHistory.slice();
    app.rollHistory.length = 0;
    app.rollHistory.push({ label: "Test", notation: "1d20", total: 11, at: Date.now() });
    app.currentScreen = "sheet";     // Dice History only appears with a character open
    app.openAppMenu();
    const html = app.__modals[app.__modals.length - 1].html;
    app.rollHistory.length = 0;
    saved.forEach(r => app.rollHistory.push(r));
    if (html.includes("1 rolls")) throw new Error("expected a singular");
    if (!html.includes("1 roll")) throw new Error("expected the count to still show");
  });

  suite.section("the tutorial's modal lifecycle");

  suite.runs("dismissing the welcome modal ends the tour", () => {
    // closeModal() left tutorialState alone, so renderTutorialOverlay() put
    // the modal straight back -- and openModal() begins with closeModal(),
    // so it evicted whatever the player had opened instead. renderContent()
    // alone has 86 call sites.
    app.tutorialState = { active: true, phase: "welcome", seenTabs: [], seenActions: [] };
    app.noteTutorialModalClosed();
    if (app.tutorialState.active) throw new Error("expected the tour to stop");
    if (app.tutorialContentFor() !== null) throw new Error("expected nothing to render after dismissal");
  });

  suite.runs("dismissing the closing modal doesn't bring it back", () => {
    app.tutorialState = { active: true, phase: "done", seenTabs: [], seenActions: [] };
    app.noteTutorialModalClosed();
    if (app.tutorialState.active) throw new Error("expected 'done' to actually be done");
  });

  suite.runs("a programmatic close leaves the tour alone", () => {
    // only a dismissal counts -- one modal replacing another must not end it
    app.tutorialState = { active: true, phase: "welcome", seenTabs: [], seenActions: [] };
    app.closeModal();
    if (!app.tutorialState.active) throw new Error("expected closeModal() to leave the tour running");
  });

  suite.section("the tour only teaches what this character can do");

  suite.runs("a character with no castable spell is never told to cast one", () => {
    const c = app.character;
    const saved = JSON.stringify({ spells: c.spells, slots: c.spellSlots });
    c.spells = []; c.spellSlots = {};
    const left = app.tutorialActionsLeft().map(a => a.key);
    const restored = JSON.parse(saved);
    c.spells = restored.spells; c.spellSlots = restored.slots;
    if (left.includes("spell")) throw new Error("expected the spell action to be filtered out");
  });

  suite.runs("a caster still gets the spell action", () => {
    const left = app.tutorialActionsLeft().map(a => a.key);
    if (!left.includes("spell")) throw new Error("expected a caster to be offered the spell action");
  });

  suite.section("themes can't hide their own cards");

  suite.runs("every theme defines a card edge", () => {
    const css = require("fs").readFileSync(__dirname + "/../style.css", "utf8");
    ["ember", "fantasy", "light"].forEach(name => {
      const block = css.match(new RegExp('\\[data-theme="' + name + '"\\]\\s*\\{([^}]*)\\}'));
      if (!block) throw new Error("no block for " + name);
      if (!block[1].includes("--card-edge")) throw new Error(name + " defines no --card-edge");
    });
  });

  suite.runs("the light theme's cards are no longer the same colour as the page", () => {
    const css = require("fs").readFileSync(__dirname + "/../style.css", "utf8");
    const block = css.match(/\[data-theme="light"\]\s*\{([^}]*)\}/)[1];
    const frame = block.match(/--frame:\s*(#[0-9A-Fa-f]{6})/)[1].toUpperCase();
    const surface = block.match(/--surface:\s*(#[0-9A-Fa-f]{6})/)[1].toUpperCase();
    if (frame === surface) throw new Error("--frame and --surface identical: every card disappears");
  });
};
