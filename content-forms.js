/* ============================================================
   CONTENT LIBRARY -- FORMS (POC)

   Split out of content.js once that file crossed the 1,500-line ceiling
   the structure suite enforces (see tests/structure.test.js). This half is
   every editor: the shared feature-list/effect/choice/resource machinery
   custom content forms lean on, plus the item/race/class/background/
   subclass/feature forms themselves. content.js keeps the library state,
   the browsing/search/filter screens, and SRD detail + duplicate. Both
   halves share one global scope like every other file pair in this app --
   see index.html for the load order this depends on. */

/* ---------- shared: repeatable name+description feature rows ----------

   Used for race features, subrace features, class features and subclass
   features -- the last two also carry a level. This is also where custom
   content earns parity with the SRD set: a feature row can carry the same
   three things a hand-authored SRD feature can --

     - Effects (renderFeatureEffectsList, the same list the character tab's
       own feature editor uses) -- a permanent stat bonus, same shape as
       "Fighting Style: Defence" in the demo character.
     - A choice descriptor -- the same `.choice` shape srd-data.js attaches
       to Extra Language, Fighting Style, Expertise and Cantrip, read by the
       exact same pendingChoiceFor()/applyChoiceResolution() pipeline. A
       custom feature can only offer a kind the app knows how to resolve
       (CHOICE_KINDS), not an arbitrary one -- offering a choice nothing
       could ever answer would be worse than not offering one.
     - A resource descriptor -- the same shape Second Wind carries, read by
       the "+ Add to Resources" button on the Character tab.

   All three are optional and stored directly on the feature object rather
   than in separate editor state, so syncFeatureList (the same "read every
   row before any structural change" pattern the rest of this file uses) is
   the only place that has to know how to turn form fields back into data. */

function choiceFieldsHtml(idPrefix, i, choice) {
  choice = choice || { kind: "language", count: 1, prompt: "" };
  return `
    <div class="field-row">
      ${selectFieldHtml(idPrefix + "-choice-" + i + "-kind", "Kind", CHOICE_KINDS, choice.kind)}
      ${numberFieldHtml(idPrefix + "-choice-" + i + "-count", "Picks", choice.count, { min: 1, max: 6 })}
    </div>
    ${textFieldHtml(idPrefix + "-choice-" + i + "-prompt", "Prompt", choice.prompt, { placeholder: "e.g. Choose an extra language" })}
    ${choice.kind === "custom" ? customChoiceOptionsHtml(idPrefix, i, choice.options || []) : ""}
  `;
}

/* The 4 built-in kinds resolve through a list the app already knows
   (languages, skills you're proficient in, fighting styles, cantrips) --
   "custom" has no such list, so the author writes the options themselves.
   Each one can optionally carry its own effects, the exact shape a Fighting
   Style option already uses (Defense grants +1 AC, Protection grants
   nothing) -- picking an option with none just records what was chosen,
   same as the manual field everywhere else in the choice system. */
function customChoiceOptionsHtml(idPrefix, i, options) {
  return `
    <div class="field-hint" style="margin:8px 0 4px;">Options</div>
    <div id="${idPrefix}-choice-${i}-opts">
      ${options.map((opt, j) => customChoiceOptionRowHtml(idPrefix, i, j, opt)).join("") || `<div class="empty-hint">None yet.</div>`}
    </div>
    <button type="button" class="add-link" data-add-choice-option="${i}">+ Add Option</button>
  `;
}

function customChoiceOptionRowHtml(idPrefix, i, j, opt) {
  return `
    <div class="feature-effect-row" data-choice-option-row="${j}">
      <div class="subcard-head">
        <span>Option ${j + 1}</span>
        <button type="button" class="chip-remove" data-remove-choice-option="${j}">✕</button>
      </div>
      ${textFieldHtml(idPrefix + "-choice-" + i + "-opt-" + j + "-label", "Label", opt.label, { placeholder: "e.g. Bear Totem" })}
      ${toggleLineHtml(idPrefix + "-choice-" + i + "-opt-" + j + "-fxon", "Grants an effect", !!opt.effects)}
      <div id="${idPrefix}-choice-${i}-opt-${j}-fxwrap"></div>
    </div>
  `;
}

/* Reads every option's current label back into `choice.options`, in place --
   the same "sync before any structural change" rule the rest of this file
   follows. Effects are only read when that option's switch is on; turning
   it off drops them, matching how the feature-level effects switch behaves. */
function syncChoiceOptions(idPrefix, i, choice) {
  if (choice.kind !== "custom" || !choice.options) return;
  choice.options.forEach((opt, j) => {
    const labelEl = document.getElementById(idPrefix + "-choice-" + i + "-opt-" + j + "-label");
    if (!labelEl) return;
    opt.label = labelEl.value;
    if (opt.effects) opt.effects = readFeatureEffectsFromForm(opt.effects, idPrefix + "-choice-" + i + "-opt-" + j + "-fx");
  });
}

/* Wired fresh every time renderFeatureListEditor redraws a feature row, same
   as the effect/choice/resource switches just above it in the file. */
