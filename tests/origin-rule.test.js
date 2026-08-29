/* The optional origin rule: "assign the +2 and +1 yourself" instead of taking
   the race's printed increase.

   This is the riskiest thing in the creator, because there are three places a
   racial increase can come from -- a race feature's own effects, a subrace's,
   and a *choice* a race hands the player (Half-Elf's two +1s) -- and the rule
   has to replace all three, exactly once, in the wizard AND on the built
   sheet. Every bug this file pins was a real one: the choice surviving into
   pendingChoices, a stale answer applying on top of the assignment, and a
   Hill Dwarf shipping two identically-worded Ability Score Increase traits. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();

  function build(opts) {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true, name: "Test", charClass: "Fighter", background: "Soldier" }, opts);
    return app.buildCharacterFromCreator();
  }

  // what the sheet actually says a score is, after every effect
  const score = (c, ability) => app.effectiveAbilityScore(c, ability);
  const raceTraits = c => c.traits["Race Traits"];
  const abilityTraits = c => raceTraits(c).filter(t => t.name === "Ability Score Increase");

  suite.section("off, the race's own increase applies -- unchanged");

  suite.runs("Dragonborn gets its printed +2/+1", () => {
    const c = build({ race: "Dragonborn", scores: { Strength: 15, Charisma: 12 } });
    suite.is("STR 15 + 2", score(c, "STR"), 17);
    suite.is("CHA 12 + 1", score(c, "CHA"), 13);
  });

  suite.runs("and the stored scores stay the point-buy ones", () => {
    const c = build({ race: "Dragonborn", scores: { Strength: 15 } });
    // one owner per score: `abilities` is what you bought, the trait's effects
    // carry the increase, and the breakdown sums to the total
    suite.is("stored", c.abilities.STR, 15);
    suite.is("effective", score(c, "STR"), 17);
  });

  suite.section("on, the assignment replaces it -- exactly once");

  suite.runs("Dragonborn's +2 STR / +1 CHA gives way to the assignment", () => {
    const c = build({ race: "Dragonborn", scores: { Strength: 15, Charisma: 12, Intelligence: 13 },
                      customOrigin: true, asiBonus: { plus2: "Intelligence", plus1: "Charisma" } });
    suite.is("STR keeps its point-buy value", score(c, "STR"), 15);
    suite.is("INT 13 + 2", score(c, "INT"), 15);
    suite.is("CHA 12 + 1", score(c, "CHA"), 13);
  });

  suite.runs("Human's +1 to all six is replaced, not added to", () => {
    const c = build({ race: "Human", scores: { Strength: 15, Dexterity: 14, Constitution: 13,
                                               Intelligence: 12, Wisdom: 10, Charisma: 8 },
                      customOrigin: true, asiBonus: { plus2: "Strength", plus1: "Constitution" } });
    suite.is("STR 15 + 2", score(c, "STR"), 17);
    suite.is("CON 13 + 1", score(c, "CON"), 14);
    suite.is("DEX untouched", score(c, "DEX"), 14);
    suite.is("WIS untouched", score(c, "WIS"), 10);
  });

  suite.runs("a subrace's increase is replaced too, and leaves one trait not two", () => {
    // Hill Dwarf: +2 CON from the race, +1 WIS from the subrace. Rewriting the
    // text on both read as if the assignment had been applied twice.
    const c = build({ race: "Dwarf", subrace: "Hill Dwarf", scores: { Constitution: 14, Wisdom: 12, Strength: 15 },
                      customOrigin: true, asiBonus: { plus2: "Strength", plus1: "Wisdom" } });
    suite.is("CON keeps its point-buy value", score(c, "CON"), 14);
    suite.is("STR 15 + 2", score(c, "STR"), 17);
    suite.is("WIS 12 + 1", score(c, "WIS"), 13);
    suite.is("one increase trait, not two", abilityTraits(c).length, 1);
  });

  suite.section("Half-Elf: the rule replaces the choice as well as the fixed part");

  suite.runs("off, the choice is asked", () => {
    const c = build({ race: "Half-Elf", scores: {} });
    const asked = c.pendingChoices.filter(p => p.featureName === "Ability Score Increase");
    suite.is("one pending ability choice", asked.length, 1);
  });

  suite.runs("on, it is neither asked in the wizard nor granted on the sheet", () => {
    const c = build({ race: "Half-Elf", scores: { Charisma: 13, Strength: 15 },
                      customOrigin: true, asiBonus: { plus2: "Strength", plus1: "Charisma" } });
    // the wizard hid it; the build used to grant it anyway, so the sheet asked
    // the question the wizard had taken away -- and answering it added two more
    const asked = c.pendingChoices.filter(p => p.featureName === "Ability Score Increase");
    suite.is("nothing pending", asked.length, 0);
    suite.is("STR 15 + 2", score(c, "STR"), 17);
    suite.is("CHA 13 + 1, not +1 +2", score(c, "CHA"), 14);
  });

  suite.runs("an answer given before the rule was on does not leak into the build", () => {
    const c = build({ race: "Half-Elf", scores: { Charisma: 13, Strength: 15, Dexterity: 14 },
                      customOrigin: true, asiBonus: { plus2: "Strength", plus1: "Charisma" },
                      choiceAnswers: { "Ability Score Increase": { chosen: ["Dexterity +1", "Wisdom +1"] } } });
    suite.is("DEX untouched by the stale answer", score(c, "DEX"), 14);
    suite.is("STR is the assignment only", score(c, "STR"), 17);
  });

  suite.section("the wizard's own numbers agree with the sheet's");

  suite.runs("finalScoreFor matches what gets built", () => {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true, race: "Dragonborn", charClass: "Fighter",
      background: "Soldier", scores: { Strength: 15, Charisma: 12 },
      customOrigin: true, asiBonus: { plus2: "Charisma", plus1: "Strength" } });
    const previewed = { STR: app.finalScoreFor("Strength"), CHA: app.finalScoreFor("Charisma") };
    const c = app.buildCharacterFromCreator();
    suite.is("STR previewed and built agree", previewed.STR, score(c, "STR"));
    suite.is("CHA previewed and built agree", previewed.CHA, score(c, "CHA"));
    suite.is("and the preview was right", previewed.STR, 16);
  });

  suite.runs("hit points follow the assigned Constitution", () => {
    // max HP is derived from the CON the sheet ends up showing, not the one
    // that was bought -- the two disagreeing was an earlier bug
    const c = build({ race: "Dragonborn", charClass: "Fighter", scores: { Constitution: 14 },
                      customOrigin: true, asiBonus: { plus2: "Constitution", plus1: "Strength" } });
    suite.is("CON 14 + 2", score(c, "CON"), 16);
    suite.is("d10 + 3", c.baseMaxHP, 13);
  });

  suite.section("nothing is assigned twice");

  suite.runs("the same ability can't hold both the +2 and the +1", () => {
    // the wizard's checkboxes enforce this; the build must not depend on it
    const c = build({ race: "Human", scores: { Strength: 15 },
                      customOrigin: true, asiBonus: { plus2: "Strength", plus1: "Strength" } });
    suite.is("STR gets both, and says so once", score(c, "STR"), 18);
    suite.is("still one increase trait", abilityTraits(c).length, 1);
  });

  suite.runs("nothing assigned yet is simply no increase", () => {
    const c = build({ race: "Dragonborn", scores: { Strength: 15 },
                      customOrigin: true, asiBonus: { plus2: null, plus1: null } });
    suite.is("STR is the point-buy value", score(c, "STR"), 15);
    suite.is("the trait is still there, with nothing on it", abilityTraits(c).length, 1);
  });
};
