/* ============================================================
   CHARACTER CREATOR (POC — fake SRD-style content, faked list entry on confirm)
   ============================================================ */

let creatorState = null;

function openCharacterCreator() {
  creatorState = {
    started: false,               // hasn't chosen build-from-scratch vs. import yet
    step: 0, name: "", appearance: "", backstory: "",
    race: null, subrace: null, charClass: null, subclass: null, background: null,
    scores: {},
    raceSkillChoices: [], classSkillChoices: [], equipment: [],
    choiceAnswers: {},        // featureName -> { chosen: [...] } or { manual: "..." }
    openLaterLevel: null,     // the one Later Levels row expanded right now
    customOrigin: false,      // the optional "assign +2/+1 yourself" origin rule
    asiBonus: { plus2: null, plus1: null },
    customBuild: false
  };
  openModal("full", "");
  // a full wizard's worth of picks used to vanish on one stray backdrop tap,
  // one tap on the drag handle, or a short drag-down, with nothing asked --
  // ui.js routes all three through the guard so a started build can object
  window.modalDismissGuard = creatorDismissGuard;
  redrawCreator();
}

/* Contract with ui.js's dismissModal(): returning false cancels a
   user-initiated dismissal. Only a wizard that's actually underway asks --
   backing out of the "Build or Import?" screen has nothing to lose.

   The ask is confirmModal(), the app's own dialog, which can't block. So the
   guard always cancels this dismissal and the dialog closes the wizard itself
   if the player says yes -- there is no answer to return synchronously. */
function creatorDismissGuard() {
  if (!creatorState || !creatorState.started) return true;
  confirmModal({
    title: "Discard this character?",
    body: "Everything you've picked so far will be lost.",
    confirmLabel: "Discard", danger: true,
    onConfirm: () => { window.modalDismissGuard = null; closeModal(); }
  });
  return false;
}

function cancelCharacterCreator() {
  if (creatorDismissGuard() === true) closeCreatorModal();
}

// finishing the wizard is not a dismissal -- drop the guard before the modal
// closes so it can't outlive the build it was protecting
function closeCreatorModal() {
  window.modalDismissGuard = null;
  closeModal();
}

// .modal-box is the scroller, and it is shared across every step, so without
// this a step you scrolled to the bottom of hands the next one its scroll
// position and the new heading opens already off-screen
function scrollCreatorToTop() {
  const box = document.querySelector("#modal-overlay .modal-box");
  if (box) box.scrollTop = 0;
}

function redrawCreator() {
  const box = document.querySelector("#modal-overlay .modal-content");
  // the tutorial's "creation" phase renders inline here rather than as a
  // floating overlay -- this modal is modal-full (94% of the phone), so a
  // floating banner would fight it for space. See tutorial.js's own header
  // comment for the rest of the reasoning. The start screen gets the same
  // slot as the steps do: the tour sends you here, so this is where its Skip
  // has to be reachable.
  if (!creatorState.started) {
    box.innerHTML = tutorialInlineHtml() + creatorStartHtml();
    wireCreatorStart();
    wireTutorialInline();
    return;
  }
  box.innerHTML = tutorialInlineHtml() + creatorStepHtml();
  wireCreatorStep();
  wireTutorialInline();
}

/* ---------- step: start (build from scratch, or import) ----------

   Import used to be its own button on the character list, next to New
   Character but doing something unrelated to it. Both are really the same
   action -- "get a new character onto the list" -- so New Character is now
   the one entry point and this is the first thing it asks. */

function creatorStartHtml() {
  return `
    <div class="modal-heading">New Character</div>
    <div class="breakdown-source" style="margin-bottom:14px;">Build one from scratch, or bring one in from a file.</div>
    <button class="btn-primary" id="creator-build-button" style="margin-bottom:8px;">Build a Character</button>
    <button class="btn-secondary" id="creator-import-button">Import from File</button>
    <input type="file" id="creator-import-input" accept=".json" style="display:none;">
  `;
}

/* An imported file becomes `character` and every tab dereferences it
   immediately, so "has a name and an abilities object" was nowhere near
   enough -- a half-shaped file got half-imported and then took a tab down
   with it. This checks the fields the app actually reads, and returns the
   first problem as a sentence to show the player rather than importing
   anything. Deliberately not a schema library: the list below is exactly
   what the renderers and calculations assume exists. */
const IMPORT_REQUIRED_OBJECTS = ["abilities", "traits", "skillProficiency", "skillOverride",
  "savingThrowProficiency", "savingThrowOverride", "skillAbilityMap", "spellSlots",
  "maxPreparedByClass", "categoryRules", "hp", "inspiration", "hitDiceSpent"];
const IMPORT_REQUIRED_ARRAYS = ["classes", "spells", "inventory", "activeEffects", "resources",
  "languages", "weaponProficiencies", "pendingChoices", "maxHpModifiers", "notes", "noteSections"];

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateImportedCharacter(c) {
  if (!isPlainObject(c)) return "That doesn't look like a character";
  if (typeof c.name !== "string" || !c.name.trim()) return "That character has no name";

  const missingObject = IMPORT_REQUIRED_OBJECTS.find(key => !isPlainObject(c[key]));
  if (missingObject) return "That character is missing its " + missingObject;
  const missingArray = IMPORT_REQUIRED_ARRAYS.find(key => !Array.isArray(c[key]));
  if (missingArray) return "That character is missing its " + missingArray;

  const badAbility = Object.keys(ABILITY_FULL_NAMES).find(a => typeof c.abilities[a] !== "number");
  if (badAbility) return "That character's " + badAbility + " score is missing or isn't a number";

  if (!c.classes.length) return "That character has no classes";
  const badClass = c.classes.find(entry => !isPlainObject(entry) ||
    typeof entry.name !== "string" || !entry.name.trim() || typeof entry.level !== "number");
  if (badClass) return "Every class needs a name and a level";

  if (typeof c.hp.current !== "number" || typeof c.baseMaxHP !== "number") return "That character's hit points are missing";

  if (!isPlainObject(c.spellcasting) || !Array.isArray(c.spellcasting.classes)) return "That character's spellcasting is malformed";
  const badCaster = c.spellcasting.classes.find(entry => !isPlainObject(entry) ||
    typeof entry.name !== "string" || typeof entry.ability !== "string");
  if (badCaster) return "Every spellcasting class needs a name and an ability";

  const casters = c.spellcasting.classes.map(entry => entry.name);
  const badSpell = c.spells.find(s => !isPlainObject(s) || typeof s.name !== "string" || typeof s.level !== "number");
  if (badSpell) return "Every spell needs a name and a level";
  // castSpell() looks a spell's class up in spellcasting.classes to find the
  // ability its attack roll uses, so a spell naming a class this character
  // doesn't cast is a crash waiting on a tap
  const orphan = c.spells.find(s => s.attackRoll && !casters.includes(s.classSource));
  if (orphan) return "“" + orphan.name + "” rolls to hit for a class this character doesn't cast";

  const badSlot = Object.keys(c.spellSlots).find(level => {
    const slot = c.spellSlots[level];
    return !isPlainObject(slot) || typeof slot.current !== "number" || typeof slot.max !== "number";
  });
  if (badSlot) return "That character's level " + badSlot + " spell slots are malformed";

  return null;
}

function wireCreatorStart() {
  document.getElementById("creator-build-button").addEventListener("click", () => {
    creatorState.started = true;
    redrawCreator();
  });

  const fileInput = document.getElementById("creator-import-input");
  document.getElementById("creator-import-button").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (err) {
        showToast("That file isn't valid JSON");
        return;
      }
      const problem = validateImportedCharacter(parsed);
      if (problem) { showToast(problem); return; }
      // an imported character gets a fresh id so it can't collide with one you already have
      parsed.id = nextCharacterId();
      savedCharacters.push(parsed);
      selectCharacter(parsed.id);
      closeCreatorModal();
      showScreen("sheet");
      showToast("Imported " + parsed.name);
    };
    reader.onerror = () => showToast("Couldn't read that file");
    reader.readAsText(file);
  });
}

