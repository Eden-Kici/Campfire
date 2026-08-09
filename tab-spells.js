/* ============================================================
   SPELLS TAB
   ============================================================ */

let spellFilter = "all";
let openSpellLevels = {};

function levelLabel(lvl) {
  if (lvl === 0) return "Cantrips";
  if (lvl === 1) return "1st Level";
  if (lvl === 2) return "2nd Level";
  if (lvl === 3) return "3rd Level";
  return lvl + "th Level";
}

function renderSpellRow(spell) {
  const showClassTag = character.spellcasting.classes.length > 1;
  return `
    <div class="atk-row" data-spell-view="${spell.id}">
      ${spell.level > 0 ? `<div class="prof-dot ${spell.prepared ? "prof" : ""}" data-spell-prep="${spell.id}"></div>` : ""}
      <div style="flex:1;">
        <div class="atk-name">${esc(spell.name)}</div>
        ${showClassTag ? `<div class="atk-range">${esc(spell.classSource)}</div>` : ""}
      </div>
      <div class="spell-tag">${esc(spell.castingTime)}</div>
      ${spell.level > 0 ? `<button class="atk-pill" data-spell-cast="${spell.id}">Cast</button>` : ""}
    </div>
  `;
}

function renderSpellsTab() {
  const classes = character.spellcasting.classes;

  const statSquaresHtml = classes.map(cls => {
    const atk = calculateSpellAttack(character, cls.ability);
    const dc = calculateSpellDC(character, cls.ability);
    return `
      ${classes.length > 1 ? `<div style="text-align:center;font-weight:bold;font-size:13px;color:var(--accent-soft);margin-top:14px;">${esc(cls.name)}</div>` : ""}
      <div class="stat-grid" style="${classes.length > 1 ? "margin-top:6px;" : ""}">
        <div class="stat-box"><div class="stat-label">Ability</div><div class="stat-value">${cls.ability}</div></div>
        <div class="stat-box" data-spell-atk="${esc(cls.name)}"><div class="stat-label">Spell Attack</div><div class="stat-value">${formatModifier(atk.total)}</div></div>
        <div class="stat-box" data-spell-dc="${esc(cls.name)}"><div class="stat-label">Spell DC</div><div class="stat-value">${dc.total}</div></div>
      </div>
    `;
  }).join("");

  const prepared = calculatePreparedSpellCount(character);
  const visibleSpells = character.spells.filter(s => spellFilter === "all" || s.level === 0 || s.prepared);
  const levels = [0].concat(Object.keys(character.spellSlots).map(n => parseInt(n)).sort((a, b) => a - b));

  const levelsHtml = levels.map(lvl => {
    const spellsInLevel = visibleSpells.filter(s => s.level === lvl);
    const isOpen = openSpellLevels[lvl] !== false;
    const slot = character.spellSlots[lvl];
    return `
      <div class="section-head-row" data-spelllevel-toggle="${lvl}" style="cursor:pointer;margin-top:16px;">
        <div class="section-head" style="font-size:14px;margin:0;">${esc(levelLabel(lvl))}</div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${slot ? `<button class="mini-edit" data-edit-slots="${lvl}">\u270E</button><span style="color:var(--text-dim);font-size:12px;">${slot.current}/${slot.max} slots</span>` : ""}
          <span style="color:var(--text-dim);font-size:12px;">${isOpen ? "\u2212" : "+"}</span>
        </div>
      </div>
      ${isOpen ? (spellsInLevel.map(s => renderSpellRow(s)).join("") || `<div class="empty-hint">Nothing here</div>`) : ""}
    `;
  }).join("");

  return `
    ${statSquaresHtml}

    <div class="section-head-row" style="margin-top:20px;">
      <div class="section-head">Spells</div>
      <button class="add-link" id="add-spell-button">+ Add</button>
    </div>

    <div class="btn-row-2" style="margin-bottom:8px;">
      <button class="toggle-btn ${spellFilter === "all" ? "active" : ""}" data-spell-filter="all" style="flex:1;padding:10px 0;">All</button>
      <button class="toggle-btn ${spellFilter === "prepared" ? "active" : ""}" data-spell-filter="prepared" style="flex:1;padding:10px 0;">Prepared</button>
    </div>
    <div style="font-size:12px;color:var(--text-dim);">${prepared.count} / ${prepared.max} prepared</div>

    ${levelsHtml}
  `;
}

