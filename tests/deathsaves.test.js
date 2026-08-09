/* Death saves. The state is derived from hit points rather than being a mode
   you enter and leave, so most of these check that the derivation holds. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { character, deathSaveState, resetDeathSaves, recordDeathSave, applyHp,
          renderCombatTab, calculateMaxHP } = app;

  const down = () => { character.hp.current = 0; character.hp.temp = 0; resetDeathSaves(character); };

  suite.section("when it applies");
  character.hp.current = 10;
  suite.ok("not dying above zero", !deathSaveState(character).dying);
  suite.is("and the card stays hidden", /death-card/.test(renderCombatTab()), false);
  down();
  suite.ok("dying at zero", deathSaveState(character).dying);
  suite.ok("and the card appears", /death-card/.test(renderCombatTab()));

  suite.section("three successes stabilise");
  down();
  recordDeathSave("success", 1);
  suite.ok("still dying after one", deathSaveState(character).dying);
  recordDeathSave("success", 2);
  suite.ok("stable after three", deathSaveState(character).stable);
  suite.ok("no longer dying", !deathSaveState(character).dying);
  suite.ok("still at zero hit points", character.hp.current === 0);
  suite.ok("the card says stable", /class="death-card stable"/.test(renderCombatTab()));

  suite.section("three failures kill");
  down();
  recordDeathSave("failure", 3);
  suite.ok("dead", deathSaveState(character).dead);
  suite.ok("not dying any more", !deathSaveState(character).dying);
  suite.ok("the card says dead", /class="death-card dead"/.test(renderCombatTab()));

  suite.section("neither track runs past three");
  down();
  recordDeathSave("success", 9);
  suite.is("successes cap", deathSaveState(character).successes, 3);
  down();
  recordDeathSave("failure", 9);
  suite.is("failures cap", deathSaveState(character).failures, 3);

  suite.section("damage while down is an automatic failure");
  down();
  applyHp("damage", 4);
  suite.is("one failure recorded", deathSaveState(character).failures, 1);
  applyHp("damage", 4);
  suite.is("and another", deathSaveState(character).failures, 2);
  suite.is("hit points stay at zero", character.hp.current, 0);

  down();
  character.hp.temp = 6;
  applyHp("damage", 4);
  suite.is("temporary hit points absorb it entirely", character.hp.temp, 2);
  suite.is("so no failure is recorded", deathSaveState(character).failures, 0);

  suite.section("damage that drops you does not also fail a save");
  character.hp.current = 5;
  character.hp.temp = 0;
  resetDeathSaves(character);
  applyHp("damage", 12);
  suite.is("you are at zero", character.hp.current, 0);
  suite.is("with a clean slate", deathSaveState(character).failures, 0);

  suite.section("healing clears both tracks");
  down();
  recordDeathSave("success", 2);
  recordDeathSave("failure", 2);
  applyHp("heal", 5);
  suite.is("hit points restored", character.hp.current, 5);
  suite.is("successes cleared", deathSaveState(character).successes, 0);
  suite.is("failures cleared", deathSaveState(character).failures, 0);
  suite.ok("no longer dying", !deathSaveState(character).dying);

  suite.section("healing above zero from stable also clears");
  down();
  recordDeathSave("success", 3);
  applyHp("heal", 1);
  suite.ok("not stable any more", !deathSaveState(character).stable);
  suite.is("tracks cleared", deathSaveState(character).successes, 0);

  suite.section("rolling");
  const outcomes = { success: 0, failure: 0, revived: 0, doubleFailure: 0 };
  for (let i = 0; i < 400; i++) {
    down();
    const before = { ...character.deathSaves };
    app.rollDeathSave();
    const after = character.deathSaves;
    if (character.hp.current === 1) outcomes.revived++;
    else if (after.failures - before.failures === 2) outcomes.doubleFailure++;
    else if (after.successes > before.successes) outcomes.success++;
    else outcomes.failure++;
  }
  suite.ok("a natural twenty revives you at one hit point", outcomes.revived > 0,
    "never happened in 400 rolls");
  suite.ok("a natural one costs two failures", outcomes.doubleFailure > 0,
    "never happened in 400 rolls");
  suite.ok("successes happen", outcomes.success > 0);
  suite.ok("failures happen", outcomes.failure > 0);
  suite.ok("roughly half succeed", Math.abs(outcomes.success - outcomes.failure) < 120,
    "successes " + outcomes.success + ", failures " + outcomes.failure);

  suite.section("massive damage kills outright");
  const maximum = calculateMaxHP(character).total;
  character.hp.current = 5; character.hp.temp = 0; resetDeathSaves(character);
  applyHp("damage", 5 + maximum);
  suite.ok("dead, not dying", deathSaveState(character).dead);
  suite.is("three failures at once", deathSaveState(character).failures, 3);

  character.hp.current = 5; character.hp.temp = 0; resetDeathSaves(character);
  applyHp("damage", 5 + maximum - 1);
  suite.ok("one short of the maximum leaves you dying", deathSaveState(character).dying);
  suite.ok("and not dead", !deathSaveState(character).dead);

  character.hp.current = 5; character.hp.temp = 0; resetDeathSaves(character);
  applyHp("damage", 5);
  suite.ok("damage that exactly reaches zero is survivable", deathSaveState(character).dying);
  suite.is("with no failures", deathSaveState(character).failures, 0);

  character.hp.current = 5; character.hp.temp = maximum; resetDeathSaves(character);
  applyHp("damage", 5 + maximum);
  suite.ok("temporary hit points count against the overkill", !deathSaveState(character).dead);

  suite.section("the card can be pinned open");
  character.hp.current = 10; resetDeathSaves(character);
  app.settings.alwaysShowDeathSaves = false;
  suite.is("hidden by default above zero", /death-card/.test(renderCombatTab()), false);
  app.settings.alwaysShowDeathSaves = true;
  suite.ok("shown when the setting is on", /death-card/.test(renderCombatTab()));
  suite.ok("the pips are tappable", /data-death-pip/.test(renderCombatTab()));
  suite.ok("and offers no roll button", !/id="roll-death-save"/.test(renderCombatTab()));
  app.settings.alwaysShowDeathSaves = false;

  suite.section("pips can be set by hand");
  down();
  app.setDeathSaveTrack("success", 2);
  suite.is("tapping the second sets two", deathSaveState(character).successes, 2);
  app.setDeathSaveTrack("success", 2);
  suite.is("tapping it again steps back", deathSaveState(character).successes, 1);
  app.setDeathSaveTrack("failure", 3);
  suite.ok("failures can be set the same way", deathSaveState(character).dead);
  app.setDeathSaveTrack("failure", 1);
  suite.is("and reduced again", deathSaveState(character).failures, 1);

  suite.section("the tracks also live in the hit point calculator");
  const before = app.__modals.length;
  app.openHpCalculator();
  const calc = app.__modals[before].html;
  suite.ok("under the hit dice", calc.indexOf("Hit Dice") < calc.indexOf("Death Saves"));
  suite.ok("with the same pips", /death-pips/.test(calc));

  suite.section("a long rest brings you back");
  down();
  recordDeathSave("failure", 2);
  app.applyRest("long");
  suite.is("hit points restored", character.hp.current, calculateMaxHP(character).total);
  suite.is("and the tracks are clear", deathSaveState(character).failures, 0);
};