function pointBuyCost(v) {
  if (v in POINT_BUY_COST) return POINT_BUY_COST[v];
  if (v < 8) return 0;
  return 9 + (v - 15) * 3;
}

// race features plus the chosen subrace's, the pair every step that reads a
// race needs
function creatorRaceFeatures() {
  const race = raceByName(creatorState.race);
  const subrace = subracesFor(race).find(s => s.name === creatorState.subrace);
  return (race ? race.features : []).concat(subrace ? subrace.features : []);
}

/* The racial ability score increase has exactly one owner: the race's own
   "Ability Score Increase" feature, whose `effects` ride into
   traits["Race Traits"] and get summed by effectiveAbilityScore(). The
   creator used to ALSO bake a free +2/+1 of its own into
   character.abilities, so every racial bonus landed twice -- a Dragonborn
   with a 15 Strength read 19 instead of 17, and a Human's whole row was a
   point high. character.abilities is now the point-buy score and nothing
   else, exactly what the sheet's own "Base Score" field means, and this is
   what the wizard adds on top so it shows the same number the sheet will. */
/* A race feature that raises an ability score, whether it says so outright
   (Dragonborn's +2 Strength) or hands part of it over as a choice (Half-Elf's
   "two other ability scores of your choice"). The optional origin rule below
   replaces exactly these -- both halves, or a Half-Elf would keep its two
   free +1s on top of the +2/+1 the player assigned. */
function originAssignmentSummary() {
  const parts = [];
  if (creatorState.asiBonus.plus2) parts.push("+2 " + creatorState.asiBonus.plus2);
  if (creatorState.asiBonus.plus1) parts.push("+1 " + creatorState.asiBonus.plus1);
  return parts.join(", ");
}

function creatorIsAbilityFeature(feature) {
  const fixed = (feature.effects || []).some(e => e.category === "Ability Score");
  const chosen = feature.choice && feature.choice.kind === "custom" &&
    (feature.choice.options || []).some(o => (o.effects || []).some(e => e.category === "Ability Score"));
  return !!(fixed || chosen);
}

/* The +2/+1 the player assigned, as effects in the same shape a race's own
   increase uses -- so whichever rule is in play, the score has exactly one
   owner and the sheet's breakdown names it the same way. */
function creatorCustomOriginEffects() {
  const out = [];
  const add = (ability, amount) => {
    if (ability) out.push({ category: "Ability Score", value: { ability: ABILITY_ABBREVIATIONS[ability], amount } });
  };
  add(creatorState.asiBonus.plus2, 2);
  add(creatorState.asiBonus.plus1, 1);
  return out;
}

function creatorRacialBonusFor(ability) {
  const abbreviation = ABILITY_ABBREVIATIONS[ability];
  let bonus = 0;
  if (creatorState.customOrigin) {
    return (creatorState.asiBonus.plus2 === ability ? 2 : 0)
         + (creatorState.asiBonus.plus1 === ability ? 1 : 0);
  }
  const add = effects => (effects || []).forEach(e => {
    if (e.category === "Ability Score" && e.value.ability === abbreviation) bonus += resolveScalingValue(e.value.amount, 1);
  });

  creatorRaceFeatures().forEach(f => {
    add(f.effects);
    // a race can hand part of its increase over as a choice instead (Half-Elf's
    // "two other ability scores of your choice") -- count the answer, since
    // that's what buildCharacterFromCreator will apply
    const answer = (creatorState.choiceAnswers || {})[f.name];
    if (f.choice && f.choice.kind === "custom" && answer && answer.chosen) {
      answer.chosen.forEach(label => {
        const option = (f.choice.options || []).find(o => o.label === label);
        if (option) add(option.effects);
      });
    }
  });
  return bonus;
}

function finalScoreFor(ability) {
  return (creatorState.scores[ability] ?? 8) + creatorRacialBonusFor(ability);
}

function pointBuySpentAndExceeds() {
  let spent = 0, exceeds = false;
  CREATOR_ABILITY_ORDER.forEach(a => {
    const v = creatorState.scores[a] ?? 8;
    spent += pointBuyCost(v);
    if (v < 8 || v > 15) exceeds = true;
  });
  if (spent > POINT_BUY_LIMIT) exceeds = true;
  return { spent, exceeds };
}

function featureRowHtml(f) {
  return `<div class="trait-item" style="border-top:1px solid var(--border);padding:8px 0;">
    <div class="trait-name">${f.name}</div>
    <div class="trait-desc">${f.desc}</div>
  </div>`;
}

/* Same markup, escaped -- for a feature list that might include Custom
   Content (a homebrew subclass's own features) rather than only the app's
   own SRD data. featureRowHtml is left unescaped and SRD-only on purpose;
   subclassStepHtml is the one place a feature list can now carry either
   kind, since subclassesForClass() merges Custom Content subclasses in
   alongside a class's own SRD ones. */
function featureRowEscHtml(f) {
  return `<div class="trait-item" style="border-top:1px solid var(--border);padding:8px 0;">
    <div class="trait-name">${esc(f.name)}</div>
    <div class="trait-desc">${esc(f.desc)}</div>
  </div>`;
}

/* The one row the whole wizard picks with -- race, subrace, class, subclass,
   background, starting kit, and (via choiceOptionRowHtml) every granted
   choice's options. It used to be .toggle-btn plus five inline style
   declarations, which is why the same control had a different height, type
   scale and text colour depending on which step you were looking at. The
   look lives in .creator-option now and nowhere else, so it can't drift
   apart again. */
function optionButtonHtml(label, active, dataAttr, value) {
  return `<button type="button" class="creator-option ${active ? "active" : ""}" data-${dataAttr}="${esc(value)}">
    <span class="creator-option-label">${esc(label)}</span>
    <span class="creator-option-mark">${active ? "✓" : ""}</span>
  </button>`;
}

/* Every race/class-1 feature carrying a `.choice` descriptor (srd-data.js),
   in the same shape pendingChoiceFor() (rests.js) turns a granted feature
   into once the character actually exists. Computed straight from
   creatorState rather than a half-built character, since a choice has to be
   answerable before there's anything to grant it to.

   Split by source and step rather than one flat list: a choice is asked
   right after the pick that granted it -- a race's own choices (Dragonborn's
   ancestry, Half-Elf's ASI split) on the Race step, a class's own choices
   (Fighting Style) on the Class step, a subclass's own on the Subclass step
   -- instead of dumping everything into one "Choices" step at the end of the
   wizard. The one exception is "skill" kind: Expertise-style "pick skills
   you're proficient in" (and Half-Elf's Skill Versatility) can't be answered
   until Skills has actually run, since its options are which skills ended up
   known -- those still collect into creatorSkillChoices() for the trailing
   step, same as the whole set used to. */
function creatorRaceChoices() {
  const out = [];
  creatorRaceFeatures().forEach(f => {
    // an ability-score choice the optional origin rule has replaced is not a
    // choice any more -- asking would stack it on top of the assigned +2/+1
    if (creatorState.customOrigin && creatorIsAbilityFeature(f)) return;
    if (f.choice && f.choice.kind !== "skill") out.push(Object.assign({ traitCategory: "Race Traits", featureName: f.name }, f.choice));
  });
  return out;
}

/* The race choices the origin rule replaces, listed regardless of whether the
   rule is currently on -- creatorRaceChoices() hides them while it is, and
   the toggle needs to clear their answers in both directions. */
function creatorRaceAbilityChoices() {
  const out = [];
  creatorRaceFeatures().forEach(f => {
    if (f.choice && creatorIsAbilityFeature(f)) {
      out.push(Object.assign({ traitCategory: "Race Traits", featureName: f.name }, f.choice));
    }
  });
  return out;
}

function creatorClassChoices() {
  const cls = classByName(creatorState.charClass);
  if (!cls) return [];
  const out = [];
  (cls.features || []).filter(f => f.level === 1).forEach(f => {
    if (f.choice && f.choice.kind !== "skill") out.push(Object.assign({ traitCategory: "Class Features", featureName: f.name }, f.choice));
  });
  return out;
}

