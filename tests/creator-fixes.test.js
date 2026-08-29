/* Regressions for the character builder pass: the racial ability score
   increase landing twice, hit points computed from a pre-effect
   Constitution, an uncapped Ability Score Improvement, duplicate fighting
   styles, the three spellings of "Sleight of Hand", Half-Elf's Skill
   Versatility wearing Expertise's semantics, every class being made to pick
   a subclass at 1st level, Custom Content being unreachable, an importer
   that accepted almost anything, and a creator that produced casters with
   no spellcasting at all.

   These assert calculations and returned data, not wiring -- the stub never
   fires a listener, so the modal-dismiss guard, the Cancel button and the
   scroll reset are verified in a real browser instead. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { effectiveAbilityScore, calculateAbilityCheck, calculateSkill, calculateAC,
          buildCharacterFromCreator, creatorStepKeys, subclassChoiceLevel, skillKey,
          spellSlotsAtLevel, spellSlotRecharge, maxPreparedSpells,
          validateImportedCharacter, applyChoiceResolution, choiceOptionsFor,
          grantFeatures, featuresAtLevel, savedCharacters, selectCharacter } = app;

  const POINT_BUY = { Strength: 15, Dexterity: 14, Constitution: 13, Intelligence: 12, Wisdom: 10, Charisma: 8 };

  function creator(overrides) {
    app.creatorState = Object.assign({
      step: 0, started: true, name: "Test", appearance: "", backstory: "",
      race: "Human", subrace: null, charClass: "Fighter", subclass: null, background: "Soldier",
      scores: Object.assign({}, POINT_BUY),
      raceSkillChoices: [], classSkillChoices: [], equipment: [],
      choiceAnswers: {}, expandedChoiceOption: {}, customBuild: false
    }, overrides);
    return app.creatorState;
  }

  function build(overrides) {
    creator(overrides);
    return buildCharacterFromCreator();
  }

  /* ---------- H1: the racial increase has one owner ---------- */

  suite.section("racial ability score increases land exactly once");

  const dragonborn = build({ race: "Dragonborn", choiceAnswers: { "Draconic Ancestry": { manual: "Gold" } } });
  suite.is("the stored score is the point-buy score", dragonborn.abilities.STR, 15);
  suite.is("and the sheet shows it with the racial +2, not twice", effectiveAbilityScore(dragonborn, "STR"), 17);
  suite.is("the race's other increase lands once too", effectiveAbilityScore(dragonborn, "CHA"), 9);

  const strengthCheck = calculateAbilityCheck(dragonborn, "STR");
  suite.ok("the breakdown still names where the racial bonus came from",
    strengthCheck.sources.some(s => /Ability Score Increase/.test(s.label)));
  suite.is("and its sources sum to the total",
    strengthCheck.sources.reduce((sum, s) => sum + s.value, 0), strengthCheck.total);

  const human = build({ race: "Human", choiceAnswers: { "Extra Language": { chosen: ["Draconic"] } } });
  suite.is("Human's +1 to everything is applied once",
    ["STR", "DEX", "CON", "INT", "WIS", "CHA"].map(a => effectiveAbilityScore(human, a)),
    [16, 15, 14, 13, 11, 9]);

  const halfElf = build({
    race: "Half-Elf", charClass: "Bard",
    choiceAnswers: {
      "Ability Score Increase": { chosen: ["Dexterity +1", "Constitution +1"] },
      "Extra Language": { chosen: ["Draconic"] }
    }
  });
  suite.is("Half-Elf's fixed +2 lands once", effectiveAbilityScore(halfElf, "CHA"), 10);
  suite.is("and its two chosen +1s land once each",
    [effectiveAbilityScore(halfElf, "DEX"), effectiveAbilityScore(halfElf, "CON")], [15, 14]);

  /* ---------- H1b: hit points read the Constitution the sheet shows ---------- */

  suite.section("max HP agrees with the Constitution on the sheet");

  const hillDwarf = build({
    race: "Dwarf", subrace: "Hill Dwarf",
    scores: { Strength: 14, Dexterity: 13, Constitution: 14, Intelligence: 10, Wisdom: 12, Charisma: 8 }
  });
  suite.is("Hill Dwarf Fighter's Constitution", effectiveAbilityScore(hillDwarf, "CON"), 16);
  suite.is("and its hit points use that, not the pre-racial 14", hillDwarf.baseMaxHP, 13);
  suite.is("current hit points start at the maximum", hillDwarf.hp.current, 13);

  const halfElfBard = build({
    race: "Half-Elf", charClass: "Bard",
    choiceAnswers: { "Ability Score Increase": { chosen: ["Constitution +1", "Dexterity +1"] },
                     "Extra Language": { chosen: ["Draconic"] } }
  });
  // d8 plus the modifier of a Constitution the answered choice raised to 14
  suite.is("a choice-granted +1 counts towards hit points too", halfElfBard.baseMaxHP, 10);

  /* ---------- ASI is capped, other effects are not ---------- */

  suite.section("an Ability Score Improvement can't push a score past 20");

  const capped = build({ race: "Half-Orc", charClass: "Fighter",
    choiceAnswers: { "Fighting Style": { chosen: ["Defense"] } } });
  savedCharacters.push(capped);
  selectCharacter(capped.id);
  suite.is("starts at 17", effectiveAbilityScore(app.character, "STR"), 17);

  [4, 8, 12].forEach(level => {
    app.character.classes[0].level = level;
    grantFeatures(app.character, featuresAtLevel("Fighter", null, level));
    const pending = app.character.pendingChoices.find(p => /Ability Score Improvement/.test(p.featureName));
    applyChoiceResolution(app.character, pending, ["Strength +2"]);
  });
  suite.is("three +2s stop at 20 rather than reaching 23", effectiveAbilityScore(app.character, "STR"), 20);

  const cappedCheck = calculateAbilityCheck(app.character, "STR");
  suite.is("a trimmed increase still sums to the total",
    cappedCheck.sources.reduce((sum, s) => sum + s.value, 0), cappedCheck.total);

  app.character.traits["Feats"].push({ name: "Something Mighty", desc: "Sets a giant's Strength.",
    effects: [{ category: "Ability Score", value: { ability: "STR", amount: 9 } }] });
  suite.is("a feature effect written to exceed 20 still does",
    effectiveAbilityScore(app.character, "STR"), 29);
  app.character.traits["Feats"].pop();

  /* ---------- one fighting style, once ---------- */

  suite.section("a fighting style can't be taken twice");

  app.character.classes[0].subclass = "Champion";
  app.character.classes[0].level = 10;
  const acWithOneDefense = calculateAC(app.character).total;
  grantFeatures(app.character, featuresAtLevel("Fighter", "Champion", 10));
  const secondStyle = app.character.pendingChoices.find(p => p.featureName === "Additional Fighting Style");

  suite.ok("the style already taken is off the list", !choiceOptionsFor(secondStyle).includes("Defense"));
  suite.is("and granting it anyway is refused",
    applyChoiceResolution(app.character, secondStyle, ["Defense"]), false);
  suite.is("so there is still one Defense entry",
    Object.keys(app.character.traits)
      .reduce((all, cat) => all.concat(app.character.traits[cat].map(t => t.name)), [])
      .filter(name => name === "Fighting Style: Defense").length, 1);
  suite.is("and armour class is unchanged", calculateAC(app.character).total, acWithOneDefense);

  applyChoiceResolution(app.character, secondStyle, ["Archery"]);
  suite.ok("a different second style is still allowed",
    app.character.traits["Class Features"].some(t => t.name === "Fighting Style: Archery"));

  /* ---------- H7: one key for Sleight of Hand ---------- */

  suite.section("Sleight of Hand keys the same way everywhere");

  suite.is("skillKey capitalises every word", skillKey("Sleight of Hand"), "SleightOfHand");
  suite.is("and is idempotent", skillKey(skillKey("Sleight of Hand")), "SleightOfHand");
  suite.is("two-word skills without a lower-case word are unaffected", skillKey("Animal Handling"), "AnimalHandling");
  suite.ok("every key it produces is one the ability map knows",
    app.ALL_SKILL_NAMES.every(name => skillKey(name) in app.SKILL_ABILITY_MAP));

  const rogue = build({
    charClass: "Rogue", background: "Criminal",
    classSkillChoices: ["Sleight of Hand", "Stealth", "Acrobatics", "Perception"],
    choiceAnswers: { "Extra Language": { chosen: ["Elvish"] },
                     "Expertise": { chosen: ["Sleight of Hand", "Stealth"] } }
  });
  suite.is("a chosen proficiency lands on the canonical key", rogue.skillProficiency.SleightOfHand, 2);
  suite.ok("and no raw label is left behind", !("Sleight of Hand" in rogue.skillProficiency));
  suite.ok("nor the space-stripped spelling", !("SleightofHand" in rogue.skillProficiency));
  savedCharacters.push(rogue);
  selectCharacter(rogue.id);
  // Dexterity 15 (+2) with proficiency 2 doubled by expertise
  suite.is("so Expertise actually reaches the skill", calculateSkill(rogue, "SleightOfHand").total, 6);

  /* ---------- H8: Skill Versatility grants proficiency, not expertise ---------- */

  suite.section("Half-Elf's Skill Versatility grants new proficiencies");

  const versatile = build({
    race: "Half-Elf", charClass: "Bard", background: "Sage",
    classSkillChoices: ["Deception", "Performance", "Persuasion"],
    choiceAnswers: {
      "Ability Score Increase": { chosen: ["Dexterity +1", "Constitution +1"] },
      "Extra Language": { chosen: ["Draconic"] },
      "Skill Versatility": { chosen: ["Athletics", "Sleight of Hand"] }
    }
  });
  suite.is("the picks arrive as proficiency, not expertise",
    [versatile.skillProficiency.Athletics, versatile.skillProficiency.SleightOfHand], [1, 1]);
  suite.ok("skills already known are still known", versatile.skillProficiency.Arcana === 1);

  creator({ race: "Half-Elf", charClass: "Bard", background: "Sage",
    classSkillChoices: ["Deception", "Performance", "Persuasion"] });
  const versatilityChoice = app.creatorSkillChoices().find(p => p.featureName === "Skill Versatility");
  const versatilityOptions = app.creatorChoiceOptionsFor(versatilityChoice);
  suite.ok("the wizard offers skills you don't have", versatilityOptions.includes("Athletics"));
  suite.ok("and not ones you do", !versatilityOptions.includes("Arcana"));

  const expertiseChoice = { kind: "skill", featureName: "Expertise", count: 2, traitCategory: "Class Features" };
  creator({ charClass: "Rogue", background: "Criminal", classSkillChoices: ["Stealth", "Acrobatics"] });
  suite.ok("Expertise still offers only skills you have",
    app.creatorChoiceOptionsFor(expertiseChoice).every(name => ["Deception", "Stealth", "Acrobatics"].includes(name)));

  /* ---------- the subclass step only where the class picks at 1st level ---------- */

  suite.section("only a class that chooses a subclass at 1st level gets the step");

  suite.is("the SRD classes that choose at 1st level",
    app.SRD_CLASSES.filter(c => subclassChoiceLevel(c.name) === 1).map(c => c.name),
    ["Cleric", "Sorcerer", "Warlock"]);
  suite.is("Fighter chooses at 3rd", subclassChoiceLevel("Fighter"), 3);
  suite.is("Wizard at 2nd", subclassChoiceLevel("Wizard"), 2);

  creator({ charClass: "Fighter" });
  suite.ok("so a Fighter gets no subclass step", !creatorStepKeys().includes("subclass"));
  creator({ charClass: "Cleric" });
  suite.ok("and a Cleric does", creatorStepKeys().includes("subclass"));

  creator({ charClass: "Wizard" });
  const wizardStep = app.classStepHtml(2);
  suite.ok("the class step spells out what arrives at 1st level", wizardStep.includes("Arcane Recovery"));
  /* Later Levels is a two-column list now, not a chip row -- the level and
     the feature name are separate cells, so there is no "Lv 20 · " string to
     look for any more. Same guarantee, expressed in the markup that replaced
     the chips. */
  suite.ok("and labels a level-20 feature with its level rather than listing it flat",
    /<span class="level-list-level">20<\/span>\s*<span class="level-list-name">Signature Spells<\/span>/.test(wizardStep));
  suite.ok("it also says when the subclass is chosen", wizardStep.includes("Chosen at level 2"));

  creator({ charClass: "Cleric", subclass: "Life Domain" });
  const clericSubclassStep = app.subclassStepHtml(3);
  suite.ok("the subclass step does the same",
    /<span class="level-list-level">6<\/span>\s*<span class="level-list-name">Blessed Healer<\/span>/.test(clericSubclassStep));

  suite.ok("no step claims a total that changes as you pick", !/Step \d+ of/.test(wizardStep));

  /* ---------- Custom Content reaches the builder ---------- */

  suite.section("custom races and classes can be built with");

  app.customContent.races.push({ id: 900, name: "Tester Folk", skillChoice: null, subraces: [],
    features: [{ name: "Testy", desc: "A test trait.",
      effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] }] });
  app.customContent.classes.push({ id: 901, name: "Tester Class", description: "A test class.",
    hitDie: "d10", mainAbility: "Strength", saves: ["Strength"], armorProf: "None",
    weaponProf: "Simple weapons", skillChoices: { count: 1, options: ["Athletics"] },
    features: [{ level: 1, name: "Test Feature", desc: "Does a test." },
               { level: 5, name: "Later Feature", desc: "Later." }],
    subclasses: [] });

  creator({ race: "Tester Folk", charClass: "Tester Class" });
  suite.ok("a custom race is listed on the Race step", app.raceStepHtml(1).includes("Tester Folk"));
  suite.ok("a custom class is listed on the Class step", app.classStepHtml(2).includes("Tester Class"));
  suite.ok("a custom race with no subraces doesn't ask for one", !app.raceStepHtml(1).includes("Subrace"));

  const custom = build({ race: "Tester Folk", charClass: "Tester Class", classSkillChoices: ["Athletics"] });
  suite.is("and the build resolves both", [custom.race, custom.classes[0].name], ["Tester Folk", "Tester Class"]);
  suite.is("its hit die comes from the custom class", custom.classes[0].hitDie, "d10");
  suite.is("its racial effect applies once", effectiveAbilityScore(custom, "STR"), 17);
  suite.is("its 1st-level features are granted", custom.traits["Class Features"].map(f => f.name), ["Test Feature"]);
  suite.is("and its later ones are not", custom.baseMaxHP, 11);

  // the Race and Class steps now render author-written text, so they need the
  // same escaping the Subclass step already had
  const HOSTILE = '<img src=x onerror=alert(1)>';
  app.customContent.races[0].name = HOSTILE;
  app.customContent.races[0].features[0] = { name: HOSTILE, desc: HOSTILE };
  app.customContent.classes[0].name = HOSTILE;
  app.customContent.classes[0].description = HOSTILE;
  app.customContent.classes[0].weaponProf = HOSTILE;
  app.customContent.classes[0].features = [{ level: 1, name: HOSTILE, desc: HOSTILE },
                                           { level: 7, name: HOSTILE, desc: HOSTILE }];
  creator({ race: HOSTILE, charClass: HOSTILE });
  suite.ok("the race step escapes custom content", !app.raceStepHtml(1).includes("<img src=x"));
  suite.ok("the class step does too", !app.classStepHtml(2).includes("<img src=x"));

  app.customContent.races.pop();
  app.customContent.classes.pop();

  /* ---------- C2: a creator-built caster actually casts ---------- */

  suite.section("the builder produces working spellcasting");

  const wizard = build({
    charClass: "Wizard", background: "Sage", classSkillChoices: ["Arcana", "History"],
    scores: { Strength: 8, Dexterity: 14, Constitution: 14, Intelligence: 15, Wisdom: 12, Charisma: 10 },
    choiceAnswers: { "Extra Language": { chosen: ["Draconic"] } }
  });
  suite.is("the caster and its ability", wizard.spellcasting.classes, [{ name: "Wizard", ability: "INT" }]);
  suite.is("two 1st-level slots, back on a long rest", wizard.spellSlots,
    { 1: { current: 2, max: 2, recharge: { on: "LR", amount: "all" } } });
  // Intelligence 16 with the Human +1: modifier 3, plus one wizard level
  suite.is("prepared count from the ability the sheet shows", wizard.maxPreparedByClass, { Wizard: 4 });
  savedCharacters.push(wizard);
  selectCharacter(wizard.id);
  suite.ok("so the Spells tab has stat boxes to draw",
    app.renderSpellsTab().includes("Spell Attack"));
  suite.ok("and the Add Spell form has a class to attribute a spell to",
    app.spellFormFieldsHtml(null, true).includes(">Wizard<"));

  const warlock = build({ charClass: "Warlock", background: "Sage",
    classSkillChoices: ["Arcana", "Deception"],
    choiceAnswers: { "Extra Language": { chosen: ["Draconic"] } } });
  suite.is("a Warlock's one pact slot comes back on a short rest", warlock.spellSlots,
    { 1: { current: 1, max: 1, recharge: { on: "SR", amount: "all" } } });

  const paladin = build({ charClass: "Paladin", background: "Acolyte",
    classSkillChoices: ["Athletics", "Persuasion"],
    choiceAnswers: { "Extra Language": { chosen: ["Draconic"] } } });
  suite.is("a half caster gets nothing at 1st level", paladin.spellSlots, {});
  suite.is("and no spellcasting entry either", paladin.spellcasting.classes, []);

  const fighter = build({ choiceAnswers: { "Extra Language": { chosen: ["Draconic"] },
                                           "Fighting Style": { chosen: ["Defense"] } } });
  suite.is("a non-caster is left alone", fighter.spellcasting.classes, []);

  suite.section("the slot tables themselves");
  suite.is("full caster at 5th", spellSlotsAtLevel(app.SRD_CLASSES.find(c => c.name === "Wizard").spellcasting, 5),
    { 1: 4, 2: 3, 3: 2 });
  suite.is("half caster at 2nd", spellSlotsAtLevel(app.SRD_CLASSES.find(c => c.name === "Paladin").spellcasting, 2),
    { 1: 2 });
  suite.is("pact magic at 11th", spellSlotsAtLevel(app.SRD_CLASSES.find(c => c.name === "Warlock").spellcasting, 11),
    { 5: 3 });
  suite.is("pact slots recharge short", spellSlotRecharge(app.SRD_CLASSES.find(c => c.name === "Warlock").spellcasting).on, "SR");
  suite.is("a prepared caster's count scales with level",
    maxPreparedSpells(app.SRD_CLASSES.find(c => c.name === "Cleric").spellcasting, 5, 3), 8);
  suite.is("a known caster's doesn't",
    maxPreparedSpells(app.SRD_CLASSES.find(c => c.name === "Sorcerer").spellcasting, 5, 3), 2);
  suite.is("nothing at all before a class starts casting",
    maxPreparedSpells(app.SRD_CLASSES.find(c => c.name === "Ranger").spellcasting, 1, 3), 0);

  /* ---------- import is a real shape check ---------- */

  suite.section("import rejects what the app can't render");

  const exported = JSON.parse(JSON.stringify(wizard));
  suite.is("a real export is accepted", validateImportedCharacter(exported), null);
  suite.ok("the old bar (a name and an abilities object) is not enough",
    !!validateImportedCharacter({ name: "x", abilities: {} }));
  suite.ok("nor is a string", !!validateImportedCharacter("nope"));
  suite.ok("an unnamed character is refused",
    !!validateImportedCharacter(Object.assign({}, exported, { name: "  " })));
  suite.ok("a missing ability score is refused",
    !!validateImportedCharacter(Object.assign({}, exported, { abilities: { STR: 10 } })));
  suite.ok("classes that aren't a list are refused",
    !!validateImportedCharacter(Object.assign({}, exported, { classes: "Wizard" })));
  suite.ok("a class with no level is refused",
    !!validateImportedCharacter(Object.assign({}, exported, { classes: [{ name: "Wizard" }] })));
  suite.ok("missing traits are refused",
    !!validateImportedCharacter(Object.assign({}, exported, { traits: undefined })));

  // the two crashes a shared file could otherwise reach
  const orphanSpell = JSON.parse(JSON.stringify(exported));
  orphanSpell.spells.push({ id: 9, name: "Eldritch Blast", level: 0, classSource: "Warlock",
    castingTime: "A", attackRoll: true, desc: "" });
  suite.ok("an attack spell whose class this character doesn't cast is refused",
    !!validateImportedCharacter(orphanSpell));

  const brokenSlots = JSON.parse(JSON.stringify(exported));
  brokenSlots.spellSlots["1"] = { current: "two" };
  suite.ok("malformed spell slots are refused", !!validateImportedCharacter(brokenSlots));

  const brokenSpell = JSON.parse(JSON.stringify(exported));
  brokenSpell.spells.push({ id: 9, name: "Nameless", level: "one" });
  suite.ok("a spell without a numeric level is refused", !!validateImportedCharacter(brokenSpell));
};