// casting is never blocked -- homebrew and table rulings can put a character
// outside the normal slot economy, so we warn and let the count go negative
// rather than refusing the cast.
function castSpell(spellId) {
  const spell = character.spells.find(s => s.id == spellId);
  const slot = character.spellSlots[spell.level];
  if (slot) {
    if (slot.current <= 0) showToast("No " + levelLabel(spell.level).replace(" Level", "") + "-level slots left");
    slot.current--;
  } else if (spell.level > 0) {
    showToast("No " + levelLabel(spell.level).replace(" Level", "") + "-level slots on this sheet");
  }
  if (spell.attackRoll) {
    const cls = character.spellcasting.classes.find(c => c.name === spell.classSource);
    const atk = calculateSpellAttack(character, cls.ability);
    showRoll({ label: spell.name, notation: "1d20" + formatModifier(atk.total),
               sources: atk.sources, kind: "attack" });
  }
  renderContent();
}

function wireSpellsTab() {
  character.spellcasting.classes.forEach(cls => {
    const atkBox = document.querySelector(`[data-spell-atk="${esc(cls.name)}"]`);
    if (atkBox) atkBox.addEventListener("click", () => {
      const atk = calculateSpellAttack(character, cls.ability);
      openBreakdownModal(cls.name + " Spell Attack", formatModifier(atk.total), "", atk.sources,
        { label: cls.name + " Spell Attack", notation: "1d20" + formatModifier(atk.total), kind: "attack" });
    });
    const dcBox = document.querySelector(`[data-spell-dc="${esc(cls.name)}"]`);
    if (dcBox) dcBox.addEventListener("click", () => {
      const dc = calculateSpellDC(character, cls.ability);
      openBreakdownModal(cls.name + " Spell DC", dc.total, "", dc.sources);
    });
  });

  document.querySelectorAll("[data-spell-filter]").forEach(btn => {
    btn.addEventListener("click", () => { spellFilter = btn.dataset.spellFilter; renderContent(); });
  });

  document.querySelectorAll("[data-spelllevel-toggle]").forEach(head => {
    head.addEventListener("click", (e) => {
      if (e.target.closest("[data-edit-slots]")) return;
      const lvl = head.dataset.spelllevelToggle;
      openSpellLevels[lvl] = !(openSpellLevels[lvl] !== false);
      renderContent();
    });
  });
  document.querySelectorAll("[data-edit-slots]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); openEditSlotsModal(parseInt(btn.dataset.editSlots)); });
  });

  document.querySelectorAll("[data-spell-prep]").forEach(dot => {
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      const spell = character.spells.find(s => s.id == dot.dataset.spellPrep);
      spell.prepared = !spell.prepared;
      renderContent();
    });
  });

  document.querySelectorAll("[data-spell-cast]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); castSpell(btn.dataset.spellCast); });
  });

  document.querySelectorAll("[data-spell-view]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-spell-prep]") || e.target.closest("[data-spell-cast]")) return;
      const spell = character.spells.find(s => s.id == row.dataset.spellView);
      if (spell.level === 0 && spell.attackRoll) {
        const cls = character.spellcasting.classes.find(c => c.name === spell.classSource);
        const atk = calculateSpellAttack(character, cls.ability);
        showRoll({ label: spell.name, notation: "1d20" + formatModifier(atk.total),
                   sources: atk.sources, kind: "attack" });
      } else {
        openSpellDetailModal(spell.id);
      }
    });
  });

  const addSpellButton = document.getElementById("add-spell-button");
  if (addSpellButton) addSpellButton.addEventListener("click", openAddSpellModal);
}

function openEditSlotsModal(level) {
  const slot = character.spellSlots[level];
  openModal("center", `
    <div class="breakdown-title">${levelLabel(level)} Slots</div>
    <div class="field-row">
      <div class="field"><label>Current</label><input id="edit-slot-current" type="number" value="${slot.current}"></div>
      <div class="field"><label>Max</label><input id="edit-slot-max" type="number" value="${slot.max}"></div>
    </div>
    <button class="btn-primary" id="save-slot-button">Save</button>
  `);
  document.getElementById("save-slot-button").addEventListener("click", () => {
    slot.current = parseInt(document.getElementById("edit-slot-current").value) || 0;
    slot.max = parseInt(document.getElementById("edit-slot-max").value) || 0;
    closeModal();
    renderContent();
  });
}