function creatorSubclassChoices() {
  const subclass = creatorState.subclass
    ? subclassesForClass(creatorState.charClass).find(s => s.name === creatorState.subclass) : null;
  if (!subclass) return [];
  const out = [];
  (subclass.features || []).filter(f => f.level === 1).forEach(f => {
    if (f.choice && f.choice.kind !== "skill") out.push(Object.assign({ traitCategory: "Class Features", featureName: f.name }, f.choice));
  });
  return out;
}

function creatorSkillChoices() {
  const classFeatures = creatorState.charClass ? featuresAtLevel(creatorState.charClass, creatorState.subclass, 1) : [];

  const out = [];
  creatorRaceFeatures().forEach(f => { if (f.choice && f.choice.kind === "skill") out.push(Object.assign({ traitCategory: "Race Traits", featureName: f.name }, f.choice)); });
  classFeatures.forEach(f => { if (f.choice && f.choice.kind === "skill") out.push(Object.assign({ traitCategory: "Class Features", featureName: f.name }, f.choice)); });
  return out;
}


/* Every source that can grant a skill proficiency, as one list.

   The Skills step used to know about exactly two -- your race and your class --
   and a feature that granted skills (Half-Elf's Skill Versatility) was routed
   through the generic "what your features grant" step instead. So the wizard
   asked "choose two skills" twice, in two different shapes, on two screens,
   the second one after you had already finished picking skills. Same question,
   so it belongs on the same screen.

   Expertise is deliberately NOT here: it picks from skills you already have,
   so it genuinely has to come after this step. Only choices that hand out new
   proficiencies (`grants: "proficiency"`) join the grid. */
function creatorSkillSources() {
  const sources = [];
  const race = raceByName(creatorState.race);
  const cls = classByName(creatorState.charClass);

  if (race && race.skillChoice) {
    sources.push({ key: "race-skill", label: "Race", count: race.skillChoice.count,
      options: race.skillChoice.options, chosen: creatorState.raceSkillChoices });
  }
  if (cls && cls.skillChoices) {
    sources.push({ key: "class-skill", label: "Class", count: cls.skillChoices.count,
      options: cls.skillChoices.options, chosen: creatorState.classSkillChoices });
  }
  creatorFeatureSkillChoices().forEach(choice => {
    if (!creatorState.choiceAnswers[choice.featureName]) creatorState.choiceAnswers[choice.featureName] = { chosen: [] };
    const answer = creatorState.choiceAnswers[choice.featureName];
    if (!answer.chosen) answer.chosen = [];
    sources.push({ key: "feature-skill", label: choice.featureName, count: choice.count,
      options: ALL_SKILL_NAMES, chosen: answer.chosen, featureName: choice.featureName });
  });
  return sources;
}

// the skill choices that hand out new proficiencies, which the Skills step
// absorbs -- the rest still belong to the generic choices step
function creatorFeatureSkillChoices() {
  return creatorSkillChoices().filter(c => c.grants === "proficiency");
}

function creatorPendingChoiceList() {
  return creatorSkillChoices().filter(c => c.grants !== "proficiency");
}

function creatorStepKeys() {
  const keys = ["race", "class"];
  // every class used to be made to pick one here, and then shown the whole
  // level 3-18 feature list as if it all arrived at once
  if (subclassChoiceLevel(creatorState.charClass) === 1) keys.push("subclass");
  keys.push("background", "ability", "skills");
  if (creatorPendingChoiceList().length) keys.push("choices");
  if (STARTING_KIT[creatorState.charClass]) keys.push("equipment");
  keys.push("final");
  return keys;
}

function currentStepKey() {
  const keys = creatorStepKeys();
  return keys[Math.min(creatorState.step, keys.length - 1)];
}

function goNext() {
  const keys = creatorStepKeys();
  creatorState.step = Math.min(creatorState.step + 1, keys.length - 1);
  redrawCreator();
  scrollCreatorToTop();
}

function goBack() {
  creatorState.step = Math.max(creatorState.step - 1, 0);
  redrawCreator();
  scrollCreatorToTop();
}

/* Every step's heading, and the one exit that's always on screen. The step
   line deliberately has no "of N": creatorStepKeys() is recomputed from the
   current state every render, so the total genuinely changes as you pick
   (Race opened "1 of 6", choosing Half-Elf made it 7, choosing Wizard 9).
   A total that moves under you reads as a broken progress bar, so the step
   says where you are and what you're doing and promises nothing it can't
   keep. */
function creatorHeaderHtml(title, stepLabel) {
  return `
    <div class="section-head-row" style="margin-bottom:2px;">
      <div class="modal-heading" style="margin:0;">${esc(title)}</div>
      <button class="add-link" id="creator-cancel-button">Cancel</button>
    </div>
    <div class="breakdown-source">${esc(stepLabel)}</div>`;
}

function creatorStepLabel(stepNum, name) {
  return "Step " + stepNum + " · " + name;
}

/* Every step ends with the same pair of buttons. The last one says something
   else and carries its own id, because it does something else. The Race step
   has nothing to go back to, so its Back is the app's own greyed-out
   .btn-disabled rather than missing -- the row keeps its shape, and the way
   out of step one is Cancel, up in the header. */
function creatorNavHtml(next) {
  const { id = "creator-next-button", label = "Next", back = true } = next || {};
  return `
    <div class="btn-row-2" style="margin-top:14px;">
      <button class="btn-secondary ${back ? "" : "btn-disabled"}" id="creator-back-button">Back</button>
      <button class="btn-primary" id="${id}">${esc(label)}</button>
    </div>`;
}

/* A class or subclass hands over one feature at 1st level and a dozen more
   over the next nineteen. Printing them in one undifferentiated list read as
   "here is what you get now" -- a Wizard applicant saw Signature Spells next
   to Arcane Recovery. What you get now is spelled out; what's still ahead is
   named with the level it arrives at and nothing more.

   That "still ahead" list was a chip row, which was wrong three ways: chips
   flow-wrap, so nineteen levels read left-to-right-then-down instead of
   straight down; the entries run from "Extra Attack" to "Ability Score
   Improvement (Level 19)", so wrapping left ragged holes; and a chip looks
   tappable when nothing here is. It is a sequential list of level-to-feature
   pairs, so it renders as one -- levels right-aligned in their own narrow
   column, names in the second, one row each, and a good deal shorter. */
function featuresByLevelHtml(features, rowHtml) {
  const now = features.filter(f => (f.level || 1) === 1);
  const later = features.filter(f => (f.level || 1) > 1).sort((a, b) => a.level - b.level);
  return `
    ${now.length ? now.map(rowHtml).join("") : `<div class="empty-hint">Nothing at 1st level.</div>`}
    ${later.length ? `
      <div class="breakdown-subhead">Later Levels</div>
      <div class="level-list">${later.map((f, i) => {
        const key = f.level + "|" + f.name;
        const open = creatorState.openLaterLevel === key;
        return `
        <button type="button" class="level-list-row ${open ? "open" : ""}" data-later-level="${esc(key)}">
          <span class="level-list-level">${f.level}</span>
          <span class="level-list-name">${esc(featureNameWithoutLevel(f))}</span>
        </button>
        ${open ? `<div class="level-list-desc">${esc(f.desc)}</div>` : ""}`;
      }).join("")}</div>
    ` : ""}`;
}


/* Several SRD features disambiguate repeats in their own name -- "Ability
   Score Improvement (Level 6)". In a list whose first column is the level,
   that repeats the column, so it comes off. Only when it matches the level
   actually being shown: a "(Level 6)" against level 4 would be real. */
function featureNameWithoutLevel(feature) {
  const suffix = " (Level " + feature.level + ")";
  return feature.name.endsWith(suffix) ? feature.name.slice(0, -suffix.length) : feature.name;
}


/* ---------- step: race ---------- */

