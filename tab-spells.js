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

// SRD_SPELLS' castingTime is free text straight from the SRD ("1 action",
// "1 bonus action", "1 reaction, which you take when..."); a character's
// own spells only track three buckets (the Casting Time select below).
// Longer casting times (1 minute, 10 minutes, 1 hour, and up) have no
// bucket of their own yet, so they fall back to Action -- the same
// simplification the rest of this app's spell model already makes rather
// than growing a fourth option nothing else here knows how to use.
function spellCastingTimeCode(text) {
  if (/bonus action/i.test(text)) return "B";
  if (/reaction/i.test(text)) return "R";
  return "A";
}

// the row shows the one-letter code as a quiet tag; the detail window has the
// room to say it in full. Anything not one of the three buckets (an imported
// spell, a hand-typed one) is shown as-is rather than silently relabelled.
function castingTimeLabel(code) {
  if (code === "A") return "Action";
  if (code === "B") return "Bonus Action";
  if (code === "R") return "Reaction";
  return code || "";
}

// heuristic, not data -- SRD_SPELLS is description-only (see its own header
// comment) and carries no structured attack-roll flag, so this reads the
// spell's own text the same way a player would, to decide whether "Requires
// spell attack roll" should start checked when a known spell is picked or
// granted. Good enough for the common "ranged spell attack"/"melee spell
// attack" phrasing every attack cantrip and spell in the SRD actually uses.
function spellLikelyAttackRoll(desc) {
  return /spell attack/i.test(desc);
}

/* Damage is authored, not derived: SRD_SPELLS is prose (see its own header)
   and carries no structured damage, so a spell's `damage` is a notation the
   player owns, exactly like a weapon's. This reads the description the way a
   player would -- the first dice expression the text calls damage -- purely
   to PRE-FILL that field, where a wrong reading is a typo the player corrects
   before saving. It is never consulted at render or roll time; a guess on the
   sheet would be a number the player never agreed to. */
function suggestedSpellDamage(desc) {
  const match = (desc || "").match(/(\d*d\d+(?:\s*[+-]\s*\d+)?)(?=[^.]{0,40}?damage)/i);
  return match ? match[1].replace(/\s+/g, "") : "";
}

/* The to-hit bonus belongs to the spell's own casting class, so a spell
   naming a class this character doesn't cast has no number to show. Returning
   null rather than calculating against an undefined ability keeps NaN off the
   sheet; the pill still renders, and tapping it explains (rollSpellAttack). */
function spellAttackBonus(spell) {
  const caster = character.spellcasting.classes.find(c => c.name === spell.classSource);
  return caster ? calculateSpellAttack(character, caster.ability) : null;
}

function spellSaveDC(spell) {
  const caster = character.spellcasting.classes.find(c => c.name === spell.classSource);
  return caster ? calculateSpellDC(character, caster.ability) : null;
}

/* Pinning is stored on the spell itself rather than in a second list, so it
   rides along in the existing save/export and can never point at a spell that
   was deleted. */
function pinnedSpells(character) {
  return character.spells.filter(s => s.pinned);
}

/* One row shape, shared by the Spells tab and the Combat tab's pinned list, so
   a pinned Fire Bolt reads exactly like the weapon rows above it: filled pills
   are rolls, and a spell that attacks gets the same to-hit/damage pair a
   weapon does. Cast is the extra one -- it's what spends the slot. */