function spellFormFieldsHtml(spell) {
  const classOptions = character.spellcasting.classes.map(c => c.name);
  return `
    <div class="field"><label>Name</label><input id="spell-form-name" value="${esc(spell ? spell.name : "")}" placeholder="e.g. Fireball"></div>
    <div class="field-row">
      ${selectFieldHtml("spell-form-level", "Level",
        [{ value: "0", label: "Cantrip" }].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => ({ value: String(l), label: levelLabel(l) }))),
        String(spell ? spell.level : 0))}
      ${selectFieldHtml("spell-form-class", "Class", classOptions, spell ? spell.classSource : undefined)}
    </div>
    ${selectFieldHtml("spell-form-time", "Casting Time", [
      { value: "A", label: "Action" }, { value: "B", label: "Bonus Action" }, { value: "R", label: "Reaction" }
    ], spell ? spell.castingTime : "A")}
    <div class="toggle-line"><span>Requires spell attack roll</span><div class="switch ${spell && spell.attackRoll ? "on" : ""}" id="spell-form-attack-switch"><div class="knob"></div></div></div>
    <div class="field"><label>Description</label><input id="spell-form-desc" value="${esc(spell ? (spell.desc || "") : "")}" placeholder="Optional"></div>
  `;
}

function readSpellForm() {
  return {
    name: document.getElementById("spell-form-name").value.trim() || "New Spell",
    level: parseInt(document.getElementById("spell-form-level").value),
    classSource: document.getElementById("spell-form-class").value,
    castingTime: document.getElementById("spell-form-time").value,
    desc: document.getElementById("spell-form-desc").value.trim()
  };
}

function openAddSpellModal() {
  let attackOn = false;
  openModal("full", `
    <div class="modal-heading">Add Spell</div>
    ${spellFormFieldsHtml(null)}
    <button class="btn-primary" id="save-spell-button" style="margin-top:6px;">Add Spell</button>
  `);
  wireSelect("spell-form-level"); wireSelect("spell-form-class"); wireSelect("spell-form-time");
  document.getElementById("spell-form-attack-switch").addEventListener("click", (e) => { attackOn = !attackOn; e.currentTarget.classList.toggle("on", attackOn); });
  document.getElementById("save-spell-button").addEventListener("click", () => {
    const formData = readSpellForm();
    const newId = Math.max(0, ...character.spells.map(s => s.id)) + 1;
    const spell = Object.assign({ id: newId, attackRoll: attackOn }, formData);
    if (spell.level > 0) spell.prepared = false;
    character.spells.push(spell);
    closeModal();
    renderContent();
  });
}

function openSpellDetailModal(spellId) {
  const spell = character.spells.find(s => s.id == spellId);
  let attackOn = spell.attackRoll || false;
  openModal("full", `
    <div class="modal-heading">Edit Spell</div>
    ${spellFormFieldsHtml(spell)}
    <div class="btn-row-2" style="margin-top:6px;">
      <button class="btn-primary" id="save-spell-edit-button">Save Changes</button>
      <button class="btn-primary" id="remove-spell-button" style="background:var(--danger-surface);color:var(--danger-text);">Remove</button>
    </div>
  `);
  wireSelect("spell-form-level"); wireSelect("spell-form-class"); wireSelect("spell-form-time");
  document.getElementById("spell-form-attack-switch").addEventListener("click", (e) => { attackOn = !attackOn; e.currentTarget.classList.toggle("on", attackOn); });
  document.getElementById("save-spell-edit-button").addEventListener("click", () => {
    const formData = readSpellForm();
    Object.assign(spell, formData);
    spell.attackRoll = attackOn;
    if (spell.level === 0) delete spell.prepared;
    else if (spell.prepared === undefined) spell.prepared = false;
    closeModal();
    renderContent();
  });
  document.getElementById("remove-spell-button").addEventListener("click", () => {
    character.spells = character.spells.filter(s => s.id != spellId);
    closeModal();
    renderContent();
  });
}
