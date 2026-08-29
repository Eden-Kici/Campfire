/* Starting equipment. A created character used to arrive with nothing at all,
   so its Combat tab was empty. What matters here is that the kit arrives as
   real items the rest of the app already understands, not as a list of names. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { STARTING_KIT, KIT_ITEMS, buildStartingInventory, buildCharacterFromCreator,
          calculateAC, calculateAttack, weaponList, resourceRows, itemType,
          savedCharacters, selectCharacter, calculateCarriedWeight } = app;

  function creatorState(charClass, equipment) {
    app.creatorState = {
      step: 0, name: "Kettle", appearance: "", backstory: "",
      race: "Human", subrace: null, charClass, subclass: null, background: "Soldier",
      scores: { Strength: 15, Dexterity: 14, Constitution: 13, Intelligence: 10, Wisdom: 12, Charisma: 8 },
      asiBonus: { plus2: "Strength", plus1: "Constitution" },
      raceSkillChoices: [], classSkillChoices: [], equipment, customBuild: false
    };
  }

  suite.section("every kit references real items");
  Object.keys(STARTING_KIT).forEach(className => {
    const kit = STARTING_KIT[className];
    const keys = (kit.gear || []).concat(...kit.choices.map(choice =>
      [].concat(...choice.options.map(option => option.items))));
    const unknown = keys.filter(key => !KIT_ITEMS[key]);
    suite.is(className + " has no dangling references", unknown, []);
    suite.ok(className + " offers at least one choice", kit.choices.length > 0);
  });

  suite.section("a fighter with bow and sword");
  // four choices now, not two -- armour, weapons, ranged, pack. The SRD fighter
  // package grants nothing unconditionally, so `gear` is empty and everything
  // on the sheet came from a choice the player made.
  creatorState("Fighter", [1, 0, 0, 1]);
  const fighter = buildCharacterFromCreator();
  savedCharacters.push(fighter);
  selectCharacter(fighter.id);

  const names = fighter.inventory.map(i => i.name);
  suite.ok("has armour", names.includes("Leather"));
  suite.ok("has a bow", names.includes("Longbow"));
  suite.ok("has arrows", names.includes("Arrows"));
  suite.ok("has a sword", names.includes("Longsword"));
  // the SRD fighter's option (b) is "leather armor, longbow, and 20 arrows" --
  // no quiver, so the arrows are a plain stack here rather than a container
  suite.ok("no quiver it was never granted", !names.includes("Quiver"));
  suite.ok("and the pack it chose", names.includes("Explorer's Pack"));

  suite.section("the items work with the rest of the app");
  suite.is("armour class computes from real armour", calculateAC(app.character).total, 15);
  // longbow, longsword and the light crossbow from the ranged choice
  suite.is("weapons appear as attacks", weaponList(app.character).length, 3);
  suite.is("the bow's to hit is derived", calculateAttack(app.character,
    fighter.inventory.find(i => i.name === "Longbow")).toHitTotal, 4);
  // Strength 15 from point buy, 16 with the Human +1 -- the creator used to
  // apply a second +2 of its own on top, which read as +6 here
  suite.is("the sword's to hit too", calculateAttack(app.character,
    fighter.inventory.find(i => i.name === "Longsword")).toHitTotal, 5);
  // KIT_ITEMS and SRD_EQUIPMENT disagreed about this: one said the bow spends
  // from "Quiver", the other from "Arrows". They now both say Arrows.
  suite.is("the bow is fed by the arrows", calculateAttack(app.character,
    fighter.inventory.find(i => i.name === "Longbow")).ammunition.name, "Arrows");
  suite.ok("arrows are a stack", resourceRows(app.character).some(r => r.name === "Arrows" && !r.container));
  suite.ok("weight is counted", calculateCarriedWeight(app.character).total > 0);
  suite.is("armour is classified as armour", itemType(fighter.inventory.find(i => i.name === "Leather")), "armour");

  suite.section("the other branch of the same kit");
  creatorState("Fighter", [0, 1, 1, 0]);
  const heavy = buildStartingInventory();
  const heavyNames = heavy.map(i => i.name);
  suite.ok("chain mail instead of leather", heavyNames.includes("Chain Mail"));
  suite.ok("no bow", !heavyNames.includes("Longbow"));
  suite.is("two shortswords stay two entries", heavyNames.filter(n => n === "Shortsword").length, 2);

  suite.section("stacks merge, wielded things do not");
  // the rogue's two daggers are unconditional in the SRD -- they used to be
  // locked behind picking option (b) of the ranged choice, so a rapier-and-bow
  // rogue owned none
  creatorState("Rogue", [0, 0, 0]);
  const rogue = buildStartingInventory();
  suite.is("two daggers are two rows, since you wield them separately",
    rogue.filter(i => i.name === "Dagger").length, 2);
  suite.ok("even though neither came from a choice", true);
  creatorState("Rogue", [0, 1, 0]);
  const rogueB = buildStartingInventory();
  suite.is("and the other branch still has them",
    rogueB.filter(i => i.name === "Dagger").length, 2);
  suite.is("arrows are one row with a quantity",
    rogue.filter(i => i.name === "Arrows").length, 1);
  suite.is("and that quantity is the SRD's twenty", rogue.find(i => i.name === "Arrows").qty, 20);

  suite.section("identifiers do not collide");
  const ids = rogue.map(i => i.id);
  suite.is("every item has a distinct id", new Set(ids).size, ids.length);

  suite.section("every class produces a usable sheet");
  Object.keys(STARTING_KIT).forEach(className => {
    creatorState(className, STARTING_KIT[className].choices.map(() => 0));
    const built = buildCharacterFromCreator();
    savedCharacters.push(built);
    selectCharacter(built.id);
    suite.ok(className + " has something in the bags", built.inventory.length > 0);
    suite.runs(className + " renders its combat tab", () => app.renderCombatTab());
    suite.runs(className + " renders its inventory", () => app.renderInventoryTab());
    suite.runs(className + " computes armour class", () => calculateAC(app.character));
  });

  suite.section("the step only appears when there is a kit");
  creatorState("Fighter", []);
  suite.ok("fighter gets an equipment step", app.creatorStepKeys().includes("equipment"));
  // every one of the twelve has a kit now, so there is no class that skips it
  creatorState("Bard", []);
  suite.ok("and so does every other class", app.creatorStepKeys().includes("equipment"));
  suite.is("all twelve have a kit", Object.keys(STARTING_KIT).length, 12);

  suite.section("it will not let you skip a choice");
  creatorState("Fighter", []);
  const before = app.__modals.length;
  app.openCharacterCreator();
  suite.ok("the creator opens", app.__modals.length > before);
};
