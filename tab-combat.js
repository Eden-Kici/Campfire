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

/* Exhaustion needs a permanent home rather than only existing once you've
   typed the word into Add Effect -- it's a standing track like death saves,
   not an effect you happen to have. At zero it stays a single quiet line. */
function openExhaustionModal() {
  const level = exhaustionLevel(character);
  openModal("center", `
    <div class="breakdown-title">Exhaustion ${level}</div>
    ${EXHAUSTION_LEVELS.map(tier => `
      <div class="tier-row ${tier.level <= level ? "" : "exhaustion-inactive"}">
        <span class="tier-number">${tier.level}</span>
        <span class="tier-effect">${esc(tier.effect)}</span>
      </div>
    `).join("")}
    <div class="menu-note">Each level adds to the ones below it. A long rest removes one.</div>
  `);
}

function exhaustionRowHtml() {
  const level = exhaustionLevel(character);
  const tiers = exhaustionEffects(level);

  return `
    <div class="res-row exhaustion-row ${level ? "active" : ""}">
      <div class="res-name-wrap" data-exhaustion-detail="1">
        <span class="res-name">Exhaustion</span>
        ${level ? `<span class="res-tag">${esc(tiers[tiers.length - 1].effect)}</span>` : ""}
      </div>
      <div class="stepper">
        <button data-exhaustion-step="-1">−</button>
        <span class="res-count">${level} / 6</span>
        <button data-exhaustion-step="1">+</button>
      </div>
    </div>`;
}

/* The tracks and their controls, shared by the Combat tab card and the panel
   inside the hit point calculator so the two can't drift. */
function deathSaveControlHtml() {
  const state = deathSaveState(character);
  return `
    <div class="death-track">
      <span class="death-label">Successes</span>
      <span class="death-pips">${deathSaveTrackHtml(state.successes, 3, "success")}</span>
    </div>
    <div class="death-track">
      <span class="death-label">Failures</span>
      <span class="death-pips">${deathSaveTrackHtml(state.failures, 3, "failure")}</span>
    </div>
    ${state.dying ? `<button class="btn-primary" data-death-roll style="margin-top:12px;">Roll Death Save</button>` : ""}
    ${state.successes || state.failures ? `<button class="btn-secondary" data-death-clear>Clear</button>` : ""}`;
}

/* This block renders in two places at once, so it can't carry ids and nothing
   here may query the document: every control is found inside the container
   being wired, the same way wireHitDiceCalcRows does it. A document-wide query
   here reached into the open calculator (and back out of it), which left the
   sheet's pips double-wired and the calculator's own controls dead. */
function wireDeathSaveControls(container) {
  if (!container) return;

  container.querySelectorAll("[data-death-pip]").forEach(pip => {
    pip.addEventListener("click", () => {
      setDeathSaveTrack(pip.dataset.deathPip, parseInt(pip.dataset.deathCount));
      afterDeathSaveChange();
    });
  });

  const roll = container.querySelector("[data-death-roll]");
  if (roll) roll.addEventListener("click", () => { rollDeathSave(); afterDeathSaveChange(); });
  const clear = container.querySelector("[data-death-clear]");
  if (clear) clear.addEventListener("click", () => { resetDeathSaves(character); afterDeathSaveChange(); });
}

/* One route out of every death save change, wherever it was made. */
function afterDeathSaveChange() {
  breakConcentrationIfDown();
  renderContent();
}

/* A re-render rebuilds the sheet but never touches an open modal, so the
   calculator's copy of the track is redrawn from the same state here --
   otherwise the card can read two failures while the panel reads none. */
function refreshCalcDeathPanel() {
  const panel = document.getElementById("calc-death-saves");
  if (!panel) return;
  panel.innerHTML = deathSaveControlHtml();
  wireDeathSaveControls(panel);
}

