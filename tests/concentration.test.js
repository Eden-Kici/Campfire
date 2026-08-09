/* Concentration. The grouping work means dropping it already ends everything
   riding on it; what's new is being asked at the right moment and at the right
   difficulty. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { character, concentrationSaveDC, dropConcentration, concentrationGroups,
          openConcentrationCheckModal, calculateAttack, calculateSavingThrow,
          applyRest, hasCondition } = app;

  const bless = () => ({
    id: 500, name: "Bless", concentration: true,
    duration: { type: "Rounds", rounds: 10 },
    effects: [
      { category: "Bonus", value: { stat: "Attack Rolls", amount: 1 } },
      { category: "Saving Throw", value: { ability: "WIS", amount: 1 } }
    ]
  });

  suite.section("the difficulty");
  suite.is("small damage is DC 10", concentrationSaveDC(6), 10);
  suite.is("exactly 20 is still DC 10", concentrationSaveDC(20), 10);
  suite.is("22 damage is DC 11", concentrationSaveDC(22), 11);
  suite.is("50 damage is DC 25", concentrationSaveDC(50), 25);
  suite.is("odd damage rounds down", concentrationSaveDC(25), 12);
  suite.is("one damage is still DC 10", concentrationSaveDC(1), 10);

  suite.section("losing it ends what it held up");
  character.activeEffects = [bless()];
  const before = calculateAttack(character, character.inventory.find(i => i.isWeapon)).toHitTotal;
  suite.ok("bless is reaching attack rolls",
    calculateAttack(character, character.inventory.find(i => i.isWeapon))
      .toHitSources.some(s => s.label === "Bless"));
  suite.is("and saves", calculateSavingThrow(character, "WIS").sources.filter(s => s.label === "Bless").length, 1);

  const dropped = dropConcentration();
  suite.is("it reports what was lost", dropped, ["Bless"]);
  suite.is("nothing is concentrating any more", concentrationGroups(character).length, 0);
  suite.is("the attack bonus is gone",
    calculateAttack(character, character.inventory.find(i => i.isWeapon)).toHitTotal, before - 1);
  suite.ok("and the save bonus",
    !calculateSavingThrow(character, "WIS").sources.some(s => s.label === "Bless"));

  suite.section("only concentration effects are dropped");
  character.activeEffects = [
    bless(),
    { id: 501, name: "Prone", concentration: false, duration: { type: "Permanent", rounds: null },
      effects: [{ category: "Condition", value: { condition: "Prone" } }] },
    { id: 502, name: "Shield of Faith", concentration: true, duration: { type: "Rounds", rounds: 10 },
      effects: [{ category: "Bonus", value: { stat: "AC", amount: 2 } }] }
  ];
  const lost = dropConcentration();
  suite.is("both concentration effects go", lost.length, 2);
  suite.ok("the condition stays", hasCondition(character, "Prone"));
  suite.is("one effect left", character.activeEffects.length, 1);

  suite.section("it uses the ordinary roll window");
  character.activeEffects = [bless()];
  character.hp.current = 30;
  openConcentrationCheckModal(14);
  let html = app.rollWindowHtml();
  suite.ok("naming what is at stake", /Bless/.test(html));
  suite.ok("leading with the difficulty class", /Difficulty Class/.test(html) && /roll-dc-value">10</.test(html));
  suite.ok("with the save's own breakdown as chips", /roll-chip/.test(html));
  suite.ok("and the advantage controls", /data-roll-mode="advantage"/.test(html));
  suite.ok("offering both outcomes", /data-roll-decision="0"/.test(html) && /data-roll-decision="1"/.test(html));
  suite.ok("coloured like advantage and disadvantage",
    /outcome-good/.test(html) && /outcome-bad/.test(html));

  suite.section("the player rolls it, the app does not");
  suite.ok("nothing is rolled on opening", !app.rollState.rolled);
  suite.ok("the total is blank", /roll-total unrolled">—</.test(html));
  suite.ok("no verdict yet", !/roll-verdict/.test(html));
  suite.ok("and a roll button rather than a reroll", /id="roll-now"/.test(html) && !/id="roll-reroll"/.test(html));

  suite.section("choosing advantage before rolling still doesn't roll");
  app.setRollMode("advantage");
  suite.ok("still unrolled", !app.rollState.rolled);
  suite.ok("and still offering to roll", /id="roll-now"/.test(app.rollWindowHtml()));
  app.setRollMode("normal");

  suite.section("once rolled");
  app.rerollCurrent();
  html = app.rollWindowHtml();
  suite.ok("it is marked as rolled", app.rollState.rolled);
  suite.ok("a verdict appears", /roll-verdict/.test(html));
  suite.ok("reading plainly as Success or Failure",
    /roll-verdict pass">Success</.test(html) || /roll-verdict fail">Failure</.test(html));
  suite.ok("without elaborating on what was held or lost",
    !/concentration held/.test(html) && !/concentration broken/.test(html));
  suite.ok("and the button becomes a reroll", /id="roll-reroll"/.test(html));

  suite.section("rolling as often as you like changes nothing on its own");
  const heldBefore = concentrationGroups(character).length;
  app.rerollCurrent();
  app.setRollMode("advantage");
  app.rerollCurrent();
  app.setRollMode("disadvantage");
  app.rerollCurrent();
  suite.is("concentration is untouched until you decide", concentrationGroups(character).length, heldBefore);

  suite.section("the verdict follows the roll");
  app.rollState.outcome.total = 25;
  suite.ok("a high roll succeeds", /roll-verdict pass/.test(app.rollWindowHtml()));
  app.rollState.outcome.total = 3;
  suite.ok("a low roll fails", /roll-verdict fail/.test(app.rollWindowHtml()));

  suite.section("half of heavy damage becomes the DC");
  openConcentrationCheckModal(30);
  suite.ok("thirty damage means DC 15", /roll-dc-value">15</.test(app.rollWindowHtml()));

  suite.section("the player can check it themselves, with no DC");
  character.activeEffects = [bless()];
  openConcentrationCheckModal();
  const manual = app.rollWindowHtml();
  suite.ok("no difficulty class", !/Difficulty Class/.test(manual));
  suite.ok("and so no verdict to give", !/roll-verdict/.test(manual));
  suite.ok("rolled straight away, since the tap was the ask", app.rollState.rolled);
  suite.ok("still offering both outcomes", /data-roll-decision="0"/.test(manual));
  suite.ok("the row itself is the control", /id="concentration-check"/.test(app.renderCombatTab()));

  suite.section("deciding is what acts");
  openConcentrationCheckModal(14);
  app.rollState.config.decisions[1].action(1);
  suite.is("choosing to lose it drops the concentration", concentrationGroups(character).length, 0);

  character.activeEffects = [bless()];
  openConcentrationCheckModal(14);
  app.rollState.config.decisions[0].action(20);
  suite.is("choosing to keep it leaves it alone", concentrationGroups(character).length, 1);

  suite.section("no prompt when nothing is at stake");
  character.activeEffects = [];
  const quiet = app.__modals.length;
  openConcentrationCheckModal(20);
  suite.is("nothing is asked", app.__modals.length, quiet);

  suite.section("resting still breaks it");
  character.activeEffects = [bless()];
  applyRest("short");
  suite.is("a short rest ends concentration", concentrationGroups(character).length, 0);
};