function wireChoiceOptionsEditor(idPrefix, i, f) {
  if (f.choice.kind !== "custom") return;
  if (!f.choice.options) f.choice.options = [];
  const wrap = document.getElementById(idPrefix + "-choice-" + i + "-opts");
  if (!wrap) return;

  function resync() { syncFeatureList(idPrefix, [f], false); }
  function redrawOptions() {
    wrap.innerHTML = f.choice.options.map((opt, j) => customChoiceOptionRowHtml(idPrefix, i, j, opt)).join("") || `<div class="empty-hint">None yet.</div>`;
    wireRows();
  }

  function wireRows() {
    f.choice.options.forEach((opt, j) => {
      if (opt.effects) renderFeatureEffectsList(document.getElementById(idPrefix + "-choice-" + i + "-opt-" + j + "-fxwrap"), opt.effects, EFFECT_CATEGORIES_FEATURE, idPrefix + "-choice-" + i + "-opt-" + j + "-fx");
      document.getElementById(idPrefix + "-choice-" + i + "-opt-" + j + "-fxon").addEventListener("click", () => {
        resync();
        if (opt.effects) delete opt.effects; else opt.effects = [];
        redrawOptions();
      });
    });
    wrap.querySelectorAll("[data-remove-choice-option]").forEach(btn => {
      btn.addEventListener("click", () => {
        resync();
        f.choice.options.splice(parseInt(btn.dataset.removeChoiceOption), 1);
        redrawOptions();
      });
    });
  }

  const addBtn = document.querySelector(`[data-add-choice-option="${i}"]`);
  if (addBtn) addBtn.addEventListener("click", () => {
    resync();
    f.choice.options.push({ label: "" });
    redrawOptions();
  });

  wireRows();
}

function resourceFieldsHtml(idPrefix, i, resource) {
  resource = resource || { max: 1, recharge: { on: "SR", amount: "all" } };
  return `
    ${scalingValueFieldsHtml(idPrefix + "-res-" + i + "-max", resource.max, "Max Uses")}
    ${rechargeFieldHtml(idPrefix + "-res-" + i, resource.recharge)}
  `;
}

/* A plain feature (no effect, no choice, no resource) renders as just Name +
   Description + this row -- a single "+ Add mechanic" link, nothing else.
   Attached mechanics show as small removable chips instead of the 3
   always-on toggle switches this used to be; that meant every homebrew
   feature paid for 3 blocks of vertical space whether it used them or not. */
function mechanicChipsHtml(idPrefix, i, f) {
  const chips = [];
  if (f.effects) chips.push({ key: "fx", label: "Effect" + (f.effects.length > 1 ? " ×" + f.effects.length : "") });
  if (f.choice) chips.push({ key: "choice", label: "Choice — " + ((CHOICE_KINDS.find(k => k.value === f.choice.kind) || {}).label || f.choice.kind) });
  if (f.resource) chips.push({ key: "res", label: "Resource" });

  return `
    <div class="chip-row" style="margin-top:10px;margin-bottom:0;">
      ${chips.map(c => `<div class="chip">${esc(c.label)}<button type="button" class="chip-remove" id="${idPrefix}-mechrm-${i}-${c.key}">✕</button></div>`).join("")}
      ${chips.length < 3 ? `<button type="button" class="add-link" id="${idPrefix}-mechadd-${i}">+ Add mechanic</button>` : ""}
    </div>
    <div id="${idPrefix}-mechmenu-${i}"></div>
    ${f.effects ? `<div id="${idPrefix}-fxwrap-${i}" style="margin-top:8px;"></div>` : ""}
    ${f.choice ? `<div id="${idPrefix}-choicewrap-${i}" style="margin-top:8px;">${choiceFieldsHtml(idPrefix, i, f.choice)}</div>` : ""}
    ${f.resource ? `<div id="${idPrefix}-reswrap-${i}" style="margin-top:8px;">${resourceFieldsHtml(idPrefix, i, f.resource)}</div>` : ""}
  `;
}

function mechanicAddMenuHtml(idPrefix, i, f) {
  const options = [];
  if (!f.effects) options.push({ key: "fx", label: "Effect" });
  if (!f.choice) options.push({ key: "choice", label: "Choice" });
  if (!f.resource) options.push({ key: "res", label: "Resource" });
  return `<div class="chip-row" style="margin:6px 0 10px;">${options.map(o => `<button type="button" class="toggle-btn" id="${idPrefix}-mechpick-${i}-${o.key}">+ ${esc(o.label)}</button>`).join("")}</div>`;
}

/* Wires the "+ Add mechanic" button and each attached mechanic's remove chip
   for one feature row. `sync` must read every row's current fields back into
   the data before anything structural changes (the rule the rest of this
   file follows); `redraw` repaints whatever this feature's editor lives
   inside -- a whole feature list for race/class, the single-feature
   background form. */
function wireMechanicChips(idPrefix, i, f, sync, redraw) {
  ["fx", "choice", "res"].forEach(key => {
    const btn = document.getElementById(idPrefix + "-mechrm-" + i + "-" + key);
    if (!btn) return;
    btn.addEventListener("click", () => {
      sync();
      if (key === "fx") delete f.effects;
      if (key === "choice") delete f.choice;
      if (key === "res") delete f.resource;
      redraw();
    });
  });

  const addBtn = document.getElementById(idPrefix + "-mechadd-" + i);
  if (addBtn) addBtn.addEventListener("click", () => {
    document.getElementById(idPrefix + "-mechmenu-" + i).innerHTML = mechanicAddMenuHtml(idPrefix, i, f);
    ["fx", "choice", "res"].forEach(key => {
      const pickBtn = document.getElementById(idPrefix + "-mechpick-" + i + "-" + key);
      if (!pickBtn) return;
      pickBtn.addEventListener("click", () => {
        sync();
        if (key === "fx") f.effects = [];
        if (key === "choice") f.choice = { kind: "language", count: 1, prompt: "" };
        if (key === "res") f.resource = { max: 1, recharge: { on: "SR", amount: "all" } };
        redraw();
      });
    });
  });
}

/* Reads every row's current DOM state back into `features`, in place. Called
   before any structural change (add, remove, a toggle switching a block on
   or off) so a redraw never loses what was typed into a sibling row, and
   again at final Save. Rows whose "grants a ___" switch is off keep no data
   for that block at all -- turning it back on starts fresh rather than
   resurrecting something a homebrew author decided to remove. */
