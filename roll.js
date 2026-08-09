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
  rollState = { config, derived, mode: derived.mode, manual: false, rolled: false };

  /* A roll against a difficulty class waits for the player. Rolling it for
     them the moment the window opens takes away the part they came for. A
     plain roll -- tapping an attack, a skill -- has already been asked for by
     the tap itself, so that one resolves immediately. */
  if (config.dc === undefined) {
    Object.assign(rollState, rollWithMode(config, rollState.mode));
    rollState.rolled = true;
  }

  openModal("center", rollWindowHtml());
  wireRollWindow();
}

function rerollCurrent() {
  Object.assign(rollState, { dropped: null }, rollWithMode(rollState.config, rollState.mode));
  rollState.rolled = true;
  redrawRollWindow();
}

function setRollMode(mode) {
  rollState.mode = mode;
  rollState.manual = mode !== rollState.derived.mode;
  // changing the mode before rolling shouldn't roll for you
  if (rollState.rolled) rerollCurrent(); else redrawRollWindow();
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
  const { config, outcome, dropped, mode, rolled } = rollState;
  const isDamage = config.kind === "damage";
  const hasTarget = config.dc !== undefined;
  const total = rolled ? outcome.total : null;
  const passed = hasTarget && rolled && total >= config.dc;

  const dice = !rolled ? "" : outcome.parts.map(part => {
    const detail = part.result.breakdown.replace(/\d+d\d+\(/g, "(");
    return outcome.parts.length > 1
      ? `<div class="roll-part"><span>${detail}</span><span class="roll-part-total">${part.result.total} ${part.label || ""}</span></div>`
      : `<div>${detail}</div>`;
  }).join("");

  const chips = (config.sources || [])
    .filter(source => source.value !== 0)
    .map(source => `<span class="roll-chip ${source.value > 0 ? "pos" : "neg"}">${esc(source.label)} ${formatModifier(source.value)}</span>`)
    .join("");

  return `
    <div class="roll-title">${esc(config.label)}</div>
    <div class="roll-notation">${esc(config.notation)}</div>

    ${hasTarget ? `
      <div class="roll-dc">
        <div class="roll-dc-label">Difficulty Class</div>
        <div class="roll-dc-value">${config.dc}</div>
      </div>` : ""}

    <div class="roll-values">
      <div class="roll-side">${isDamage && rolled ? `<div class="roll-side-label">½</div><div class="roll-side-value">${Math.floor(total / 2)}</div>` : ""}</div>
      <div class="roll-total ${rolled ? "" : "unrolled"}">${rolled ? total : "—"}</div>
      <div class="roll-side">${isDamage && rolled ? `<div class="roll-side-label">MAX</div><div class="roll-side-value">${maxFor(config)}</div>` : ""}</div>
    </div>

    <div class="roll-dice">${dice}</div>
    ${dropped ? `<div class="roll-dropped">dropped ${dropped.total}</div>` : ""}
    ${hasTarget && rolled ? `
      <div class="roll-verdict ${passed ? "pass" : "fail"}">${passed ? (config.passLabel || "Success") : (config.failLabel || "Failure")}</div>
    ` : ""}

    ${chips ? `<div class="roll-chips">${chips}</div>` : ""}

    <div class="roll-mode-row">
      ${["advantage", "normal", "disadvantage"].map(option => `
        <button class="roll-mode-btn ${mode === option ? "active " + option : ""}" data-roll-mode="${option}">
          ${option === "advantage" ? "ADV" : option === "normal" ? "NORMAL" : "DIS"}
        </button>
      `).join("")}
    </div>
    <div class="roll-why">${rollModeExplanation()}</div>

    ${rolled
      ? `<button class="roll-reroll" id="roll-reroll" title="Roll again">↻</button>`
      : `<button class="btn-primary" id="roll-now" style="margin-top:16px;">Roll ${esc(config.notation)}</button>`}

    ${(config.decisions || []).length ? `
      <div class="btn-row-2" style="margin-top:16px;">
        ${config.decisions.map((decision, index) => `
          <button class="btn-secondary ${esc(decision.tone || "")}" data-roll-decision="${index}">${esc(decision.label)}</button>
        `).join("")}
      </div>` : ""}
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
  const reroll = document.getElementById("roll-reroll");
  if (reroll) reroll.addEventListener("click", rerollCurrent);
  const rollNow = document.getElementById("roll-now");
  if (rollNow) rollNow.addEventListener("click", rerollCurrent);

  document.querySelectorAll("[data-roll-decision]").forEach(button => {
    button.addEventListener("click", () => {
      const decision = rollState.config.decisions[parseInt(button.dataset.rollDecision)];
      if (decision && decision.action) decision.action(rollState.outcome.total);
    });
  });
}
