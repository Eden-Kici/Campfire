/* ============================================================
   CHARACTER CREATOR (POC — fake SRD-style content, faked list entry on confirm)
   ============================================================ */

let creatorState = null;

function openCharacterCreator() {
  creatorState = {
    started: false,               // hasn't chosen build-from-scratch vs. import yet
    step: 0, name: "", appearance: "", backstory: "",
    race: null, subrace: null, charClass: null, subclass: null, background: null,
    scores: {}, asiBonus: { plus2: null, plus1: null },
    raceSkillChoices: [], classSkillChoices: [], equipment: [],
    choiceAnswers: {},        // featureName -> { chosen: [...] } or { manual: "..." }
    expandedChoiceOption: {}, // featureName -> the one option card currently open, accordion-style
    customBuild: false
  };
  openModal("full", "");
  redrawCreator();
}

function redrawCreator() {
  const box = document.querySelector("#modal-overlay .modal-content");
  if (!creatorState.started) {
    box.innerHTML = creatorStartHtml();
    wireCreatorStart();
    return;
  }
  box.innerHTML = creatorStepHtml();
  wireCreatorStep();
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
      if (!parsed || typeof parsed !== "object" || !parsed.name || !parsed.abilities) {
        showToast("That doesn't look like a character");
        return;
      }
      // an imported character gets a fresh id so it can't collide with one you already have
      parsed.id = nextCharacterId();
      savedCharacters.push(parsed);
      selectCharacter(parsed.id);
      closeModal();
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

function finalScoreFor(ability) {
  const base = creatorState.scores[ability] ?? 8;
  const bonus = (creatorState.asiBonus.plus2 === ability ? 2 : 0) + (creatorState.asiBonus.plus1 === ability ? 1 : 0);
  return base + bonus;
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

function optionButtonHtml(label, active, dataAttr, value) {
  return `<button class="toggle-btn creator-option ${active ? "active" : ""}" data-${dataAttr}="${esc(value)}" style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px 14px;">${esc(label)}</button>`;
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
  const race = SRD_RACES.find(r => r.name === creatorState.race);
  const subrace = race && race.subraces ? race.subraces.find(s => s.name === creatorState.subrace) : null;
  const raceFeatures = (race ? race.features : []).concat(subrace ? subrace.features : []);
  const out = [];
  raceFeatures.forEach(f => {
    if (f.choice && f.choice.kind !== "skill") out.push(Object.assign({ traitCategory: "Race Traits", featureName: f.name }, f.choice));
  });
  return out;
}

function creatorClassChoices() {
  const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);
  if (!cls) return [];
  const out = [];
  (cls.features || []).filter(f => f.level === 1).forEach(f => {
    if (f.choice && f.choice.kind !== "skill") out.push(Object.assign({ traitCategory: "Class Features", featureName: f.name }, f.choice));
  });
  return out;
}

function creatorSubclassChoices() {
  const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);
  const subclass = cls && creatorState.subclass ? subclassesForClass(cls.name).find(s => s.name === creatorState.subclass) : null;
  if (!subclass) return [];
  const out = [];
  (subclass.features || []).filter(f => f.level === 1).forEach(f => {
    if (f.choice && f.choice.kind !== "skill") out.push(Object.assign({ traitCategory: "Class Features", featureName: f.name }, f.choice));
  });
  return out;
}

function creatorSkillChoices() {
  const race = SRD_RACES.find(r => r.name === creatorState.race);
  const subrace = race && race.subraces ? race.subraces.find(s => s.name === creatorState.subrace) : null;
  const raceFeatures = (race ? race.features : []).concat(subrace ? subrace.features : []);
  const classFeatures = creatorState.charClass ? featuresAtLevel(creatorState.charClass, creatorState.subclass, 1) : [];

  const out = [];
  raceFeatures.forEach(f => { if (f.choice && f.choice.kind === "skill") out.push(Object.assign({ traitCategory: "Race Traits", featureName: f.name }, f.choice)); });
  classFeatures.forEach(f => { if (f.choice && f.choice.kind === "skill") out.push(Object.assign({ traitCategory: "Class Features", featureName: f.name }, f.choice)); });
  return out;
}

