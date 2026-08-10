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

  // "all" and "half" both need a ceiling to mean anything; without one they
  // are no-ops rather than quietly inventing a number
  if (amount === "all") return uncapped ? entry.current : ceiling;
  if (amount === "half") return uncapped ? entry.current : cap(entry.current + Math.max(1, Math.floor(ceiling / 2)));
  if (typeof amount === "number") return cap(entry.current + Math.max(0, amount));
  return cap(entry.current + Math.max(0, rollNotation(String(amount)).total));
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

  // a level-scaling resource carries its max as a tiers table rather than a
  // plain number (see effectiveResourceMax) -- restoreOnRest needs a real
  // number to restore toward, so it's resolved into a shim the same way an
  // item-backed resource already gets one just below
  let resources = character.resources.filter(r => {
    const shim = { recharge: r.recharge, current: r.current, max: effectiveResourceMax(character, r) };
    const changed = restoreOnRest(shim, isLong);
    r.current = shim.current;
    return changed;
  }).length;
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
/* Levelling is a commitment, so it's select-then-confirm rather than a single
   tap, and it shows everything the level actually grants before you take it.

   Hit points are the part that needs a choice: roll the die, take the fixed
   average, or type a number. Manual is deliberately unbounded -- a table that
   hands out maximum hit points at every level is a common enough ruling that
   refusing it would be wrong. */

let levelUpState = null;

/* A class's subclasses plus any Custom Content subclasses authored for it
   (content.js) -- customContent.subclasses entries carry `.forClass`, the
   class name they attach to, rather than living nested inside the class the
   way SRD subclasses and a duplicated custom class's own subclasses do. That
   split is what lets a custom subclass attach to an SRD class without
   forking the whole class into Custom Content just to add one. Works for
   any class found by name, SRD or custom, so this is the one place both
   "which class" question gets answered from. */
function subclassesForClass(className) {
  const cls = SRD_CLASSES.find(c => c.name === className) ||
    (typeof customContent !== "undefined" ? customContent.classes.find(c => c.name === className) : null);
  const own = (cls && cls.subclasses) || [];
  const custom = (typeof customContent !== "undefined" ? customContent.subclasses : [])
    .filter(sc => sc.forClass === className);
  return own.concat(custom);
}

/* Which features a class hands over at a particular level, including its
   subclass's. Used both when creating a character at level 1 and when
   levelling up. Returns the raw SRD feature objects rather than stripping
   them to {name, desc} -- a feature with a `.choice` descriptor needs that
   preserved long enough for grantFeatures() to notice it. Callers that only
   want display text strip it themselves. */
function featuresAtLevel(className, subclassName, level) {
  const cls = SRD_CLASSES.find(c => c.name === className);
  if (!cls) return [];

  const own = (cls.features || []).filter(f => f.level === level);
  const subclass = subclassesForClass(className).find(sub => sub.name === subclassName);
  const fromSubclass = subclass ? (subclass.features || []).filter(f => f.level === level) : [];

  return own.concat(fromSubclass);
}

/* Turns a `.choice` descriptor on a raw SRD feature into a pendingChoices
   entry, or returns null for a feature that doesn't have one -- most don't.
   `traitCategory` + `featureName` are how a resolved answer finds its way
   back to annotate the feature it came from (see applyChoiceResolution in
   choices.js). */
function pendingChoiceFor(feature, traitCategory) {
  if (!feature.choice) return null;
  return {
    source: feature.name,
    traitCategory,
    featureName: feature.name,
    kind: feature.choice.kind,
    prompt: feature.choice.prompt || ("Choose for " + feature.name),
    count: feature.choice.count || 1
  };
}

// shared by the creator (building a level-1 character) and levelling up --
// one place decides whether a granted feature owes the player a choice
function grantPendingChoice(character, feature, traitCategory) {
  const choice = pendingChoiceFor(feature, traitCategory);
  if (!choice) return;
  const already = character.pendingChoices.some(p => p.featureName === choice.featureName && p.traitCategory === choice.traitCategory);
  if (already) return;
  choice.id = Math.max(0, ...character.pendingChoices.map(p => p.id)) + 1;
  character.pendingChoices.push(choice);
}

