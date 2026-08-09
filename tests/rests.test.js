/* Rests are the only thing that reads the recharge vocabulary shared by
   resources, spell slots and hit dice, and the duration types on effects. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { character, applyRest, rechargeLabel, restoreOnRest, calculateMaxHP,
          concentrationGroups, hasCondition, calculateHitDice } = app;

  const resource = name => character.resources.find(r => r.name === name);

  suite.section("recharge labels");
  suite.is("all on a short rest", rechargeLabel({ on: "SR", amount: "all" }), "SR");
  suite.is("half on a long rest", rechargeLabel({ on: "LR", amount: "half" }), "½ LR");
  suite.is("a fixed amount", rechargeLabel({ on: "SR", amount: 2 }), "2 SR");
  suite.is("dice", rechargeLabel({ on: "SR", amount: "1d4" }), "1d4 SR");
  suite.is("never", rechargeLabel({ on: "none", amount: "all" }), "—");
  suite.is("custom text passes through", rechargeLabel({ on: "Per Day", amount: "all" }), "Per Day");

  suite.section("short rest");
  resource("Action Surge").current = 0;
  resource("Second Wind").current = 0;
  character.spellSlots[1].current = 0;
  character.hitDiceSpent = { d10: 5, d8: 2 };          // every die spent
  applyRest("short");
  suite.is("restores short rest resources", resource("Action Surge").current, 1);
  suite.is("leaves long rest resources", resource("Second Wind").current, 0);
  suite.is("leaves long rest slots", character.spellSlots[1].current, 0);
  suite.is("leaves hit dice", calculateHitDice(character)[0].current, 0);

  suite.section("long rest");
  applyRest("long");
  suite.is("restores long rest resources", resource("Second Wind").current, 2);
  suite.is("restores every slot level", character.spellSlots[1].current, character.spellSlots[1].max);
  suite.is("returns half the d10 pool, minimum one", calculateHitDice(character)[0].current, 2);
  suite.is("returns half the d8 pool", calculateHitDice(character)[1].current, 1);
  suite.is("restores hit points", character.hp.current, calculateMaxHP(character).total);
  suite.is("clears temporary hit points", character.hp.temp, 0);

  suite.section("recharge amounts");
  character.resources.push({ id: 900, name: "Arcane Recovery", current: 0, max: 5,
    recharge: { on: "LR", amount: 2 } });
  applyRest("long");
  suite.is("a fixed amount adds exactly that", character.resources.find(r => r.id === 900).current, 2);
  applyRest("long");
  suite.is("and again, up to the maximum", character.resources.find(r => r.id === 900).current, 4);
  character.resources.find(r => r.id === 900).current = 4;
  applyRest("long");
  suite.is("never exceeding the maximum", character.resources.find(r => r.id === 900).current, 5);

  character.resources.push({ id: 901, name: "Bardic", current: 0, max: 20,
    recharge: { on: "SR", amount: "1d4" } });
  applyRest("short");
  const bardic = character.resources.find(r => r.id === 901).current;
  suite.ok("a dice amount lands in range", bardic >= 1 && bardic <= 4, "got " + bardic);

  character.resources.push({ id: 902, name: "Table Ruling", current: 0, max: 3,
    recharge: { on: "Per Session", amount: "all" } });
  applyRest("long");
  suite.is("a custom trigger never restores automatically",
    character.resources.find(r => r.id === 902).current, 0);

  suite.section("uncapped entries");
  character.resources.push({ id: 903, name: "Loose Coins", current: 40, max: 0,
    recharge: { on: "LR", amount: "all" } });
  applyRest("long");
  suite.is("restoring all of an uncapped entry leaves it alone",
    character.resources.find(r => r.id === 903).current, 40);
  character.resources = character.resources.filter(r => r.id < 900);

  suite.section("effects and concentration");
  character.activeEffects = [
    { id: 1, name: "Prone", concentration: false, duration: { type: "Permanent", rounds: null },
      effects: [{ category: "Condition", value: { condition: "Prone" } }] },
    { id: 2, name: "Shield", concentration: false, duration: { type: "Rounds", rounds: 3 },
      effects: [{ category: "Bonus", value: { stat: "AC", amount: 5 } }] },
    { id: 3, name: "Potion", concentration: false, duration: { type: "Short Rest", rounds: null },
      effects: [{ category: "Skill", value: { skill: "Stealth", amount: 5 } }] },
    { id: 4, name: "Blessing", concentration: false, duration: { type: "Long Rest", rounds: null },
      effects: [{ category: "Saving Throw", value: { ability: "WIS", amount: 1 } }] },
    { id: 5, name: "Bless", concentration: true, duration: { type: "Permanent", rounds: null },
      effects: [{ category: "Bonus", value: { stat: "Attack Rolls", amount: 1 } }] }
  ];
  applyRest("short");
  suite.ok("clears round durations", !character.activeEffects.some(g => g.duration.type === "Rounds"));
  suite.ok("clears short rest durations", !character.activeEffects.some(g => g.duration.type === "Short Rest"));
  suite.ok("keeps long rest durations", character.activeEffects.some(g => g.duration.type === "Long Rest"));
  suite.ok("keeps permanent conditions", hasCondition(character, "Prone"));
  suite.is("breaks concentration even when permanent", concentrationGroups(character).length, 0);

  applyRest("long");
  suite.ok("a long rest clears long rest durations",
    !character.activeEffects.some(g => g.duration.type === "Long Rest"));
  suite.ok("but still keeps permanent conditions", hasCondition(character, "Prone"));
};