function syncFeatureList(idPrefix, features, withLevel) {
  features.forEach((f, i) => {
    const nameEl = document.getElementById(idPrefix + "-name-" + i);
    if (!nameEl) return;
    f.name = nameEl.value;
    f.desc = document.getElementById(idPrefix + "-desc-" + i).value;
    if (withLevel) f.level = parseInt(document.getElementById(idPrefix + "-lvl-" + i).value) || 1;

    if (f.effects) f.effects = readFeatureEffectsFromForm(f.effects, idPrefix + "-fx-" + i);
    if (f.choice) {
      syncChoiceOptions(idPrefix, i, f.choice);
      const options = f.choice.options;
      f.choice = {
        kind: document.getElementById(idPrefix + "-choice-" + i + "-kind").value,
        count: parseInt(document.getElementById(idPrefix + "-choice-" + i + "-count").value) || 1,
        prompt: document.getElementById(idPrefix + "-choice-" + i + "-prompt").value.trim()
      };
      if (f.choice.kind === "custom") f.choice.options = options || [];
    }
    if (f.resource) {
      f.resource = {
        max: syncScalingValueFields(idPrefix + "-res-" + i + "-max", f.resource.max),
        recharge: readRechargeValue(idPrefix + "-res-" + i)
      };
    }
  });
  return features;
}

function renderFeatureListEditor(container, idPrefix, features, withLevel) {
  container.innerHTML = features.map((f, i) => `
    <div class="feature-effect-row">
      <div class="subcard-head">
        <span>Feature ${i + 1}</span>
        <button type="button" class="chip-remove" data-flist-remove="${i}">✕</button>
      </div>
      ${withLevel ? numberFieldHtml(idPrefix + "-lvl-" + i, "Level", f.level != null ? f.level : 1, { min: 1, max: 20 }) : ""}
      ${textFieldHtml(idPrefix + "-name-" + i, "Name", f.name)}
      ${textAreaFieldHtml(idPrefix + "-desc-" + i, "Description", f.desc)}
      ${mechanicChipsHtml(idPrefix, i, f)}
    </div>
  `).join("") || `<div class="empty-hint">None yet.</div>`;

  function resync() { syncFeatureList(idPrefix, features, withLevel); }
  function redraw() { renderFeatureListEditor(container, idPrefix, features, withLevel); }

  features.forEach((f, i) => {
    if (f.effects) renderFeatureEffectsList(document.getElementById(idPrefix + "-fxwrap-" + i), f.effects, EFFECT_CATEGORIES_FEATURE, idPrefix + "-fx-" + i);
    if (f.choice) {
      wireSelect(idPrefix + "-choice-" + i + "-kind");
      // switching Kind to/from "custom" changes whether the options editor
      // below it exists at all, so that one control needs a full re-render
      // rather than the live in-place updates the rest of the row gets
      document.getElementById(idPrefix + "-choice-" + i + "-kind").addEventListener("change", () => {
        resync();
        if (f.choice.kind === "custom" && !f.choice.options) f.choice.options = [];
        redraw();
      });
      wireChoiceOptionsEditor(idPrefix, i, f);
    }
    if (f.resource) {
      wireRechargeField(idPrefix + "-res-" + i);
      wireScalingValueFields(idPrefix + "-res-" + i + "-max", { get: () => f.resource.max, set: v => { f.resource.max = v; } });
    }
    wireMechanicChips(idPrefix, i, f, resync, redraw);
  });

  container.querySelectorAll("[data-flist-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      resync();
      features.splice(parseInt(btn.dataset.flistRemove), 1);
      redraw();
    });
  });
}

function addFeatureRow(container, idPrefix, features, withLevel) {
  syncFeatureList(idPrefix, features, withLevel);
  features.push({ name: "", desc: "", level: withLevel ? 1 : undefined });
  renderFeatureListEditor(container, idPrefix, features, withLevel);
}

/* ---------- custom item form (weapon / armour / gear) ----------

   Weapons and armour already had a form that didn't actually depend on being
   attached to a character's inventory -- weaponFieldsHtml, armourFieldsHtml,
   the type toggle, damage rows and the property picker are all pure form
   logic (tab-combat.js / tab-inventory.js). Reusing them here means a
   library item and a sheet's item are built the same way and can't drift
   apart. The one seam: wireWeaponFields() suggests ammo names from whichever
   character happens to be open, since that list has nowhere character-free
   to come from yet. Harmless -- it's just a suggestion, free text still
   works -- but it's a real gap a non-POC build would need to close. */