function grantFeatures(character, features) {
  if (!features.length) return;
  if (!character.traits["Class Features"]) character.traits["Class Features"] = [];
  features.forEach(feature => {
    const already = character.traits["Class Features"].some(t => t.name === feature.name);
    if (!already) {
      // carries .effects and .resource through from the raw SRD feature, the
      // same as the creator's own asTraitEntry -- a level-up-granted feature
      // (Action Surge, Channel Divinity) needs the same treatment a level-1
      // one gets, or the two paths quietly diverge
      const entry = { name: feature.name, desc: feature.desc };
      if (feature.effects) entry.effects = feature.effects;
      if (feature.resource) entry.resource = Object.assign({ name: feature.name }, feature.resource);
      character.traits["Class Features"].push(entry);
    }
    grantPendingChoice(character, feature, "Class Features");
  });
}

function hitDieSize(die) {
  return parseInt(String(die).replace("d", "")) || 8;
}

// 5e's fixed average: half the die, rounded up, which is (size / 2) + 1
function averageHitPoints(die) {
  return Math.floor(hitDieSize(die) / 2) + 1;
}

function openLevelUpModal() {
  const classes = character.classes || [];
  levelUpState = {
    target: classes.length ? 0 : null,   // index into classes, or "new"
    newClass: "",
    hpMode: "average",
    hpRolled: null,
    hpManual: null
  };
  openModal("full", "");
  redrawLevelUp();
}

function levelUpTarget() {
  const classes = character.classes || [];
  if (levelUpState.target === "new") {
    const srd = SRD_CLASSES.find(c => c.name.toLowerCase() === levelUpState.newClass.trim().toLowerCase());
    return {
      isNew: true,
      name: levelUpState.newClass.trim() || "—",
      from: 0,
      to: 1,
      hitDie: srd ? srd.hitDie : "d8",
      srd
    };
  }
  const entry = classes[levelUpState.target];
  if (!entry) return null;
  return {
    isNew: false,
    name: entry.name,
    from: entry.level,
    to: entry.level + 1,
    hitDie: entry.hitDie,
    srd: SRD_CLASSES.find(c => c.name === entry.name),
    entry
  };
}

function levelUpHitPoints(target) {
  const constitution = abilityModifier(effectiveAbilityScore(character, "CON"));
  let rolled;
  if (levelUpState.hpMode === "average") rolled = averageHitPoints(target.hitDie);
  else if (levelUpState.hpMode === "roll") rolled = levelUpState.hpRolled;
  else rolled = levelUpState.hpManual;

  const base = rolled === null || rolled === undefined ? null : rolled;
  return {
    base,
    constitution,
    total: base === null ? null : base + constitution
  };
}

function redrawLevelUp() {
  const box = document.querySelector("#modal-overlay .modal-content");
  if (!box) return;
  box.innerHTML = levelUpHtml();
  wireLevelUp();
}

