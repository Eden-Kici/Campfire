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
    ${state.dying ? `<button class="btn-primary" id="roll-death-save" style="margin-top:12px;">Roll Death Save</button>` : ""}
    ${state.successes || state.failures ? `<button class="btn-secondary" id="clear-death-saves">Clear</button>` : ""}`;
}

function wireDeathSaveControls(afterChange) {
  document.querySelectorAll("[data-death-pip]").forEach(pip => {
    pip.addEventListener("click", () => {
      setDeathSaveTrack(pip.dataset.deathPip, parseInt(pip.dataset.deathCount));
      if (afterChange) afterChange(); else renderContent();
    });
  });

  const roll = document.getElementById("roll-death-save");
  if (roll) roll.addEventListener("click", () => { rollDeathSave(); if (afterChange) afterChange(); });
  const clear = document.getElementById("clear-death-saves");
  if (clear) clear.addEventListener("click", () => {
    resetDeathSaves(character);
    if (afterChange) afterChange(); else renderContent();
  });
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
            <div class="atk-name">${esc(weapon.name)}${atk.proficiency.proficient ? "" : `<span class="atk-warn" title="Not proficient">!</span>`}${atk.offHand ? `<span class="res-tag" style="margin-left:6px;">OFF-HAND</span>` : ""}</div>
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

  document.querySelectorAll("[data-exhaustion-step]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const next = exhaustionLevel(character) + parseInt(button.dataset.exhaustionStep);
      setExhaustionLevel(character, next);
      renderContent();
    });
  });
  const exhaustionDetail = document.querySelector("[data-exhaustion-detail]");
  if (exhaustionDetail) exhaustionDetail.addEventListener("click", openExhaustionModal);

  wireDeathSaveControls(renderContent);

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
  const concCheck = document.getElementById("concentration-check");
  if (concCheck) concCheck.addEventListener("click", () => openConcentrationCheckModal());

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

    <div class="breakdown-subhead">Death Saves</div>
    <div id="calc-death-saves">${deathSaveControlHtml()}</div>
  `);

  wireHitDiceCalcRows();

  // the panel redraws itself in place so the calculator stays open
  function redrawDeathPanel() {
    const panel = document.getElementById("calc-death-saves");
    if (panel) panel.innerHTML = deathSaveControlHtml();
    wireDeathSaveControls(redrawDeathPanel);
    renderContent();
  }
  wireDeathSaveControls(redrawDeathPanel);

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

    /* Massive damage: if what's left after reaching zero equals or exceeds
       your hit point maximum, you die outright rather than falling unconscious. */
    const alreadyDown = character.hp.current <= 0;
    const overkill = remaining - character.hp.current;
    character.hp.current = Math.max(0, character.hp.current - remaining);

    if (!alreadyDown && overkill >= maxHP.total) {
      recordDeathSave("failure", 3);
      showToast("Killed outright — " + overkill + " past zero, against a maximum of " + maxHP.total);
      return;
    }
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
    notation: "1d20" + formatModifier(save.total),
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
    ${comboFieldHtml("effect-name", "Name", "e.g. Bless, Prone, Hexed")}

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

  wireCombo("effect-name", ALL_CONDITIONS);
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
      ${modifiers.map(e => `<div class="breakdown-row"><span>${esc(e.category)}</span><span>${esc(effectSummaryLabel(e, totalLevel(character)))}</span></div>`).join("")}
    ` : `<div class="empty-hint">No mechanical effect — this is a reminder only.</div>`}
    <button class="btn-primary" id="remove-effect-button" style="background:var(--danger-surface);color:var(--danger-text);">Remove Effect</button>
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
    ${textFieldHtml("new-res-name", "Name", "", { placeholder: "e.g. Bardic Inspiration" })}
    ${numberFieldHtml("new-res-max", "Max Uses", 1)}
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
      <button class="btn-primary" id="remove-res-button" style="background:var(--danger-surface);color:var(--danger-text);">Remove</button>
    </div>
  `);
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
// propertyBaseName lives in character-data.js, next to the code that reads
// properties to work out damage

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
      ${textFieldHtml("prop-custom-input", "", "", { placeholder: "Anything else, e.g. Versatile (1d10)", style: "margin-bottom:0;" })}
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
      ${toggleLineHtml("atk-grip-switch", "Wielding two-handed", atk.twoHanded,
        { note: "(" + atk.versatile + ")", style: "margin-top:10px;" })}` : ""}
    ${toggleLineHtml("atk-offhand-switch", "Off-hand weapon", atk.offHand,
      { hint: atk.suppressedOffHandAbility ? "No ability modifier on damage without Two-Weapon Fighting." : (atk.offHand ? "Two-Weapon Fighting adds it back to damage." : ""),
        style: "margin-top:10px;" })}

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
      <button class="btn-primary" id="remove-atk-button" style="background:var(--control);color:var(--accent-soft);">Stow</button>
    </div>
  `);

  const gripSwitch = document.getElementById("atk-grip-switch");
  if (gripSwitch) gripSwitch.addEventListener("click", () => {
    weapon.twoHanded = !weapon.twoHanded;
    gripSwitch.classList.toggle("on", weapon.twoHanded);
    renderContent();
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
