/* ============================================================
   FEATURE CHOICES (POC)

   A granted feature with a `.choice` descriptor (srd-data.js) owes the
   player a decision -- pendingChoiceFor()/grantPendingChoice() (rests.js)
   turn that into an entry on character.pendingChoices at creation or level-
   up. This file is where that decision actually gets made.

   Two ways to resolve one, matching how much the app can automate:

     - Pick from a real list. Where the answer has somewhere real to go --
       character.languages, skillProficiency, a spell, an effect on the
       granting feature -- picking updates the sheet the same way any other
       control does.
     - Type what you picked and skip the mechanics. The feature's trait entry
       gets a note saying what was chosen, same as writing it in the margin
       of a paper sheet. Always available, even for kinds with a list --
       nothing forces automation on someone who'd rather track it themselves.

   Fighting Style is the clearest example of both existing side by side in
   the same choice: Defense/Dueling/Archery attach a real effect because they
   map onto a stat the effects system already models; Protection/Great
   Weapon Fighting/Two-Weapon Fighting don't, so picking one is exactly the
   "save as written" path with nothing pretending otherwise. */

let choiceSelected = [];

/* `onResolved`, when given, is called instead of the usual close-and-render
   once the choice is answered -- that's how the creator and level-up chain
   straight into the next unresolved choice rather than dropping back to a
   banner the player has to come back and tap. Leave it out for the ordinary
   case (tapping a choice from the Character tab banner). */
function openResolveChoiceModal(id, onResolved) {
  const pending = character.pendingChoices.find(p => p.id === id);
  if (!pending) { if (onResolved) onResolved(); return; }
  choiceSelected = [];
  openModal("full", resolveChoiceHtml(pending));
  wireResolveChoiceModal(pending, onResolved);
}

// openModal() closes whatever's already open, so chaining straight into the
// next choice needs no explicit close -- only the final step does.
function finishChoiceResolution(onResolved) {
  renderContent();
  if (onResolved) onResolved(); else closeModal();
}

/* Walks a list of pendingChoice ids one modal at a time, then calls onDone.
   Used by the creator and level-up so every choice a build just granted gets
   answered before you're handed the finished character, instead of leaving
   them for the Character tab banner to nag about later. */
function resolveChoicesThen(ids, onDone) {
  if (!ids.length) { onDone(); return; }
  const [id, ...rest] = ids;
  openResolveChoiceModal(id, () => resolveChoicesThen(rest, onDone));
}

function choiceOptionsFor(pending) {
  if (pending.kind === "language") return SRD_LANGUAGES.filter(l => !character.languages.includes(l));
  /* Two opposite things share the "skill" kind, told apart by the granting
     feature's `grants`. Expertise (the default) doubles a skill you're
     already proficient in, so it offers the ones at 1. Half-Elf's Skill
     Versatility hands out two new proficiencies, so it offers the ones you
     don't have at all -- it used to run down the Expertise path and write
     Expertise onto skills you already knew. */
  if (pending.kind === "skill") {
    if (pending.grants === "proficiency") return ALL_SKILL_NAMES.filter(name => !character.skillProficiency[skillKey(name)]);
    return Object.keys(character.skillProficiency).filter(name => character.skillProficiency[name] === 1);
  }
  // a style you already have would create a second trait entry that applies
  // all over again -- two Defenses measured as +2 AC, not +1
  if (pending.kind === "fightingStyle") return FIGHTING_STYLES.map(f => f.label).filter(label => !hasFightingStyle(character, label));
  // every SRD cantrip, not just one class's list -- the generic choice
  // system has no per-choice class filter (see the "skill" branch above,
  // which doesn't filter by class either), so this is the same imprecision
  // High Elf's own "from the wizard spell list" flavor text already had
  // before SRD_SPELLS existed, just with a real 24-cantrip list now instead
  // of a 5-entry stub
  if (pending.kind === "cantrip") return SRD_SPELLS.filter(s => s.level === 0).map(s => s.name);
  // custom content's own author-written options (content.js) -- carried
  // straight through from the granting feature's .choice.options, the same
  // way pendingChoiceFor() carries kind/count/prompt
  if (pending.kind === "custom") return (pending.options || []).map(o => o.label);
  return null;               // no known list -- free text is the only path
}

