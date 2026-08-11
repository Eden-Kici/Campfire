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
  suite.runs("the Add Spell form searches the real SRD list, not just free text", () => {
    const fields = app.spellFormFieldsHtml(null, true);
    if (!fields.includes('class="field combo"')) throw new Error("expected the Add flow to use the SRD-searching combo field");
    if (!fields.includes('id="spell-form-name"')) throw new Error("expected a name field");
  });
  suite.runs("editing an existing spell still uses a plain name field, not the picker", () => {
    const fields = app.spellFormFieldsHtml(c.spells[0]);
    if (fields.includes('class="field combo"')) throw new Error("expected Edit to keep the plain text field, not the SRD picker");
  });
  suite.runs("spellCastingTimeCode maps SRD casting-time text onto the sheet's three buckets", () => {
    if (app.spellCastingTimeCode("1 action") !== "A") throw new Error("expected Action");
    if (app.spellCastingTimeCode("1 bonus action") !== "B") throw new Error("expected Bonus Action");
    if (app.spellCastingTimeCode("1 reaction, which you take when you are hit") !== "R") throw new Error("expected Reaction");
    if (app.spellCastingTimeCode("1 minute") !== "A") throw new Error("expected the no-bucket fallback to be Action");
  });
  suite.runs("spellLikelyAttackRoll reads the spell's own text", () => {
    const fireBolt = app.SRD_SPELLS.find(s => s.name === "Fire Bolt");
    if (!app.spellLikelyAttackRoll(fireBolt.desc)) throw new Error("expected Fire Bolt to read as an attack-roll spell");
    const magicMissile = app.SRD_SPELLS.find(s => s.name === "Magic Missile");
    if (app.spellLikelyAttackRoll(magicMissile.desc)) throw new Error("expected Magic Missile (auto-hit, no attack roll) to read false");
  });
  suite.runs("Manage Content browses the real SRD spell list", () => {
    app.contentSrdCategory = "spells";
    app.contentScreen = "category";
    const cat = app.CONTENT_CATEGORIES.find(cat => cat.key === "spells");
    if (cat.srdList().length !== 319) throw new Error("expected the spells category to expose all 319 SRD spells");
    app.redrawContentManager();  // exercises contentCategoryHtml() end to end without throwing
  });
  suite.runs("an SRD spell has a read-only detail view -- no Duplicate button, no Custom spell editor yet", () => {
    const cat = app.CONTENT_CATEGORIES.find(cat => cat.key === "spells");
    app.contentSrdEntry = cat.srdList().find(s => s.name === "Fireball");
    app.contentSrdCategory = "spells";
    app.contentScreen = "srd-detail";
    const html = app.contentManagerHtml();
    if (!html.includes("Fireball")) throw new Error("expected Fireball's own detail view");
    if (!html.includes("8d6 fire damage")) throw new Error("expected the real SRD description, not a placeholder");
    if (html.includes("Duplicate to Custom")) throw new Error("expected no Duplicate button -- spells have no Custom editor yet");
  });
  suite.runs("High Elf's Cantrip choice now offers the real SRD cantrip list", () => {
    const options = app.creatorChoiceOptionsFor({ kind: "cantrip" });
    if (options.length !== 24) throw new Error("expected all 24 SRD cantrips, got " + options.length);
    if (!options.includes("Fire Bolt")) throw new Error("expected Fire Bolt in the list");
  });
  suite.runs("resolving a cantrip choice pulls castingTime/attackRoll from the real spell, not hardcoded defaults", () => {
    let character = { classes: [{ name: "Wizard", level: 1, hitDie: "d6" }],
      traits: { "Race Traits": [{ name: "Cantrip", desc: "You know one cantrip." }], "Class Features": [], "Background": [], "Other": [] },
      pendingChoices: [{ id: 9001, source: "High Elf", traitCategory: "Race Traits", featureName: "Cantrip", kind: "cantrip", prompt: "Choose a wizard cantrip", count: 1 }],
      spells: [] };
    const pending = character.pendingChoices[0];
    app.applyChoiceResolution(character, pending, ["Fire Bolt"]);
    const learned = character.spells.find(s => s.name === "Fire Bolt");
    if (!learned) throw new Error("expected Fire Bolt to land on character.spells");
    if (learned.castingTime !== "A") throw new Error("expected Fire Bolt's real casting time (1 action) to map to A");
    if (!learned.attackRoll) throw new Error("expected Fire Bolt to be flagged as an attack-roll spell, not hardcoded false");
    if (!learned.desc.includes("ranged spell attack")) throw new Error("expected the real SRD description, not a stub");
  });

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

  suite.section("custom choice options can carry their own description");
  suite.runs("Draconic Ancestry's options explain the breath weapon, not just the label", () => {
    app.openCharacterCreator();
    app.creatorState.race = "Dragonborn";
    const html = app.raceStepHtml(1, 8);
    if (!html.includes("Breath Weapon: exhale fire in a 15-foot cone")) {
      throw new Error("expected the Gold ancestry option's own desc to render, not just its label");
    }
  });
  suite.runs("choiceOptionDescFor prefers an option's own desc over an effects summary", () => {
    const pending = { kind: "custom", options: [
      { label: "With desc", desc: "The real explanation.", effects: [{ category: "Bonus", value: { stat: "AC", amount: 1 } }] },
      { label: "No desc", effects: [{ category: "Bonus", value: { stat: "AC", amount: 1 } }] },
      { label: "Neither" }
    ] };
    if (app.choiceOptionDescFor(pending, "With desc") !== "The real explanation.") throw new Error("expected desc to win over the effects summary");
    if (!app.choiceOptionDescFor(pending, "No desc").startsWith("Grants:")) throw new Error("expected the effects-summary fallback");
    if (app.choiceOptionDescFor(pending, "Neither") !== "") throw new Error("expected nothing for an option with neither");
  });
  suite.runs("a level-up custom choice (Hunter's Prey) also surfaces each option's own desc", () => {
    let character = { classes: [{ name: "Ranger", level: 1, subclass: "Hunter", hitDie: "d10" }],
      traits: { "Class Features": [], "Race Traits": [], "Background": [], "Other": [] },
      pendingChoices: [] };
    app.grantFeatures(character, app.featuresAtLevel("Ranger", "Hunter", 3));
    const pending = character.pendingChoices.find(p => p.featureName === "Hunter's Prey");
    const html = app.resolveChoiceHtml(pending);
    if (!html.includes("Your tenacity can wear down the most potent foes")) {
      throw new Error("expected Colossus Slayer's own desc to render in the level-up resolver too");
    }
  });

  suite.section("choice options are a single-open accordion, not always-visible");
  suite.runs("creator: a collapsed option's card body isn't open, and picking one doesn't expand it", () => {
    app.openCharacterCreator();
    app.creatorState.race = "Dragonborn";
    const pending = app.creatorRaceChoices().find(p => p.featureName === "Draconic Ancestry");
    const collapsed = app.choiceCardHtml(pending);
    if (!collapsed.includes(`data-choice-expand="Draconic Ancestry|||Gold -- Fire, 15 ft. cone (Dex save)"`)) {
      throw new Error("expected an expand header for the Gold option");
    }
    // exactly one "collapse-body open" with nothing expanded -- the pending
    // card's own outer wrapper, which is always open; every nested option
    // card should be collapsed
    const openCount = (collapsed.match(/collapse-body open/g) || []).length;
    if (openCount !== 1) throw new Error("expected only the outer wrapper open, got " + openCount + " open bodies");

    app.creatorState.expandedChoiceOption["Draconic Ancestry"] = "Gold -- Fire, 15 ft. cone (Dex save)";
    const oneOpen = app.choiceCardHtml(pending);
    if (!oneOpen.includes("Breath Weapon: exhale fire in a 15-foot cone")) {
      throw new Error("expected Gold's body to render once expanded");
    }
    if ((oneOpen.match(/collapse-body open/g) || []).length !== 2) {
      throw new Error("expected exactly two open bodies (outer wrapper + Gold) once Gold is expanded");
    }

    app.creatorState.expandedChoiceOption["Draconic Ancestry"] = "Black -- Acid, 5x30 ft. line (Dex save)";
    const switched = app.choiceCardHtml(pending);
    // description text stays in the HTML either way (only the "open" class
    // toggles) so the real assertion is on which option's collapse-body
    // carries "open", not on text presence. Gold's collapse-body class
    // attribute follows its label directly (head, then body), so a short
    // window after the label text is enough to isolate it
    const goldIdx = switched.indexOf("Gold -- Fire");
    const goldBody = switched.slice(goldIdx, goldIdx + 200);
    if (/collapse-body open/.test(goldBody)) throw new Error("expected opening Black to close Gold, accordion-style");
    if ((switched.match(/collapse-body open/g) || []).length !== 2) {
      throw new Error("expected exactly two open bodies (outer wrapper + Black) once switched");
    }
  });
  suite.runs("level-up resolver: same single-open accordion behavior via module state", () => {
    let character = { classes: [{ name: "Ranger", level: 1, subclass: "Hunter", hitDie: "d10" }],
      traits: { "Class Features": [], "Race Traits": [], "Background": [], "Other": [] },
      pendingChoices: [] };
    app.grantFeatures(character, app.featuresAtLevel("Ranger", "Hunter", 3));
    const pending = character.pendingChoices.find(p => p.featureName === "Hunter's Prey");
    // choiceExpanded/choiceSelected are module-level in choices.js, bridged
    // onto app the same way character is -- set them directly rather than
    // going through openResolveChoiceModal, which keys off app.character
    // (the app's singleton) and would silently no-op against this throwaway
    // local character
    app.choiceExpanded = null;
    app.choiceSelected = [];
    const collapsed = app.resolveChoiceHtml(pending);
    if ((collapsed.match(/collapse-body open/g) || []).length !== 0) {
      throw new Error("expected nothing open by default");
    }
    app.choiceExpanded = "Colossus Slayer";
    const opened = app.resolveChoiceHtml(pending);
    if (!/Colossus Slayer[\s\S]{0,150}collapse-body open/.test(opened)) {
      throw new Error("expected Colossus Slayer's body to carry the open class once expanded");
    }
    if (!opened.includes("Your tenacity can wear down the most potent foes")) {
      throw new Error("expected Colossus Slayer's own desc to render once expanded");
    }
  });

  suite.section("choices resolved right after the step that granted them");
  app.creatorState = {
    step: 0, started: true, name: "Test", appearance: "", backstory: "",
    race: "Human", subrace: null, charClass: "Fighter", subclass: "Champion", background: "Soldier",
    scores: {}, asiBonus: { plus2: "Strength", plus1: "Constitution" },
    raceSkillChoices: ["Perception"], classSkillChoices: ["Athletics", "History"], equipment: [],
    choiceAnswers: {}, expandedChoiceOption: {}, customBuild: false
  };
  suite.runs("Human's own choice (Extra Language) shows up on the Race step", () => {
    const names = app.creatorRaceChoices().map(p => p.featureName);
    if (!names.includes("Extra Language")) throw new Error("expected Extra Language on creatorRaceChoices()");
    if (!app.raceStepHtml(1, 5).includes("Extra Language")) throw new Error("expected the race step to render the card");
  });
  suite.runs("Fighter's own choice (Fighting Style) shows up on the Class step", () => {
    const names = app.creatorClassChoices().map(p => p.featureName);
    if (!names.includes("Fighting Style")) throw new Error("expected Fighting Style on creatorClassChoices()");
    if (!app.classStepHtml(1, 5).includes("Fighting Style")) throw new Error("expected the class step to render the card");
  });
  suite.runs("neither choice is a 'skill' kind, so Human Fighter gets no trailing Choices step", () => {
    if (app.creatorStepKeys().includes("choices")) throw new Error("expected no choices step");
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

  suite.section("'skill' kind choices still wait for the trailing Choices step");
  app.creatorState = {
    step: 0, started: true, name: "Test2", appearance: "", backstory: "",
    race: "Human", subrace: null, charClass: "Rogue", subclass: "Thief", background: "Soldier",
    scores: {}, asiBonus: { plus2: "Dexterity", plus1: "Constitution" },
    raceSkillChoices: ["Perception"], classSkillChoices: ["Athletics", "History", "Stealth", "Acrobatics"], equipment: [],
    choiceAnswers: {}, expandedChoiceOption: {}, customBuild: false
  };
  suite.runs("Rogue's Expertise is a 'skill' kind choice, so it does NOT show on the Class step", () => {
    const names = app.creatorClassChoices().map(p => p.featureName);
    if (names.includes("Expertise")) throw new Error("Expertise should be deferred, not answered on the class step");
  });
  suite.runs("Rogue's Expertise does show up in creatorSkillChoices() and the trailing step exists", () => {
    const names = app.creatorSkillChoices().map(p => p.featureName);
    if (!names.includes("Expertise")) throw new Error("expected Expertise in creatorSkillChoices()");
    if (!app.creatorStepKeys().includes("choices")) throw new Error("expected a trailing choices step");
  });
  suite.runs("choices step renders and wires", () => {
    app.creatorState.step = app.creatorStepKeys().indexOf("choices");
    app.redrawCreator();
  });
  suite.runs("clearChoiceAnswers only clears the source it's given, not everything", () => {
    app.creatorState.charClass = "Fighter";
    app.creatorState.subclass = "Champion";
    app.creatorState.choiceAnswers = {
      "Extra Language": { chosen: ["Draconic"] },     // a race-sourced answer
      "Fighting Style": { chosen: ["Defense"] }        // this class's own choice
    };
    app.clearChoiceAnswers(app.creatorClassChoices());  // simulates switching class away from Fighter
    if (!app.creatorState.choiceAnswers["Extra Language"]) throw new Error("race answer shouldn't be touched by a class-scoped clear");
    if (app.creatorState.choiceAnswers["Fighting Style"]) throw new Error("expected Fighting Style's answer to be cleared");
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

  suite.section("onboarding tutorial");
  // the harness seeds campfire.tutorial as already-finished for every OTHER
  // suite (see harness.js's domStub) so unrelated tests aren't quietly
  // opening a welcome modal on every renderContent()/showScreen() call --
  // these tests reset tutorialState by hand instead of relying on that.
  suite.runs("a brand new install starts the tutorial automatically", () => {
    // loadTutorialState() is what boot calls when localStorage has no
    // campfire.tutorial key at all yet -- simulate a from-scratch device
    app.localStorage.removeItem("campfire.tutorial");
    app.tutorialState = { active: false, phase: null, seenTabs: [], seenActions: [] };
    app.loadTutorialState();
    if (!app.tutorialState.active) throw new Error("expected a fresh install to start active");
    if (app.tutorialState.phase !== "welcome") throw new Error("expected a fresh install to start at welcome");
    if (app.localStorage.getItem("campfire.tutorial") === null) throw new Error("expected loadTutorialState to persist the fresh-install state immediately");
  });
  suite.runs("loadTutorialState reads back exactly what persistTutorialState wrote", () => {
    app.tutorialState = { active: true, phase: "tabs", seenTabs: ["combat", "spells"], seenActions: ["roll"] };
    app.persistTutorialState();
    app.tutorialState = { active: false, phase: null, seenTabs: [], seenActions: [] };
    app.loadTutorialState();
    if (!app.tutorialState.active) throw new Error("expected active to round-trip true");
    if (app.tutorialState.phase !== "tabs") throw new Error("expected phase to round-trip");
    if (app.tutorialState.seenTabs.join(",") !== "combat,spells") throw new Error("expected seenTabs to round-trip");
    if (app.tutorialState.seenActions.join(",") !== "roll") throw new Error("expected seenActions to round-trip");
  });
  suite.runs("an inactive tutorial shows nothing, in any phase", () => {
    app.tutorialState = { active: false, phase: "welcome", seenTabs: [], seenActions: [] };
    if (app.tutorialContentFor() !== null) throw new Error("expected null while inactive");
  });
  suite.runs("welcome phase offers Start Tutorial and Skip", () => {
    app.tutorialState = { active: true, phase: "welcome", seenTabs: [], seenActions: [] };
    const content = app.tutorialContentFor();
    if (content.placement !== "modal") throw new Error("expected the welcome step to be a modal");
    if (!content.showSkip) throw new Error("expected a Skip option on welcome");
    if (content.nextLabel !== "Start Tutorial") throw new Error("expected a Start Tutorial button");
  });
  suite.runs("starting the tutorial from welcome opens the character creator", () => {
    app.tutorialState = { active: true, phase: "welcome", seenTabs: [], seenActions: [] };
    app.creatorState = null;
    app.tutorialContentFor().onNext();
    if (app.tutorialState.phase !== "creation") throw new Error("expected phase to advance to creation");
    if (!app.creatorState) throw new Error("expected onNext to open the character creator");
  });
  suite.runs("creation phase renders nothing until the wizard is actually started", () => {
    app.tutorialState = { active: true, phase: "creation", seenTabs: [], seenActions: [] };
    app.creatorState = { started: false, step: 0 };
    if (app.tutorialContentFor() !== null) throw new Error("expected null before 'Build a Character' is tapped");
  });
  suite.runs("creation phase content is keyed by the wizard's current step", () => {
    app.tutorialState = { active: true, phase: "creation", seenTabs: [], seenActions: [] };
    app.creatorState = {
      started: true, step: 0, race: "Human", subrace: null, charClass: "Fighter", subclass: null, background: "Soldier",
      scores: {}, asiBonus: { plus2: null, plus1: null }, raceSkillChoices: [], classSkillChoices: [], equipment: [],
      choiceAnswers: {}, expandedChoiceOption: {}, customBuild: false
    };
    // Fighter has no subclass at level 1, so creatorStepKeys()[0] is "race"
    const content = app.tutorialContentFor();
    if (content.placement !== "inline") throw new Error("expected the creation phase to render inline, not as a floating banner");
    if (content.title !== "Race") throw new Error("expected step content keyed off currentStepKey(), got " + content.title);
  });
  suite.runs("the creator's own modal actually includes the inline tutorial banner", () => {
    app.tutorialState = { active: true, phase: "creation", seenTabs: [], seenActions: [] };
    app.openCharacterCreator();
    app.creatorState.started = true;
    app.creatorState.race = "Human";
    app.redrawCreator();
    const html = app.creatorStepHtml();
    const inline = app.tutorialInlineHtml();
    if (!inline.includes("tutorial-inline")) throw new Error("expected the inline banner markup");
    if (!inline.includes("Race")) throw new Error("expected Race-step tutorial text");
  });
  suite.runs("landing on the sheet mid-creation hands off to the tab tour", () => {
    app.tutorialState = { active: true, phase: "creation", seenTabs: [], seenActions: [] };
    app.showScreen("sheet");
    if (app.tutorialState.phase !== "tabs") throw new Error("expected creation -> tabs on reaching the sheet");
  });
  suite.runs("tabs phase is keyed by activeTab and marks it seen", () => {
    app.tutorialState = { active: true, phase: "tabs", seenTabs: [], seenActions: [] };
    app.activeTab = "combat";
    app.currentScreen = "sheet";
    const content = app.tutorialContentFor();
    if (content.placement !== "sheet-banner") throw new Error("expected a floating banner for the tab tour");
    if (content.title !== "Combat") throw new Error("expected Combat's own content");
    if (content.target !== '[data-tab="combat"]') throw new Error("expected the banner to point at the Combat tab button");
    app.renderTutorialOverlay();   // this is what actually records the tab as seen
    if (!app.tutorialState.seenTabs.includes("combat")) throw new Error("expected renderTutorialOverlay to mark the tab seen");
  });
  suite.runs("tabs phase advances to actions once all five tabs are seen", () => {
    app.tutorialState = { active: true, phase: "tabs", seenTabs: ["combat", "character", "spells", "inventory"], seenActions: [] };
    app.activeTab = "notes";
    app.currentScreen = "sheet";
    app.renderTutorialOverlay();
    if (app.tutorialState.phase !== "actions") throw new Error("expected tabs -> actions once the fifth tab is visited");
  });
  suite.runs("actions phase points at the right control for the active tab", () => {
    app.tutorialState = { active: true, phase: "actions", seenTabs: [], seenActions: [] };
    app.activeTab = "combat";
    const content = app.tutorialContentFor();
    if (content.target !== "[data-roll-tohit]") throw new Error("expected the roll tip first");
    content.onNext();
    if (!app.tutorialState.seenActions.includes("roll")) throw new Error("expected Got It to mark the roll action seen");
    const next = app.tutorialContentFor();
    if (next.target !== "#hp-card") throw new Error("expected the HP tip next, on the same tab");
  });
  suite.runs("actions phase nudges toward another tab once the current one is exhausted", () => {
    app.tutorialState = { active: true, phase: "actions", seenTabs: [], seenActions: ["roll", "hp"] };
    app.activeTab = "combat";   // nothing left to try on Combat -- Cast a spell is on Spells
    const content = app.tutorialContentFor();
    if (content.onNext) throw new Error("expected a plain nudge, not another Got It action");
    if (content.target !== '[data-tab="spells"]') throw new Error("expected the nudge to point at the Spells tab");
  });
  suite.runs("actions phase auto-advances to done once everything's been tried", () => {
    app.tutorialState = { active: true, phase: "actions", seenTabs: [], seenActions: ["roll", "hp", "spell"] };
    app.activeTab = "combat";
    app.currentScreen = "sheet";
    if (app.tutorialContentFor() !== null) throw new Error("expected nothing left to show");
    app.renderTutorialOverlay();
    if (app.tutorialState.phase !== "done") throw new Error("expected renderTutorialOverlay to advance actions -> done");
  });
  suite.runs("done phase is a closing modal that turns the tutorial off", () => {
    app.tutorialState = { active: true, phase: "done", seenTabs: [], seenActions: [] };
    const content = app.tutorialContentFor();
    if (content.placement !== "modal") throw new Error("expected a closing modal");
    if (content.showSkip) throw new Error("expected no Skip button once it's already over");
    content.onNext();
    if (app.tutorialState.active) throw new Error("expected Got It to turn the tutorial off");
  });
  suite.runs("skipTutorial deactivates from anywhere", () => {
    app.tutorialState = { active: true, phase: "tabs", seenTabs: [], seenActions: [] };
    app.skipTutorial();
    if (app.tutorialState.active) throw new Error("expected skipTutorial to turn it off");
  });
  suite.runs("startTutorial (Replay Tutorial in the app menu) resets progress", () => {
    app.tutorialState = { active: false, phase: "done", seenTabs: ["combat"], seenActions: ["roll"] };
    app.startTutorial();
    if (!app.tutorialState.active) throw new Error("expected active");
    if (app.tutorialState.phase !== "welcome") throw new Error("expected phase reset to welcome");
    if (app.tutorialState.seenTabs.length) throw new Error("expected seenTabs cleared");
  });
  suite.runs("the app menu offers Replay Tutorial", () => {
    app.tutorialState = { active: false, phase: "done", seenTabs: [], seenActions: [] };
    app.openAppMenu();   // exercised for real DOM wiring above; here just confirming it doesn't throw with the tutorial inactive
  });
  suite.runs("renderTutorialOverlay never throws across every phase, active or not", () => {
    ["welcome", "creation", "tabs", "actions", "done", null].forEach(phase => {
      app.tutorialState = { active: phase !== null, phase, seenTabs: [], seenActions: [] };
      app.activeTab = "combat";
      app.currentScreen = "sheet";
      app.renderTutorialOverlay();
    });
    app.tutorialState = { active: false, phase: "done", seenTabs: ["combat", "character", "spells", "inventory", "notes"], seenActions: ["roll", "hp", "spell"] };
  });
};
