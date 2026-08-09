/* ============================================================
   CONSTANTS
   ============================================================ */

const ALL_CONDITIONS = [
  "Blinded", "Charmed", "Concentration", "Deafened", "Exhaustion", "Frightened",
  "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"
];

/* Which conditions bend a roll, and which rolls they touch. Only conditions on
   *this* character are modelled -- the many 5e rules keyed to the target's
   condition ("advantage against a prone creature") need a target, which the
   sheet has no concept of. A homebrew or non-SRD condition simply won't appear
   here, which is what the manual override on the roll window is for. */
const CONDITION_ROLL_EFFECTS = {
  Blinded:    [{ applies: "attack", mode: "disadvantage" }],
  Frightened: [{ applies: "attack", mode: "disadvantage" }, { applies: "check", mode: "disadvantage" }],
  Invisible:  [{ applies: "attack", mode: "advantage" }],
  Poisoned:   [{ applies: "attack", mode: "disadvantage" }, { applies: "check", mode: "disadvantage" }],
  Prone:      [{ applies: "attack", mode: "disadvantage" }],
  Restrained: [{ applies: "attack", mode: "disadvantage" }, { applies: "save", ability: "DEX", mode: "disadvantage" }]
  // Exhaustion is handled separately, since which rolls it touches depends on
  // how many levels of it you have
};

const DAMAGE_TYPES = [
  "Slashing", "Piercing", "Bludgeoning", "Acid", "Cold", "Fire", "Force",
  "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder"
];

// suggestions only -- the field is free text, so "Exotic" or "Firearms" work
const WEAPON_PROFICIENCY_TYPES = ["Simple", "Martial"];

const SRD_WEAPON_PROPERTIES = [
  "Ammunition", "Finesse", "Heavy", "Light", "Loading",
  "Range", "Reach", "Special", "Thrown", "Two-Handed", "Versatile"
];

const MODIFIER_STATS = ["AC", "Initiative", "Speed", "Attack Rolls", "Damage Rolls", "Proficiency Bonus", "Spell Attack", "Spell DC"];
const EFFECT_CATEGORIES_GENERAL = ["Condition", "Ability Score", "Saving Throw", "Skill", "Bonus", "Advantage"];
const EFFECT_CATEGORIES_FEATURE = ["Ability Score", "Saving Throw", "Skill", "Bonus", "Advantage"];

// what an "Advantage" effect can apply to. these values match the `kind` passed
// to showRoll, so a custom effect and the condition table speak the same language.
const ROLL_TYPES = [
  { value: "attack", label: "Attack Rolls" },
  { value: "check", label: "Ability Checks" },
  { value: "save", label: "Saving Throws" },
  { value: "damage", label: "Damage Rolls" },
  { value: "all", label: "All Rolls" }
];


/* ============================================================
   DICE ROLLING
   ============================================================ */

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

// dieValue decides what each die contributes, so the same parser can roll a
// notation, or report the best it could possibly do (for the MAX readout).
function evaluateNotation(notation, dieValue) {
  const tokens = notation.match(/(\d*d\d+|\d+\.?\d*|[+\-*/])/gi) || [];
  const resolvedTokens = [];
  const values = [];
  const ops = [];

  tokens.forEach(tok => {
    if (/^[+\-*/]$/.test(tok)) {
      ops.push(tok);
      resolvedTokens.push(tok);
    } else {
      const diceMatch = tok.match(/^(\d*)d(\d+)$/i);
      if (diceMatch) {
        const count = parseInt(diceMatch[1] || "1");
        const sides = parseInt(diceMatch[2]);
        let rolled = 0;
        for (let i = 0; i < count; i++) rolled += dieValue(sides);
        values.push(rolled);
        resolvedTokens.push(count + "d" + sides + "(" + rolled + ")");
      } else {
        values.push(parseFloat(tok));
        resolvedTokens.push(tok);
      }
    }
  });

  let vals = values.slice();
  let operators = ops.slice();
  for (let i = 0; i < operators.length; i++) {
    if (operators[i] === "*" || operators[i] === "/") {
      const result = operators[i] === "*" ? vals[i] * vals[i + 1] : vals[i] / vals[i + 1];
      vals.splice(i, 2, result);
      operators.splice(i, 1);
      i--;
    }
  }
  let total = vals.length ? vals[0] : 0;
  for (let i = 0; i < operators.length; i++) {
    // a trailing operator ("5+") leaves no right-hand value; treat it as zero
    // rather than propagating NaN into the character's hit points
    const next = vals[i + 1] === undefined || isNaN(vals[i + 1]) ? 0 : vals[i + 1];
    if (operators[i] === "+") total += next;
    else if (operators[i] === "-") total -= next;
  }
  if (isNaN(total)) total = 0;
  return { total: Math.round(total * 100) / 100, breakdown: resolvedTokens.join(" ") };
}

function rollNotation(notation) {
  return evaluateNotation(notation, sides => rollDie(sides));
}

function maxNotation(notation) {
  return evaluateNotation(notation, sides => sides).total;
}

// A roll is one or more parts summed together. Single-notation rolls are just
// the one-part case, so damage that deals several types shares this path.
function rollParts(parts) {
  const results = parts.map(part => Object.assign({}, part, { result: rollNotation(part.notation) }));
  return { total: results.reduce((sum, r) => sum + r.result.total, 0), parts: results };
}

function rollPartsFor(config) {
  return rollParts(config.parts && config.parts.length ? config.parts : [{ notation: config.notation }]);
}

// 5e resolves advantage on the d20, but every other term is constant, so
// picking the better of two whole evaluations gives the same answer.
function rollWithMode(config, mode) {
  const first = rollPartsFor(config);
  if (mode === "normal") return { outcome: first };
  const second = rollPartsFor(config);
  const keepFirst = mode === "advantage" ? first.total >= second.total : first.total <= second.total;
  return { outcome: keepFirst ? first : second, dropped: keepFirst ? second : first };
}

function maxFor(config) {
  const parts = config.parts && config.parts.length ? config.parts : [{ notation: config.notation }];
  return parts.reduce((sum, part) => sum + maxNotation(part.notation), 0);
}

// Advantage and disadvantage don't stack in 5e -- any of each cancels to a
// straight roll, however many sources are involved. Both lists are kept so the
// window can explain what happened rather than just showing "normal".
function derivedRollMode(character, kind, ability) {
  const reasons = { advantage: [], disadvantage: [] };
  const note = (mode, label) => { if (!reasons[mode].includes(label)) reasons[mode].push(label); };

  // getAllEffects covers both active effect groups and permanent feature
  // effects, so a feat that grants advantage counts the same as a condition
  // exhaustion bites at 1 (checks) and again at 3 (attacks and saves)
  const exhaustion = exhaustionLevel(character);
  if (exhaustion >= 1 && kind === "check") note("disadvantage", "Exhaustion " + exhaustion);
  if (exhaustion >= 3 && (kind === "attack" || kind === "save")) note("disadvantage", "Exhaustion " + exhaustion);

  getAllEffects(character).forEach(effect => {
    if (effect.category === "Condition") {
      (CONDITION_ROLL_EFFECTS[effect.value.condition] || []).forEach(rule => {
        if (rule.applies !== kind) return;
        if (rule.ability && rule.ability !== ability) return;
        note(rule.mode, effectSourceLabel(effect));
      });
    } else if (effect.category === "Advantage") {
      if (effect.value.rollType === "all" || effect.value.rollType === kind) {
        note(effect.value.mode, effectSourceLabel(effect));
      }
    }
  });

  let mode = "normal";
  if (reasons.advantage.length && !reasons.disadvantage.length) mode = "advantage";
  else if (reasons.disadvantage.length && !reasons.advantage.length) mode = "disadvantage";
  return { mode, reasons };
}


let activeToasts = [];

function showRollToast(label, notation) {
  const result = rollNotation(notation);
  const toast = document.createElement("div");
  toast.className = "roll-toast";
  toast.innerHTML = `
    <div class="roll-toast-label">${esc(label)}</div>
    <div class="roll-toast-value">${result.total}</div>
    <div class="roll-toast-sub">${esc(notation)} \u00B7 ${esc(result.breakdown)}</div>
  `;
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

function repositionToasts() {
  activeToasts.forEach((toast, index) => {
    toast.style.top = (60 + index * 78) + "px";
    toast.style.zIndex = 200 - index;
    toast.style.opacity = index === 0 ? "1" : (1 - index * 0.25);
  });
}


/* ============================================================
   ROLL WINDOW
   ============================================================ */

/* Every roll opens the same window, with the same controls in the same places.
   Only the readouts flanking the total change: damage rolls show half (for
   resistance) and the maximum the notation could produce; other rolls leave
   those two cells empty so nothing below them shifts.

   config: { label, notation, sources, kind, ability }
   kind is one of "attack" | "check" | "save" | "damage", and decides both the
   flanking readouts and which conditions are consulted. */

let rollState = null;

function showRoll(config) {
  const derived = derivedRollMode(character, config.kind, config.ability);
  rollState = { config, derived, mode: derived.mode, manual: false };
  Object.assign(rollState, rollWithMode(config, rollState.mode));
  openModal("center", rollWindowHtml());
  wireRollWindow();
}

function rerollCurrent() {
  Object.assign(rollState, { dropped: null }, rollWithMode(rollState.config, rollState.mode));
  redrawRollWindow();
}

function setRollMode(mode) {
  rollState.mode = mode;
  rollState.manual = mode !== rollState.derived.mode;
  rerollCurrent();
}

function rollModeExplanation() {
  const { derived, manual, mode } = rollState;
  const advantage = derived.reasons.advantage;
  const disadvantage = derived.reasons.disadvantage;

  if (manual) {
    const wouldBe = derived.mode === "normal"
      ? "no conditions apply"
      : derived.mode + " from " + derived.reasons[derived.mode].join(", ");
    return "Set to " + mode + " manually — " + wouldBe;
  }
  if (advantage.length && disadvantage.length) {
    return "Cancels out — advantage from " + advantage.join(", ") + ", disadvantage from " + disadvantage.join(", ");
  }
  if (advantage.length) return "Advantage from " + advantage.join(", ");
  if (disadvantage.length) return "Disadvantage from " + disadvantage.join(", ");
  return "No conditions affect this roll";
}

function rollWindowHtml() {
  const { config, outcome, dropped, mode } = rollState;
  const isDamage = config.kind === "damage";
  const total = outcome.total;

  /* One line per part. The notation is already printed above, so the "1d8"
     prefix is dropped and only what each term contributed is left: "(7) + 3".
     A multi-type damage roll gets one line each, labelled with its type. */
  const dice = outcome.parts.map(part => {
    const detail = part.result.breakdown.replace(/\d+d\d+\(/g, "(");
    return outcome.parts.length > 1
      ? `<div class="roll-part"><span>${detail}</span><span class="roll-part-total">${part.result.total} ${esc(part.label || "")}</span></div>`
      : `<div>${detail}</div>`;
  }).join("");

  const chips = (config.sources || [])
    .filter(source => source.value !== 0)
    .map(source => `<span class="roll-chip ${source.value > 0 ? "pos" : "neg"}">${esc(source.label)} ${formatModifier(source.value)}</span>`)
    .join("");

  return `
    <div class="roll-title">${esc(config.label)}</div>
    <div class="roll-notation">${esc(config.notation)}</div>

    <div class="roll-values">
      <div class="roll-side">${isDamage ? `<div class="roll-side-label">½</div><div class="roll-side-value">${Math.floor(total / 2)}</div>` : ""}</div>
      <div class="roll-total">${total}</div>
      <div class="roll-side">${isDamage ? `<div class="roll-side-label">MAX</div><div class="roll-side-value">${maxFor(config)}</div>` : ""}</div>
    </div>

    <div class="roll-dice">${dice}</div>
    ${dropped ? `<div class="roll-dropped">dropped ${dropped.total}</div>` : ""}

    ${chips ? `<div class="roll-chips">${chips}</div>` : ""}

    <div class="roll-mode-row">
      ${["advantage", "normal", "disadvantage"].map(option => `
        <button class="roll-mode-btn ${mode === option ? "active " + option : ""}" data-roll-mode="${esc(option)}">
          ${option === "advantage" ? "ADV" : option === "normal" ? "NORMAL" : "DIS"}
        </button>
      `).join("")}
    </div>
    <div class="roll-why">${rollModeExplanation()}</div>

    <button class="roll-reroll" id="roll-reroll">↻</button>
  `;
}

function redrawRollWindow() {
  const box = document.querySelector("#modal-overlay .modal-content");
  if (!box) return;
  box.innerHTML = rollWindowHtml();
  wireRollWindow();
}

function wireRollWindow() {
  document.querySelectorAll("[data-roll-mode]").forEach(button => {
    button.addEventListener("click", () => setRollMode(button.dataset.rollMode));
  });
  document.getElementById("roll-reroll").addEventListener("click", rerollCurrent);
}


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
    amount = raw === "" ? "all" : (/^\d+$/.test(raw) ? parseInt(raw) : raw);
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


/* ============================================================
   CHARACTER SELECTOR (POC — list is faked, only Sigrid is real)
   ============================================================ */

/* savedCharacters holds whole character objects, not stubs. Opening one points
   the global `character` at it, so every calculation and render reads the
   right sheet without any of them knowing a switch happened. */
let savedCharacters = [character];


/* ---------- persistence ----------

   The character shape has changed repeatedly, so the saved blob carries a
   schema version. A blob from an older version is set aside rather than
   loaded, because a half-migrated character is worse than a missing one --
   the earlier flat effects, string recharges and flat armour bonuses would
   all read as silently wrong rather than failing loudly.

   A real build would migrate. A POC only needs to notice. */

const STORAGE_KEY = "campfire.characters";
const SCHEMA_VERSION = 6;

function persistCharacters() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: SCHEMA_VERSION,
      openId: character ? character.id : null,
      characters: savedCharacters
    }));
  } catch (err) {
    // a full or unavailable store shouldn't take the app down mid-session
    console.warn("Couldn't save characters:", err);
  }
}

function loadCharacters() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    return null;                                  // storage blocked entirely
  }
  if (!raw) return null;

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (err) {
    return { stale: true, reason: "unreadable" };
  }
  if (!saved || !Array.isArray(saved.characters) || !saved.characters.length) return null;
  if (saved.version !== SCHEMA_VERSION) return { stale: true, reason: "version " + saved.version };

  savedCharacters = saved.characters;
  character = savedCharacters.find(c => c.id === saved.openId) || savedCharacters[0];
  return { stale: false };
}

function selectCharacter(id) {
  const found = savedCharacters.find(c => c.id === id);
  if (found) character = found;
  return found;
}

function nextCharacterId() {
  return Math.max(0, ...savedCharacters.map(c => c.id || 0)) + 1;
}

let currentScreen = "selector";

function showScreen(screen) {
  currentScreen = screen;
  document.getElementById("selector-screen").style.display = screen === "selector" ? "flex" : "none";
  document.getElementById("sheet-screen").style.display = screen === "sheet" ? "flex" : "none";
  if (screen === "selector") renderSelectorScreen();
  else { renderSheetHeader(); renderContent(); }
}

function renderSheetHeader() {
  document.getElementById("char-name-display").textContent = character.name;
  document.getElementById("char-class-display").textContent = classLineFor(character);
  const avatar = document.getElementById("char-avatar");
  avatar.innerHTML = character.profilePic
    ? `<img src="${character.profilePic}" alt="">`
    : character.name.trim().charAt(0).toUpperCase();
}

const ALIGNMENTS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil"
];

function openCharacterEditorModal() {
  let pendingPic = character.profilePic;

  openModal("full", `
    <div class="modal-heading">Edit Character</div>

    <div class="avatar-edit-row">
      <div class="char-avatar char-avatar-lg" id="editor-avatar">
        ${character.profilePic ? `<img src="${character.profilePic}" alt="">` : character.name.trim().charAt(0).toUpperCase()}
      </div>
      <div class="avatar-edit-actions">
        <button class="add-link" id="editor-pic-upload-btn">Upload Photo</button>
        ${character.profilePic ? `<button class="add-link" id="editor-pic-remove-btn" style="color:#F0908A;">Remove</button>` : ""}
      </div>
      <input type="file" id="editor-pic-input" accept="image/*" style="display:none;">
    </div>

    <div class="field"><label>Name</label><input id="editor-name-input" type="text" value="${esc(character.name)}"></div>
    <div class="field">
      <label>Alignment</label>
      ${selectFieldHtml("editor-alignment-input", "", ALIGNMENTS, character.alignment)}
    </div>
    <div class="field"><label>Appearance</label><textarea id="editor-appearance-input" placeholder="Physical description">${esc(character.appearance)}</textarea></div>
    <div class="field"><label>Personality Traits</label><textarea id="editor-traits-input" placeholder="How they act, talk, carry themselves">${esc(character.personalityTraits)}</textarea></div>
    <div class="field"><label>Ideals</label><textarea id="editor-ideals-input" placeholder="What they believe in">${esc(character.ideals)}</textarea></div>
    <div class="field"><label>Bonds</label><textarea id="editor-bonds-input" placeholder="Who or what they're tied to">${esc(character.bonds)}</textarea></div>
    <div class="field"><label>Flaws</label><textarea id="editor-flaws-input" placeholder="What holds them back">${esc(character.flaws)}</textarea></div>
    <div class="field"><label>Backstory</label><textarea id="editor-backstory-input" class="field-textarea-lg" placeholder="Their history">${esc(character.backstory)}</textarea></div>

    <button class="btn-primary" id="editor-save-button">Save</button>
  `);

  wireSelect("editor-alignment-input");

  const avatarPreview = document.getElementById("editor-avatar");
  const picInput = document.getElementById("editor-pic-input");

  document.getElementById("editor-pic-upload-btn").addEventListener("click", () => picInput.click());
  picInput.addEventListener("change", () => {
    const file = picInput.files[0];
    picInput.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingPic = reader.result;
      avatarPreview.innerHTML = `<img src="${pendingPic}" alt="">`;
    };
    reader.readAsDataURL(file);
  });

  const removeBtn = document.getElementById("editor-pic-remove-btn");
  if (removeBtn) removeBtn.addEventListener("click", () => {
    pendingPic = null;
    avatarPreview.innerHTML = document.getElementById("editor-name-input").value.trim().charAt(0).toUpperCase();
  });

  document.getElementById("editor-save-button").addEventListener("click", () => {
    character.name = document.getElementById("editor-name-input").value.trim() || character.name;
    character.alignment = document.getElementById("editor-alignment-input").value;
    character.appearance = document.getElementById("editor-appearance-input").value.trim();
    character.personalityTraits = document.getElementById("editor-traits-input").value.trim();
    character.ideals = document.getElementById("editor-ideals-input").value.trim();
    character.bonds = document.getElementById("editor-bonds-input").value.trim();
    character.flaws = document.getElementById("editor-flaws-input").value.trim();
    character.backstory = document.getElementById("editor-backstory-input").value.trim();
    character.profilePic = pendingPic;
    closeModal();
    renderSheetHeader();
  });
}

function renderSelectorScreen() {
  const el = document.getElementById("selector-screen");
  persistCharacters();          // creating, importing and deleting all land here

  const listHtml = savedCharacters.length
    ? savedCharacters.map(c => `
        <div class="char-card" data-open-char="${c.id}">
          <div>
            <div class="char-card-name">${esc(c.name)}${c.customBuild ? ` <span class="res-tag" style="background:#5A2C29;color:#F0908A;">CUSTOM</span>` : ""}</div>
            <div class="char-card-class">${esc(classLineFor(c))}</div>
          </div>
          <button class="char-card-menu" data-char-menu="${c.id}">\u22EF</button>
        </div>
      `).join("")
    : `<div class="empty-hint" style="padding:70px 20px;">No characters yet.<br>Create or import one to get started.</div>`;

  el.innerHTML = `
    <div class="app-header">
      <div class="brand-row">
        <span class="brand-name">Campfire</span>
        <button class="add-link" id="party-finder-button" style="margin-left:auto;">${party.status === "none" ? "Party" : party.status === "hosting" ? "Hosting" : "Connected"}</button>
      </div>
      <div class="char-name" style="margin-top:14px;">Your Characters</div>
    </div>
    <div class="content">${listHtml}</div>
    <div class="selector-actions">
      <button class="btn-secondary" id="import-char-button">Import</button>
      <button class="btn-primary" id="new-char-button">+ New Character</button>
    </div>
    <input type="file" id="import-file-input" accept=".json" style="display:none;">
  `;

  document.getElementById("party-finder-button").addEventListener("click", openPartyFinder);

  document.querySelectorAll("[data-open-char]").forEach(card => {
    card.addEventListener("click", () => {
      selectCharacter(parseInt(card.dataset.openChar));
      showScreen("sheet");
    });
  });

  document.querySelectorAll("[data-char-menu]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openCharacterMenu(parseInt(btn.dataset.charMenu));
    });
  });

  document.getElementById("new-char-button").addEventListener("click", () => {
    openCharacterCreator();
  });

  document.getElementById("import-char-button").addEventListener("click", () => {
    document.getElementById("import-file-input").click();
  });

  document.getElementById("import-file-input").addEventListener("change", (e) => {
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
      renderSelectorScreen();
      showToast("Imported " + parsed.name);
    };
    reader.onerror = () => showToast("Couldn't read that file");
    reader.readAsText(file);
  });
}

