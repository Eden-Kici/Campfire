/* ============================================================
   CHARACTER TAB
   ============================================================ */

let openSections = { abilityScores: true, savingThrows: true, skills: true, features: true };
let openFeatureCategories = {};

function renderCollapseSection(title, key, bodyHtml) {
  return `
    <div class="section-head-row" data-section-toggle="${key}" style="cursor:pointer;">
      <div class="section-head">${esc(title)}</div>
      <span style="color:var(--text-dim);font-size:12px;">${openSections[key] ? "\u2212" : "+"}</span>
    </div>
    ${openSections[key] ? bodyHtml : ""}
  `;
}

function renderCharacterTab() {
  const abilityOrder = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

  const abilityScoresHtml = `
    <div class="ability-grid">
      ${abilityOrder.map(a => `
        <div class="ability-box" data-ability="${a}">
          <button class="mini-edit" data-edit-ability="${a}">\u270E</button>
          <div class="ability-name">${a}</div>
          <div class="ability-mod">${formatModifier(abilityModifier(effectiveAbilityScore(character, a)))}</div>
          <div class="ability-score">${effectiveAbilityScore(character, a)}</div>
        </div>
      `).join("")}
    </div>
  `;

  const savingThrowsHtml = `
    <div class="skill-card">
      ${abilityOrder.map(a => {
        const save = calculateSavingThrow(character, a);
        return `
          <div class="skill-row" data-save="${a}">
            <div class="prof-dot ${character.savingThrowProficiency[a] ? "prof" : ""}"></div>
            <div class="skill-name">${ABILITY_FULL_NAMES[a]}</div>
            <div class="skill-bonus">${formatModifier(save.total)}${save.overridden ? "*" : ""}</div>
            <button class="mini-edit" data-edit-save="${a}">\u270E</button>
          </div>`;
      }).join("")}
    </div>
  `;

  const skillsHtml = `
    <div class="skill-card">
      ${Object.keys(character.skillAbilityMap).map(skillName => {
        const profLevel = character.skillProficiency[skillName] || 0;
        const dotClass = profLevel === 1 ? "prof" : profLevel === 2 ? "exp" : "";
        const skill = calculateSkill(character, skillName);
        return `
          <div class="skill-row" data-skill="${skillName}">
            <div class="prof-dot ${dotClass}"></div>
            <div class="skill-name">${skillName}</div>
            <div class="skill-ability-small">${character.skillAbilityMap[skillName]}</div>
            <div class="skill-bonus">${formatModifier(skill.total)}${skill.overridden ? "*" : ""}</div>
            <button class="mini-edit" data-edit-skill="${skillName}">\u270E</button>
          </div>`;
      }).join("")}
    </div>
  `;

  const featuresHtml = `
    ${Object.keys(character.traits).map(category => `
      <div class="collapse-card">
        <div class="collapse-head" data-trait-category="${esc(category)}">
          <span>${esc(category)}</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <button class="mini-edit" data-edit-subsection="${esc(category)}">\u270E</button>
            <span>${openFeatureCategories[category] ? "\u2212" : "+"}</span>
          </div>
        </div>
        <div class="collapse-body ${openFeatureCategories[category] ? "open" : ""}">
          ${character.traits[category].map((t, index) => `
            <div class="trait-item" data-feature-view="${esc(category)}|||${index}">
              <div class="trait-name">${esc(t.name)}</div>
              ${t.desc ? `<div class="trait-desc">${esc(t.desc)}</div>` : ""}
              ${t.effects && t.effects.length ? `<div class="trait-effect">Grants: ${t.effects.map(e => featureEffectSummary(e)).join(", ")}</div>` : ""}
            </div>
          `).join("") || `<div class="empty-hint">Nothing yet</div>`}
        </div>
      </div>
    `).join("")}
  `;

  return `
    ${renderCollapseSection("Ability Scores", "abilityScores", abilityScoresHtml)}
    ${renderCollapseSection("Saving Throws", "savingThrows", savingThrowsHtml)}
    ${renderCollapseSection("Skills", "skills", skillsHtml)}
    <div class="section-head-row" data-section-toggle="features" style="cursor:pointer;">
      <div class="section-head">Features & Traits</div>
      <button class="add-link" id="add-feature-button">+ Add</button>
    </div>
    ${openSections.features ? featuresHtml : ""}
  `;
}