function customItemFormHtml() {
  const item = contentItemState.editingId
    ? customContent.items.find(i => i.id === contentItemState.editingId) : null;

  return `
    <div class="modal-heading">${item ? "Edit Custom Item" : "Add Custom Item"}</div>
    ${itemTypeToggleHtml(contentItemState.type)}
    ${textFieldHtml("ci-name", "Name", item ? item.name : "", { placeholder: "e.g. Potion of Healing", style: "margin-top:10px;" })}
    ${numberFieldHtml("ci-weight", "Weight (lb)", item && item.weight != null ? item.weight : 1)}
    ${textAreaFieldHtml("ci-desc", "Description (optional)", item ? item.description : "", { placeholder: "What it is, what it does" })}
    ${selectFieldHtml("ci-rarity", "Rarity", ["None"].concat(ITEM_RARITIES), item && item.rarity || "None")}
    ${toggleLineHtml("ci-attunement", "Requires Attunement", item ? !!item.attunement : false)}
    <div id="ci-type-fields"></div>
    <button class="btn-primary" id="ci-save-button" style="margin-top:10px;">${item ? "Save" : "Add to Library"}</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function openCustomItemForm(existingId) {
  const item = existingId ? customContent.items.find(i => i.id === existingId) : null;
  contentItemState = Object.assign({ editingId: existingId || null }, newItemFormState(item));
  contentScreen = "item-form";
  redrawContentManager();
}

function wireCustomItemForm() {
  const container = document.getElementById("ci-type-fields");
  const item = contentItemState.editingId
    ? customContent.items.find(i => i.id === contentItemState.editingId) : null;

  renderItemTypeFields(container, contentItemState.type, item, contentItemState);
  wireItemTypeToggle(contentItemState, container, item);
  wireSelect("ci-rarity");
  document.getElementById("ci-attunement").addEventListener("click", (e) => e.currentTarget.classList.toggle("on"));

  document.getElementById("content-back-button").addEventListener("click", () => {
    contentScreen = "list"; redrawContentManager();
  });

  document.getElementById("ci-save-button").addEventListener("click", () => {
    const name = document.getElementById("ci-name").value.trim();
    if (!name) { showToast("Enter a name"); return; }

    const rarity = document.getElementById("ci-rarity").value;
    const attunement = document.getElementById("ci-attunement").classList.contains("on");
    const built = Object.assign({
      id: contentItemState.editingId || nextCustomId("items"),
      name,
      weight: parseFloat(document.getElementById("ci-weight").value) || 0,
      description: document.getElementById("ci-desc").value.trim(),
      type: contentItemState.type
    }, rarity !== "None" ? { rarity, attunement } : {});
    applyItemType(built, contentItemState.type, contentItemState);

    if (contentItemState.editingId) {
      const idx = customContent.items.findIndex(i => i.id === contentItemState.editingId);
      customContent.items[idx] = built;
    } else {
      customContent.items.push(built);
    }
    persistCustomContent();
    contentScreen = "list";
    redrawContentManager();
    showToast((item ? "Saved " : "Added ") + name);
  });
}

/* ---------- custom race editor ---------- */

function openRaceForm(id) {
  const src = id == null ? null : customContent.races.find(r => r.id === id);
  raceFormState = {
    editingId: id,
    name: src ? src.name : "",
    features: JSON.parse(JSON.stringify((src && src.features) || [])),
    skillChoice: src && src.skillChoice ? JSON.parse(JSON.stringify(src.skillChoice)) : null,
    subraces: JSON.parse(JSON.stringify((src && src.subraces) || []))
  };
  contentScreen = "race-form";
  redrawContentManager();
}

function raceSkillChoiceFieldsHtml(sc) {
  return `
    ${numberFieldHtml("rf-sc-count", "Choices", sc.count || 1, { min: 1, max: ALL_SKILL_NAMES.length })}
    ${fieldLabelHtml("From")}
    <div class="chip-row" id="rf-sc-options" style="margin-bottom:6px;">
      ${ALL_SKILL_NAMES.map(name => `<button type="button" class="toggle-btn ${sc.options.includes(name) ? "active" : ""}" data-rf-skill-option="${esc(name)}" style="margin:2px;">${esc(name)}</button>`).join("")}
    </div>
  `;
}

function raceFormHtml() {
  const s = raceFormState;
  return `
    <div class="modal-heading">${s.editingId ? "Edit" : "New"} Custom Race</div>
    ${textFieldHtml("rf-name", "Name", s.name, { style: "margin-top:10px;" })}

    <div class="breakdown-subhead">Features</div>
    <div id="rf-features"></div>
    <button type="button" class="add-link" id="rf-add-feature">+ Add Feature</button>

    ${toggleLineHtml("rf-skillchoice-switch", "Grants a bonus skill choice", !!s.skillChoice, { style: "margin-top:14px;" })}
    <div id="rf-skillchoice-fields">${s.skillChoice ? raceSkillChoiceFieldsHtml(s.skillChoice) : ""}</div>

    <div class="breakdown-subhead">Subraces</div>
    <div id="rf-subraces"></div>
    <button type="button" class="add-link" id="rf-add-subrace">+ Add Subrace</button>

    <button class="btn-primary" id="rf-save-button" style="margin-top:14px;">Save</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function syncRaceSubraces() {
  raceFormState.subraces.forEach((sr, i) => {
    const nameEl = document.getElementById("rf-sub-" + i + "-name");
    if (nameEl) sr.name = nameEl.value;
    syncFeatureList("rf-sub-" + i + "-feat", sr.features, false);
  });
}

function renderRaceSubraces() {
  const container = document.getElementById("rf-subraces");
  container.innerHTML = raceFormState.subraces.map((sr, i) => `
    <div class="feature-effect-row">
      <div class="subcard-head">
        <span>Subrace ${i + 1}</span>
        <button type="button" class="chip-remove" data-remove-subrace="${i}">✕</button>
      </div>
      ${textFieldHtml("rf-sub-" + i + "-name", "Name", sr.name)}
      <div class="field-hint" style="margin:6px 0 4px;">Features</div>
      <div id="rf-sub-${i}-feat-list"></div>
      <button type="button" class="add-link" data-add-subfeature="${i}">+ Add Feature</button>
    </div>
  `).join("") || `<div class="empty-hint">No subraces.</div>`;

  raceFormState.subraces.forEach((sr, i) => {
    renderFeatureListEditor(document.getElementById("rf-sub-" + i + "-feat-list"), "rf-sub-" + i + "-feat", sr.features, false);
  });

  container.querySelectorAll("[data-remove-subrace]").forEach(btn => {
    btn.addEventListener("click", () => {
      syncRaceSubraces();
      raceFormState.subraces.splice(parseInt(btn.dataset.removeSubrace), 1);
      renderRaceSubraces();
    });
  });
  container.querySelectorAll("[data-add-subfeature]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.addSubfeature);
      addFeatureRow(document.getElementById("rf-sub-" + i + "-feat-list"), "rf-sub-" + i + "-feat", raceFormState.subraces[i].features, false);
    });
  });
}

