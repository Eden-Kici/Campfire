/* Round 2: money, capacity, starting equipment, and the copy rules.

   The theme running through it is that the app kept knowing a number and
   choosing not to show it -- weight had no denominator, coin didn't exist at
   all, and the equipment step listed names with no way to find out what they
   were. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();

  suite.section("coin is a model, not an inventory item");

  suite.runs("an empty purse has every denomination", () => {
    const purse = app.emptyPurse();
    suite.is("five coin types", Object.keys(purse).length, app.COIN_TYPES.length);
    suite.is("all zero", app.totalCoins(purse), 0);
  });

  suite.runs("a missing or partial purse doesn't throw", () => {
    // a character saved before money existed has neither purse nor stash
    suite.is("undefined purse", app.totalCoins(undefined), 0);
    suite.is("partial purse", app.totalCoins({ gp: 3 }), 3);
    suite.is("and converts", app.moneyInGold({ gp: 3 }), 3);
  });

  suite.runs("denominations convert to gold the way the rules say", () => {
    suite.is("100 cp is 1 gp", app.moneyInGold({ cp: 100 }), 1);
    suite.is("10 sp is 1 gp", app.moneyInGold({ sp: 10 }), 1);
    suite.is("2 ep is 1 gp", app.moneyInGold({ ep: 2 }), 1);
    suite.is("1 pp is 10 gp", app.moneyInGold({ pp: 1 }), 10);
    suite.is("and they add up", app.moneyInGold({ gp: 1, sp: 10, cp: 100 }), 3);
  });

  suite.runs("adding coins tolerates a partial addend", () => {
    const out = app.addCoins({ gp: 5 }, { sp: 3 });
    suite.is("kept", out.gp, 5);
    suite.is("added", out.sp, 3);
    suite.is("and filled in the rest", out.cp, 0);
  });

  suite.section("coin weight is a real rule the app can express, and ignores by default");

  suite.runs("off by default, so coin is weightless", () => {
    app.settings.moneyCountsWeight = false;
    suite.is("no weight", app.carriedCoinWeight(app.character), 0);
  });

  suite.runs("on, it is fifty to the pound and only the carried purse", () => {
    app.settings.moneyCountsWeight = true;
    const saved = { purse: app.character.purse, stash: app.character.stash };
    app.character.purse = { gp: 100, sp: 0, cp: 0, ep: 0, pp: 0 };
    app.character.stash = { gp: 1000, sp: 0, cp: 0, ep: 0, pp: 0 };
    suite.is("100 coins is 2 lb", app.carriedCoinWeight(app.character), 2);
    suite.ok("the stash weighs nothing, wherever it is",
      app.carriedCoinWeight(app.character) === 2, "the stash was counted");
    // and it reaches the total, with a row that says where it came from
    const weight = app.calculateCarriedWeight(app.character);
    suite.ok("appears in the breakdown", weight.sources.some(s => s.label.includes("coins")),
      JSON.stringify(weight.sources.map(s => s.label)));
    app.settings.moneyCountsWeight = false;
    app.character.purse = saved.purse; app.character.stash = saved.stash;
  });

  suite.section("carried weight finally has a denominator");

  suite.runs("capacity is Strength times fifteen", () => {
    const str = app.effectiveAbilityScore(app.character, "STR");
    suite.is("capacity", app.calculateCarryingCapacity(app.character).total, str * 15);
  });

  suite.runs("and it explains itself, like every other total", () => {
    const cap = app.calculateCarryingCapacity(app.character);
    suite.is("sums to the total", cap.sources.reduce((n, s) => n + s.value, 0), cap.total);
  });

  suite.runs("the inventory tab shows both halves", () => {
    const html = app.renderInventoryTab();
    suite.ok("carried over capacity", /Carried weight:.*\/ \d+ lb/.test(html.replace(/<[^>]+>/g, "")),
      html.slice(0, 400));
    suite.ok("and it's tappable", html.includes('id="weight-breakdown"'), html.slice(0, 400));
  });

  suite.section("base values are no longer printed as bonuses");

  suite.runs("the armour's base AC has no plus sign in front of it", () => {
    const ac = app.calculateAC(app.character);
    const armourRow = ac.sources[0];
    suite.ok("marked plain", armourRow.plain === true, JSON.stringify(armourRow));
    const html = app.breakdownRowsHtml(ac.sources);
    suite.ok("renders without a sign", !html.includes("+" + armourRow.value), html);
  });

  suite.runs("but a real bonus still gets its sign", () => {
    const html = app.breakdownRowsHtml([{ label: "Ring", value: 1 }]);
    suite.ok("signed", html.includes("+1"), html);
  });

  suite.section("money reaches the inventory screen");

  suite.runs("the coin row renders every denomination", () => {
    const html = app.renderInventoryTab();
    app.COIN_TYPES.forEach(coin => {
      suite.ok(coin.label + " cell", html.includes('data-coin-edit="purse:' + coin.key + '"'), coin.key + " missing");
    });
  });

  suite.runs("the stash only appears when the setting is on", () => {
    app.settings.trackStashedMoney = false;
    suite.ok("hidden", !app.renderInventoryTab().includes('data-coin-edit="stash:'), "stash rendered anyway");
    app.settings.trackStashedMoney = true;
    suite.ok("shown", app.renderInventoryTab().includes('data-coin-edit="stash:'), "stash missing");
    app.settings.trackStashedMoney = false;
  });

  suite.runs("the gear-bonus chips are gone, since the item rows already said it", () => {
    const html = app.renderInventoryTab();
    suite.ok("no bonus chip row", !html.includes("chip-stat"), "a chip survived");
  });

  suite.section("starting equipment covers all twelve classes");

  suite.runs("every class has a kit", () => {
    suite.is("twelve", Object.keys(app.STARTING_KIT).length, 12);
  });

  suite.runs("every kit item can explain itself, through the shared renderer", () => {
    // resolved, not read raw: a kit entry names a catalogue row and inherits
    // its facts, so "can it explain itself" is a question about the merge
    const missing = Object.keys(app.KIT_ITEMS)
      .filter(k => !app.kitItemTemplate(k).description);
    suite.is("nothing without a description", missing, []);
  });

  suite.runs("and the catalogue is the source, not a second copy", () => {
    const linked = Object.keys(app.KIT_ITEMS).filter(k => app.KIT_ITEMS[k].srd);
    suite.ok("most of the kit points at the catalogue", linked.length > 40, String(linked.length));
    // a linked entry must resolve, or the kit is naming a row that isn't there
    const dangling = linked.filter(k => !app.srdCatalogueEntry(app.KIT_ITEMS[k].srd));
    suite.is("no kit item names a catalogue row that doesn't exist", dangling, []);
  });

  suite.runs("a linked item takes its facts from the catalogue", () => {
    const longsword = app.kitItemTemplate("longsword");
    const catalogue = app.srdCatalogueEntry("Longsword");
    suite.is("same weight", longsword.weight, catalogue.weight);
    suite.is("same damage", JSON.stringify(longsword.damage), JSON.stringify(catalogue.damage));
    suite.is("same properties", JSON.stringify(longsword.properties), JSON.stringify(catalogue.properties));
  });

  suite.runs("but the kit still owns where it lands and how many", () => {
    const arrows = app.kitItemTemplate("arrows");
    suite.is("a stack of twenty reads as Arrows, not the catalogue's singular Arrow", arrows.name, "Arrows");
    suite.ok("and the count is a quantity", arrows.qty > 1, JSON.stringify(arrows.qty));
    suite.ok("with a category to land in", !!arrows.category, "no category");
  });

  suite.runs("and the description survives being built into inventory", () => {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true, name: "T", race: "Human", charClass: "Cleric",
      background: "Acolyte", scores: {}, equipment: app.STARTING_KIT.Cleric.choices.map(() => 0) });
    const inv = app.buildStartingInventory();
    suite.ok("something has a description", inv.some(i => i.description),
      JSON.stringify(inv.map(i => i.name)));
    // KIT_ITEMS calls the field `description`, the same name the item detail
    // reads and the content browser writes -- there is no second spelling
    suite.ok("one field name, not two", !inv.some(i => i.desc), "desc leaked through");
  });

  suite.runs("the background's own equipment comes along", () => {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true, name: "T", race: "Human", charClass: "Cleric",
      background: "Acolyte", scores: {}, equipment: app.STARTING_KIT.Cleric.choices.map(() => 0) });
    const names = app.buildStartingInventory().map(i => i.name);
    suite.ok("acolyte's kit is there", names.some(n => /Prayer Book|Vestments|Incense/i.test(n)),
      JSON.stringify(names));
  });

  suite.section("starting money is listed, and comes from the background");

  suite.runs("an Acolyte starts with coin", () => {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true, charClass: "Cleric", background: "Acolyte" });
    suite.ok("some gold", app.moneyInGold(app.startingMoney()) > 0, JSON.stringify(app.startingMoney()));
    suite.ok("and the step says so", app.startingMoneyLabel().length > 0, "no label");
  });

  suite.runs("the equipment step prints it", () => {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true, charClass: "Cleric", background: "Acolyte",
      equipment: app.STARTING_KIT.Cleric.choices.map(() => 0) });
    const html = app.equipmentStepHtml(5);
    suite.ok("a coins heading", html.includes("Coins"), html.slice(-600));
    suite.ok("with an amount", html.includes("gp"), html.slice(-600));
  });

  suite.section("the equipment step lists rows, not chips");

  suite.runs("granted gear is tappable rows", () => {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true, charClass: "Rogue", background: "Criminal",
      equipment: app.STARTING_KIT.Rogue.choices.map(() => 0) });
    const html = app.equipmentStepHtml(5);
    suite.ok("rows", html.includes("kit-row"), html.slice(0, 400));
    suite.ok("no chips", !html.includes('class="chip'), "a chip survived");
    suite.ok("each one asks to be tapped", html.includes("data-kit-info="), html.slice(0, 400));
  });

  suite.section("the party decides who sees a custom build");

  suite.runs("the host always sees it", () => {
    app.party = { status: "hosting", settings: { showClasses: true, showLevels: true, hpDisplay: "stats", showCustom: false }, members: [] };
    suite.ok("host sees", app.canSeeCustomBuilds(), "host couldn't see");
    const line = app.partyMemberDetailLine({ name: "X", customBuild: true, classNames: "Rogue", level: 4 });
    suite.ok("and it's on the line", line.includes("Custom"), line);
  });

  suite.runs("a guest sees it only when the party says so", () => {
    app.party = { status: "connected", settings: { showClasses: true, showLevels: true, hpDisplay: "stats", showCustom: false }, members: [] };
    suite.ok("hidden", !app.canSeeCustomBuilds(), "guest saw it");
    suite.ok("not on the line", !app.partyMemberDetailLine({ name: "X", customBuild: true, classNames: "Rogue" }).includes("Custom"), "leaked");

    app.party.settings.showCustom = true;
    suite.ok("shown once allowed", app.canSeeCustomBuilds(), "still hidden");
    suite.ok("and on the line", app.partyMemberDetailLine({ name: "X", customBuild: true, classNames: "Rogue" }).includes("Custom"), "missing");
  });

  suite.runs("a character that isn't custom is never labelled", () => {
    app.party = { status: "hosting", settings: { showClasses: true, showLevels: true, hpDisplay: "stats", showCustom: true }, members: [] };
    suite.ok("no label", !app.partyMemberDetailLine({ name: "X", classNames: "Rogue" }).includes("Custom"), "labelled anyway");
  });

  suite.section("tracking is owned by one screen");

  suite.runs("the item form no longer asks about it", () => {
    const html = app.commonItemFieldsHtml({ category: "Worn" });
    suite.ok("no toggle", !html.includes("Track under Resources"), html.slice(0, 400));
    suite.ok("and no capacity field", !html.includes("if-res-max"), html.slice(0, 400));
  });

  suite.runs("the item's own detail view does", () => {
    const arrows = app.character.inventory.find(i => i.resource) || app.character.inventory[0];
    app.openItemDetailModal(arrows.id);
    const html = app.__modals[app.__modals.length - 1].html;
    suite.ok("toggle is here", html.includes("detail-track-switch"), html.slice(0, 500));
  });

  suite.runs("editing an item does not silently untrack it", () => {
    // the form stopped asking, so reading an absent field must not be taken
    // as "the player turned it off"
    const tracked = app.character.inventory.find(i => i.resource);
    suite.ok("there is a tracked item to check", !!tracked, "none tracked");
    const before = JSON.stringify(tracked.resource);
    app.openItemEditModal(tracked.id);
    suite.is("still tracked, unchanged", JSON.stringify(tracked.resource), before);
  });

  suite.section("the origin rule names itself and stops explaining");

  suite.runs("it is called Custom Origin Increases", () => {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true, race: "Dragonborn", charClass: "Fighter",
      customOrigin: true, asiBonus: { plus2: "Strength", plus1: "Charisma" }, scores: {} });
    const html = app.abilityStepHtml(3);
    suite.ok("named", html.includes("Custom Origin Increases"), html.slice(0, 600));
    suite.ok("no subtext under it", !html.includes("Place them yourself"), html.slice(0, 600));
  });
};
