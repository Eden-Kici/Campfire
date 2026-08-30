/* ============================================================
   CASTING
   ============================================================

   Choosing a level, seeing what that changes, picking who it lands on, and
   spending the slot. Split from tab-spells.js because casting turned out to be
   a conversation rather than a button.

   Everything here reads the SRD's own words rather than a structured upcast
   model, because there isn't one: 53 of the 169 spells carry an "At Higher
   Levels" paragraph and the rest genuinely gain nothing from a bigger slot.
   Showing the rule as written beats showing an interpretation of it. */

let castState = null;

const TARGET_NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};

function srdSpellNamed(name) {
  return (typeof SRD_SPELLS !== "undefined" ? SRD_SPELLS : []).find(s => s.name === name) || null;
}

function spellText(spell) {
  const known = srdSpellNamed(spell.name);
  return (known && known.desc) || spell.desc || "";
}

function spellUpcastText(spell) {
  const match = /At Higher Levels\.?\s*([\s\S]*)$/i.exec(spellText(spell));
  return match ? match[1].trim() : null;
}

function spellIsConcentration(spell) {
  const known = srdSpellNamed(spell.name);
  if (known) return !!known.concentration;
  return /concentration/i.test(spellText(spell));
}

/* How many creatures a spell may target, read out of its own text. There is no
   field for this -- "up to three creatures" is a sentence, not a number -- so
   this recognises the phrasings the SRD actually uses and returns null for
   everything else.

   Null means "no idea", and no idea means no warning. A limit we are unsure of
   is worse than no limit: a warning that fires wrongly teaches the player to
   ignore warnings. */
function spellTargetLimit(spell, level) {
  const desc = spellText(spell);
  const match = /(?:up to\s+)?\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:willing\s+)?creatures?\b/i.exec(desc);
  if (!match) return null;
  const base = TARGET_NUMBER_WORDS[match[1].toLowerCase()];
  if (base == null) return null;
  let limit = base;
  if (/additional creature for each slot level above/i.test(desc)) {
    limit += Math.max(0, (level || spell.level) - spell.level);
  }
  return limit;
}

/* Whether picking targets is worth asking about. An attack roll already has a
   target -- whatever you are pointing at -- and a Self spell has no one else
   to land on. Everything in between can be aimed at somebody. */
function spellTakesTargets(spell) {
  if (spell.attackRoll) return false;
  const known = srdSpellNamed(spell.name);
  if (known && /^self/i.test(known.range || "")) return false;
  return /creature|target|ally|allies/i.test(spellText(spell));
}

/* ---------- healing ---------- */

/* The caster's own modifier, from the spell's own class. A spell naming a
   class this character doesn't cast adds nothing rather than a number out of
   nowhere -- same rule spellAttackBonus follows. */
function spellHealModifier(spell) {
  const caster = character.spellcasting.classes.find(c => c.name === spell.classSource);
  if (!caster) return 0;
  return abilityModifier(effectiveAbilityScore(character, caster.ability));
}

/* "the healing increases by 1d8 for each slot level above 1st" is the only
   phrasing the SRD uses for this, so it is the only one read. Nothing found
   means upcasting adds no healing, which is also true of plenty of spells. */
function spellHealUpcastDie(spell) {
  const match = /healing increases by (\d*d\d+)\s+for each slot level above/i.exec(spellText(spell));
  return match ? match[1] : null;
}

/* The notation actually rolled, built at the level being cast. Returned as
   text so the roll toast, the dice history and the number applied to hit
   points are all the same roll, said the same way. */
function castHealNotation(spell, level) {
  if (!spell.heal) return null;
  let notation = spell.heal;
  const extra = spellHealUpcastDie(spell);
  const above = Math.max(0, (level || spell.level) - spell.level);
  if (extra && above) {
    const match = /^(\d*)d(\d+)$/i.exec(extra);
    if (match) notation += " + " + ((parseInt(match[1] || "1")) * above) + "d" + match[2];
  }
  if (spell.healMod) {
    const mod = spellHealModifier(spell);
    if (mod) notation += (mod > 0 ? " + " : " - ") + Math.abs(mod);
  }
  return notation;
}

