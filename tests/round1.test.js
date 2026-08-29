/* Round 1: the bug that shipped, the confirmations, and the shapes that
   replaced dropdowns.

   The property picker is the reason this file exists. It rendered perfectly in
   Chromium, passed 1,522 tests, and was broken in every other browser, because
   a <button> nested inside a <button> is invalid HTML that only Chromium
   tolerates. The structure suite now catches the markup; this file catches the
   behaviour around it. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();

  suite.section("the property picker is collapsed until you ask for it");

  // a fake container, because the DOM stub doesn't build one
  function pickerContainer() {
    let html = "";
    return {
      set innerHTML(v) { html = v; },
      get innerHTML() { return html; },
      querySelector() { return { addEventListener() {} }; },
      querySelectorAll() { return []; }
    };
  }

  suite.runs("collapsed, it is a summary line naming what's chosen", () => {
    const c = pickerContainer();
    app.renderPropertyPicker(c, ["Versatile (1d10)", "Finesse"]);
    suite.ok("summary line", c.innerHTML.includes("summary-line"), c.innerHTML);
    suite.ok("names the properties", c.innerHTML.includes("Versatile (1d10), Finesse"), c.innerHTML);
    suite.ok("and doesn't render eleven rows", !c.innerHTML.includes("prop-list"), "the list rendered anyway");
  });

  suite.runs("with nothing chosen it says so rather than going blank", () => {
    const c = pickerContainer();
    app.renderPropertyPicker(c, []);
    suite.ok("says None", c.innerHTML.includes("None"), c.innerHTML);
  });

  suite.runs("expanded, every SRD property gets a row", () => {
    const c = pickerContainer();
    app.renderPropertyPicker(c, ["Finesse"], true);
    const rows = c.innerHTML.split("data-prop-toggle=").length - 1;
    suite.is("one row per SRD property", rows, app.SRD_WEAPON_PROPERTIES.length);
  });

  suite.section("the row's two halves do different things");

  suite.runs("the checkbox toggles and the name explains", () => {
    const c = pickerContainer();
    app.renderPropertyPicker(c, [], true);
    suite.ok("checkbox carries the toggle", c.innerHTML.includes("data-prop-toggle="), "no toggle hook");
    suite.ok("name carries the info hook", c.innerHTML.includes("data-prop-info="), "no info hook");
  });

  suite.runs("the checkbox is not a button, so it can't nest inside one", () => {
    const html = app.miniCheckboxHtml("x", "y", true);
    suite.ok("is a span", html.startsWith("<span"), html);
    suite.ok("is not a button", !html.includes("<button"), html);
    suite.ok("still announces itself", html.includes('role="checkbox"') && html.includes('aria-checked="true"'), html);
  });

  suite.runs("disabled is a class now, because a span ignores the attribute", () => {
    const html = app.miniCheckboxHtml("x", "y", false, true);
    suite.ok("class", html.includes("disabled"), html);
    suite.ok("no attribute to rely on", !html.includes(" disabled>"), html);
  });

  suite.runs("every SRD property can explain itself", () => {
    const missing = app.SRD_WEAPON_PROPERTIES.filter(p => !app.WEAPON_PROPERTY_INFO[p]);
    suite.is("nothing without a description", missing, []);
  });

  suite.runs("a custom property still lists separately and can be removed", () => {
    const c = pickerContainer();
    app.renderPropertyPicker(c, ["Versatile (1d10)", "Screams when swung"], true);
    suite.ok("own section", c.innerHTML.includes("Your own"), c.innerHTML);
    suite.ok("removable", c.innerHTML.includes("data-prop-remove="), c.innerHTML);
    // the SRD one is customised, not custom -- it belongs on the Versatile row
    // stop before the free-text field, whose placeholder names Versatile too
    const ownBlock = c.innerHTML.slice(c.innerHTML.indexOf("Your own"), c.innerHTML.indexOf("field-row"));
    suite.ok("and Versatile isn't listed twice", !ownBlock.includes("Versatile"), ownBlock);
  });

  suite.section("pick-one fields are buttons, not dropdowns");

  suite.runs("segmentedFieldHtml keeps the hidden input a select would have had", () => {
    const html = app.segmentedFieldHtml("f", "Proficiency", [
      { value: "0", label: "None" }, { value: "1", label: "Proficient" }, { value: "2", label: "Expertise" }
    ], "1");
    suite.ok("hidden input carries the value", html.includes('id="f" value="1"'), html);
    suite.ok("three buttons", (html.split("data-segment=").length - 1) === 3, html);
    suite.ok("the current one is active", html.includes('class="toggle-btn active" data-segment="1"'), html);
  });

  suite.runs("it escapes what it's given", () => {
    const html = app.segmentedFieldHtml("f", "<img src=x>", [{ value: "<img src=x>", label: "<img src=x>" }], "");
    suite.ok("no raw markup", !html.includes("<img src=x"), html);
  });

  suite.runs("the skill editor uses it", () => {
    app.openEditSkillModal("Perception");
    const html = app.__modals[app.__modals.length - 1].html;
    suite.ok("segmented", html.includes("data-segment="), html.slice(0, 300));
    suite.ok("all three options", html.includes(">None<") && html.includes(">Proficient<") && html.includes(">Expertise<"), html);
  });

  suite.section("nothing is destroyed without asking");

  function lastConfirm() { return app.__confirms && app.__confirms[app.__confirms.length - 1]; }

  suite.runs("removing an item asks, and doesn't take its own form with it", () => {
    const before = app.character.inventory.length;
    const item = app.character.inventory[0];
    app.confirmDeleteItem(item);
    // it must not have deleted anything yet
    suite.is("nothing removed until confirmed", app.character.inventory.length, before);
  });

  suite.section("empty screens say what they are");

  suite.runs("a character with no attacks and no resources is told so", () => {
    const saved = { inv: app.character.inventory, res: app.character.resources, slots: app.character.spellSlots };
    app.character.inventory = [];
    app.character.resources = [];
    app.character.spellSlots = {};
    const html = app.renderCombatTab();
    suite.ok("resources hint", html.includes("No resources yet"), "no hint under Resources");
    suite.ok("attacks hint", html.includes("No attacks yet"), "no hint under Attacks");
    app.character.inventory = saved.inv; app.character.resources = saved.res; app.character.spellSlots = saved.slots;
  });

  suite.runs("a non-caster is told they don't cast, not shown an empty list", () => {
    const saved = { sc: app.character.spellcasting, sp: app.character.spells };
    app.character.spellcasting = { classes: [] };
    app.character.spells = [];
    const html = app.renderSpellsTab();
    suite.ok("says so", html.includes("doesn't cast spells"), html.slice(0, 300));
    suite.ok("no prepared counter", !html.includes("prepared"), "the filter row rendered anyway");
    app.character.spellcasting = saved.sc; app.character.spells = saved.sp;
  });

  suite.section("the creator asks about unspent points at the moment it matters");

  suite.runs("no standing banner on the step", () => {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true, race: "Human", charClass: "Fighter",
      scores: { Strength: 8, Dexterity: 8, Constitution: 8, Intelligence: 8, Wisdom: 8, Charisma: 8 } });
    const html = app.abilityStepHtml(3);
    // a warning that is on screen before the player has done anything is
    // furniture -- it asks on Next instead
    suite.ok("nothing shouting on arrival", !html.includes("unspent"), html.slice(0, 400));
    suite.ok("but the count is there", html.includes("Points left to spend"), html.slice(0, 400));
  });

  suite.runs("the origin rule description says the rule, not the state", () => {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true, race: "Dragonborn", charClass: "Fighter",
      customOrigin: true, asiBonus: { plus2: "Strength", plus1: "Charisma" }, scores: {} });
    const html = app.abilityStepHtml(3);
    suite.ok("no narration of the choice back at the player",
      !html.includes("Optional rule:") && !html.includes("increases go wherever"), html.slice(0, 600));
  });
};