function wireCharacterTab() {
  document.querySelectorAll("[data-section-toggle]").forEach(head => {
    head.addEventListener("click", () => {
      const key = head.dataset.sectionToggle;
      openSections[key] = !openSections[key];
      renderContent();
    });
  });

  // abilities, saves and skills all open a breakdown with a roll button, the
  // same pattern the Initiative and AC boxes already use
  document.querySelectorAll("[data-ability]").forEach(box => {
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-edit-ability]")) return;
      const a = box.dataset.ability;
      const check = calculateAbilityCheck(character, a);
      openBreakdownModal(ABILITY_FULL_NAMES[a] + " Check", formatModifier(check.total), "", check.sources,
        { label: ABILITY_FULL_NAMES[a] + " Check", notation: "1d20" + formatModifier(check.total), kind: "check" });
    });
  });
  document.querySelectorAll("[data-edit-ability]").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); openEditAbilityModal(btn.dataset.editAbility); }));

  // rows in these two lists roll straight away -- the maths lives behind the
  // pencil, so the common action stays one tap
  document.querySelectorAll("[data-save]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-edit-save]")) return;
      const a = row.dataset.save;
      const save = calculateSavingThrow(character, a);
      showRoll({ label: ABILITY_FULL_NAMES[a] + " Save", notation: "1d20" + formatModifier(save.total),
                 sources: save.sources, kind: "save", ability: a });
    });
  });
  document.querySelectorAll("[data-edit-save]").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); openEditSavingThrowModal(btn.dataset.editSave); }));

  document.querySelectorAll("[data-skill]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-edit-skill]")) return;
      const name = row.dataset.skill;
      const skill = calculateSkill(character, name);
      showRoll({ label: name, notation: "1d20" + formatModifier(skill.total),
                 sources: skill.sources, kind: "check" });
    });
  });
  document.querySelectorAll("[data-edit-skill]").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); openEditSkillModal(btn.dataset.editSkill); }));

  document.querySelectorAll("[data-trait-category]").forEach(head => {
    head.addEventListener("click", (e) => {
      if (e.target.closest("[data-edit-subsection]")) return;
      const category = head.dataset.traitCategory;
      openFeatureCategories[category] = !openFeatureCategories[category];
      renderContent();
    });
  });
  document.querySelectorAll("[data-edit-subsection]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); openEditSubsectionModal(btn.dataset.editSubsection); });
  });
  document.querySelectorAll("[data-feature-view]").forEach(row => {
    row.addEventListener("click", () => {
      const [category, index] = row.dataset.featureView.split("|||");
      openEditFeatureModal(category, parseInt(index));
    });
  });
  const addFeatureButton = document.getElementById("add-feature-button");
  if (addFeatureButton) addFeatureButton.addEventListener("click", (e) => { e.stopPropagation(); openAddFeatureOrSectionModal(); });
}

/* The proficiency bonus is normally a function of level, but the app has no
   level model yet and homebrew content sets it directly, so the base is
   editable and effects still stack on top. */
function openEditProficiencyModal() {
  const bonus = calculateProficiencyBonus(character);

  let overrideOn = bonus.overridden;

  openModal("center", `
    <div class="breakdown-title">Proficiency Bonus</div>
    ${breakdownRowsHtml(bonus.sources)}
    <hr class="breakdown-divider">
    <div class="breakdown-total" style="margin-bottom:14px;"><span>Total</span><span>${formatModifier(bonus.total)}</span></div>
    <div class="field"><label>Base</label><input id="edit-prof-base" type="number" value="${bonus.sources[0].value}"></div>
    <div class="toggle-line"><span>Set it manually</span><div class="switch ${bonus.overridden ? "on" : ""}" id="prof-override-switch"><div class="knob"></div></div></div>
    <div class="menu-note" style="margin-top:0;">Normally ${proficiencyBonusForLevel(bonus.level)} at level ${bonus.level}. Set it manually for homebrew or a table ruling. Anything granting a bonus adds on top either way.</div>
    <button class="btn-primary" id="save-prof-button" style="margin-top:14px;">Save</button>
  `);

  const overrideSwitch = document.getElementById("prof-override-switch");
  overrideSwitch.addEventListener("click", () => {
    overrideOn = !overrideOn;
    overrideSwitch.classList.toggle("on", overrideOn);
  });

  document.getElementById("save-prof-button").addEventListener("click", () => {
    const value = parseInt(document.getElementById("edit-prof-base").value);
    if (overrideOn && !isNaN(value)) character.proficiencyBonusOverride = value;
    else character.proficiencyBonusOverride = null;
    closeModal();
    renderContent();
  });
}

