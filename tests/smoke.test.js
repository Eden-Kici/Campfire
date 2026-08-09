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