/* Same three kinds choiceOptionsFor() (choices.js) offers, but read off
   creatorState instead of a live character -- there isn't one yet. Language
   and skill options depend on picks made earlier in the wizard (skills has
   to come before this step); fighting style and cantrip are static lists
   either way, so those two are identical to the resolved-character version. */
function creatorChoiceOptionsFor(pending) {
  if (pending.kind === "language") return SRD_LANGUAGES.filter(l => l !== "Common");
  if (pending.kind === "skill") {
    const bg = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
    const known = (bg ? bg.skills : []).concat(creatorState.raceSkillChoices, creatorState.classSkillChoices);
    return known.filter((name, i) => known.indexOf(name) === i);
  }
  if (pending.kind === "fightingStyle") return FIGHTING_STYLES.map(f => f.label);
  if (pending.kind === "cantrip") return SRD_CANTRIPS.map(c => c.name);
  if (pending.kind === "custom") return (pending.options || []).map(o => o.label);
  return null;
}

function creatorStepKeys() {
  const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);
  const keys = ["race", "class"];
  if (cls && subclassesForClass(cls.name).length) keys.push("subclass");
  keys.push("background", "ability", "skills");
  if (creatorSkillChoices().length) keys.push("choices");
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
}

function goBack() {
  creatorState.step = Math.max(creatorState.step - 1, 0);
  redrawCreator();
}

/* Every step ends with the same pair of buttons. The last one says something
   else and carries its own id, because it does something else. */
function creatorNavHtml(next) {
  const { id = "creator-next-button", label = "Next" } = next || {};
  return `
    <div class="btn-row-2" style="margin-top:14px;">
      <button class="btn-secondary" id="creator-back-button">Back</button>
      <button class="btn-primary" id="${id}">${esc(label)}</button>
    </div>`;
}


/* ---------- step: race ---------- */