function wireRaceForm() {
  const s = raceFormState;

  const featContainer = document.getElementById("rf-features");
  renderFeatureListEditor(featContainer, "rf-feat", s.features, false);
  document.getElementById("rf-add-feature").addEventListener("click", () => addFeatureRow(featContainer, "rf-feat", s.features, false));

  renderRaceSubraces();
  document.getElementById("rf-add-subrace").addEventListener("click", () => {
    syncRaceSubraces();
    s.subraces.push({ name: "", features: [] });
    renderRaceSubraces();
  });

  let scOn = !!s.skillChoice;
  if (!s.skillChoice) s.skillChoice = { count: 1, options: [] };   // scratch, so turning the switch on has something to show
  const scSwitch = document.getElementById("rf-skillchoice-switch");
  const scWrap = document.getElementById("rf-skillchoice-fields");
  function wireSkillChoiceOptions() {
    scWrap.querySelectorAll("[data-rf-skill-option]").forEach(btn => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.rfSkillOption;
        const idx = s.skillChoice.options.indexOf(name);
        if (idx >= 0) s.skillChoice.options.splice(idx, 1); else s.skillChoice.options.push(name);
        btn.classList.toggle("active", s.skillChoice.options.includes(name));
      });
    });
  }
  scSwitch.addEventListener("click", () => {
    scOn = !scOn;
    scSwitch.classList.toggle("on", scOn);
    scWrap.innerHTML = scOn ? raceSkillChoiceFieldsHtml(s.skillChoice) : "";
    if (scOn) wireSkillChoiceOptions();
  });
  if (scOn) wireSkillChoiceOptions();

  document.getElementById("content-back-button").addEventListener("click", () => {
    contentScreen = "list"; redrawContentManager();
  });

  document.getElementById("rf-save-button").addEventListener("click", () => {
    const name = document.getElementById("rf-name").value.trim();
    if (!name) { showToast("Enter a name"); return; }

    syncFeatureList("rf-feat", s.features, false);
    syncRaceSubraces();

    const skillChoice = scOn ? {
      count: parseInt(document.getElementById("rf-sc-count").value) || 1,
      options: s.skillChoice.options.slice()
    } : null;

    const built = {
      id: s.editingId || nextCustomId("races"),
      name,
      features: s.features.filter(f => f.name.trim()),
      skillChoice,
      subraces: s.subraces.length
        ? s.subraces.map(sr => ({ name: sr.name.trim() || "Subrace", features: sr.features.filter(f => f.name.trim()) }))
        : null
    };

    if (s.editingId) {
      const idx = customContent.races.findIndex(r => r.id === s.editingId);
      customContent.races[idx] = built;
    } else {
      customContent.races.push(built);
    }
    persistCustomContent();
    contentScreen = "list";
    redrawContentManager();
    showToast("Saved " + built.name);
  });
}

/* ---------- custom class editor ---------- */

function openClassForm(id) {
  const src = id == null ? null : customContent.classes.find(c => c.id === id);
  classFormState = {
    editingId: id,
    name: src ? src.name : "",
    description: (src && src.description) || "",
    hitDie: (src && src.hitDie) || "d8",
    mainAbility: (src && src.mainAbility) || CREATOR_ABILITY_ORDER[0],
    saves: (src && src.saves || []).slice(),
    armorProf: (src && src.armorProf) || "",
    weaponProf: (src && src.weaponProf) || "",
    skillChoices: {
      count: (src && src.skillChoices && src.skillChoices.count) || 1,
      options: (src && src.skillChoices && src.skillChoices.options ? src.skillChoices.options : []).slice()
    },
    features: JSON.parse(JSON.stringify((src && src.features) || [])),
    subclasses: JSON.parse(JSON.stringify((src && src.subclasses) || []))
  };
  contentScreen = "class-form";
  redrawContentManager();
}