function renderSpellRow(spell) {
  const showClassTag = character.spellcasting.classes.length > 1;
  const atk = spell.attackRoll ? spellAttackBonus(spell) : null;
  return `
    <div class="atk-row" data-spell-view="${spell.id}">
      ${spell.level > 0 ? `<div class="prof-dot ${spell.prepared ? "prof" : ""}" data-spell-prep="${spell.id}"></div>` : ""}
      <div style="flex:1;min-width:0;">
        <div class="atk-name">${esc(spell.name)}<span class="res-tag">${esc(spell.castingTime)}</span></div>
        ${showClassTag ? `<div class="atk-range">${esc(spell.classSource)}</div>` : ""}
      </div>
      ${spell.level > 0 ? `<button class="atk-pill" data-spell-cast="${spell.id}">Cast</button>` : ""}
      ${spell.attackRoll ? `<button class="atk-pill" data-spell-roll="${spell.id}">${atk ? formatModifier(atk.total) : "Attack"}</button>` : ""}
      ${spell.damage ? `<button class="atk-pill" data-spell-damage="${spell.id}">${esc(spell.damage)}</button>` : ""}
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
  // levels come from the slots AND from the spells themselves: a spell can
  // outrun its slots (added before levelling, imported, or granted by an
  // item), and a level that renders no header renders no row, which makes
  // the spell impossible to edit or delete
  const levels = [...new Set(
    [0]
      .concat(Object.keys(character.spellSlots).map(n => parseInt(n)))
      .concat(character.spells.map(s => s.level))
  )].filter(n => !isNaN(n)).sort((a, b) => a - b);

  const levelsHtml = levels.map(lvl => {
    const spellsInLevel = visibleSpells.filter(s => s.level === lvl);
    const isOpen = openSpellLevels[lvl] !== false;
    const slot = character.spellSlots[lvl];
    return `
      <div class="section-head-row" data-spelllevel-toggle="${lvl}" style="cursor:pointer;margin-top:16px;">
        <div class="section-head" style="font-size:14px;margin:0;">${esc(levelLabel(lvl))}</div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${slot
            ? `<button class="mini-edit" data-edit-slots="${lvl}">\u270E</button><span style="color:var(--text-dim);font-size:12px;">${slot.current}/${slot.max} slots</span>`
            : (lvl > 0 ? `<span style="color:var(--text-dim);font-size:12px;">no slots</span>` : "")}
        </div>
      </div>
      ${isOpen ? (spellsInLevel.map(s => renderSpellRow(s)).join("") || `<div class="empty-hint">Nothing here</div>`) : ""}
    `;
  }).join("");

  /* A non-caster arriving here used to see a filter, "0 / 0 prepared" and an
     empty Cantrips heading, which reads as a screen that failed to load rather
     than one that doesn't apply. Nothing about a Barbarian says "you don't
     cast" anywhere else, so it has to be said here. */
  const nonCaster = !classes.length && !character.spells.length;
  if (nonCaster) {
    return `
      <div class="empty-hint" style="padding:70px 20px;">
        ${esc(character.name)} doesn't cast spells.<br><br>
        Nothing in ${esc(classLineFor(character))} grants spellcasting. If a feat,
        item or multiclass changes that, add a spell here and this tab fills in.
      </div>
      <div class="section-head-row" style="margin-top:20px;">
        <div class="section-head">Spells</div>
        <button class="add-link" id="add-spell-button">+ Add</button>
      </div>`;
  }

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
  if (!spell) return;

  // resolve everything that can fail BEFORE spending anything -- this used to
  // decrement first and then throw on `cls.ability`, so the slot was gone,
  // the re-render never ran, and the screen still showed the old count
  const caster = spell.attackRoll
    ? character.spellcasting.classes.find(c => c.name === spell.classSource)
    : null;
  if (spell.attackRoll && !caster) {
    showToast(spell.name + " is set to roll to hit for " + (spell.classSource || "no class") + ", which isn't one of your casting classes");
    return;
  }

  const slot = character.spellSlots[spell.level];
  if (slot) {
    if (slot.current <= 0) showToast("No " + levelLabel(spell.level).replace(" Level", "") + "-level slots left");
    slot.current--;
  } else if (spell.level > 0) {
    showToast("No " + levelLabel(spell.level).replace(" Level", "") + "-level slots on this sheet");
  }
  if (caster) rollSpellAttack(spell);
  renderContent();
}

/* Shared by Cast and by a cantrip's Roll pill. Returns false when the spell
   names a class this character doesn't cast, so no caller rolls on undefined. */
function rollSpellAttack(spell) {
  const caster = character.spellcasting.classes.find(c => c.name === spell.classSource);
  if (!caster) {
    showToast(spell.name + " is set to roll to hit for " + (spell.classSource || "no class") + ", which isn't one of your casting classes");
    return false;
  }
  const atk = calculateSpellAttack(character, caster.ability);
  showRoll({ label: spell.name, notation: "1d20" + formatModifier(atk.total),
             sources: atk.sources, kind: "attack" });
  return true;
}

/* The whole notation is the player's, so there is no breakdown to show -- the
   same as a weapon damage part with no ability modifier on it. kind "damage"
   is what gives the roll window its half/max readouts. */
function rollSpellDamage(spell) {
  showRoll({ label: spell.name + " Damage", notation: spell.damage, sources: [], kind: "damage" });
}

function wireSpellsTab() {
  character.spellcasting.classes.forEach(cls => {
    const atkBox = [...document.querySelectorAll("[data-spell-atk]")].find(el => el.dataset.spellAtk === cls.name);
    if (atkBox) atkBox.addEventListener("click", () => {
      const atk = calculateSpellAttack(character, cls.ability);
      openBreakdownModal(cls.name + " Spell Attack", formatModifier(atk.total), "", atk.sources,
        { label: cls.name + " Spell Attack", notation: "1d20" + formatModifier(atk.total), kind: "attack" });
    });
    const dcBox = [...document.querySelectorAll("[data-spell-dc]")].find(el => el.dataset.spellDc === cls.name);
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

  wireSpellRows(document.getElementById("content"));

  const addSpellButton = document.getElementById("add-spell-button");
  if (addSpellButton) addSpellButton.addEventListener("click", openAddSpellModal);
}

/* Spell rows are rendered on two tabs now, so their listeners are attached
   from one place. `root` is always the tab container, never the document -- a
   document-wide query here would reach into whatever modal happens to be open
   and wire its controls a second time (see the note above wireCombatTab). */
function wireSpellRows(root) {
  root.querySelectorAll("[data-spell-prep]").forEach(dot => {
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      const spell = character.spells.find(s => s.id == dot.dataset.spellPrep);
      spell.prepared = !spell.prepared;
      renderContent();
    });
  });

  root.querySelectorAll("[data-spell-cast]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); castSpell(btn.dataset.spellCast); });
  });

  root.querySelectorAll("[data-spell-roll]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      rollSpellAttack(character.spells.find(s => s.id == btn.dataset.spellRoll));
    });
  });

  root.querySelectorAll("[data-spell-damage]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      rollSpellDamage(character.spells.find(s => s.id == btn.dataset.spellDamage));
    });
  });

  root.querySelectorAll("[data-spell-view]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-spell-prep]") || e.target.closest("[data-spell-cast]")
          || e.target.closest("[data-spell-roll]") || e.target.closest("[data-spell-damage]")) return;
      // the row opens the spell's own window; rolling is the pills' job, so an
      // attack cantrip is still reachable for editing and deleting
      openSpellDetailModal(row.dataset.spellView);
    });
  });
}

function openEditSlotsModal(level) {
  const slot = character.spellSlots[level];
  openModal("center", `
    <div class="breakdown-title">${levelLabel(level)} Slots</div>
    <div class="field-row">
      ${numberFieldHtml("edit-slot-current", "Current", slot.current)}
      ${numberFieldHtml("edit-slot-max", "Max", slot.max)}
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

// pickFromSrd swaps the Name field for a comboFieldHtml searching every
// SRD_SPELLS name -- only on the Add flow (openAddSpellModal), not Edit,
// since editing is about a spell already on the sheet, not picking a new
// one from the reference list. Typing something not in the list is still a
// complete, valid spell either way, same "pick or type your own" rule Add
// Language already uses.
function spellFormFieldsHtml(spell, pickFromSrd) {
  const classOptions = character.spellcasting.classes.map(c => c.name);
  // a spell already carrying a damage notation keeps it; one that never had
  // one gets the description read to it as a starting point, said out loud in
  // the field hint so nothing is stored the player didn't look at
  const suggested = spell && !spell.damage ? suggestedSpellDamage(spell.desc) : "";
  const damageValue = spell ? (spell.damage || suggested) : "";
  return `
    ${pickFromSrd
      ? comboFieldHtml("spell-form-name", "Name", "Search the SRD or type your own", "")
      : textFieldHtml("spell-form-name", "Name", spell ? spell.name : "", { placeholder: "e.g. Fireball" })}
    <div class="field-row">
      ${selectFieldHtml("spell-form-level", "Level",
        [{ value: "0", label: "Cantrip" }].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => ({ value: String(l), label: levelLabel(l) }))),
        String(spell ? spell.level : 0))}
      ${selectFieldHtml("spell-form-class", "Class", classOptions, spell ? spell.classSource : undefined)}
    </div>
    ${selectFieldHtml("spell-form-time", "Casting Time", [
      { value: "A", label: "Action" }, { value: "B", label: "Bonus Action" }, { value: "R", label: "Reaction" }
    ], spell ? spell.castingTime : "A")}
    ${toggleLineHtml("spell-form-attack-switch", "Requires spell attack roll", spell && spell.attackRoll)}
    ${textFieldHtml("spell-form-damage", "Damage", damageValue, {
      placeholder: "e.g. 8d6",
      hint: suggested
        ? "Read out of the description \u2014 check it before saving. Blank means no damage pill."
        : "Dice this spell deals, rolled as written. Leave blank for a spell that deals none."
    })}
    ${textAreaFieldHtml("spell-form-desc", "Description", spell ? spell.desc : "", { placeholder: "Optional", large: true })}
  `;
}

function readSpellForm() {
  return {
    name: document.getElementById("spell-form-name").value.trim() || "New Spell",
    level: parseInt(document.getElementById("spell-form-level").value),
    classSource: document.getElementById("spell-form-class").value,
    castingTime: document.getElementById("spell-form-time").value,
    damage: document.getElementById("spell-form-damage").value.trim(),
    desc: document.getElementById("spell-form-desc").value.trim()
  };
}

function openAddSpellModal() {
  let attackOn = false;
  openModal("full", `
    <div class="modal-heading">Add Spell</div>
    ${spellFormFieldsHtml(null, true)}
    <button class="btn-primary" id="save-spell-button" style="margin-top:6px;">Add Spell</button>
  `);
  guardModalEdits();
  wireSelect("spell-form-level"); wireSelect("spell-form-class"); wireSelect("spell-form-time");
  document.getElementById("spell-form-attack-switch").addEventListener("click", (e) => { attackOn = !attackOn; e.currentTarget.classList.toggle("on", attackOn); });

  // picking a real SRD spell prefills everything else on the form: level,
  // casting time (best-effort -- see spellCastingTimeCode's own comment),
  // class (only when the character actually has that class as a caster;
  // otherwise left for the player to pick, since offering a class they
  // don't have would be worse than offering none), the attack-roll toggle
  // (see spellLikelyAttackRoll), and the full description.
  wireCombo("spell-form-name", SRD_SPELLS.map(s => s.name), (value) => {
    const known = SRD_SPELLS.find(s => s.name === value);
    if (!known) return;
    setSelectValue("spell-form-level", String(known.level));
    setSelectValue("spell-form-time", spellCastingTimeCode(known.castingTime));
    const classOptions = character.spellcasting.classes.map(c => c.name);
    const matchedClass = known.classes.find(c => classOptions.includes(c));
    if (matchedClass) setSelectValue("spell-form-class", matchedClass);
    attackOn = spellLikelyAttackRoll(known.desc);
    document.getElementById("spell-form-attack-switch").classList.toggle("on", attackOn);
    document.getElementById("spell-form-damage").value = suggestedSpellDamage(known.desc);
    document.getElementById("spell-form-desc").value = known.desc;
  });

  document.getElementById("save-spell-button").addEventListener("click", () => {
    const formData = readSpellForm();
    const newId = makeId(character.spells);
    const spell = Object.assign({ id: newId, attackRoll: attackOn }, formData);
    if (!spell.damage) delete spell.damage;
    if (spell.level > 0) spell.prepared = false;
    character.spells.push(spell);
    closeModal();
    renderContent();
  });
}

/* The full-info window for a spell -- the sibling of openAttackDetailModal.
   Tapping a row used to land straight in the form, which is the one screen
   that can't answer "what does this spell do again?". Editing is a route out
   of here, exactly as it is for a weapon, and delete stays inside the form
   with the rest of the destructive work. */
function openSpellDetailModal(spellId) {
  const spell = character.spells.find(s => s.id == spellId);
  if (!spell) return;
  const atk = spell.attackRoll ? spellAttackBonus(spell) : null;
  const dc = spellSaveDC(spell);
  const meta = [
    spell.level === 0 ? "Cantrip" : levelLabel(spell.level),
    spell.classSource,
    castingTimeLabel(spell.castingTime)
  ].filter(Boolean).join(" \u00B7 ");

  openModal("full", `
    <div class="modal-heading">${esc(spell.name)}</div>
    <div class="breakdown-source">${esc(meta)}</div>
    ${spell.desc ? `<div class="breakdown-source spell-desc">${esc(spell.desc)}</div>` : ""}

    ${spell.level > 0 ? toggleLineHtml("spell-prepared-switch", "Prepared", !!spell.prepared) : ""}
    ${toggleLineHtml("spell-pin-switch", "Pin to the Combat tab", spell.pinned,
      { hint: "Shows under Attacks. Unpinning doesn't delete it.",
        style: "margin-top:12px;" })}

    ${spell.attackRoll && !atk ? `
      <div class="breakdown-source" style="margin-top:14px;">Set to roll to hit for ${esc(spell.classSource || "no class")}, which isn't one of your casting classes.</div>` : ""}
    ${atk ? `
      <div class="breakdown-subhead">To Hit</div>
      ${breakdownRowsHtml(atk.sources)}
      <hr class="breakdown-divider">
      <div class="breakdown-total"><span>Total</span><span>${formatModifier(atk.total)}</span></div>` : ""}

    ${spell.damage ? `
      <div class="breakdown-subhead">Damage</div>
      <div class="breakdown-row"><span>Dice</span><span>${esc(spell.damage)}</span></div>` : ""}

    ${dc && !spell.attackRoll ? `
      <div class="breakdown-subhead">${esc(spell.classSource)} Save DC</div>
      ${breakdownRowsHtml(dc.sources)}
      <hr class="breakdown-divider">
      <div class="breakdown-total"><span>Total</span><span>${dc.total}</span></div>` : ""}

    <button class="btn-primary" id="edit-spell-button" style="margin-top:22px;">Edit Spell</button>
  `);

  // pinning is a stored flag on the spell, so it redraws the sheet the same
  // way the attack window's grip switch does -- Combat is one tap away
  const preparedSwitch = document.getElementById("spell-prepared-switch");
  if (preparedSwitch) preparedSwitch.addEventListener("click", (e) => {
    spell.prepared = !spell.prepared;
    e.currentTarget.classList.toggle("on", spell.prepared);
    renderContent();          // the row's dot and the "x / y prepared" count
  });

  document.getElementById("spell-pin-switch").addEventListener("click", (e) => {
    spell.pinned = !spell.pinned;
    if (!spell.pinned) delete spell.pinned;
    e.currentTarget.classList.toggle("on", !!spell.pinned);
    renderContent();
    showToast(spell.pinned ? spell.name + " pinned to Combat" : spell.name + " unpinned from Combat");
  });

  document.getElementById("edit-spell-button").addEventListener("click", () => openSpellEditModal(spellId));
}

function openSpellEditModal(spellId) {
  const spell = character.spells.find(s => s.id == spellId);
  let attackOn = spell.attackRoll || false;
  openModal("full", `
    <div class="modal-heading">Edit Spell</div>
    ${spellFormFieldsHtml(spell)}
    <div class="btn-row-2" style="margin-top:6px;">
      <button class="btn-primary" id="save-spell-edit-button">Save Changes</button>
      <button class="btn-primary btn-danger" id="remove-spell-button">Remove</button>
    </div>
  `);
  guardModalEdits();
  wireSelect("spell-form-level"); wireSelect("spell-form-class"); wireSelect("spell-form-time");
  document.getElementById("spell-form-attack-switch").addEventListener("click", (e) => { attackOn = !attackOn; e.currentTarget.classList.toggle("on", attackOn); });
  document.getElementById("save-spell-edit-button").addEventListener("click", () => {
    const formData = readSpellForm();
    Object.assign(spell, formData);
    spell.attackRoll = attackOn;
    if (!spell.damage) delete spell.damage;
    if (spell.level === 0) delete spell.prepared;
    else if (spell.prepared === undefined) spell.prepared = false;
    closeModal();
    renderContent();
  });
  // now that a spell can also be pinned to Combat, "Remove" and "unpin" are
  // two different things and one of them is permanent -- so it asks
  document.getElementById("remove-spell-button").addEventListener("click", () => {
    confirmModal({
      title: "Remove " + spell.name + "?",
      body: "This deletes the spell from your sheet, including anywhere it's pinned.",
      confirmLabel: "Remove",
      danger: true,
      onConfirm: () => {
        character.spells = character.spells.filter(s => s.id != spellId);
        closeModal();
        renderContent();
      }
    });
  });
}
