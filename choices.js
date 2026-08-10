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
  // Expertise: already proficient (1), not already Expertise (2)
  if (pending.kind === "skill") return Object.keys(character.skillProficiency).filter(name => character.skillProficiency[name] === 1);
  if (pending.kind === "fightingStyle") return FIGHTING_STYLES.map(f => f.label);
  if (pending.kind === "cantrip") return SRD_CANTRIPS.map(c => c.name);
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
    const c = SRD_CANTRIPS.find(x => x.name === label);
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

function resolveChoiceHtml(pending) {
  const options = choiceOptionsFor(pending);
  return `
    <div class="modal-heading">${esc(pending.prompt)}</div>
    <div class="breakdown-source" style="margin-bottom:12px;">From ${esc(pending.source)} — pick ${pending.count}</div>
    ${options && options.length ? `
      ${options.map(opt => `
        <button type="button" class="toggle-btn creator-option" data-choice-option="${esc(opt)}" style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px 14px;">
          <div>${esc(opt)}</div>
          ${choiceOptionDescFor(pending, opt) ? `<div class="field-hint" style="margin-top:2px;">${esc(choiceOptionDescFor(pending, opt))}</div>` : ""}
        </button>
      `).join("")}
      <button class="btn-primary" id="choice-confirm-button">Confirm</button>
    ` : `<div class="empty-hint">Nothing to pick from yet — use the field below.</div>`}

    <div class="breakdown-subhead" style="margin-top:18px;">Or manage it yourself</div>
    <div class="breakdown-source" style="margin-bottom:8px;">Type what you picked. No mechanics applied — you're tracking this one, same as a paper sheet.</div>
    ${textFieldHtml("choice-manual-input", "What did you pick?", "", { placeholder: "e.g. Draconic" })}
    <button class="btn-secondary" id="choice-manual-button">Save as Written</button>
  `;
}

function wireResolveChoiceModal(pending, onResolved) {
  document.querySelectorAll("[data-choice-option]").forEach(btn => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.choiceOption;
      const idx = choiceSelected.indexOf(value);
      if (idx >= 0) {
        choiceSelected.splice(idx, 1);
        btn.classList.remove("active");
      } else {
        if (choiceSelected.length >= pending.count) { showToast("You can only pick " + pending.count); return; }
        choiceSelected.push(value);
        btn.classList.add("active");
      }
    });
  });

  const confirmBtn = document.getElementById("choice-confirm-button");
  if (confirmBtn) confirmBtn.addEventListener("click", () => {
    if (choiceSelected.length !== pending.count) { showToast("Pick " + pending.count + " to continue"); return; }
    applyChoiceResolution(character, pending, choiceSelected.slice());
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

function applyChoiceResolution(character, pending, chosen) {
  if (pending.kind === "language") {
    chosen.forEach(l => { if (!character.languages.includes(l)) character.languages.push(l); });
    annotateTraitWithChoice(character, pending, chosen.join(", "));
  } else if (pending.kind === "skill") {
    chosen.forEach(name => { character.skillProficiency[name] = 2; });
    annotateTraitWithChoice(character, pending, chosen.join(", "));
  } else if (pending.kind === "cantrip") {
    chosen.forEach(name => {
      const known = SRD_CANTRIPS.find(x => x.name === name);
      const nextId = Math.max(0, ...character.spells.map(s => s.id), 0) + 1;
      character.spells.push({
        id: nextId, name: known ? known.name : name, level: 0, classSource: "Racial",
        castingTime: "A", attackRoll: false, desc: known ? known.desc : ""
      });
    });
    annotateTraitWithChoice(character, pending, chosen.join(", "));
  } else if (pending.kind === "fightingStyle") {
    const style = FIGHTING_STYLES.find(f => f.label === chosen[0]);
    const list = character.traits[pending.traitCategory];
    const entry = list && list.find(f => f.name === pending.featureName);
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
    if (entry && gained.length) entry.effects = (entry.effects || []).concat(gained);
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