function choiceOptionDescFor(pending, label) {
  if (pending.kind === "fightingStyle") {
    const style = FIGHTING_STYLES.find(f => f.label === label);
    // a disclaimer is only useful when a mechanic COULD exist here and
    // doesn't yet -- something that would land on this sheet or an ally's.
    // Protection lands on neither (it's a reaction to someone else's attack
    // roll, which this app never generates), so noMechanicNeeded skips the
    // "not modeled" note entirely rather than apologizing for a mechanic
    // that was never in scope
    if (!style) return "";
    if (style.effect || style.modeledElsewhere || style.noMechanicNeeded) return style.desc;
    return style.desc + " Not modeled yet — picking this saves it as written, same as the manual field below.";
  }
  if (pending.kind === "cantrip") {
    const c = SRD_SPELLS.find(x => x.level === 0 && x.name === label);
    return c ? c.desc : "";
  }
  if (pending.kind === "custom") {
    const opt = (pending.options || []).find(o => o.label === label);
    if (!opt) return "";
    // an author-written (or SRD-authored) description of what the option
    // actually does takes priority -- Draconic Ancestry's options and the
    // Ranger's Hunter subclass options are informational-only (no clean
    // effect category fits a breath weapon's shape/damage type), so without
    // this the label alone ("Gold -- Fire, 15 ft. cone (Dex save)") was all
    // the player ever saw. Falls back to summarizing the option's effects
    // when there's no desc but there is a mechanic (Half-Elf's +1 ability
    // score picks, every class's ASI options), same as before.
    if (opt.desc) return opt.desc;
    if (!opt.effects || !opt.effects.length) return "";
    return "Grants: " + opt.effects.map(e => featureEffectSummary(e, totalLevel(character))).join(", ");
  }
  return "";
}

/* Picking, everywhere. Tapping a selected option clears it; tapping a new one
   at the limit replaces the most recent pick rather than refusing.

   Refusing was the obvious rule and the wrong one now that selecting is also
   how you read an option: at "pick 1" every look at a second option would
   have to be preceded by un-picking the first, and the toast that said so was
   the app arguing with a tap that had no other meaning. Replacing the last
   pick keeps earlier deliberate picks in a "pick 2" intact -- only the one
   you just made gives way. */
function pickInto(chosen, value, count) {
  const idx = chosen.indexOf(value);
  if (idx >= 0) { chosen.splice(idx, 1); return chosen; }
  if (chosen.length >= count) chosen[chosen.length - 1] = value;
  else chosen.push(value);
  return chosen;
}

/* Same three kinds choiceOptionsFor() (choices.js) offers, but read off
   creatorState instead of a live character -- there isn't one yet. Language
   and skill options depend on picks made earlier in the wizard (skills has
   to come before this step); fighting style and cantrip are static lists
   either way, so those two are identical to the resolved-character version. */
function creatorKnownSkills() {
  const bg = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
  // feature-granted proficiencies are picked in the Skills step now, so they
  // count as known here -- Expertise offers the skills you have, and it would
  // otherwise not see the two Skill Versatility just handed you
  const fromFeatures = creatorFeatureSkillChoices().reduce((all, choice) => {
    const answer = creatorState.choiceAnswers[choice.featureName];
    return all.concat((answer && answer.chosen) || []);
  }, []);
  const known = (bg ? bg.skills : [])
    .concat(creatorState.raceSkillChoices, creatorState.classSkillChoices, fromFeatures);
  return known.filter((name, i) => known.indexOf(name) === i);
}

function creatorChoiceOptionsFor(pending) {
  if (pending.kind === "language") return SRD_LANGUAGES.filter(l => l !== "Common");
  // Expertise offers the skills you already have; Skill Versatility (the
  // same kind with grants: "proficiency") offers the ones you don't -- see
  // choiceOptionsFor() in choices.js, whose live-character twin this is.
  if (pending.kind === "skill") {
    const known = creatorKnownSkills();
    return pending.grants === "proficiency" ? ALL_SKILL_NAMES.filter(name => !known.includes(name)) : known;
  }
  if (pending.kind === "fightingStyle") return FIGHTING_STYLES.map(f => f.label);
  if (pending.kind === "cantrip") return SRD_SPELLS.filter(s => s.level === 0).map(s => s.name);
  if (pending.kind === "custom") return (pending.options || []).map(o => o.label);
  return null;
}


/* One option, one row, one tap: the row IS the pick, and picking it is also
   what reveals what it does. Every place the app asks "which of these?" --
   the creator's inline choice cards and this modal -- renders through here,
   so the two can't drift apart.

   The history is worth keeping. Options were first collapse-cards you opened
   to reach a "Choose this" button inside (two taps for one decision), then a
   row plus a separate +/- that opened the text. Both put an expander on
   screen next to every option, and the row still had to carry enough text to
   choose by -- which is how a dragon type came to be labelled
   "Gold -- Fire, 15 ft. cone (Dex save)".

   Now the row carries the name and nothing else, and selecting it opens its
   description underneath. Reading and picking are the same gesture, which
   only works because picking is cheap: at the limit the next pick replaces
   the one made last rather than being refused (see the pick handlers), so
   browsing by tapping can never strand you.

   `value` is what the pick handler reads back; the caller supplies the
   attribute name because the creator keys its options by "featureName|||label"
   and this modal by label alone. */