function raceStepHtml(stepNum) {
  const race = raceByName(creatorState.race);
  const subraces = subracesFor(race);
  const chosenSubrace = subraces.find(sr => sr.name === creatorState.subrace);
  return `
    ${creatorHeaderHtml("New Character", creatorStepLabel(stepNum, "Race"))}
    <div style="margin-top:10px;">
      ${allRaces().map(r => optionButtonHtml(r.name, creatorState.race === r.name, "race-option", r.name)).join("")}
    </div>
    ${race ? `
      ${subraces.length ? `
        <div class="breakdown-subhead">Subrace</div>
        ${subraces.map(sr => optionButtonHtml(sr.name, creatorState.subrace === sr.name, "subrace-option", sr.name)).join("")}
      ` : ""}
      <div class="breakdown-subhead">Racial Features</div>
      ${(race.features || []).map(featureRowEscHtml).join("")}
      ${chosenSubrace ? (chosenSubrace.features || []).map(featureRowEscHtml).join("") : ""}
      ${race.skillChoice ? `<div class="item-effect" style="margin-top:8px;">Grants ${race.skillChoice.count} bonus skill proficiency \u2014 chosen in the Skills step.</div>` : ""}
      ${choiceCardsHtml(creatorRaceChoices(), "Choices")}
    ` : ""}
    ${creatorNavHtml({ back: false })}
  `;
}

function wireRaceStep() {
  document.querySelectorAll("[data-race-option]").forEach(btn => {
    btn.addEventListener("click", () => {
      clearChoiceAnswers(creatorRaceChoices());
      creatorState.race = btn.dataset.raceOption;
      creatorState.subrace = null;
      creatorState.raceSkillChoices = [];
      redrawCreator();
    });
  });
  document.querySelectorAll("[data-subrace-option]").forEach(btn => {
    btn.addEventListener("click", () => {
      clearChoiceAnswers(creatorRaceChoices());
      creatorState.subrace = btn.dataset.subraceOption;
      redrawCreator();
    });
  });
  wireChoiceCards(creatorRaceChoices());
  document.getElementById("creator-next-button").addEventListener("click", () => {
    if (!creatorState.race) { showToast("Choose a race to continue"); return; }
    if (subracesFor(raceByName(creatorState.race)).length && !creatorState.subrace) { showToast("Choose a subrace to continue"); return; }
    const unresolved = firstUnresolvedChoice(creatorRaceChoices());
    if (unresolved) { showToast("Resolve \u201c" + unresolved.prompt + "\u201d to continue"); return; }
    goNext();
  });
}


/* ---------- step: class ---------- */

function classStepHtml(stepNum) {
  const cls = classByName(creatorState.charClass);
  const subclassLevel = subclassChoiceLevel(creatorState.charClass);
  return `
    ${creatorHeaderHtml("New Character", creatorStepLabel(stepNum, "Class"))}
    <div style="margin-top:10px;">
      ${allClasses().map(c => optionButtonHtml(c.name, creatorState.charClass === c.name, "class-option", c.name)).join("")}
    </div>
    ${cls ? `
      <div class="trait-desc" style="margin:10px 0;">${esc(cls.description || "")}</div>
      <div class="breakdown-row"><span>Hit Die</span><span>${esc(cls.hitDie || "")}</span></div>
      <div class="breakdown-row"><span>Saving Throws</span><span>${esc((cls.saves || []).join(", "))}</span></div>
      <div class="breakdown-row"><span>Armor</span><span>${esc(cls.armorProf || "")}</span></div>
      <div class="breakdown-row"><span>Weapons</span><span>${esc(cls.weaponProf || "")}</span></div>
      ${cls.toolProf ? `<div class="breakdown-row"><span>Tools</span><span>${esc(cls.toolProf)}</span></div>` : ""}
      ${subclassLevel && subclassLevel > 1 ? `<div class="breakdown-row"><span>Subclass</span><span>Chosen at level ${subclassLevel}</span></div>` : ""}
      <div class="breakdown-subhead">Class Features</div>
      ${featuresByLevelHtml(cls.features || [], featureRowEscHtml)}
      ${choiceCardsHtml(creatorClassChoices(), "Choices")}
    ` : ""}
    ${creatorNavHtml()}
  `;
}

/* Later Levels rows expand the way Class Features read: one open at a time,
   the row itself is the control. Shared by the Class and Subclass steps, both
   of which render featuresByLevelHtml(). */
function wireLaterLevels() {
  document.querySelectorAll("[data-later-level]").forEach(row => {
    row.addEventListener("click", () => {
      const key = row.dataset.laterLevel;
      creatorState.openLaterLevel = creatorState.openLaterLevel === key ? null : key;
      redrawCreator();
    });
  });
}

function wireClassStep() {
  wireLaterLevels();
  document.querySelectorAll("[data-class-option]").forEach(btn => {
    btn.addEventListener("click", () => {
      clearChoiceAnswers(creatorClassChoices().concat(creatorSubclassChoices()));
      creatorState.charClass = btn.dataset.classOption;
      creatorState.openLaterLevel = null;
      creatorState.subclass = null;
      creatorState.classSkillChoices = [];
      creatorState.equipment = [];        // a different class offers different kit
      redrawCreator();
    });
  });
  wireChoiceCards(creatorClassChoices());
  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-next-button").addEventListener("click", () => {
    if (!creatorState.charClass) { showToast("Choose a class to continue"); return; }
    const unresolved = firstUnresolvedChoice(creatorClassChoices());
    if (unresolved) { showToast("Resolve “" + unresolved.prompt + "” to continue"); return; }
    goNext();
  });
}


/* ---------- step: subclass ---------- */

function subclassStepHtml(stepNum) {
  const subclasses = subclassesForClass(creatorState.charClass);
  const chosen = subclasses.find(sc => sc.name === creatorState.subclass);
  return `
    ${creatorHeaderHtml("New Character", creatorStepLabel(stepNum, "Subclass"))}
    <div style="margin-top:10px;">
      ${subclasses.map(sc => optionButtonHtml(sc.name, creatorState.subclass === sc.name, "subclass-option", sc.name)).join("")}
    </div>
    ${chosen ? `
      <div class="breakdown-subhead">Subclass Features</div>
      ${featuresByLevelHtml(chosen.features || [], featureRowEscHtml)}
      ${choiceCardsHtml(creatorSubclassChoices(), "Choices")}
    ` : ""}
    ${creatorNavHtml()}
  `;
}

function wireSubclassStep() {
  wireLaterLevels();
  document.querySelectorAll("[data-subclass-option]").forEach(btn => {
    btn.addEventListener("click", () => {
      clearChoiceAnswers(creatorSubclassChoices());
      creatorState.subclass = btn.dataset.subclassOption;
      creatorState.openLaterLevel = null;   // a row opened on the old subclass
      redrawCreator();
    });
  });
  wireChoiceCards(creatorSubclassChoices());
  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-next-button").addEventListener("click", () => {
    if (!creatorState.subclass) { showToast("Choose a subclass to continue"); return; }
    const unresolved = firstUnresolvedChoice(creatorSubclassChoices());
    if (unresolved) { showToast("Resolve “" + unresolved.prompt + "” to continue"); return; }
    goNext();
  });
}


/* ---------- step: background ---------- */

function backgroundStepHtml(stepNum) {
  const bg = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
  return `
    ${creatorHeaderHtml("New Character", creatorStepLabel(stepNum, "Background"))}
    <div style="margin-top:10px;">
      ${SRD_BACKGROUNDS.map(b => optionButtonHtml(b.name, creatorState.background === b.name, "background-option", b.name)).join("")}
    </div>
    ${bg ? `
      <div class="trait-desc" style="margin:10px 0;">${bg.desc}</div>
      <div class="breakdown-row"><span>Skill Proficiencies</span><span>${bg.skills.join(", ")}</span></div>
      <div class="breakdown-subhead">Background Feature</div>
      ${featureRowHtml(bg.feature)}
    ` : ""}
    ${creatorNavHtml()}
  `;
}