// hidden above 0 hit points unless the setting says otherwise
function deathSaveCardHtml() {
  const state = deathSaveState(character);
  if (character.hp.current > 0 && !state.dead && !settings.alwaysShowDeathSaves) return "";

  const status = state.dead ? "Dead" : state.stable ? "Stable"
    : character.hp.current > 0 ? "Standing" : "Dying";

  return `
    <div class="death-card ${state.dead ? "dead" : state.stable ? "stable" : ""}">
      <div class="death-head">
        <span class="death-title">Death Saves</span>
        <span class="death-status">${status}</span>
      </div>
      ${deathSaveControlHtml()}
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

    <div class="stat-grid" style="margin-top:8px;">
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

    ${exhaustionRowHtml()}

    ${concentrationGroups(character).length ? `
      <div class="conc-row">
        <button class="conc-check" id="concentration-check">Concentrating \u00B7 ${esc(concentrationGroups(character).map(g => effectGroupLabel(g)).join(", "))}</button>
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
        ${usingVisualSlots()
          ? spellSlotPipsHtml(slot, lvl)
          : `<div class="stepper"><button data-slot-minus="${lvl}">\u2212</button><span class="res-count">${slot.current}/${slot.max}</span><button data-slot-plus="${lvl}">+</button></div>`}
      </div>
    `;
    }).join("")}
    ${!spellSlotLevels().length && !resourceRows(character).length
      ? `<div class="empty-hint">No resources yet. Class features that recharge — Second Wind, Rage, spell slots — live here.</div>` : ""}
    ${resourceRows(character).map(row => `
      <div class="res-row">
        <div class="res-name-wrap" data-resource-view="${esc(row.key)}">
          <span class="res-name">${esc(row.name)}</span>
          ${rechargeLabel(row.recharge) === "\u2014" ? "" : `<span class="res-tag">${esc(rechargeLabel(row.recharge))}</span>`}
          ${row.container ? `<span class="res-tag" style="white-space:nowrap;" title="Refills from ${esc(row.refillFrom)}">HOLDS ${esc(row.refillFrom)}</span>` : ""}
        </div>
        <div class="stepper">
          ${row.container ? `<button class="pill-outline" data-res-refill="${esc(row.key)}">Refill</button>` : ""}
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
    ${!weaponList(character).length
      ? `<div class="empty-hint">No attacks yet. Anything in a category that grants attacks shows up here — add a weapon from your Inventory.</div>` : ""}
    ${weaponList(character).map(weapon => {
      const atk = calculateAttack(character, weapon);
      const icon = weapon.weaponType === "ranged" ? "\uD83C\uDFF9" : "\u2694\uFE0F";
      return `
        <div class="atk-row" data-atk-detail="${weapon.id}">
          <div class="atk-icon">${icon}</div>
          <div style="flex:1;min-width:0;">
            <div class="atk-name">${esc(weapon.name)}${atk.proficiency.proficient ? "" : `<span class="atk-warn" title="Not proficient">!</span>`}${atk.offHand ? `<span class="res-tag" style="margin-left:6px;">OFF-HAND</span>` : ""}</div>
            <div class="atk-range">${esc([
              weapon.range,
              atk.damage.map(d => d.type).filter(Boolean).join(" + "),
              atk.ammunition ? atk.ammunition.name + " " + atk.ammunition.current : ""
            ].filter(Boolean).join(" \u00B7 "))}</div>
          </div>
          ${atk.versatile ? `<button class="grip-toggle ${atk.twoHanded ? "two" : ""}" data-grip="${weapon.id}" title="One- or two-handed">${atk.twoHanded ? "2H" : "1H"}</button>` : ""}
          <button class="atk-pill" data-roll-tohit="${weapon.id}">${esc(sheetBonusLabel(atk.toHitTotal, statBonusDice(character, "Attack Rolls")))}</button>
          <button class="atk-pill" data-roll-damage="${weapon.id}">${esc(atk.damageNotation)}</button>
        </div>
      `;
    }).join("")}

    ${pinnedSpells(character).length ? `
      <div class="section-head-row">
        <div class="section-head">Spells</div>
        ${spellSlotLevels().length ? `<span class="slot-summary">${spellSlotLevels().map(lvl =>
          usingVisualSlots()
            ? `<span class="slot-summary-level"><span class="slot-summary-label">${lvl}</span>${spellSlotPipsHtml(character.spellSlots[lvl], lvl)}</span>`
            : `<span class="slot-summary-level"><span class="slot-summary-label">${lvl}</span>${character.spellSlots[lvl].current}/${character.spellSlots[lvl].max}</span>`
        ).join("")}</span>` : ""}
      </div>
      ${pinnedSpells(character).map(spell => renderSpellRow(spell)).join("")}
    ` : ""}
  `;
}

/* Everything here is looked up inside #content. openModal appends its overlay
   to .phone alongside #content, so a document-wide query in a wire function
   reaches into whatever modal happens to be open and wires its controls a
   second time -- the exhaustion stepper moved by 2, 3, 4 for exactly that
   reason, because the effect detail modal draws the same stepper. */
function wireCombatTab() {
  const root = document.getElementById("content");

  root.querySelector("#hp-card").addEventListener("click", openHpCalculator);

  root.querySelectorAll("[data-exhaustion-step]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const next = exhaustionLevel(character) + parseInt(button.dataset.exhaustionStep);
      setExhaustionLevel(character, next);
      renderContent();
    });
  });
  const exhaustionDetail = root.querySelector("[data-exhaustion-detail]");
  if (exhaustionDetail) exhaustionDetail.addEventListener("click", openExhaustionModal);

  wireDeathSaveControls(root.querySelector(".death-card"));
  refreshCalcDeathPanel();

  const ac = calculateAC(character);
  root.querySelector("#ac-box").addEventListener("click", () => openBreakdownModal("AC", ac.total, "", ac.sources));

  const initiative = calculateInitiative(character);
  root.querySelector("#initiative-box").addEventListener("click", () =>
    openBreakdownModal("Initiative", formatModifier(initiative.total), "", initiative.sources,
      { label: "Initiative", notation: "1d20" + formatModifier(initiative.total),
        bonus: bonusLabel(initiative.total, []) }));

  const speed = calculateSpeed(character);
  root.querySelector("#speed-box").addEventListener("click", () => openBreakdownModal("Speed", speed.total, " ft", speed.sources));

  const passivePerception = calculatePassivePerception(character);
  root.querySelector("#passive-perception-box").addEventListener("click", () =>
    openBreakdownModal("Passive Perception", passivePerception.total, "", passivePerception.sources));

  root.querySelector("#prof-bonus-box").addEventListener("click", openEditProficiencyModal);

  root.querySelector("#insp-minus").addEventListener("click", () => { character.inspiration.current--; renderContent(); });
  root.querySelector("#insp-plus").addEventListener("click", () => { character.inspiration.current++; renderContent(); });

  root.querySelector("#add-effect-button").addEventListener("click", openAddEffectModal);
  root.querySelectorAll("[data-effect-remove]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const group = character.activeEffects.find(x => x.id == button.dataset.effectRemove);
      confirmModal({
        title: "Remove " + (group ? effectGroupLabel(group) : "effect") + "?",
        body: "This can't be undone.",
        confirmLabel: "Remove",
        danger: true,
        onConfirm: () => {
          character.activeEffects = character.activeEffects.filter(x => x.id != button.dataset.effectRemove);
          renderContent();
        }
      });
    });
  });
  root.querySelectorAll("[data-effect-view]").forEach(chip => chip.addEventListener("click", () => openEffectDetailModal(chip.dataset.effectView)));

  // dropping concentration removes whatever it was holding up, which is the
  // whole point of hanging effects off a named group
  const concCheck = root.querySelector("#concentration-check");
  if (concCheck) concCheck.addEventListener("click", () => openConcentrationCheckModal());

  const concDrop = root.querySelector("#concentration-drop");
  if (concDrop) concDrop.addEventListener("click", () => {
    const dropped = concentrationGroups(character).map(g => effectGroupLabel(g));
    character.activeEffects = character.activeEffects.filter(g => !g.concentration);
    renderContent();
    showToast("Concentration dropped · " + dropped.join(", ") + " ended");
  });

  root.querySelectorAll("[data-res-minus]").forEach(button => {
    button.addEventListener("click", () => { adjustResourceRow(findResourceRow(character, button.dataset.resMinus), -1); renderContent(); });
  });
  root.querySelectorAll("[data-res-plus]").forEach(button => {
    button.addEventListener("click", () => { adjustResourceRow(findResourceRow(character, button.dataset.resPlus), 1); renderContent(); });
  });
  root.querySelectorAll("[data-res-refill]").forEach(button => {
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
  root.querySelectorAll("[data-resource-view]").forEach(el => el.addEventListener("click", () => {
    const row = findResourceRow(character, el.dataset.resourceView);
    if (!row) return;
    if (row.item) openItemDetailModal(row.item.id);
    else openResourceDetailModal(row.resource.id);
  }));
  root.querySelector("#add-resource-button").addEventListener("click", openAddResourceModal);

  wireSlotPips(root);
  root.querySelectorAll("[data-slot-minus]").forEach(button => {
    button.addEventListener("click", () => { character.spellSlots[button.dataset.slotMinus].current--; renderContent(); });
  });
  root.querySelectorAll("[data-slot-plus]").forEach(button => {
    button.addEventListener("click", () => { character.spellSlots[button.dataset.slotPlus].current++; renderContent(); });
  });
  root.querySelectorAll("[data-slot-view]").forEach(el => {
    el.addEventListener("click", () => openEditSlotsModal(parseInt(el.dataset.slotView)));
  });


  root.querySelectorAll("[data-roll-tohit]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const weapon = character.inventory.find(i => i.id == button.dataset.rollTohit);
      const atk = calculateAttack(character, weapon);
      showRoll({
        label: weapon.name + " \u2013 To Hit",
        notation: withBonusDice("1d20" + formatModifier(atk.toHitTotal), statBonusDice(character, "Attack Rolls")),
        bonus: bonusLabel(atk.toHitTotal, statBonusDice(character, "Attack Rolls")),
        sources: atk.toHitSources,
        kind: "attack",
        /* Spent when the attack is actually thrown, not when the window opens
           and not on a reroll. Opening a roll to look at it used to cost an
           arrow, which is the whole reason rolls now wait for you. */
        onRoll: () => {
          if (!atk.ammunition) return;
          if (atk.ammunition.current <= 0) showToast("Out of " + atk.ammunition.name);
          adjustResourceRow(atk.ammunition, -1);
          renderContent();
        }
      });
    });
  });
  root.querySelectorAll("[data-roll-damage]").forEach(button => {
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
  root.querySelectorAll("[data-grip]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const weapon = character.inventory.find(i => i.id == button.dataset.grip);
      weapon.twoHanded = !weapon.twoHanded;
      renderContent();
    });
  });

  root.querySelectorAll("[data-atk-detail]").forEach(row => row.addEventListener("click", () => openAttackDetailModal(row.dataset.atkDetail)));
  root.querySelector("#add-attack-button").addEventListener("click", openAddAttackModal);

  // pinned spell rows are the Spells tab's own rows, listeners included
  wireSpellRows(root);
}


/* ---------------- HP calculator ---------------- */

function openHpCalculator() {
  let expr = "";
  /* "full" rather than "sheet": the keypad, the actions, the hit dice and the
     death saves are one screen's worth, and at 65% of the phone the actions
     sat on the bottom edge with everything below them out of sight. The six
     dice go in one row of six for the same reason -- in the shared 4-column
     grid they spilled onto a second row with two empty cells. */
  openModal("full", `
    <div class="modal-heading">HP Calculator</div>
    <div class="calc-display"><div class="calc-expr" id="calc-expr">&nbsp;</div></div>
    <div class="calc-grid dice" style="grid-template-columns:repeat(6, 1fr);">${[4, 6, 8, 10, 12, 20].map(d => `<button data-dice="${d}">d${d}</button>`).join("")}</div>
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

    <div class="breakdown-subhead">Death Saves</div>
    <div id="calc-death-saves">${deathSaveControlHtml()}</div>
  `);

  wireHitDiceCalcRows();

  /* The panel is wired to its own container only. Every change redraws the
     sheet behind the calculator, and wireCombatTab redraws this panel from the
     same state on its way through, so neither copy can go stale. */
  wireDeathSaveControls(document.getElementById("calc-death-saves"));

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
    /* A Bonus effect on Healing lifts every point of it -- a ring that makes
       potions work harder, a Life cleric's Disciple of Life. Added once to the
       amount rather than to each die, because the effect describes the healing
       received, not the roll that produced it. */
    const lift = effectsAffectingStat(character, "Healing")
      .reduce((sum, effect) => sum + effectAmount(character, effect), 0);
    const healed = Math.max(0, amount + lift);
    // any healing above zero brings you round and wipes the death save tracks
    const wasDown = character.hp.current <= 0;
    character.hp.current = Math.min(maxHP.total, character.hp.current + healed);
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

    /* Massive damage: if what's left after reaching zero equals or exceeds
       your hit point maximum, you die outright rather than falling unconscious. */
    const alreadyDown = character.hp.current <= 0;
    const overkill = remaining - character.hp.current;
    character.hp.current = Math.max(0, character.hp.current - remaining);

    if (!alreadyDown && overkill >= maxHP.total) {
      recordDeathSave("failure", 3);
      showToast("Killed outright — " + overkill + " past zero, against a maximum of " + maxHP.total);
    } else if (alreadyDown && remaining > 0) {
      recordDeathSave("failure", 1);
    }
    breakConcentrationIfDown();
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
  const held = concentrationGroups(character);
  const dropped = held.map(group => effectGroupLabel(group));
  // anyone we put this on is still holding it, and only we know it is over
  held.forEach(group => partyRevokeEffect(group));
  character.activeEffects = character.activeEffects.filter(group => !group.concentration);
  return dropped;
}

/* Being at nothing is being unconscious, and three failures is worse than
   that; either way concentration ends. Both rests already break it the same
   way, so this is the same rule reached from the other direction. */
function breakConcentrationIfDown() {
  if (character.hp.current > 0 && !deathSaveState(character).dead) return;
  const dropped = dropConcentration();
  if (dropped.length) showToast("Concentration broken · " + dropped.join(", ") + " ended");
}

/* Uses the ordinary roll window rather than a bespoke one, so concentration
   gets advantage, disadvantage, rerolling and the source breakdown for free.
   The window carries a DC and a pair of decisions; nothing happens to the
   character until one of them is chosen, so you can roll as often as you like
   before committing. */
/* Uses the ordinary roll window, so concentration gets advantage,
   disadvantage, rerolling and the source breakdown for free.

   Damage is optional. When it's given the check was forced and there's a DC to
   beat. When the player taps "Concentrating" themselves there is no number to
   beat -- only the table knows it -- so it rolls a plain save and leaves the
   verdict to them. */
function openConcentrationCheckModal(damage) {
  const holding = concentrationGroups(character).map(group => effectGroupLabel(group));
  if (!holding.length) return;

  const save = calculateSavingThrow(character, "CON");
  const forced = damage !== undefined && damage !== null;

  const config = {
    label: "Concentration \u00B7 " + holding.join(", "),
    notation: withBonusDice("1d20" + formatModifier(save.total), savingThrowBonusDice(character, "CON")),
    bonus: bonusLabel(save.total, savingThrowBonusDice(character, "CON")),
    sources: save.sources,
    kind: "save",
    ability: "CON",
    decisions: [
      { label: "Keep it", tone: "outcome-good", action: () => {
          closeModal();
          renderContent();
          showToast("Concentration held");
        } },
      { label: "Lose it", tone: "outcome-bad", action: () => {
          const lost = dropConcentration();
          closeModal();
          renderContent();
          showToast("Lost " + lost.join(", "));
        } }
    ]
  };

  if (forced) config.dc = concentrationSaveDC(damage);
  showRoll(config);
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

/* Each pip is tappable. Tapping the third sets the track to three; tapping the
   one that's currently last clears back to the one below it, so a mistake is
   undone by tapping the same place again. */
function deathSaveTrackHtml(filled, total, kind) {
  let pips = "";
  for (let i = 0; i < total; i++) {
    pips += `<button class="death-pip ${i < filled ? kind : ""}" data-death-pip="${kind}" data-death-count="${i + 1}"></button>`;
  }
  return pips;
}

function setDeathSaveTrack(kind, count) {
  if (!character.deathSaves) resetDeathSaves(character);
  const track = kind === "success" ? "successes" : "failures";
  // tapping the current last pip steps back rather than doing nothing
  character.deathSaves[track] = character.deathSaves[track] === count ? count - 1 : count;
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
    ${textFieldHtml("effect-name", "Name", "", { placeholder: "e.g. Bless, Prone, Hexed" })}
    ${searchListHtml("effect-name-results")}

    <div class="field-row">
      ${selectFieldHtml("effect-duration-type", "Duration", [
        { value: "Rounds", label: "Rounds" },
        { value: "Short Rest", label: "Until Short Rest" },
        { value: "Long Rest", label: "Until Long Rest" },
        { value: "Permanent", label: "Permanent" }
      ], "Permanent")}
      ${fieldHtml("Concentration",
        `<div class="field-control"><div class="switch" id="effect-conc-switch"><div class="knob"></div></div></div>`,
        { className: "field-shrink" })}
    </div>
    <div id="effect-duration-rounds"></div>

    ${textAreaFieldHtml("effect-note", "Note (optional)", "",
      { placeholder: "Anything that won't fit in the name — who cast it, what ends it, table rulings" })}

    ${fieldLabelHtml("Modifiers", { style: "margin-top:14px;" })}
    <div id="effect-effects-list"></div>
    <button class="add-link" id="add-effect-row-button">+ Add Modifier</button>
    <div class="menu-note">Leave the list empty for a label-only reminder with no mechanical effect.</div>
    <button class="btn-primary" id="save-effect-button" style="margin-top:14px;">Add Effect</button>
  `);
  guardModalEdits();

  wireSearchList("effect-name", "effect-name-results", () => ALL_CONDITIONS);
  wireSelect("effect-duration-type");

  const durationTypeSelect = document.getElementById("effect-duration-type");
  const roundsField = document.getElementById("effect-duration-rounds");
  const listEl = document.getElementById("effect-effects-list");

  function renderRoundsField() {
    roundsField.innerHTML = durationTypeSelect.value === "Rounds"
      ? numberFieldHtml("effect-rounds", "Number of Rounds", 1) : "";
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

  /* Only one concentration holds at a time. Ask before the new one ends the
     old one -- silently keeping both would let an effect outlive its cause,
     which is the one thing the effect groups exist to prevent. The ask is
     the app's own dialog now, so it can't block: the save continues in its
     callback instead of after a return value. */
  document.getElementById("save-effect-button").addEventListener("click", () => {
    if (concentration && concentrationGroups(character).length) {
      const holding = concentrationGroups(character).map(g => effectGroupLabel(g));
      const named = document.getElementById("effect-name").value.trim();
      confirmModal({
        title: "End your current concentration?",
        body: "You're concentrating on " + holding.join(", ") + ". Starting "
          + (named || "this effect") + " ends it.",
        confirmLabel: "Start anyway",
        onConfirm: () => saveEffect(dropConcentration())
      });
      return;
    }
    saveEffect([]);
  });

  function saveEffect(replaced) {
    const durationType = durationTypeSelect.value;
    const name = document.getElementById("effect-name").value.trim();

    const newId = makeId(character.activeEffects);
    character.activeEffects.push({
      id: newId,
      name,
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
    if (replaced.length) showToast("Concentration dropped · " + replaced.join(", ") + " ended");
  }
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

/* Handing an effect to someone else's sheet.

   The wording matters and took a moment to get right: you are not giving away
   your Bless, you are putting the person inside it. Your own group keeps its
   concentration; theirs arrives without any, because the rules hang
   concentration on the caster and breaking the target's own concentration by
   blessing them would be plainly wrong. */
function openSendEffectModal(group) {
  const recipients = party.members.filter(m => !m.you);
  openModal("full", `
    <div class="modal-heading">Send ${esc(effectGroupLabel(group))}</div>
    <div class="breakdown-source" style="margin-bottom:10px;">Lands on their sheet straight away. You keep concentration, they don't take it on.</div>
    <div id="send-effect-list">
      ${recipients.map((m, i) => `
        <div class="recipient-row" data-send-to="${i}">
          <div class="recipient-left">
            <div class="char-avatar">${esc(m.name.trim().charAt(0).toUpperCase())}</div>
            <div>
              <div class="recipient-name">${esc(m.name)}</div>
              <div class="recipient-role">${m.owner ? "Host" : "Player"}</div>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
    <button class="btn-secondary" id="send-effect-cancel">Cancel</button>
  `);

  const modal = document.getElementById("modal-overlay");
  modal.querySelectorAll("[data-send-to]").forEach(row => {
    row.addEventListener("click", () => {
      const target = recipients[parseInt(row.dataset.sendTo)];
      const sent = partyPushEffect(group, target.device);
      closeModal();
      showToast(sent ? "Sent " + effectGroupLabel(group) + " to " + target.name
                     : "Not connected \u2014 nothing sent");
    });
  });
  modal.querySelector("#send-effect-cancel").addEventListener("click", closeModal);
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
      ${modifiers.map(e => `<div class="breakdown-row"><span>${esc(e.category)}</span><span>${esc(effectSummaryLabel(e, totalLevel(character)))}</span></div>`).join("")}
    ` : `<div class="empty-hint">No mechanical effect — this is a reminder only.</div>`}
    ${partyMemberNames(party.members, deviceId()).length
      ? `<button class="btn-secondary" id="send-effect-button">Send to a Player</button>` : ""}
    <button class="btn-primary btn-danger" id="remove-effect-button">Remove Effect</button>
  `);
  /* The Combat tab draws an exhaustion stepper of its own, so these lookups
     stay inside the modal -- a document-wide one wired the tab's stepper a
     second time on every chip you opened, and closeModal doesn't re-render, so
     the extra listeners piled up. */
  const modal = document.getElementById("modal-overlay");

  const sendButton = modal.querySelector("#send-effect-button");
  if (sendButton) sendButton.addEventListener("click", () => openSendEffectModal(group));

  modal.querySelector("#remove-effect-button").addEventListener("click", () => {
    const group = character.activeEffects.find(e => e.id == effectId);
    confirmModal({
      title: "Remove " + (group ? effectGroupLabel(group) : "effect") + "?",
      body: "This can't be undone.",
      confirmLabel: "Remove",
      danger: true,
      onConfirm: () => {
        character.activeEffects = character.activeEffects.filter(e => e.id != effectId);
        closeModal();
        renderContent();
      }
    });
  });

  modal.querySelectorAll("[data-exhaustion-step]").forEach(button => {
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
    ${textFieldHtml("new-res-name", "Name", "", { placeholder: "e.g. Bardic Inspiration" })}
    ${numberFieldHtml("new-res-max", "Max Uses", 1)}
    ${rechargeFieldHtml("new-res")}
    <button class="btn-primary" id="save-res-button">Add Resource</button>
  `);
  guardModalEdits();
  wireRechargeField("new-res");
  document.getElementById("save-res-button").addEventListener("click", () => {
    const name = document.getElementById("new-res-name").value.trim() || "New Resource";
    const max = parseInt(document.getElementById("new-res-max").value) || 1;
    const recharge = readRechargeValue("new-res");
    const newId = makeId(character.resources);
    character.resources.push({ id: newId, name, recharge, current: max, max });
    closeModal();
    renderContent();
  });
}

function openResourceDetailModal(resourceId) {
  const r = character.resources.find(x => x.id == resourceId);
  // added from a feature whose uses scale by level -- max is a tiers table,
  // not a plain number, so it's shown as computed with an optional override
  // rather than a plain editable field (same derived-plus-override shape as
  // proficiency bonus and every skill/save on the sheet)
  const scaling = r.max && typeof r.max === "object";
  const effective = effectiveResourceMax(character, r);
  let overrideOn = r.maxOverride !== undefined && r.maxOverride !== null;

  openModal("sheet", `
    <div class="modal-heading">Edit Resource</div>
    ${textFieldHtml("edit-res-name", "Name", r.name)}
    ${scaling ? `
      <div class="breakdown-row"><span>Max Uses (scales by level)</span><span>${effective}</span></div>
      ${toggleLineHtml("res-max-override-switch", "Override the scaled max", overrideOn)}
      <div id="res-max-override-wrap">${overrideOn ? numberFieldHtml("edit-res-max-override", "Max Uses", r.maxOverride != null ? r.maxOverride : effective) : ""}</div>
    ` : numberFieldHtml("edit-res-max", "Max Uses", r.max)}
    ${rechargeFieldHtml("edit-res", r.recharge)}
    <div class="btn-row-2">
      <button class="btn-primary" id="save-edit-res-button">Save Changes</button>
      <button class="btn-primary btn-danger" id="remove-res-button">Remove</button>
    </div>
  `);
  guardModalEdits();
  wireRechargeField("edit-res");

  if (scaling) {
    const switchEl = document.getElementById("res-max-override-switch");
    const wrap = document.getElementById("res-max-override-wrap");
    switchEl.addEventListener("click", () => {
      overrideOn = !overrideOn;
      switchEl.classList.toggle("on", overrideOn);
      wrap.innerHTML = overrideOn ? numberFieldHtml("edit-res-max-override", "Max Uses", effective) : "";
    });
  }

  document.getElementById("save-edit-res-button").addEventListener("click", () => {
    r.name = document.getElementById("edit-res-name").value.trim() || r.name;
    if (scaling) {
      if (overrideOn) r.maxOverride = parseInt(document.getElementById("edit-res-max-override").value) || effective;
      else delete r.maxOverride;
    } else {
      r.max = parseInt(document.getElementById("edit-res-max").value) || r.max;
    }
    r.recharge = readRechargeValue("edit-res");
    closeModal();
    renderContent();
  });
  document.getElementById("remove-res-button").addEventListener("click", () => {
    const res = character.resources.find(x => x.id == resourceId);
    confirmModal({
      title: "Remove " + (res ? res.name : "resource") + "?",
      body: "This can't be undone.",
      confirmLabel: "Remove",
      danger: true,
      onConfirm: () => {
        character.resources = character.resources.filter(x => x.id != resourceId);
        closeModal();
        renderContent();
      }
    });
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
// propertyBaseName lives in character-data.js, next to the code that reads
// properties to work out damage

function propertySummaryText(selected) {
  return selected.length ? selected.join(", ") : "None";
}

/* Collapsed by default.

   Eleven rows is 406px in a form that is already more than twice the height of
   the viewport, and the median SRD weapon has two properties. So the block is
   a summary line that says what's chosen, and opens the list in place when you
   want to change it -- the answer stays visible without the question costing a
   quarter of the form.

   Inside the list, the two halves of a row do different things: the checkbox
   ticks the property, the name explains it. That's why the row is a <div> with
   two controls rather than one big <button> -- and why the checkbox is a span.
   It used to be a <button> nested inside the row's <button>, which is invalid
   HTML: Chromium tolerated it, every spec-compliant parser auto-closed the
   outer button, and the row collapsed into three stacked siblings with the
   label outside the tap target. */
function renderPropertyPicker(container, selected, expanded) {
  // propertyBaseName() lowercases and SRD_WEAPON_PROPERTIES is capitalised, so
  // compare like with like -- straight includes() never matched, and every
  // ticked property was listed a second time under "Your own"
  const srdBaseNames = SRD_WEAPON_PROPERTIES.map(propertyBaseName);
  const custom = selected.filter(p => !srdBaseNames.includes(propertyBaseName(p)));
  const redraw = (open) => renderPropertyPicker(container, selected, open);

  if (!expanded) {
    container.innerHTML = `
      <button type="button" class="summary-line" id="prop-summary">
        <span class="summary-line-value">${esc(propertySummaryText(selected))}</span>
        <span class="summary-line-chevron">\u203A</span>
      </button>`;
    container.querySelector("#prop-summary").addEventListener("click", () => redraw(true));
    return;
  }

  container.innerHTML = `
    <div class="prop-list">
      ${SRD_WEAPON_PROPERTIES.map(name => {
        const chosen = selected.find(p => propertyBaseName(p) === propertyBaseName(name));
        return `<div class="prop-row ${chosen ? "on" : ""}">
          ${miniCheckboxHtml("prop-toggle", name, !!chosen)}
          <button type="button" class="prop-row-name" data-prop-info="${esc(name)}">${esc(chosen || name)}</button>
        </div>`;
      }).join("")}
    </div>
    ${custom.length ? `
      <div class="breakdown-source" style="margin:10px 0 4px;">Your own</div>
      ${custom.map(property => `
        <div class="prop-row prop-row-custom">
          <span class="prop-row-name">${esc(property)}</span>
          <button type="button" class="chip-remove" data-prop-remove="${selected.indexOf(property)}">\u2715</button>
        </div>
      `).join("")}
    ` : ""}
    <div class="field-row" style="margin-top:10px;">
      ${textFieldHtml("prop-custom-input", "", "", { placeholder: "Anything else, e.g. Versatile (1d10)", style: "margin-bottom:0;" })}
      <button type="button" class="btn-secondary prop-custom-add" id="prop-custom-add">Add</button>
    </div>
    <button type="button" class="add-link" id="prop-collapse" style="margin-top:6px;">Done</button>
  `;

  container.querySelector("#prop-collapse").addEventListener("click", () => redraw(false));

  container.querySelectorAll("[data-prop-remove]").forEach(button => {
    button.addEventListener("click", () => {
      selected.splice(parseInt(button.dataset.propRemove), 1);
      redraw(true);
    });
  });

  // the checkbox ticks it...
  container.querySelectorAll("[data-prop-toggle]").forEach(box => {
    box.addEventListener("click", () => {
      if (miniCheckboxBlocked(box)) return;
      const name = box.dataset.propToggle;
      // an SRD property the player has customised ("Versatile (1d10)") is
      // matched by its base name, so unticking removes the customised one
      const idx = selected.findIndex(p => propertyBaseName(p) === propertyBaseName(name));
      if (idx >= 0) selected.splice(idx, 1);
      else selected.push(name);
      redraw(true);
    });
  });

  // ...and the name explains it, rather than being a second way to tick it
  container.querySelectorAll("[data-prop-info]").forEach(button => {
    button.addEventListener("click", () => {
      const name = button.dataset.propInfo;
      infoModal(name, WEAPON_PROPERTY_INFO[name] || "No description available.");
    });
  });

  const customInput = container.querySelector("#prop-custom-input");
  function addCustom() {
    const value = customInput.value.trim();
    if (!value) return;
    selected.push(value);
    redraw(true);
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
        ${textFieldHtml("dmg-dice-" + idx, "Dice", part.dice, { placeholder: "1d6", style: "flex:0 0 84px;" })}
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

/* The three lines at the top of an attack: what it is, whether you can use it,
   and what it does. They were five lines of prose that restated the rules --
   "Finesse -- using Strength, your better of Strength and Dexterity" told a
   player who had chosen a finesse weapon what finesse is. The ability it landed
   on is the part they can't work out by looking, so that is all the property
   carries now: Finesse (STR). */
function weaponTypeLabel(weapon) {
  return (weapon.weaponType === "ranged" ? "Ranged" : "Melee") + " Weapon";
}

function attackPropertyListHtml(weapon, atk) {
  const properties = weapon.properties || [];
  if (!properties.length) return "";
  return esc(properties.map(property =>
    (propertyBaseName(property) === "finesse" && atk.finesse) ? property + " (" + atk.finesse + ")" : property
  ).join(", "));
}

function attackProficiencyLineHtml(atk) {
  const label = atk.proficiency.required || "Proficiency";
  const mark = atk.proficiency.proficient
    ? `<span class="prof-yes">\u2713</span>`
    : `<span class="prof-no">\u2717</span>`;
  return `${esc(label)} ${mark}${atk.proficiency.overridden ? ` <span class="prof-need">set manually</span>` : ""}`;
}

function openAttackDetailModal(weaponId) {
  const weapon = character.inventory.find(i => i.id == weaponId);
  const atk = calculateAttack(character, weapon);
  const properties = attackPropertyListHtml(weapon, atk);

  openModal("full", `
    <div class="modal-heading">${esc(weapon.name)}</div>
    <div class="breakdown-source">${esc(weaponTypeLabel(weapon))}${weapon.range ? " \u00B7 " + esc(weapon.range) : ""}</div>
    <div class="breakdown-source">${attackProficiencyLineHtml(atk)}</div>
    ${properties ? `<div class="breakdown-source">${properties}</div>` : ""}
    ${atk.versatile ? `
      ${toggleLineHtml("atk-grip-switch", "Wielding two-handed", atk.twoHanded,
        { note: "(" + atk.versatile + ")", style: "margin-top:10px;" })}` : ""}
    ${toggleLineHtml("atk-offhand-switch", "Off-hand weapon", atk.offHand,
      { hint: atk.suppressedOffHandAbility ? "No ability modifier on damage without Two-Weapon Fighting." : (atk.offHand ? "Two-Weapon Fighting adds it back to damage." : ""),
        style: "margin-top:10px;" })}

    <div class="breakdown-subhead">To Hit</div>
    ${breakdownRowsHtml(atk.toHitSources)}
    <hr class="breakdown-divider">
    <div class="breakdown-total"><span>Total</span><span>${esc(bonusLabel(atk.toHitTotal, statBonusDice(character, "Attack Rolls")))}</span></div>

    ${atk.damage.map(part => `
      <div class="breakdown-subhead">${esc(part.type || "Damage")}</div>
      <div class="breakdown-row"><span>Dice</span><span>${esc(part.dice)}</span></div>
      ${breakdownRowsHtml(part.sources)}
      <hr class="breakdown-divider">
      <div class="breakdown-total"><span>Total</span><span>${esc(part.notation)}</span></div>
    `).join("")}

    <div class="btn-row-2" style="margin-top:22px;">
      <button class="btn-primary" id="edit-weapon-button">Edit Weapon</button>
      <button class="btn-primary" id="remove-atk-button" style="background:var(--control);color:var(--accent-soft);">Stow</button>
    </div>
  `);

  /* Reopened, not just toggled. Switching grip changes the damage dice -- a
     Longsword is 1d8 in one hand and 1d10 in two -- and the breakdown those
     dice are printed in is right here in this modal. Flipping the switch and
     calling renderContent() updated the row behind the modal and left every
     number on screen showing the other grip. */
  const gripSwitch = document.getElementById("atk-grip-switch");
  if (gripSwitch) gripSwitch.addEventListener("click", () => {
    weapon.twoHanded = !weapon.twoHanded;
    closeModal();
    renderContent();
    openAttackDetailModal(weaponId);
  });

  document.getElementById("atk-offhand-switch").addEventListener("click", () => {
    weapon.offHand = !weapon.offHand;
    closeModal();
    renderContent();
    openAttackDetailModal(weaponId);
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
    ${textFieldHtml("stow-cat-name", "Category Name", "Carrying", { style: "margin-top:14px;" })}
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
