/* Regressions for the Combat tab's wiring, and for the two places text left
   the app and stopped being HTML.

   Half of this is written against the source rather than against behaviour,
   which is unusual but deliberate: the harness never fires a listener, so a
   double-wired control and a dead one both look identical from here. What the
   harness *can* see is the shape that caused it -- an id in a builder that
   renders twice, and a document-wide query inside a wire function -- so those
   are what's pinned. The behaviour itself was checked in a real browser. */

module.exports = function (suite) {
  const harness = require("./harness");
  const app = harness.loadApp();
  const { character, deathSaveState, resetDeathSaves, recordDeathSave, applyHp,
          concentrationGroups, renderCombatTab, deathSaveControlHtml,
          calculateMaxHP, rechargeLabel } = app;

  const source = harness.readFile("tab-combat.js");

  // the body of a top-level function, up to the next one
  function bodyOf(file, name) {
    const text = typeof file === "string" && file.indexOf("\n") === -1 ? harness.readFile(file) : file;
    const start = text.indexOf("\nfunction " + name + "(");
    if (start === -1) return "";
    const next = text.indexOf("\nfunction ", start + 1);
    return text.slice(start, next === -1 ? text.length : next);
  }

  const conc = () => concentrationGroups(character).map(g => g.name);
  const down = () => { character.hp.current = 0; character.hp.temp = 0; resetDeathSaves(character); };
  const bless = () => {
    character.activeEffects.push({
      id: 900 + character.activeEffects.length, name: "Bless", concentration: true,
      duration: { type: "Permanent", rounds: null }, effects: []
    });
  };

  /* ---------------- the shared death-save block ---------------- */

  suite.section("the death-save controls carry no ids");
  const controls = deathSaveControlHtml();
  suite.ok("no roll-death-save id", !/id="roll-death-save"/.test(controls));
  suite.ok("no clear-death-saves id", !/id="clear-death-saves"/.test(controls));
  suite.ok("the builder emits no id at all", !/\bid="/.test(controls),
    "deathSaveControlHtml renders in the sheet card and the calculator at once, so any id it emits exists twice");

  down();
  suite.ok("the roll button is found by attribute", /data-death-roll/.test(deathSaveControlHtml()));
  recordDeathSave("failure", 1);
  suite.ok("and the clear button too", /data-death-clear/.test(deathSaveControlHtml()));
  character.hp.current = 10; resetDeathSaves(character);
  suite.ok("neither shows when neither applies",
    !/data-death-roll|data-death-clear/.test(deathSaveControlHtml()));

  suite.section("wiring is scoped to the container it was handed");
  const wireDeath = bodyOf(source, "wireDeathSaveControls");
  suite.ok("it takes a container", /function wireDeathSaveControls\(container\)/.test(wireDeath));
  suite.ok("and never queries the document", !/document\./.test(wireDeath),
    "a document-wide query here reaches into an open modal and wires its copy too");
  suite.runs("a missing container is harmless", () => app.wireDeathSaveControls(null));

  suite.section("nothing in the combat tab's wiring reaches outside #content");
  const wireTab = bodyOf(source, "wireCombatTab");
  const strayQueries = (wireTab.match(/document\.(getElementById|querySelector(All)?)\([^)]*\)/g) || [])
    .filter(call => !/getElementById\("content"\)/.test(call));
  suite.is("every lookup goes through the tab's root", strayQueries, []);

  suite.section("and the effect detail modal stays inside itself");
  const detail = bodyOf(source, "openEffectDetailModal");
  suite.ok("the exhaustion stepper is found inside the modal",
    /modal\.querySelectorAll\("\[data-exhaustion-step\]"\)/.test(detail),
    "the Combat tab draws the same stepper, so a document-wide query wires it a second time");
  const strayDetail = (detail.match(/document\.(getElementById|querySelector(All)?)\([^)]*\)/g) || [])
    .filter(call => !/getElementById\("modal-overlay"\)/.test(call));
  suite.is("nothing else is looked up globally", strayDetail, []);

  suite.section("the two copies of the track are redrawn from one place");
  suite.ok("wireCombatTab refreshes the calculator's panel", /refreshCalcDeathPanel\(\)/.test(wireTab),
    "a re-render never touches an open modal, so the panel goes stale unless it is redrawn here");
  const calcSource = bodyOf(source, "openHpCalculator");
  suite.ok("the calculator wires its own panel only",
    /wireDeathSaveControls\(document\.getElementById\("calc-death-saves"\)\)/.test(calcSource));

  /* ---------------- death breaks concentration ---------------- */

  suite.section("dropping to nothing breaks concentration");
  character.hp.current = 40; character.hp.temp = 0; resetDeathSaves(character);
  character.activeEffects = [];
  bless();
  applyHp("damage", 10);
  suite.is("a survivable hit leaves it alone", conc(), ["Bless"]);
  applyHp("damage", 30);
  suite.is("reaching zero ends it", conc(), []);
  suite.is("and the hit points are right", character.hp.current, 0);

  suite.section("dying breaks it too");
  character.hp.current = 20; character.hp.temp = 0; resetDeathSaves(character);
  character.activeEffects = [];
  bless();
  recordDeathSave("failure", 3);
  suite.ok("three failures is dead", deathSaveState(character).dead);
  app.breakConcentrationIfDown();
  suite.is("so concentration ends", conc(), []);

  suite.section("but not while you are still up");
  character.hp.current = 20; character.hp.temp = 0; resetDeathSaves(character);
  character.activeEffects = [];
  bless();
  app.breakConcentrationIfDown();
  suite.is("standing and undamaged keeps it", conc(), ["Bless"]);

  suite.section("massive damage ends it as well");
  const maximum = calculateMaxHP(character).total;
  character.hp.current = 5; character.hp.temp = 0; resetDeathSaves(character);
  character.activeEffects = [];
  bless();
  applyHp("damage", 5 + maximum);
  suite.ok("killed outright", deathSaveState(character).dead);
  suite.is("and holding nothing", conc(), []);

  suite.section("healing back up is unaffected");
  character.hp.current = 0; character.hp.temp = 0; resetDeathSaves(character);
  recordDeathSave("failure", 2);
  applyHp("heal", 12);
  suite.is("hit points restored", character.hp.current, 12);
  suite.is("and the tracks cleared", deathSaveState(character).failures, 0);

  /* ---------------- one concentration at a time ---------------- */

  suite.section("a second concentration asks before it takes over");
  const save = bodyOf(source, "openAddEffectModal");
  suite.ok("the save handler asks first", /confirmModal\(\{/.test(save),
    "help.js promises starting a second concentration asks before dropping the first");
  suite.ok("and it asks in-app, not with a browser dialog", !/[^M]confirm\(/.test(save));
  suite.ok("and drops the old group whole", /saveEffect\(dropConcentration\(\)\)/.test(save),
    "dropping concentration has to take the whole effect group, not just the flag");
  suite.ok("only when something is already held",
    /if \(concentration && concentrationGroups\(character\)\.length\)/.test(save));

  suite.section("dropConcentration still takes whole groups");
  character.hp.current = 40; character.activeEffects = [];
  bless();
  character.activeEffects.push({ id: 950, name: "Prone", concentration: false,
    duration: { type: "Permanent", rounds: null }, effects: [] });
  const dropped = app.dropConcentration();
  suite.is("it reports what ended", dropped, ["Bless"]);
  suite.is("and leaves everything else", character.activeEffects.map(g => g.name), ["Prone"]);

  /* ---------------- confirm() is not HTML ---------------- */

  /* These three used to ask with the browser's confirm(), which showed the
     page's origin above the question and rendered esc()'d text literally
     ("&amp;", "&quot;"). They now use the app's own confirmModal(), which
     takes plain strings and escapes them itself on the way into innerHTML --
     so the old "must NOT call esc()" assertion inverted into this one. */
  suite.section("nothing asks with a browser dialog");
  ["tab-combat.js", "tab-inventory.js", "tab-character.js", "tab-notes.js"].forEach(file => {
    const code = harness.readFile(file).split("\n").filter(line => !/^\s*\/\//.test(line)).join("\n");
    const native = (code.match(/(?<!\.)\b(?<!confirmM)confirm\(/g) || []).filter(m => m === "confirm(");
    suite.is(file + " calls no native confirm()", native, []);
    suite.is(file + " calls no native alert()", (code.match(/(?<![\w.])alert\(/g) || []), []);
  });

  /* ---------------- resource rows after the charset fix ---------------- */

  suite.section("a resource that never recharges shows no tag");
  character.resources.push({ id: 800, name: "Sigil of the Long Road",
    recharge: { on: "none", amount: "all" }, current: 2, max: 2 });
  const rows = renderCombatTab();
  suite.is("rechargeLabel says em dash", rechargeLabel({ on: "none", amount: "all" }), "—");
  suite.ok("and the row carries no em-dash tag",
    !/<span class="res-tag">—<\/span>/.test(rows),
    "the suppression compares against a literal em dash -- it only started matching once the page declared utf-8");
  suite.ok("the row is still there", /Sigil of the Long Road/.test(rows));
  character.resources = character.resources.filter(r => r.id !== 800);

  suite.section("a container's HOLDS tag stays on one line");
  suite.ok("it is marked nowrap",
    /<span class="res-tag" style="white-space:nowrap;" title="Refills from /.test(renderCombatTab()),
    "the stack's name is the player's, and breaking mid-tag left a word dangling under the row name");

  /* ---------------- the calculator's layout ---------------- */

  suite.section("the hit point calculator gets the taller sheet");
  const before = app.__modals.length;
  app.openHpCalculator();
  const calc = app.__modals[before];
  suite.is("opened full height", calc.mode, "full");
  suite.ok("the six dice sit in one row of six",
    /class="calc-grid dice" style="grid-template-columns:repeat\(6, 1fr\);"/.test(calc.html),
    "in the shared four-column grid d12 and d20 sat alone on a second row");
  suite.ok("the death panel is still in there", /id="calc-death-saves"/.test(calc.html));
  suite.ok("with no ids from the shared block", !/id="roll-death-save"/.test(calc.html));

  suite.section("a Bonus on Healing lifts every point of it");
  /* A ring that makes potions work harder, a Life cleric's Disciple of Life.
     It describes the healing received, not the roll that produced it, so it is
     added once to the amount rather than to each die. */
  const healSheet = app.character;
  healSheet.activeEffects = [];
  healSheet.hp.current = 10;
  app.applyHp("heal", 5);
  const plain = healSheet.hp.current;
  suite.is("with no effect, five points is five points", plain, 15);

  healSheet.hp.current = 10;
  healSheet.activeEffects = [{
    id: "h-1", name: "Disciple of Life", concentration: false,
    duration: { type: "Permanent", rounds: null },
    effects: [{ category: "Bonus", value: { stat: "Healing", amount: 3 } }]
  }];
  app.applyHp("heal", 5);
  suite.is("with a +3, five points heals eight", healSheet.hp.current, 18);

  /* A negative one cannot turn healing into damage. */
  healSheet.hp.current = 10;
  healSheet.activeEffects = [{
    id: "h-2", name: "Cursed", concentration: false,
    duration: { type: "Permanent", rounds: null },
    effects: [{ category: "Bonus", value: { stat: "Healing", amount: -20 } }]
  }];
  app.applyHp("heal", 5);
  suite.is("a penalty bigger than the healing stops at nothing, it does not wound",
    healSheet.hp.current, 10);
  suite.ok("Healing is offered in the Bonus list", app.MODIFIER_STATS.indexOf("Healing") !== -1);
  healSheet.activeEffects = [];
};