function openEditAbilityModal(ability) {
  const check = calculateAbilityCheck(character, ability);

  openModal("center", `
    <div class="breakdown-title">${ABILITY_FULL_NAMES[ability]}</div>
    ${breakdownRowsHtml(check.sources)}
    <hr class="breakdown-divider">
    <div class="breakdown-total" style="margin-bottom:14px;"><span>Modifier</span><span>${formatModifier(check.total)}</span></div>
    <div class="field"><label>Base Score</label><input id="edit-ability-score" type="number" value="${character.abilities[ability]}"></div>
    <button class="btn-primary" id="save-ability-button">Save</button>
  `);
  document.getElementById("save-ability-button").addEventListener("click", () => {
    character.abilities[ability] = parseInt(document.getElementById("edit-ability-score").value) || character.abilities[ability];
    closeModal();
    renderContent();
  });
}

function openEditSavingThrowModal(ability) {
  const overrideVal = character.savingThrowOverride[ability];
  const isOverridden = overrideVal !== undefined && overrideVal !== null;
  let overrideOn = isOverridden;

  const current = calculateSavingThrow(character, ability);

  openModal("center", `
    <div class="breakdown-title">${ABILITY_FULL_NAMES[ability]} Save</div>
    ${breakdownRowsHtml(current.sources)}
    <hr class="breakdown-divider">
    <div class="breakdown-total" style="margin-bottom:14px;"><span>Total</span><span>${formatModifier(current.total)}</span></div>
    <div class="field"><label>Proficient?</label>
      ${selectFieldHtml("edit-save-prof", "", [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }], character.savingThrowProficiency[ability] ? "yes" : "no")}
    </div>
    <div class="toggle-line"><span>Override bonus</span><div class="switch ${isOverridden ? "on" : ""}" id="save-override-switch"><div class="knob"></div></div></div>
    <div id="save-override-wrap">${isOverridden ? `<div class="field"><label>Bonus</label><input id="edit-save-override-value" type="number" value="${overrideVal}"></div>` : ""}</div>
    <button class="btn-primary" id="save-save-button">Save</button>
  `);

  wireSelect("edit-save-prof");

  const switchEl = document.getElementById("save-override-switch");
  const wrap = document.getElementById("save-override-wrap");
  switchEl.addEventListener("click", () => {
    overrideOn = !overrideOn;
    switchEl.classList.toggle("on", overrideOn);
    const startVal = isOverridden ? overrideVal : calculateSavingThrow(character, ability).total;
    wrap.innerHTML = overrideOn ? `<div class="field"><label>Bonus</label><input id="edit-save-override-value" type="number" value="${startVal}"></div>` : "";
  });

  document.getElementById("save-save-button").addEventListener("click", () => {
    character.savingThrowProficiency[ability] = document.getElementById("edit-save-prof").value === "yes" ? 1 : 0;
    if (overrideOn) {
      const input = document.getElementById("edit-save-override-value");
      character.savingThrowOverride[ability] = parseInt(input.value) || 0;
    } else {
      delete character.savingThrowOverride[ability];
    }
    closeModal();
    renderContent();
  });
}

function openEditSkillModal(skillName) {
  const current = character.skillProficiency[skillName] || 0;
  const overrideVal = character.skillOverride[skillName];
  const isOverridden = overrideVal !== undefined && overrideVal !== null;
  let overrideOn = isOverridden;

  const currentSkill = calculateSkill(character, skillName);

  openModal("center", `
    <div class="breakdown-title">${skillName}</div>
    ${breakdownRowsHtml(currentSkill.sources)}
    <hr class="breakdown-divider">
    <div class="breakdown-total" style="margin-bottom:14px;"><span>Total</span><span>${formatModifier(currentSkill.total)}</span></div>
    ${selectFieldHtml("edit-skill-prof", "Proficiency", [
      { value: "0", label: "None" }, { value: "1", label: "Proficient" }, { value: "2", label: "Expertise" }
    ], String(current))}
    <div class="toggle-line"><span>Override bonus</span><div class="switch ${isOverridden ? "on" : ""}" id="skill-override-switch"><div class="knob"></div></div></div>
    <div id="skill-override-wrap">${isOverridden ? `<div class="field"><label>Bonus</label><input id="edit-skill-override-value" type="number" value="${overrideVal}"></div>` : ""}</div>
    <button class="btn-primary" id="save-skill-button">Save</button>
  `);

  wireSelect("edit-skill-prof");

  const switchEl = document.getElementById("skill-override-switch");
  const wrap = document.getElementById("skill-override-wrap");
  switchEl.addEventListener("click", () => {
    overrideOn = !overrideOn;
    switchEl.classList.toggle("on", overrideOn);
    const startVal = isOverridden ? overrideVal : calculateSkill(character, skillName).total;
    wrap.innerHTML = overrideOn ? `<div class="field"><label>Bonus</label><input id="edit-skill-override-value" type="number" value="${startVal}"></div>` : "";
  });

  document.getElementById("save-skill-button").addEventListener("click", () => {
    character.skillProficiency[skillName] = parseInt(document.getElementById("edit-skill-prof").value);
    if (overrideOn) {
      const input = document.getElementById("edit-skill-override-value");
      character.skillOverride[skillName] = parseInt(input.value) || 0;
    } else {
      delete character.skillOverride[skillName];
    }
    closeModal();
    renderContent();
  });
}


