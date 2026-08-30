/* Casting: choosing a level, reading what that changes, and working out who a
   spell is allowed to reach. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { spellUpcastText, spellTargetLimit, spellTakesTargets, spellIsConcentration,
          castableSpellLevels, parsePartyMessage, partyMessage, character } = app;

  const spell = (name, over) => Object.assign({ id: "s-1", name: name, level: 1, prepared: true }, over || {});

  suite.section("what a bigger slot actually does");
  const bless = spellUpcastText(spell("Bless"));
  suite.ok("Bless says what upcasting gives you", /additional creature/i.test(bless || ""));
  suite.ok("and it is the SRD's own words, not a summary",
    (bless || "").indexOf("for each slot level above 1st") !== -1);
  suite.ok("Cure Wounds heals more from a bigger slot",
    /healing increases by 1d8/i.test(spellUpcastText(spell("Cure Wounds")) || ""));
  /* 116 of the 169 spells gain nothing, and those are the ones that earn the
     yellow banner rather than a preview. */
  suite.is("a spell that gains nothing has nothing to show",
    spellUpcastText(spell("Detect Magic")), null);
  suite.is("and a spell we have never heard of has nothing either",
    spellUpcastText(spell("Sigrid's Marvellous Nonsense")), null);

  suite.section("how many it may reach");
  /* Read out of the spell's own sentence, because there is no field for it. */
  suite.is("Bless reaches three at its own level", spellTargetLimit(spell("Bless"), 1), 3);
  suite.is("four with a second-level slot", spellTargetLimit(spell("Bless"), 2), 4);
  suite.is("six with a fourth", spellTargetLimit(spell("Bless"), 4), 6);
  suite.is("Cure Wounds reaches one", spellTargetLimit(spell("Cure Wounds"), 1), 1);
  suite.is("and upcasting Cure Wounds does not add creatures",
    spellTargetLimit(spell("Cure Wounds"), 3), 1);

  /* Null means "no idea", and no idea means no warning: a limit we are unsure
     of is worse than no limit, because a warning that fires wrongly teaches
     people to ignore warnings. */
  suite.is("a spell whose text names no count gets no limit",
    spellTargetLimit(spell("Sigrid's Marvellous Nonsense"), 1), null);

  suite.section("whether to ask who it lands on");
  suite.is("a buff wants a target", spellTakesTargets(spell("Bless")), true);
  suite.is("so does a heal", spellTakesTargets(spell("Cure Wounds")), true);
  suite.is("an attack roll already has one",
    spellTakesTargets(spell("Fire Bolt", { attackRoll: true })), false);
  suite.is("and a spell on yourself has nobody else to reach",
    spellTakesTargets(spell("Mage Armor")) === false || spellTakesTargets(spell("Shield")) === false, true);

  suite.section("concentration");
  suite.is("Bless is a concentration spell", spellIsConcentration(spell("Bless")), true);
  suite.is("Cure Wounds is not", spellIsConcentration(spell("Cure Wounds")), false);

  suite.section("which levels are on offer");
  const levels = castableSpellLevels(spell("Bless"));
  suite.is("starts at one, not at the spell's own level", levels[0], 1);
  suite.ok("and runs to the highest slot this sheet has",
    levels[levels.length - 1] >= Math.max.apply(null, Object.keys(character.spellSlots).map(Number)));

  /* ---------------- healing ---------------- */

  suite.section("a heal is a spell with a number, not a spell with a note");
  const { castHealNotation, spellHealUpcastDie, suggestedSpellHealing, spellHealingAddsModifier,
          applyHp, applyCastHealing, deviceId, calculateMaxHP } = app;
  const cure = character.spells.find(s => s.name === "Cure Wounds");
  suite.ok("the demo cleric's Cure Wounds carries dice", !!cure.heal);
  suite.is("cast at its own level it is the dice plus the caster's modifier",
    castHealNotation(cure, 1), "1d8 + " + (app.abilityModifier(app.effectiveAbilityScore(character, "WIS"))));
  suite.is("a second-level slot adds the spell's own upcast die",
    castHealNotation(cure, 2).indexOf("1d8 + 1d8"), 0);
  suite.is("a fourth-level slot adds three of them",
    castHealNotation(cure, 4).indexOf("1d8 + 3d8"), 0);
  suite.is("the upcast die is read out of the spell's own sentence",
    spellHealUpcastDie(cure), "1d8");
  suite.is("a spell that heals nothing has no notation",
    castHealNotation({ name: "Bless", level: 1 }, 3), null);

  suite.section("reading healing out of a description, to pre-fill a field");
  suite.is("dice after the words", suggestedSpellHealing("regains a number of hit points equal to 1d8 + your spellcasting ability modifier"), "1d8");
  suite.is("dice before them", suggestedSpellHealing("the target heals 2d4 hit points"), "2d4");
  suite.is("and damage is not healing", suggestedSpellHealing("takes 8d6 fire damage"), "");
  suite.is("the modifier is read too",
    spellHealingAddsModifier("regains hit points equal to 1d4 + your spellcasting ability modifier"), true);
  suite.is("and not invented where the text doesn't say so",
    spellHealingAddsModifier("the target heals 2d4 hit points"), false);

  suite.section("casting it actually moves hit points");
  const most = calculateMaxHP(character).total;
  character.hp.current = 1; character.hp.temp = 0;
  applyCastHealing(cure, 1, [deviceId()]);
  suite.ok("your own hit points went up when you were the target", character.hp.current > 1);
  const afterSelf = character.hp.current;
  applyCastHealing(cure, 1, ["someone-else-2"]);
  suite.is("and stayed put when somebody else was", character.hp.current, afterSelf);
  suite.ok("the roll is shown, not done silently",
    app.__rollToasts.some(t => /Cure Wounds/.test(t.label)));

  character.hp.current = 1;
  applyCastHealing({ name: "Self Mend", level: 1, classSource: "Cleric", heal: "2d4", desc: "You regain hit points." }, 1, []);
  suite.ok("a spell with nobody to pick heals the only person it can be about", character.hp.current > 1);
  character.hp.current = 1;
  applyCastHealing(cure, 1, []);
  suite.is("but picking nobody from a list you were shown only rolls it", character.hp.current, 1);
  character.hp.current = most;

  suite.section("healing sent across the party arrives as an offer");
  const heal = parsePartyMessage(partyMessage("heal",
    { spell: "Cure Wounds", amount: 9, to: "d4e5f6", fromName: "Sigrid" }));
  suite.is("the number travels", heal.amount, 9);
  suite.is("and the spell's name with it", heal.spell, "Cure Wounds");
  suite.is("nothing healing is refused",
    parsePartyMessage(partyMessage("heal", { amount: 0, to: "d4e5f6" })), null);
  suite.is("and so is a number that isn't one",
    parsePartyMessage(partyMessage("heal", { amount: "lots", to: "d4e5f6" })), null);
  suite.is("an absurd number is refused rather than clamped",
    parsePartyMessage(partyMessage("heal", { amount: 100000, to: "d4e5f6" })), null);

  suite.section("a spell can carry the condition it applies");
  const blessSpell = character.spells.find(s => s.name === "Bless");
  suite.ok("the demo Bless carries its modifiers", (blessSpell.effects || []).length === 2);
  character.activeEffects = [];
  app.shareCastWithTargets(blessSpell, [deviceId()], 1);
  const mine = character.activeEffects.find(g => g.name === "Bless");
  suite.ok("casting it on yourself puts it on your sheet", !!mine);
  suite.is("with the spell's own modifiers", mine.effects.length, 2);
  suite.ok("and it holds concentration", mine.concentration);

  character.activeEffects = [];
  app.shareCastWithTargets(blessSpell, ["someone-else-2"], 1);
  const held = character.activeEffects.find(g => g.name === "Bless");
  suite.ok("casting it only on others still tracks the concentration", !!held);
  suite.is("but does not bless the caster", held.effects.length, 0);
  character.activeEffects = [];

  suite.section("telling the table a spell has ended");
  const revoke = parsePartyMessage(partyMessage("effect-revoke",
    { id: "a1b2c3-9", to: "d4e5f6", fromName: "Sigrid" }));
  suite.is("the message names the effect", revoke.id, "a1b2c3-9");
  suite.is("and who stopped concentrating", revoke.fromName, "Sigrid");
  suite.is("one with no effect named is refused",
    parsePartyMessage(partyMessage("effect-revoke", { to: "d4e5f6" })), null);
};