function classFormHtml() {
  const s = classFormState;
  return `
    <div class="modal-heading">${s.editingId ? "Edit" : "New"} Custom Class</div>
    ${textFieldHtml("cf-name", "Name", s.name, { style: "margin-top:10px;" })}
    ${textAreaFieldHtml("cf-desc", "Description", s.description)}
    <div class="field-row">
      ${selectFieldHtml("cf-hitdie", "Hit Die", ["d6", "d8", "d10", "d12"], s.hitDie)}
      ${selectFieldHtml("cf-mainability", "Main Ability", CREATOR_ABILITY_ORDER, s.mainAbility)}
    </div>

    ${fieldLabelHtml("Saving Throw Proficiencies")}
    <div class="chip-row" id="cf-saves" style="margin-bottom:10px;">
      ${CREATOR_ABILITY_ORDER.map(a => `<button type="button" class="toggle-btn ${s.saves.includes(a) ? "active" : ""}" data-cf-save="${a}" style="margin:2px;">${a}</button>`).join("")}
    </div>

    ${textFieldHtml("cf-armor", "Armor Proficiency", s.armorProf, { placeholder: "e.g. Light armor" })}
    ${textFieldHtml("cf-weapon", "Weapon Proficiency", s.weaponProf, { placeholder: "e.g. Simple weapons" })}

    ${numberFieldHtml("cf-sc-count", "Skill Choices", s.skillChoices.count, { min: 0, max: ALL_SKILL_NAMES.length })}
    ${fieldLabelHtml("From")}
    <div class="chip-row" id="cf-sc-options" style="margin-bottom:10px;">
      ${ALL_SKILL_NAMES.map(name => `<button type="button" class="toggle-btn ${s.skillChoices.options.includes(name) ? "active" : ""}" data-cf-skill-option="${esc(name)}" style="margin:2px;">${esc(name)}</button>`).join("")}
    </div>

    <div class="breakdown-subhead">Features</div>
    <div id="cf-features"></div>
    <button type="button" class="add-link" id="cf-add-feature">+ Add Feature</button>

    <div class="breakdown-subhead">Subclasses</div>
    <div id="cf-subclasses"></div>
    <button type="button" class="add-link" id="cf-add-subclass">+ Add Subclass</button>

    <button class="btn-primary" id="cf-save-button" style="margin-top:14px;">Save</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function syncClassSubclasses() {
  const s = classFormState;
  s.subclasses.forEach((sc, i) => {
    const nameEl = document.getElementById("cf-sub-" + i + "-name");
    if (nameEl) sc.name = nameEl.value;
    syncFeatureList("cf-sub-" + i + "-feat", sc.features, true);
  });
}

function renderClassSubclasses() {
  const s = classFormState;
  const container = document.getElementById("cf-subclasses");
  container.innerHTML = s.subclasses.map((sc, i) => `
    <div class="feature-effect-row">
      <div class="subcard-head">
        <span>Subclass ${i + 1}</span>
        <button type="button" class="chip-remove" data-remove-subclass="${i}">✕</button>
      </div>
      ${textFieldHtml("cf-sub-" + i + "-name", "Name", sc.name)}
      <div class="field-hint" style="margin:6px 0 4px;">Features</div>
      <div id="cf-sub-${i}-feat-list"></div>
      <button type="button" class="add-link" data-add-subclass-feature="${i}">+ Add Feature</button>
    </div>
  `).join("") || `<div class="empty-hint">No subclasses.</div>`;

  s.subclasses.forEach((sc, i) => {
    renderFeatureListEditor(document.getElementById("cf-sub-" + i + "-feat-list"), "cf-sub-" + i + "-feat", sc.features, true);
  });

  container.querySelectorAll("[data-remove-subclass]").forEach(btn => {
    btn.addEventListener("click", () => {
      syncClassSubclasses();
      s.subclasses.splice(parseInt(btn.dataset.removeSubclass), 1);
      renderClassSubclasses();
    });
  });
  container.querySelectorAll("[data-add-subclass-feature]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.addSubclassFeature);
      addFeatureRow(document.getElementById("cf-sub-" + i + "-feat-list"), "cf-sub-" + i + "-feat", s.subclasses[i].features, true);
    });
  });
}

function wireClassForm() {
  const s = classFormState;
  wireSelect("cf-hitdie");
  wireSelect("cf-mainability");

  document.querySelectorAll("[data-cf-save]").forEach(btn => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.cfSave;
      const idx = s.saves.indexOf(a);
      if (idx >= 0) s.saves.splice(idx, 1); else s.saves.push(a);
      btn.classList.toggle("active", s.saves.includes(a));
    });
  });
  document.querySelectorAll("[data-cf-skill-option]").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.cfSkillOption;
      const idx = s.skillChoices.options.indexOf(name);
      if (idx >= 0) s.skillChoices.options.splice(idx, 1); else s.skillChoices.options.push(name);
      btn.classList.toggle("active", s.skillChoices.options.includes(name));
    });
  });

  const featContainer = document.getElementById("cf-features");
  renderFeatureListEditor(featContainer, "cf-feat", s.features, true);
  document.getElementById("cf-add-feature").addEventListener("click", () => addFeatureRow(featContainer, "cf-feat", s.features, true));

  renderClassSubclasses();
  document.getElementById("cf-add-subclass").addEventListener("click", () => {
    syncClassSubclasses();
    s.subclasses.push({ name: "", features: [] });
    renderClassSubclasses();
  });

  document.getElementById("content-back-button").addEventListener("click", () => {
    contentScreen = "list"; redrawContentManager();
  });

  document.getElementById("cf-save-button").addEventListener("click", () => {
    const name = document.getElementById("cf-name").value.trim();
    if (!name) { showToast("Enter a name"); return; }

    syncFeatureList("cf-feat", s.features, true);
    syncClassSubclasses();

    const built = {
      id: s.editingId || nextCustomId("classes"),
      name,
      description: document.getElementById("cf-desc").value.trim(),
      hitDie: document.getElementById("cf-hitdie").value,
      mainAbility: document.getElementById("cf-mainability").value,
      saves: s.saves.slice(),
      armorProf: document.getElementById("cf-armor").value.trim(),
      weaponProf: document.getElementById("cf-weapon").value.trim(),
      skillChoices: {
        count: parseInt(document.getElementById("cf-sc-count").value) || 0,
        options: s.skillChoices.options.slice()
      },
      features: s.features.filter(f => f.name.trim()),
      subclasses: s.subclasses.map(sc => ({ name: sc.name.trim() || "Subclass", features: sc.features.filter(f => f.name.trim()) }))
    };

    if (s.editingId) {
      const idx = customContent.classes.findIndex(c => c.id === s.editingId);
      customContent.classes[idx] = built;
    } else {
      customContent.classes.push(built);
    }
    persistCustomContent();
    contentScreen = "list";
    redrawContentManager();
    showToast("Saved " + built.name);
  });
}

/* ---------- custom background editor ---------- */

function openBackgroundForm(id) {
  const src = id == null ? null : customContent.backgrounds.find(b => b.id === id);
  backgroundFormState = {
    editingId: id,
    name: src ? src.name : "",
    desc: (src && src.desc) || "",
    skills: (src && src.skills || []).slice(),
    feature: src && src.feature ? JSON.parse(JSON.stringify(src.feature)) : { name: "", desc: "" }
  };
  contentScreen = "background-form";
  redrawContentManager();
}

function backgroundFormHtml() {
  const s = backgroundFormState;
  return `
    <div class="modal-heading">${s.editingId ? "Edit" : "New"} Custom Background</div>
    ${textFieldHtml("bf-name", "Name", s.name, { style: "margin-top:10px;" })}
    ${textAreaFieldHtml("bf-desc", "Description", s.desc)}
    ${fieldLabelHtml("Skill Proficiencies")}
    <div class="chip-row" id="bf-skills" style="margin-bottom:10px;">
      ${ALL_SKILL_NAMES.map(name => `<button type="button" class="toggle-btn ${s.skills.includes(name) ? "active" : ""}" data-bf-skill="${esc(name)}" style="margin:2px;">${esc(name)}</button>`).join("")}
    </div>
    <div class="breakdown-subhead">Feature</div>
    ${textFieldHtml("bf-feat-name-0", "Feature Name", s.feature.name)}
    ${textAreaFieldHtml("bf-feat-desc-0", "Feature Description", s.feature.desc)}
    ${mechanicChipsHtml("bf-feat", 0, s.feature)}
    <button class="btn-primary" id="bf-save-button" style="margin-top:14px;">Save</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function wireBackgroundForm() {
  const s = backgroundFormState;
  document.querySelectorAll("[data-bf-skill]").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.bfSkill;
      const idx = s.skills.indexOf(name);
      if (idx >= 0) s.skills.splice(idx, 1); else s.skills.push(name);
      btn.classList.toggle("active", s.skills.includes(name));
    });
  });

  // the background's one feature reuses the same extras blocks a race/class
  // feature row gets -- syncFeatureList works on any array, so wrapping the
  // single feature in a one-element array borrows it rather than duplicating it
  if (s.feature.effects) renderFeatureEffectsList(document.getElementById("bf-feat-fxwrap-0"), s.feature.effects, EFFECT_CATEGORIES_FEATURE, "bf-feat-fx-0");
  if (s.feature.choice) {
    wireSelect("bf-feat-choice-0-kind");
    document.getElementById("bf-feat-choice-0-kind").addEventListener("change", () => {
      resyncFeature();
      if (s.feature.choice.kind === "custom" && !s.feature.choice.options) s.feature.choice.options = [];
      redrawContentManager();
    });
    wireChoiceOptionsEditor("bf-feat", 0, s.feature);
  }
  if (s.feature.resource) {
    wireRechargeField("bf-feat-res-0");
    wireScalingValueFields("bf-feat-res-0-max", { get: () => s.feature.resource.max, set: v => { s.feature.resource.max = v; } });
  }

  function resyncFeature() { syncFeatureList("bf-feat", [s.feature], false); }
  wireMechanicChips("bf-feat", 0, s.feature, resyncFeature, redrawContentManager);

  document.getElementById("content-back-button").addEventListener("click", () => {
    contentScreen = "list"; redrawContentManager();
  });

  document.getElementById("bf-save-button").addEventListener("click", () => {
    const name = document.getElementById("bf-name").value.trim();
    if (!name) { showToast("Enter a name"); return; }

    resyncFeature();
    const built = {
      id: s.editingId || nextCustomId("backgrounds"),
      name,
      desc: document.getElementById("bf-desc").value.trim(),
      skills: s.skills.slice(),
      feature: Object.assign({
        name: document.getElementById("bf-feat-name-0").value.trim() || "Feature",
        desc: document.getElementById("bf-feat-desc-0").value.trim()
      }, s.feature.effects ? { effects: s.feature.effects } : {},
         s.feature.choice ? { choice: s.feature.choice } : {},
         s.feature.resource ? { resource: s.feature.resource } : {})
    };

    if (s.editingId) {
      const idx = customContent.backgrounds.findIndex(b => b.id === s.editingId);
      customContent.backgrounds[idx] = built;
    } else {
      customContent.backgrounds.push(built);
    }
    persistCustomContent();
    contentScreen = "list";
    redrawContentManager();
    showToast("Saved " + built.name);
  });
}

