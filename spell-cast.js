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

    ${spellTakesTargets(spell) ? castTargetsHtml(limit) : ""}

    <div class="btn-row-2" style="margin-top:18px;">
      <button class="btn-secondary" id="cast-cancel">Cancel</button>
      <button class="btn-primary" id="cast-confirm">Cast</button>
    </div>
  `;
}

function castTargetsHtml(limit) {
  const roster = (typeof party !== "undefined" && party.status !== "none") ? party.members : [];
  return `
    <div class="breakdown-subhead">Who it lands on${limit != null ? ` <span class="field-hint" style="display:inline;">up to ${limit}</span>` : ""}</div>
    ${roster.length ? roster.map(member => `
      <div class="member-row" data-cast-target="${esc(member.device)}" style="cursor:pointer;">
        <span>${esc(member.name)}${member.you ? " (you)" : ""}</span>
        <span class="radio-dot${castState.targets.indexOf(member.device) !== -1 ? " selected" : ""}"></span>
      </div>
    `).join("") : `<div class="empty-hint">Nobody else is in the party.</div>`}
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
  shareCastWithTargets(spell, state.targets);

  const on = named.length ? " on " + named.join(", ") : "";
  if (spent) showToast("Cast " + spell.name + on + " · spent a " + slotName + "-level slot");
  else if (!slot) showToast("Cast " + spell.name + on + " · no " + slotName + "-level slots on this sheet");
  else showToast("Cast " + spell.name + on + " · slot not spent");

  if (spell.attackRoll) rollSpellAttack(spell);
  renderContent();
}

function castTargetNames(state) {
  const roster = (typeof party !== "undefined" && party.members) || [];
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
function shareCastWithTargets(spell, devices) {
  if (!devices || !devices.length) return;
  if (typeof party === "undefined" || party.status === "none") return;
  if (!spellIsConcentration(spell)) return;

  const others = devices.filter(device => device !== deviceId());
  if (!others.length) return;

  const group = effectGroupForSpell(spell);
  // remembered on the caster's own copy: the caster is the one who will drop
  // concentration, and is therefore the one who has to know whose sheets to clear
  group.castOn = others.slice();
  others.forEach(device => partyPushEffect(group, device));
}

function effectGroupForSpell(spell) {
  const existing = (character.activeEffects || []).find(g => g.name === spell.name);
  if (existing) return existing;
  const group = {
    id: makeId(character.activeEffects || []),
    name: spell.name,
    note: "",
    concentration: true,
    duration: { type: "Permanent", rounds: null },
    effects: []
  };
  character.activeEffects.push(group);
  return group;
}
