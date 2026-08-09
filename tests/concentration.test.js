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

  suite.section("being asked at the right moment");
  character.activeEffects = [bless()];
  character.hp.current = 30;
  const modalsBefore = app.__modals.length;
  openConcentrationCheckModal(14);
  const asked = app.__modals.slice(modalsBefore);
  suite.is("a prompt appears", asked.length, 1);
  suite.ok("naming what is at stake", /Bless/.test(asked[0].html));
  suite.ok("and showing the DC", /<span>DC<\/span><span>10<\/span>/.test(asked[0].html));
  suite.ok("offering a roll", /id="conc-roll"/.test(asked[0].html));
  suite.ok("and manual outcomes for a table that rolls its own",
    /id="conc-keep"/.test(asked[0].html) && /id="conc-drop"/.test(asked[0].html));

  const highDamage = app.__modals.length;
  openConcentrationCheckModal(30);
  suite.ok("half of heavy damage becomes the DC",
    /<span>DC<\/span><span>15<\/span>/.test(app.__modals[highDamage].html));

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