function raceStepHtml(stepNum, totalSteps) {
  const race = SRD_RACES.find(r => r.name === creatorState.race);
  return `
    <div class="modal-heading">New Character</div>
    <div class="breakdown-source">Step ${stepNum} of ${totalSteps} \u00B7 Race</div>
    <div style="margin-top:10px;">
      ${SRD_RACES.map(r => optionButtonHtml(r.name, creatorState.race === r.name, "race-option", r.name)).join("")}
    </div>
    ${race ? `
      ${race.subraces ? `
        <div class="breakdown-subhead">Subrace</div>
        ${race.subraces.map(sr => optionButtonHtml(sr.name, creatorState.subrace === sr.name, "subrace-option", sr.name)).join("")}
      ` : ""}
      <div class="breakdown-subhead">Racial Features</div>
      ${race.features.map(featureRowHtml).join("")}
      ${(race.subraces && creatorState.subrace) ? race.subraces.find(sr => sr.name === creatorState.subrace).features.map(featureRowHtml).join("") : ""}
      ${race.skillChoice ? `<div class="item-effect" style="margin-top:8px;">Grants ${race.skillChoice.count} bonus skill proficiency \u2014 chosen in the Skills step.</div>` : ""}
      ${choiceCardsHtml(creatorRaceChoices(), "Choices")}
    ` : ""}
    <button class="btn-primary" id="creator-next-button" style="margin-top:14px;">Next</button>
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
    const race = SRD_RACES.find(r => r.name === creatorState.race);
    if (race.subraces && !creatorState.subrace) { showToast("Choose a subrace to continue"); return; }
    const unresolved = firstUnresolvedChoice(creatorRaceChoices());
    if (unresolved) { showToast("Resolve \u201c" + unresolved.prompt + "\u201d to continue"); return; }
    goNext();
  });
}


/* ---------- step: class ---------- */

function classStepHtml(stepNum, totalSteps) {
  const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);
  return `
    <div class="modal-heading">New Character</div>
    <div class="breakdown-source">Step ${stepNum} of ${totalSteps} \u00B7 Class</div>
    <div style="margin-top:10px;">
      ${SRD_CLASSES.map(c => optionButtonHtml(c.name, creatorState.charClass === c.name, "class-option", c.name)).join("")}
    </div>
    ${cls ? `
      <div class="trait-desc" style="margin:10px 0;">${cls.description}</div>
      <div class="breakdown-row"><span>Hit Die</span><span>${cls.hitDie}</span></div>
      <div class="breakdown-row"><span>Saving Throws</span><span>${cls.saves.join(", ")}</span></div>
      <div class="breakdown-row"><span>Armor</span><span>${cls.armorProf}</span></div>
      <div class="breakdown-row"><span>Weapons</span><span>${cls.weaponProf}</span></div>
      ${cls.toolProf ? `<div class="breakdown-row"><span>Tools</span><span>${cls.toolProf}</span></div>` : ""}
      <div class="breakdown-subhead">Class Features</div>
      ${cls.features.map(featureRowHtml).join("")}
      ${choiceCardsHtml(creatorClassChoices(), "Choices")}
    ` : ""}
    ${creatorNavHtml()}
  `;
}

function wireClassStep() {
  document.querySelectorAll("[data-class-option]").forEach(btn => {
    btn.addEventListener("click", () => {
      clearChoiceAnswers(creatorClassChoices().concat(creatorSubclassChoices()));
      creatorState.charClass = btn.dataset.classOption;
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

function subclassStepHtml(stepNum, totalSteps) {
  const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);
  const subclasses = subclassesForClass(cls.name);
  return `
    <div class="modal-heading">New Character</div>
    <div class="breakdown-source">Step ${stepNum} of ${totalSteps} \u00B7 Subclass</div>
    <div style="margin-top:10px;">
      ${subclasses.map(sc => optionButtonHtml(sc.name, creatorState.subclass === sc.name, "subclass-option", sc.name)).join("")}
    </div>
    ${creatorState.subclass ? `
      <div class="breakdown-subhead">Subclass Features</div>
      ${subclasses.find(sc => sc.name === creatorState.subclass).features.map(featureRowEscHtml).join("")}
      ${choiceCardsHtml(creatorSubclassChoices(), "Choices")}
    ` : ""}
    ${creatorNavHtml()}
  `;
}

function wireSubclassStep() {
  document.querySelectorAll("[data-subclass-option]").forEach(btn => {
    btn.addEventListener("click", () => {
      clearChoiceAnswers(creatorSubclassChoices());
      creatorState.subclass = btn.dataset.subclassOption;
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

function backgroundStepHtml(stepNum, totalSteps) {
  const bg = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
  return `
    <div class="modal-heading">New Character</div>
    <div class="breakdown-source">Step ${stepNum} of ${totalSteps} \u00B7 Background</div>
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


/* ---------- step: ability scores (point buy only, BG3-style +2/+1 overlay) ---------- */

function abilityStepHtml(stepNum, totalSteps) {
  const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);
  const bg = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
  const { spent, exceeds } = pointBuySpentAndExceeds();
  const remaining = POINT_BUY_LIMIT - spent;

  return `
    <div class="modal-heading">Ability Scores</div>
    <div class="breakdown-source">Step ${stepNum} of ${totalSteps} \u00B7 Point Buy</div>
    <div class="breakdown-total" style="margin:10px 0;"><span>Ability Points</span><span>${remaining}</span></div>
    ${exceeds ? `<div class="item-effect" style="color:var(--danger-text);margin-bottom:10px;">\u26A0 Exceeds standard point-buy limits \u2014 will be marked custom / not legal.</div>` : ""}
    ${CREATOR_ABILITY_ORDER.map(a => {
      const isMain = cls && cls.mainAbility === a;
      return `
      <div class="field-row" style="align-items:center;">
        ${fieldLabelHtml((isMain ? "\u2605 " : "") + a, { style: "flex:0 0 118px;" })}
        <div class="mini-stepper" style="justify-content:flex-start;">
          <button data-as-minus="${a}">\u2212</button><span>${finalScoreFor(a)}</span><button data-as-plus="${a}">+</button>
        </div>
        <span style="font-size:11px;color:var(--text-dim);display:flex;align-items:center;gap:5px;margin-left:12px;">
          ${miniCheckboxHtml("bonus2", a, creatorState.asiBonus.plus2 === a)} +2
        </span>
        <span style="font-size:11px;color:var(--text-dim);display:flex;align-items:center;gap:5px;margin-left:8px;">
          ${miniCheckboxHtml("bonus1", a, creatorState.asiBonus.plus1 === a)} +1
        </span>
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
  document.querySelectorAll("[data-as-minus]").forEach(btn => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.asMinus;
      creatorState.scores[a] = Math.max(1, (creatorState.scores[a] ?? 8) - 1);
      redrawCreator();
    });
  });
  document.querySelectorAll("[data-as-plus]").forEach(btn => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.asPlus;
      creatorState.scores[a] = Math.min(20, (creatorState.scores[a] ?? 8) + 1);
      redrawCreator();
    });
  });
  document.querySelectorAll("[data-bonus2]").forEach(cb => {
    cb.addEventListener("click", () => {
      const a = cb.dataset.bonus2;
      if (creatorState.asiBonus.plus2 === a) { creatorState.asiBonus.plus2 = null; }
      else {
        creatorState.asiBonus.plus2 = a;
        if (creatorState.asiBonus.plus1 === a) creatorState.asiBonus.plus1 = null;
      }
      redrawCreator();
    });
  });
  document.querySelectorAll("[data-bonus1]").forEach(cb => {
    cb.addEventListener("click", () => {
      const a = cb.dataset.bonus1;
      if (creatorState.asiBonus.plus1 === a) { creatorState.asiBonus.plus1 = null; }
      else if (creatorState.asiBonus.plus2 === a) { showToast("Pick a different ability for the +1 bonus"); }
      else { creatorState.asiBonus.plus1 = a; }
      redrawCreator();
    });
  });
  document.getElementById("ability-clear-button").addEventListener("click", () => {
    creatorState.scores = {};
    creatorState.asiBonus = { plus2: null, plus1: null };
    redrawCreator();
  });
  document.getElementById("ability-recommended-button").addEventListener("click", () => {
    const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);
    const main = cls ? cls.mainAbility : CREATOR_ABILITY_ORDER[0];
    const others = CREATOR_ABILITY_ORDER.filter(a => a !== main);
    const pool = STANDARD_ARRAY.slice();
    creatorState.scores = {};
    creatorState.scores[main] = pool.shift();
    const secondary = others[0];
    creatorState.scores[secondary] = pool.shift();
    others.slice(1).forEach((a, i) => { creatorState.scores[a] = pool[i]; });
    creatorState.asiBonus = { plus2: main, plus1: secondary };
    redrawCreator();
  });
  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-next-button").addEventListener("click", goNext);
}