function wireBackgroundStep() {
  document.querySelectorAll("[data-background-option]").forEach(btn => {
    btn.addEventListener("click", () => { creatorState.background = btn.dataset.backgroundOption; redrawCreator(); });
  });
  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-next-button").addEventListener("click", () => {
    if (!creatorState.background) { showToast("Choose a background to continue"); return; }
    goNext();
  });
}


/* ---------- step: ability scores (point buy; the race adds on top) ----------

   The stepper edits the point-buy score, which is what character.abilities
   stores and what the sheet's own "Base Score" field edits. Whatever the
   chosen race adds is shown beside it and totalled on the right, because
   that's how the sheet will show it too -- as a source in the ability
   breakdown, not folded into the base. The step used to offer a free +2/+1
   of its own here instead, which was a second, competing owner of the racial
   bonus and left every score a point or two high. */

/* Three numbers sit on every row -- what you bought, what your origin adds,
   and the score you end up with -- and unlabelled they read as noise: the
   stepper's number looks like the answer when the total on the right is. So
   the columns get a header, and the total is the only bold thing on the row.

   The origin rule is a toggle rather than a mode buried elsewhere, because it
   changes what the middle column means: either the race's own fixed increase,
   or a +2 and a +1 the player places. Both end up as the same kind of effect
   on the same feature, so the sheet's breakdown reads identically either way. */
function abilityStepHtml(stepNum) {
  const cls = classByName(creatorState.charClass);
  const bg = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
  const { spent, exceeds } = pointBuySpentAndExceeds();
  const remaining = POINT_BUY_LIMIT - spent;
  const custom = !!creatorState.customOrigin;

  return `
    ${creatorHeaderHtml("Ability Scores", creatorStepLabel(stepNum, "Point Buy"))}
    <div class="breakdown-total" style="margin:10px 0;"><span>Points left to spend</span><span>${remaining}</span></div>
    ${exceeds ? `<div class="creator-warning"><span aria-hidden="true">\u26A0</span> Exceeds standard point-buy limits. Character will be marked as custom.</div>` : ""}

    ${toggleLineHtml("origin-rule-switch", "Custom Origin Increases", custom, { style: "margin-top:12px;" })}

    <div class="ability-row ability-row-head">
      <span class="ability-row-name">Ability</span>
      <span class="ability-row-buy">Point buy</span>
      <span class="ability-row-origin">${custom ? "Assign" : "Race"}</span>
      <span class="ability-row-total">Total</span>
    </div>
    ${CREATOR_ABILITY_ORDER.map(a => {
      const isMain = cls && cls.mainAbility === a;
      const bonus = creatorRacialBonusFor(a);
      return `
      <div class="ability-row">
        <span class="ability-row-name">${isMain ? "\u2605 " : ""}${esc(a)}</span>
        <span class="ability-row-buy">
          <span class="mini-stepper">
            <button data-as-minus="${a}">\u2212</button><span>${creatorState.scores[a] ?? 8}</span><button data-as-plus="${a}">+</button>
          </span>
        </span>
        <span class="ability-row-origin">${custom
          ? `${miniCheckboxHtml("bonus2", a, creatorState.asiBonus.plus2 === a)}<span class="ability-origin-label">+2</span>
             ${miniCheckboxHtml("bonus1", a, creatorState.asiBonus.plus1 === a)}<span class="ability-origin-label">+1</span>`
          : (bonus ? formatModifier(bonus) : "\u2014")}</span>
        <span class="ability-row-total">${finalScoreFor(a)}</span>
      </div>`;
    }).join("")}



    <div class="btn-row-2" style="margin-top:10px;">
      <button class="btn-secondary" id="ability-clear-button">Clear</button>
      <button class="btn-secondary" id="ability-recommended-button">Use Recommended</button>
    </div>
    <div class="breakdown-subhead" style="margin-top:16px;">Skill Proficiencies</div>
    <div class="trait-desc" style="margin-bottom:10px;">${bg ? bg.skills.join(", ") : "None yet"} from background. Race and class skills are chosen next.</div>
    ${creatorNavHtml()}
  `;
}

function wireAbilityStep() {
  const originSwitch = document.getElementById("origin-rule-switch");
  if (originSwitch) originSwitch.addEventListener("click", () => {
    creatorState.customOrigin = !creatorState.customOrigin;
    /* The race's own increase and an assigned one are alternatives, never a
       mix, so both halves of the old answer go either way: a stale assignment
       would apply again the next time the rule came on, and a stale answer to
       a race's ability choice (Half-Elf's two +1s) would be applied at build
       time on top of the assignment. Only the ability answers -- clearing
       every race choice took the player's draconic ancestry with it. */
    creatorState.asiBonus = { plus2: null, plus1: null };
    clearChoiceAnswers(creatorRaceAbilityChoices());
    redrawCreator();
  });

  document.querySelectorAll("[data-bonus2]").forEach(btn => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.bonus2;
      if (creatorState.asiBonus.plus2 === a) creatorState.asiBonus.plus2 = null;
      else {
        creatorState.asiBonus.plus2 = a;
        if (creatorState.asiBonus.plus1 === a) creatorState.asiBonus.plus1 = null;
      }
      redrawCreator();
    });
  });
  document.querySelectorAll("[data-bonus1]").forEach(btn => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.bonus1;
      if (creatorState.asiBonus.plus1 === a) creatorState.asiBonus.plus1 = null;
      else {
        creatorState.asiBonus.plus1 = a;
        if (creatorState.asiBonus.plus2 === a) creatorState.asiBonus.plus2 = null;
      }
      redrawCreator();
    });
  });

  document.querySelectorAll("[data-as-minus]").forEach(btn => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.asMinus;
      creatorState.scores[a] = Math.max(1, (creatorState.scores[a] ?? 8) - 1);
      redrawCreator();
    });
  });
  /* No ceiling. The step already knows how to go outside standard point buy
     -- it says so, and confirming marks the build custom -- so a stepper that
     silently refused to move at 20 was contradicting its own warning. (The
     level-up ASI cap in choices.js is a different rule and stays: the SRD
     feature text there really does say "Can't exceed 20".) */
  document.querySelectorAll("[data-as-plus]").forEach(btn => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.asPlus;
      creatorState.scores[a] = (creatorState.scores[a] ?? 8) + 1;
      redrawCreator();
    });
  });
  document.getElementById("ability-clear-button").addEventListener("click", () => {
    creatorState.scores = {};
    redrawCreator();
  });
  document.getElementById("ability-recommended-button").addEventListener("click", () => {
    const cls = classByName(creatorState.charClass);
    const main = cls ? cls.mainAbility : CREATOR_ABILITY_ORDER[0];
    const others = CREATOR_ABILITY_ORDER.filter(a => a !== main);
    const pool = STANDARD_ARRAY.slice();
    creatorState.scores = {};
    creatorState.scores[main] = pool.shift();
    const secondary = others[0];
    creatorState.scores[secondary] = pool.shift();
    others.slice(1).forEach((a, i) => { creatorState.scores[a] = pool[i]; });
    redrawCreator();
  });
  document.getElementById("creator-back-button").addEventListener("click", goBack);
  /* Asked here rather than shown as a banner on the step. A warning that is
     already on screen when the step loads is furniture -- the player has been
     looking at it since before they did anything. This is the moment it
     matters, and it doesn't block. */
  document.getElementById("creator-next-button").addEventListener("click", () => {
    const remaining = POINT_BUY_LIMIT - pointBuySpentAndExceeds().spent;
    if (remaining > 0) {
      confirmModal({
        title: "You have " + remaining + " point" + (remaining === 1 ? "" : "s") + " still unspent.",
        body: "Are you sure you want to continue?",
        confirmLabel: "Continue",
        onConfirm: goNext
      });
      return;
    }
    goNext();
  });
}


/* ---------- step: skills ---------- */