function levelUpHtml() {
  const classes = character.classes || [];
  const known = classes.map(c => c.name);
  const available = SRD_CLASSES.filter(c => !known.includes(c.name)).map(c => c.name);
  const target = levelUpTarget();

  const currentTotal = totalLevel(character);
  const nextTotal = currentTotal + 1;
  const bonusNow = calculateProficiencyBonus(character).total;
  const bonusNext = proficiencyBonusForLevel(nextTotal) +
    (bonusNow - (character.proficiencyBonusOverride ?? proficiencyBonusForLevel(currentTotal)));

  const hp = target ? levelUpHitPoints(target) : null;
  const gained = target ? featuresAtLevel(target.name, target.entry ? target.entry.subclass : null, target.to) : [];

  /* Only things that actually change are listed. A row saying "unchanged" is
     noise on a screen whose whole job is answering "what do I get". */
  const changes = [];
  if (target) {
    changes.push(["Level", "Level " + target.from + " → Level " + target.to]);
    if (bonusNext !== bonusNow) {
      changes.push(["Proficiency bonus", formatModifier(bonusNow) + " → " + formatModifier(bonusNext)]);
    }
    changes.push(["Hit dice", (hitDiceOfSize(target.hitDie)) + target.hitDie + " → " + (hitDiceOfSize(target.hitDie) + 1) + target.hitDie]);
    if (target.isNew && target.srd) {
      changes.push(["Saving throws", "+ " + target.srd.saves.join(", ")]);
      changes.push(["Armour", "+ " + target.srd.armorProf]);
      changes.push(["Weapons", "+ " + target.srd.weaponProf]);
    }
  }

  return `
    <div class="modal-heading">Level Up</div>
    <div class="breakdown-source">Level ${currentTotal} → ${nextTotal}</div>

    <div class="breakdown-subhead">Which class</div>
    ${classes.map((entry, index) => `
      <button class="toggle-btn creator-option ${levelUpState.target === index ? "active" : ""}"
        data-levelup-target="${index}"
        style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px 14px;">
        ${esc(entry.name)}${entry.subclass ? " (" + esc(entry.subclass) + ")" : ""} ${entry.level} → ${entry.level + 1}
        <span class="atk-range"> · ${esc(entry.hitDie)}</span>
      </button>
    `).join("")}
    ${available.length ? `
      <button class="toggle-btn creator-option ${levelUpState.target === "new" ? "active" : ""}"
        data-levelup-target="new"
        style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px 14px;">
        Take a level in something new
      </button>
      ${levelUpState.target === "new" ? comboFieldHtml("levelup-new-class", "Class", available[0], levelUpState.newClass) : ""}
    ` : ""}

    ${target ? `
      <div class="breakdown-subhead">What you gain</div>
      ${changes.map(([label, value]) => `<div class="breakdown-row"><span>${esc(label)}</span><span>${esc(value)}</span></div>`).join("")}

      ${gained.length ? `
        <div class="breakdown-subhead">Features</div>
        ${gained.map(feature => `
          <div class="trait-item">
            <div class="trait-name">${esc(feature.name)}</div>
            <div class="trait-desc">${esc(feature.desc)}</div>
          </div>
        `).join("")}
      ` : `<div class="menu-note" style="margin-top:14px;">No new features at this level.</div>`}

      <div class="breakdown-subhead">Hit points</div>
      <div class="type-toggle">
        <button class="toggle-btn ${levelUpState.hpMode === "average" ? "active" : ""}" data-hp-mode="average">Average</button>
        <button class="toggle-btn ${levelUpState.hpMode === "roll" ? "active" : ""}" data-hp-mode="roll">Roll</button>
        <button class="toggle-btn ${levelUpState.hpMode === "manual" ? "active" : ""}" data-hp-mode="manual">Manual</button>
      </div>

      ${levelUpState.hpMode === "average" ? `
        <div class="menu-note" style="margin-top:0;">The fixed average for a ${esc(target.hitDie)} is ${averageHitPoints(target.hitDie)}.</div>
      ` : ""}
      ${levelUpState.hpMode === "roll" ? `
        <div class="res-row">
          <span class="res-name">${levelUpState.hpRolled === null ? "Not rolled yet" : "Rolled " + levelUpState.hpRolled}</span>
          <button class="atk-pill" id="levelup-roll">Roll 1${esc(target.hitDie)}</button>
        </div>
      ` : ""}
      ${levelUpState.hpMode === "manual" ? `
        ${numberFieldHtml("levelup-manual", "Hit points gained, before Constitution", levelUpState.hpManual,
          { placeholder: "1 to " + hitDieSize(target.hitDie) })}
        <div id="levelup-limit">${levelUpOverLimitHtml(target)}</div>
      ` : ""}

      <div id="levelup-total">${levelUpTotalHtml(target)}</div>

      <button class="btn-primary" id="levelup-confirm" style="margin-top:16px;">Confirm Level Up</button>
    ` : `<div class="empty-hint">Pick a class to continue.</div>`}
  `;
}

// how many dice of a size the character already has, for the before/after
function hitDiceOfSize(die) {
  const pool = calculateHitDice(character).find(p => p.die === die);
  return pool ? pool.total : 0;
}

