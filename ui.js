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

/* An in-app replacement for <select>, which renders as an OS picker on mobile.

   It keeps a hidden <input> carrying the real id, so everything that already
   reads `getElementById(id).value` or listens for "change" keeps working
   untouched -- picking an option writes the input and dispatches a change
   event by hand. That makes converting the remaining native selects a
   markup-only job. */
function selectFieldHtml(id, label, options, value) {
  const items = options.map(option => (typeof option === "string" ? { value: option, label: option } : option));
  const selected = items.find(item => item.value === value) || items[0];

  return `
    <div class="field">
      ${label ? `<label>${esc(label)}</label>` : ""}
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
      </div>
    </div>`;
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
    extra.innerHTML = `
      <div class="field"><label>Exhaustion Level</label>
        <input id="${idPrefix}-condition-level" type="number" min="1" max="6" value="${level}">
        <div class="atk-range" style="margin-top:4px;">Each level adds to the ones below it. A long rest removes one.</div>
      </div>`;
  }

  wireCombo(idPrefix + "-condition", ALL_CONDITIONS, reveal);
  if (existingValue && existingValue.condition) reveal(existingValue.condition);
}

function effectSubfieldsHtml(category, idPrefix) {
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
    return `<div class="field-row">
      ${selectFieldHtml(idPrefix + "-ability", "Ability", Object.keys(ABILITY_FULL_NAMES))}
      <div class="field"><label>Amount</label><input id="${idPrefix}-amount" type="number" value="-2"></div>
    </div>`;
  }
  if (category === "Skill") {
    return `<div class="field-row">
      ${selectFieldHtml(idPrefix + "-skill", "Skill", Object.keys(character.skillAbilityMap))}
      <div class="field"><label>Amount</label><input id="${idPrefix}-amount" type="number" value="2"></div>
    </div>`;
  }
  return `<div class="field-row">
    ${selectFieldHtml(idPrefix + "-stat", "Stat", MODIFIER_STATS)}
    <div class="field"><label>Amount</label><input id="${idPrefix}-amount" type="number" value="1"></div>
  </div>`;
}

function readEffectValueFromForm(category, idPrefix) {
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
  if (category === "Ability Score" || category === "Saving Throw") {
    return { ability: document.getElementById(idPrefix + "-ability").value, amount: parseInt(document.getElementById(idPrefix + "-amount").value) || 0 };
  }
  if (category === "Skill") {
    return { skill: document.getElementById(idPrefix + "-skill").value, amount: parseInt(document.getElementById(idPrefix + "-amount").value) || 0 };
  }
  return { stat: document.getElementById(idPrefix + "-stat").value, amount: parseInt(document.getElementById(idPrefix + "-amount").value) || 0 };
}

function prefillEffectSubfields(eff, idPrefix) {
  if (!eff.value) return;
  const map = { ability: "-ability", skill: "-skill", stat: "-stat", amount: "-amount", condition: "-condition",
                rollType: "-rolltype", mode: "-mode" };
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
    <div class="field"><label>Custom Label</label><input id="${idPrefix}-tag-custom" value="${esc(value || "")}" placeholder="e.g. Per Day"></div>
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
  return `<div class="field"><label>How Much</label>
    <input id="${idPrefix}-amount-custom" value="${esc(value)}" placeholder="a number, or dice like 1d4">
  </div>`;
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
