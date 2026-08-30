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

  suite.section("telling the table a spell has ended");
  const revoke = parsePartyMessage(partyMessage("effect-revoke",
    { id: "a1b2c3-9", to: "d4e5f6", fromName: "Sigrid" }));
  suite.is("the message names the effect", revoke.id, "a1b2c3-9");
  suite.is("and who stopped concentrating", revoke.fromName, "Sigrid");
  suite.is("one with no effect named is refused",
    parsePartyMessage(partyMessage("effect-revoke", { to: "d4e5f6" })), null);
};
