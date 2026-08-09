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
    weaponProficiency, itemType, weaponList
  } = app;

  const item = name => character.inventory.find(i => i.name === name);
  const sums = result => result.sources.reduce((total, source) => total + source.value, 0);

  suite.section("armour class");
  suite.is("chain shirt base plus capped Dex plus cloak", calculateAC(character).total, 16);
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
  suite.is("unarmoured falls back to ten plus Dex", calculateAC(character).total, 13);
  shirt.category = "Worn";
  shirt.armour = { base: 18, kind: "heavy", dexCap: 0 };
  suite.is("heavy armour allows no Dex", calculateAC(character).total, 19);
  shirt.armour = { base: 13, kind: "medium", dexCap: 2 };

  character.inventory.push({ id: 900, name: "Shield", category: "Worn", weight: 6, qty: 1,
    armour: { base: 2, kind: "shield", dexCap: null } });
  suite.is("shields stack on worn armour", calculateAC(character).total, 18);
  character.inventory = character.inventory.filter(i => i.id !== 900);

  suite.section("abilities and skills");
  suite.is("ability check equals the modifier", calculateAbilityCheck(character, "STR").total, 3);
  suite.is("skill adds proficiency", calculateSkill(character, "Athletics").total, 6);
  suite.is("expertise doubles it", calculateSkill(character, "Stealth").total, 8);
  suite.is("skill breakdown sums", sums(calculateSkill(character, "Stealth")), 8);
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
  suite.is("to hit totals correctly", longsword.toHitTotal, 8);
  suite.is("to hit breakdown sums", longsword.toHitSources.reduce((t, s) => t + s.value, 0), 8);
  suite.ok("naming the proficiency requirement",
    longsword.toHitSources.some(s => s.label === "Proficiency (Martial)"));
  suite.ok("an effect reaches attack rolls", longsword.toHitSources.some(s => s.label === "Bless"));

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
  suite.is("spell attack", calculateSpellAttack(character, "INT").total, 3);
  suite.is("spell save DC", calculateSpellDC(character, "INT").total, 11);
  suite.is("DC breakdown sums", sums(calculateSpellDC(character, "INT")), 11);

  suite.section("proficiency bonus is editable and flows onward");
  const originalBonus = character.proficiencyBonus;
  character.proficiencyBonus = 6;
  suite.is("the base is what the total starts from", calculateProficiencyBonus(character).total, 6);
  suite.is("it reaches proficient skills", calculateSkill(character, "Athletics").total, 3 + 6);
  suite.is("expertise doubles the new value", calculateSkill(character, "Stealth").total, 2 + 12);
  suite.is("it reaches saves", calculateSavingThrow(character, "STR").total, 3 + 6);
  suite.is("it reaches attacks", calculateAttack(character, item("Longsword")).toHitTotal, 3 + 6 + 1 + 1);
  suite.is("and spell DCs", calculateSpellDC(character, "INT").total, 8 + 6 + 0);
  character.proficiencyBonus = originalBonus;

  suite.section("item classification");
  suite.is("weapon", itemType(item("Longsword")), "weapon");
  suite.is("armour", itemType(item("Chain Shirt")), "armour");
  suite.is("gear", itemType(item("Bag of Holding")), "gear");
  suite.ok("only drawn weapons are attacks",
    weaponList(character).every(w => character.categoryRules[w.category].providesAttacks));
};
