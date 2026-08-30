/* The calculation layer: every stat that explains itself through a sources
   array. These are the numbers a player trusts, so each one is checked both
   for its total and for the breakdown adding up to that total. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const {
    character, calculateAC, calculateAbilityCheck, calculateSkill, calculateSavingThrow,
    calculateInitiative, calculateSpeed, calculateMaxHP, calculatePassivePerception,
    calculateProficiencyBonus, calculateAttack, calculateSpellAttack, calculateSpellDC,
    abilityModifier, effectiveAbilityScore, formatModifier, hasCondition,
    weaponProficiency, itemType, weaponList,
    statBonusDice, savingThrowBonusDice, spellAttackBonusDice, effectDice, withBonusDice,
    bonusLabel, sheetBonusLabel, diceSpan
  } = app;

  const item = name => character.inventory.find(i => i.name === name);
  const sums = result => result.sources.reduce((total, source) => total + source.value, 0);

  suite.section("armour class");
  suite.is("chain shirt, capped Dex, cloak and Fighting Style", calculateAC(character).total, 17);
  suite.is("breakdown sums to the total", sums(calculateAC(character)), calculateAC(character).total);
  suite.is("armour contributes its base", calculateAC(character).sources[0].label, "Chain Shirt");

  character.abilities.DEX = 20;
  suite.is("Dex above the cap is clipped", calculateAC(character).sources[1].value, 2);
  suite.ok("and the label says so", /capped at 2/.test(calculateAC(character).sources[1].label));
  character.abilities.DEX = 8;
  suite.is("a Dex penalty is not clipped away", calculateAC(character).sources[1].value, -1);
  character.abilities.DEX = 14;

  const shirt = item("Chain Shirt");
  shirt.category = "Camp Storage";
  suite.is("unarmoured falls back to ten plus Dex", calculateAC(character).total, 14);
  shirt.category = "Worn";
  shirt.armour = { base: 18, kind: "heavy", dexCap: 0 };
  suite.is("heavy armour allows no Dex", calculateAC(character).total, 20);
  shirt.armour = { base: 13, kind: "medium", dexCap: 2 };

  character.inventory.push({ id: 900, name: "Shield", category: "Worn", weight: 6, qty: 1,
    armour: { base: 2, kind: "shield", dexCap: null } });
  suite.is("shields stack on worn armour", calculateAC(character).total, 19);
  character.inventory = character.inventory.filter(i => i.id !== 900);

  suite.section("abilities and skills");
  suite.is("ability check equals the modifier", calculateAbilityCheck(character, "STR").total, 3);
  suite.is("skill adds proficiency", calculateSkill(character, "Athletics").total, 6);
  character.skillProficiency.Stealth = 2;             // nothing in this build grants expertise
  suite.is("expertise doubles the proficiency bonus", calculateSkill(character, "Stealth").total, 2 + 6);
  suite.is("skill breakdown sums", sums(calculateSkill(character, "Stealth")), 8);
  delete character.skillProficiency.Stealth;
  suite.is("passive perception is ten plus the skill", calculatePassivePerception(character).total,
    10 + calculateSkill(character, "Perception").total);

  character.activeEffects.push({ id: 900, name: "Strength Buff", concentration: false,
    duration: { type: "Permanent", rounds: null },
    effects: [{ category: "Ability Score", value: { ability: "STR", amount: 3 } }] });
  suite.is("an ability buff reaches the score", effectiveAbilityScore(character, "STR"), 19);
  suite.is("and reaches skills keyed to it", calculateSkill(character, "Athletics").total, 7);
  suite.ok("appearing as its own line, not folded away",
    calculateSkill(character, "Athletics").sources.some(s => /Strength Buff/.test(s.label)));
  suite.is("skill breakdown still sums", sums(calculateSkill(character, "Athletics")), 7);
  character.activeEffects = character.activeEffects.filter(g => g.id !== 900);

  suite.section("saving throws");
  suite.is("proficient save", calculateSavingThrow(character, "STR").total, 6);
  suite.is("non-proficient save", calculateSavingThrow(character, "DEX").total, 2);
  character.savingThrowOverride.DEX = 9;
  suite.is("an override replaces the calculation", calculateSavingThrow(character, "DEX").total, 9);
  suite.ok("and is flagged as overridden", calculateSavingThrow(character, "DEX").overridden);
  delete character.savingThrowOverride.DEX;

  suite.section("conditions drive the numbers");
  suite.ok("prone is detected", hasCondition(character, "Prone"));
  const speedBefore = calculateSpeed(character).total;
  character.activeEffects.push({ id: 901, name: "Grappled", concentration: false,
    duration: { type: "Permanent", rounds: null },
    effects: [{ category: "Condition", value: { condition: "Grappled" } }] });
  suite.is("grappled zeroes speed", calculateSpeed(character).total, 0);
  character.activeEffects = character.activeEffects.filter(g => g.id !== 901);
  suite.is("and releases it again", calculateSpeed(character).total, speedBefore);

  suite.section("attacks");
  const longsword = calculateAttack(character, item("Longsword"));
  /* Bless is on this sheet and contributes nothing to the flat total, because
     it is 1d4 -- a thing you roll, not a number you add. It still appears in
     the breakdown, worth zero, so the player can see it is there. */
  suite.is("to hit totals correctly", longsword.toHitTotal, 7);
  suite.is("to hit breakdown sums", longsword.toHitSources.reduce((t, s) => t + s.value, 0), 7);
  suite.ok("naming the proficiency requirement",
    longsword.toHitSources.some(s => s.label === "Proficiency (Martial)"));
  suite.ok("an effect reaches attack rolls", longsword.toHitSources.some(s => s.label === "Bless"));

  suite.section("a dice bonus rides in the roll, not the total");
  suite.is("Bless offers a d4 to attack rolls", statBonusDice(character, "Attack Rolls"), ["1d4"]);
  suite.is("and to every saving throw, not a chosen one",
    ["STR", "DEX", "CON", "INT", "WIS", "CHA"].map(a => savingThrowBonusDice(character, a).join("")),
    ["1d4", "1d4", "1d4", "1d4", "1d4", "1d4"]);
  suite.is("which is what the notation carries",
    withBonusDice("1d20" + formatModifier(longsword.toHitTotal), statBonusDice(character, "Attack Rolls")),
    "1d20+7+1d4");
  suite.is("a spell attack is an attack roll too",
    spellAttackBonusDice(character).indexOf("1d4") !== -1, true);
  suite.is("a flat bonus is still a flat bonus",
    effectDice({ value: { stat: "AC", amount: 2 } }), null);
  suite.is("and nonsense in the amount is not dice",
    effectDice({ value: { stat: "AC", amount: "lots" } }), null);
  suite.is("nothing to add means nothing added", withBonusDice("1d20+7", []), "1d20+7");

  suite.section("what the bonus comes to");
  /* "+7" is a lie while Bless is up and "+7+1d4" is arithmetic homework. */
  suite.is("a d4 on a +7 lands between 8 and 11", bonusLabel(7, ["1d4"]), "+8~11");
  suite.is("two dice stack their spans", bonusLabel(0, ["1d4", "2d6"]), "+3~16");
  suite.is("no dice is just the modifier", bonusLabel(7, []), "+7");
  suite.is("and a negative one still reads right", bonusLabel(-1, ["1d4"]), "+0~3");
  suite.is("the span of a bare die counts as one", JSON.stringify(diceSpan(["d6"])), JSON.stringify({ min: 1, max: 6 }));
  suite.is("nonsense contributes nothing", JSON.stringify(diceSpan(["wat"])), JSON.stringify({ min: 0, max: 0 }));

  /* The sheet's own display is a setting; the roll window's is not. */
  app.settings.showBonusRange = false;
  suite.is("off, the sheet keeps its steady number", sheetBonusLabel(7, ["1d4"]), "+7");
  app.settings.showBonusRange = true;
  suite.is("on, the sheet says the range", sheetBonusLabel(7, ["1d4"]), "+8~11");
  suite.is("and still just the number when nothing is up", sheetBonusLabel(7, []), "+7");
  app.settings.showBonusRange = false;

  suite.section("stacked damage");
  const fang = calculateAttack(character, item("Serpent's Fang"));
  suite.is("two damage parts", fang.damage.length, 2);
  suite.is("combined notation", fang.damageNotation, "1d4+4 + 1d6");
  suite.is("the rider gets no ability modifier", fang.damage[1].bonusTotal, 0);
  suite.is("the magic bonus lands once, not per type",
    fang.damage.filter(d => d.sources.some(s => /magic/.test(s.label))).length, 1);

  suite.section("weapon properties");
  suite.is("finesse takes the better ability", fang.finesse, "STR");
  suite.ok("and says so in the breakdown", /Finesse/.test(fang.toHitSources[0].label));
  const sword = item("Longsword");
  suite.is("versatile one handed", calculateAttack(character, sword).damageNotation, "1d8+3");
  sword.twoHanded = true;
  suite.is("versatile two handed", calculateAttack(character, sword).damageNotation, "1d10+3");
  sword.twoHanded = false;

  suite.section("proficiency");
  suite.ok("held by category", weaponProficiency(character, sword).proficient);
  suite.ok("not held", !weaponProficiency(character, { name: "X", proficiencyRequired: "Exotic" }).proficient);
  suite.ok("a weapon requiring nothing is always proficient", weaponProficiency(character, {}).proficient);
  sword.proficientOverride = false;
  suite.ok("an override removes it", !weaponProficiency(character, sword).proficient);
  suite.ok("and is flagged", weaponProficiency(character, sword).overridden);
  delete sword.proficientOverride;

  suite.section("spellcasting");
  suite.is("spell attack", calculateSpellAttack(character, "INT").total, 4);
  suite.is("spell save DC", calculateSpellDC(character, "INT").total, 12);
  suite.is("DC breakdown sums", sums(calculateSpellDC(character, "INT")), 12);

  suite.section("proficiency bonus is derived, and overridable");
  suite.is("level 8 gives +3", calculateProficiencyBonus(character).total, 3);
  suite.is("and says where it came from", calculateProficiencyBonus(character).sources[0].label, "Level 8");

  const originalBonus = character.proficiencyBonusOverride;
  character.proficiencyBonusOverride = 6;
  suite.ok("an override is flagged", calculateProficiencyBonus(character).overridden);
  suite.is("the base is what the total starts from", calculateProficiencyBonus(character).total, 6);
  suite.is("it reaches proficient skills", calculateSkill(character, "Athletics").total, 3 + 6);
  character.skillProficiency.Stealth = 2;
  suite.is("expertise doubles the new value", calculateSkill(character, "Stealth").total, 2 + 12);
  delete character.skillProficiency.Stealth;
  suite.is("it reaches saves", calculateSavingThrow(character, "STR").total, 3 + 6);
  // +1 from the Ring of Precision; Bless is dice and adds nothing flat
  suite.is("it reaches attacks", calculateAttack(character, item("Longsword")).toHitTotal, 3 + 6 + 1);
  suite.is("and spell DCs", calculateSpellDC(character, "INT").total, 8 + 6 + 1);
  character.proficiencyBonusOverride = originalBonus;

  suite.section("item classification");
  suite.is("weapon", itemType(item("Longsword")), "weapon");
  suite.is("armour", itemType(item("Chain Shirt")), "armour");
  suite.is("gear", itemType(item("Bag of Holding")), "gear");
  suite.ok("only drawn weapons are attacks",
    weaponList(character).every(w => character.categoryRules[w.category].providesAttacks));
};
