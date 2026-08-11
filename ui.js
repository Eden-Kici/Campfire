/* ============================================================
   MODAL SYSTEM
   ============================================================ */

function openModal(mode, contentHtml) {
  closeModal();
  const phone = document.querySelector(".phone");
  const overlay = document.createElement("div");
  overlay.id = "modal-overlay";
  overlay.className = "modal-overlay modal-" + mode;
  // sheet/full slide up from the bottom and get a drag-to-dismiss handle;
  // center and drawer get a close button instead
  const showHandle = mode === "sheet" || mode === "full";

  overlay.innerHTML = `
    <div class="modal-box">
      ${showHandle ? `<div class="modal-handle"></div>` : `<button class="modal-close-x">\u2715</button>`}
      <div class="modal-content">${contentHtml}</div>
    </div>
  `;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  phone.appendChild(overlay);
  phone.scrollIntoView({ block: "center" });

  if (showHandle) makeDraggable(overlay.querySelector(".modal-handle"), overlay.querySelector(".modal-box"));
  else overlay.querySelector(".modal-close-x").addEventListener("click", closeModal);
}

function closeModal() {
  const existing = document.getElementById("modal-overlay");
  if (existing) existing.remove();
}

function makeDraggable(handleEl, boxEl) {
  let startY = 0, currentY = 0, dragging = false;
  handleEl.addEventListener("pointerdown", (e) => { dragging = true; startY = e.clientY; boxEl.style.transition = "none"; });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    currentY = Math.max(0, e.clientY - startY);
    boxEl.style.transform = "translateY(" + currentY + "px)";
  });
  window.addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;
    boxEl.style.transition = "transform .2s ease";
    if (currentY > 80) closeModal(); else boxEl.style.transform = "translateY(0)";
    currentY = 0;
  });
  handleEl.addEventListener("click", () => closeModal());
}

function breakdownRowsHtml(sources) {
  return sources.map(s => `<div class="breakdown-row"><span>${esc(s.label)}</span><span>${formatModifier(s.value)}</span></div>`).join("");
}

function openBreakdownModal(title, total, suffix, sources, rollButton) {
  openModal("center", `
    <div class="breakdown-title">${esc(title)}</div>
    ${breakdownRowsHtml(sources)}
    <hr class="breakdown-divider">
    <div class="breakdown-total"><span>Total</span><span>${total}${suffix || ""}</span></div>
    ${rollButton ? `<button class="btn-primary" id="breakdown-roll-btn" style="margin-top:14px;">Roll ${esc(rollButton.label)}</button>` : ""}
  `);
  if (rollButton) document.getElementById("breakdown-roll-btn").addEventListener("click", () =>
    showRoll({ label: rollButton.label, notation: rollButton.notation, sources, kind: rollButton.kind || "check", ability: rollButton.ability }));
}

/* ============================================================
   FORM PRIMITIVES

   A field is a label above a control, and the app has sixty-odd of them. Half
   were already components -- selects and combos had to be, because they
   replace native controls with real behaviour -- and half were hand-written
   markup repeated at every call site. That split is how one field ends up
   without an esc() around its value, or with a different margin than the one
   next to it, and nobody notices until it's on screen.

   So the plain ones get built here too. Escaping stops being a thing anyone
   has to remember, and what a field looks like is one edit rather than sixty.

   `opts` carries the occasional extra: a placeholder, a note under the
   control, an inline style for fields that size themselves inside a row.
   ============================================================ */

function fieldHtml(label, inner, opts) {
  const { style, hint, className } = opts || {};
  return `<div class="field${className ? " " + className : ""}"${style ? ` style="${style}"` : ""}>` +
    (label ? `<label>${esc(label)}</label>` : "") +
    inner +
    (hint ? `<div class="field-hint">${esc(hint)}</div>` : "") +
    "</div>";
}

// a label with no control under it, used to title the blocks that build
// themselves -- damage rows, properties, the effects list
function fieldLabelHtml(label, opts) {
  return fieldHtml(label, "", opts);
}

function textFieldHtml(id, label, value, opts) {
  const { placeholder, maxlength, inputmode } = opts || {};
  return fieldHtml(label, `<input id="${id}" type="text" value="${esc(value == null ? "" : value)}"` +
    (placeholder ? ` placeholder="${esc(placeholder)}"` : "") +
    (maxlength ? ` maxlength="${maxlength}"` : "") +
    (inputmode ? ` inputmode="${inputmode}"` : "") + ">", opts);
}