function openCharacterMenu(id) {
  const c = savedCharacters.find(x => x.id === id);
  openModal("center", `
    <div class="modal-heading">${esc(c.name)}</div>
    <button class="btn-primary" id="export-char-button" style="margin-bottom:8px;">Export</button>
    <button class="btn-primary" id="delete-char-button" style="background:#5A2C29;color:#F0908A;">Delete</button>
  `);
  document.getElementById("export-char-button").addEventListener("click", () => {
    closeModal();
    exportCharacter(c);
  });
  document.getElementById("delete-char-button").addEventListener("click", () => {
    closeModal();
    confirmDeleteCharacter(id);
  });
}

// exports the card you picked, not whichever sheet happens to be open
function exportCharacter(c) {
  const filename = c.name.replace(/[^a-z0-9]+/gi, "_") + ".json";
  const dataStr = JSON.stringify(c, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported " + filename);
}

function confirmDeleteCharacter(id) {
  const c = savedCharacters.find(x => x.id === id);
  openModal("center", `
    <div class="modal-heading">Delete ${esc(c.name)}?</div>
    <div class="breakdown-source" style="margin-bottom:14px;">This can't be undone.</div>
    <button class="btn-primary" id="confirm-delete-char-button" style="background:#5A2C29;color:#F0908A;margin-bottom:8px;">Delete</button>
    <button class="btn-secondary" id="cancel-delete-char-button">Cancel</button>
  `);
  document.getElementById("confirm-delete-char-button").addEventListener("click", () => {
    savedCharacters = savedCharacters.filter(x => x.id !== id);
    // don't leave `character` pointing at something that no longer exists
    if (character && character.id === id) character = savedCharacters[0] || null;
    closeModal();
    renderSelectorScreen();
    showToast("Character deleted");
  });
  document.getElementById("cancel-delete-char-button").addEventListener("click", closeModal);
}


/* ============================================================
   CHARACTER CREATOR (POC — fake SRD-style content, faked list entry on confirm)
   ============================================================ */

const ALL_SKILLS = [
  { name: "Athletics", ability: "Strength" },
  { name: "Acrobatics", ability: "Dexterity" },
  { name: "Sleight of Hand", ability: "Dexterity" },
  { name: "Stealth", ability: "Dexterity" },
  { name: "Arcana", ability: "Intelligence" },
  { name: "History", ability: "Intelligence" },
  { name: "Investigation", ability: "Intelligence" },
  { name: "Nature", ability: "Intelligence" },
  { name: "Religion", ability: "Intelligence" },
  { name: "Animal Handling", ability: "Wisdom" },
  { name: "Insight", ability: "Wisdom" },
  { name: "Medicine", ability: "Wisdom" },
  { name: "Perception", ability: "Wisdom" },
  { name: "Survival", ability: "Wisdom" },
  { name: "Deception", ability: "Charisma" },
  { name: "Intimidation", ability: "Charisma" },
  { name: "Performance", ability: "Charisma" },
  { name: "Persuasion", ability: "Charisma" }
];
const ALL_SKILL_NAMES = ALL_SKILLS.map(s => s.name);

const SRD_RACES = [
  {
    name: "Human", subraces: null,
    features: [
      { name: "Ability Score Versatility", desc: "Humans adapt readily to any calling, gaining broad training over specialization." },
      { name: "Extra Language", desc: "You can speak, read, and write one additional language of your choice." }
    ],
    skillChoice: { count: 1, options: ALL_SKILL_NAMES }
  },
  {
    name: "Elf", subraces: [
      { name: "High Elf", features: [
        { name: "Elf Weapon Training", desc: "Proficiency with the longsword, shortsword, shortbow, and longbow." },
        { name: "Cantrip", desc: "You know one wizard cantrip of your choice." }
      ] },
      { name: "Wood Elf", features: [
        { name: "Elf Weapon Training", desc: "Proficiency with the longsword, shortsword, shortbow, and longbow." },
        { name: "Fleet of Foot", desc: "Your base walking speed increases to 35 feet." }
      ] }
    ],
    features: [
      { name: "Darkvision", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Fey Ancestry", desc: "You have advantage on saving throws against being charmed, and magic can't put you to sleep." },
      { name: "Trance", desc: "You don't need to sleep. Instead you meditate deeply for 4 hours a day." }
    ]
  },
  {
    name: "Dwarf", subraces: [
      { name: "Hill Dwarf", features: [
        { name: "Dwarven Toughness", desc: "Your hit point maximum increases by 1, and again whenever you gain a level." }
      ] },
      { name: "Mountain Dwarf", features: [
        { name: "Dwarven Armor Training", desc: "Proficiency with light and medium armor." }
      ] }
    ],
    features: [
      { name: "Darkvision", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Dwarven Resilience", desc: "You have advantage on saving throws against poison, and resistance to poison damage." },
      { name: "Stonecunning", desc: "You have expertise on checks related to the history of stonework." }
    ]
  },
  {
    name: "Halfling", subraces: [
      { name: "Lightfoot", features: [
        { name: "Naturally Stealthy", desc: "You can attempt to hide even when obscured only by a creature at least one size larger than you." }
      ] },
      { name: "Stout", features: [
        { name: "Stout Resilience", desc: "You have advantage on saving throws against poison, and resistance to poison damage." }
      ] }
    ],
    features: [
      { name: "Lucky", desc: "When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die." },
      { name: "Brave", desc: "You have advantage on saving throws against being frightened." },
      { name: "Halfling Nimbleness", desc: "You can move through the space of any creature that is a size larger than you." }
    ]
  }
];

const SRD_CLASSES = [
  {
    name: "Fighter", mainAbility: "Strength", hitDie: "d10",
    saves: ["Strength", "Constitution"],
    armorProf: "All armor, shields", weaponProf: "Simple and martial weapons",
    description: "A master of martial combat, skilled with a variety of weapons and armor.",
    features: [
      { name: "Fighting Style", desc: "You adopt a particular style of fighting as your specialty." },
      { name: "Second Wind", desc: "You can regain hit points as a bonus action once per short rest." },
      { name: "Action Surge", desc: "You can take one additional action on your turn, once per short rest." }
    ],
    skillChoices: { count: 2, options: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"] },
    subclasses: [
      { name: "Champion", features: [{ name: "Improved Critical", desc: "Your weapon attacks score a critical hit on a roll of 19 or 20." }] },
      { name: "Battle Master", features: [{ name: "Combat Superiority", desc: "You learn maneuvers fueled by superiority dice to enhance your attacks." }] }
    ]
  },
  {
    name: "Wizard", mainAbility: "Intelligence", hitDie: "d6",
    saves: ["Intelligence", "Wisdom"],
    armorProf: "None", weaponProf: "Daggers, darts, slings, quarterstaffs, light crossbows",
    description: "A scholarly magic-user capable of manipulating the structures of reality.",
    features: [
      { name: "Spellcasting", desc: "You cast wizard spells using Intelligence, prepared from your spellbook." },
      { name: "Arcane Recovery", desc: "Once per day, you can recover spell slots during a short rest." }
    ],
    skillChoices: { count: 2, options: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"] },
    subclasses: [
      { name: "School of Evocation", features: [{ name: "Sculpt Spells", desc: "You can create pockets of relative safety within your evocation spells." }] },
      { name: "School of Abjuration", features: [{ name: "Arcane Ward", desc: "A magical ward absorbs damage on your behalf." }] }
    ]
  },
  {
    name: "Rogue", mainAbility: "Dexterity", hitDie: "d8",
    saves: ["Dexterity", "Intelligence"],
    armorProf: "Light armor", weaponProf: "Simple weapons, hand crossbows, longswords, rapiers, shortswords",
    description: "A scoundrel who uses stealth and trickery to overcome obstacles and enemies.",
    features: [
      { name: "Expertise", desc: "Double your proficiency bonus for two skills you're proficient in." },
      { name: "Sneak Attack", desc: "Deal extra damage once per turn when you have advantage or an ally nearby." },
      { name: "Cunning Action", desc: "You can Dash, Disengage, or Hide as a bonus action." }
    ],
    skillChoices: { count: 4, options: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Performance", "Persuasion", "Sleight of Hand", "Stealth"] },
    subclasses: [
      { name: "Thief", features: [{ name: "Fast Hands", desc: "Use your bonus action for Sleight of Hand checks, disarming traps, or using items." }] },
      { name: "Assassin", features: [{ name: "Assassinate", desc: "You have advantage on attacks against creatures that haven't acted yet in combat." }] }
    ]
  },
  {
    name: "Cleric", mainAbility: "Wisdom", hitDie: "d8",
    saves: ["Wisdom", "Charisma"],
    armorProf: "Light and medium armor, shields", weaponProf: "Simple weapons",
    description: "A priestly champion who wields divine magic in service of a higher power.",
    features: [
      { name: "Spellcasting", desc: "You cast cleric spells using Wisdom, prepared from your available list." },
      { name: "Divine Domain", desc: "You choose a domain related to your deity, granting additional features." },
      { name: "Channel Divinity", desc: "You can channel divine energy to fuel magical effects." }
    ],
    skillChoices: { count: 2, options: ["History", "Insight", "Medicine", "Persuasion", "Religion"] },
    subclasses: [
      { name: "Life Domain", features: [{ name: "Disciple of Life", desc: "Your healing spells restore additional hit points." }] },
      { name: "Light Domain", features: [{ name: "Warding Flare", desc: "You can impose disadvantage on an attack roll against you." }] }
    ]
  }
];

const SRD_BACKGROUNDS = [
  { name: "Soldier", desc: "You had a military career, trained in combat and discipline.", skills: ["Athletics", "Intimidation"], feature: { name: "Military Rank", desc: "You have a military rank and command the respect of soldiers loyal to your former organization." } },
  { name: "Sage", desc: "You spent years learning the lore of the multiverse.", skills: ["Arcana", "History"], feature: { name: "Researcher", desc: "You know how or where to find information, even if you don't know it yourself." } },
  { name: "Criminal", desc: "You have a history of breaking the law and living on its edges.", skills: ["Deception", "Stealth"], feature: { name: "Criminal Contact", desc: "You have a reliable contact in the criminal underworld." } },
  { name: "Acolyte", desc: "You've spent your life in service to a temple.", skills: ["Insight", "Religion"], feature: { name: "Shelter of the Faithful", desc: "You command the respect of those who share your faith and can perform religious ceremonies." } }
];

const CREATOR_ABILITY_ORDER = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_LIMIT = 27;
const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

let creatorState = null;

function openCharacterCreator() {
  creatorState = {
    step: 0, name: "", appearance: "", backstory: "",
    race: null, subrace: null, charClass: null, subclass: null, background: null,
    scores: {}, asiBonus: { plus2: null, plus1: null },
    raceSkillChoices: [], classSkillChoices: [],
    customBuild: false
  };
  openModal("full", "");
  redrawCreator();
}

function redrawCreator() {
  const box = document.querySelector("#modal-overlay .modal-content");
  box.innerHTML = creatorStepHtml();
  wireCreatorStep();
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
  return `<div class="trait-item" style="border-top:1px solid #332C24;padding:8px 0;">
    <div class="trait-name">${f.name}</div>
    <div class="trait-desc">${f.desc}</div>
  </div>`;
}

function optionButtonHtml(label, active, dataAttr, value) {
  return `<button class="toggle-btn creator-option ${active ? "active" : ""}" data-${dataAttr}="${value}" style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px 14px;">${esc(label)}</button>`;
}

function creatorStepKeys() {
  const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);
  const keys = ["race", "class"];
  if (cls && cls.subclasses && cls.subclasses.length) keys.push("subclass");
  keys.push("background", "ability", "skills", "final");
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
    ` : ""}
    <button class="btn-primary" id="creator-next-button" style="margin-top:14px;">Next</button>
  `;
}

function wireRaceStep() {
  document.querySelectorAll("[data-race-option]").forEach(btn => {
    btn.addEventListener("click", () => {
      creatorState.race = btn.dataset.raceOption;
      creatorState.subrace = null;
      creatorState.raceSkillChoices = [];
      redrawCreator();
    });
  });
  document.querySelectorAll("[data-subrace-option]").forEach(btn => {
    btn.addEventListener("click", () => { creatorState.subrace = btn.dataset.subraceOption; redrawCreator(); });
  });
  document.getElementById("creator-next-button").addEventListener("click", () => {
    if (!creatorState.race) { showToast("Choose a race to continue"); return; }
    const race = SRD_RACES.find(r => r.name === creatorState.race);
    if (race.subraces && !creatorState.subrace) { showToast("Choose a subrace to continue"); return; }
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
      <div class="breakdown-subhead">Class Features</div>
      ${cls.features.map(featureRowHtml).join("")}
    ` : ""}
    <div class="btn-row-2" style="margin-top:14px;">
      <button class="btn-secondary" id="creator-back-button">Back</button>
      <button class="btn-primary" id="creator-next-button">Next</button>
    </div>
  `;
}

function wireClassStep() {
  document.querySelectorAll("[data-class-option]").forEach(btn => {
    btn.addEventListener("click", () => {
      creatorState.charClass = btn.dataset.classOption;
      creatorState.subclass = null;
      creatorState.classSkillChoices = [];
      redrawCreator();
    });
  });
  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-next-button").addEventListener("click", () => {
    if (!creatorState.charClass) { showToast("Choose a class to continue"); return; }
    goNext();
  });
}


/* ---------- step: subclass ---------- */

function subclassStepHtml(stepNum, totalSteps) {
  const cls = SRD_CLASSES.find(c => c.name === creatorState.charClass);
  return `
    <div class="modal-heading">New Character</div>
    <div class="breakdown-source">Step ${stepNum} of ${totalSteps} \u00B7 Subclass</div>
    <div style="margin-top:10px;">
      ${cls.subclasses.map(sc => optionButtonHtml(sc.name, creatorState.subclass === sc.name, "subclass-option", sc.name)).join("")}
    </div>
    ${creatorState.subclass ? `
      <div class="breakdown-subhead">Subclass Features</div>
      ${cls.subclasses.find(sc => sc.name === creatorState.subclass).features.map(featureRowHtml).join("")}
    ` : ""}
    <div class="btn-row-2" style="margin-top:14px;">
      <button class="btn-secondary" id="creator-back-button">Back</button>
      <button class="btn-primary" id="creator-next-button">Next</button>
    </div>
  `;
}

function wireSubclassStep() {
  document.querySelectorAll("[data-subclass-option]").forEach(btn => {
    btn.addEventListener("click", () => { creatorState.subclass = btn.dataset.subclassOption; redrawCreator(); });
  });
  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-next-button").addEventListener("click", () => {
    if (!creatorState.subclass) { showToast("Choose a subclass to continue"); return; }
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
    <div class="btn-row-2" style="margin-top:14px;">
      <button class="btn-secondary" id="creator-back-button">Back</button>
      <button class="btn-primary" id="creator-next-button">Next</button>
    </div>
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
    ${exceeds ? `<div class="item-effect" style="color:#F0908A;margin-bottom:10px;">\u26A0 Exceeds standard point-buy limits \u2014 will be marked custom / not legal.</div>` : ""}
    ${CREATOR_ABILITY_ORDER.map(a => {
      const isMain = cls && cls.mainAbility === a;
      return `
      <div class="field-row" style="align-items:center;">
        <div class="field" style="flex:0 0 118px;"><label>${isMain ? "\u2605 " : ""}${a}</label></div>
        <div class="mini-stepper" style="justify-content:flex-start;">
          <button data-as-minus="${a}">\u2212</button><span>${finalScoreFor(a)}</span><button data-as-plus="${a}">+</button>
        </div>
        <label style="font-size:11px;color:#9C9186;display:flex;align-items:center;gap:3px;margin-left:12px;">
          <input type="checkbox" data-bonus2="${a}" ${creatorState.asiBonus.plus2 === a ? "checked" : ""}> +2
        </label>
        <label style="font-size:11px;color:#9C9186;display:flex;align-items:center;gap:3px;margin-left:8px;">
          <input type="checkbox" data-bonus1="${a}" ${creatorState.asiBonus.plus1 === a ? "checked" : ""}> +1
        </label>
      </div>`;
    }).join("")}
    <div class="btn-row-2" style="margin-top:10px;">
      <button class="btn-secondary" id="ability-clear-button">Clear</button>
      <button class="btn-secondary" id="ability-recommended-button">Use Recommended</button>
    </div>
    <div class="breakdown-subhead" style="margin-top:16px;">Skill Proficiencies</div>
    <div class="trait-desc" style="margin-bottom:10px;">${bg ? bg.skills.join(", ") : "None yet"} from background. Race and class skills are chosen next.</div>
    <div class="btn-row-2" style="margin-top:10px;">
      <button class="btn-secondary" id="creator-back-button">Back</button>
      <button class="btn-primary" id="creator-next-button">Next</button>
    </div>
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
      ${raceChoice ? `<span style="font-size:11px;color:#9C9186;width:44px;text-align:center;">Race<br>${creatorState.raceSkillChoices.length}/${raceChoice.count}</span>` : ""}
      ${cls ? `<span style="font-size:11px;color:#9C9186;width:44px;text-align:center;">Class<br>${creatorState.classSkillChoices.length}/${cls.skillChoices.count}</span>` : ""}
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
        raceSlot = `<span style="display:inline-block;width:44px;text-align:center;"><span class="res-tag" style="background:#2E2820;color:#F5C37A;">BG</span></span>`;
      } else {
        if (raceChoice && raceChoice.options.includes(s.name)) {
          const disabled = !isRace && creatorState.raceSkillChoices.length >= raceChoice.count;
          raceSlot = `<span style="display:inline-block;width:44px;text-align:center;"><input type="checkbox" data-race-skill="${esc(s.name)}" ${isRace ? "checked" : ""} ${disabled ? "disabled" : ""}></span>`;
        }
        if (cls && cls.skillChoices.options.includes(s.name)) {
          const disabled = !isClass && creatorState.classSkillChoices.length >= cls.skillChoices.count;
          classSlot = `<span style="display:inline-block;width:44px;text-align:center;"><input type="checkbox" data-class-skill="${esc(s.name)}" ${isClass ? "checked" : ""} ${disabled ? "disabled" : ""}></span>`;
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
    <div class="btn-row-2" style="margin-top:14px;">
      <button class="btn-secondary" id="creator-back-button">Back</button>
      <button class="btn-primary" id="creator-next-button">Next</button>
    </div>
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

  const traits = {
    "Race Traits": (race ? race.features : []).concat(subrace ? subrace.features : [])
      .map(f => ({ name: f.name, desc: f.desc })),
    "Class Features": (cls ? cls.features : []).concat(subclass ? subclass.features : [])
      .map(f => ({ name: f.name, desc: f.desc })),
    "Background Features": background ? [{ name: background.feature.name, desc: background.feature.desc }] : [],
    "Feats": [],
    "Proficiencies": cls ? [
      { name: "Armor", desc: cls.armorProf },
      { name: "Weapons", desc: cls.weaponProf }
    ] : [],
    "Languages": [{ name: "Common", desc: "" }]
  };

  // a first-level character has one hit die and takes its maximum for HP
  const hitDieSize = cls ? parseInt(cls.hitDie.replace("d", "")) : 8;
  const constitution = abilityModifier(abilities.CON);

  const weaponProficiencies = parseWeaponProficiencies(cls ? cls.weaponProf : "");

  return {
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
    savingThrowProficiency,
    savingThrowOverride: {},
    skillProficiency,
    skillOverride: {},
    skillAbilityMap: JSON.parse(JSON.stringify(SKILL_ABILITY_MAP)),

    traits,
    inventory: [],
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
}


/* ---------- step: name / appearance / backstory ---------- */

function finalStepHtml(stepNum, totalSteps) {
  return `
    <div class="modal-heading">New Character</div>
    <div class="breakdown-source">Step ${stepNum} of ${totalSteps} \u00B7 Name & Details</div>
    <div class="field" style="margin-top:14px;">
      <label>Character Name</label>
      <input id="creator-name-input" type="text" value="${esc(creatorState.name)}" placeholder="e.g. Sigrid of Chester">
    </div>
    <div class="field">
      <label>Appearance (optional)</label>
      <input id="creator-appearance-input" type="text" value="${esc(creatorState.appearance)}" placeholder="Brief physical description">
    </div>
    <div class="field">
      <label>Backstory (optional)</label>
      <input id="creator-backstory-input" type="text" value="${esc(creatorState.backstory)}" placeholder="A line or two of history">
    </div>
    <div class="btn-row-2" style="margin-top:10px;">
      <button class="btn-secondary" id="creator-back-button">Back</button>
      <button class="btn-primary" id="creator-confirm-button">Create Character</button>
    </div>
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
  return wireFinalStep();
}



/* ============================================================
   PARTY FINDER (POC — fake discovery, no real networking)
   ============================================================ */

const FAKE_PARTIES = [
  {
    name: "The Rusty Blades", gm: "Mara",
    members: [
      { name: "Borin Ashfall" },
      { name: "Kira Dawnstrike" },
      { name: "Thistle Nix" }
    ]
  },
  {
    name: "Ashenvale Company", gm: "Tom\u00e1s",
    members: [
      { name: "Corvin Blackwood" },
      { name: "Wren Ashby" },
      { name: "Petra Voss" },
      { name: "Odalys Marrow" },
      { name: "Finch Talbot" }
    ]
  },
  {
    name: "Order of the Ember", gm: null,
    members: [
      { name: "Vex Emberhand", owner: true },
      { name: "Nyla Stormcaller" }
    ]
  }
];

let party = { status: "none", name: null, gm: null, code: null, members: [] };
let partyModalScreen = "landing";
let partyConnectingTo = null;

function openPartyFinder() {
  partyModalScreen = "landing";
  openModal("sheet", "");
  redrawPartyModal();
}

function redrawPartyModal() {
  const box = document.querySelector("#modal-overlay .modal-content");
  if (!box) return;
  box.innerHTML = partyModalHtml();
  wirePartyModal();
}

function partyModalHtml() {
  if (partyModalScreen === "landing") {
    if (party.status !== "none") {
      return `
        <div class="modal-heading">Party</div>
        <div class="res-row">
          <div>
            <div class="res-name">${esc(party.name)}</div>
            <div class="atk-range">${party.status === "hosting" ? `Hosting \u00B7 Code ${party.code}` : (party.gm ? `Connected \u00B7 GM ${party.gm}` : "Connected \u00B7 No GM")}</div>
          </div>
        </div>
        <div class="breakdown-subhead">Members</div>
        ${party.members.map(m => `
          <div class="member-row">
            <span>${esc(m.name)}</span>
            ${m.owner ? `<span class="res-tag" style="background:#E8843A;color:#1a0f00;">OWNER</span>` : ""}
          </div>
        `).join("")}
        <button class="btn-primary" id="leave-party-button" style="background:#5A2C29;color:#F0908A;margin-top:10px;">${party.status === "hosting" ? "Stop Hosting" : "Leave Party"}</button>
        <button class="btn-secondary" id="party-done-button">Done</button>
      `;
    }
    return `
      <div class="modal-heading">Party</div>
      <div class="breakdown-source" style="margin-bottom:14px;">Connect with your table.</div>
      <button class="btn-primary" id="join-party-button" style="margin-bottom:8px;">Join a Party</button>
      <button class="btn-secondary" id="host-party-button">Host a Party</button>
    `;
  }

  if (partyModalScreen === "searching") {
    return `
      <div class="modal-heading">Join a Party</div>
      <div class="empty-hint" style="padding:50px 20px;">Searching for parties on your network\u2026</div>
    `;
  }

  if (partyModalScreen === "join-list") {
    return `
      <div class="modal-heading">Join a Party</div>
      <div class="breakdown-source" style="margin-bottom:10px;">${FAKE_PARTIES.length} parties found nearby</div>
      ${FAKE_PARTIES.map(p => `
        <div class="res-row" data-join-party="${esc(p.name)}" style="cursor:pointer;">
          <div>
            <div class="res-name">${esc(p.name)}</div>
            <div class="atk-range">${p.gm ? `GM ${p.gm} \u00B7 ` : ""}${p.members.length} player${p.members.length === 1 ? "" : "s"}</div>
          </div>
          <span class="add-link">Join</span>
        </div>
      `).join("")}
      <button class="btn-secondary" id="party-back-button" style="margin-top:6px;">Back</button>
    `;
  }

  if (partyModalScreen === "connecting") {
    return `
      <div class="modal-heading">Join a Party</div>
      <div class="empty-hint" style="padding:50px 20px;">Connecting to ${esc(partyConnectingTo.name)}\u2026</div>
    `;
  }

  // host-form
  return `
    <div class="modal-heading">Host a Party</div>
    <div class="field" style="margin-top:10px;">
      <label>Party Name</label>
      <input id="host-party-name-input" type="text" placeholder="e.g. The Rusty Blades">
    </div>
    <button class="btn-primary" id="start-hosting-button">Start Hosting</button>
    <button class="btn-secondary" id="party-back-button">Back</button>
  `;
}

function wirePartyModal() {
  if (partyModalScreen === "landing") {
    if (party.status !== "none") {
      document.getElementById("leave-party-button").addEventListener("click", () => {
        party = { status: "none", name: null, gm: null, code: null, members: [] };
        renderSelectorScreen();
        redrawPartyModal();
        showToast("Left the party");
      });
      document.getElementById("party-done-button").addEventListener("click", closeModal);
      return;
    }
    document.getElementById("join-party-button").addEventListener("click", () => {
      partyModalScreen = "searching";
      redrawPartyModal();
      setTimeout(() => {
        if (partyModalScreen === "searching") { partyModalScreen = "join-list"; redrawPartyModal(); }
      }, 1100);
    });
    document.getElementById("host-party-button").addEventListener("click", () => {
      partyModalScreen = "host-form";
      redrawPartyModal();
    });
    return;
  }

  if (partyModalScreen === "join-list") {
    document.querySelectorAll("[data-join-party]").forEach(row => {
      row.addEventListener("click", () => {
        partyConnectingTo = FAKE_PARTIES.find(p => p.name === row.dataset.joinParty);
        partyModalScreen = "connecting";
        redrawPartyModal();
        setTimeout(() => {
          party = { status: "connected", name: partyConnectingTo.name, gm: partyConnectingTo.gm, code: null, members: partyConnectingTo.members };
          partyModalScreen = "landing";
          renderSelectorScreen();
          redrawPartyModal();
          showToast("Connected to " + party.name);
        }, 1200);
      });
    });
    document.getElementById("party-back-button").addEventListener("click", () => {
      partyModalScreen = "landing"; redrawPartyModal();
    });
    return;
  }

  if (partyModalScreen === "host-form") {
    document.getElementById("start-hosting-button").addEventListener("click", () => {
      const name = document.getElementById("host-party-name-input").value.trim();
      if (!name) { showToast("Enter a party name"); return; }
      party = { status: "hosting", name, gm: null, code: String(Math.floor(1000 + Math.random() * 9000)), members: [{ name: character.name, owner: true }] };
      partyModalScreen = "landing";
      renderSelectorScreen();
      redrawPartyModal();
      showToast("Hosting started");
    });
    document.getElementById("party-back-button").addEventListener("click", () => {
      partyModalScreen = "landing"; redrawPartyModal();
    });
    return;
  }
}


/* ============================================================
   APP MENU + RESTS
   ============================================================ */

/* A rest is the only thing that reads the recharge vocabulary ("SR"/"LR") that
   resources and spell slots both use, and the duration types on active effects.
   Everything it touches was already stored and previously inert.

   Deliberately NOT handled here:
     - Pact Magic (SR slots in a separate pool -- needs a data model change)
     - Exhaustion (a long rest drops it one level, but it's a bare label today
       with no level attached)
     - Hit dice spending, which is a player choice rather than part of the
       automatic sweep. Spend them from the Hit Dice rows on the Combat tab. */

/* Anything with a { recharge, current, max } shape restores the same way --
   resources, spell slots and hit dice all go through here. `amount` is what
   makes hit dice expressible: they return half on a long rest, which the old
   single-string tag could only fake in its label. */
function restoredValue(entry, ceiling) {
  const amount = entry.recharge && entry.recharge.amount !== undefined ? entry.recharge.amount : "all";
  // a ceiling of zero means uncapped, so "all" has no target to restore to and
  // must not be read as "set to zero"
  const uncapped = !ceiling;
  const cap = value => (uncapped ? value : Math.min(ceiling, value));

  if (amount === "all") return uncapped ? entry.current : ceiling;
  if (amount === "half") return cap(entry.current + Math.max(1, Math.floor((ceiling || 0) / 2)));
  if (typeof amount === "number") return cap(entry.current + amount);
  return cap(entry.current + rollNotation(String(amount)).total);
}

function restoreOnRest(entry, isLong) {
  const on = entry.recharge && entry.recharge.on;
  if (on !== "SR" && on !== "LR") return false;         // custom and "none" never auto-restore
  if (on === "LR" && !isLong) return false;
  const ceiling = entry.max !== undefined ? entry.max : entry.total;
  const before = entry.current;
  entry.current = restoredValue(entry, ceiling);
  return entry.current !== before;
}

function plural(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

function applyRest(kind, diceSpend) {
  const isLong = kind === "long";
  const summary = [];

  // hit dice are spent as part of a short rest, before anything else, so the
  // healing lands before we report on it
  if (diceSpend) {
    const spent = spendHitDice(diceSpend);
    if (spent.dice) summary.push(plural(spent.dice, "hit die").replace("dies", "dice") + " for " + spent.healed + " HP");
  }

  let resources = character.resources.filter(r => restoreOnRest(r, isLong)).length;
  // items tracked as resources recharge through the same rule, writing back
  // to the quantity that is their count
  character.inventory.forEach(item => {
    if (!item.resource) return;
    const shim = { recharge: item.resource.recharge, current: item.qty || 0, max: item.resource.max };
    if (restoreOnRest(shim, isLong)) { item.qty = shim.current; resources++; }
  });
  if (resources) summary.push(plural(resources, "resource"));

  const slots = Object.keys(character.spellSlots)
    .filter(lvl => restoreOnRest(character.spellSlots[lvl], isLong)).length;
  if (slots) summary.push(plural(slots, "slot level"));

  // an hour has passed, so round-durations are gone either way
  const before = character.activeEffects.length;
  character.activeEffects = character.activeEffects.filter(e => {
    const type = e.duration.type;
    if (type === "Rounds" || type === "Short Rest") return false;
    if (type === "Long Rest") return !isLong;
    return true;                                          // Permanent
  });
  // resting breaks concentration, which ends anything it was holding up
  const stillConcentrating = concentrationGroups(character).length;
  if (stillConcentrating) character.activeEffects = character.activeEffects.filter(g => !g.concentration);

  const cleared = before - character.activeEffects.length;
  if (cleared) summary.push(plural(cleared, "effect") + " cleared");
  if (stillConcentrating) summary.push("concentration broken");

  // hit dice recharge through the same rule as everything else
  let diceRegained = 0;
  calculateHitDice(character).forEach(pool => {
    const before = pool.current;
    if (restoreOnRest(pool, isLong)) {
      const regained = pool.current - before;
      spendHitDieOfSize(character, pool.die, -regained);
      diceRegained += regained;
    }
  });
  if (diceRegained) summary.push(plural(diceRegained, "hit die").replace("dies", "dice"));

  if (isLong) {
    // a long rest removes one level of exhaustion
    const exhaustion = exhaustionLevel(character);
    if (exhaustion > 0) {
      setExhaustionLevel(character, exhaustion - 1);
      summary.push(exhaustion - 1 === 0 ? "exhaustion gone" : "exhaustion down to " + (exhaustion - 1));
    }

    const maxHP = calculateMaxHP(character);
    if (character.hp.current !== maxHP.total) summary.push("HP restored");
    // this writes hit points directly rather than going through applyHp, so
    // the death save tracks have to be cleared here too
    if (character.hp.current <= 0) { resetDeathSaves(character); summary.push("back on your feet"); }
    character.hp.current = maxHP.total;
    character.hp.temp = 0;                                // temp HP ends on a long rest
  }

  closeModal();
  renderContent();
  showToast((isLong ? "Long rest" : "Short rest") + " · " + (summary.join(" · ") || "nothing to restore"));
}

// Items marked data-stub are deliberate placeholders -- the drawer is the home
// for app-level actions, and these mark out the shape of it before the features
// behind them exist.
const MENU_STUBS = [
  { label: "Party", hint: "Not connected" },
  { label: "Options", hint: "" },
  { label: "Export Character", hint: "" },
  { label: "Dice History", hint: "" },
  { label: "Help & Rules", hint: "" }
];

function openShortRestModal() {
  const pools = calculateHitDice(character);
  const spend = pools.map(() => 0);
  const conMod = abilityModifier(effectiveAbilityScore(character, "CON"));

  openModal("sheet", `
    <div class="modal-heading">Short Rest</div>
    ${pools.length ? `
      <div class="breakdown-source">Spend hit dice to heal — each rolls its die ${formatModifier(conMod)} (your Constitution modifier).</div>
      ${hitDiceRowsHtml("rest")}
    ` : `<div class="empty-hint">No hit dice on this sheet.</div>`}
    <div class="menu-note">Restores anything tagged SR, clears short-term effects, and breaks concentration.</div>
    <button class="btn-primary" id="confirm-short-rest">Take Short Rest</button>
  `);

  pools.forEach((pool, index) => {
    const valueEl = document.querySelector(`[data-rest-die-value="${index}"]`);
    const set = next => { spend[index] = Math.max(0, Math.min(pool.current, next)); valueEl.textContent = spend[index]; };
    document.querySelector(`[data-rest-die-minus="${index}"]`).addEventListener("click", () => set(spend[index] - 1));
    document.querySelector(`[data-rest-die-plus="${index}"]`).addEventListener("click", () => set(spend[index] + 1));
  });

  document.getElementById("confirm-short-rest").addEventListener("click", () => applyRest("short", spend));
}

function openLongRestModal() {
  openModal("center", `
    <div class="modal-heading">Take a Long Rest?</div>
    <div class="menu-note" style="margin-top:0;">
      Restores all hit points, every SR and LR resource, all spell slots, and half your spent hit dice.
      Clears temporary hit points, breaks concentration, and ends anything lasting until a short or long rest.
    </div>
    <button class="btn-primary" id="confirm-long-rest" style="margin-top:16px;">Take Long Rest</button>
    <button class="btn-secondary" id="cancel-long-rest">Cancel</button>
  `);
  document.getElementById("confirm-long-rest").addEventListener("click", () => applyRest("long"));
  document.getElementById("cancel-long-rest").addEventListener("click", closeModal);
}

/* ---------------- levels ---------------- */

/* Levelling adds a level to an existing class or opens a new one. Everything
   downstream -- proficiency bonus, hit dice, the line under the name -- is
   derived from the class list, so this only has to touch the list itself.

   What it deliberately does NOT do is grant the features of the new level.
   Those live in SRD_CLASSES keyed by class, not by level, so there's nothing
   to look up yet. The modal says so rather than pretending. */
function openLevelUpModal() {
  const classes = character.classes || [];
  const level = totalLevel(character);
  const known = classes.map(entry => entry.name);
  const available = SRD_CLASSES.filter(cls => !known.includes(cls.name)).map(cls => cls.name);

  openModal("sheet", `
    <div class="modal-heading">Level Up</div>
    <div class="breakdown-source">Currently level ${level} — proficiency bonus ${formatModifier(proficiencyBonusForLevel(level))}.
      At ${level + 1} it becomes ${formatModifier(proficiencyBonusForLevel(level + 1))}.</div>

    <div class="breakdown-subhead">Advance a class</div>
    ${classes.map((entry, index) => `
      <div class="res-row" data-level-class="${index}" style="cursor:pointer;">
        <div>
          <div class="res-name">${esc(entry.name)}${entry.subclass ? " (" + esc(entry.subclass) + ")" : ""}</div>
          <div class="atk-range">Level ${entry.level} → ${entry.level + 1} · ${esc(entry.hitDie)}</div>
        </div>
        <span class="add-link">+1</span>
      </div>
    `).join("")}

    ${available.length ? `
      <div class="breakdown-subhead">Or take a level in something new</div>
      ${comboFieldHtml("levelup-new-class", "Class", "e.g. " + available[0])}
      <button class="btn-secondary" id="levelup-multiclass">Add at level 1</button>
    ` : ""}

    <div class="menu-note">Hit dice and proficiency bonus update on their own. Features for the new level aren't granted — add them under Features &amp; Traits.</div>
  `);

  wireCombo("levelup-new-class", available);

  document.querySelectorAll("[data-level-class]").forEach(row => {
    row.addEventListener("click", () => {
      const entry = character.classes[parseInt(row.dataset.levelClass)];
      entry.level += 1;
      closeModal();
      renderContent();
      renderSheetHeader();
      showToast(entry.name + " " + entry.level + " — level " + totalLevel(character));
    });
  });

  const multiclass = document.getElementById("levelup-multiclass");
  if (multiclass) multiclass.addEventListener("click", () => {
    const name = document.getElementById("levelup-new-class").value.trim();
    if (!name) { showToast("Pick a class"); return; }
    if (known.some(existing => existing.toLowerCase() === name.toLowerCase())) {
      showToast("You already have levels in " + name);
      return;
    }
    const srd = SRD_CLASSES.find(cls => cls.name.toLowerCase() === name.toLowerCase());
    character.classes.push({ name: srd ? srd.name : name, level: 1, subclass: null, hitDie: srd ? srd.hitDie : "d8" });
    closeModal();
    renderContent();
    renderSheetHeader();
    showToast("Took a level in " + name);
  });
}

function openAppMenu() {
  openModal("drawer", `
    <div class="modal-heading">Campfire</div>

    <div class="drawer-section">Rest</div>
    <button class="drawer-item" id="menu-short-rest">Short Rest<span class="drawer-hint">1 hour</span></button>
    <button class="drawer-item" id="menu-long-rest">Long Rest<span class="drawer-hint">8 hours</span></button>

    <div class="drawer-section">App</div>
    ${MENU_STUBS.map(item => `
      <button class="drawer-item" data-stub="${esc(item.label)}">${esc(item.label)}<span class="drawer-hint">${item.hint}</span></button>
    `).join("")}

    <div class="drawer-section">Character</div>
    <button class="drawer-item" id="menu-level-up">Level Up<span class="drawer-hint">level ${totalLevel(character)}</span></button>

    <div class="drawer-section">Development</div>
    <button class="drawer-item" id="menu-reset-demo">Reset to Demo Character<span class="drawer-hint">clears saved data</span></button>
  `);
  document.getElementById("menu-short-rest").addEventListener("click", openShortRestModal);
  document.getElementById("menu-long-rest").addEventListener("click", openLongRestModal);
  document.querySelectorAll("[data-stub]").forEach(button => {
    button.addEventListener("click", () => { closeModal(); showToast(button.dataset.stub + " isn't built yet"); });
  });
  document.getElementById("menu-reset-demo").addEventListener("click", confirmResetToDemo);
  document.getElementById("menu-level-up").addEventListener("click", openLevelUpModal);
}

// development aid: persistence means the demo character keeps whatever state
// you left it in, which is unhelpful while iterating on the sheet itself
function confirmResetToDemo() {
  openModal("center", `
    <div class="modal-heading">Reset to the demo character?</div>
    <div class="menu-note" style="margin-top:0;">
      Deletes every saved character and reloads the page with Sigrid as she ships. There's no undo.
    </div>
    <button class="btn-primary" id="confirm-reset" style="background:#5A2C29;color:#F0908A;margin-top:16px;">Delete everything and reset</button>
    <button class="btn-secondary" id="cancel-reset">Cancel</button>
  `);
  document.getElementById("confirm-reset").addEventListener("click", () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* nothing to clear */ }
    location.reload();
  });
  document.getElementById("cancel-reset").addEventListener("click", closeModal);
}


/* ============================================================
   TAB SWITCHING
   ============================================================ */

let activeTab = "combat";
const tabButtons = document.querySelectorAll(".tab-item");
tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab;
    updateActiveTabStyling();
    renderContent();
  });
});
function updateActiveTabStyling() {
  tabButtons.forEach(button => button.classList.toggle("active", button.dataset.tab === activeTab));
}

document.getElementById("back-to-selector").addEventListener("click", () => showScreen("selector"));
document.getElementById("char-name-row").addEventListener("click", openCharacterEditorModal);
document.getElementById("app-menu-button").addEventListener("click", openAppMenu);

function renderContent() {
  const content = document.getElementById("content");
  if (activeTab === "combat") { content.innerHTML = renderCombatTab(); wireCombatTab(); }
  else if (activeTab === "character") { content.innerHTML = renderCharacterTab(); wireCharacterTab(); }
  else if (activeTab === "inventory") { content.innerHTML = renderInventoryTab(); wireInventoryTab(); }
  else if (activeTab === "spells") { content.innerHTML = renderSpellsTab(); wireSpellsTab(); }
  else if (activeTab === "notes") { content.innerHTML = renderNotesTab(); wireNotesTab(); }
  else { content.innerHTML = "<p>" + activeTab + " tab coming soon</p>"; }

  // every mutation in the app ends in a re-render, so saving here catches all
  // of them without hunting individual call sites
  persistCharacters();
}


/* ============================================================
   COMBAT TAB
   ============================================================ */

/* Spell slots live only in character.spellSlots. The Combat tab renders them
   as resource rows and the Spells tab renders them per level -- both read and
   write the same object, so the two views can't disagree. */

function spellSlotLevels() {
  if (!character.spellcasting || !character.spellcasting.classes.length) return [];
  return Object.keys(character.spellSlots).map(n => parseInt(n)).sort((a, b) => a - b);
}

function slotRowName(level) {
  return "Spell Slots (" + levelLabel(level).replace(" Level", "") + ")";
}

// only appears at 0 hit points, so it isn't clutter the rest of the time
function deathSaveCardHtml() {
  const state = deathSaveState(character);
  if (character.hp.current > 0 && !state.dead) return "";

  const status = state.dead ? "Dead"
    : state.stable ? "Stable"
    : "Dying";

  return `
    <div class="death-card ${state.dead ? "dead" : state.stable ? "stable" : ""}">
      <div class="death-head">
        <span class="death-title">Death Saves</span>
        <span class="death-status">${status}</span>
      </div>
      <div class="death-track">
        <span class="death-label">Successes</span>
        <span class="death-pips">${deathSaveTrackHtml(state.successes, 3, "success")}</span>
      </div>
      <div class="death-track">
        <span class="death-label">Failures</span>
        <span class="death-pips">${deathSaveTrackHtml(state.failures, 3, "failure")}</span>
      </div>
      ${state.dying ? `<button class="btn-primary" id="roll-death-save" style="margin-top:12px;">Roll Death Save</button>` : ""}
      ${state.dead || state.stable ? `<button class="btn-secondary" id="clear-death-saves">Clear</button>` : ""}
    </div>`;
}

function renderCombatTab() {
  const ac = calculateAC(character);
  const maxHP = calculateMaxHP(character);
  const initiative = calculateInitiative(character);
  const speed = calculateSpeed(character);
  const passivePerception = calculatePassivePerception(character);
  const profBonus = calculateProficiencyBonus(character);
  /* The track always represents max HP, so the red fill never moves when temp
     HP comes or goes. Temp draws as a shield layer over the left of the bar,
     sized against max and capped at full width -- visible at any HP level,
     including full, which is where the earlier versions broke. */
  const hpPercent = maxHP.total > 0 ? Math.max(0, Math.min(100, (character.hp.current / maxHP.total) * 100)) : 0;
  const tempPercent = maxHP.total > 0 ? Math.min(100, (character.hp.temp / maxHP.total) * 100) : 0;

  return `
    <div class="hp-card" id="hp-card">
      <div class="hp-label">Hit Points${character.hp.temp ? `<span class="hp-temp">+${character.hp.temp} temp</span>` : ""}</div>
      <div class="hp-bar-track">
        <div class="hp-bar-fill" style="width: ${hpPercent}%"></div>
        ${character.hp.temp ? `<div class="hp-bar-temp" style="width: ${tempPercent}%"></div>` : ""}
        <div class="hp-bar-text">${character.hp.current} / ${maxHP.total}</div>
      </div>
    </div>

    ${deathSaveCardHtml()}

    <div class="stat-grid" style="margin-top:16px;">
      <div class="stat-box" id="ac-box"><div class="stat-label">AC</div><div class="stat-value">${ac.total}</div></div>
      <div class="stat-box" id="initiative-box"><div class="stat-label">Initiative</div><div class="stat-value">${formatModifier(initiative.total)}</div></div>
      <div class="stat-box" id="speed-box"><div class="stat-label">Speed</div><div class="stat-value">${speed.total} ft</div></div>
    </div>

    <div class="stat-grid" style="margin-top:8px;">
      <div class="stat-box" id="passive-perception-box"><div class="stat-label">Passive Perception</div><div class="stat-value">${passivePerception.total}</div></div>
      <div class="stat-box" id="prof-bonus-box"><div class="stat-label">Prof Bonus</div><div class="stat-value">${formatModifier(profBonus.total)}</div></div>
      <div class="stat-box">
        <div class="stat-label">Inspiration</div>
        <div class="mini-stepper"><button id="insp-minus">\u2212</button><span>${character.inspiration.current}</span><button id="insp-plus">+</button></div>
      </div>
    </div>

    <div class="section-head-row">
      <div class="section-head">Conditions</div>
      <button class="add-link" id="add-effect-button">+ Add</button>
    </div>
    <div class="chip-row">
      ${character.activeEffects.map(group => `
        <div class="chip" data-effect-view="${group.id}">${group.concentration ? `<span class="conc-mark" title="Concentration">\u25C8</span>` : ""}${esc(effectGroupLabel(group))}<button class="chip-remove" data-effect-remove="${group.id}">\u2715</button></div>
      `).join("") || `<div class="empty-hint">Nothing active</div>`}
    </div>

    ${concentrationGroups(character).length ? `
      <div class="conc-row">
        <span>Concentrating \u00B7 ${esc(concentrationGroups(character).map(g => effectGroupLabel(g)).join(", "))}</span>
        <button class="toggle-btn" id="concentration-drop">Drop</button>
      </div>
    ` : ""}

    <div class="section-head-row">
      <div class="section-head">Resources</div>
      <button class="add-link" id="add-resource-button">+ Add</button>
    </div>
    ${spellSlotLevels().map(lvl => {
      const slot = character.spellSlots[lvl];
      return `
      <div class="res-row">
        <div class="res-name-wrap" data-slot-view="${lvl}"><span class="res-name">${slotRowName(lvl)}</span><span class="res-tag">${esc(rechargeLabel(slot.recharge))}</span></div>
        <div class="stepper"><button data-slot-minus="${lvl}">\u2212</button><span class="res-count">${slot.current}/${slot.max}</span><button data-slot-plus="${lvl}">+</button></div>
      </div>
    `;
    }).join("")}
    ${resourceRows(character).map(row => `
      <div class="res-row">
        <div class="res-name-wrap" data-resource-view="${esc(row.key)}">
          <span class="res-name">${esc(row.name)}</span>
          ${rechargeLabel(row.recharge) === "\u2014" ? "" : `<span class="res-tag">${esc(rechargeLabel(row.recharge))}</span>`}
          ${row.container ? `<span class="res-tag" title="Refills from ${esc(row.refillFrom)}">HOLDS ${esc(row.refillFrom)}</span>` : ""}
        </div>
        <div class="stepper">
          ${row.container ? `<button class="atk-pill" data-res-refill="${esc(row.key)}">Refill</button>` : ""}
          <button data-res-minus="${esc(row.key)}">\u2212</button>
          <span class="res-count">${row.max ? row.current + "/" + row.max : row.current}</span>
          <button data-res-plus="${esc(row.key)}">+</button>
        </div>
      </div>
    `).join("")}

    <div class="section-head-row">
      <div class="section-head">Attacks</div>
      <button class="add-link" id="add-attack-button">+ Add</button>
    </div>
    ${weaponList(character).map(weapon => {
      const atk = calculateAttack(character, weapon);
      const icon = weapon.weaponType === "ranged" ? "\uD83C\uDFF9" : "\u2694\uFE0F";
      return `
        <div class="atk-row" data-atk-detail="${weapon.id}">
          <div class="atk-icon">${icon}</div>
          <div style="flex:1;min-width:0;">
            <div class="atk-name">${esc(weapon.name)}${atk.proficiency.proficient ? "" : `<span class="atk-warn" title="Not proficient">!</span>`}</div>
            <div class="atk-range">${esc([
              weapon.range,
              atk.damage.map(d => d.type).filter(Boolean).join(" + "),
              atk.ammunition ? atk.ammunition.name + " " + atk.ammunition.current : ""
            ].filter(Boolean).join(" \u00B7 "))}</div>
          </div>
          ${atk.versatile ? `<button class="grip-toggle ${atk.twoHanded ? "two" : ""}" data-grip="${weapon.id}" title="One- or two-handed">${atk.twoHanded ? "2H" : "1H"}</button>` : ""}
          <button class="atk-pill" data-roll-tohit="${weapon.id}">${formatModifier(atk.toHitTotal)}</button>
          <button class="atk-pill" data-roll-damage="${weapon.id}">${esc(atk.damageNotation)}</button>
        </div>
      `;
    }).join("")}
  `;
}

function wireCombatTab() {
  document.getElementById("hp-card").addEventListener("click", openHpCalculator);

  const deathRoll = document.getElementById("roll-death-save");
  if (deathRoll) deathRoll.addEventListener("click", rollDeathSave);
  const deathClear = document.getElementById("clear-death-saves");
  if (deathClear) deathClear.addEventListener("click", () => { resetDeathSaves(character); renderContent(); });

  const ac = calculateAC(character);
  document.getElementById("ac-box").addEventListener("click", () => openBreakdownModal("AC", ac.total, "", ac.sources));

  const initiative = calculateInitiative(character);
  document.getElementById("initiative-box").addEventListener("click", () =>
    openBreakdownModal("Initiative", formatModifier(initiative.total), "", initiative.sources,
      { label: "Initiative", notation: "1d20" + formatModifier(initiative.total) }));

  const speed = calculateSpeed(character);
  document.getElementById("speed-box").addEventListener("click", () => openBreakdownModal("Speed", speed.total, " ft", speed.sources));

  const passivePerception = calculatePassivePerception(character);
  document.getElementById("passive-perception-box").addEventListener("click", () =>
    openBreakdownModal("Passive Perception", passivePerception.total, "", passivePerception.sources));

  document.getElementById("prof-bonus-box").addEventListener("click", openEditProficiencyModal);

  document.getElementById("insp-minus").addEventListener("click", () => { character.inspiration.current--; renderContent(); });
  document.getElementById("insp-plus").addEventListener("click", () => { character.inspiration.current++; renderContent(); });

  document.getElementById("add-effect-button").addEventListener("click", openAddEffectModal);
  document.querySelectorAll("[data-effect-remove]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      character.activeEffects = character.activeEffects.filter(x => x.id != button.dataset.effectRemove);
      renderContent();
    });
  });
  document.querySelectorAll("[data-effect-view]").forEach(chip => chip.addEventListener("click", () => openEffectDetailModal(chip.dataset.effectView)));

  // dropping concentration removes whatever it was holding up, which is the
  // whole point of hanging effects off a named group
  const concDrop = document.getElementById("concentration-drop");
  if (concDrop) concDrop.addEventListener("click", () => {
    const dropped = concentrationGroups(character).map(g => effectGroupLabel(g));
    character.activeEffects = character.activeEffects.filter(g => !g.concentration);
    renderContent();
    showToast("Concentration dropped · " + dropped.join(", ") + " ended");
  });

  document.querySelectorAll("[data-res-minus]").forEach(button => {
    button.addEventListener("click", () => { adjustResourceRow(findResourceRow(character, button.dataset.resMinus), -1); renderContent(); });
  });
  document.querySelectorAll("[data-res-plus]").forEach(button => {
    button.addEventListener("click", () => { adjustResourceRow(findResourceRow(character, button.dataset.resPlus), 1); renderContent(); });
  });
  document.querySelectorAll("[data-res-refill]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const row = findResourceRow(character, button.dataset.resRefill);
      const result = refillContainer(character, row);
      renderContent();
      if (result.moved) showToast("Loaded " + result.moved + " from " + result.from);
      else if (result.reason === "full") showToast(row.name + " is already full");
      else if (result.reason === "empty") showToast("No " + result.from + " left to load");
      else showToast("Nothing called " + row.refillFrom + " to refill from");
    });
  });
  // an item-backed row belongs to the item, so tapping it opens the item
  document.querySelectorAll("[data-resource-view]").forEach(el => el.addEventListener("click", () => {
    const row = findResourceRow(character, el.dataset.resourceView);
    if (!row) return;
    if (row.item) openItemDetailModal(row.item.id);
    else openResourceDetailModal(row.resource.id);
  }));
  document.getElementById("add-resource-button").addEventListener("click", openAddResourceModal);

  document.querySelectorAll("[data-slot-minus]").forEach(button => {
    button.addEventListener("click", () => { character.spellSlots[button.dataset.slotMinus].current--; renderContent(); });
  });
  document.querySelectorAll("[data-slot-plus]").forEach(button => {
    button.addEventListener("click", () => { character.spellSlots[button.dataset.slotPlus].current++; renderContent(); });
  });
  document.querySelectorAll("[data-slot-view]").forEach(el => {
    el.addEventListener("click", () => openEditSlotsModal(parseInt(el.dataset.slotView)));
  });


  document.querySelectorAll("[data-roll-tohit]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const weapon = character.inventory.find(i => i.id == button.dataset.rollTohit);
      const atk = calculateAttack(character, weapon);
      // ammunition is spent when the attack is made, not when it's rerolled
      if (atk.ammunition) {
        if (atk.ammunition.current <= 0) showToast("Out of " + atk.ammunition.name);
        adjustResourceRow(atk.ammunition, -1);
        renderContent();
      }
      showRoll({ label: weapon.name + " \u2013 To Hit", notation: "1d20" + formatModifier(atk.toHitTotal),
                 sources: atk.toHitSources, kind: "attack" });
    });
  });
  document.querySelectorAll("[data-roll-damage]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const weapon = character.inventory.find(i => i.id == button.dataset.rollDamage);
      const atk = calculateAttack(character, weapon);
      showRoll({
        label: weapon.name + " Damage",
        notation: atk.damageNotation,
        parts: atk.damage.map(part => ({ notation: part.notation, label: part.type })),
        sources: atk.damage.reduce((all, part) => all.concat(part.sources), []),
        kind: "damage"
      });
    });
  });
  document.querySelectorAll("[data-grip]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const weapon = character.inventory.find(i => i.id == button.dataset.grip);
      weapon.twoHanded = !weapon.twoHanded;
      renderContent();
    });
  });

  document.querySelectorAll("[data-atk-detail]").forEach(row => row.addEventListener("click", () => openAttackDetailModal(row.dataset.atkDetail)));
  document.getElementById("add-attack-button").addEventListener("click", openAddAttackModal);
}


/* ---------------- HP calculator ---------------- */

function openHpCalculator() {
  let expr = "";
  openModal("sheet", `
    <div class="modal-heading">HP Calculator</div>
    <div class="calc-display"><div class="calc-expr" id="calc-expr">&nbsp;</div></div>
    <div class="calc-grid dice">${[4, 6, 8, 10, 12, 20].map(d => `<button data-dice="${d}">d${d}</button>`).join("")}</div>
    <div class="calc-grid">
      <button data-num="7">7</button><button data-num="8">8</button><button data-num="9">9</button><button data-back>\u232B</button>
      <button data-num="4">4</button><button data-num="5">5</button><button data-num="6">6</button><button data-op="/">\u00F7</button>
      <button data-num="1">1</button><button data-num="2">2</button><button data-num="3">3</button><button data-op="*">\u00D7</button>
      <button data-num="0">0</button><button data-clear>Clear</button><button data-op="+">+</button><button data-op="-">\u2212</button>
    </div>
    <div class="calc-actions">
      <button class="calc-heal" data-hp="heal">HEAL</button>
      <button class="calc-temp" data-hp="temp">TEMP</button>
      <button class="calc-damage" data-hp="damage">DAMAGE</button>
    </div>
    ${calculateHitDice(character).length ? `
      <div class="breakdown-subhead">Hit Dice</div>
      <div id="hitdice-rows">${hitDiceRowsHtml("calc")}</div>
    ` : ""}
  `);

  wireHitDiceCalcRows();

  const exprLine = document.getElementById("calc-expr");
  function refresh() { exprLine.textContent = expr || "\u00A0"; }
  document.querySelectorAll("[data-dice]").forEach(b => b.addEventListener("click", () => { expr += (expr.match(/\d$/) ? "+" : "") + "1d" + b.dataset.dice; refresh(); }));
  document.querySelectorAll("[data-num]").forEach(b => b.addEventListener("click", () => { expr += b.dataset.num; refresh(); }));
  document.querySelectorAll("[data-op]").forEach(b => b.addEventListener("click", () => { expr += b.dataset.op; refresh(); }));
  document.querySelector("[data-back]").addEventListener("click", () => { expr = expr.slice(0, -1); refresh(); });
  document.querySelector("[data-clear]").addEventListener("click", () => { expr = ""; refresh(); });
  document.querySelectorAll("[data-hp]").forEach(b => b.addEventListener("click", () => {
    if (expr.trim() === "") return;
    const result = rollNotation(expr);
    const wasConcentrating = concentrationGroups(character).length > 0;

    applyHp(b.dataset.hp, result.total);
    showRollToast(b.dataset.hp === "heal" ? "Healing" : b.dataset.hp === "temp" ? "Temp HP" : "Damage", expr);
    closeModal();
    renderContent();

    // damage while concentrating calls for a save, so ask straight away rather
    // than leaving it to be remembered
    if (b.dataset.hp === "damage" && wasConcentrating && result.total > 0) {
      openConcentrationCheckModal(result.total);
    }
  }));
}

function applyHp(type, amount) {
  if (amount <= 0) return;
  const maxHP = calculateMaxHP(character);

  if (type === "heal") {
    // any healing above zero brings you round and wipes the death save tracks
    const wasDown = character.hp.current <= 0;
    character.hp.current = Math.min(maxHP.total, character.hp.current + amount);
    if (wasDown && character.hp.current > 0) resetDeathSaves(character);
    return;
  }

  if (type === "temp") {
    character.hp.temp = Math.max(character.hp.temp, amount);
    return;
  }

  if (type === "damage") {
    let remaining = amount;
    if (character.hp.temp > 0) {
      const absorbed = Math.min(character.hp.temp, remaining);
      character.hp.temp -= absorbed;
      remaining -= absorbed;
    }

    // taking damage while already down is an automatic death save failure
    const alreadyDown = character.hp.current <= 0;
    character.hp.current = Math.max(0, character.hp.current - remaining);
    if (alreadyDown && remaining > 0) recordDeathSave("failure", 1);
  }
}

/* ---------------- concentration ---------------- */

/* Taking damage while concentrating calls for a Constitution save at DC 10, or
   half the damage taken if that's higher. Failing ends everything the
   concentration was holding up, which the effect grouping already handles. */
function concentrationSaveDC(damage) {
  return Math.max(10, Math.floor(damage / 2));
}

function dropConcentration() {
  const dropped = concentrationGroups(character).map(group => effectGroupLabel(group));
  character.activeEffects = character.activeEffects.filter(group => !group.concentration);
  return dropped;
}

function openConcentrationCheckModal(damage) {
  const holding = concentrationGroups(character).map(group => effectGroupLabel(group));
  if (!holding.length) return;

  const dc = concentrationSaveDC(damage);
  const save = calculateSavingThrow(character, "CON");

  openModal("center", `
    <div class="modal-heading">Concentration</div>
    <div class="menu-note" style="margin-top:0;">
      ${damage} damage taken while concentrating on ${esc(holding.join(", "))}.
      ${dc > 10 ? "Half the damage is " + Math.floor(damage / 2) + ", so the DC is " + dc + "." : "DC 10, since half the damage is less than that."}
    </div>

    <div class="breakdown-total" style="margin:16px 0;"><span>DC</span><span>${dc}</span></div>
    ${breakdownRowsHtml(save.sources)}
    <hr class="breakdown-divider">
    <div class="breakdown-total" style="margin-bottom:16px;"><span>Constitution Save</span><span>${formatModifier(save.total)}</span></div>

    <button class="btn-primary" id="conc-roll">Roll the Save</button>
    <div class="btn-row-2">
      <button class="btn-secondary" id="conc-keep">Kept it</button>
      <button class="btn-secondary" id="conc-drop">Lost it</button>
    </div>
  `);

  document.getElementById("conc-roll").addEventListener("click", () => {
    const result = rollNotation("1d20" + formatModifier(save.total));
    if (result.total >= dc) {
      closeModal();
      renderContent();
      showToast("Concentration held — " + result.total + " against DC " + dc);
      return;
    }
    const lost = dropConcentration();
    closeModal();
    renderContent();
    showToast(result.total + " against DC " + dc + " — lost " + lost.join(", "));
  });

  document.getElementById("conc-keep").addEventListener("click", () => { closeModal(); renderContent(); });
  document.getElementById("conc-drop").addEventListener("click", () => {
    const lost = dropConcentration();
    closeModal();
    renderContent();
    showToast("Lost " + lost.join(", "));
  });
}


/* ---------------- death saves ---------------- */

function recordDeathSave(kind, count) {
  if (!character.deathSaves) resetDeathSaves(character);
  const track = kind === "success" ? "successes" : "failures";
  character.deathSaves[track] = Math.min(3, character.deathSaves[track] + (count || 1));
}

function rollDeathSave() {
  const roll = rollDie(20);

  if (roll === 20) {
    // a natural twenty is not a success -- you come round on one hit point
    resetDeathSaves(character);
    character.hp.current = 1;
    renderContent();
    showToast("Natural 20 — conscious at 1 hit point");
    return;
  }

  if (roll === 1) recordDeathSave("failure", 2);
  else if (roll >= 10) recordDeathSave("success", 1);
  else recordDeathSave("failure", 1);

  const state = deathSaveState(character);
  renderContent();

  const outcome = roll === 1 ? "Natural 1 — two failures"
    : roll >= 10 ? roll + " — success"
    : roll + " — failure";

  if (state.dead) showToast(outcome + ". Three failures — dead.");
  else if (state.stable) showToast(outcome + ". Three successes — stable.");
  else showToast(outcome);
}

function deathSaveTrackHtml(filled, total, kind) {
  let pips = "";
  for (let i = 0; i < total; i++) {
    pips += `<span class="death-pip ${i < filled ? kind : ""}"></span>`;
  }
  return pips;
}


/* ---------------- hit dice ---------------- */

/* Spending is available two ways: as part of a short rest, and standalone from
   the HP calculator. 5e only allows the former, but a POC gains little from
   enforcing that and loses the ability to correct a miscount mid-session. */

// diceSpend is an array parallel to calculateHitDice(): how many to spend from
// each pool. Each die rolls separately and adds the CON modifier.
function spendHitDice(diceSpend) {
  const conMod = abilityModifier(effectiveAbilityScore(character, "CON"));
  let healed = 0, dice = 0;
  calculateHitDice(character).forEach((pool, index) => {
    for (let n = 0; n < (diceSpend[index] || 0); n++) {
      spendHitDieOfSize(character, pool.die, 1);
      healed += Math.max(0, rollNotation("1" + pool.die).total + conMod);
      dice++;
    }
  });
  if (healed) applyHp("heal", healed);
  return { healed, dice };
}

// The calculator's rows are live: spending or correcting a count redraws just
// this block, plus the sheet behind it, without closing the calculator.
function wireHitDiceCalcRows() {
  const wrap = document.getElementById("hitdice-rows");
  if (!wrap) return;

  function redraw() {
    wrap.innerHTML = hitDiceRowsHtml("calc");
    wireHitDiceCalcRows();
    renderContent();
  }

  wrap.querySelectorAll("[data-hd-minus]").forEach(button => {
    button.addEventListener("click", () => {
      spendHitDieOfSize(character, calculateHitDice(character)[button.dataset.hdMinus].die, 1); redraw();
    });
  });
  wrap.querySelectorAll("[data-hd-plus]").forEach(button => {
    button.addEventListener("click", () => {
      spendHitDieOfSize(character, calculateHitDice(character)[button.dataset.hdPlus].die, -1); redraw();
    });
  });
  wrap.querySelectorAll("[data-hd-spend]").forEach(button => {
    button.addEventListener("click", () => {
      const index = parseInt(button.dataset.hdSpend);
      const pools = calculateHitDice(character);
      const pool = pools[index];
      if (pool.current <= 0) showToast("No " + pool.die + " hit dice left");
      const spend = pools.map((p, i) => (i === index ? 1 : 0));
      const result = spendHitDice(spend);
      showRollToast("Hit Die – " + pool.die, "1" + pool.die + formatModifier(abilityModifier(effectiveAbilityScore(character, "CON"))));
      redraw();
    });
  });
}

function hitDiceRowsHtml(mode) {
  return calculateHitDice(character).map((pool, index) => `
    <div class="hitdice-row">
      <span class="hitdice-die">${esc(pool.die)}</span>
      <span class="hitdice-count">${pool.current} of ${pool.total} left<span class="res-tag">${esc(rechargeLabel(pool.recharge))}</span></span>
      ${mode === "rest"
        ? `<div class="stepper">
             <button data-rest-die-minus="${index}">−</button>
             <span class="res-count" data-rest-die-value="${index}">0</span>
             <button data-rest-die-plus="${index}">+</button>
           </div>`
        : `<div class="stepper">
             <button data-hd-minus="${index}">−</button>
             <button data-hd-plus="${index}">+</button>
             <button class="atk-pill" data-hd-spend="${index}">Spend</button>
           </div>`}
    </div>
  `).join("");
}


/* ---------------- effects (conditions) ---------------- */

// One modal builds a whole group: a name, how long it lasts, whether it takes
// concentration, and any number of modifiers underneath. Naming it is what
// makes non-SRD content expressible -- "Bless" or a homebrew curse is just a
// named group, and its modifiers are removed together with it.
function openAddEffectModal() {
  const formEffects = [{ category: "Condition", value: {} }];
  let concentration = false;

  openModal("full", `
    <div class="modal-heading">Add Effect</div>
    ${comboFieldHtml("effect-name", "Name", "e.g. Bless, Prone, Hexed")}

    <div class="field-row">
      ${selectFieldHtml("effect-duration-type", "Duration", [
        { value: "Rounds", label: "Rounds" },
        { value: "Short Rest", label: "Until Short Rest" },
        { value: "Long Rest", label: "Until Long Rest" },
        { value: "Permanent", label: "Permanent" }
      ], "Permanent")}
      <div class="field field-shrink">
        <label>Concentration</label>
        <div class="field-control"><div class="switch" id="effect-conc-switch"><div class="knob"></div></div></div>
      </div>
    </div>
    <div id="effect-duration-rounds"></div>

    <div class="field"><label>Note (optional)</label>
      <textarea id="effect-note" placeholder="Anything that won't fit in the name — who cast it, what ends it, table rulings"></textarea>
    </div>

    <div class="field" style="margin-top:14px;"><label>Modifiers</label></div>
    <div id="effect-effects-list"></div>
    <button class="add-link" id="add-effect-row-button">+ Add Modifier</button>
    <div class="menu-note">Leave the list empty for a label-only reminder with no mechanical effect.</div>
    <button class="btn-primary" id="save-effect-button" style="margin-top:14px;">Add Effect</button>
  `);

  wireCombo("effect-name", ALL_CONDITIONS);
  wireSelect("effect-duration-type");

  const durationTypeSelect = document.getElementById("effect-duration-type");
  const roundsField = document.getElementById("effect-duration-rounds");
  const listEl = document.getElementById("effect-effects-list");

  function renderRoundsField() {
    roundsField.innerHTML = durationTypeSelect.value === "Rounds"
      ? `<div class="field"><label>Number of Rounds</label><input id="effect-rounds" type="number" value="1"></div>` : "";
  }
  durationTypeSelect.addEventListener("change", renderRoundsField);
  renderRoundsField();

  document.getElementById("effect-conc-switch").addEventListener("click", (e) => {
    concentration = !concentration;
    e.currentTarget.classList.toggle("on", concentration);
  });

  renderFeatureEffectsList(listEl, formEffects, EFFECT_CATEGORIES_GENERAL);
  document.getElementById("add-effect-row-button").addEventListener("click", () => {
    formEffects.push({ category: "Bonus", value: {} });
    renderFeatureEffectsList(listEl, formEffects, EFFECT_CATEGORIES_GENERAL);
  });

  document.getElementById("save-effect-button").addEventListener("click", () => {
    const durationType = durationTypeSelect.value;
    const newId = Math.max(0, ...character.activeEffects.map(e => e.id)) + 1;
    character.activeEffects.push({
      id: newId,
      name: document.getElementById("effect-name").value.trim(),
      note: document.getElementById("effect-note").value.trim(),
      concentration,
      duration: {
        type: durationType,
        rounds: durationType === "Rounds" ? (parseInt(document.getElementById("effect-rounds").value) || 1) : null
      },
      effects: readFeatureEffectsFromForm(formEffects)
    });
    closeModal();
    renderContent();
  });
}

/* Shown inside an exhaustion effect's detail: what the current level actually
   does, tier by tier, with the ones you have marked. Stepping the level here
   rewrites the group, so there's only ever one exhaustion effect. */
function exhaustionBlockHtml(group) {
  const isExhaustion = (group.effects || []).some(e =>
    e.category === "Condition" && String(e.value.condition).toLowerCase() === "exhaustion");
  if (!isExhaustion) return "";

  const level = exhaustionLevel(character);
  return `
    <div class="breakdown-subhead">Exhaustion ${level}</div>
    <div class="res-row">
      <span class="res-name">Level</span>
      <div class="stepper">
        <button data-exhaustion-step="-1">−</button>
        <span class="res-count">${level} / 6</span>
        <button data-exhaustion-step="1">+</button>
      </div>
    </div>
    ${EXHAUSTION_LEVELS.map(tier => `
      <div class="breakdown-row ${tier.level <= level ? "" : "exhaustion-inactive"}">
        <span>${tier.level}</span><span>${esc(tier.effect)}</span>
      </div>
    `).join("")}
    <div class="menu-note">A long rest removes one level.</div>`;
}

function openEffectDetailModal(effectId) {
  const group = character.activeEffects.find(e => e.id == effectId);
  const modifiers = group.effects || [];
  openModal("center", `
    <div class="breakdown-title">${esc(effectGroupLabel(group))}</div>
    <div class="breakdown-row"><span>Duration</span><span>${esc(durationLabel(group))}</span></div>
    ${group.concentration ? `<div class="breakdown-row"><span>Concentration</span><span>Required</span></div>` : ""}
    ${group.note ? `<div class="effect-note">${esc(group.note)}</div>` : ""}
    ${exhaustionBlockHtml(group)}
    ${modifiers.length ? `
      <div class="breakdown-subhead">Modifiers</div>
      ${modifiers.map(e => `<div class="breakdown-row"><span>${esc(e.category)}</span><span>${esc(effectSummaryLabel(e))}</span></div>`).join("")}
    ` : `<div class="empty-hint">No mechanical effect — this is a reminder only.</div>`}
    <button class="btn-primary" id="remove-effect-button" style="background:#5A2C29;color:#F0908A;">Remove Effect</button>
  `);
  document.getElementById("remove-effect-button").addEventListener("click", () => {
    character.activeEffects = character.activeEffects.filter(e => e.id != effectId);
    closeModal();
    renderContent();
  });

  document.querySelectorAll("[data-exhaustion-step]").forEach(button => {
    button.addEventListener("click", () => {
      const next = exhaustionLevel(character) + parseInt(button.dataset.exhaustionStep);
      setExhaustionLevel(character, next);
      closeModal();
      renderContent();
      if (next <= 0) showToast("Exhaustion cleared");
      else showToast("Exhaustion " + Math.min(6, next));
    });
  });
}


/* ---------------- resources ---------------- */

function openAddResourceModal() {
  openModal("sheet", `
    <div class="modal-heading">New Resource</div>
    <div class="field"><label>Name</label><input id="new-res-name" placeholder="e.g. Bardic Inspiration"></div>
    <div class="field"><label>Max Uses</label><input id="new-res-max" type="number" value="1"></div>
    ${rechargeFieldHtml("new-res")}
    <button class="btn-primary" id="save-res-button">Add Resource</button>
  `);
  wireRechargeField("new-res");
  document.getElementById("save-res-button").addEventListener("click", () => {
    const name = document.getElementById("new-res-name").value.trim() || "New Resource";
    const max = parseInt(document.getElementById("new-res-max").value) || 1;
    const recharge = readRechargeValue("new-res");
    const newId = Math.max(0, ...character.resources.map(r => r.id)) + 1;
    character.resources.push({ id: newId, name, recharge, current: max, max });
    closeModal();
    renderContent();
  });
}

function openResourceDetailModal(resourceId) {
  const r = character.resources.find(x => x.id == resourceId);
  openModal("sheet", `
    <div class="modal-heading">Edit Resource</div>
    <div class="field"><label>Name</label><input id="edit-res-name" value="${esc(r.name)}"></div>
    <div class="field"><label>Max Uses</label><input id="edit-res-max" type="number" value="${r.max}"></div>
    ${rechargeFieldHtml("edit-res", r.recharge)}
    <div class="btn-row-2">
      <button class="btn-primary" id="save-edit-res-button">Save Changes</button>
      <button class="btn-primary" id="remove-res-button" style="background:#5A2C29;color:#F0908A;">Remove</button>
    </div>
  `);
  wireRechargeField("edit-res");
  document.getElementById("save-edit-res-button").addEventListener("click", () => {
    r.name = document.getElementById("edit-res-name").value.trim() || r.name;
    r.max = parseInt(document.getElementById("edit-res-max").value) || r.max;
    r.recharge = readRechargeValue("edit-res");
    closeModal();
    renderContent();
  });
  document.getElementById("remove-res-button").addEventListener("click", () => {
    character.resources = character.resources.filter(x => x.id != resourceId);
    closeModal();
    renderContent();
  });
}


/* ---------------- attacks ---------------- */

// Combat's "+ Add" is a shortcut into the one item form, preset to Weapon and
// to the Equipped category. There is no separate weapon-creation path.
function openAddAttackModal() {
  openAddInventoryModal("Equipped", "weapon");
}

/* Properties are free-form strings because several SRD ones carry a parameter
   -- "Versatile (1d10)", "Thrown (range 20/60)". So rather than a fixed set of
   checkboxes, the picker shows what's selected as removable chips and offers
   the unused SRD names as a palette, with a free-text field for anything else.
   A palette entry is considered used if its base name (the text before any
   bracket) already appears, so "Versatile (1d10)" hides the plain "Versatile"
   button instead of offering a duplicate. */
function propertyBaseName(text) {
  return String(text).split("(")[0].trim().toLowerCase();
}

function renderPropertyPicker(container, selected) {
  const taken = selected.map(propertyBaseName);
  const available = SRD_WEAPON_PROPERTIES.filter(name => !taken.includes(propertyBaseName(name)));

  container.innerHTML = `
    <div class="chip-row" style="margin-bottom:8px;">
      ${selected.map((property, idx) => `
        <div class="chip">${esc(property)}<button class="chip-remove" data-prop-remove="${idx}">✕</button></div>
      `).join("") || `<div class="empty-hint" style="padding:2px 0;">No properties</div>`}
    </div>
    ${available.length ? `<div class="prop-palette">
      ${available.map(name => `<button type="button" class="prop-add" data-prop-add="${esc(name)}">+ ${esc(name)}</button>`).join("")}
    </div>` : ""}
    <div class="field-row" style="margin-top:10px;">
      <div class="field" style="margin-bottom:0;"><input id="prop-custom-input" placeholder="Anything else, e.g. Versatile (1d10)"></div>
      <button type="button" class="btn-secondary prop-custom-add" id="prop-custom-add">Add</button>
    </div>
  `;

  container.querySelectorAll("[data-prop-remove]").forEach(button => {
    button.addEventListener("click", () => {
      selected.splice(parseInt(button.dataset.propRemove), 1);
      renderPropertyPicker(container, selected);
    });
  });
  container.querySelectorAll("[data-prop-add]").forEach(button => {
    button.addEventListener("click", () => {
      selected.push(button.dataset.propAdd);
      renderPropertyPicker(container, selected);
    });
  });

  const customInput = container.querySelector("#prop-custom-input");
  function addCustom() {
    const value = customInput.value.trim();
    if (!value) return;
    selected.push(value);
    renderPropertyPicker(container, selected);
  }
  container.querySelector("#prop-custom-add").addEventListener("click", addCustom);
  customInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } });
}

/* Repeatable damage rows, so one weapon can deal several types. Same editing
   shape as the effect modifier list: a card per entry, add and remove links. */
function renderDamageRows(container, parts) {
  const abilityOptions = [{ value: "", label: "None" }]
    .concat(Object.keys(ABILITY_FULL_NAMES).map(a => ({ value: a, label: a })));

  container.innerHTML = parts.map((part, idx) => `
    <div class="feature-effect-row">
      <div class="subcard-head">
        <span>Damage ${idx + 1}</span>
        <button class="chip-remove" data-remove-damage="${idx}">\u2715</button>
      </div>
      <div class="field-row">
        <div class="field" style="flex:0 0 84px;"><label>Dice</label><input id="dmg-dice-${idx}" value="${esc(part.dice || "")}" placeholder="1d6"></div>
        ${selectFieldHtml("dmg-type-" + idx, "Damage Type", DAMAGE_TYPES, part.type)}
      </div>
      ${selectFieldHtml("dmg-ability-" + idx, "Adds ability modifier", abilityOptions, part.ability || "")}
    </div>
  `).join("") || `<div class="empty-hint">No damage \u2014 this attack rolls to hit only.</div>`;

  wireSelectsIn(container);
  container.querySelectorAll("[data-remove-damage]").forEach(button => {
    button.addEventListener("click", () => {
      parts.splice(parseInt(button.dataset.removeDamage), 1);
      renderDamageRows(container, parts);
    });
  });
}

function readDamageRows(parts) {
  return parts.map((part, idx) => {
    const entry = { dice: document.getElementById("dmg-dice-" + idx).value.trim() || "1d4" };
    const type = document.getElementById("dmg-type-" + idx).value;
    const ability = document.getElementById("dmg-ability-" + idx).value;
    if (type) entry.type = type;
    if (ability) entry.ability = ability;
    return entry;
  });
}

function openAttackDetailModal(weaponId) {
  const weapon = character.inventory.find(i => i.id == weaponId);
  const atk = calculateAttack(character, weapon);

  openModal("full", `
    <div class="modal-heading">${esc(weapon.name)}</div>
    <div class="breakdown-source">${esc(atk.source)}${weapon.range ? " \u00B7 " + esc(weapon.range) : ""}</div>
    ${weapon.properties && weapon.properties.length ? `<div class="breakdown-source">${esc(weapon.properties.join(", "))}</div>` : ""}
    <div class="breakdown-source">
      ${atk.proficiency.required ? "Requires " + esc(atk.proficiency.required) + " \u2014 " : ""}${atk.proficiency.proficient ? "proficient" : "not proficient"}${atk.proficiency.overridden ? " (set manually)" : ""}
    </div>
    ${atk.finesse ? `<div class="breakdown-source">Finesse \u2014 using ${ABILITY_FULL_NAMES[atk.finesse]}, your better of Strength and Dexterity</div>` : ""}
    ${atk.versatile ? `
      <div class="toggle-line" style="margin-top:10px;">
        <span>Wielding two-handed <span class="atk-range">(${esc(atk.versatile)})</span></span>
        <div class="switch ${atk.twoHanded ? "on" : ""}" id="atk-grip-switch"><div class="knob"></div></div>
      </div>` : ""}

    <div class="breakdown-subhead">To Hit</div>
    ${breakdownRowsHtml(atk.toHitSources)}
    <hr class="breakdown-divider">
    <div class="breakdown-total"><span>Total</span><span>${formatModifier(atk.toHitTotal)}</span></div>

    ${atk.damage.map(part => `
      <div class="breakdown-subhead">${esc(part.type || "Damage")}</div>
      <div class="breakdown-row"><span>Dice</span><span>${esc(part.dice)}</span></div>
      ${breakdownRowsHtml(part.sources)}
      <hr class="breakdown-divider">
      <div class="breakdown-total"><span>Total</span><span>${esc(part.notation)}</span></div>
    `).join("")}

    <div class="btn-row-2" style="margin-top:22px;">
      <button class="btn-primary" id="edit-weapon-button">Edit Weapon</button>
      <button class="btn-primary" id="remove-atk-button" style="background:#242019;color:#F5C37A;">Stow</button>
    </div>
  `);

  const gripSwitch = document.getElementById("atk-grip-switch");
  if (gripSwitch) gripSwitch.addEventListener("click", () => {
    weapon.twoHanded = !weapon.twoHanded;
    gripSwitch.classList.toggle("on", weapon.twoHanded);
    renderContent();
  });

  // a weapon IS an inventory item, so editing one is editing that item -- the
  // full form lives there rather than being duplicated here
  document.getElementById("edit-weapon-button").addEventListener("click", () => openItemEditModal(weaponId));

  document.getElementById("remove-atk-button").addEventListener("click", () => openStowWeaponModal(weaponId));
}


/* ---------- stowing a weapon ----------

   Taking a weapon off the Attacks list must not destroy it -- it's a real
   object you own. Stowing moves it to a category that doesn't provide attacks.
   Deleting it outright is still possible, from the item's own editor. */

function stowWeapon(weapon, categoryName) {
  weapon.category = categoryName;
  openInvCategories[categoryName] = true;
  closeModal();
  renderContent();
  showToast("Moved " + weapon.name + " to " + categoryName);
}

function openStowWeaponModal(weaponId) {
  const weapon = character.inventory.find(i => i.id == weaponId);
  const targets = stowCategories(character);
  if (!targets.length) return openCreateStowCategoryModal(weapon);

  let selected = targets.includes("Carrying") ? "Carrying" : targets[0];

  openModal("center", `
    <div class="modal-heading">Stow ${esc(weapon.name)}</div>
    <div class="menu-note" style="margin-top:0;">It comes off your Attacks list but stays in your inventory. Delete it for good from the item itself.</div>
    <div style="margin-top:14px;">
      ${targets.map(name => `
        <div class="recipient-row" data-stow-to="${esc(name)}">
          <div class="recipient-left"><div class="recipient-name">${esc(name)}</div></div>
          <div class="radio-dot ${name === selected ? "selected" : ""}" data-stow-dot="${esc(name)}"></div>
        </div>
      `).join("")}
    </div>
    <button class="btn-primary" id="confirm-stow">Stow</button>
    <button class="btn-secondary" id="cancel-stow">Cancel</button>
  `);

  document.querySelectorAll("[data-stow-to]").forEach(row => {
    row.addEventListener("click", () => {
      selected = row.dataset.stowTo;
      document.querySelectorAll("[data-stow-dot]").forEach(dot =>
        dot.classList.toggle("selected", dot.dataset.stowDot === selected));
    });
  });
  document.getElementById("confirm-stow").addEventListener("click", () => stowWeapon(weapon, selected));
  document.getElementById("cancel-stow").addEventListener("click", closeModal);
}

// every category provides attacks, so there is nowhere to put it -- offer to
// make somewhere rather than refusing or silently deleting
function openCreateStowCategoryModal(weapon) {
  openModal("center", `
    <div class="modal-heading">Nowhere to stow it</div>
    <div class="menu-note" style="margin-top:0;">
      Every inventory category currently puts weapons on your Attacks list, so ${esc(weapon.name)} has nowhere to go.
      Create a category for gear you're carrying but not wielding.
    </div>
    <div class="field" style="margin-top:14px;"><label>Category Name</label><input id="stow-cat-name" value="Carrying"></div>
    <button class="btn-primary" id="create-stow-cat">Create and Stow</button>
    <button class="btn-secondary" id="cancel-stow">Cancel</button>
  `);

  document.getElementById("create-stow-cat").addEventListener("click", () => {
    const name = document.getElementById("stow-cat-name").value.trim();
    if (!name) { showToast("Give the category a name"); return; }
    if (character.categoryRules[name]) { showToast("You already have a category called that"); return; }
    character.categoryRules[name] = { countsWeight: true, appliesEffects: false, providesAttacks: false };
    stowWeapon(weapon, name);
  });
  document.getElementById("cancel-stow").addEventListener("click", closeModal);
}


/* ============================================================
   CHARACTER TAB
   ============================================================ */

let openSections = { abilityScores: true, savingThrows: true, skills: true, features: true };
let openFeatureCategories = {};

function renderCollapseSection(title, key, bodyHtml) {
  return `
    <div class="section-head-row" data-section-toggle="${key}" style="cursor:pointer;">
      <div class="section-head">${esc(title)}</div>
      <span style="color:#9C9186;font-size:12px;">${openSections[key] ? "\u2212" : "+"}</span>
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
      <button class="btn-primary" id="remove-subsection-button" style="background:#5A2C29;color:#F0908A;">Remove</button>
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
      <button class="btn-primary" id="remove-feature-button" style="background:#5A2C29;color:#F0908A;">Remove</button>
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
      ${classes.length > 1 ? `<div style="text-align:center;font-weight:bold;font-size:13px;color:#F5C37A;margin-top:14px;">${esc(cls.name)}</div>` : ""}
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
          ${slot ? `<button class="mini-edit" data-edit-slots="${lvl}">\u270E</button><span style="color:#9C9186;font-size:12px;">${slot.current}/${slot.max} slots</span>` : ""}
          <span style="color:#9C9186;font-size:12px;">${isOpen ? "\u2212" : "+"}</span>
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
    <div style="font-size:12px;color:#9C9186;">${prepared.count} / ${prepared.max} prepared</div>

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
      <button class="btn-primary" id="remove-spell-button" style="background:#5A2C29;color:#F0908A;">Remove</button>
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


/* ============================================================
   INVENTORY TAB
   ============================================================ */

let openInvCategories = {};
let suppressInvClickUntil = 0;

function renderInventoryTab() {
  const bonuses = [];
  character.inventory.forEach(item => {
    const rule = character.categoryRules[item.category];
    if (!rule || !rule.appliesEffects) return;
    if (item.acBonus) bonuses.push({ value: formatModifier(item.acBonus) + " AC", name: item.name });
    if (item.attackBonus) bonuses.push({ value: formatModifier(item.attackBonus) + " Attack", name: item.name });
  });
  const weight = calculateCarriedWeight(character);
  const categories = Object.keys(character.categoryRules);

  return `
    <div class="weight-line" style="display:flex;align-items:center;justify-content:space-between;">
      <span>Carried weight: <strong>${weight.total} lb</strong></span>
      <button class="add-link" id="add-inventory-button">+ Add</button>
    </div>
    ${bonuses.length ? `
      <div class="chip-row" style="margin-top:10px;">
        ${bonuses.map(bonus => `<div class="chip chip-stat"><span class="chip-value">${esc(bonus.value)}</span>${esc(bonus.name)}</div>`).join("")}
      </div>` : ""}

    <div id="inventory-sections">
      ${categories.map(cat => {
        const isOpen = openInvCategories[cat] !== false;
        const items = character.inventory.filter(i => i.category === cat);
        return `
          <div class="section-head-row" data-cat-card="${esc(cat)}" data-inv-cat-toggle="${esc(cat)}" style="cursor:pointer;touch-action:none;">
            <div class="section-head">${esc(cat)}</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <button class="mini-edit" data-edit-category="${esc(cat)}">\u270E</button>
              <span style="color:#9C9186;font-size:12px;">${isOpen ? "\u2212" : "+"}</span>
            </div>
          </div>
          <div data-cat-body="${esc(cat)}" style="${isOpen ? "" : "display:none;"}">
            ${items.map(item => `
              <div class="item-row" data-item-view="${item.id}" data-item-id="${item.id}" style="touch-action:none;">
                <div style="flex:1;">
                  <div class="item-name">${esc(item.name)}${item.qty > 1 ? " \u00D7" + item.qty : ""}</div>
                  ${(character.categoryRules[cat].appliesEffects && (item.acBonus || item.attackBonus)) ? `<div class="item-effect">${item.acBonus ? formatModifier(item.acBonus) + " AC " : ""}${item.attackBonus ? formatModifier(item.attackBonus) + " Attack " : ""}</div>` : ""}
                  <div class="item-meta">${character.categoryRules[cat].countsWeight ? item.weight + " lb" : "No weight"}</div>
                </div>
              </div>
            `).join("") || `<div class="empty-hint">No items in this category</div>`}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* holds a pointer down for holdMs before treating it as a drag; a quick tap
   passes through untouched so normal click handlers (toggle/edit/detail) still work */
function attachHoldDrag(el, handlers, holdMs) {
  holdMs = holdMs || 250;
  let timer = null;
  let dragging = false;
  let startX = 0, startY = 0;

  function onEarlyMove(e) {
    if (!dragging && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) clearTimeout(timer);
  }
  function onEarlyUp() {
    clearTimeout(timer);
    el.removeEventListener("pointermove", onEarlyMove);
    el.removeEventListener("pointerup", onEarlyUp);
  }
  function onMove(e) { if (dragging) handlers.onMove(e); }
  function onUp(e) {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    if (dragging) { dragging = false; handlers.onEnd(e); }
  }

  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, select, input")) return;
    startX = e.clientX; startY = e.clientY;
    timer = setTimeout(() => {
      dragging = true;
      handlers.onStart(e);
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    }, holdMs);
    el.addEventListener("pointermove", onEarlyMove);
    el.addEventListener("pointerup", onEarlyUp);
  });
}

function wireSectionDragging() {
  const wrap = document.getElementById("inventory-sections");
  document.querySelectorAll("[data-cat-card]").forEach(card => {
    attachHoldDrag(card, {
      onStart: () => card.classList.add("dragging"),
      onMove: (e) => {
        const cardBody = document.querySelector(`[data-cat-body="${card.dataset.catCard}"]`);
        const siblings = Array.from(wrap.querySelectorAll("[data-cat-card]")).filter(c => c !== card);
        let placed = false;
        for (const sib of siblings) {
          const box = sib.getBoundingClientRect();
          if (e.clientY < box.top + box.height / 2) {
            wrap.insertBefore(card, sib);
            wrap.insertBefore(cardBody, sib);
            placed = true;
            break;
          }
        }
        if (!placed) { wrap.appendChild(card); wrap.appendChild(cardBody); }
      },
      onEnd: () => {
        card.classList.remove("dragging");
        suppressInvClickUntil = Date.now() + 300;
        const order = Array.from(wrap.querySelectorAll("[data-cat-card]")).map(c => c.dataset.catCard);
        const newRules = {};
        order.forEach(cat => { newRules[cat] = character.categoryRules[cat]; });
        character.categoryRules = newRules;
        renderContent();
      }
    });
  });
}

function wireItemDragging() {
  document.querySelectorAll(".item-row").forEach(row => {
    attachHoldDrag(row, {
      onStart: () => row.classList.add("dragging"),
      onMove: (e) => {
        const bodies = Array.from(document.querySelectorAll("[data-cat-body]"));
        let targetBody = null;
        for (const b of bodies) {
          const box = b.getBoundingClientRect();
          if (e.clientY >= box.top - 20 && e.clientY <= box.bottom + 20) { targetBody = b; break; }
        }
        if (!targetBody) return;
        const hint = targetBody.querySelector(".empty-hint");
        if (hint) hint.remove();
        const rows = Array.from(targetBody.querySelectorAll(".item-row")).filter(r => r !== row);
        let placed = false;
        for (const r of rows) {
          const box = r.getBoundingClientRect();
          if (e.clientY < box.top + box.height / 2) {
            targetBody.insertBefore(row, r);
            placed = true;
            break;
          }
        }
        if (!placed) targetBody.appendChild(row);
      },
      onEnd: () => {
        row.classList.remove("dragging");
        suppressInvClickUntil = Date.now() + 300;
        const newInventory = [];
        document.querySelectorAll("[data-cat-body]").forEach(body => {
          const cat = body.dataset.catBody;
          body.querySelectorAll(".item-row").forEach(r => {
            const item = character.inventory.find(i => i.id == r.dataset.itemId);
            if (item) { item.category = cat; newInventory.push(item); }
          });
        });
        character.inventory = newInventory;
        renderContent();
      }
    });
  });
}

function wireInventoryTab() {
  document.getElementById("add-inventory-button").addEventListener("click", () => openAddInventoryModal());

  document.querySelectorAll("[data-inv-cat-toggle]").forEach(head => {
    head.addEventListener("click", (e) => {
      if (Date.now() < suppressInvClickUntil) return;
      if (e.target.closest("[data-edit-category]")) return;
      const cat = head.dataset.invCatToggle;
      openInvCategories[cat] = !(openInvCategories[cat] !== false);
      renderContent();
    });
  });
  document.querySelectorAll("[data-edit-category]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); openEditCategoryModal(btn.dataset.editCategory); });
  });
  document.querySelectorAll("[data-item-view]").forEach(row => {
    row.addEventListener("click", () => {
      if (Date.now() < suppressInvClickUntil) return;
      openItemDetailModal(row.dataset.itemView);
    });
  });

  wireSectionDragging();
  wireItemDragging();
}

/* ---------- shared item form ----------

   Weapons, armour and gear are all inventory entries, so there is one form for
   all three and a type toggle decides which extra block appears. Combat's
   "+ Add" opens this same form preset to Weapon, and the attack editor sends
   you here rather than keeping a second copy of the weapon fields. */

const ITEM_TYPES = [
  { value: "gear", label: "Gear" },
  { value: "weapon", label: "Weapon" },
  { value: "armour", label: "Armour" }
];

const ARMOUR_KINDS = [
  { value: "light", label: "Light", dexCap: null },
  { value: "medium", label: "Medium", dexCap: 2 },
  { value: "heavy", label: "Heavy", dexCap: 0 },
  { value: "shield", label: "Shield", dexCap: null }
];

function itemTypeToggleHtml(current) {
  return `
    <div class="type-toggle">
      ${ITEM_TYPES.map(type => `
        <button class="toggle-btn ${current === type.value ? "active" : ""}" data-item-type="${type.value}">${type.label}</button>
      `).join("")}
    </div>`;
}

function commonItemFieldsHtml(item) {
  item = item || {};
  const categories = Object.keys(character.categoryRules);
  return `
    <div class="field"><label>Name</label><input id="if-name" value="${esc(item.name || "")}" placeholder="e.g. Potion of Healing"></div>
    ${selectFieldHtml("if-category", "Category", categories, item.category || categories[0])}
    <div class="field-row">
      <div class="field"><label>Weight (lb)</label><input id="if-weight" type="number" value="${item.weight != null ? item.weight : 1}"></div>
      <div class="field"><label>Quantity</label><input id="if-qty" type="number" value="${item.qty || 1}"></div>
    </div>
    <div class="field"><label>Description (optional)</label><textarea id="if-desc" placeholder="What it is, what it does">${esc(item.description || "")}</textarea></div>
    <div class="field-row">
      <div class="field"><label>AC Bonus</label><input id="if-ac" type="number" value="${item.acBonus || 0}"></div>
      <div class="field"><label>Attack Bonus</label><input id="if-atkb" type="number" value="${item.attackBonus || 0}"></div>
    </div>
    <div class="toggle-line">
      <span>Track under Resources<div class="atk-range">for things you spend, like arrows</div></span>
      <div class="switch ${item.resource ? "on" : ""}" id="if-resource-switch"><div class="knob"></div></div>
    </div>
    <div id="if-resource-fields">${item.resource ? itemResourceFieldsHtml(item.resource) : ""}</div>`;
}

function itemResourceFieldsHtml(resource) {
  resource = resource || {};
  return `
    <div class="field"><label>Capacity</label>
      <input id="if-res-max" type="number" value="${resource.max != null ? resource.max : 0}" placeholder="0">
      <div class="atk-range" style="margin-top:4px;">Leave at 0 for an uncapped stack — it'll show a bare count.</div>
    </div>
    ${comboFieldHtml("if-res-refill", "Refills From (optional)", "e.g. Arrows", resource.refillFrom)}
    <div class="atk-range" style="margin:-6px 0 12px;">Name another tracked item and this becomes a container: the count is what's loaded, and a Refill button moves units across.</div>
    ${rechargeFieldHtml("if-res", resource.recharge || { on: "none", amount: "all" })}`;
}

// the quantity is the count, so there's no separate "current" to keep in step
function wireItemResourceFields(item) {
  const wrap = document.getElementById("if-resource-fields");
  const toggle = document.getElementById("if-resource-switch");
  let on = !!(item && item.resource);

  function draw() {
    wrap.innerHTML = on ? itemResourceFieldsHtml(item && item.resource) : "";
    if (on) { wireRechargeField("if-res"); wireCombo("if-res-refill", resourceRows(character).map(r => r.name)); }
  }
  toggle.addEventListener("click", () => {
    on = !on;
    toggle.classList.toggle("on", on);
    draw();
  });
  if (on) { wireRechargeField("if-res"); wireCombo("if-res-refill", resourceRows(character).map(r => r.name)); }
}

function readItemResourceFields(existing) {
  const max = document.getElementById("if-res-max");
  if (!max) return null;

  const block = {
    max: parseInt(max.value) || 0,
    recharge: readRechargeValue("if-res")
  };

  const refillFrom = document.getElementById("if-res-refill").value.trim();
  if (refillFrom) {
    block.refillFrom = refillFrom;
    // a container keeps its own load; start it full if it didn't have one
    const previous = existing && existing.resource ? existing.resource.loaded : undefined;
    block.loaded = Math.min(block.max, previous !== undefined ? previous : block.max);
  }
  return block;
}

function readCommonItemFields() {
  return {
    name: document.getElementById("if-name").value.trim() || "New Item",
    category: document.getElementById("if-category").value,
    weight: parseFloat(document.getElementById("if-weight").value) || 0,
    qty: parseInt(document.getElementById("if-qty").value) || 1,
    description: document.getElementById("if-desc").value.trim()
  };
}

function weaponFieldsHtml(weapon) {
  weapon = weapon || {};
  const profValue = weapon.proficientOverride === undefined || weapon.proficientOverride === null
    ? "derived" : (weapon.proficientOverride ? "yes" : "no");
  return `
    <div class="field-row">
      ${selectFieldHtml("wf-ability", "Attack Ability", Object.keys(ABILITY_FULL_NAMES), weapon.attackAbility || "STR")}
      <div class="field"><label>Magic Bonus</label><input id="wf-magic" type="number" value="${weapon.magicBonus || 0}"></div>
    </div>
    <div class="field-row">
      ${selectFieldHtml("wf-type", "Attack Type", [{ value: "melee", label: "Melee" }, { value: "ranged", label: "Ranged" }], weapon.weaponType || "melee")}
      <div class="field"><label>Range</label><input id="wf-range" value="${esc(weapon.range || "")}" placeholder="5 ft"></div>
    </div>
    <div class="field-row">
      ${comboFieldHtml("wf-req", "Requires Proficiency", "None", weapon.proficiencyRequired)}
      ${selectFieldHtml("wf-prof", "Proficient?", [
        { value: "derived", label: "Auto" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }
      ], profValue)}
    </div>
    <div class="field"><label>Damage</label></div>
    <div id="damage-rows"></div>
    <button class="add-link" id="add-damage-button">+ Add Damage Type</button>
    <div class="field" style="margin-top:16px;"><label>Properties</label></div>
    <div id="property-picker"></div>
    ${comboFieldHtml("wf-ammo", "Spends Ammunition From", "None", weapon.ammunition)}
    <div class="field"><label>Source (optional — leave blank for "Custom")</label><input id="wf-source" value="${esc(weapon.customSource || "")}"></div>`;
}

function wireWeaponFields(state) {
  wireSelect("wf-ability");
  wireSelect("wf-type");
  wireSelect("wf-prof");
  wireCombo("wf-req", WEAPON_PROFICIENCY_TYPES);
  wireCombo("wf-ammo", character.resources.map(r => r.name));

  const rows = document.getElementById("damage-rows");
  renderDamageRows(rows, state.damage);
  document.getElementById("add-damage-button").addEventListener("click", () => {
    state.damage.push({ dice: "1d4", type: DAMAGE_TYPES[0] });
    renderDamageRows(rows, state.damage);
  });
  renderPropertyPicker(document.getElementById("property-picker"), state.properties);
}

function readWeaponFields(state) {
  const prof = document.getElementById("wf-prof").value;
  return {
    isWeapon: true,
    attackAbility: document.getElementById("wf-ability").value,
    magicBonus: parseInt(document.getElementById("wf-magic").value) || 0,
    weaponType: document.getElementById("wf-type").value,
    range: document.getElementById("wf-range").value.trim(),
    proficiencyRequired: document.getElementById("wf-req").value.trim(),
    ammunition: document.getElementById("wf-ammo").value.trim(),
    customSource: document.getElementById("wf-source").value.trim(),
    damage: readDamageRows(state.damage),
    properties: state.properties.slice(),
    proficientOverride: prof === "derived" ? undefined : prof === "yes"
  };
}

function armourFieldsHtml(item) {
  const armour = (item && item.armour) || {};
  return `
    <div class="field-row">
      <div class="field"><label>Base AC</label><input id="af-base" type="number" value="${armour.base != null ? armour.base : 11}"></div>
      ${selectFieldHtml("af-kind", "Armour Type", ARMOUR_KINDS, armour.kind || "light")}
    </div>
    <div class="field"><label>Max Dexterity Bonus</label>
      <input id="af-dexcap" type="number" value="${armour.dexCap != null ? armour.dexCap : ""}" placeholder="Blank for no limit">
    </div>
    <div class="menu-note" style="margin-top:0;">A shield's base is the bonus it adds and stacks with worn armour. Anything else replaces the unarmoured 10.</div>`;
}

function wireArmourFields() {
  wireSelect("af-kind");
  // switching kind drops in that kind's usual Dexterity limit
  document.getElementById("af-kind").addEventListener("change", (e) => {
    const kind = ARMOUR_KINDS.find(k => k.value === e.target.value);
    document.getElementById("af-dexcap").value = kind && kind.dexCap != null ? kind.dexCap : "";
  });
}

function readArmourFields() {
  const raw = document.getElementById("af-dexcap").value.trim();
  return {
    base: parseInt(document.getElementById("af-base").value) || 0,
    kind: document.getElementById("af-kind").value,
    dexCap: raw === "" ? null : (parseInt(raw) || 0)
  };
}

// keeps the stored object honest when the type changes -- a former weapon
// shouldn't keep its damage list once it becomes gear
function applyItemType(item, type, state) {
  if (type === "weapon") {
    Object.assign(item, readWeaponFields(state));
    delete item.armour;
    return;
  }
  ["isWeapon", "attackAbility", "magicBonus", "weaponType", "range", "proficiencyRequired",
   "proficientOverride", "ammunition", "customSource", "damage", "properties", "twoHanded", "isDefaultLoadout"]
    .forEach(key => delete item[key]);
  if (type === "armour") item.armour = readArmourFields();
  else delete item.armour;
}

function renderItemTypeFields(container, type, item, state) {
  container.innerHTML = type === "weapon" ? weaponFieldsHtml(item)
    : type === "armour" ? armourFieldsHtml(item) : "";
  if (type === "weapon") wireWeaponFields(state);
  if (type === "armour") wireArmourFields();
}

function wireItemTypeToggle(state, container, item) {
  document.querySelectorAll("[data-item-type]").forEach(button => {
    button.addEventListener("click", () => {
      state.type = button.dataset.itemType;
      document.querySelectorAll("[data-item-type]").forEach(other =>
        other.classList.toggle("active", other.dataset.itemType === state.type));
      renderItemTypeFields(container, state.type, item, state);
    });
  });
}

function newItemFormState(item) {
  item = item || {};
  return {
    type: item.name ? itemType(item) : "gear",
    damage: JSON.parse(JSON.stringify(item.damage && item.damage.length
      ? item.damage : [{ dice: "1d4", type: DAMAGE_TYPES[0], ability: "STR" }])),
    properties: (item.properties || []).slice()
  };
}

function openAddInventoryModal(presetCategory, presetType) {
  const categories = Object.keys(character.categoryRules);
  let mode = "item";

  openModal("full", `
    <div class="modal-heading">Add to Inventory</div>
    <div class="btn-row-2" style="margin-bottom:14px;">
      <button class="toggle-btn active" id="mode-invitem-btn" style="flex:1;padding:10px 0;">Add Item</button>
      <button class="toggle-btn" id="mode-invcat-btn" style="flex:1;padding:10px 0;">Add Category</button>
    </div>
    <div id="add-inv-body"></div>
  `);

  const modeItemBtn = document.getElementById("mode-invitem-btn");
  const modeCatBtn = document.getElementById("mode-invcat-btn");
  const body = document.getElementById("add-inv-body");

  const state = newItemFormState();
  if (presetType) state.type = presetType;

  function renderItemBody() {
    const defaultCat = presetCategory && categories.includes(presetCategory) ? presetCategory : categories[0];
    body.innerHTML = `
      ${itemTypeToggleHtml(state.type)}
      ${commonItemFieldsHtml({ category: defaultCat })}
      <div id="type-fields"></div>
      <button class="btn-primary" id="save-item-button" style="margin-top:16px;">Add Item</button>
    `;
    wireSelect("if-category");
    wireItemResourceFields(null);

    const typeFields = document.getElementById("type-fields");
    renderItemTypeFields(typeFields, state.type, null, state);
    wireItemTypeToggle(state, typeFields, null);

    document.getElementById("save-item-button").addEventListener("click", () => {
      const newId = Math.max(0, ...character.inventory.map(i => i.id)) + 1;
      const item = Object.assign({ id: newId }, readCommonItemFields());

      const acBonus = parseInt(document.getElementById("if-ac").value) || 0;
      const attackBonus = parseInt(document.getElementById("if-atkb").value) || 0;
      if (acBonus) item.acBonus = acBonus;
      if (attackBonus) item.attackBonus = attackBonus;
      const tracked = readItemResourceFields(null);
      if (tracked) item.resource = tracked;

      applyItemType(item, state.type, state);

      character.inventory.push(item);
      openInvCategories[item.category] = true;
      closeModal();
      renderContent();
    });
  }

  function renderCategoryBody() {
    body.innerHTML = `
      <div class="field"><label>Name</label><input id="new-cat-name" placeholder="e.g. Familiar's Pouch"></div>
      <div class="toggle-line"><span>Counts toward carry weight</span><div class="switch" id="sw-weight"><div class="knob"></div></div></div>
      <div class="toggle-line"><span>Applies item effects (like Worn/Equipped)</span><div class="switch" id="sw-effects"><div class="knob"></div></div></div>
      <div class="toggle-line"><span>Weapons here appear under Attacks</span><div class="switch" id="sw-attacks"><div class="knob"></div></div></div>
      <button class="btn-primary" id="save-cat-button">Create Category</button>
    `;
    let weightOn = false, effectsOn = false, attacksOn = false;
    document.getElementById("sw-weight").addEventListener("click", (e) => { weightOn = !weightOn; e.currentTarget.classList.toggle("on", weightOn); });
    document.getElementById("sw-effects").addEventListener("click", (e) => { effectsOn = !effectsOn; e.currentTarget.classList.toggle("on", effectsOn); });
    document.getElementById("sw-attacks").addEventListener("click", (e) => { attacksOn = !attacksOn; e.currentTarget.classList.toggle("on", attacksOn); });
    document.getElementById("save-cat-button").addEventListener("click", () => {
      const name = document.getElementById("new-cat-name").value.trim();
      if (!name || character.categoryRules[name]) { closeModal(); return; }
      character.categoryRules[name] = { countsWeight: weightOn, appliesEffects: effectsOn, providesAttacks: attacksOn };
      openInvCategories[name] = true;
      closeModal();
      renderContent();
    });
  }

  modeItemBtn.addEventListener("click", () => {
    if (mode === "item") return;
    mode = "item";
    modeItemBtn.classList.add("active");
    modeCatBtn.classList.remove("active");
    renderItemBody();
  });
  modeCatBtn.addEventListener("click", () => {
    if (mode === "category") return;
    mode = "category";
    modeCatBtn.classList.add("active");
    modeItemBtn.classList.remove("active");
    renderCategoryBody();
  });

  renderItemBody();
}

function openEditCategoryModal(category) {
  const rule = character.categoryRules[category];
  let weightOn = rule.countsWeight, effectsOn = rule.appliesEffects, attacksOn = !!rule.providesAttacks;

  openModal("sheet", `
    <div class="modal-heading">Edit Category</div>
    <div class="field"><label>Name</label><input id="edit-cat-name" value="${esc(category)}"></div>
    <div class="toggle-line"><span>Counts toward carry weight</span><div class="switch ${weightOn ? "on" : ""}" id="sw-edit-weight"><div class="knob"></div></div></div>
    <div class="toggle-line"><span>Applies item effects (like Worn/Equipped)</span><div class="switch ${effectsOn ? "on" : ""}" id="sw-edit-effects"><div class="knob"></div></div></div>
    <div class="toggle-line"><span>Weapons here appear under Attacks</span><div class="switch ${attacksOn ? "on" : ""}" id="sw-edit-attacks"><div class="knob"></div></div></div>
    <div class="btn-row-2">
      <button class="btn-primary" id="save-cat-edit-button">Save Changes</button>
      <button class="btn-primary" id="remove-cat-button" style="background:#5A2C29;color:#F0908A;">Remove</button>
    </div>
  `);
  document.getElementById("sw-edit-weight").addEventListener("click", (e) => { weightOn = !weightOn; e.currentTarget.classList.toggle("on", weightOn); });
  document.getElementById("sw-edit-effects").addEventListener("click", (e) => { effectsOn = !effectsOn; e.currentTarget.classList.toggle("on", effectsOn); });
  document.getElementById("sw-edit-attacks").addEventListener("click", (e) => { attacksOn = !attacksOn; e.currentTarget.classList.toggle("on", attacksOn); });

  document.getElementById("save-cat-edit-button").addEventListener("click", () => {
    const newName = document.getElementById("edit-cat-name").value.trim();
    if (!newName || (newName !== category && character.categoryRules[newName])) { closeModal(); return; }
    const newRule = { countsWeight: weightOn, appliesEffects: effectsOn, providesAttacks: attacksOn };
    if (newName !== category) {
      delete character.categoryRules[category];
      character.categoryRules[newName] = newRule;
      character.inventory.forEach(item => { if (item.category === category) item.category = newName; });
      if (openInvCategories[category] !== undefined) {
        openInvCategories[newName] = openInvCategories[category];
        delete openInvCategories[category];
      }
    } else {
      character.categoryRules[category] = newRule;
    }
    closeModal();
    renderContent();
  });
  document.getElementById("remove-cat-button").addEventListener("click", () => {
    const count = character.inventory.filter(i => i.category === category).length;
    const warning = count > 0
      ? `This category contains ${count} item${count === 1 ? "" : "s"} that will also be deleted. Remove "${esc(category)}"?`
      : `Remove empty category "${esc(category)}"?`;
    if (!confirm(warning)) return;
    delete character.categoryRules[category];
    character.inventory = character.inventory.filter(i => i.category !== category);
    delete openInvCategories[category];
    closeModal();
    renderContent();
  });
}

/* Tapping an item shows what it is; editing is a deliberate second step. Same
   split as an attack, a skill or an effect -- looking at something shouldn't
   drop you into a form. */
function openItemDetailModal(itemId) {
  const item = character.inventory.find(i => i.id == itemId);
  if (!item) return;
  const rule = character.categoryRules[item.category] || {};
  const quantity = item.qty || 1;
  const type = itemType(item);

  const facts = [];
  facts.push(["Category", item.category + (rule.providesAttacks && item.isWeapon ? " · drawn" : "")]);
  if (quantity > 1) facts.push(["Quantity", String(quantity)]);
  facts.push(["Weight", rule.countsWeight
    ? (item.weight * quantity) + " lb" + (quantity > 1 ? " (" + item.weight + " each)" : "")
    : "not carried"]);

  if (type === "armour") {
    facts.push(["Base AC", String(item.armour.base)]);
    facts.push(["Armour Type", (ARMOUR_KINDS.find(k => k.value === item.armour.kind) || {}).label || item.armour.kind]);
    facts.push(["Max Dexterity", item.armour.dexCap === null || item.armour.dexCap === undefined ? "no limit" : String(item.armour.dexCap)]);
  }
  if (item.acBonus) facts.push(["AC Bonus", formatModifier(item.acBonus)]);
  if (item.attackBonus) facts.push(["Attack Bonus", formatModifier(item.attackBonus)]);
  if (item.resource) {
    const container = isContainer(item);
    facts.push(["Tracked", container ? "Container, under Resources" : "Stack, under Resources"]);
    if (container) {
      facts.push(["Holds", (item.resource.loaded || 0) + " of " + item.resource.max]);
      facts.push(["Refills from", item.resource.refillFrom]);
    } else if (item.resource.max) {
      facts.push(["Capacity", String(item.resource.max)]);
    }
    if (rechargeLabel(item.resource.recharge) !== "\u2014") {
      facts.push(["Recharges", rechargeLabel(item.resource.recharge)]);
    }
  }

  let weaponBlock = "";
  if (type === "weapon") {
    const atk = calculateAttack(character, item);
    weaponBlock = `
      <div class="breakdown-subhead">Attack</div>
      <div class="breakdown-row"><span>To Hit</span><span>${formatModifier(atk.toHitTotal)}</span></div>
      ${atk.damage.map(part => `
        <div class="breakdown-row"><span>${esc(part.type || "Damage")}</span><span>${esc(part.notation)}</span></div>
      `).join("")}
      <div class="breakdown-row"><span>Proficiency</span><span>${atk.proficiency.proficient ? "yes" : "no"}${atk.proficiency.required ? " (needs " + esc(atk.proficiency.required) + ")" : ""}</span></div>
      ${item.properties && item.properties.length ? `<div class="breakdown-row"><span>Properties</span><span>${esc(item.properties.join(", "))}</span></div>` : ""}
      ${rule.providesAttacks ? "" : `<div class="menu-note">Stowed in ${esc(item.category)}, so it isn't on your Attacks list.</div>`}`;
  }

  openModal("full", `
    <div class="modal-heading-row">
      <div class="modal-heading">${esc(item.name)}</div>
      <button class="icon-btn-delete" id="detail-delete-trigger" title="Remove item">🗑</button>
    </div>
    ${item.description ? `<div class="effect-note">${esc(item.description)}</div>` : ""}

    <div class="breakdown-subhead">Details</div>
    ${facts.map(([label, value]) => `<div class="breakdown-row"><span>${esc(label)}</span><span>${esc(value)}</span></div>`).join("")}
    ${weaponBlock}

    <div class="btn-row-2" style="margin-top:22px;">
      <button class="btn-primary" id="detail-edit-button">Edit</button>
      <button class="btn-primary" id="detail-give-button" style="background:#242019;color:#F5C37A;">Give</button>
    </div>
  `);

  document.getElementById("detail-edit-button").addEventListener("click", () => openItemEditModal(itemId));
  document.getElementById("detail-give-button").addEventListener("click", () => startGiveFlow(item));
  document.getElementById("detail-delete-trigger").addEventListener("click", () => confirmDeleteItem(item));
}

function openItemEditModal(itemId) {
  const item = character.inventory.find(i => i.id == itemId);
  const state = newItemFormState(item);

  openModal("full", `
    <div class="modal-heading-row">
      <div class="modal-heading">Edit Item</div>
      <button class="icon-btn-delete" id="delete-item-trigger" title="Remove item">\uD83D\uDDD1</button>
    </div>
    ${itemTypeToggleHtml(state.type)}
    ${commonItemFieldsHtml(item)}
    <div id="type-fields"></div>
    <div class="btn-row-2" style="margin-top:16px;">
      <button class="btn-primary" id="save-item-edit-button">Save Changes</button>
      <button class="btn-primary" id="give-item-button" style="background:#242019;color:#F5C37A;">Give</button>
    </div>
  `);

  wireSelect("if-category");
  wireItemResourceFields(item);
  const typeFields = document.getElementById("type-fields");
  renderItemTypeFields(typeFields, state.type, item, state);
  wireItemTypeToggle(state, typeFields, item);

  document.getElementById("save-item-edit-button").addEventListener("click", () => {
    Object.assign(item, readCommonItemFields());
    const ac = parseInt(document.getElementById("if-ac").value) || 0;
    const atkb = parseInt(document.getElementById("if-atkb").value) || 0;
    if (ac) item.acBonus = ac; else delete item.acBonus;
    if (atkb) item.attackBonus = atkb; else delete item.attackBonus;
    const tracked = readItemResourceFields(item);
    if (tracked) item.resource = tracked; else delete item.resource;

    applyItemType(item, state.type, state);

    closeModal();
    renderContent();
  });
  document.getElementById("delete-item-trigger").addEventListener("click", () => {
    confirmDeleteItem(item);
  });
  document.getElementById("give-item-button").addEventListener("click", () => {
    startGiveFlow(item);
  });
}

function confirmDeleteItem(item) {
  openModal("center", `
    <div class="modal-heading">Remove ${esc(item.name)}?</div>
    <div class="breakdown-source" style="margin-bottom:14px;">This can't be undone.</div>
    <button class="btn-primary" id="confirm-remove-item-button" style="background:#5A2C29;color:#F0908A;margin-bottom:8px;">Remove</button>
    <button class="btn-secondary" id="cancel-remove-item-button">Cancel</button>
  `);
  document.getElementById("confirm-remove-item-button").addEventListener("click", () => {
    character.inventory = character.inventory.filter(i => i.id !== item.id);
    closeModal();
    renderContent();
    showToast("Removed " + item.name);
  });
  document.getElementById("cancel-remove-item-button").addEventListener("click", closeModal);
}


/* ---------- give item flow ---------- */

function startGiveFlow(item) {
  if ((item.qty || 1) > 1) openGiveQuantityModal(item);
  else openGiveToModal(item, 1);
}

function openGiveQuantityModal(item) {
  const max = item.qty || 1;
  let qty = 1;
  openModal("center", `
    <div class="modal-heading">How many?</div>
    <div class="stepper-lg">
      <button id="give-qty-minus">\u2212</button>
      <span class="stepper-lg-value" id="give-qty-value">1</span>
      <button id="give-qty-plus">+</button>
    </div>
    <button class="btn-primary" id="give-qty-confirm">Confirm</button>
  `);
  const valueEl = document.getElementById("give-qty-value");
  document.getElementById("give-qty-minus").addEventListener("click", () => { qty = Math.max(1, qty - 1); valueEl.textContent = qty; });
  document.getElementById("give-qty-plus").addEventListener("click", () => { qty = Math.min(max, qty + 1); valueEl.textContent = qty; });
  document.getElementById("give-qty-confirm").addEventListener("click", () => openGiveToModal(item, qty));
}

function partyRosterForGiving() {
  return character.partyMembers.map(m => {
    const isGM = /\(GM\)/i.test(m);
    return { name: m.replace(/\s*\(GM\)/i, "").trim(), role: isGM ? "GM" : "Player" };
  });
}

function openGiveToModal(item, qty) {
  const roster = partyRosterForGiving();
  let selected = null;

  openModal("full", `
    <div class="modal-heading">Give to</div>
    <div id="give-to-list">
      ${roster.map((m, i) => `
        <div class="recipient-row" data-give-to="${i}">
          <div class="recipient-left">
            <div class="char-avatar">${m.name.charAt(0).toUpperCase()}</div>
            <div>
              <div class="recipient-name">${esc(m.name)}</div>
              <div class="recipient-role">${m.role}</div>
            </div>
          </div>
          <div class="radio-dot" data-radio="${i}"></div>
        </div>
      `).join("")}
    </div>
    <button class="btn-primary btn-disabled" id="give-to-confirm" disabled>Confirm</button>
  `);

  document.querySelectorAll("[data-give-to]").forEach(row => {
    row.addEventListener("click", () => {
      selected = parseInt(row.dataset.giveTo);
      document.querySelectorAll("[data-radio]").forEach(dot => dot.classList.toggle("selected", parseInt(dot.dataset.radio) === selected));
      const confirmBtn = document.getElementById("give-to-confirm");
      confirmBtn.disabled = false;
      confirmBtn.classList.remove("btn-disabled");
    });
  });

  document.getElementById("give-to-confirm").addEventListener("click", () => {
    if (selected === null) return;
    applyGive(item, qty, roster[selected].name);
  });
}

function applyGive(item, qty, recipientName) {
  const currentQty = item.qty || 1;
  if (qty >= currentQty) character.inventory = character.inventory.filter(i => i.id !== item.id);
  else item.qty = currentQty - qty;
  closeModal();
  renderContent();
  showToast("Gave " + qty + " " + item.name + " to " + recipientName);
}




/* ============================================================
   NOTES TAB
   ============================================================ */

let openNoteSections = {};
let notesSort = "custom"; // "custom" | "az" | "latest" | "oldest"
let suppressNoteClickUntil = 0;

function sortNotesForDisplay(notes) {
  if (notesSort === "az") return [...notes].sort((a, b) => (a.title || "Untitled").localeCompare(b.title || "Untitled"));
  if (notesSort === "latest") return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  if (notesSort === "oldest") return [...notes].sort((a, b) => a.updatedAt - b.updatedAt);
  return notes;
}

function renderNotesTab() {
  return `
    <div class="section-head-row">
      <div class="section-head">Notes</div>
      <button class="add-link" id="add-section-button">+ New Section</button>
    </div>
    <div class="filter-row">
      <button class="toggle-btn ${notesSort === "custom" ? "active" : ""}" data-sort="custom">Custom</button>
      <button class="toggle-btn ${notesSort === "az" ? "active" : ""}" data-sort="az">A\u2013Z</button>
      <button class="toggle-btn ${notesSort === "latest" ? "active" : ""}" data-sort="latest">Latest</button>
      <button class="toggle-btn ${notesSort === "oldest" ? "active" : ""}" data-sort="oldest">Oldest</button>
    </div>
    <div id="note-sections">
      ${character.noteSections.map(sec => renderNoteSectionBlock(sec)).join("")}
    </div>
  `;
}

function renderNoteSectionBlock(sec) {
  const isOpen = openNoteSections[sec.id] !== false;
  const notes = sortNotesForDisplay(character.notes.filter(n => n.sectionId === sec.id));
  return `
    <div class="section-head-row" data-note-sec-card="${sec.id}" data-note-sec-toggle="${sec.id}" style="cursor:pointer;touch-action:none;">
      <div class="section-head">${esc(sec.name)}${sec.receiveFrom ? `<span class="receive-dot" title="Receiving shared notes here"></span>` : ""}</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button class="add-link" data-add-note="${sec.id}">+ Add</button>
        <button class="mini-edit" data-edit-section="${sec.id}">\u270E</button>
        <span style="color:#9C9186;font-size:12px;">${isOpen ? "\u2212" : "+"}</span>
      </div>
    </div>
    <div data-note-sec-body="${sec.id}" style="${isOpen ? "" : "display:none;"}">
      ${notes.map(n => renderNoteRow(n)).join("") || `<div class="empty-hint">No notes yet</div>`}
    </div>
  `;
}

function renderNoteRow(n) {
  const preview = n.body ? n.body.slice(0, 60) + (n.body.length > 60 ? "\u2026" : "") : "";
  let tag = "";
  if (n.sharing) {
    tag = n.sharing.sharedByMe
      ? `<span class="share-tag share-tag-out">\u2191 Sharing</span>`
      : `<span class="share-tag share-tag-in">\u2193 ${esc(n.sharing.sharedByName)}</span>`;
  }
  return `
    <div class="item-row note-row" data-note-view="${n.id}" data-note-id="${n.id}" style="touch-action:none;">
      <div style="flex:1;">
        <div class="item-name">${esc(n.title || "Untitled")}${esc(tag)}</div>
        ${preview ? `<div class="item-meta">${esc(preview)}</div>` : ""}
      </div>
    </div>
  `;
}

function wireNotesTab() {
  document.getElementById("add-section-button").addEventListener("click", openAddSectionModal);

  document.querySelectorAll("[data-sort]").forEach(btn => {
    btn.addEventListener("click", () => { notesSort = btn.dataset.sort; renderContent(); });
  });

  document.querySelectorAll("[data-note-sec-toggle]").forEach(head => {
    head.addEventListener("click", (e) => {
      if (Date.now() < suppressNoteClickUntil) return;
      if (e.target.closest("[data-edit-section], [data-add-note]")) return;
      const id = head.dataset.noteSecToggle;
      openNoteSections[id] = !(openNoteSections[id] !== false);
      renderContent();
    });
  });
  document.querySelectorAll("[data-edit-section]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); openEditSectionModal(btn.dataset.editSection); });
  });
  document.querySelectorAll("[data-add-note]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); createNote(btn.dataset.addNote); });
  });
  document.querySelectorAll("[data-note-view]").forEach(row => {
    row.addEventListener("click", () => {
      if (Date.now() < suppressNoteClickUntil) return;
      openNoteEditorModal(row.dataset.noteView);
    });
  });

  if (notesSort === "custom") { wireNoteSectionDragging(); wireNoteDragging(); }
}

function createNote(sectionId) {
  sectionId = parseInt(sectionId);
  const section = character.noteSections.find(s => s.id === sectionId);
  const newId = Math.max(0, ...character.notes.map(n => n.id)) + 1;
  const now = Date.now();
  const note = { id: newId, sectionId, title: "", body: "", createdAt: now, updatedAt: now, sharing: null };
  if (section.autoShare) {
    note.sharing = {
      sharedByMe: true, continuous: true,
      sharedWith: character.partyMembers.map(m => ({ name: m, permission: "edit" }))
    };
  }
  character.notes.push(note);
  openNoteSections[sectionId] = true;
  renderContent();
  openNoteEditorModal(newId);
}

function wireNoteSectionDragging() {
  const wrap = document.getElementById("note-sections");
  document.querySelectorAll("[data-note-sec-card]").forEach(card => {
    attachHoldDrag(card, {
      onStart: () => card.classList.add("dragging"),
      onMove: (e) => {
        const body = document.querySelector(`[data-note-sec-body="${card.dataset.noteSecCard}"]`);
        const siblings = Array.from(wrap.querySelectorAll("[data-note-sec-card]")).filter(c => c !== card);
        let placed = false;
        for (const sib of siblings) {
          const box = sib.getBoundingClientRect();
          if (e.clientY < box.top + box.height / 2) {
            wrap.insertBefore(card, sib);
            wrap.insertBefore(body, sib);
            placed = true;
            break;
          }
        }
        if (!placed) { wrap.appendChild(card); wrap.appendChild(body); }
      },
      onEnd: () => {
        card.classList.remove("dragging");
        suppressNoteClickUntil = Date.now() + 300;
        const order = Array.from(wrap.querySelectorAll("[data-note-sec-card]")).map(c => parseInt(c.dataset.noteSecCard));
        character.noteSections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        renderContent();
      }
    });
  });
}

function wireNoteDragging() {
  document.querySelectorAll(".note-row").forEach(row => {
    attachHoldDrag(row, {
      onStart: () => row.classList.add("dragging"),
      onMove: (e) => {
        const bodies = Array.from(document.querySelectorAll("[data-note-sec-body]"));
        let targetBody = null;
        for (const b of bodies) {
          const box = b.getBoundingClientRect();
          if (e.clientY >= box.top - 20 && e.clientY <= box.bottom + 20) { targetBody = b; break; }
        }
        if (!targetBody) return;
        const hint = targetBody.querySelector(".empty-hint");
        if (hint) hint.remove();
        const rows = Array.from(targetBody.querySelectorAll(".note-row")).filter(r => r !== row);
        let placed = false;
        for (const r of rows) {
          const box = r.getBoundingClientRect();
          if (e.clientY < box.top + box.height / 2) {
            targetBody.insertBefore(row, r);
            placed = true;
            break;
          }
        }
        if (!placed) targetBody.appendChild(row);
      },
      onEnd: () => {
        row.classList.remove("dragging");
        suppressNoteClickUntil = Date.now() + 300;

        const noteId = parseInt(row.dataset.noteId);
        const note = character.notes.find(n => n.id === noteId);
        const newBody = row.closest("[data-note-sec-body]");
        const newSectionId = newBody ? parseInt(newBody.dataset.noteSecBody) : note.sectionId;
        if (newSectionId !== note.sectionId) {
          const targetSection = character.noteSections.find(s => s.id === newSectionId);
          maybeSyncNoteSharingToSection(note, targetSection);
        }

        const newNotes = [];
        document.querySelectorAll("[data-note-sec-body]").forEach(body => {
          const secId = parseInt(body.dataset.noteSecBody);
          body.querySelectorAll(".note-row").forEach(r => {
            const n = character.notes.find(x => x.id == r.dataset.noteId);
            if (n) { n.sectionId = secId; newNotes.push(n); }
          });
        });
        character.notes = newNotes;
        renderContent();
      }
    });
  });
}

// Sections only carry an on/off auto-share setting (not full per-member
// permissions), so "syncing" means offering to match that on/off state.
// Only offered for notes the person actually controls the sharing of —
// received notes keep whatever the original sharer set.
function maybeSyncNoteSharingToSection(note, targetSection) {
  if (note.sharing && !note.sharing.sharedByMe) return;
  const currentlyShared = !!note.sharing;

  if (targetSection.autoShare && !currentlyShared) {
    if (confirm(`"${targetSection.name}" auto-shares notes with the whole party. Share this note the same way?`)) {
      note.sharing = {
        sharedByMe: true, continuous: true,
        sharedWith: character.partyMembers.map(m => ({ name: m, permission: "edit" }))
      };
    }
  } else if (!targetSection.autoShare && currentlyShared) {
    if (confirm(`"${targetSection.name}" doesn't auto-share notes. Stop sharing this note?`)) {
      note.sharing = null;
    }
  }
}

function openAddSectionModal() {
  openModal("sheet", `
    <div class="modal-heading">New Section</div>
    <div class="field"><label>Name</label><input id="new-sec-name" placeholder="e.g. Quest Log"></div>
    <div class="toggle-line"><span>Auto-share notes added here</span><div class="switch" id="sw-autoshare"><div class="knob"></div></div></div>
    <div class="toggle-line"><span>Receive shared notes here</span><div class="switch" id="sw-receive"><div class="knob"></div></div></div>
    <button class="btn-primary" id="save-sec-button">Create Section</button>
  `);
  let autoShare = false, receiveFrom = false;
  document.getElementById("sw-autoshare").addEventListener("click", (e) => { autoShare = !autoShare; e.currentTarget.classList.toggle("on", autoShare); });
  document.getElementById("sw-receive").addEventListener("click", (e) => { receiveFrom = !receiveFrom; e.currentTarget.classList.toggle("on", receiveFrom); });
  document.getElementById("save-sec-button").addEventListener("click", () => {
    const name = document.getElementById("new-sec-name").value.trim();
    if (!name) { closeModal(); return; }
    const newId = Math.max(0, ...character.noteSections.map(s => s.id)) + 1;
    if (receiveFrom) character.noteSections.forEach(s => { s.receiveFrom = false; });
    character.noteSections.push({ id: newId, name, autoShare, receiveFrom });
    openNoteSections[newId] = true;
    closeModal();
    renderContent();
  });
}

function openEditSectionModal(sectionId) {
  sectionId = parseInt(sectionId);
  const section = character.noteSections.find(s => s.id === sectionId);
  let autoShare = section.autoShare, receiveFrom = section.receiveFrom;

  openModal("sheet", `
    <div class="modal-heading">Edit Section</div>
    <div class="field"><label>Name</label><input id="edit-sec-name" value="${esc(section.name)}"></div>
    <div class="toggle-line"><span>Auto-share notes added here</span><div class="switch ${autoShare ? "on" : ""}" id="sw-edit-autoshare"><div class="knob"></div></div></div>
    <div class="toggle-line"><span>Receive shared notes here</span><div class="switch ${receiveFrom ? "on" : ""}" id="sw-edit-receive"><div class="knob"></div></div></div>
    <div class="btn-row-2">
      <button class="btn-primary" id="save-sec-edit-button">Save Changes</button>
      <button class="btn-primary" id="remove-sec-button" style="background:#5A2C29;color:#F0908A;">Remove</button>
    </div>
  `);

  document.getElementById("sw-edit-autoshare").addEventListener("click", (e) => { autoShare = !autoShare; e.currentTarget.classList.toggle("on", autoShare); });
  document.getElementById("sw-edit-receive").addEventListener("click", (e) => {
    if (!receiveFrom) {
      receiveFrom = true;
      e.currentTarget.classList.add("on");
    } else {
      const othersOn = character.noteSections.some(s => s.id !== sectionId && s.receiveFrom);
      if (!othersOn && !confirm("Turning this off means you won't receive any shared notes until you turn it on for another section. Continue?")) return;
      receiveFrom = false;
      e.currentTarget.classList.remove("on");
    }
  });

  document.getElementById("save-sec-edit-button").addEventListener("click", () => {
    const newName = document.getElementById("edit-sec-name").value.trim();
    if (!newName) { closeModal(); return; }
    section.name = newName;
    section.autoShare = autoShare;
    if (receiveFrom) character.noteSections.forEach(s => { if (s.id !== sectionId) s.receiveFrom = false; });
    section.receiveFrom = receiveFrom;
    closeModal();
    renderContent();
  });
  document.getElementById("remove-sec-button").addEventListener("click", () => {
    const count = character.notes.filter(n => n.sectionId === sectionId).length;
    const warning = count > 0
      ? `This section contains ${count} note${count === 1 ? "" : "s"} that will also be deleted. Remove "${esc(section.name)}"?`
      : `Remove empty section "${esc(section.name)}"?`;
    if (!confirm(warning)) return;
    character.noteSections = character.noteSections.filter(s => s.id !== sectionId);
    character.notes = character.notes.filter(n => n.sectionId !== sectionId);
    delete openNoteSections[sectionId];
    closeModal();
    renderContent();
  });
}

function openNoteEditorModal(noteId) {
  noteId = parseInt(noteId);
  const note = character.notes.find(n => n.id === noteId);
  const section = character.noteSections.find(s => s.id === note.sectionId);
  const isReadOnly = !!(note.sharing && !note.sharing.sharedByMe && note.sharing.permission === "view");

  let shareLine = "";
  if (note.sharing) {
    if (note.sharing.sharedByMe) {
      const names = note.sharing.sharedWith.map(m => `${esc(m.name)} (${m.permission})`).join(", ");
      shareLine = `<div class="share-info">\u2191 Sharing with ${esc(names)}${note.sharing.continuous ? "" : " \u00B7 snapshot"}</div>`;
    } else {
      shareLine = `<div class="share-info">\u2193 Shared by ${esc(note.sharing.sharedByName)}${note.sharing.permission === "view" ? " \u00B7 view only" : ""}</div>`;
    }
  }

  openModal("full", `
    <div class="modal-heading" style="display:flex;justify-content:space-between;align-items:center;">
      <span>${esc(section.name)}</span>
      <button class="add-link" id="note-menu-button" style="font-size:20px;line-height:1;">\u22EF</button>
    </div>
    <input id="note-title-input" class="note-title-field" placeholder="Title" value="${esc(note.title)}" ${isReadOnly ? "readonly" : ""}>
    <div class="item-meta" style="margin-bottom:10px;">${new Date(note.updatedAt).toLocaleString()}</div>
    ${shareLine}
    <textarea id="note-body-input" class="note-body-field" placeholder="Note" ${isReadOnly ? "readonly" : ""}>${esc(note.body)}</textarea>
    <button class="btn-primary" id="save-note-button" style="margin-top:10px;">Save</button>
  `);

  function commit() {
    if (isReadOnly) return;
    note.title = document.getElementById("note-title-input").value;
    note.body = document.getElementById("note-body-input").value;
    note.updatedAt = Date.now();
  }
  if (!isReadOnly) {
    document.getElementById("note-title-input").addEventListener("input", commit);
    document.getElementById("note-body-input").addEventListener("input", commit);
  }

  document.getElementById("save-note-button").addEventListener("click", () => {
    commit();
    closeModal();
    renderContent();
  });

  document.getElementById("note-menu-button").addEventListener("click", () => {
    commit();
    openNoteActionsMenu(noteId);
  });
}

function openNoteActionsMenu(noteId) {
  const note = character.notes.find(n => n.id === noteId);
  const canManageSharing = !note.sharing || note.sharing.sharedByMe;

  openModal("center", `
    <div class="modal-heading">Note Options</div>
    ${canManageSharing ? `<button class="btn-primary" id="menu-share-button" style="margin-bottom:8px;">${note.sharing && note.sharing.sharedByMe ? "Manage Sharing" : "Share"}</button>` : ""}
    <button class="btn-primary" id="menu-dup-button" style="margin-bottom:8px;">Duplicate</button>
    <button class="btn-primary" id="menu-delete-button" style="background:#5A2C29;color:#F0908A;">Delete</button>
  `);

  const shareBtn = document.getElementById("menu-share-button");
  if (shareBtn) shareBtn.addEventListener("click", () => { closeModal(); openShareModal(noteId); });

  document.getElementById("menu-dup-button").addEventListener("click", () => { closeModal(); duplicateNote(noteId); });
  document.getElementById("menu-delete-button").addEventListener("click", () => { closeModal(); deleteNoteWithConfirm(noteId); });
}

// duplicating carries the original's sharing metadata over unchanged (see #3):
// a note shared with you keeps the sharer's access on the duplicate too.
function duplicateNote(noteId) {
  const note = character.notes.find(n => n.id === noteId);
  const newId = Math.max(0, ...character.notes.map(n => n.id)) + 1;
  const now = Date.now();
  const dup = JSON.parse(JSON.stringify(note));
  dup.id = newId;
  dup.title = (note.title || "Untitled") + " copy";
  dup.createdAt = now;
  dup.updatedAt = now;
  character.notes.push(dup);
  renderContent();
  openNoteEditorModal(newId);
}

function deleteNoteWithConfirm(noteId) {
  const note = character.notes.find(n => n.id === noteId);
  if (!note) return;
  if (!confirm(`Delete "${note.title || "Untitled"}"?`)) return;
  character.notes = character.notes.filter(n => n.id !== noteId);
  renderContent();
}

function openShareModal(noteId) {
  const note = character.notes.find(n => n.id === noteId);
  const existing = {};
  if (note.sharing && note.sharing.sharedByMe) {
    note.sharing.sharedWith.forEach(m => { existing[m.name] = m.permission; });
  }
  let continuous = note.sharing && note.sharing.sharedByMe ? note.sharing.continuous : true;

  openModal("full", `
    <div class="modal-heading">Share Note</div>
    <div class="toggle-line"><span>Keep updated for everyone (continuous)</span><div class="switch ${continuous ? "on" : ""}" id="sw-continuous"><div class="knob"></div></div></div>
    <div class="field" style="margin-top:14px;"><label>Party</label></div>
    <div id="share-member-list">
      ${character.partyMembers.map(m => {
        const perm = existing[m] || "off";
        const label = perm === "off" ? "Not shared" : (perm === "edit" ? "Can Edit" : "Can View");
        return `
          <div class="member-row">
            <span>${esc(m)}</span>
            <button class="toggle-btn" data-perm="${perm}" data-member-btn="${esc(m)}">${esc(label)}</button>
          </div>
        `;
      }).join("")}
    </div>
    <button class="btn-primary" id="save-share-button" style="margin-top:14px;">Save Sharing</button>
    ${note.sharing && note.sharing.sharedByMe ? `<button class="btn-primary" id="stop-share-button" style="background:#5A2C29;color:#F0908A;margin-top:8px;">Stop Sharing</button>` : ""}
  `);

  document.getElementById("sw-continuous").addEventListener("click", (e) => { continuous = !continuous; e.currentTarget.classList.toggle("on", continuous); });

  document.querySelectorAll("[data-member-btn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const cycle = { off: "view", view: "edit", edit: "off" };
      const next = cycle[btn.dataset.perm];
      btn.dataset.perm = next;
      btn.textContent = next === "off" ? "Not shared" : (next === "edit" ? "Can Edit" : "Can View");
    });
  });

  document.getElementById("save-share-button").addEventListener("click", () => {
    const sharedWith = [];
    document.querySelectorAll("[data-member-btn]").forEach(btn => {
      if (btn.dataset.perm !== "off") sharedWith.push({ name: btn.dataset.memberBtn, permission: btn.dataset.perm });
    });
    note.sharing = sharedWith.length ? { sharedByMe: true, continuous, sharedWith } : null;
    closeModal();
    renderContent();
    openNoteEditorModal(noteId);
  });

  const stopBtn = document.getElementById("stop-share-button");
  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      note.sharing = null;
      closeModal();
      renderContent();
      openNoteEditorModal(noteId);
    });
  }
}


/* ============================================================
   INIT
   ============================================================ */

const restored = loadCharacters();
showScreen("selector");
if (restored && restored.stale) {
  showToast("Saved characters were from an older version (" + restored.reason + ") and weren't loaded");
}