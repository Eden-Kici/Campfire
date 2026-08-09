/* Exhaustion is the only condition with degrees, and each level adds to the
   ones below it. The point of storing a level rather than six conditions is
   that the penalties can be derived and a rest can step it down. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { character, exhaustionLevel, setExhaustionLevel, exhaustionEffects,
          calculateSpeed, calculateMaxHP, derivedRollMode, applyRest, hasCondition } = app;

  /* The demo character starts Prone and Blessed, both of which bend rolls on
     their own. Clearing them first means a disadvantage seen below is the
     exhaustion doing it and not the baseline. */
  character.activeEffects = [];

  const at = level => { setExhaustionLevel(character, level); };

  suite.section("reading the level");
  suite.is("none to begin with", exhaustionLevel(character), 0);
  at(3);
  suite.is("set and read back", exhaustionLevel(character), 3);
  at(9);
  suite.is("capped at six", exhaustionLevel(character), 6);
  at(-2);
  suite.is("floored at zero", exhaustionLevel(character), 0);

  suite.section("only ever one exhaustion effect");
  at(2); at(4); at(1);
  const count = character.activeEffects.filter(g =>
    (g.effects || []).some(e => String(e.value.condition).toLowerCase() === "exhaustion")).length;
  suite.is("setting it repeatedly does not stack up effects", count, 1);
  suite.is("and the level is the last one set", exhaustionLevel(character), 1);

  suite.section("each level adds to the ones below");
  suite.is("one tier at level 1", exhaustionEffects(1).length, 1);
  suite.is("three tiers at level 3", exhaustionEffects(3).length, 3);
  suite.is("all six at level 6", exhaustionEffects(6).length, 6);

  suite.section("level 1: ability checks");
  at(1);
  suite.is("disadvantage on checks", derivedRollMode(character, "check").mode, "disadvantage");
  suite.is("attacks unaffected", derivedRollMode(character, "attack").mode, "normal");
  suite.is("saves unaffected", derivedRollMode(character, "save", "WIS").mode, "normal");
  suite.ok("and it says why", /Exhaustion 1/.test(derivedRollMode(character, "check").reasons.disadvantage.join()));

  suite.section("level 2: speed halved");
  at(0);
  const fullSpeed = calculateSpeed(character).total;
  at(2);
  suite.is("halved", calculateSpeed(character).total, Math.ceil(fullSpeed / 2));
  suite.ok("shown in the breakdown", calculateSpeed(character).sources.some(s => s.label === "Exhaustion 2"));
  suite.is("checks still have disadvantage", derivedRollMode(character, "check").mode, "disadvantage");

  suite.section("level 3: attacks and saves too");
  at(3);
  suite.is("attacks", derivedRollMode(character, "attack").mode, "disadvantage");
  suite.is("saves", derivedRollMode(character, "save", "WIS").mode, "disadvantage");
  suite.is("speed still halved", calculateSpeed(character).total, Math.ceil(fullSpeed / 2));

  suite.section("level 4: hit point maximum halved");
  at(0);
  const fullHP = calculateMaxHP(character).total;
  at(4);
  suite.is("halved", calculateMaxHP(character).total, Math.ceil(fullHP / 2));
  suite.ok("shown in the breakdown", calculateMaxHP(character).sources.some(s => s.label === "Exhaustion 4"));

  suite.section("level 5: no speed at all");
  at(5);
  suite.is("speed is zero", calculateSpeed(character).total, 0);
  suite.is("hit point maximum still halved", calculateMaxHP(character).total, Math.ceil(fullHP / 2));

  suite.section("cancelling out");
  at(1);
  character.activeEffects.push({ id: 700, name: "Guidance", concentration: false,
    duration: { type: "Permanent", rounds: null },
    effects: [{ category: "Advantage", value: { rollType: "check", mode: "advantage" } }] });
  suite.is("advantage cancels the exhaustion disadvantage",
    derivedRollMode(character, "check").mode, "normal");
  suite.ok("with both reasons kept",
    derivedRollMode(character, "check").reasons.disadvantage.length === 1 &&
    derivedRollMode(character, "check").reasons.advantage.length === 1);
  character.activeEffects = character.activeEffects.filter(g => g.id !== 700);

  suite.section("a long rest removes one level");
  at(3);
  applyRest("long");
  suite.is("down to two", exhaustionLevel(character), 2);
  applyRest("long");
  suite.is("down to one", exhaustionLevel(character), 1);
  applyRest("long");
  suite.is("gone", exhaustionLevel(character), 0);
  suite.ok("and the condition is removed entirely", !hasCondition(character, "Exhaustion"));
  applyRest("long");
  suite.is("resting with none stays at none", exhaustionLevel(character), 0);

  suite.section("a short rest does not help");
  at(2);
  applyRest("short");
  suite.is("still two", exhaustionLevel(character), 2);

  suite.section("it renders");
  at(3);
  suite.runs("combat tab", () => app.renderCombatTab());
  const group = character.activeEffects.find(g =>
    (g.effects || []).some(e => String(e.value.condition).toLowerCase() === "exhaustion"));
  const before = app.__modals.length;
  app.openEffectDetailModal(group.id);
  const html = app.__modals[before].html;
  suite.ok("the detail lists every tier", /Speed halved/.test(html) && /Death/.test(html));
  suite.ok("with a stepper", /data-exhaustion-step/.test(html));
  at(0);
};