function choiceOptionRowHtml(label, value, opts) {
  const desc = opts.desc || "";
  const selected = !!opts.selected;
  return `
    <div class="creator-option-row">
      <button type="button" class="creator-option ${selected ? "active" : ""}" data-${opts.pickAttr}="${esc(value)}">
        <span class="creator-option-label">${esc(label)}</span>
        <span class="creator-option-mark">${selected ? "\u2713" : ""}</span>
      </button>
      ${desc && selected ? `<div class="creator-option-desc open">${esc(desc)}</div>` : ""}
    </div>`;
}

function resolveChoiceHtml(pending) {
  const options = choiceOptionsFor(pending);
  return `
    <div class="modal-heading">${esc(pending.prompt)}</div>
    <div class="breakdown-source" style="margin-bottom:12px;">From ${esc(pending.source)} — pick ${pending.count}</div>
    ${options && options.length ? `
      ${options.map(opt => choiceOptionRowHtml(opt, opt, {
        desc: choiceOptionDescFor(pending, opt),
        selected: choiceSelected.includes(opt),
        pickAttr: "choice-option"
      })).join("")}
      <button class="btn-primary" id="choice-confirm-button">Confirm</button>
    ` : `<div class="empty-hint">Nothing to pick from yet — use the field below.</div>`}

    <div class="breakdown-subhead" style="margin-top:18px;">Or manage it yourself</div>
    <div class="breakdown-source" style="margin-bottom:8px;">Type what you picked. No mechanics applied — you're tracking this one, same as a paper sheet.</div>
    ${textFieldHtml("choice-manual-input", "What did you pick?", "", { placeholder: "e.g. Draconic" })}
    <button class="btn-secondary" id="choice-manual-button">Save as Written</button>
  `;
}

function wireResolveChoiceModal(pending, onResolved) {
  // picking re-renders the option list: which rows are ticked, and which
  // description is therefore showing, both depend on module state -- redraw
  // the modal content in place rather than closing and reopening, same as
  // redrawCreator() does for the builder
  function redraw() {
    const container = document.querySelector("#modal-overlay .modal-content");
    if (!container) return;
    container.innerHTML = resolveChoiceHtml(pending);
    wireResolveChoiceModal(pending, onResolved);
  }

  document.querySelectorAll("[data-choice-option]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const value = btn.dataset.choiceOption;
      pickInto(choiceSelected, value, pending.count);
      redraw();
    });
  });

  const confirmBtn = document.getElementById("choice-confirm-button");
  if (confirmBtn) confirmBtn.addEventListener("click", () => {
    if (choiceSelected.length !== pending.count) { showToast("Pick " + pending.count + " to continue"); return; }
    // a refused grant (a duplicate fighting style) leaves the choice pending
    // and the modal open, with its own toast already shown
    if (applyChoiceResolution(character, pending, choiceSelected.slice()) === false) return;
    showToast("Resolved: " + pending.source);
    finishChoiceResolution(onResolved);
  });

  document.getElementById("choice-manual-button").addEventListener("click", () => {
    const text = document.getElementById("choice-manual-input").value.trim();
    if (!text) { showToast("Type what you picked, or choose from the list above"); return; }
    resolveChoiceManually(character, pending, text);
    showToast("Saved: " + pending.source);
    finishChoiceResolution(onResolved);
  });
}

/* Writes what was picked onto the feature that granted the choice, so the
   sheet reads correctly regardless of whether the pick was automated. Safe
   to call more than once -- it replaces its own note rather than stacking. */
function annotateTraitWithChoice(character, pending, noteText) {
  const list = character.traits[pending.traitCategory];
  const entry = list && list.find(f => f.name === pending.featureName);
  if (!entry || !noteText) return;
  entry.desc = entry.desc.replace(/\s*— Chosen:.*/, "");
  entry.desc = (entry.desc ? entry.desc + " " : "") + "— Chosen: " + noteText;
}

/* 5e's own words on every Ability Score Improvement: "Can't exceed 20."
   Nothing enforced it, so taking +2 Strength at successive ASIs walked a
   score to 25. The cap belongs here rather than in effectiveAbilityScore():
   that function is the sum of every source, and a magic item or feature
   deliberately written to push a score past 20 has to keep working. What a
   *choice* grants is the ASI-shaped case, so a granted increase is trimmed
   to whatever room is left below 20 -- and a trimmed grant stores the
   trimmed number, keeping the breakdown's sources summing to the total. */
