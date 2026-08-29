/* The creator's UX pass: one tap to pick, one component to pick with, a
   readable list of what arrives later, and a point-buy step that warns
   instead of forbidding.

   Everything here is markup and arithmetic, which is all the DOM stub can
   see -- no listener in the app is ever invoked by these tests. The wiring
   was checked by hand in Chromium; what these guard is that the markup
   those listeners hang off doesn't quietly change shape again. */

module.exports = function (suite) {
  const harness = require("./harness");
  const app = harness.loadApp();
  const css = harness.readFile("style.css");
  const {
    openCharacterCreator, creatorState, choiceCardHtml, creatorRaceChoices,
    raceStepHtml, classStepHtml, subclassStepHtml, backgroundStepHtml,
    abilityStepHtml, skillsStepHtml, equipmentStepHtml, resolveChoiceHtml,
    choiceOptionRowHtml, pointBuySpentAndExceeds, pointBuyCost
  } = app;

  // a fresh wizard, positioned wherever the test needs it
  function creator(overrides) {
    app.openCharacterCreator();
    Object.assign(app.creatorState, { started: true }, overrides || {});
    return app.creatorState;
  }


  /* ---------- 1. a choice with no extra text takes one tap ---------- */

  suite.section("picking an option is the option itself, not a button inside it");

  creator({ race: "Human" });
  const language = app.creatorRaceChoices().find(p => p.featureName === "Extra Language");
  const languageHtml = app.choiceCardHtml(language);

  suite.ok("the option row carries the pick", languageHtml.includes(`data-choice-pick="Extra Language|||Elvish"`));
  suite.ok("nothing says “Choose this” any more", !languageHtml.includes("Choose this"));
  suite.ok("nothing says “Selected” as a button label either", !/>\s*Selected\s*</.test(languageHtml));
  suite.ok("and nothing on the row but the name",
    !languageHtml.includes("creator-option-desc"),
    "a language option has nothing to read, so it renders no description slot");

  creator({ race: "Dragonborn" });
  const ancestry = app.creatorRaceChoices().find(p => p.featureName === "Draconic Ancestry");
  const ancestryHtml = app.choiceCardHtml(ancestry);

  suite.ok("the option is named by the dragon and nothing else",
    ancestryHtml.includes(`data-choice-pick="Draconic Ancestry|||Gold"`),
    "the row used to read 'Gold -- Fire, 15 ft. cone (Dex save)'");
  suite.ok("and no row carries the old inline summary",
    !ancestryHtml.includes("15 ft. cone (Dex save)"));
  suite.ok("nothing is expanded before anything is picked",
    !ancestryHtml.includes("creator-option-desc"),
    "ten dragons' breath weapons must not print at once");
  suite.ok("still nothing to confirm with", !ancestryHtml.includes("Choose this"));
  suite.ok("and no expander button anywhere", !ancestryHtml.includes("creator-option-info"));

  suite.section("a picked option says so on the row, and explains itself");
  app.creatorState.choiceAnswers["Draconic Ancestry"] = { chosen: ["Gold"] };
  const picked = app.choiceCardHtml(ancestry);
  suite.ok("the row is the active option row", /creator-option active/.test(picked));
  suite.ok("and carries a tick, so the state isn't colour alone",
    picked.includes(`<span class="creator-option-mark">✓</span>`));
  suite.ok("picking is what opens the description", picked.includes("creator-option-desc"));
  suite.ok("followed by the full breath weapon text", picked.includes("exhale fire in a 15-foot cone"));
  suite.ok("and only the picked one opens", (picked.match(/creator-option-desc/g) || []).length === 1);

  /* The inline cards and the standalone resolve-choice modal are the same
     decision asked in two places -- they render through the same helper now,
     so "consistent" is a property of the code rather than of two lists of
     assertions that have to be kept in step by hand. */
  suite.section("the creator's cards and the resolve-choice modal are the same component");

  const row = app.choiceOptionRowHtml("Gold", "Gold", {
    desc: "Fire, 15 ft. cone.", selected: false, pickAttr: "choice-pick"
  });
  suite.ok("choiceOptionRowHtml builds the shared row", row.includes("creator-option-row"));

  let modalCharacter = {
    classes: [{ name: "Ranger", level: 1, subclass: "Hunter", hitDie: "d10" }],
    traits: { "Class Features": [], "Race Traits": [], Background: [], Other: [] },
    pendingChoices: []
  };
  app.grantFeatures(modalCharacter, app.featuresAtLevel("Ranger", "Hunter", 3));
  const preyChoice = modalCharacter.pendingChoices.find(p => p.featureName === "Hunter's Prey");
  app.choiceSelected = [];
  const modalHtml = app.resolveChoiceHtml(preyChoice);

  suite.ok("the modal renders option rows too", modalHtml.includes("creator-option-row"));
  suite.ok("with the same option class", modalHtml.includes("creator-option "));
  suite.ok("and no Choose this button of its own", !modalHtml.includes("Choose this"));
  suite.ok("its options are pickable in one tap", modalHtml.includes(`data-choice-option="Colossus Slayer"`));
  suite.ok("and reading one is the same tap as picking it",
    !modalHtml.includes("creator-option-info") && !modalHtml.includes("creator-option-desc"),
    "nothing is open until something is picked");

  // a language resolved from the Character tab banner rather than the builder
  // is the same no-description case, and has to behave the same way
  let bannerCharacter = JSON.parse(JSON.stringify(app.character));
  bannerCharacter.languages = ["Common"];
  const beforeCharacter = app.character;
  app.character = bannerCharacter;
  const languageModal = app.resolveChoiceHtml({
    id: 1, kind: "language", count: 1, prompt: "Choose an extra language",
    source: "Extra Language", featureName: "Extra Language", traitCategory: "Race Traits"
  });
  app.character = beforeCharacter;
  suite.ok("the modal's languages are one tap as well", languageModal.includes(`data-choice-option="Elvish"`));
  suite.ok("with no expander onto an empty body", !languageModal.includes("data-choice-expand"));


  /* ---------- 2. one option component across every step ---------- */

  suite.section("every step picks with the same control");

  creator({ race: "Half-Elf", charClass: "Cleric", subclass: "Life Domain", background: "Acolyte" });
  const steps = {
    race: app.raceStepHtml(1),
    class: app.classStepHtml(2),
    subclass: app.subclassStepHtml(3),
    background: app.backgroundStepHtml(4),
    equipment: app.equipmentStepHtml(7)
  };

  Object.keys(steps).forEach(name => {
    suite.ok("the " + name + " step's options are .creator-option rows",
      steps[name].includes(`class="creator-option `));
    suite.ok("the " + name + " step's options carry no inline styling",
      !/class="creator-option[^"]*"[^>]*style=/.test(steps[name]),
      "an inline style on the shared control is how six variants happened last time");
  });

  suite.ok("and none of them is a .toggle-btn any more",
    !Object.keys(steps).some(name => steps[name].includes("toggle-btn")));

  suite.section("the skills step joins the same rhythm");
  const skills = app.skillsStepHtml(6);
  suite.ok("its rows are option-height", skills.includes("creator-skill-row"));
  suite.ok("each grant column is a full cell, not a bare 18px box", skills.includes("creator-skill-cell"));
  suite.ok("and the checkbox inside it is still the app's own mini-checkbox",
    skills.includes("mini-checkbox"));
  suite.ok("the cell stretches the checkbox's tap area to the cell",
    /\.creator-skill-cell \.mini-checkbox::before/.test(css));

  suite.section("the shared control is defined once, in CSS");
  suite.ok("style.css defines .creator-option", /\n\.creator-option \{/.test(css));
  suite.ok("with a finger-sized minimum height", /\.creator-option \{[^}]*min-height: 46px/.test(css));
  suite.ok("and a selected state", /\.creator-option\.active \{/.test(css));


  /* ---------- 3. Later Levels is a list, not chips ---------- */

  suite.section("what arrives later reads straight down");

  creator({ charClass: "Fighter" });
  const fighter = app.classStepHtml(2);
  suite.ok("the class step still names the later features", fighter.includes("Extra Attack"));
  suite.ok("as a two-column list", fighter.includes(`<div class="level-list">`));
  suite.ok("level in its own cell", fighter.includes(`<span class="level-list-level">5</span>`));
  suite.ok("feature name in the next", fighter.includes(`<span class="level-list-name">Extra Attack</span>`));
  suite.ok("one row per level", (fighter.match(/class="level-list-row /g) || []).length === 12,
    "found " + (fighter.match(/class="level-list-row /g) || []).length);
  // each row is the control that opens its own description, the way Class
  // Features above it already read
  suite.ok("every row is tappable", (fighter.match(/data-later-level=/g) || []).length === 12);
  suite.ok("nothing is expanded until one is tapped", !fighter.includes("level-list-desc"));
  suite.ok("no chips left in the Later Levels block",
    !/Later Levels[\s\S]{0,200}chip/.test(fighter));
  suite.ok("and no “Lv 5 ·” chip label", !fighter.includes("Lv 5 ·"));

  suite.ok("the levels column is right-aligned and narrow",
    /\.level-list-level \{[^}]*text-align: right/.test(css) &&
    /\.level-list-level \{[^}]*flex: 0 0 26px/.test(css));

  app.creatorState.openLaterLevel = "5|Extra Attack";
  const opened = app.classStepHtml(2);
  suite.ok("tapping a row opens that feature's own text",
    opened.includes("level-list-desc") && /attack twice/i.test(opened));
  suite.ok("and only that one", (opened.match(/level-list-desc/g) || []).length === 1);
  app.creatorState.openLaterLevel = null;

  creator({ charClass: "Cleric", subclass: "Life Domain" });
  suite.ok("the subclass step uses the same list",
    app.subclassStepHtml(3).includes(`<span class="level-list-name">Blessed Healer</span>`));


  /* ---------- 4. point buy warns, it does not forbid ---------- */

  suite.section("the point-buy stepper has no ceiling");

  creator({ race: "Human", charClass: "Fighter", background: "Soldier" });
  app.creatorState.scores = { Strength: 24, Dexterity: 8, Constitution: 8, Intelligence: 8, Wisdom: 8, Charisma: 8 };
  const overCap = app.abilityStepHtml(4);
  suite.ok("a score above 20 renders", overCap.includes(">24<"));
  suite.ok("and totals with the racial bonus on top", overCap.includes(">25<"));
  suite.ok("the cost curve keeps climbing past 20", app.pointBuyCost(24) > app.pointBuyCost(20));
  suite.ok("and the step knows it is outside point buy", app.pointBuySpentAndExceeds().exceeds);

  /* The stepper's own +1 is a click handler, which the stub never fires --
     what a test can see is that no ceiling is written into it. */
  suite.ok("nothing clamps the stepper at 20 any more",
    !/asPlus[\s\S]{0,200}Math\.min\(20/.test(harness.readFile("creator.js")));

  suite.section("the warning is worded as information");
  suite.ok("exactly the agreed sentence",
    overCap.includes("Exceeds standard point-buy limits. Character will be marked as custom."));
  suite.ok("nothing calls the character illegal any more",
    !overCap.includes("not legal") && !overCap.includes("marked custom /"));
  suite.ok("it is a warning, not a danger",
    overCap.includes(`class="creator-warning"`) && !overCap.includes("danger-text"));

  creator({ race: "Human", charClass: "Fighter", background: "Soldier" });
  app.creatorState.scores = { Strength: 15, Dexterity: 14, Constitution: 13, Intelligence: 12, Wisdom: 10, Charisma: 8 };
  suite.ok("a legal spread shows no warning at all",
    !app.abilityStepHtml(4).includes("creator-warning"));
  suite.is("and spends exactly the standard 27", app.pointBuySpentAndExceeds().spent, 27);

  suite.section("the level-up ASI cap is a different rule and still holds");
  suite.is("the SRD's own ceiling is unchanged", app.ABILITY_SCORE_CAP, 20);
  let asiCharacter = JSON.parse(JSON.stringify(app.character));
  asiCharacter.abilities.STR = 19;
  const trimmed = app.cappedAbilityEffects(asiCharacter, [
    { category: "Ability Score", value: { ability: "STR", amount: 2 } }
  ]);
  suite.ok("a +2 onto a 19 is trimmed to +1", trimmed.trimmed &&
    trimmed.effects[0].value.amount === 1);

  suite.section("the cautionary colour is a real theme token");
  const themeBlocks = {};
  css.replace(/(?::root,\s*)?\[data-theme="([a-z]+)"\]\s*\{([^}]*)\}/g, (all, name, body) => {
    themeBlocks[name] = (themeBlocks[name] || "") + body;
    return all;
  });
  ["ember", "fantasy", "light"].forEach(name => {
    suite.ok(name + " defines --warning-text", /--warning-text:/.test(themeBlocks[name] || ""));
    suite.ok(name + " defines --warning-tint", /--warning-tint:/.test(themeBlocks[name] || ""));
  });

  function channel(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * channel(n >> 16 & 255) + 0.7152 * channel(n >> 8 & 255) + 0.0722 * channel(n & 255);
  }
  function contrast(a, b) {
    const one = luminance(a), two = luminance(b);
    return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
  }
  function tokenOf(theme, variable) {
    const match = (themeBlocks[theme] || "").match(new RegExp(variable + ":\\s*(#[0-9A-Fa-f]{6})"));
    return match ? match[1] : null;
  }
  // the warning renders on its own tint, inside a modal drawn on --surface,
  // so it has to clear 4.5:1 against both
  ["ember", "fantasy", "light"].forEach(name => {
    const text = tokenOf(name, "--warning-text");
    const onTint = contrast(text, tokenOf(name, "--warning-tint"));
    const onSurface = contrast(text, tokenOf(name, "--surface"));
    suite.ok(name + " warning text clears 4.5:1 on its own tint", onTint >= 4.5, "ratio " + onTint.toFixed(2));
    suite.ok(name + " warning text clears 4.5:1 on a card", onSurface >= 4.5, "ratio " + onSurface.toFixed(2));
  });
};