function levelUpOverLimitHtml(target) {
  if (!target || levelUpState.hpMode !== "manual") return "";
  const most = hitDieSize(target.hitDie);
  if (levelUpState.hpManual === null || levelUpState.hpManual <= most) return "";
  return `<div class="form-warning">${levelUpState.hpManual} is above the most a ${esc(target.hitDie)} can roll (${most}).</div>`;
}

function levelUpTotalHtml(target) {
  if (!target) return "";
  const hp = levelUpHitPoints(target);
  const current = calculateMaxHP(character).total;
  return `
    <div class="breakdown-row"><span>From the die</span><span>${hp.base === null ? "—" : hp.base}</span></div>
    <div class="breakdown-row"><span>Constitution modifier</span><span>${formatModifier(hp.constitution)}</span></div>
    <hr class="breakdown-divider">
    <div class="breakdown-total"><span>Maximum hit points</span><span>${current}${hp.total === null ? "" : " → " + (current + Math.max(1, hp.total))}</span></div>`;
}

function wireLevelUp() {
  document.querySelectorAll("[data-levelup-target]").forEach(button => {
    button.addEventListener("click", () => {
      const value = button.dataset.levelupTarget;
      levelUpState.target = value === "new" ? "new" : parseInt(value);
      levelUpState.hpRolled = null;
      redrawLevelUp();
    });
  });

  const classes = character.classes || [];
  const known = classes.map(c => c.name);
  wireCombo("levelup-new-class", SRD_CLASSES.filter(c => !known.includes(c.name)).map(c => c.name), value => {
    levelUpState.newClass = value;
  });

  document.querySelectorAll("[data-hp-mode]").forEach(button => {
    button.addEventListener("click", () => { levelUpState.hpMode = button.dataset.hpMode; redrawLevelUp(); });
  });

  const roll = document.getElementById("levelup-roll");
  if (roll) roll.addEventListener("click", () => {
    const target = levelUpTarget();
    levelUpState.hpRolled = rollDie(hitDieSize(target.hitDie));
    redrawLevelUp();
  });

  const manual = document.getElementById("levelup-manual");
  if (manual) manual.addEventListener("input", () => {
    const value = parseInt(manual.value);
    levelUpState.hpManual = isNaN(value) ? null : value;

    /* Updated in place rather than by redrawing: a redraw on every keystroke
       would take the focus out of the field being typed into. */
    const warning = document.getElementById("levelup-limit");
    if (warning) warning.innerHTML = levelUpOverLimitHtml(levelUpTarget());
    const totalRow = document.getElementById("levelup-total");
    if (totalRow) totalRow.innerHTML = levelUpTotalHtml(levelUpTarget());
  });

  const confirm = document.getElementById("levelup-confirm");
  if (confirm) confirm.addEventListener("click", applyLevelUp);
}

function applyLevelUp() {
  const target = levelUpTarget();
  if (!target) return;

  if (target.isNew) {
    const name = levelUpState.newClass.trim();
    if (!name) { showToast("Pick a class"); return; }
    if ((character.classes || []).some(c => c.name.toLowerCase() === name.toLowerCase())) {
      showToast("You already have levels in " + name);
      return;
    }
  }

  const hp = levelUpHitPoints(target);
  if (hp.total === null) {
    showToast(levelUpState.hpMode === "roll" ? "Roll for hit points first" : "Enter the hit points gained");
    return;
  }

  if (target.isNew) {
    character.classes.push({
      name: target.srd ? target.srd.name : target.name,
      level: 1, subclass: null, hitDie: target.hitDie
    });
  } else {
    target.entry.level += 1;
  }

  const entry = target.isNew
    ? character.classes[character.classes.length - 1]
    : target.entry;

  // captured before granting features, so only choices THIS level-up created
  // get chained into -- an older unresolved one stays on the banner rather
  // than being swept into a flow the player didn't ask for right now
  const beforeChoiceIds = character.pendingChoices.map(p => p.id);
  grantFeatures(character, featuresAtLevel(entry.name, entry.subclass, entry.level));
  const newChoiceIds = character.pendingChoices.filter(p => !beforeChoiceIds.includes(p.id)).map(p => p.id);

  // a level never reduces your maximum, however the dice fell
  const gainedHitPoints = Math.max(1, hp.total);
  character.baseMaxHP += gainedHitPoints;
  character.hp.current += gainedHitPoints;

  function finishLevelUp() {
    closeModal();
    renderContent();
    renderSheetHeader();
    showToast("Level " + totalLevel(character) + " — " + gainedHitPoints + " hit points");
  }

  // resolved right here, in the same flow that granted them -- not left for
  // the Character tab banner to nag about after the fact
  if (newChoiceIds.length) resolveChoicesThen(newChoiceIds, finishLevelUp);
  else finishLevelUp();
}