function skillsStepHtml(stepNum) {
  const bg = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
  const bgSkills = bg ? bg.skills : [];
  const sources = creatorSkillSources();

  let html = `
    ${creatorHeaderHtml("Skills", creatorStepLabel(stepNum, "Proficiencies"))}
    <div class="field-row creator-skill-headings">
      ${sources.map(source => `<span class="creator-skill-heading">${esc(source.label)}<br>${source.chosen.length}/${source.count}</span>`).join("")}
    </div>
  `;

  const abilityGroups = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
  abilityGroups.forEach(ability => {
    const skillsInGroup = ALL_SKILLS.filter(s => s.ability === ability);
    if (!skillsInGroup.length) return;
    html += `<div class="breakdown-subhead">${ability}</div>`;
    skillsInGroup.forEach(s => {
      const mod = Math.floor((finalScoreFor(ability) - 10) / 2);
      const isBg = bgSkills.includes(s.name);
      const takenBy = sources.find(source => source.chosen.includes(s.name));
      const proficient = isBg || !!takenBy;
      const bonus = mod + (proficient ? 2 : 0);
      const bonusStr = (bonus >= 0 ? "+" : "") + bonus;

      /* One fixed-width cell per grantor, so the columns line up down the whole
         list whether or not a given skill can be taken from a given source. The
         cell is what gives the checkbox inside it a finger-sized tap area -- an
         18px box on its own was a miss waiting to happen.

         A skill taken from one source is off the table for every other: 5e never
         lets the same proficiency be chosen twice, and picking it twice here
         would silently do nothing anyway, since skillProficiency is a flag and
         not a count. */
      const slots = sources.map((source, index) => {
        if (isBg) {
          return index === 0
            ? `<span class="creator-skill-cell"><span class="res-tag creator-skill-tag">BG</span></span>`
            : `<span class="creator-skill-cell"></span>`;
        }
        if (!source.options.includes(s.name)) return `<span class="creator-skill-cell"></span>`;
        const mine = source.chosen.includes(s.name);
        const disabled = (takenBy && takenBy !== source) || (!mine && source.chosen.length >= source.count);
        // the source is carried by index, so any number of grantors can share
        // one listener -- a character could have two feature-granted choices
        return `<span class="creator-skill-cell">${miniCheckboxHtml("skill-src", index + ":" + s.name, mine, disabled)}</span>`;
      }).join("");

      html += `
        <div class="skill-row creator-skill-row">
          <span class="skill-name">${esc(s.name)}</span>
          <span class="skill-bonus">${bonusStr}</span>
          ${slots}
        </div>
      `;
    });
  });

  html += `
    ${creatorNavHtml()}
  `;
  return html;
}

function wireSkillsStep() {
  /* One listener for every column, because the columns are now a list rather
     than a hardcoded race-and-class pair. The source is carried by index in
     the data attribute; the rows are rebuilt on every redraw, so an index can
     never outlive the list it points into. */
  const sources = creatorSkillSources();

  document.querySelectorAll("[data-skill-src]").forEach(cb => {
    cb.addEventListener("click", (e) => {
      e.preventDefault();
      // a mini-checkbox is a span now, so `disabled` is a class the listener
      // has to honour rather than an attribute the browser enforces
      if (miniCheckboxBlocked(cb)) return;

      const raw = cb.dataset.skillSrc;
      const source = sources[parseInt(raw.slice(0, raw.indexOf(":")))];
      const name = raw.slice(raw.indexOf(":") + 1);
      if (!source) return;

      const idx = source.chosen.indexOf(name);
      if (idx >= 0) source.chosen.splice(idx, 1);
      else {
        if (source.chosen.length >= source.count) { showToast(source.label + " picks already used"); return; }
        source.chosen.push(name);
      }
      redrawCreator();
    });
  });

  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-next-button").addEventListener("click", () => {
    const owed = creatorSkillPicksOwed();
    if (owed > 0) {
      confirmModal({
        title: "You have " + owed + " skill proficienc" + (owed === 1 ? "y" : "ies") + " left to choose.",
        body: "Are you sure you want to continue?",
        confirmLabel: "Continue",
        onConfirm: goNext
      });
      return;
    }
    goNext();
  });
}

/* How many picks the step still owes, across both sources. Not a blocker --
   a player who wants to fill these in later is allowed to. */
function creatorSkillPicksOwed() {
  const race = raceByName(creatorState.race);
  const raceChoice = race && race.skillChoice ? race.skillChoice : null;
  const cls = classByName(creatorState.charClass);
  const raceOwed = raceChoice ? raceChoice.count - creatorState.raceSkillChoices.length : 0;
  const classOwed = cls && cls.skillChoices ? cls.skillChoices.count - creatorState.classSkillChoices.length : 0;
  return Math.max(0, raceOwed) + Math.max(0, classOwed);
}


/* ---------- choice cards, shared across every step that can grant one ----------

   A choice card can now show up on the Race, Class, Subclass or trailing
   Choices step -- whichever step's pick is what granted it (see the
   creatorRaceChoices()/creatorClassChoices()/creatorSubclassChoices()/
   creatorSkillChoices() split above). choiceCardHtml itself doesn't care
   which step it's rendered on; wireChoiceCards() and firstUnresolvedChoice()
   are the shared wiring/validation every one of those steps calls with its
   own slice of pendings. Skipping a card is still allowed, same as before:
   Next only requires each one has EITHER a picked option or manual text. */

/* The build-time twin of the resolve-choice modal, rendering through the same
   choiceOptionRowHtml() (choices.js) so the two can't drift apart: tapping an
   option picks it and opens its description underneath, and at the limit the
   next tap replaces the pick made last. Ten dragon types' full Breath Weapon
   text is still never printed all at once -- only the chosen one's is. */
function choiceCardHtml(pending) {
  const key = pending.featureName;
  const answer = creatorState.choiceAnswers[key] || {};
  const options = creatorChoiceOptionsFor(pending);
  const selected = answer.chosen || [];

  return `
    <div class="collapse-card" style="margin-bottom:12px;">
      <div class="collapse-head" style="cursor:default;"><span>${esc(pending.prompt)}</span></div>
      <div class="collapse-body open" style="padding:2px 14px 14px;">
        <div class="breakdown-source" style="margin-bottom:8px;">From ${esc(pending.featureName)} — pick ${pending.count}</div>
        ${options && options.length ? options.map(opt => choiceOptionRowHtml(opt, key + "|||" + opt, {
          desc: choiceOptionDescFor(pending, opt),
          selected: selected.includes(opt),
          pickAttr: "choice-pick"
        })).join("") : `<div class="empty-hint" style="margin-bottom:8px;">Nothing to pick from — use the field below.</div>`}
        ${textFieldHtml("choice-manual-" + key, "Or track it yourself", answer.manual || "", { placeholder: "What did you pick?" })}
      </div>
    </div>
  `;
}

function choiceCardsHtml(pendings, heading) {
  if (!pendings.length) return "";
  return `
    <div class="breakdown-subhead" style="margin-top:14px;">${esc(heading)}</div>
    ${pendings.map(choiceCardHtml).join("")}
  `;
}

function wireChoiceCards(pendings) {
  pendings.forEach(pending => {
    const input = document.getElementById("choice-manual-" + pending.featureName);
    if (input) input.addEventListener("input", () => {
      creatorState.choiceAnswers[pending.featureName] = { manual: input.value };
    });
  });

  document.querySelectorAll("[data-choice-pick]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const [key, opt] = btn.dataset.choicePick.split("|||");
      const pending = pendings.find(p => p.featureName === key);
      if (!pending) return;
      const chosen = (creatorState.choiceAnswers[key] && creatorState.choiceAnswers[key].chosen || []).slice();
      pickInto(chosen, opt, pending.count);
      creatorState.choiceAnswers[key] = { chosen };
      redrawCreator();
    });
  });
}

function firstUnresolvedChoice(pendings) {
  return pendings.find(p => {
    const a = creatorState.choiceAnswers[p.featureName];
    if (!a) return true;
    if (a.manual && a.manual.trim()) return false;
    return !(a.chosen && a.chosen.length === p.count);
  }) || null;
}

// clears just the answers a source's own choices own, so switching race
// mid-build doesn't also wipe class/subclass answers the player already made
function clearChoiceAnswers(pendings) {
  pendings.forEach(p => {
    delete creatorState.choiceAnswers[p.featureName];
  });
}