const ABILITY_SCORE_CAP = 20;

function cappedAbilityEffects(character, effects) {
  const granted = {};        // what this one resolution has already added, per ability
  const kept = [];
  let trimmed = false;

  effects.forEach(effect => {
    if (effect.category !== "Ability Score") { kept.push(effect); return; }
    const ability = effect.value.ability;
    const current = effectiveAbilityScore(character, ability) + (granted[ability] || 0);
    const amount = resolveScalingValue(effect.value.amount, totalLevel(character));
    const allowed = Math.max(0, Math.min(amount, ABILITY_SCORE_CAP - current));
    if (allowed !== amount) trimmed = true;
    if (!allowed) return;
    granted[ability] = (granted[ability] || 0) + allowed;
    kept.push(allowed === amount ? effect
      : { category: effect.category, value: Object.assign({}, effect.value, { amount: allowed }) });
  });

  return { effects: kept, trimmed };
}

function applyChoiceResolution(character, pending, chosen) {
  if (pending.kind === "language") {
    chosen.forEach(l => { if (!character.languages.includes(l)) character.languages.push(l); });
    annotateTraitWithChoice(character, pending, chosen.join(", "));
  } else if (pending.kind === "skill") {
    // proficiency (1) for a Skill Versatility-style grant, expertise (2) for
    // the Expertise-style default -- and never a downgrade for a skill that
    // already has expertise. skillKey() is what keeps the one skill with a
    // lower-case interior word ("Sleight of Hand") landing on the same key
    // the sheet reads.
    chosen.forEach(name => {
      const key = skillKey(name);
      if (pending.grants === "proficiency") { if (!character.skillProficiency[key]) character.skillProficiency[key] = 1; }
      else character.skillProficiency[key] = 2;
    });
    annotateTraitWithChoice(character, pending, chosen.join(", "));
  } else if (pending.kind === "cantrip") {
    chosen.forEach(name => {
      const known = SRD_SPELLS.find(x => x.level === 0 && x.name === name);
      const nextId = Math.max(0, ...character.spells.map(s => s.id), 0) + 1;
      character.spells.push({
        id: nextId, name: known ? known.name : name, level: 0, classSource: "Racial",
        castingTime: known ? spellCastingTimeCode(known.castingTime) : "A",
        attackRoll: known ? spellLikelyAttackRoll(known.desc) : false,
        desc: known ? known.desc : ""
      });
    });
    annotateTraitWithChoice(character, pending, chosen.join(", "));
  } else if (pending.kind === "fightingStyle") {
    const style = FIGHTING_STYLES.find(f => f.label === chosen[0]);
    const list = character.traits[pending.traitCategory];
    const entry = list && list.find(f => f.name === pending.featureName);
    // defensive twin of the filtered option list above: whatever route got
    // here, granting a style twice would leave two entries both applying
    if (style && entry && entry.name !== "Fighting Style: " + style.label && hasFightingStyle(character, style.label)) {
      showToast("You already have Fighting Style: " + style.label);
      return false;
    }
    if (entry && style) {
      entry.name = "Fighting Style: " + style.label;
      entry.desc = style.desc;
      if (style.effect) entry.effects = [style.effect];
    }
  } else if (pending.kind === "custom") {
    // one or more author-written options, each optionally carrying its own
    // effects (content.js) -- merged onto the granting feature the same way
    // a homebrew "Add Feature" effect would be, then annotated like any
    // other resolved choice so the sheet always says what was picked
    const list = character.traits[pending.traitCategory];
    const entry = list && list.find(f => f.name === pending.featureName);
    const options = pending.options || [];
    const gained = [];
    chosen.forEach(label => {
      const opt = options.find(o => o.label === label);
      if (opt && opt.effects && opt.effects.length) gained.push(...opt.effects);
    });
    const capped = cappedAbilityEffects(character, gained);
    if (capped.trimmed) showToast("An ability score can't go past " + ABILITY_SCORE_CAP + " — that increase was trimmed");
    if (entry && capped.effects.length) entry.effects = (entry.effects || []).concat(capped.effects);
    annotateTraitWithChoice(character, pending, chosen.join(", "));
  } else {
    annotateTraitWithChoice(character, pending, chosen.join(", "));
  }

  character.pendingChoices = character.pendingChoices.filter(p => p.id !== pending.id);
}

function resolveChoiceManually(character, pending, text) {
  annotateTraitWithChoice(character, pending, text);
  character.pendingChoices = character.pendingChoices.filter(p => p.id !== pending.id);
}
