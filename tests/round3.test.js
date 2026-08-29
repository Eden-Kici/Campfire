/* Round 3: roll tempo, and the skill question stopping being asked twice. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();

  suite.section("rolls wait for you, unless you ask them not to");

  suite.runs("by default a roll opens unthrown", () => {
    app.settings.fastRolls = false;
    app.clearRollHistory();
    app.showRoll({ label: "Look", notation: "1d20+3", kind: "check" });
    suite.ok("not rolled", !app.rollState.rolled, "it rolled anyway");
    suite.is("and nothing logged", app.rollHistory.length, 0);
    suite.ok("with a Roll button", /id="roll-now"/.test(app.rollWindowHtml()), "no roll button");
    suite.ok("and a dash where the total goes", /roll-total unrolled/.test(app.rollWindowHtml()), "showed a total");
  });

  suite.runs("tapping Roll throws it and logs it", () => {
    app.settings.fastRolls = false;
    app.clearRollHistory();
    app.showRoll({ label: "Then throw", notation: "1d20+3", kind: "check" });
    app.rollNow();
    suite.ok("rolled", app.rollState.rolled, "still unrolled");
    suite.is("logged once", app.rollHistory.length, 1);
    suite.ok("and shows a total", !/roll-total unrolled/.test(app.rollWindowHtml()), "still a dash");
  });

  suite.runs("Fast Rolls puts it back to resolving on the tap", () => {
    app.settings.fastRolls = true;
    app.clearRollHistory();
    app.showRoll({ label: "Fast", notation: "1d20+3", kind: "check" });
    suite.ok("already rolled", app.rollState.rolled, "waited anyway");
    suite.is("and logged", app.rollHistory.length, 1);
    app.settings.fastRolls = false;
  });

  suite.runs("a DC roll waits in both modes, because deciding is the point", () => {
    app.settings.fastRolls = true;
    app.showRoll({ label: "Save", notation: "1d20+5", kind: "save", dc: 15 });
    suite.ok("still waiting", !app.rollState.rolled, "a DC roll rolled itself");
    app.settings.fastRolls = false;
  });

  suite.section("a roll you back out of costs nothing");

  suite.runs("ammunition is spent by the throw, not by opening the window", () => {
    app.settings.fastRolls = false;
    let spent = 0;
    app.showRoll({ label: "Shot", notation: "1d20+6", kind: "attack", onRoll: () => { spent += 1; } });
    suite.is("nothing spent on open", spent, 0);
    app.rollNow();
    suite.is("spent on the throw", spent, 1);
  });

  suite.runs("and a reroll does not spend it again", () => {
    app.settings.fastRolls = false;
    let spent = 0;
    app.showRoll({ label: "Shot", notation: "1d20+6", kind: "attack", onRoll: () => { spent += 1; } });
    app.rollNow();
    app.rerollCurrent();
    app.rerollCurrent();
    suite.is("still one", spent, 1);
  });

  suite.runs("Fast Rolls still spends it exactly once", () => {
    app.settings.fastRolls = true;
    let spent = 0;
    app.showRoll({ label: "Shot", notation: "1d20+6", kind: "attack", onRoll: () => { spent += 1; } });
    suite.is("spent", spent, 1);
    app.rerollCurrent();
    suite.is("and not again", spent, 1);
    app.settings.fastRolls = false;
  });

  suite.section("the skill question is asked once, in one place");

  function halfElfRogue() {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true, name: "H", race: "Half-Elf", charClass: "Rogue",
      background: "Criminal", scores: { Dexterity: 15 } });
  }

  suite.runs("a feature that grants skills becomes a column in the Skills step", () => {
    halfElfRogue();
    const labels = app.creatorSkillSources().map(s => s.label);
    suite.ok("Skill Versatility is there", labels.includes("Skill Versatility"), JSON.stringify(labels));
    const html = app.skillsStepHtml(5);
    suite.ok("with its own heading", html.includes("Skill Versatility"), html.slice(0, 600));
  });

  suite.runs("and is no longer asked again on the trailing step", () => {
    halfElfRogue();
    const pending = app.creatorPendingChoiceList().map(c => c.featureName);
    suite.ok("not repeated", !pending.includes("Skill Versatility"), JSON.stringify(pending));
  });

  suite.runs("Expertise stays behind, because it picks from what you have", () => {
    halfElfRogue();
    const pending = app.creatorPendingChoiceList().map(c => c.featureName);
    suite.ok("still pending", pending.includes("Expertise"), JSON.stringify(pending));
  });

  suite.runs("a skill taken from one column is closed off in the others", () => {
    halfElfRogue();
    const sources = app.creatorSkillSources();
    // Perception rather than Stealth: Stealth comes free with the Criminal
    // background, so its row shows a BG tag and no checkbox at all
    sources.find(s => s.label === "Class").chosen.push("Perception");
    const html = app.skillsStepHtml(5);
    const row = html.slice(html.indexOf(">Perception<"), html.indexOf(">Perception<") + 700);
    suite.ok("disabled elsewhere", row.includes("disabled"), row.slice(0, 400));
  });

  suite.runs("what you pick there reaches the sheet", () => {
    halfElfRogue();
    const sources = app.creatorSkillSources();
    sources.find(s => s.label === "Skill Versatility").chosen.push("Arcana", "Nature");
    const built = app.buildCharacterFromCreator();
    suite.ok("Arcana", !!built.skillProficiency["Arcana"], "not proficient");
    suite.ok("Nature", !!built.skillProficiency["Nature"], "not proficient");
  });

  suite.runs("and counts as known, so Expertise can offer it", () => {
    halfElfRogue();
    app.creatorSkillSources().find(s => s.label === "Skill Versatility").chosen.push("Arcana");
    suite.ok("known", app.creatorKnownSkills().includes("Arcana"), JSON.stringify(app.creatorKnownSkills()));
  });

  suite.section("proficiency reads as a mark, not a sentence");

  suite.runs("proficient is a tick, in green", () => {
    const html = app.proficiencyMarkHtml({ proficient: true, required: "Martial" });
    suite.ok("tick", html.includes("✓"), html);
    suite.ok("green class", html.includes("prof-yes"), html);
    suite.ok("no yes", !/\byes\b/.test(html.replace(/prof-yes/g, "")), html);
    suite.ok("and names the category plainly", html.includes(">Martial<"), html);
    suite.ok("without spelling out that it is a requirement", !html.includes("needs"), html);
  });

  suite.runs("not proficient is a cross, in red", () => {
    const html = app.proficiencyMarkHtml({ proficient: false, required: "Simple" });
    suite.ok("cross", html.includes("✗"), html);
    suite.ok("red class", html.includes("prof-no"), html);
    suite.ok("no no", !/\bno\b/.test(html.replace(/prof-no/g, "")), html);
    suite.ok("names the category", html.includes(">Simple<"), html);
  });

  suite.section("item descriptions do not count for you");

  suite.runs("nothing states its own quantity in prose", () => {
    const offenders = Object.keys(app.KIT_ITEMS).filter(key => {
      const text = app.KIT_ITEMS[key].description || "";
      return /\b(two|three|four|five|ten|twenty)\s+(of them|arrows|bolts|sticks|darts)\b/i.test(text)
        || /^(Twenty|Ten|Five|Four|Three|Two)\b/.test(text);
    });
    suite.is("the quantity lives in qty, not the sentence", offenders, []);
  });

  suite.section("tracking is configurable where it is switched on");

  suite.runs("the detail view carries the whole block, not a signpost", () => {
    const tracked = app.character.inventory.find(i => i.resource);
    app.openItemDetailModal(tracked.id);
    const html = app.__modals[app.__modals.length - 1].html;
    suite.ok("toggle", html.includes("detail-track-switch"), html.slice(0, 400));
    suite.ok("capacity", html.includes("if-res-max"), "no capacity field");
    suite.ok("refills from", html.includes("if-res-refill"), "no refill field");
    suite.ok("and a save", html.includes("detail-resource-save"), "no save button");
    suite.ok("no signpost to somewhere else", !html.includes("set on the Resources row"), "still pointing elsewhere");
  });

  suite.section("a control that can't do a thing doesn't offer it");

  suite.runs("with no capacity, All and Half are unavailable rather than warned about", () => {
    const html = app.rechargeFieldHtml("t", { on: "SR", amount: "all" }, { noMaximum: true });
    suite.ok("All disabled", /data-value="all" disabled/.test(html), html);
    suite.ok("Half disabled", /data-value="half" disabled/.test(html), html);
    suite.ok("Custom is not", !/data-value="custom" disabled/.test(html), html);
  });

  suite.runs("and it falls to Custom rather than sitting on a dead choice", () => {
    // greying an option the form is already set to would leave the broken
    // state selected and merely unclickable
    const html = app.rechargeFieldHtml("t", { on: "SR", amount: "all" }, { noMaximum: true });
    suite.ok("custom is active", /class="select-option active" data-value="custom"/.test(html), html);
    suite.ok("and the amount field is showing", html.includes("t-amount-custom"), html);
  });

  suite.runs("with a capacity, nothing is greyed", () => {
    const html = app.rechargeFieldHtml("t", { on: "SR", amount: "all" }, { noMaximum: false });
    suite.ok("nothing disabled", !/disabled/.test(html), html);
    suite.ok("All still active", /data-value="all"/.test(html), html);
  });

  suite.runs("the old warning is gone from the item form", () => {
    const html = app.itemResourceFieldsHtml({ max: 0, recharge: { on: "SR", amount: "all" } });
    suite.ok("no warning", !html.includes("do nothing here"), html);
    suite.ok("but the options are greyed", /data-value="all" disabled/.test(html), html);
  });

  suite.runs("selectFieldHtml only marks what it was told to", () => {
    const html = app.selectFieldHtml("x", "L", [
      { value: "a", label: "A" }, { value: "b", label: "B", disabled: true }
    ], "a");
    suite.ok("b disabled", /data-value="b" disabled/.test(html), html);
    suite.ok("a not", !/data-value="a" disabled/.test(html), html);
  });

  suite.section("an attack says what it is, in three lines");

  function attackHtml(name) {
    const weapon = app.character.inventory.find(i => i.name === name);
    app.openAttackDetailModal(weapon.id);
    return { weapon, html: app.__modals[app.__modals.length - 1].html };
  }

  suite.runs("line one is the weapon type and its reach", () => {
    const { html } = attackHtml("Longsword");
    suite.ok("melee", html.includes("Melee Weapon"), html.slice(0, 400));
    suite.ok("with range", html.includes("5 ft"), html.slice(0, 400));
    suite.ok("and not the old source line", !html.includes("Equipped \u2013"), html.slice(0, 400));
  });

  suite.runs("a ranged weapon says so", () => {
    const { html } = attackHtml("Shortbow");
    suite.ok("ranged", html.includes("Ranged Weapon"), html.slice(0, 400));
  });

  suite.runs("line two is the category with a mark, not a sentence", () => {
    const { html } = attackHtml("Longsword");
    suite.ok("category", html.includes("Martial"), html.slice(0, 500));
    suite.ok("a mark", html.includes("prof-yes") || html.includes("prof-no"), html.slice(0, 500));
    suite.ok("no prose", !html.includes("Requires") && !html.includes("not proficient"), html.slice(0, 500));
  });

  suite.runs("a weapon you can't use is marked, not explained", () => {
    const { html } = attackHtml("Serpent's Fang");
    suite.ok("cross", html.includes("prof-no"), html.slice(0, 500));
    suite.ok("named category", html.includes("Exotic"), html.slice(0, 500));
  });

  suite.runs("line three names the properties, and Finesse says which ability it landed on", () => {
    const { weapon, html } = attackHtml("Serpent's Fang");
    const atk = app.calculateAttack(app.character, weapon);
    suite.ok("annotated", html.includes("Finesse (" + atk.finesse + ")"), html.slice(0, 600));
    suite.ok("others plain", html.includes("Light"), html.slice(0, 600));
    // the rule itself is not restated
    suite.ok("no lecture", !html.includes("your better of"), html.slice(0, 600));
  });

  suite.runs("a weapon with no properties gets no empty line", () => {
    const plain = { id: 9911, name: "Club", isWeapon: true, category: "Equipped", weight: 2,
      weaponType: "melee", damage: [{ dice: "1d4", type: "Bludgeoning", ability: "STR" }], properties: [] };
    app.character.inventory.push(plain);
    const { html } = attackHtml("Club");
    const lines = html.split("breakdown-source").length - 1;
    suite.is("two lines, not three", lines, 2);
    app.character.inventory = app.character.inventory.filter(i => i.id !== 9911);
  });

  suite.section("switching grip redraws the numbers it changes");

  suite.runs("a versatile weapon rolls a bigger die in two hands", () => {
    const weapon = app.character.inventory.find(i => i.name === "Longsword");
    weapon.twoHanded = false;
    suite.is("one-handed", app.calculateAttack(app.character, weapon).damageNotation, "1d8+3");
    weapon.twoHanded = true;
    suite.is("two-handed", app.calculateAttack(app.character, weapon).damageNotation, "1d10+3");
    weapon.twoHanded = false;
  });

  suite.runs("and the open modal shows the grip it is actually set to", () => {
    // the toggle used to change the weapon and re-render the tab behind the
    // modal, leaving every number in front of the player showing the old grip
    const weapon = app.character.inventory.find(i => i.name === "Longsword");
    weapon.twoHanded = true;
    const { html } = attackHtml("Longsword");
    suite.ok("shows 1d10", html.includes("1d10+3"), html.slice(html.indexOf("Slashing"), html.indexOf("Slashing") + 400));
    weapon.twoHanded = false;
    const one = attackHtml("Longsword").html;
    suite.ok("and 1d8 back in one hand", one.includes("1d8+3"), one.slice(one.indexOf("Slashing"), one.indexOf("Slashing") + 400));
  });
};