/* ---------- step: choices (skill-kind leftovers only) ----------

   Everything else now answers on the step that granted it. What's left here
   is "skill" kind alone -- Expertise-style "pick skills you're already
   proficient in" -- since its option list depends on Skills having run.
   Only reached when creatorSkillChoices() actually found one. */

function choicesStepHtml(stepNum) {
  const pendings = creatorPendingChoiceList();
  return `
    ${creatorHeaderHtml("Choices", creatorStepLabel(stepNum, "What your features grant"))}
    ${pendings.map(choiceCardHtml).join("")}
    ${creatorNavHtml()}
  `;
}

function wireChoicesStep() {
  const pendings = creatorPendingChoiceList();
  wireChoiceCards(pendings);
  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-next-button").addEventListener("click", () => {
    const unresolved = firstUnresolvedChoice(pendings);
    if (unresolved) { showToast("Resolve “" + unresolved.prompt + "” to continue"); return; }
    goNext();
  });
}


/* ---------- turning creatorState into an actual character ----------

   Everything the creator collected -- race, subrace, class, subclass,
   background, point-buy scores and the skill picks -- gets mapped onto the
   same shape the demo character uses. Nothing here is new data: the race,
   class and background tables already hold the features and proficiencies,
   the creator was just rendering and discarding them. */

const ABILITY_ABBREVIATIONS = {
  Strength: "STR", Dexterity: "DEX", Constitution: "CON",
  Intelligence: "INT", Wisdom: "WIS", Charisma: "CHA"
};

/* The sheet keys skills without spaces ("SleightOfHand"), the creator and
   the SRD tables list them with ("Sleight of Hand"). Every word is
   capitalised, so the interior word of the one two-word skill that has a
   lower-case one survives the round trip -- stripping the spaces alone
   produced "SleightofHand", which matched neither SKILL_ABILITY_MAP nor the
   raw label a resolved Expertise was writing, and quietly cost a Rogue four
   points of Sleight of Hand. Idempotent, so a key that has already been
   through here comes back unchanged. */