/* ---------- custom subclass editor (for any existing class) ----------

   Every other custom race/class/background starts life as a duplicate of an
   SRD entry -- there's no "from scratch" path for those. A subclass is the
   exception: it doesn't need its own name/hit-die/proficiencies, only which
   class it belongs to, so there's nothing to duplicate and this form starts
   blank. `.forClass` is the only link back to that class, matched by name in
   subclassesForClass() (rests.js) -- an SRD class name or a Custom Content
   class's own name both work, since that's the same lookup featuresAtLevel
   already does. */

function allKnownClassNames() {
  return SRD_CLASSES.map(c => c.name).concat(customContent.classes.map(c => c.name));
}

function openSubclassForm(id) {
  if (id == null) {
    subclassFormState = { editingId: null, forClass: allKnownClassNames()[0] || "", name: "", features: [] };
  } else {
    const src = customContent.subclasses.find(sc => sc.id === id);
    subclassFormState = {
      editingId: id,
      forClass: src.forClass,
      name: src.name,
      features: JSON.parse(JSON.stringify(src.features || []))
    };
  }
  contentScreen = "subclass-form";
  redrawContentManager();
}

function subclassFormHtml() {
  const s = subclassFormState;
  const classNames = allKnownClassNames();
  return `
    <div class="modal-heading">${s.editingId ? "Edit" : "New"} Custom Subclass</div>
    <div style="margin-top:10px;">
      ${classNames.length ? selectFieldHtml("scf-forclass", "For Class", classNames, s.forClass)
        : `<div class="empty-hint">No classes to attach a subclass to yet.</div>`}
    </div>
    ${textFieldHtml("scf-name", "Subclass Name", s.name, { placeholder: "e.g. Way of the Open Hand" })}
    <div class="breakdown-subhead">Features</div>
    <div id="scf-features"></div>
    <button type="button" class="add-link" id="scf-add-feature">+ Add Feature</button>
    <button class="btn-primary" id="scf-save-button" style="margin-top:14px;">Save</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function wireSubclassForm() {
  const s = subclassFormState;
  const classNames = allKnownClassNames();
  if (classNames.length) wireSelect("scf-forclass");

  const featContainer = document.getElementById("scf-features");
  renderFeatureListEditor(featContainer, "scf-feat", s.features, true);
  document.getElementById("scf-add-feature").addEventListener("click", () => addFeatureRow(featContainer, "scf-feat", s.features, true));

  document.getElementById("content-back-button").addEventListener("click", () => {
    contentScreen = "list"; redrawContentManager();
  });

  document.getElementById("scf-save-button").addEventListener("click", () => {
    const name = document.getElementById("scf-name").value.trim();
    if (!name) { showToast("Enter a name"); return; }
    if (!classNames.length) { showToast("No class to attach this to"); return; }

    syncFeatureList("scf-feat", s.features, true);
    const built = {
      id: s.editingId || nextCustomId("subclasses"),
      forClass: document.getElementById("scf-forclass").value,
      name,
      features: s.features.filter(f => f.name.trim())
    };

    if (s.editingId) {
      const idx = customContent.subclasses.findIndex(sc => sc.id === s.editingId);
      customContent.subclasses[idx] = built;
    } else {
      customContent.subclasses.push(built);
    }
    persistCustomContent();
    contentScreen = "list";
    redrawContentManager();
    showToast("Saved " + built.name);
  });
}

/* ---------- custom feature editor (standalone) ----------

   character.traits.Feats starts empty for every build the creator produces
   (creator.js) -- this app has never modeled feats as real SRD content,
   only as a bucket a player could fill in by hand. A standalone Feature is
   the Custom Content side of that same bucket: not tied to a race, class,
   subclass or background, just a name, a description and the same
   effect/choice/resource mechanics every other feature can carry.
   featureFormState IS the feature (unlike the background form, which nests
   one inside a wrapper) -- there's nothing else on this screen to wrap it in. */

function openFeatureForm(id) {
  if (id == null) {
    featureFormState = { editingId: null, name: "", desc: "", prereq: "" };
  } else {
    const src = customContent.features.find(f => f.id === id);
    featureFormState = Object.assign({ editingId: id }, JSON.parse(JSON.stringify(src)));
  }
  contentScreen = "feature-form";
  redrawContentManager();
}

function featureFormHtml() {
  const s = featureFormState;
  return `
    <div class="modal-heading">${s.editingId ? "Edit" : "New"} Custom Feature</div>
    ${textFieldHtml("ff-feat-name-0", "Name", s.name, { style: "margin-top:10px;", placeholder: "e.g. Tough" })}
    ${textFieldHtml("ff-feat-prereq-0", "Prerequisite (optional)", s.prereq, { placeholder: "e.g. Strength 13 or higher" })}
    ${textAreaFieldHtml("ff-feat-desc-0", "Description", s.desc)}
    ${mechanicChipsHtml("ff-feat", 0, s)}
    <button class="btn-primary" id="ff-save-button" style="margin-top:14px;">Save</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function wireFeatureForm() {
  const s = featureFormState;

  if (s.effects) renderFeatureEffectsList(document.getElementById("ff-feat-fxwrap-0"), s.effects, EFFECT_CATEGORIES_FEATURE, "ff-feat-fx-0");
  if (s.choice) {
    wireSelect("ff-feat-choice-0-kind");
    document.getElementById("ff-feat-choice-0-kind").addEventListener("change", () => {
      resyncFeature();
      if (s.choice.kind === "custom" && !s.choice.options) s.choice.options = [];
      redrawContentManager();
    });
    wireChoiceOptionsEditor("ff-feat", 0, s);
  }
  if (s.resource) {
    wireRechargeField("ff-feat-res-0");
    wireScalingValueFields("ff-feat-res-0-max", { get: () => s.resource.max, set: v => { s.resource.max = v; } });
  }

  function resyncFeature() { syncFeatureList("ff-feat", [s], false); }
  wireMechanicChips("ff-feat", 0, s, resyncFeature, redrawContentManager);

  document.getElementById("content-back-button").addEventListener("click", () => {
    contentScreen = "list"; redrawContentManager();
  });

  document.getElementById("ff-save-button").addEventListener("click", () => {
    const name = document.getElementById("ff-feat-name-0").value.trim();
    if (!name) { showToast("Enter a name"); return; }

    resyncFeature();
    const prereq = document.getElementById("ff-feat-prereq-0").value.trim();
    const built = Object.assign({
      id: s.editingId || nextCustomId("features"),
      name,
      desc: document.getElementById("ff-feat-desc-0").value.trim()
    }, prereq ? { prereq } : {},
       s.effects ? { effects: s.effects } : {},
       s.choice ? { choice: s.choice } : {},
       s.resource ? { resource: s.resource } : {});

    if (s.editingId) {
      const idx = customContent.features.findIndex(f => f.id === s.editingId);
      customContent.features[idx] = built;
    } else {
      customContent.features.push(built);
    }
    persistCustomContent();
    contentScreen = "list";
    redrawContentManager();
    showToast("Saved " + built.name);
  });
}