/* ---------- step: skills ---------- */

function skillsStepHtml(stepNum, totalSteps) {
  const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);
  const bg = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
  const race = SRD_RACES.find(r => r.name === creatorState.race);
  const bgSkills = bg ? bg.skills : [];
  const raceChoice = race && race.skillChoice ? race.skillChoice : null;

  let html = `
    <div class="modal-heading">Skills</div>
    <div class="breakdown-source">Step ${stepNum} of ${totalSteps} \u00B7 Proficiencies</div>
    <div class="field-row" style="justify-content:flex-end;gap:14px;margin:10px 0 4px;">
      ${raceChoice ? `<span style="font-size:11px;color:var(--text-dim);width:44px;text-align:center;">Race<br>${creatorState.raceSkillChoices.length}/${raceChoice.count}</span>` : ""}
      ${cls ? `<span style="font-size:11px;color:var(--text-dim);width:44px;text-align:center;">Class<br>${creatorState.classSkillChoices.length}/${cls.skillChoices.count}</span>` : ""}
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
      const isRace = creatorState.raceSkillChoices.includes(s.name);
      const isClass = creatorState.classSkillChoices.includes(s.name);
      const proficient = isBg || isRace || isClass;
      const bonus = mod + (proficient ? 2 : 0);
      const bonusStr = (bonus >= 0 ? "+" : "") + bonus;

      let raceSlot = `<span style="display:inline-block;width:44px;text-align:center;"></span>`;
      let classSlot = `<span style="display:inline-block;width:44px;text-align:center;"></span>`;
      if (isBg) {
        raceSlot = `<span style="display:inline-block;width:44px;text-align:center;"><span class="res-tag" style="background:var(--control-raised);color:var(--accent-soft);">BG</span></span>`;
      } else {
        // a skill picked from one source is off the table for every other --
        // 5e never lets the same proficiency be chosen twice over, and picking
        // it twice here would silently do nothing anyway (skillProficiency is
        // a single flag, not a count)
        if (raceChoice && raceChoice.options.includes(s.name)) {
          const disabled = isClass || (!isRace && creatorState.raceSkillChoices.length >= raceChoice.count);
          raceSlot = `<span style="display:inline-block;width:44px;text-align:center;">${miniCheckboxHtml("race-skill", s.name, isRace, disabled)}</span>`;
        }
        if (cls && cls.skillChoices.options.includes(s.name)) {
          const disabled = isRace || (!isClass && creatorState.classSkillChoices.length >= cls.skillChoices.count);
          classSlot = `<span style="display:inline-block;width:44px;text-align:center;">${miniCheckboxHtml("class-skill", s.name, isClass, disabled)}</span>`;
        }
      }

      html += `
        <div class="skill-row" style="cursor:default;">
          <span class="skill-name">${esc(s.name)}</span>
          <span class="skill-bonus">${bonusStr}</span>
          ${raceSlot}${classSlot}
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
  const race = SRD_RACES.find(r => r.name === creatorState.race);
  const raceChoice = race && race.skillChoice ? race.skillChoice : null;
  const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);

  document.querySelectorAll("[data-race-skill]").forEach(cb => {
    cb.addEventListener("click", (e) => {
      e.preventDefault();
      const name = cb.dataset.raceSkill;
      const idx = creatorState.raceSkillChoices.indexOf(name);
      if (idx >= 0) creatorState.raceSkillChoices.splice(idx, 1);
      else {
        if (creatorState.raceSkillChoices.length >= raceChoice.count) { showToast("Race skill choice already used"); return; }
        creatorState.raceSkillChoices.push(name);
      }
      redrawCreator();
    });
  });
  document.querySelectorAll("[data-class-skill]").forEach(cb => {
    cb.addEventListener("click", (e) => {
      e.preventDefault();
      const name = cb.dataset.classSkill;
      const idx = creatorState.classSkillChoices.indexOf(name);
      if (idx >= 0) creatorState.classSkillChoices.splice(idx, 1);
      else {
        if (creatorState.classSkillChoices.length >= cls.skillChoices.count) { showToast("Class skill choices already used"); return; }
        creatorState.classSkillChoices.push(name);
      }
      redrawCreator();
    });
  });
  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-next-button").addEventListener("click", goNext);
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