/* ---------------- features & traits ---------------- */

function openEditSubsectionModal(category) {
  openModal("center", `
    <div class="breakdown-title">Edit Section</div>
    <div class="field"><label>Name</label><input id="edit-subsection-name" value="${esc(category)}"></div>
    <div class="btn-row-2">
      <button class="btn-primary" id="save-subsection-edit-button">Save Changes</button>
      <button class="btn-primary" id="remove-subsection-button" style="background:var(--danger-surface);color:var(--danger-text);">Remove</button>
    </div>
  `);
  document.getElementById("save-subsection-edit-button").addEventListener("click", () => {
    const newName = document.getElementById("edit-subsection-name").value.trim();
    if (!newName || (newName !== category && character.traits[newName])) { closeModal(); return; }
    if (newName !== category) {
      const entries = character.traits[category];
      delete character.traits[category];
      character.traits[newName] = entries;
      if (openFeatureCategories[category] !== undefined) {
        openFeatureCategories[newName] = openFeatureCategories[category];
        delete openFeatureCategories[category];
      }
    }
    closeModal();
    renderContent();
  });
  document.getElementById("remove-subsection-button").addEventListener("click", () => {
    const count = character.traits[category].length;
    const warning = count > 0
      ? `This section contains ${count} feature${count === 1 ? "" : "s"} that will also be deleted. Remove "${esc(category)}"?`
      : `Remove empty section "${esc(category)}"?`;
    if (!confirm(warning)) return;
    delete character.traits[category];
    delete openFeatureCategories[category];
    closeModal();
    renderContent();
  });
}

// shared by the feature editor and the active-effect editor; the two differ
// only in whether "Condition" is an allowed category.
function renderFeatureEffectsList(container, formEffects, categories) {
  categories = categories || EFFECT_CATEGORIES_FEATURE;
  container.innerHTML = formEffects.map((eff, idx) => `
    <div class="feature-effect-row">
      <div class="subcard-head">
        <span>Modifier ${idx + 1}</span>
        <button class="chip-remove" data-remove-effect="${idx}">\u2715</button>
      </div>
      ${selectFieldHtml("eff-category-" + idx, "Effect Category", categories, eff.category)}
      <div data-subfields-index="${idx}"></div>
    </div>
  `).join("");

  formEffects.forEach((eff, idx) => {
    const subEl = container.querySelector(`[data-subfields-index="${idx}"]`);
    subEl.innerHTML = effectSubfieldsHtml(eff.category, "feature-effect-" + idx);
    prefillEffectSubfields(eff, "feature-effect-" + idx);
    wireConditionField("feature-effect-" + idx, eff.value);
    wireSelectsIn(subEl);
  });

  formEffects.forEach((eff, idx) => {
    wireSelect("eff-category-" + idx);
    document.getElementById("eff-category-" + idx).addEventListener("change", (e) => {
      formEffects[idx].category = e.target.value;
      formEffects[idx].value = {};
      renderFeatureEffectsList(container, formEffects, categories);
    });
  });
  container.querySelectorAll("[data-remove-effect]").forEach(btn => {
    btn.addEventListener("click", () => {
      formEffects.splice(parseInt(btn.dataset.removeEffect), 1);
      renderFeatureEffectsList(container, formEffects, categories);
    });
  });
}

function readFeatureEffectsFromForm(formEffects) {
  return formEffects.map((eff, idx) => ({
    category: eff.category,
    value: readEffectValueFromForm(eff.category, "feature-effect-" + idx)
  }));
}

