/* Classes and levels. The point of the model is that proficiency bonus, hit
   dice and the line under the character's name are all derived from one list,
   so levelling up cannot leave two numbers disagreeing. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { character, totalLevel, proficiencyBonusForLevel, classLineFor,
          calculateHitDice, calculateProficiencyBonus, spendHitDieOfSize,
          calculateSkill, calculateAttack, applyRest, calculateMaxHP } = app;

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
  // level 1 to 2 is a level that actually grants something
  character.classes = [{ name: "Fighter", level: 1, subclass: "Champion", hitDie: "d10" }];
  app.openLevelUpModal();
  const html = app.levelUpHtml();
  suite.ok("lists each class to advance", /data-levelup-target="0"/.test(html));
  suite.ok("shows the level as a before and after", /Level 1 → Level 2/.test(html));
  suite.ok("and the hit dice the same way", /Hit dice/.test(html) && /→/.test(html));
  suite.ok("offers a class you don't have", /data-levelup-target="new"/.test(html));
  suite.ok("offers the three hit point choices",
    /data-hp-mode="average"/.test(html) && /data-hp-mode="roll"/.test(html) && /data-hp-mode="manual"/.test(html));
  suite.ok("requires a confirmation", /id="levelup-confirm"/.test(html));
  suite.ok("lists the features the level grants", /Action Surge/.test(html));
  suite.ok("hides rows that don't change",
    !/unchanged/.test(html), "still says 'unchanged' somewhere");

  suite.section("features are keyed to the level they arrive at");
  suite.is("fighter level 1", app.featuresAtLevel("Fighter", "Champion", 1).map(f => f.name),
    ["Fighting Style", "Second Wind"]);
  suite.is("fighter level 2", app.featuresAtLevel("Fighter", "Champion", 2).map(f => f.name), ["Action Surge"]);
  suite.is("the subclass contributes at its own level",
    app.featuresAtLevel("Fighter", "Champion", 3).map(f => f.name), ["Improved Critical"]);
  suite.is("a different subclass gives something else",
    app.featuresAtLevel("Fighter", "Battle Master", 3).map(f => f.name), ["Combat Superiority"]);
  suite.is("a level with nothing gives nothing", app.featuresAtLevel("Wizard", null, 4), []);
  suite.is("an unknown class gives nothing", app.featuresAtLevel("Nonesuch", null, 1), []);

  suite.section("the average is the fixed 5e value");
  suite.is("d6", app.averageHitPoints("d6"), 4);
  suite.is("d8", app.averageHitPoints("d8"), 5);
  suite.is("d10", app.averageHitPoints("d10"), 6);
  suite.is("d12", app.averageHitPoints("d12"), 7);

  suite.section("levelling actually grants hit points");
  character.classes = [{ name: "Fighter", level: 1, subclass: "Champion", hitDie: "d10" }];
  character.hitDiceSpent = {};
  character.abilities.CON = 14;                       // +2
  const beforeMax = calculateMaxHP(character).total;
  const beforeCurrent = character.hp.current;
  const beforeLevel = totalLevel(character);

  app.openLevelUpModal();
  app.levelUpState.target = 0;
  app.levelUpState.hpMode = "average";
  app.applyLevelUp();

  suite.is("the class level rises", totalLevel(character), beforeLevel + 1);
  suite.is("maximum hit points rise by the average plus Constitution",
    calculateMaxHP(character).total, beforeMax + 6 + 2);
  suite.is("current hit points rise by the same", character.hp.current, beforeCurrent + 8);
  suite.is("and a hit die comes with it",
    calculateHitDice(character).find(p => p.die === "d10").total, 2);
  suite.ok("the level's features are granted",
    character.traits["Class Features"].some(f => f.name === "Action Surge"),
    "got " + JSON.stringify((character.traits["Class Features"] || []).map(f => f.name)));

  const featureCount = character.traits["Class Features"].length;
  character.classes[0].level = 1;
  app.openLevelUpModal();
  app.levelUpState.target = 0;
  app.levelUpState.hpMode = "average";
  app.applyLevelUp();
  suite.is("granting the same feature twice does not duplicate it",
    character.traits["Class Features"].length, featureCount);

  suite.section("manual is not capped at the die");
  app.openLevelUpModal();
  app.levelUpState.target = 0;
  app.levelUpState.hpMode = "manual";
  app.levelUpState.hpManual = 10;                     // above a d10's average, allowed
  const beforeManual = calculateMaxHP(character).total;
  app.applyLevelUp();
  suite.is("takes the number given", calculateMaxHP(character).total, beforeManual + 10 + 2);

  suite.section("a level never reduces your maximum");
  character.abilities.CON = 1;                        // -5, worse than a rolled 1
  app.openLevelUpModal();
  app.levelUpState.target = 0;
  app.levelUpState.hpMode = "manual";
  app.levelUpState.hpManual = 1;
  const beforeFloor = calculateMaxHP(character).total;
  app.applyLevelUp();
  suite.ok("it floors at one rather than going backwards",
    calculateMaxHP(character).total >= beforeFloor + 1,
    "went from " + beforeFloor + " to " + calculateMaxHP(character).total);
  character.abilities.CON = 14;

  suite.section("rolling has to happen before confirming");
  app.openLevelUpModal();
  app.levelUpState.target = 0;
  app.levelUpState.hpMode = "roll";
  app.levelUpState.hpRolled = null;
  const beforeUnrolled = totalLevel(character);
  app.applyLevelUp();
  suite.is("nothing happens without a roll", totalLevel(character), beforeUnrolled);
  app.levelUpState.hpRolled = 7;
  app.applyLevelUp();
  suite.is("and then it does", totalLevel(character), beforeUnrolled + 1);

  suite.section("multiclassing through the flow");
  app.openLevelUpModal();
  app.levelUpState.target = "new";
  app.levelUpState.newClass = "Wizard";
  app.levelUpState.hpMode = "average";
  app.applyLevelUp();
  suite.ok("the new class is added", character.classes.some(c => c.name === "Wizard"));
  suite.is("at level one", character.classes.find(c => c.name === "Wizard").level, 1);
  suite.ok("with its own hit die", calculateHitDice(character).some(p => p.die === "d6"));
  const beforeDuplicate = character.classes.length;
  app.openLevelUpModal();
  app.levelUpState.target = "new";
  app.levelUpState.newClass = "Wizard";
  app.applyLevelUp();
  suite.is("taking the same class twice is refused", character.classes.length, beforeDuplicate);
};