/* Numbers are kept as text on the way in and parsed on the way out, so an
   empty box stays empty rather than becoming a zero -- several fields here
   mean "no limit" when blank. */
function numberFieldHtml(id, label, value, opts) {
  const { placeholder, min, max } = opts || {};
  return fieldHtml(label, `<input id="${id}" type="number" value="${esc(value == null ? "" : value)}"` +
    (min !== undefined ? ` min="${min}"` : "") +
    (max !== undefined ? ` max="${max}"` : "") +
    (placeholder ? ` placeholder="${esc(placeholder)}"` : "") + ">", opts);
}

function textAreaFieldHtml(id, label, value, opts) {
  const { placeholder, large } = opts || {};
  return fieldHtml(label, `<textarea id="${id}"${large ? ` class="field-textarea-lg"` : ""}` +
    (placeholder ? ` placeholder="${esc(placeholder)}"` : "") + `>${esc(value == null ? "" : value)}</textarea>`, opts);
}

/* A switch with its label. `on` is the starting state; the caller wires the
   click, because what a toggle does varies far more than how it looks.

   `note` is a short aside on the same line, `hint` a second line beneath. Both
   are escaped, so neither is a way to smuggle markup back in. */
function toggleLineHtml(id, label, on, opts) {
  const { note, hint, style } = opts || {};
  return `<div class="toggle-line"${style ? ` style="${style}"` : ""}>` +
    `<span>${esc(label)}` +
      (note ? ` <span class="field-hint inline">${esc(note)}</span>` : "") +
      (hint ? `<div class="field-hint">${esc(hint)}</div>` : "") +
    "</span>" +
    `<div class="switch ${on ? "on" : ""}" id="${id}"><div class="knob"></div></div>` +
    "</div>";
}

/* An in-app replacement for <input type="checkbox">, which renders as a
   bare, unstyled OS control -- same reasoning as selectFieldHtml below. It's
   a button carrying data attributes, so an existing click listener on
   data-whatever="value" keeps working; only the tag and the "checked" class
   change. `disabled` greys it out and drops the pointer, same meaning as the
   native attribute. */
function miniCheckboxHtml(dataAttr, value, checked, disabled) {
  return `<button type="button" class="mini-checkbox ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}" data-${dataAttr}="${esc(value)}"${disabled ? " disabled" : ""}></button>`;
}

/* An in-app replacement for <select>, which renders as an OS picker on mobile.

   It keeps a hidden <input> carrying the real id, so everything that already
   reads `getElementById(id).value` or listens for "change" keeps working
   untouched -- picking an option writes the input and dispatches a change
   event by hand. That makes converting the remaining native selects a
   markup-only job. */
function selectFieldHtml(id, label, options, value) {
  const items = options.map(option => (typeof option === "string" ? { value: option, label: option } : option));
  const selected = items.find(item => item.value === value) || items[0];

  return fieldHtml(label, `
      <div class="select" data-select="${id}">
        <input type="hidden" id="${id}" value="${esc(selected ? selected.value : "")}">
        <button type="button" class="select-trigger">
          <span class="select-value">${esc(selected ? selected.label : "")}</span>
          <span class="select-caret">⌄</span>
        </button>
        <div class="select-list" hidden>
          ${items.map(item => `
            <button type="button" class="select-option ${selected && item.value === selected.value ? "active" : ""}" data-value="${esc(item.value)}">${esc(item.label)}</button>
          `).join("")}
        </div>
      </div>`);
}