/* Each option is its own nested collapse-card (same collapse-head/
   collapse-body classes and CSS-driven open/close as a Features & Traits
   category or a trait row) instead of a button with its description always
   printed underneath -- ten dragon types' full Breath Weapon text stacked
   at once was a wall of text nobody was going to read. Clicking a header
   opens that option's card and closes whichever one was open, accordion-
   style; picking happens from the explicit button inside the open card, kept
   separate from "just looking" so browsing every ancestry before deciding
   doesn't change your answer as a side effect. creatorState.expandedChoiceOption
   is keyed by featureName so two different pending choices on the same step
   (rare, but possible) don't fight over which option is open. */
function choiceCardHtml(pending) {
  const key = pending.featureName;
  const answer = creatorState.choiceAnswers[key] || {};
  const options = creatorChoiceOptionsFor(pending);
  const selected = answer.chosen || [];
  const expanded = creatorState.expandedChoiceOption[key];

  return `
    <div class="collapse-card" style="margin-bottom:12px;">
      <div class="collapse-head" style="cursor:default;"><span>${esc(pending.prompt)}</span></div>
      <div class="collapse-body open" style="padding:2px 14px 14px;">
        <div class="breakdown-source" style="margin-bottom:8px;">From ${esc(pending.featureName)} — pick ${pending.count}</div>
        ${options && options.length ? options.map(opt => {
          const isSelected = selected.includes(opt);
          const isOpen = expanded === opt;
          const desc = choiceOptionDescFor(pending, opt);
          return `
            <div class="collapse-card" style="margin-bottom:8px;background:var(--control-raised);">
              <div class="collapse-head" data-choice-expand="${esc(key)}|||${esc(opt)}" style="padding:10px 12px;">
                <span>${esc(opt)}${isSelected ? " ✓" : ""}</span>
                <span>${isOpen ? "−" : "+"}</span>
              </div>
              <div class="collapse-body ${isOpen ? "open" : ""}" style="padding:0 12px 12px;">
                ${desc ? `<div class="trait-desc" style="margin-bottom:8px;">${esc(desc)}</div>` : ""}
                <button type="button" class="toggle-btn creator-option ${isSelected ? "active" : ""}"
                  data-choice-pick="${esc(key)}|||${esc(opt)}" style="display:block;width:100%;text-align:left;padding:8px 10px;">
                  ${isSelected ? "Selected" : "Choose this"}
                </button>
              </div>
            </div>
          `;
        }).join("") : `<div class="empty-hint" style="margin-bottom:8px;">Nothing to pick from — use the field below.</div>`}
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

  document.querySelectorAll("[data-choice-expand]").forEach(head => {
    head.addEventListener("click", () => {
      const [key, opt] = head.dataset.choiceExpand.split("|||");
      creatorState.expandedChoiceOption[key] = (creatorState.expandedChoiceOption[key] === opt) ? null : opt;
      redrawCreator();
    });
  });

  document.querySelectorAll("[data-choice-pick]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const [key, opt] = btn.dataset.choicePick.split("|||");
      const pending = pendings.find(p => p.featureName === key);
      if (!pending) return;
      const chosen = (creatorState.choiceAnswers[key] && creatorState.choiceAnswers[key].chosen || []).slice();
      const idx = chosen.indexOf(opt);
      if (idx >= 0) chosen.splice(idx, 1);
      else {
        if (chosen.length >= pending.count) { showToast("You can only pick " + pending.count); return; }
        chosen.push(opt);
      }
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
    delete creatorState.expandedChoiceOption[p.featureName];
  });
}


/* ---------- step: choices (skill-kind leftovers only) ----------

   Everything else now answers on the step that granted it. What's left here
   is "skill" kind alone -- Expertise-style "pick skills you're already
   proficient in" -- since its option list depends on Skills having run.
   Only reached when creatorSkillChoices() actually found one. */

function choicesStepHtml(stepNum, totalSteps) {
  const pendings = creatorSkillChoices();
  return `
    <div class="modal-heading">Choices</div>
    <div class="breakdown-source" style="margin-bottom:10px;">Step ${stepNum} of ${totalSteps} · What your features grant</div>
    ${pendings.map(choiceCardHtml).join("")}
    ${creatorNavHtml()}
  `;
}

function wireChoicesStep() {
  const pendings = creatorSkillChoices();
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
   background, point-buy scores, the +2/+1 overlay and the skill picks -- gets
   mapped onto the same shape the demo character uses. Nothing here is new
   data: SRD_RACES, SRD_CLASSES and SRD_BACKGROUNDS already hold the features
   and proficiencies, the creator was just rendering and discarding them. */

const ABILITY_ABBREVIATIONS = {
  Strength: "STR", Dexterity: "DEX", Constitution: "CON",
  Intelligence: "INT", Wisdom: "WIS", Charisma: "CHA"
};

// the sheet keys skills without spaces ("SleightOfHand"), the creator lists
// them with ("Sleight of Hand")
function skillKey(name) {
  return name.replace(/[^a-zA-Z]/g, "");
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
  const race = SRD_RACES.find(r => r.name === creatorState.race);
  const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);
  const background = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
  const subrace = race && race.subraces
    ? race.subraces.find(s => s.name === creatorState.subrace) : null;
  const subclass = cls && cls.subclasses
    ? cls.subclasses.find(s => s.name === creatorState.subclass) : null;

  const abilities = {};
  CREATOR_ABILITY_ORDER.forEach(name => { abilities[ABILITY_ABBREVIATIONS[name]] = finalScoreFor(name); });

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

  const traits = {
    "Race Traits": raceFeatures.map(asTraitEntry),
    "Class Features": classFeatures.map(asTraitEntry),
    "Background Features": background ? [{ name: background.feature.name, desc: background.feature.desc }] : [],
    "Feats": [],
    "Proficiencies": cls ? [
      { name: "Armor", desc: cls.armorProf },
      { name: "Weapons", desc: cls.weaponProf },
      ...(cls.toolProf ? [{ name: "Tools", desc: cls.toolProf }] : [])
    ] : []
  };

  // a first-level character has one hit die and takes its maximum for HP
  const hitDieSize = cls ? parseInt(cls.hitDie.replace("d", "")) : 8;
  const constitution = abilityModifier(abilities.CON);

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

    hp: { current: hitDieSize + constitution, temp: 0 },
    baseMaxHP: hitDieSize + constitution,
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
  raceFeatures.forEach(f => grantPendingChoice(built, f, "Race Traits"));
  classFeatures.forEach(f => grantPendingChoice(built, f, "Class Features"));

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

  return built;
}


/* ---------- step: equipment ---------- */

function equipmentStepHtml(stepNum, totalSteps) {
  const kit = STARTING_KIT[creatorState.charClass];
  const granted = (kit.gear || []).map(key => KIT_ITEMS[key].name);

  return `
    <div class="modal-heading">Equipment</div>
    <div class="breakdown-source">Step ${stepNum} of ${totalSteps} · Starting Gear</div>

    ${kit.choices.map((choice, choiceIndex) => `
      <div class="breakdown-subhead">${esc(choice.prompt)}</div>
      ${choice.options.map((option, optionIndex) => `
        <button class="toggle-btn creator-option ${creatorState.equipment[choiceIndex] === optionIndex ? "active" : ""}"
          data-kit-choice="${choiceIndex}" data-kit-option="${optionIndex}"
          style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px 14px;">
          ${esc(option.label)}
        </button>
      `).join("")}
    `).join("")}

    ${granted.length ? `
      <div class="breakdown-subhead">Also carried</div>
      <div class="chip-row">${granted.map(name => `<div class="chip chip-stat">${esc(name)}</div>`).join("")}</div>
    ` : ""}

    ${creatorNavHtml()}`;
}

function wireEquipmentStep() {
  document.querySelectorAll("[data-kit-choice]").forEach(button => {
    button.addEventListener("click", () => {
      creatorState.equipment[parseInt(button.dataset.kitChoice)] = parseInt(button.dataset.kitOption);
      redrawCreator();
    });
  });
  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-next-button").addEventListener("click", () => {
    const kit = STARTING_KIT[creatorState.charClass];
    const undecided = kit.choices.findIndex((choice, index) => creatorState.equipment[index] === undefined);
    if (undecided !== -1) { showToast("Choose your " + kit.choices[undecided].prompt.toLowerCase()); return; }
    goNext();
  });
}

/* Turns the chosen keys into inventory entries. Stacks of the same thing merge
   rather than appearing twice, so picking two daggers gives you one entry with
   a quantity of two. */
function buildStartingInventory() {
  const kit = STARTING_KIT[creatorState.charClass];
  if (!kit) return [];

  const keys = (kit.gear || []).slice();
  kit.choices.forEach((choice, index) => {
    const chosen = choice.options[creatorState.equipment[index]];
    if (chosen) keys.push(...chosen.items);
  });

  const inventory = [];
  let nextId = 1;
  keys.forEach(key => {
    const template = KIT_ITEMS[key];
    if (!template) return;

    // a second dagger is a quantity, not a second row -- but only for things
    // that stack; two weapons you wield separately stay separate
    const stackable = !template.isWeapon && !template.armour;
    const existing = stackable && inventory.find(entry => entry.name === template.name);
    if (existing) { existing.qty += (template.qty || 1); return; }

    inventory.push(Object.assign({ id: nextId++, qty: 1 }, JSON.parse(JSON.stringify(template))));
  });

  return inventory;
}


/* ---------- step: name / appearance / backstory ---------- */

function finalStepHtml(stepNum, totalSteps) {
  return `
    <div class="modal-heading">New Character</div>
    <div class="breakdown-source">Step ${stepNum} of ${totalSteps} \u00B7 Name & Details</div>
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
    closeModal();
    showScreen("sheet");
    showToast(creatorState.customBuild ? "Created " + built.name + " (custom build)" : "Created " + built.name);
  });
}


/* ---------- dispatch ---------- */

function creatorStepHtml() {
  const key = currentStepKey();
  const keys = creatorStepKeys();
  const stepNum = creatorState.step + 1;
  const totalSteps = keys.length;
  if (key === "race") return raceStepHtml(stepNum, totalSteps);
  if (key === "class") return classStepHtml(stepNum, totalSteps);
  if (key === "subclass") return subclassStepHtml(stepNum, totalSteps);
  if (key === "background") return backgroundStepHtml(stepNum, totalSteps);
  if (key === "ability") return abilityStepHtml(stepNum, totalSteps);
  if (key === "skills") return skillsStepHtml(stepNum, totalSteps);
  if (key === "choices") return choicesStepHtml(stepNum, totalSteps);
  if (key === "equipment") return equipmentStepHtml(stepNum, totalSteps);
  return finalStepHtml(stepNum, totalSteps);
}

function wireCreatorStep() {
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
