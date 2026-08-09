/* Classes and levels. The point of the model is that proficiency bonus, hit
   dice and the line under the character's name are all derived from one list,
   so levelling up cannot leave two numbers disagreeing. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { character, totalLevel, proficiencyBonusForLevel, classLineFor,
          calculateHitDice, calculateProficiencyBonus, spendHitDieOfSize,
          calculateSkill, calculateAttack, applyRest } = app;

  suite.section("the progression");
  const expected = { 1: 2, 4: 2, 5: 3, 8: 3, 9: 4, 12: 4, 13: 5, 16: 5, 17: 6, 20: 6 };
  Object.keys(expected).forEach(level => {
    suite.is("level " + level, proficiencyBonusForLevel(Number(level)), expected[level]);
  });

  suite.section("the demo character");
  suite.is("total level is the sum of its classes", totalLevel(character), 7);
  suite.is("proficiency bonus derives from that", calculateProficiencyBonus(character).total, 3);
  suite.is("the source names the level", calculateProficiencyBonus(character).sources[0].label, "Level 7");
  suite.is("the class line is built from the list", classLineFor(character),
    "Fighter (Champion) 5 / Rogue (Thief) 2");

  suite.section("hit dice come from class levels");
  const pools = calculateHitDice(character);
  suite.is("one pool per die size", pools.length, 2);
  suite.is("five d10 from five Fighter levels", pools.find(p => p.die === "d10").total, 5);
  suite.is("two d8 from two Rogue levels", pools.find(p => p.die === "d8").total, 2);
  suite.is("one d10 already spent", pools.find(p => p.die === "d10").current, 4);

  suite.section("two classes sharing a die size merge");
  const saved = JSON.parse(JSON.stringify(character.classes));
  character.classes = [
    { name: "Fighter", level: 3, subclass: null, hitDie: "d10" },
    { name: "Ranger", level: 2, subclass: null, hitDie: "d10" }
  ];
  character.hitDiceSpent = {};
  suite.is("into a single pool", calculateHitDice(character).length, 1);
  suite.is("of five dice", calculateHitDice(character)[0].total, 5);
  character.classes = saved;
  character.hitDiceSpent = { d10: 1, d8: 0 };

  suite.section("levelling up");
  const beforeSkill = calculateSkill(character, "Athletics").total;
  character.classes[0].level = 6;
  suite.is("total level rises", totalLevel(character), 8);
  suite.is("proficiency bonus holds at 3 until level 9", calculateProficiencyBonus(character).total, 3);
  suite.is("the hit die pool grows", calculateHitDice(character).find(p => p.die === "d10").total, 6);
  suite.is("spent dice are untouched by the new level",
    calculateHitDice(character).find(p => p.die === "d10").current, 5);

  character.classes[0].level = 7;
  suite.is("level 9 raises the bonus", calculateProficiencyBonus(character).total, 4);
  suite.is("and it flows into skills", calculateSkill(character, "Athletics").total, beforeSkill + 1);
  suite.is("and into attacks",
    calculateAttack(character, character.inventory.find(i => i.name === "Longsword"))
      .toHitSources.find(s => /Proficiency/.test(s.label)).value, 4);
  character.classes[0].level = 5;

  suite.section("multiclassing");
  character.classes.push({ name: "Wizard", level: 1, subclass: null, hitDie: "d6" });
  suite.is("total level counts every class", totalLevel(character), 8);
  suite.is("a new die size appears", calculateHitDice(character).length, 3);
  suite.ok("and shows in the class line", /Wizard 1/.test(classLineFor(character)));
  character.classes.pop();

  suite.section("overriding the bonus");
  character.proficiencyBonusOverride = 7;
  suite.is("the override wins", calculateProficiencyBonus(character).total, 7);
  suite.ok("and is flagged", calculateProficiencyBonus(character).overridden);
  suite.is("the source says so", calculateProficiencyBonus(character).sources[0].label, "Manual override");
  suite.is("it reaches skills", calculateSkill(character, "Athletics").total, 3 + 7);
  character.proficiencyBonusOverride = null;
  suite.is("clearing it returns to derived", calculateProficiencyBonus(character).total, 3);

  suite.section("spending and recovering dice");
  character.hitDiceSpent = {};
  spendHitDieOfSize(character, "d10", 3);
  suite.is("three spent", calculateHitDice(character).find(p => p.die === "d10").current, 2);
  suite.is("the total is unchanged", calculateHitDice(character).find(p => p.die === "d10").total, 5);
  applyRest("long");
  suite.is("a long rest returns half, rounded down",
    calculateHitDice(character).find(p => p.die === "d10").current, 4);
  applyRest("long");
  suite.is("and eventually all of them",
    calculateHitDice(character).find(p => p.die === "d10").current, 5);
  applyRest("long");
  suite.is("never more than the total",
    calculateHitDice(character).find(p => p.die === "d10").current, 5);
  suite.ok("spent count never goes negative", (character.hitDiceSpent.d10 || 0) >= 0);

  suite.section("edge cases");
  const backup = character.classes;
  character.classes = [];
  suite.is("no classes means level zero", totalLevel(character), 0);
  suite.is("and a placeholder line", classLineFor(character), "No class");
  suite.is("and no hit dice", calculateHitDice(character).length, 0);
  suite.runs("the sheet still renders", () => app.renderCombatTab());
  character.classes = backup;

  suite.section("the level up flow");
  const before = app.__modals.length;
  app.openLevelUpModal();
  const html = app.__modals[before].html;
  suite.ok("lists each class to advance", /data-level-class="0"/.test(html));
  suite.ok("shows what the bonus becomes", /proficiency bonus/.test(html));
  suite.ok("offers a class you don't have", /levelup-new-class/.test(html));
  suite.ok("and is honest that features aren't granted", /aren&#39;t granted|aren't granted/.test(html));
};