function wireSelect(id) {
  const wrap = document.querySelector(`[data-select="${id}"]`);
  if (!wrap) return;
  const input = document.getElementById(id);
  const trigger = wrap.querySelector(".select-trigger");
  const list = wrap.querySelector(".select-list");

  trigger.addEventListener("click", () => {
    const opening = list.hidden;
    document.querySelectorAll(".select-list").forEach(other => { other.hidden = true; });
    list.hidden = !opening;
  });

  list.querySelectorAll(".select-option").forEach(option => {
    option.addEventListener("click", () => {
      input.value = option.dataset.value;
      wrap.querySelector(".select-value").textContent = option.textContent.trim();
      list.querySelectorAll(".select-option").forEach(other => other.classList.toggle("active", other === option));
      list.hidden = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function wireSelectsIn(root) {
  (root || document).querySelectorAll("[data-select]").forEach(wrap => wireSelect(wrap.dataset.select));
}

// Sets a selectFieldHtml control's value from code rather than a click --
// for auto-fill flows (picking a known spell prefills several fields at
// once; see tab-spells.js's SRD picker) where nothing was actually clicked.
// Mirrors wireSelect's own option-click handler so the hidden input, the
// visible label and the "active" option all stay in sync the way a real
// click would leave them.
function setSelectValue(id, value) {
  const wrap = document.querySelector(`[data-select="${id}"]`);
  if (!wrap) return;
  const input = document.getElementById(id);
  const option = Array.from(wrap.querySelectorAll(".select-option")).find(o => o.dataset.value === String(value));
  if (!option) return;
  input.value = value;
  wrap.querySelector(".select-value").textContent = option.textContent.trim();
  wrap.querySelectorAll(".select-option").forEach(o => o.classList.toggle("active", o === option));
}

/* A text field with its own suggestion list. Replaces <datalist>, which renders
   as an OS-native dropdown -- fine on desktop, wrong for something that ships
   as a mobile app. Free text still wins, so non-SRD names work. The list sits
   in normal flow rather than floating, so it can't be clipped by a modal. */
function comboFieldHtml(id, label, placeholder, value) {
  return `
    <div class="field combo">
      <label>${esc(label)}</label>
      <input id="${id}" autocomplete="off" placeholder="${placeholder}" value="${esc(value || "")}">
      <div class="combo-list" id="${id}-list" hidden></div>
    </div>`;
}

function wireCombo(id, options, onChange) {
  const input = document.getElementById(id);
  const list = document.getElementById(id + "-list");
  if (!input || !list) return;
  const announce = () => { if (onChange) onChange(input.value.trim()); };

  function draw() {
    const query = input.value.trim().toLowerCase();
    const matches = options.filter(option => option.toLowerCase().includes(query));
    list.innerHTML = matches.length
      ? matches.map(option => `<button type="button" class="combo-option" data-pick="${esc(option)}">${esc(option)}</button>`).join("")
      : `<div class="combo-empty">No match — "${input.value.trim()}" will be used as a custom entry</div>`;

    // pointerdown fires before the input loses focus, on both touch and mouse
    list.querySelectorAll("[data-pick]").forEach(button => {
      button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        input.value = button.dataset.pick;
        list.hidden = true;
        announce();
      });
    });
  }

  input.addEventListener("focus", () => { draw(); list.hidden = false; });
  input.addEventListener("input", () => { draw(); announce(); });
  input.addEventListener("blur", () => setTimeout(() => { list.hidden = true; }, 150));
}

/* The condition field reveals a level input when what you've typed is
   exhaustion, and hides it again otherwise. It's the only condition with
   degrees, so a permanent "Level" box on every condition would be noise. */
function wireConditionField(idPrefix, existingValue) {
  const extra = document.getElementById(idPrefix + "-condition-extra");
  if (!extra) return;

  function reveal(condition) {
    const isExhaustion = String(condition).trim().toLowerCase() === "exhaustion";
    if (!isExhaustion) { extra.innerHTML = ""; return; }
    if (document.getElementById(idPrefix + "-condition-level")) return;   // already shown

    const level = existingValue && existingValue.level ? existingValue.level : 1;
    extra.innerHTML = numberFieldHtml(idPrefix + "-condition-level", "Exhaustion Level", level,
      { min: 1, max: 6, hint: "Each level adds to the ones below it. A long rest removes one." });
  }

  wireCombo(idPrefix + "-condition", ALL_CONDITIONS, reveal);
  if (existingValue && existingValue.condition) reveal(existingValue.condition);
}

/* `existingValue` (an effect's current .value, when there is one) is what
   lets the Amount field render as a tier list from the start when it's
   already scaling -- prefillEffectSubfields can set a plain input's value
   after the fact, but it can't retroactively turn a number field into a
   tier list, so the amount fields below need to know up front. */
function effectSubfieldsHtml(category, idPrefix, existingValue) {
  if (category === "Condition") {
    return comboFieldHtml(idPrefix + "-condition", "Condition", "Choose one, or type your own") +
      `<div id="${idPrefix}-condition-extra"></div>`;
  }
  if (category === "Advantage") {
    return `<div class="field-row">
      ${selectFieldHtml(idPrefix + "-rolltype", "Applies To", ROLL_TYPES)}
      ${selectFieldHtml(idPrefix + "-mode", "Effect", [
        { value: "advantage", label: "Advantage" },
        { value: "disadvantage", label: "Disadvantage" }
      ])}
    </div>`;
  }
  if (category === "Ability Score" || category === "Saving Throw") {
    return selectFieldHtml(idPrefix + "-ability", "Ability", Object.keys(ABILITY_FULL_NAMES)) +
      scalingValueFieldsHtml(idPrefix + "-amount", (existingValue && existingValue.amount !== undefined) ? existingValue.amount : -2, "Amount");
  }
  if (category === "Skill") {
    return selectFieldHtml(idPrefix + "-skill", "Skill", Object.keys(character.skillAbilityMap)) +
      scalingValueFieldsHtml(idPrefix + "-amount", (existingValue && existingValue.amount !== undefined) ? existingValue.amount : 2, "Amount");
  }
  if (category === "Reroll") {
    return `<div class="field-row">
      ${selectFieldHtml(idPrefix + "-rolltype", "Applies To", REROLL_ROLL_TYPES)}
      ${numberFieldHtml(idPrefix + "-threshold", "Reroll At Or Below", 1, { min: 1, max: 19, hint: "e.g. 1 rerolls a 1; 2 rerolls a 1 or 2" })}
    </div>`;
  }
  return selectFieldHtml(idPrefix + "-stat", "Stat", MODIFIER_STATS) +
    scalingValueFieldsHtml(idPrefix + "-amount", (existingValue && existingValue.amount !== undefined) ? existingValue.amount : 1, "Amount");
}

// `existingValue` (the effect's value before this read) tells the amount
// field whether it's currently rendered as a tier list or a plain number --
// same reason effectSubfieldsHtml needs it on the way in.
function readEffectValueFromForm(category, idPrefix, existingValue) {
  if (category === "Condition") {
    const condition = document.getElementById(idPrefix + "-condition").value.trim();
    const value = { condition };
    // exhaustion is the one condition with degrees
    const levelField = document.getElementById(idPrefix + "-condition-level");
    if (levelField) value.level = Math.max(1, Math.min(6, parseInt(levelField.value) || 1));
    return value;
  }
  if (category === "Advantage") {
    return {
      rollType: document.getElementById(idPrefix + "-rolltype").value,
      mode: document.getElementById(idPrefix + "-mode").value
    };
  }
  const amount = () => syncScalingValueFields(idPrefix + "-amount", (existingValue && existingValue.amount !== undefined) ? existingValue.amount : 0);
  if (category === "Ability Score" || category === "Saving Throw") {
    return { ability: document.getElementById(idPrefix + "-ability").value, amount: amount() };
  }
  if (category === "Skill") {
    return { skill: document.getElementById(idPrefix + "-skill").value, amount: amount() };
  }
  if (category === "Reroll") {
    return { rollType: document.getElementById(idPrefix + "-rolltype").value, threshold: Math.max(1, parseInt(document.getElementById(idPrefix + "-threshold").value) || 1) };
  }
  return { stat: document.getElementById(idPrefix + "-stat").value, amount: amount() };
}

function prefillEffectSubfields(eff, idPrefix) {
  if (!eff.value) return;
  // "amount" is handled at render time (effectSubfieldsHtml takes the
  // existing value directly) since a scaling amount is a tier list, not a
  // single input a value can be poked into after the fact
  const map = { ability: "-ability", skill: "-skill", stat: "-stat", condition: "-condition",
                rollType: "-rolltype", mode: "-mode", threshold: "-threshold" };
  Object.keys(map).forEach(key => {
    if (eff.value[key] !== undefined) {
      const el = document.getElementById(idPrefix + map[key]);
      if (el) el.value = eff.value[key];
    }
  });
}

// only "SR" and "LR" are understood by the rest system. anything custom is the
// player's to track, so the form says so plainly at the point of choosing it.
function rechargeCustomFieldHtml(idPrefix, value) {
  return `
    ${textFieldHtml(idPrefix + "-tag-custom", "Custom Label", value, { placeholder: "e.g. Per Day" })}
    <div class="form-warning">Custom recharges aren't restored by a Short or Long Rest \u2014 you'll need to reset this one yourself.</div>
  `;
}

function rechargeFieldHtml(idPrefix, recharge) {
  recharge = recharge || { on: "SR", amount: "all" };
  const known = ["SR", "LR", "none"];
  const isKnown = known.includes(recharge.on);
  const selectedOn = isKnown ? (recharge.on === "none" ? "None" : recharge.on) : "Custom";
  const amount = recharge.amount === undefined ? "all" : recharge.amount;
  const amountType = (amount === "all" || amount === "half") ? amount : "custom";

  return `
    <div class="field-row">
      ${selectFieldHtml(idPrefix + "-tag-type", "Recharges", [
        { value: "SR", label: "Short Rest" },
        { value: "LR", label: "Long Rest" },
        { value: "None", label: "Doesn't Recharge" },
        { value: "Custom", label: "Custom" }
      ], selectedOn)}
      ${selectFieldHtml(idPrefix + "-amount-type", "Restores", [
        { value: "all", label: "All" },
        { value: "half", label: "Half" },
        { value: "custom", label: "Custom" }
      ], amountType)}
    </div>
    <div id="${idPrefix}-amount-custom-wrap">
      ${amountType === "custom" ? rechargeAmountFieldHtml(idPrefix, amount) : ""}
    </div>
    <div id="${idPrefix}-tag-custom-wrap">
      ${selectedOn === "Custom" ? rechargeCustomFieldHtml(idPrefix, isKnown ? "" : recharge.on) : ""}
    </div>
  `;
}

function rechargeAmountFieldHtml(idPrefix, amount) {
  const value = (amount === "all" || amount === "half") ? "" : amount;
  return textFieldHtml(idPrefix + "-amount-custom", "How Much", value,
    { placeholder: "a number, or dice like 1d4" });
}

function wireRechargeField(idPrefix) {
  wireSelect(idPrefix + "-tag-type");
  wireSelect(idPrefix + "-amount-type");

  const onSelect = document.getElementById(idPrefix + "-tag-type");
  const onWrap = document.getElementById(idPrefix + "-tag-custom-wrap");
  onSelect.addEventListener("change", () => {
    onWrap.innerHTML = onSelect.value === "Custom" ? rechargeCustomFieldHtml(idPrefix, "") : "";
  });

  const amountSelect = document.getElementById(idPrefix + "-amount-type");
  const amountWrap = document.getElementById(idPrefix + "-amount-custom-wrap");
  amountSelect.addEventListener("change", () => {
    amountWrap.innerHTML = amountSelect.value === "custom" ? rechargeAmountFieldHtml(idPrefix, "") : "";
  });
}

function readRechargeValue(idPrefix) {
  const onType = document.getElementById(idPrefix + "-tag-type").value;
  let on = onType;
  if (onType === "None") on = "none";
  else if (onType === "Custom") {
    const input = document.getElementById(idPrefix + "-tag-custom");
    on = input && input.value.trim() ? input.value.trim() : "Custom";
  }

  const amountType = document.getElementById(idPrefix + "-amount-type").value;
  let amount = amountType;
  if (amountType === "custom") {
    const input = document.getElementById(idPrefix + "-amount-custom");
    const raw = input ? input.value.trim() : "";
    // a recharge restores; a negative amount would drain, which is never wanted
    amount = raw === "" ? "all" : (/^\d+$/.test(raw) ? Math.max(0, parseInt(raw)) : raw.replace(/^-/, ""));
  }

  return { on, amount };
}


/* ============================================================
   SCALING VALUE FIELD

   A number that's either flat (the common case) or scales by character
   level -- a resource's max uses, an effect's bonus amount. Same shape
   resolveScalingValue()/effectAmount()/effectiveResourceMax() (character-
   data.js) read: a plain number, or { tiers: [{level, value}, ...] }.

   The toggle swaps between a single number field and a repeatable list of
   level breakpoints, the same "toggle reveals a different body" pattern the
   race form's skill-choice switch already uses. `accessor` is how it reads
   and writes wherever the value actually lives -- this widget has no idea
   whether that's a feature's resource.max or an effect's value.amount, and
   doesn't need to.
   ============================================================ */

function scalingValueBodyHtml(idPrefix, value) {
  const scaling = value && typeof value === "object" && Array.isArray(value.tiers);
  if (!scaling) return numberFieldHtml(idPrefix + "-flat", "Amount", typeof value === "number" ? value : 1);
  return `
    ${value.tiers.map((t, i) => `
      <div class="field-row" data-tier-row="${i}">
        ${numberFieldHtml(idPrefix + "-tier-" + i + "-level", "At Level", t.level, { min: 1, max: 20 })}
        ${numberFieldHtml(idPrefix + "-tier-" + i + "-value", "Becomes", t.value)}
        <button type="button" class="chip-remove" data-tier-remove="${i}" style="align-self:center;margin-top:18px;">✕</button>
      </div>
    `).join("")}
    <button type="button" class="add-link" data-tier-add="1">+ Add Level Breakpoint</button>
  `;
}

function scalingValueFieldsHtml(idPrefix, value, label) {
  const scaling = value && typeof value === "object" && Array.isArray(value.tiers);
  return `
    ${toggleLineHtml(idPrefix + "-scaleon", (label || "Amount") + " scales by level", scaling)}
    <div id="${idPrefix}-body">${scalingValueBodyHtml(idPrefix, value)}</div>
  `;
}

// reads whatever's currently on screen back into the value shape, given a
// hint of which mode it's in (a fresh render always knows; a caller mid-edit
// passes the mode it last rendered)
function readScalingValueFromForm(idPrefix, wasScaling, tierCount) {
  if (!wasScaling) {
    const flatEl = document.getElementById(idPrefix + "-flat");
    return flatEl ? (parseInt(flatEl.value) || 0) : 0;
  }
  const tiers = [];
  for (let i = 0; i < tierCount; i++) {
    const lvlEl = document.getElementById(idPrefix + "-tier-" + i + "-level");
    if (!lvlEl) continue;
    tiers.push({ level: parseInt(lvlEl.value) || 1, value: parseInt(document.getElementById(idPrefix + "-tier-" + i + "-value").value) || 0 });
  }
  return { tiers };
}

// used at outer save/sync time -- resolves the current on-screen value with
// no live accessor needed, the same "read every field back" pattern
// syncFeatureList (content.js) already uses for the rest of a feature row
function syncScalingValueFields(idPrefix, currentValue) {
  const scaling = currentValue && typeof currentValue === "object" && Array.isArray(currentValue.tiers);
  return readScalingValueFromForm(idPrefix, scaling, scaling ? currentValue.tiers.length : 0);
}

function wireScalingValueFields(idPrefix, accessor) {
  const switchEl = document.getElementById(idPrefix + "-scaleon");
  const bodyEl = document.getElementById(idPrefix + "-body");
  if (!switchEl || !bodyEl) return;

  function redraw() {
    const value = accessor.get();
    const scaling = value && typeof value === "object" && Array.isArray(value.tiers);
    switchEl.classList.toggle("on", scaling);
    bodyEl.innerHTML = scalingValueBodyHtml(idPrefix, value);
    wireBody();
  }

  function wireBody() {
    const value = accessor.get();
    const scaling = value && typeof value === "object" && Array.isArray(value.tiers);
    if (!scaling) return;
    bodyEl.querySelectorAll("[data-tier-remove]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tiers = readScalingValueFromForm(idPrefix, true, value.tiers.length).tiers;
        tiers.splice(parseInt(btn.dataset.tierRemove), 1);
        accessor.set({ tiers });
        redraw();
      });
    });
    const addBtn = bodyEl.querySelector("[data-tier-add]");
    if (addBtn) addBtn.addEventListener("click", () => {
      const tiers = readScalingValueFromForm(idPrefix, true, value.tiers.length).tiers;
      const lastLevel = tiers.length ? tiers[tiers.length - 1].level : 0;
      tiers.push({ level: Math.min(20, lastLevel + 1), value: 0 });
      accessor.set({ tiers });
      redraw();
    });
  }

  switchEl.addEventListener("click", () => {
    const value = accessor.get();
    const scaling = value && typeof value === "object" && Array.isArray(value.tiers);
    if (scaling) {
      // collapsing back to flat keeps the highest tier's value -- what it was
      // worth eventually is a more useful starting point than what it started at
      const tiers = readScalingValueFromForm(idPrefix, true, value.tiers.length).tiers;
      accessor.set(tiers.length ? tiers.sort((a, b) => b.level - a.level)[0].value : 0);
    } else {
      const flat = readScalingValueFromForm(idPrefix, false, 0);
      accessor.set({ tiers: [{ level: 1, value: flat }] });
    }
    redraw();
  });

  wireBody();
}


/* ============================================================
   GENERIC TOAST (non-roll messages)
   ============================================================ */

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "roll-toast";
  toast.innerHTML = `<div class="roll-toast-value" style="font-size:15px;">${esc(message)}</div>`;
  document.querySelector(".phone").appendChild(toast);

  activeToasts.unshift(toast);
  if (activeToasts.length > 3) activeToasts.pop().remove();
  repositionToasts();

  setTimeout(() => {
    toast.remove();
    activeToasts = activeToasts.filter(t => t !== toast);
    repositionToasts();
  }, 3000);
}