function customContentTotal() {
  return customContent.races.length + customContent.classes.length + customContent.backgrounds.length + customContent.items.length;
}

function openAppMenu() {
  const contentCount = customContentTotal();
  openModal("drawer", `
    <div class="modal-heading">Campfire</div>

    <div class="drawer-section">Rest</div>
    <button class="drawer-item" id="menu-short-rest">Short Rest<span class="drawer-hint">1 hour</span></button>
    <button class="drawer-item" id="menu-long-rest">Long Rest<span class="drawer-hint">8 hours</span></button>

    <div class="drawer-section">App</div>
    <button class="drawer-item" id="menu-party">Party<span class="drawer-hint">${esc(party.status === "none" ? "Not connected" : (party.status === "hosting" ? "Hosting" : "Connected"))}</span></button>
    ${MENU_STUBS.map(item => `
      <button class="drawer-item" data-stub="${esc(item.label)}">${esc(item.label)}<span class="drawer-hint">${item.hint}</span></button>
    `).join("")}
    <button class="drawer-item" id="menu-content">Manage Content<span class="drawer-hint">${contentCount ? contentCount + " custom" : ""}</span></button>
    <button class="drawer-item" id="menu-theme">Theme<span class="drawer-hint">${esc((THEMES.find(t => t.value === theme.base) || {}).label || "")}</span></button>
    <button class="drawer-item" id="menu-options">Options</button>

    <div class="drawer-section">Character</div>
    <button class="drawer-item" id="menu-level-up">Level Up<span class="drawer-hint">level ${totalLevel(character)}</span></button>

    <div class="drawer-section">Development</div>
    <button class="drawer-item" id="menu-reset-demo">Reset to Demo Character<span class="drawer-hint">clears saved data</span></button>
  `);
  document.getElementById("menu-short-rest").addEventListener("click", openShortRestModal);
  document.getElementById("menu-long-rest").addEventListener("click", openLongRestModal);
  document.getElementById("menu-party").addEventListener("click", openPartyFinder);
  document.getElementById("menu-content").addEventListener("click", openContentManager);
  document.querySelectorAll("[data-stub]").forEach(button => {
    button.addEventListener("click", () => { closeModal(); showToast(button.dataset.stub + " isn't built yet"); });
  });
  document.getElementById("menu-reset-demo").addEventListener("click", confirmResetToDemo);
  document.getElementById("menu-level-up").addEventListener("click", openLevelUpModal);
  document.getElementById("menu-theme").addEventListener("click", openThemeModal);
  document.getElementById("menu-options").addEventListener("click", openSettingsModal);
}

// development aid: persistence means the demo character keeps whatever state
// you left it in, which is unhelpful while iterating on the sheet itself
function confirmResetToDemo() {
  openModal("center", `
    <div class="modal-heading">Reset to the demo character?</div>
    <div class="menu-note" style="margin-top:0;">
      Deletes every saved character and reloads the page with Sigrid as she ships. There's no undo.
    </div>
    <button class="btn-primary" id="confirm-reset" style="background:var(--danger-surface);color:var(--danger-text);margin-top:16px;">Delete everything and reset</button>
    <button class="btn-secondary" id="cancel-reset">Cancel</button>
  `);
  document.getElementById("confirm-reset").addEventListener("click", () => {
    // the theme is an app preference, not character data, so it survives
    try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* nothing to clear */ }
    location.reload();
  });
  document.getElementById("cancel-reset").addEventListener("click", closeModal);
}