function castableSpellLevels(spell) {
  const slotLevels = Object.keys(character.spellSlots).map(n => parseInt(n)).filter(n => n > 0);
  const highest = slotLevels.length ? Math.max.apply(null, slotLevels) : spell.level;
  const levels = [];
  for (let level = 1; level <= Math.max(highest, spell.level); level++) levels.push(level);
  return levels;
}

/* ---------- the window ---------- */

function openCastModal(spell) {
  castState = { spell: spell, level: spell.level, targets: [], strangers: 0 };
  openModal("sheet", `<div id="cast-body"></div>`);
  redrawCastModal();
}

function redrawCastModal() {
  const body = document.getElementById("cast-body");
  if (!body) return;
  body.innerHTML = castModalHtml();
  wireCastModal();
}

function castTargetCount() {
  return castState.targets.length + castState.strangers;
}

function castModalHtml() {
  const spell = castState.spell;
  const level = castState.level;
  const slot = character.spellSlots[level];
  const upcast = spellUpcastText(spell);
  const above = level - spell.level;
  const limit = spellTargetLimit(spell, level);
  const overLimit = limit != null && castTargetCount() > limit;

  return `
    <div class="modal-heading">Cast ${esc(spell.name)}</div>
    <div class="breakdown-source" style="margin-bottom:12px;">${esc(levelLabel(spell.level))}${spell.classSource ? " · " + esc(spell.classSource) : ""}</div>

    ${above < 0 ? `<div class="cast-banner danger">Downcasting isn't normally legal. Cast it anyway if your table says so.</div>` : ""}
    ${above > 0 && !upcast ? `<div class="cast-banner caution">Upcasting gives this spell no additional benefits.</div>` : ""}
    ${overLimit ? `<div class="cast-banner caution">${esc(spell.name)} reaches up to ${limit} ${limit === 1 ? "creature" : "creatures"} at this level. You have picked ${castTargetCount()}.</div>` : ""}
    ${!slot ? `<div class="cast-banner caution">No ${esc(levelLabel(level))} slots on this sheet.</div>`
      : (slot.current <= 0 ? `<div class="cast-banner caution">No ${esc(levelLabel(level))} slots left.</div>` : "")}

    ${fieldLabelHtml("Cast at level")}
    <div class="cast-levels">
      ${castableSpellLevels(spell).map(lvl => {
        const s = character.spellSlots[lvl];
        return `
          <button class="cast-level${lvl === level ? " active" : ""}${(!s || s.current <= 0) ? " empty" : ""}" data-cast-level="${lvl}">
            <span class="cast-level-num">${lvl}</span>
            <span class="cast-level-slots">${s ? s.current + "/" + s.max : "—"}</span>
          </button>`;
      }).join("")}
    </div>

    <div class="breakdown-subhead">At this level</div>
    <div class="effect-note">${
      above === 0 ? "Cast as written."
      : upcast ? esc((above > 0 ? above + (above === 1 ? " level" : " levels") + " above its base. " : "") + upcast)
      : (above > 0 ? "Nothing changes. This spell reads the same at every level."
                   : Math.abs(above) + (Math.abs(above) === 1 ? " level" : " levels") + " below its base.")
    }</div>

    ${castHealNotation(spell, level) ? `
      <div class="breakdown-row" style="margin-top:10px;"><span>Healing</span><span>${esc(castHealNotation(spell, level))}</span></div>` : ""}
    ${spell.damage ? `
      <div class="breakdown-row"><span>Damage</span><span>${esc(spell.damage)}</span></div>` : ""}

    ${spellTakesTargets(spell) ? castTargetsHtml(limit) : ""}

    <div class="btn-row-2" style="margin-top:18px;">
      <button class="btn-secondary" id="cast-cancel">Cancel</button>
      <button class="btn-primary" id="cast-confirm">Cast</button>
    </div>
  `;
}

/* You are always a legal target for your own spell. Without a party the roster
   was empty, so casting Cure Wounds on yourself -- the single most ordinary
   thing a cleric does -- had nowhere to land. */
function castTargetRoster() {
  if (typeof party !== "undefined" && party.status !== "none" && party.members.length) return party.members;
  /* Built here rather than through myPartyIdentity(), which reports whatever
     screen the app is on. This window is always about the character whose
     spell it is, and their hit points are the reason the row is worth reading. */
  return [{
    you: true,
    device: deviceId(),
    name: character.name,
    hp: character.hp.current,
    maxHp: calculateMaxHP(character).total,
    deathSaves: character.deathSaves
  }];
}

function castTargetsHtml(limit) {
  const roster = castTargetRoster();
  return `
    <div class="breakdown-subhead">Who it lands on${limit != null ? ` <span class="field-hint" style="display:inline;">up to ${limit}</span>` : ""}</div>
    ${roster.map(member => {
      /* Hit points where you are choosing who to heal, when the party shares
         them at all. A heal is aimed at whoever is worst off, and making
         someone leave this window to find that out is how the wrong person
         gets healed. The party's own setting decides what shows -- exact
         numbers, a word, or nothing -- so this window can't leak what the
         roster wouldn't. */
      const hp = typeof partyHpLabel === "function" ? partyHpLabel(member) : "";
      return `
      <div class="member-row" data-cast-target="${esc(member.device)}" style="cursor:pointer;">
        <span>${esc(member.name)}${member.you ? " (you)" : ""}${hp ? `<span class="cast-target-hp">${esc(hp)}</span>` : ""}</span>
        <span class="radio-dot${castState.targets.indexOf(member.device) !== -1 ? " selected" : ""}"></span>
      </div>`;
    }).join("")}
    <div class="member-row">
      <span>Someone else${castState.strangers ? " ×" + castState.strangers : ""}</span>
      <span style="display:flex;gap:8px;">
        ${castState.strangers ? `<button class="add-link" id="cast-stranger-minus">−</button>` : ""}
        <button class="add-link" id="cast-stranger-plus">+ Add</button>
      </span>
    </div>
  `;
}

function wireCastModal() {
  document.querySelectorAll("[data-cast-level]").forEach(button => {
    button.addEventListener("click", () => {
      castState.level = parseInt(button.dataset.castLevel);
      redrawCastModal();
    });
  });

  document.querySelectorAll("[data-cast-target]").forEach(row => {
    row.addEventListener("click", () => {
      const device = row.dataset.castTarget;
      const at = castState.targets.indexOf(device);
      if (at === -1) castState.targets.push(device); else castState.targets.splice(at, 1);
      redrawCastModal();
    });
  });

  const plus = document.getElementById("cast-stranger-plus");
  if (plus) plus.addEventListener("click", () => { castState.strangers += 1; redrawCastModal(); });
  const minus = document.getElementById("cast-stranger-minus");
  if (minus) minus.addEventListener("click", () => { castState.strangers = Math.max(0, castState.strangers - 1); redrawCastModal(); });

  document.getElementById("cast-cancel").addEventListener("click", () => { castState = null; closeModal(); });
  document.getElementById("cast-confirm").addEventListener("click", confirmCast);
}

/* ---------- doing it ---------- */

/* Whether the app spends the slot for you. On by default: tracking it by hand
   is the thing a sheet exists to stop you doing. Off for tables that would
   rather move the pips themselves.

   Either way the cast happens. The app has never refused one, because a table
   ruling can put a character outside the slot economy entirely, and a sheet
   that argues with the person holding it is a sheet they stop using. */
function autoSpendsSlots() {
  return typeof settings === "undefined" || settings.autoSpendSlots !== false;
}

function confirmCast() {
  const state = castState;
  castState = null;
  if (!state) { closeModal(); return; }

  const spell = state.spell;
  const level = state.level;
  const named = castTargetNames(state);
  const slot = character.spellSlots[level];
  const slotName = levelLabel(level).replace(" Level", "");

  let spent = false;
  if (autoSpendsSlots() && slot) { slot.current -= 1; spent = true; }

  closeModal();
  shareCastWithTargets(spell, state.targets, level);

  const on = named.length ? " on " + named.join(", ") : "";
  if (spent) showToast("Cast " + spell.name + on + " \u00B7 spent a " + slotName + "-level slot");
  else if (!slot) showToast("Cast " + spell.name + on + " \u00B7 no " + slotName + "-level slots on this sheet");
  else showToast("Cast " + spell.name + on + " \u00B7 slot not spent");

  applyCastHealing(spell, level, state.targets);
  if (spell.attackRoll) rollSpellAttack(spell);
  renderContent();
}

/* Healing is rolled once and spent on everyone it lands on, which is what the
   spell says: Cure Wounds is one roll, not one per target. Your own hit points
   go up here; everybody else's are their sheet to change, so they get asked. */
function applyCastHealing(spell, level, targets) {
  const notation = castHealNotation(spell, level);
  if (!notation) return;
  const rolled = showRollToast(spell.name + " \u2013 Healing", notation);
  const total = rolled ? rolled.total : rollNotation(notation).total;
  const picked = targets || [];
  /* A spell with no target list at all -- one that reads "you regain" -- heals
     the only person it could be about. Picking nobody from a list you were
     shown is different: that is a heal you are about to say out loud to
     somebody who isn't on the app, so it rolls and stops there. */
  const onMe = picked.indexOf(deviceId()) !== -1 || (!picked.length && !spellTakesTargets(spell));
  if (onMe) applyHp("heal", total);

  const others = picked.filter(device => device !== deviceId());
  if (others.length && typeof party !== "undefined" && party.status !== "none") {
    others.forEach(device => partySendHeal(spell.name, total, device));
  }
}

function castTargetNames(state) {
  const roster = castTargetRoster();
  const names = state.targets
    .map(device => (roster.find(m => m.device === device) || {}).name)
    .filter(Boolean);
  if (state.strangers) names.push(state.strangers === 1 ? "someone else" : state.strangers + " others");
  return names;
}

/* A concentration spell aimed at other players actually lands on their sheets.
   Anything instantaneous -- a heal -- is a number said out loud at the table,
   and pushing an effect for it would leave "Cure Wounds" sitting on somebody's
   sheet forever with nothing to ever take it off. */
function spellLeavesSomethingBehind(spell) {
  return spellIsConcentration(spell) || (spell.effects || []).length > 0;
}

function shareCastWithTargets(spell, devices, level) {
  const picked = devices || [];
  if (!spellLeavesSomethingBehind(spell)) return;

  const onMe = picked.indexOf(deviceId()) !== -1 || (!picked.length && !spellTakesTargets(spell));
  const group = effectGroupForSpell(spell, onMe);

  const others = picked.filter(device => device !== deviceId());
  if (!others.length) return;
  if (typeof party === "undefined" || party.status === "none") return;

  // remembered on the caster's own copy: the caster is the one who will drop
  // concentration, and is therefore the one who has to know whose sheets to clear
  group.castOn = others.slice();
  /* Their copy carries the spell's own modifiers even when the caster kept
     none -- casting Bless on three other people should bless them, and should
     not bless you. Same id both ways, because the id is what takes it back. */
  const theirs = Object.assign({}, group, { effects: spellEffectRows(spell) });
  others.forEach(device => partyPushEffect(theirs, device));
}

function spellEffectRows(spell) {
  return JSON.parse(JSON.stringify(spell.effects || []));
}

/* The group the caster keeps. It exists even when the spell landed only on
   other people, because concentration is the caster's to hold and to drop --
   but it carries the spell's modifiers only when the caster is a target,
   so holding Bless for the party doesn't quietly bless the cleric too. */
function effectGroupForSpell(spell, onMe) {
  const existing = (character.activeEffects || []).find(g => g.name === spell.name);
  if (existing) return existing;
  const group = {
    id: makeId(character.activeEffects || []),
    name: spell.name,
    note: onMe ? "" : "Cast on someone else \u2014 you are holding it, not under it.",
    concentration: spellIsConcentration(spell),
    duration: { type: "Permanent", rounds: null },
    effects: onMe ? spellEffectRows(spell) : []
  };
  character.activeEffects.push(group);
  return group;
}