function openAddFeatureOrSectionModal() {
  const categories = Object.keys(character.traits);
  let mode = "feature";
  let formEffects = [];

  openModal("full", `
    <div class="modal-heading">Add to Features & Traits</div>
    <div class="btn-row-2" style="margin-bottom:14px;">
      <button class="toggle-btn active" id="mode-feature-btn" style="flex:1;padding:10px 0;">Add Feature</button>
      <button class="toggle-btn" id="mode-section-btn" style="flex:1;padding:10px 0;">Add Section</button>
    </div>
    <div id="add-body"></div>
  `);

  const modeFeatureBtn = document.getElementById("mode-feature-btn");
  const modeSectionBtn = document.getElementById("mode-section-btn");
  const body = document.getElementById("add-body");

  function renderFeatureBody() {
    body.innerHTML = `
      ${selectFieldHtml("new-feature-category", "Section", categories)}
      <div class="field"><label>Name</label><input id="new-feature-name" placeholder="e.g. Great Weapon Master"></div>
      <div class="field"><label>Description</label><input id="new-feature-desc" placeholder="Optional"></div>
      <div class="field"><label>Effects</label></div>
      <div id="feature-effects-list"></div>
      <button class="add-link" id="add-feature-effect-button">+ Add Effect</button>
      <button class="btn-primary" id="save-feature-button" style="margin-top:14px;">Add Feature</button>
    `;
    wireSelect("new-feature-category");
    const listEl = document.getElementById("feature-effects-list");
    renderFeatureEffectsList(listEl, formEffects);
    document.getElementById("add-feature-effect-button").addEventListener("click", () => {
      formEffects.push({ category: "Bonus", value: {} });
      renderFeatureEffectsList(listEl, formEffects);
    });
    document.getElementById("save-feature-button").addEventListener("click", () => {
      const category = document.getElementById("new-feature-category").value;
      const name = document.getElementById("new-feature-name").value.trim() || "New Feature";
      const desc = document.getElementById("new-feature-desc").value.trim();
      const entry = { name, desc };
      const effects = readFeatureEffectsFromForm(formEffects);
      if (effects.length) entry.effects = effects;
      character.traits[category].push(entry);
      closeModal();
      renderContent();
    });
  }

  function renderSectionBody() {
    body.innerHTML = `
      <div class="field"><label>Name</label><input id="new-subsection-name" placeholder="e.g. Boons, Curses, Titles"></div>
      <button class="btn-primary" id="save-subsection-button">Add Section</button>
    `;
    document.getElementById("save-subsection-button").addEventListener("click", () => {
      const name = document.getElementById("new-subsection-name").value.trim();
      if (!name || character.traits[name]) { closeModal(); return; }
      character.traits[name] = [];
      openFeatureCategories[name] = true;
      closeModal();
      renderContent();
    });
  }

  modeFeatureBtn.addEventListener("click", () => {
    if (mode === "feature") return;
    mode = "feature";
    modeFeatureBtn.classList.add("active");
    modeSectionBtn.classList.remove("active");
    formEffects = [];
    renderFeatureBody();
  });
  modeSectionBtn.addEventListener("click", () => {
    if (mode === "section") return;
    mode = "section";
    modeSectionBtn.classList.add("active");
    modeFeatureBtn.classList.remove("active");
    renderSectionBody();
  });

  renderFeatureBody();
}

function openEditFeatureModal(category, index) {
  const trait = character.traits[category][index];
  let formEffects = trait.effects ? JSON.parse(JSON.stringify(trait.effects)) : [];

  openModal("full", `
    <div class="modal-heading">Edit Feature</div>
    <div class="field"><label>Name</label><input id="edit-feature-name" value="${esc(trait.name)}"></div>
    <div class="field"><label>Description</label><input id="edit-feature-desc" value="${esc(trait.desc || "")}"></div>
    <div class="field"><label>Effects</label></div>
    <div id="feature-effects-list"></div>
    <button class="add-link" id="add-feature-effect-button">+ Add Effect</button>
    <div class="btn-row-2" style="margin-top:14px;">
      <button class="btn-primary" id="save-feature-edit-button">Save Changes</button>
      <button class="btn-primary" id="remove-feature-button" style="background:var(--danger-surface);color:var(--danger-text);">Remove</button>
    </div>
  `);

  const listEl = document.getElementById("feature-effects-list");
  renderFeatureEffectsList(listEl, formEffects);
  document.getElementById("add-feature-effect-button").addEventListener("click", () => {
    formEffects.push({ category: "Bonus", value: {} });
    renderFeatureEffectsList(listEl, formEffects);
  });

  document.getElementById("save-feature-edit-button").addEventListener("click", () => {
    trait.name = document.getElementById("edit-feature-name").value.trim() || trait.name;
    trait.desc = document.getElementById("edit-feature-desc").value.trim();
    const effects = readFeatureEffectsFromForm(formEffects);
    if (effects.length) trait.effects = effects; else delete trait.effects;
    closeModal();
    renderContent();
  });
  document.getElementById("remove-feature-button").addEventListener("click", () => {
    character.traits[category].splice(index, 1);
    closeModal();
    renderContent();
  });
}
