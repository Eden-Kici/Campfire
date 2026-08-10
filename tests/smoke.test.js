/* Opens everything. This catches the most common breakage by far: a render or
   modal referring to a field that moved, which throws the moment it is opened
   and is invisible until someone taps that exact button. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const c = app.character;
  const weapon = c.inventory.find(i => i.isWeapon);
  const armour = c.inventory.find(i => i.armour);
  const gear = c.inventory.find(i => !i.isWeapon && !i.armour);

  suite.section("tabs");
  [["combat", app.renderCombatTab], ["character", app.renderCharacterTab],
   ["spells", app.renderSpellsTab], ["inventory", app.renderInventoryTab],
   ["notes", app.renderNotesTab], ["selector", app.renderSelectorScreen]]
    .forEach(([name, render]) => suite.runs(name, render));

  suite.section("inventory and items");
  suite.runs("item detail, armour", () => app.openItemDetailModal(armour.id));
  suite.runs("item detail, weapon", () => app.openItemDetailModal(weapon.id));
  suite.runs("item detail, gear", () => app.openItemDetailModal(gear.id));
  suite.runs("item editor", () => app.openItemEditModal(weapon.id));
  suite.runs("add item", () => app.openAddInventoryModal());
  suite.runs("add item as weapon", () => app.openAddInventoryModal("Equipped", "weapon"));
  suite.runs("category editor", () => app.openEditCategoryModal("Equipped"));
  suite.runs("give quantity", () => app.openGiveQuantityModal(c.inventory[0]));
  suite.runs("give to", () => app.openGiveToModal(c.inventory[0], 1));

  suite.section("combat");
  suite.runs("attack detail", () => app.openAttackDetailModal(weapon.id));
  suite.runs("add attack", () => app.openAddAttackModal());
  suite.runs("stow weapon", () => app.openStowWeaponModal(weapon.id));
  suite.runs("hit point calculator", () => app.openHpCalculator());
  suite.runs("short rest", () => app.openShortRestModal());
  suite.runs("long rest", () => app.openLongRestModal());
  suite.runs("add effect", () => app.openAddEffectModal());
  suite.runs("effect detail", () => app.openEffectDetailModal(c.activeEffects[0].id));
  suite.runs("concentration check", () => { c.activeEffects.push({ id: 800, name: "Bless", concentration: true, duration: { type: "Rounds", rounds: 10 }, effects: [] }); app.openConcentrationCheckModal(14); });
  suite.runs("add resource", () => app.openAddResourceModal());
  suite.runs("resource detail", () => app.openResourceDetailModal(c.resources[0].id));

  suite.section("character");
  suite.runs("proficiency editor", () => app.openEditProficiencyModal());
  suite.runs("ability editor", () => app.openEditAbilityModal("STR"));
  suite.runs("saving throw editor", () => app.openEditSavingThrowModal("WIS"));
  suite.runs("skill editor", () => app.openEditSkillModal("Stealth"));
  suite.runs("add feature", () => app.openAddFeatureOrSectionModal());
  suite.runs("feature editor", () => app.openEditFeatureModal("Feats", 0));
  suite.runs("subsection editor", () => app.openEditSubsectionModal("Feats"));
  suite.runs("character editor", () => app.openCharacterEditorModal());

  suite.section("spells");
  suite.runs("add spell", () => app.openAddSpellModal());
  suite.runs("spell detail", () => app.openSpellDetailModal(c.spells[0].id));
  suite.runs("slot editor", () => app.openEditSlotsModal(1));
  suite.runs("cast a spell", () => app.castSpell(c.spells.find(s => s.level > 0).id));

  suite.section("notes");
  suite.runs("note editor", () => app.openNoteEditorModal(c.notes[0].id));
  suite.runs("note actions", () => app.openNoteActionsMenu(c.notes[0].id));
  suite.runs("share note", () => app.openShareModal(c.notes[0].id));
  suite.runs("add section", () => app.openAddSectionModal());
  suite.runs("section editor", () => app.openEditSectionModal(c.noteSections[0].id));

  suite.section("app level");
  suite.runs("menu", () => app.openAppMenu());
  suite.runs("reset confirmation", () => app.confirmResetToDemo());
  suite.runs("level up", () => app.openLevelUpModal());
  suite.runs("theme picker", () => app.openThemeModal());
  suite.runs("options", () => app.openSettingsModal());
  suite.runs("exhaustion detail", () => app.openExhaustionModal());
  suite.runs("character creator", () => app.openCharacterCreator());
  suite.runs("party finder", () => app.openPartyFinder());
  suite.runs("character menu", () => app.openCharacterMenu(c.id));
  suite.runs("content manager", () => app.openContentManager());
  suite.runs("add custom item", () => app.openCustomItemForm(null));
  suite.runs("edit custom item", () => {
    app.customContent.items.push({ id: 1, name: "Boots of Bees", weight: 1, description: "", type: "gear" });
    app.openCustomItemForm(1);
  });
  suite.runs("browse the races category (SRD + Custom together)", () => { app.contentSrdCategory = "races"; app.contentScreen = "category"; app.redrawContentManager(); });
  suite.runs("SRD race detail", () => { app.contentSrdEntry = app.SRD_RACES[0]; app.contentScreen = "srd-detail"; app.contentSrdCategory = "races"; app.redrawContentManager(); });
  suite.runs("SRD class detail", () => { app.contentSrdEntry = app.SRD_CLASSES[0]; app.contentScreen = "srd-detail"; app.contentSrdCategory = "classes"; app.redrawContentManager(); });
  suite.runs("SRD background detail", () => { app.contentSrdEntry = app.SRD_BACKGROUNDS[0]; app.contentScreen = "srd-detail"; app.contentSrdCategory = "backgrounds"; app.redrawContentManager(); });
  suite.runs("SRD weapon detail", () => { app.contentSrdEntry = app.KIT_ITEMS.longsword; app.contentScreen = "srd-detail"; app.contentSrdCategory = "weapons"; app.redrawContentManager(); });
  suite.runs("duplicate a race to custom", () => app.duplicateSrdEntry("race", app.SRD_RACES[0]));
  suite.runs("duplicate a class to custom", () => app.duplicateSrdEntry("class", app.SRD_CLASSES[0]));
  suite.runs("duplicate a background to custom", () => app.duplicateSrdEntry("background", app.SRD_BACKGROUNDS[0]));
  suite.runs("duplicate an item to custom", () => app.duplicateSrdEntry("item", app.KIT_ITEMS.longsword));
  suite.runs("edit custom race", () => {
    app.customContent.races.push({ id: 900, name: "Test Race", features: [{ name: "F", desc: "d" }], skillChoice: { count: 1, options: ["Perception"] }, subraces: [{ name: "Sub", features: [{ name: "SF", desc: "d" }] }] });
    app.openRaceForm(900);
  });
  suite.runs("edit custom class", () => {
    app.customContent.classes.push({
      id: 900, name: "Test Class", description: "d", hitDie: "d8", mainAbility: "Strength", saves: ["Strength"],
      armorProf: "", weaponProf: "", skillChoices: { count: 1, options: [] },
      features: [{ level: 1, name: "F", desc: "d" }], subclasses: [{ name: "Sub", features: [{ level: 3, name: "SF", desc: "d" }] }]
    });
    app.openClassForm(900);
  });
  suite.runs("edit custom background", () => {
    app.customContent.backgrounds.push({ id: 900, name: "Test Background", desc: "d", skills: ["Survival"], feature: { name: "F", desc: "d" } });
    app.openBackgroundForm(900);
  });

  suite.section("unified content browser: SRD + Custom merged");
  suite.runs("Manage Content's category list has combined SRD + Custom counts, not two sections", () => {
    app.contentScreen = "list";
    app.contentCategoryFilter = "all";
    app.contentCategorySearch = "";
    const html = app.contentManagerHtml();
    if (html.includes("SRD Content") || html.includes("Custom Content")) throw new Error("expected the old two-section split to be gone");
    if (!html.includes("Races")) throw new Error("expected a Races category row");
    if (!html.includes("Features")) throw new Error("expected a Features category row");
  });
  suite.runs("the races category lists both the SRD roster and the duplicated custom one", () => {
    const cat = app.CONTENT_CATEGORIES.find(c => c.key === "races");
    const rows = app.categoryEntries(cat);
    if (!rows.some(r => r.source === "srd")) throw new Error("expected SRD races in the merged list");
    if (!rows.some(r => r.source === "custom")) throw new Error("expected the duplicated custom race in the merged list");
  });
  suite.runs("a custom entry gets a CC tag, an SRD entry doesn't", () => {
    app.contentSrdCategory = "races";
    app.contentCategoryFilter = "all";
    app.contentCategorySearch = "";
    const html = app.contentResultsHtml("races");
    if (!html.includes(">CC<")) throw new Error("expected a CC tag on the custom entry");
  });
  suite.runs("the SRD filter hides custom entries", () => {
    app.contentCategoryFilter = "srd";
    const rows = app.filteredContentEntries("races");
    if (rows.some(r => r.source === "custom")) throw new Error("expected no custom rows under the SRD filter");
    app.contentCategoryFilter = "all";
  });
  suite.runs("the Custom filter hides SRD entries", () => {
    app.contentCategoryFilter = "custom";
    const rows = app.filteredContentEntries("races");
    if (rows.some(r => r.source === "srd")) throw new Error("expected no SRD rows under the Custom filter");
    app.contentCategoryFilter = "all";
  });
  suite.runs("search narrows the list by name", () => {
    app.contentCategorySearch = "zzz-no-such-race-zzz";
    const rows = app.filteredContentEntries("races");
    if (rows.length) throw new Error("expected a nonsense search to match nothing");
    app.contentCategorySearch = "";
  });
  suite.runs("search works from the top-level Manage Content screen too, across every category", () => {
    app.contentCategorySearch = "fighter";
    const rows = app.filteredContentEntries(null);
    if (!rows.length) throw new Error("expected cross-category matches for 'fighter'");
    if (!rows.some(r => r.catKey === "classes")) throw new Error("expected Fighter the class among the results");
    app.contentCategorySearch = "";
  });
  suite.runs("subclasses category now lists SRD subclasses too, flattened out of their class", () => {
    app.customContent.subclasses.push({ id: 950, forClass: "Fighter", name: "Test Subclass For Browser", features: [] });
    const cat = app.CONTENT_CATEGORIES.find(c => c.key === "subclasses");
    const rows = app.categoryEntries(cat);
    if (!rows.some(r => r.source === "srd")) throw new Error("expected SRD subclasses (e.g. Champion) flattened into this category");
    if (!rows.some(r => r.source === "srd" && r.entry.forClass)) throw new Error("expected a flattened SRD subclass to carry forClass");
    if (!rows.some(r => r.source === "custom" && r.entry.name === "Test Subclass For Browser")) throw new Error("expected the custom subclass listed");
  });
  suite.runs("an SRD subclass has a detail view with a duplicate button", () => {
    const cat = app.CONTENT_CATEGORIES.find(c => c.key === "subclasses");
    app.contentSrdEntry = cat.srdList()[0];
    app.contentSrdCategory = "subclasses";
    app.contentScreen = "srd-detail";
    const html = app.contentManagerHtml();
    if (!html.includes("Duplicate to Custom")) throw new Error("expected a duplicate button on the SRD subclass detail view");
  });
  suite.runs("duplicating an SRD subclass creates a Custom one with the same forClass", () => {
    const cat = app.CONTENT_CATEGORIES.find(c => c.key === "subclasses");
    const srd = cat.srdList()[0];
    const before = app.customContent.subclasses.length;
    app.duplicateSrdEntry("subclass", srd);
    if (app.customContent.subclasses.length !== before + 1) throw new Error("expected a new Custom subclass");
    const made = app.customContent.subclasses[app.customContent.subclasses.length - 1];
    if (made.forClass !== srd.forClass) throw new Error("expected forClass to carry over from the SRD subclass");
  });
  suite.runs("opening the category screen renders without throwing", () => {
    app.contentSrdCategory = "races";
    app.contentScreen = "category";
    app.redrawContentManager();
  });
  suite.runs("deleting a custom entry asks first instead of removing it immediately", () => {
    app.customContent.races.push({ id: 960, name: "Delete Me Race", features: [], skillChoice: null, subraces: [] });
    const before = app.customContent.races.length;
    app.contentPendingDelete = { catKey: "races", source: "custom", ref: 960 };
    const html = app.contentResultsHtml("races");
    if (!html.includes("Delete \"Delete Me Race\"?")) throw new Error("expected an inline confirmation for the pending delete");
    if (app.customContent.races.length !== before) throw new Error("expected nothing removed yet -- only confirming does that");
    app.contentPendingDelete = null;
    app.customContent.races = app.customContent.races.filter(r => r.id !== 960);
  });
  suite.runs("a Custom feature can be authored standalone, not tied to a race/class/background", () => {
    app.openFeatureForm(null);
    if (app.featureFormState.editingId !== null) throw new Error("expected a blank feature form");
    app.redrawContentManager();
  });

  suite.section("add custom content from scratch (no duplicate required)");
  suite.runs("+ Add opens a picker of every content kind", () => { app.contentScreen = "add-picker"; app.redrawContentManager(); });
  suite.runs("a blank race form opens and wires without an existing entry", () => {
    app.openRaceForm(null);
    if (app.raceFormState.editingId !== null) throw new Error("expected no editingId on a from-scratch race");
    app.redrawContentManager();
  });
  suite.runs("a blank class form opens and wires without an existing entry", () => {
    app.openClassForm(null);
    if (app.classFormState.editingId !== null) throw new Error("expected no editingId on a from-scratch class");
    app.redrawContentManager();
  });
  suite.runs("a blank background form opens and wires without an existing entry", () => {
    app.openBackgroundForm(null);
    if (app.backgroundFormState.editingId !== null) throw new Error("expected no editingId on a from-scratch background");
    app.redrawContentManager();
  });

  suite.section("feature choices");
  c.traits["Race Traits"].push({ name: "Extra Language", desc: "You can speak, read, and write one additional language of your choice." });
  c.traits["Class Features"].push({ name: "Fighting Style", desc: "You adopt a particular style of fighting as your specialty." });
  c.traits["Class Features"].push({ name: "Expertise", desc: "Double your proficiency bonus for two skills you're proficient in." });
  c.pendingChoices.push(
    { id: 901, source: "Human", traitCategory: "Race Traits", featureName: "Extra Language", kind: "language", prompt: "Choose an extra language", count: 1 },
    { id: 902, source: "Fighter", traitCategory: "Class Features", featureName: "Fighting Style", kind: "fightingStyle", prompt: "Choose a fighting style", count: 1 },
    { id: 903, source: "Rogue", traitCategory: "Class Features", featureName: "Expertise", kind: "skill", prompt: "Choose two skills you're proficient in", count: 2 },
    { id: 904, source: "High Elf", traitCategory: "Race Traits", featureName: "Cantrip", kind: "cantrip", prompt: "Choose a wizard cantrip", count: 1 }
  );
  suite.runs("character tab with pending choices", () => app.renderCharacterTab());
  suite.runs("resolve a language choice", () => app.openResolveChoiceModal(901));
  suite.runs("resolve a fighting style choice", () => app.openResolveChoiceModal(902));
  suite.runs("resolve an expertise choice", () => app.openResolveChoiceModal(903));
  suite.runs("resolve a cantrip choice", () => app.openResolveChoiceModal(904));
  suite.runs("add a language manually", () => app.openAddLanguageModal());

  suite.section("custom content: choice/effect/resource on features");
  app.customContent.races.push({
    id: 901, name: "Choice Test Race",
    features: [
      { name: "Grants Effect", desc: "d", effects: [{ category: "Bonus", value: { stat: "AC", amount: 1 } }] },
      { name: "Grants Choice", desc: "d", choice: { kind: "language", count: 1, prompt: "Pick one" } },
      { name: "Grants Resource", desc: "d", resource: { max: 1, recharge: { on: "SR", amount: "all" } } }
    ],
    skillChoice: null, subraces: [{ name: "Sub", features: [{ name: "SF", desc: "d", effects: [{ category: "Bonus", value: { stat: "Speed", amount: 5 } }] }] }]
  });
  suite.runs("open a custom race with choice/effect/resource features", () => app.openRaceForm(901));
  app.customContent.classes.push({
    id: 901, name: "Choice Test Class", description: "d", hitDie: "d8", mainAbility: "Strength", saves: ["Strength"],
    armorProf: "", weaponProf: "", skillChoices: { count: 1, options: [] },
    features: [{ level: 1, name: "F", desc: "d", choice: { kind: "cantrip", count: 1, prompt: "p" }, resource: { max: 2, recharge: { on: "LR", amount: "all" } } }],
    subclasses: [{ name: "Sub", features: [{ level: 3, name: "SF", desc: "d", effects: [{ category: "Advantage", value: { rollType: "attack", mode: "advantage" } }] }] }]
  });
  suite.runs("open a custom class with choice/effect/resource features", () => app.openClassForm(901));
  app.customContent.backgrounds.push({
    id: 901, name: "Choice Test Background", desc: "d", skills: ["Survival"],
    feature: { name: "F", desc: "d", choice: { kind: "skill", count: 2, prompt: "p" } }
  });
  suite.runs("open a custom background with a choice on its feature", () => app.openBackgroundForm(901));

  suite.section("custom subclasses for existing classes");
  suite.runs("a fresh subclass form defaults to the first known class", () => app.openSubclassForm(null));
  app.customContent.subclasses.push({
    id: 901, forClass: "Fighter", name: "Custom Battle Master",
    features: [
      { level: 3, name: "Combat Superiority", desc: "d" },
      { level: 7, name: "Know Your Enemy", desc: "d" }
    ]
  });
  suite.runs("subclassesForClass merges a custom subclass in with the SRD ones", () => {
    const list = app.subclassesForClass("Fighter");
    if (!list.some(sc => sc.name === "Custom Battle Master")) throw new Error("expected the custom subclass to be listed");
    if (list.length < 2) throw new Error("expected the SRD subclasses still present too");
  });
  suite.runs("featuresAtLevel grants the custom subclass's own leveled features", () => {
    const gained = app.featuresAtLevel("Fighter", "Custom Battle Master", 3);
    if (!gained.some(f => f.name === "Combat Superiority")) throw new Error("expected the level-3 feature");
  });
  suite.runs("opening the subclass form for an existing entry loads it", () => {
    app.openSubclassForm(901);
    if (app.subclassFormState.name !== "Custom Battle Master") throw new Error("expected the saved subclass to load");
  });
  suite.runs("the creator's subclass step includes a custom subclass for Fighter", () => {
    app.openCharacterCreator();
    app.creatorState.charClass = "Fighter";
    if (!app.creatorStepKeys().includes("subclass")) throw new Error("expected a subclass step");
    const html = app.subclassStepHtml(1, 5);
    if (!html.includes("Custom Battle Master")) throw new Error("expected the custom subclass listed as an option");
  });

  suite.section("choices resolved during the builder");
  app.creatorState = {
    step: 0, started: true, name: "Test", appearance: "", backstory: "",
    race: "Human", subrace: null, charClass: "Fighter", subclass: "Champion", background: "Soldier",
    scores: {}, asiBonus: { plus2: "Strength", plus1: "Constitution" },
    raceSkillChoices: ["Perception"], classSkillChoices: ["Athletics", "History"], equipment: [],
    choiceAnswers: {}, customBuild: false
  };
  suite.runs("the creator inserts a choices step for Human Fighter", () => {
    if (!app.creatorStepKeys().includes("choices")) throw new Error("expected a choices step");
  });
  suite.runs("choices step renders and wires", () => {
    app.creatorState.step = app.creatorStepKeys().indexOf("choices");
    app.redrawCreator();
  });
  suite.runs("building with answered choices leaves nothing pending", () => {
    app.creatorState.choiceAnswers = {
      "Extra Language": { chosen: ["Draconic"] },
      "Fighting Style": { chosen: ["Defense"] }
    };
    const built = app.buildCharacterFromCreator();
    if (built.pendingChoices.length) throw new Error("expected the builder to have resolved every choice");
    if (!built.languages.includes("Draconic")) throw new Error("expected the language pick to land");
  });

  suite.section("off-hand weapons");
  suite.runs("attack detail shows the off-hand toggle", () => app.openAttackDetailModal(weapon.id));
  suite.runs("item detail shows the off-hand toggle for a weapon", () => app.openItemDetailModal(weapon.id));
  suite.runs("an off-hand weapon still renders on the combat tab", () => {
    weapon.offHand = true;
    app.renderCombatTab();
    weapon.offHand = false;
  });

  suite.section("resource auto-add from a feature");
  // the demo character already has Second Wind/Action Surge/Channel Divinity/
  // Arcane Recovery under Resources, so a feature reusing one of those names
  // is deliberately NOT what's tested here -- the button should stay hidden
  // for those (covered below) and show up only for a genuinely new one
  c.traits["Class Features"].push({ name: "Lay On Hands", desc: "d", resource: { name: "Lay On Hands Pool", max: 5, recharge: { on: "LR", amount: "all" } } });
  suite.runs("character tab offers to add a not-yet-tracked resource", () => {
    const html = app.renderCharacterTab();
    if (!html.includes("data-add-resource-from-feature")) throw new Error("expected an Add to Resources button");
  });
  suite.runs("but not for a feature whose resource is already tracked", () => {
    // Second Wind's trait entry (hand-authored on the demo character) has no
    // .resource of its own, so add one and confirm the existing "Second
    // Wind" resource suppresses the button rather than offering a duplicate
    const secondWind = c.traits["Class Features"].find(t => t.name === "Second Wind");
    secondWind.resource = { name: "Second Wind", max: 1, recharge: { on: "SR", amount: "all" } };
    const html = app.renderCharacterTab();
    delete secondWind.resource;
    if (/Second Wind[\s\S]{0,120}data-add-resource-from-feature/.test(html)) throw new Error("expected no button next to an already-tracked resource");
  });

  suite.section("rolling");
  suite.runs("an attack roll", () => {
    const attack = app.calculateAttack(c, weapon);
    app.showRoll({ label: "x", notation: "1d20+5", sources: attack.toHitSources, kind: "attack" });
  });
  suite.runs("a stacked damage roll", () => {
    const fang = c.inventory.find(i => i.damage && i.damage.length > 1);
    const attack = app.calculateAttack(c, fang);
    app.showRoll({
      label: "x", notation: attack.damageNotation,
      parts: attack.damage.map(p => ({ notation: p.notation, label: p.type })),
      sources: [], kind: "damage"
    });
  });
  suite.runs("rerolling", () => app.rerollCurrent());
  suite.runs("a roll against a difficulty class waits to be made", () => {
    app.showRoll({ label: "x", notation: "1d20+2", sources: [], kind: "save", dc: 12 });
    if (app.rollState.rolled) throw new Error("rolled without being asked");
    app.rerollCurrent();
    if (!app.rollState.rolled) throw new Error("did not roll when asked");
  });
  suite.runs("switching to advantage", () => app.setRollMode("advantage"));
  suite.runs("switching to disadvantage", () => app.setRollMode("disadvantage"));

  suite.section("dice notation");
  suite.is("a trailing operator does not poison the total", app.rollNotation("5+").total, 5);
  suite.is("an operator alone is zero", app.rollNotation("+").total, 0);
  suite.is("empty is zero", app.rollNotation("").total, 0);
  suite.is("maximum of 1d8+3", app.maxNotation("1d8+3"), 11);
  suite.is("normal mode rolls once", app.rollWithMode({ notation: "1d20" }, "normal").outcome.parts.length, 1);

  let advantageAlwaysHigher = true;
  let disadvantageAlwaysLower = true;
  for (let i = 0; i < 200; i++) {
    const up = app.rollWithMode({ notation: "1d20" }, "advantage");
    const down = app.rollWithMode({ notation: "1d20" }, "disadvantage");
    if (up.dropped && up.outcome.total < up.dropped.total) advantageAlwaysHigher = false;
    if (down.dropped && down.outcome.total > down.dropped.total) disadvantageAlwaysLower = false;
  }
  suite.ok("advantage always keeps the higher roll", advantageAlwaysHigher);
  suite.ok("disadvantage always keeps the lower roll", disadvantageAlwaysLower);

  suite.section("advantage from conditions");
  c.activeEffects = [{ id: 1, name: "Prone", concentration: false,
    duration: { type: "Permanent", rounds: null },
    effects: [{ category: "Condition", value: { condition: "Prone" } }] }];
  suite.is("prone gives disadvantage on attacks", app.derivedRollMode(c, "attack").mode, "disadvantage");
  suite.is("but not on checks", app.derivedRollMode(c, "check").mode, "normal");
  c.activeEffects.push({ id: 2, name: "Oil of Accuracy", concentration: false,
    duration: { type: "Permanent", rounds: null },
    effects: [{ category: "Advantage", value: { rollType: "attack", mode: "advantage" } }] });
  suite.is("advantage and disadvantage cancel", app.derivedRollMode(c, "attack").mode, "normal");
};