function skillKey(name) {
  return String(name).split(/[^a-zA-Z]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

/* Classes describe weapon proficiency either as categories ("Simple and
   martial weapons") or as a list of named weapons ("Daggers, darts, slings,
   quarterstaffs, light crossbows"). Both end up in the same list, and
   weaponProficiency() matches a weapon on its category or its name. */
function parseWeaponProficiencies(text) {
  if (!text) return [];
  const categories = [];
  if (/simple/i.test(text)) categories.push("Simple");
  if (/martial/i.test(text)) categories.push("Martial");
  if (categories.length) return categories;

  return text.split(/,| and /i)
    .map(entry => entry.trim().replace(/s$/i, ""))
    .filter(Boolean);
}

function buildCharacterFromCreator() {
  const race = raceByName(creatorState.race);
  const cls = classByName(creatorState.charClass);
  const background = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
  const subrace = subracesFor(race).find(s => s.name === creatorState.subrace);

  // the point-buy score and nothing else: the race's own Ability Score
  // Increase rides in on its trait entry's effects instead, so it lands once
  // and shows up as its own line in the ability breakdown
  const abilities = {};
  CREATOR_ABILITY_ORDER.forEach(name => { abilities[ABILITY_ABBREVIATIONS[name]] = creatorState.scores[name] ?? 8; });

  // background skills are granted outright; race and class ones were chosen
  const skillProficiency = {};
  const grantSkill = name => { skillProficiency[skillKey(name)] = 1; };
  (background ? background.skills : []).forEach(grantSkill);
  creatorState.raceSkillChoices.forEach(grantSkill);
  creatorState.classSkillChoices.forEach(grantSkill);

  const savingThrowProficiency = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 };
  (cls ? cls.saves : []).forEach(save => { savingThrowProficiency[ABILITY_ABBREVIATIONS[save]] = 1; });

  // kept raw (not stripped to {name, desc}) up front, so the choice-granting
  // pass below can still see any `.choice` descriptor after `traits` has
  // already stripped its own copy down to display text
  const raceFeatures = (race ? race.features : []).concat(subrace ? subrace.features : []);
  let assignedOriginPlaced = false;   // the assigned +2/+1 lands on one feature, not every ability feature
  const classFeatures = featuresAtLevel(creatorState.charClass, creatorState.subclass, 1);

  // carries .effects and .resource through from the raw feature -- both are
  // optional, permanent parts of the feature itself (Lucky's reroll, Second
  // Wind's usable resource), not a one-time choice like .choice is
  const asTraitEntry = f => {
    const entry = { name: f.name, desc: f.desc };
    if (f.effects) entry.effects = f.effects;
    if (f.resource) entry.resource = Object.assign({ name: f.name }, f.resource);
    return entry;
  };

  /* Under the optional origin rule the player assigns the +2/+1 instead of
     taking the race's, so the race's ability feature carries the assigned
     effects rather than its own. Swapping the effects rather than adding a
     second source keeps one owner per score -- the same discipline that fixed
     the double-counting -- and the breakdown still reads "Ability Score
     Increase", which is where a player looks for it. */
  const asRaceTraitEntry = f => {
    const entry = asTraitEntry(f);
    if (!creatorState.customOrigin || !creatorIsAbilityFeature(f)) return entry;
    // the assignment lands on the first ability feature only -- a Hill Dwarf
    // has two (race and subrace), and rewriting both read as if it applied twice
    if (assignedOriginPlaced) return null;
    assignedOriginPlaced = true;
    entry.effects = creatorCustomOriginEffects();
    entry.desc = "You assign the increases yourself: " + (originAssignmentSummary() || "nothing assigned yet") + ".";
    return entry;
  };

  const traits = {
    "Race Traits": raceFeatures.map(asRaceTraitEntry).filter(Boolean),
    "Class Features": classFeatures.map(asTraitEntry),
    "Background Features": background ? [{ name: background.feature.name, desc: background.feature.desc }] : [],
    "Feats": [],
    "Proficiencies": cls ? [
      { name: "Armor", desc: cls.armorProf },
      { name: "Weapons", desc: cls.weaponProf },
      ...(cls.toolProf ? [{ name: "Tools", desc: cls.toolProf }] : [])
    ] : []
  };

  // a first-level character has one hit die and takes its maximum for HP.
  // The Constitution that goes into it is filled in below, once the racial
  // increase and any answered choice are actually on the character.
  const hitDieSize = cls ? parseInt(cls.hitDie.replace("d", "")) : 8;

  const weaponProficiencies = parseWeaponProficiencies(cls ? cls.weaponProf : "");

  const built = {
    id: nextCharacterId(),
    name: creatorState.name,
    classes: [{
      name: creatorState.charClass,
      level: 1,
      subclass: creatorState.subclass || null,
      hitDie: cls ? cls.hitDie : "d8"
    }],
    race: creatorState.race,
    subrace: creatorState.subrace || null,
    customBuild: creatorState.customBuild,

    profilePic: null,
    alignment: "True Neutral",
    appearance: creatorState.appearance,
    personalityTraits: "", ideals: "", bonds: "", flaws: "",
    backstory: creatorState.backstory,

    abilities,
    proficiencyBonusOverride: null,      // derived from total level
    baseSpeed: 30,
    inspiration: { current: 0, max: 1 },

    hp: { current: hitDieSize, temp: 0 },
    baseMaxHP: hitDieSize,
    maxHpModifiers: [],
    hitDiceSpent: {},

    activeEffects: [],
    resources: [],

    weaponProficiencies,
    languages: ["Common"],
    pendingChoices: [],
    savingThrowProficiency,
    savingThrowOverride: {},
    skillProficiency,
    skillOverride: {},
    skillAbilityMap: JSON.parse(JSON.stringify(SKILL_ABILITY_MAP)),

    traits,
    inventory: buildStartingInventory(),
    categoryRules: {
      Worn: { countsWeight: true, appliesEffects: true, providesAttacks: false },
      Equipped: { countsWeight: true, appliesEffects: true, providesAttacks: true },
      Carrying: { countsWeight: true, appliesEffects: false, providesAttacks: false },
      "Camp Storage": { countsWeight: false, appliesEffects: false, providesAttacks: false }
    },

    spellcasting: { classes: [] },
    spellSlots: {},
    maxPreparedByClass: {},
    spells: [],

    partyMembers: [],
    noteSections: [{ id: 1, name: "Session Notes", autoShare: false, receiveFrom: true }],
    notes: []
  };

  // race and level-1 class features can each owe a choice ("choose an extra
  // language," "choose a fighting style") -- grantPendingChoice reads the raw
  // feature objects (still carrying `.choice`) rather than the stripped
  // copies that went into `traits` above.
  // the optional origin rule replaces a race's ability increase, choice and
  // all -- the wizard stops asking (creatorRaceChoices), and this has to stop
  // granting, or the sheet asks the question the wizard just took away
  raceFeatures
    .filter(f => !(creatorState.customOrigin && creatorIsAbilityFeature(f)))
    .forEach(f => grantPendingChoice(built, f, "Race Traits"));
  classFeatures.forEach(f => grantPendingChoice(built, f, "Class Features"));

  /* pendingChoiceFor() (rests.js) copies kind/count/prompt/options off a
     feature's choice descriptor, but not `grants` -- which is the field that
     tells Skill Versatility apart from Expertise. Re-attach it so a choice
     resolved here, or later from the Character tab banner, uses the same
     semantics the wizard offered. Belongs in pendingChoiceFor() itself
     eventually, next to the `options` carry-through it already does. */
  const rawFeatures = raceFeatures.concat(classFeatures);
  built.pendingChoices.forEach(pending => {
    const feature = rawFeatures.find(f => f.name === pending.featureName);
    if (feature && feature.choice && feature.choice.grants) pending.grants = feature.choice.grants;
  });

  // the "choices" step (when it appeared) collected an answer for each of
  // those in creatorState.choiceAnswers -- apply them the same way resolving
  // one from the Character tab banner would, so a build-time choice and a
  // later one go through identical mechanics. Anything left unanswered
  // (there shouldn't be, the step's Next button checks) simply stays pending
  // rather than being silently dropped.
  built.pendingChoices.slice().forEach(pending => {
    // defensive: a creatorState built by hand (verification scripts, tests
    // that construct a minimal state) may not carry this field at all
    const answer = (creatorState.choiceAnswers || {})[pending.featureName];
    if (!answer) return;
    if (answer.chosen && answer.chosen.length) applyChoiceResolution(built, pending, answer.chosen.slice());
    else if (answer.manual && answer.manual.trim()) resolveChoiceManually(built, pending, answer.manual.trim());
  });

  /* Everything below reads the finished character rather than the raw
     point-buy scores, so it agrees with what the sheet displays. HP used the
     pre-effect Constitution before this, which left a Hill Dwarf's hit points
     computed from a Constitution two points below the one on their own
     sheet. Half-Elf's "+1 to two other scores" is answered by then too. */
  const constitution = abilityModifier(effectiveAbilityScore(built, "CON"));
  built.baseMaxHP = hitDieSize + constitution;
  built.hp.current = built.baseMaxHP;
  Object.assign(built, creatorSpellcasting(cls, built));

  return built;
}

/* A creator-built caster used to arrive with `spellcasting: { classes: [] }`,
   no slots and no prepared count -- which left the Spells tab with no
   Ability/Attack/DC boxes, the Add Spell form's class picker empty, and
   nothing anywhere in the app that had ever created a spell slot. The
   numbers come from the class's own `spellcasting` descriptor
   (srd-classes.js) via spellSlotsAtLevel()/maxPreparedSpells(), so a custom
   class that declares one gets the same treatment. A class that doesn't cast
   at 1st level (Paladin, Ranger) correctly gets nothing at all. */
function creatorSpellcasting(cls, built) {
  const casting = cls && cls.spellcasting;
  const empty = { spellcasting: { classes: [] }, spellSlots: {}, maxPreparedByClass: {} };
  if (!casting || !ABILITY_FULL_NAMES[casting.ability]) return empty;

  const slotCounts = spellSlotsAtLevel(casting, 1);
  if (!Object.keys(slotCounts).length) return empty;

  const spellSlots = {};
  Object.keys(slotCounts).forEach(level => {
    spellSlots[level] = { current: slotCounts[level], max: slotCounts[level], recharge: spellSlotRecharge(casting) };
  });

  const abilityMod = abilityModifier(effectiveAbilityScore(built, casting.ability));
  const maxPreparedByClass = {};
  maxPreparedByClass[cls.name] = maxPreparedSpells(casting, 1, abilityMod);

  return {
    spellcasting: { classes: [{ name: cls.name, ability: casting.ability }] },
    spellSlots,
    maxPreparedByClass
  };
}





/* ---------- step: name / appearance / backstory ---------- */

function finalStepHtml(stepNum) {
  return `
    ${creatorHeaderHtml("New Character", creatorStepLabel(stepNum, "Name & Details"))}
    ${textFieldHtml("creator-name-input", "Character Name", creatorState.name,
      { placeholder: "e.g. Sigrid of Chester", style: "margin-top:14px;" })}
    ${textFieldHtml("creator-appearance-input", "Appearance (optional)", creatorState.appearance,
      { placeholder: "Brief physical description" })}
    ${textFieldHtml("creator-backstory-input", "Backstory (optional)", creatorState.backstory,
      { placeholder: "A line or two of history" })}
    ${creatorNavHtml({ id: "creator-confirm-button", label: "Create Character" })}
  `;
}

function wireFinalStep() {
  const nameInput = document.getElementById("creator-name-input");
  const appearanceInput = document.getElementById("creator-appearance-input");
  const backstoryInput = document.getElementById("creator-backstory-input");
  nameInput.addEventListener("input", () => { creatorState.name = nameInput.value; });
  appearanceInput.addEventListener("input", () => { creatorState.appearance = appearanceInput.value; });
  backstoryInput.addEventListener("input", () => { creatorState.backstory = backstoryInput.value; });
  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-confirm-button").addEventListener("click", () => {
    creatorState.name = nameInput.value.trim();
    if (!creatorState.name) { showToast("Enter a name"); return; }

    const { exceeds } = pointBuySpentAndExceeds();
    creatorState.customBuild = exceeds;

    const built = buildCharacterFromCreator();
    savedCharacters.push(built);
    selectCharacter(built.id);
    closeCreatorModal();
    showScreen("sheet");
    showToast(creatorState.customBuild ? "Created " + built.name + " (custom build)" : "Created " + built.name);
  });
}


/* ---------- dispatch ---------- */

function creatorStepHtml() {
  const key = currentStepKey();
  const keys = creatorStepKeys();
  const stepNum = creatorState.step + 1;
  if (key === "race") return raceStepHtml(stepNum);
  if (key === "class") return classStepHtml(stepNum);
  if (key === "subclass") return subclassStepHtml(stepNum);
  if (key === "background") return backgroundStepHtml(stepNum);
  if (key === "ability") return abilityStepHtml(stepNum);
  if (key === "skills") return skillsStepHtml(stepNum);
  if (key === "choices") return choicesStepHtml(stepNum);
  if (key === "equipment") return equipmentStepHtml(stepNum);
  return finalStepHtml(stepNum);
}

function wireCreatorStep() {
  // every step's header carries the same exit, so it's wired once here
  // rather than in each of the nine wire functions
  const cancel = document.getElementById("creator-cancel-button");
  if (cancel) cancel.addEventListener("click", cancelCharacterCreator);

  const key = currentStepKey();
  if (key === "race") return wireRaceStep();
  if (key === "class") return wireClassStep();
  if (key === "subclass") return wireSubclassStep();
  if (key === "background") return wireBackgroundStep();
  if (key === "ability") return wireAbilityStep();
  if (key === "skills") return wireSkillsStep();
  if (key === "choices") return wireChoicesStep();
  if (key === "equipment") return wireEquipmentStep();
  return wireFinalStep();
}
