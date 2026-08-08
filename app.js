/* ============================================================
   CONSTANTS
   ============================================================ */

const ALL_CONDITIONS = [
  "Blinded", "Charmed", "Concentration", "Deafened", "Exhaustion", "Frightened",
  "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"
];

const MODIFIER_STATS = ["AC", "Initiative", "Speed", "Attack Rolls", "Damage Rolls", "Proficiency Bonus", "Spell Attack", "Spell DC"];
const EFFECT_CATEGORIES_GENERAL = ["Condition", "Ability Score", "Saving Throw", "Skill", "Bonus"];
const EFFECT_CATEGORIES_FEATURE = ["Ability Score", "Saving Throw", "Skill", "Bonus"];


/* ============================================================
   DICE ROLLING
   ============================================================ */

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollNotation(notation) {
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
        for (let i = 0; i < count; i++) rolled += rollDie(sides);
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
    if (operators[i] === "+") total += vals[i + 1];
    else if (operators[i] === "-") total -= vals[i + 1];
  }
  return { total: Math.round(total * 100) / 100, breakdown: resolvedTokens.join(" ") };
}

let activeToasts = [];

function showRollToast(label, notation) {
  const result = rollNotation(notation);
  const toast = document.createElement("div");
  toast.className = "roll-toast";
  toast.innerHTML = `
    <div class="roll-toast-label">${label}</div>
    <div class="roll-toast-value">${result.total}</div>
    <div class="roll-toast-sub">${notation} \u00B7 ${result.breakdown}</div>
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
   MODAL SYSTEM
   ============================================================ */

function openModal(mode, contentHtml) {
  closeModal();
  const phone = document.querySelector(".phone");
  const overlay = document.createElement("div");
  overlay.id = "modal-overlay";
  overlay.className = "modal-overlay modal-" + mode;
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

function openBreakdownModal(title, total, suffix, sources, rollButton) {
  const rows = sources.map(s => `<div class="breakdown-row"><span>${s.label}</span><span>${formatModifier(s.value)}</span></div>`).join("");
  openModal("center", `
    <div class="breakdown-title">${title}</div>
    ${rows}
    <hr class="breakdown-divider">
    <div class="breakdown-total"><span>Total</span><span>${total}${suffix || ""}</span></div>
    ${rollButton ? `<button class="btn-primary" id="breakdown-roll-btn" style="margin-top:14px;">Roll ${rollButton.label}</button>` : ""}
  `);
  if (rollButton) document.getElementById("breakdown-roll-btn").addEventListener("click", () => showRollToast(rollButton.label, rollButton.notation));
}

function effectSubfieldsHtml(category, idPrefix) {
  if (category === "Condition") {
    return `<div class="field"><label>Condition</label><select id="${idPrefix}-condition">${ALL_CONDITIONS.map(c => `<option>${c}</option>`).join("")}</select></div>`;
  }
  if (category === "Ability Score" || category === "Saving Throw") {
    return `<div class="field-row">
      <div class="field"><label>Ability</label><select id="${idPrefix}-ability">${Object.keys(ABILITY_FULL_NAMES).map(a => `<option>${a}</option>`).join("")}</select></div>
      <div class="field"><label>Amount</label><input id="${idPrefix}-amount" type="number" value="-2"></div>
    </div>`;
  }
  if (category === "Skill") {
    return `<div class="field-row">
      <div class="field"><label>Skill</label><select id="${idPrefix}-skill">${Object.keys(character.skillAbilityMap).map(s => `<option>${s}</option>`).join("")}</select></div>
      <div class="field"><label>Amount</label><input id="${idPrefix}-amount" type="number" value="2"></div>
    </div>`;
  }
  return `<div class="field-row">
    <div class="field"><label>Stat</label><select id="${idPrefix}-stat">${MODIFIER_STATS.map(s => `<option>${s}</option>`).join("")}</select></div>
    <div class="field"><label>Amount</label><input id="${idPrefix}-amount" type="number" value="1"></div>
  </div>`;
}

function readEffectValueFromForm(category, idPrefix) {
  if (category === "Condition") return { condition: document.getElementById(idPrefix + "-condition").value };
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
  const map = { ability: "-ability", skill: "-skill", stat: "-stat", amount: "-amount", condition: "-condition" };
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
    <div class="field"><label>Custom Label</label><input id="${idPrefix}-tag-custom" value="${value || ""}" placeholder="e.g. Per Day"></div>
    <div class="form-warning">Custom recharges aren't restored by a Short or Long Rest \u2014 you'll need to reset this one yourself.</div>
  `;
}

function rechargeFieldHtml(idPrefix, currentTag) {
  const known = ["SR", "LR", "\u2014"];
  const isKnown = known.includes(currentTag);
  const selectedType = isKnown ? (currentTag === "\u2014" ? "None" : currentTag) : "Custom";
  return `
    <div class="field"><label>Recharges</label>
      <select id="${idPrefix}-tag-type">
        <option value="SR" ${selectedType === "SR" ? "selected" : ""}>Short Rest</option>
        <option value="LR" ${selectedType === "LR" ? "selected" : ""}>Long Rest</option>
        <option value="None" ${selectedType === "None" ? "selected" : ""}>Doesn't Recharge</option>
        <option value="Custom" ${selectedType === "Custom" ? "selected" : ""}>Custom</option>
      </select>
    </div>
    <div id="${idPrefix}-tag-custom-wrap">
      ${selectedType === "Custom" ? rechargeCustomFieldHtml(idPrefix, isKnown ? "" : currentTag) : ""}
    </div>
  `;
}

function wireRechargeField(idPrefix) {
  const select = document.getElementById(idPrefix + "-tag-type");
  const wrap = document.getElementById(idPrefix + "-tag-custom-wrap");
  select.addEventListener("change", () => {
    wrap.innerHTML = select.value === "Custom" ? rechargeCustomFieldHtml(idPrefix, "") : "";
  });
}

function readRechargeValue(idPrefix) {
  const type = document.getElementById(idPrefix + "-tag-type").value;
  if (type === "Custom") {
    const input = document.getElementById(idPrefix + "-tag-custom");
    return input && input.value.trim() ? input.value.trim() : "Custom";
  }
  if (type === "None") return "\u2014";
  return type;
}


/* ============================================================
   GENERIC TOAST (non-roll messages)
   ============================================================ */

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "roll-toast";
  toast.innerHTML = `<div class="roll-toast-value" style="font-size:15px;">${message}</div>`;
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

let savedCharacters = [
  { id: 1, name: "Sigrid of Chester", classLine: "Fighter 5 / Rogue 2" }
];

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
  document.getElementById("char-class-display").textContent = character.classLine;
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

    <div class="field"><label>Name</label><input id="editor-name-input" type="text" value="${character.name}"></div>
    <div class="field">
      <label>Alignment</label>
      <select id="editor-alignment-input">${ALIGNMENTS.map(a => `<option ${character.alignment === a ? "selected" : ""}>${a}</option>`).join("")}</select>
    </div>
    <div class="field"><label>Appearance</label><textarea id="editor-appearance-input" placeholder="Physical description">${character.appearance || ""}</textarea></div>
    <div class="field"><label>Personality Traits</label><textarea id="editor-traits-input" placeholder="How they act, talk, carry themselves">${character.personalityTraits || ""}</textarea></div>
    <div class="field"><label>Ideals</label><textarea id="editor-ideals-input" placeholder="What they believe in">${character.ideals || ""}</textarea></div>
    <div class="field"><label>Bonds</label><textarea id="editor-bonds-input" placeholder="Who or what they're tied to">${character.bonds || ""}</textarea></div>
    <div class="field"><label>Flaws</label><textarea id="editor-flaws-input" placeholder="What holds them back">${character.flaws || ""}</textarea></div>
    <div class="field"><label>Backstory</label><textarea id="editor-backstory-input" class="field-textarea-lg" placeholder="Their history">${character.backstory || ""}</textarea></div>

    <button class="btn-primary" id="editor-save-button">Save</button>
  `);

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

  const listHtml = savedCharacters.length
    ? savedCharacters.map(c => `
        <div class="char-card" data-open-char="${c.id}">
          <div>
            <div class="char-card-name">${c.name}${c.customBuild ? ` <span class="res-tag" style="background:#5A2C29;color:#F0908A;">CUSTOM</span>` : ""}</div>
            <div class="char-card-class">${c.classLine}</div>
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
    card.addEventListener("click", () => showScreen("sheet"));
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
    showToast("Importing " + file.name + "\u2026");
    setTimeout(() => {
      const newId = Math.max(0, ...savedCharacters.map(c => c.id)) + 1;
      savedCharacters.push({ id: newId, name: "Imported Character", classLine: "Unknown Class" });
      renderSelectorScreen();
      showToast("Character imported");
    }, 800);
  });
}

function openCharacterMenu(id) {
  const c = savedCharacters.find(x => x.id === id);
  openModal("center", `
    <div class="modal-heading">${c.name}</div>
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

function exportCharacter(c) {
  const filename = c.name.replace(/\s+/g, "_") + ".json";
  const dataStr = JSON.stringify(character, null, 2);
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
    <div class="modal-heading">Delete ${c.name}?</div>
    <div class="breakdown-source" style="margin-bottom:14px;">This can't be undone.</div>
    <button class="btn-primary" id="confirm-delete-char-button" style="background:#5A2C29;color:#F0908A;margin-bottom:8px;">Delete</button>
    <button class="btn-secondary" id="cancel-delete-char-button">Cancel</button>
  `);
  document.getElementById("confirm-delete-char-button").addEventListener("click", () => {
    savedCharacters = savedCharacters.filter(x => x.id !== id);
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
  return `<button class="toggle-btn creator-option ${active ? "active" : ""}" data-${dataAttr}="${value}" style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px 14px;">${label}</button>`;
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
          raceSlot = `<span style="display:inline-block;width:44px;text-align:center;"><input type="checkbox" data-race-skill="${s.name}" ${isRace ? "checked" : ""} ${disabled ? "disabled" : ""}></span>`;
        }
        if (cls && cls.skillChoices.options.includes(s.name)) {
          const disabled = !isClass && creatorState.classSkillChoices.length >= cls.skillChoices.count;
          classSlot = `<span style="display:inline-block;width:44px;text-align:center;"><input type="checkbox" data-class-skill="${s.name}" ${isClass ? "checked" : ""} ${disabled ? "disabled" : ""}></span>`;
        }
      }

      html += `
        <div class="skill-row" style="cursor:default;">
          <span class="skill-name">${s.name}</span>
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


/* ---------- step: name / appearance / backstory ---------- */

function finalStepHtml(stepNum, totalSteps) {
  return `
    <div class="modal-heading">New Character</div>
    <div class="breakdown-source">Step ${stepNum} of ${totalSteps} \u00B7 Name & Details</div>
    <div class="field" style="margin-top:14px;">
      <label>Character Name</label>
      <input id="creator-name-input" type="text" value="${creatorState.name}" placeholder="e.g. Sigrid of Chester">
    </div>
    <div class="field">
      <label>Appearance (optional)</label>
      <input id="creator-appearance-input" type="text" value="${creatorState.appearance}" placeholder="Brief physical description">
    </div>
    <div class="field">
      <label>Backstory (optional)</label>
      <input id="creator-backstory-input" type="text" value="${creatorState.backstory}" placeholder="A line or two of history">
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

    const newId = Math.max(0, ...savedCharacters.map(c => c.id)) + 1;
    savedCharacters.push({
      id: newId,
      name: creatorState.name,
      classLine: `${creatorState.charClass}${creatorState.subclass ? " (" + creatorState.subclass + ")" : ""} \u00B7 ${creatorState.subrace ? creatorState.subrace + " " : ""}${creatorState.race}`,
      customBuild: creatorState.customBuild
    });
    closeModal();
    renderSelectorScreen();
    showToast(creatorState.customBuild ? "Character created (custom)" : "Character created");
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
            <div class="res-name">${party.name}</div>
            <div class="atk-range">${party.status === "hosting" ? `Hosting \u00B7 Code ${party.code}` : (party.gm ? `Connected \u00B7 GM ${party.gm}` : "Connected \u00B7 No GM")}</div>
          </div>
        </div>
        <div class="breakdown-subhead">Members</div>
        ${party.members.map(m => `
          <div class="member-row">
            <span>${m.name}</span>
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
        <div class="res-row" data-join-party="${p.name}" style="cursor:pointer;">
          <div>
            <div class="res-name">${p.name}</div>
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
      <div class="empty-hint" style="padding:50px 20px;">Connecting to ${partyConnectingTo.name}\u2026</div>
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

function restoreOnRest(entry, isLong) {
  const rule = (entry.tag || entry.recharge || "").toUpperCase();
  if (rule !== "SR" && rule !== "LR") return false;      // custom / "—" never auto-restore
  if (rule === "LR" && !isLong) return false;
  if (entry.current === entry.max) return false;
  entry.current = entry.max;
  return true;
}

// 5e: a long rest returns half your total hit dice, rounded down, minimum one.
// The player picks which in the real rules; we fill the largest pools first.
function regainHitDice() {
  const pools = character.hitDice || [];
  let budget = Math.max(1, Math.floor(pools.reduce((sum, p) => sum + p.total, 0) / 2));
  let regained = 0;
  pools.forEach(pool => {
    while (budget > 0 && pool.current < pool.total) { pool.current++; budget--; regained++; }
  });
  return regained;
}

function plural(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

function applyRest(kind) {
  const isLong = kind === "long";
  const summary = [];

  const resources = character.resources.filter(r => restoreOnRest(r, isLong)).length;
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
  const cleared = before - character.activeEffects.length;
  if (cleared) summary.push(plural(cleared, "effect") + " cleared");

  if (character.concentration.active) {
    character.concentration.active = false;
    character.concentration.spell = "";
    summary.push("concentration broken");
  }

  if (isLong) {
    const maxHP = calculateMaxHP(character);
    if (character.hp.current !== maxHP.total) summary.push("HP restored");
    character.hp.current = maxHP.total;
    character.hp.temp = 0;                                // temp HP ends on a long rest
    const dice = regainHitDice();
    if (dice) summary.push(plural(dice, "hit die").replace("dies", "dice"));
  }

  closeModal();
  renderContent();
  showToast((isLong ? "Long rest" : "Short rest") + " · " + (summary.join(" · ") || "nothing to restore"));
}

function openAppMenu() {
  openModal("sheet", `
    <div class="modal-heading">Menu</div>
    <button class="btn-primary" id="menu-short-rest">Short Rest</button>
    <button class="btn-secondary" id="menu-long-rest">Long Rest</button>
    <div class="menu-note">
      Short rest restores anything tagged SR and clears short-term effects.
      Long rest also restores LR items, all hit points, and half your spent hit dice.
      Custom recharges are never restored automatically.
    </div>
  `);
  document.getElementById("menu-short-rest").addEventListener("click", () => applyRest("short"));
  document.getElementById("menu-long-rest").addEventListener("click", () => applyRest("long"));
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

function renderCombatTab() {
  const ac = calculateAC(character);
  const maxHP = calculateMaxHP(character);
  const initiative = calculateInitiative(character);
  const speed = calculateSpeed(character);
  const passivePerception = calculatePassivePerception(character);
  const profBonus = calculateProficiencyBonus(character);
  const hpPercent = (character.hp.current / maxHP.total) * 100;

  return `
    <div class="hp-card" id="hp-card">
      <div class="hp-label">Hit Points</div>
      <div class="hp-bar-track">
        <div class="hp-bar-fill" style="width: ${hpPercent}%"></div>
        <div class="hp-bar-text">${character.hp.current} / ${maxHP.total}${character.hp.temp ? ` <span class="hp-temp">+${character.hp.temp} temp</span>` : ""}</div>
      </div>
    </div>

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
      ${character.activeEffects.map(effect => `
        <div class="chip" data-effect-view="${effect.id}">${effectSummaryLabel(effect)}<button class="chip-remove" data-effect-remove="${effect.id}">\u2715</button></div>
      `).join("") || `<div class="empty-hint">Nothing active</div>`}
    </div>

    ${character.concentration.visible ? `
      <div class="conc-row">
        <span>Concentration${character.concentration.active && character.concentration.spell ? " \u00B7 " + character.concentration.spell : ""}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="toggle-btn ${character.concentration.active ? "active" : ""}" id="concentration-toggle">${character.concentration.active ? "Active" : "None"}</button>
          <button class="chip-remove" id="concentration-remove">\u2715</button>
        </div>
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
        <div class="res-name-wrap" data-slot-view="${lvl}"><span class="res-name">${slotRowName(lvl)}</span><span class="res-tag">${slot.recharge || "LR"}</span></div>
        <div class="stepper"><button data-slot-minus="${lvl}">\u2212</button><span class="res-count">${slot.current}/${slot.max}</span><button data-slot-plus="${lvl}">+</button></div>
      </div>
    `;
    }).join("")}
    ${character.resources.map(r => `
      <div class="res-row">
        <div class="res-name-wrap" data-resource-view="${r.id}"><span class="res-name">${r.name}</span><span class="res-tag">${r.tag}</span></div>
        <div class="stepper"><button data-res-minus="${r.id}">\u2212</button><span class="res-count">${r.current}/${r.max}</span><button data-res-plus="${r.id}">+</button></div>
      </div>
    `).join("")}

    ${(character.hitDice && character.hitDice.length) ? `
      <div class="section-head-row">
        <div class="section-head">Hit Dice</div>
      </div>
      ${character.hitDice.map((pool, index) => `
        <div class="res-row">
          <div class="res-name-wrap"><span class="res-name">${pool.die}</span><span class="res-tag">½ LR</span></div>
          <div class="stepper">
            <span class="res-count">${pool.current}/${pool.total}</span>
            <button class="atk-pill" data-spend-hitdie="${index}">Spend</button>
          </div>
        </div>
      `).join("")}
    ` : ""}

    <div class="section-head-row">
      <div class="section-head">Attacks</div>
      <button class="add-link" id="add-attack-button">+ Add</button>
    </div>
    ${weaponList(character).map(weapon => {
      const atk = calculateAttack(character, weapon);
      const damageNotation = atk.damageDice + (atk.damageBonusTotal ? formatModifier(atk.damageBonusTotal) : "");
      const icon = weapon.weaponType === "ranged" ? "\uD83C\uDFF9" : "\u2694\uFE0F";
      return `
        <div class="atk-row" data-atk-detail="${weapon.id}">
          <div class="atk-icon">${icon}</div>
          <div class="atk-name">${weapon.name}</div>
          <div class="atk-range">${weapon.range || ""}</div>
          <button class="atk-pill" data-roll-tohit="${weapon.id}">${formatModifier(atk.toHitTotal)}</button>
          <button class="atk-pill" data-roll-damage="${weapon.id}">${damageNotation}</button>
        </div>
      `;
    }).join("")}
  `;
}

function wireCombatTab() {
  document.getElementById("hp-card").addEventListener("click", openHpCalculator);

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

  const profBonus = calculateProficiencyBonus(character);
  document.getElementById("prof-bonus-box").addEventListener("click", () =>
    openBreakdownModal("Proficiency Bonus", formatModifier(profBonus.total), "", profBonus.sources));

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

  const concToggle = document.getElementById("concentration-toggle");
  if (concToggle) concToggle.addEventListener("click", () => { character.concentration.active = !character.concentration.active; renderContent(); });
  const concRemove = document.getElementById("concentration-remove");
  if (concRemove) concRemove.addEventListener("click", () => { character.concentration.visible = false; renderContent(); });

  document.querySelectorAll("[data-res-minus]").forEach(button => {
    button.addEventListener("click", () => { character.resources.find(x => x.id == button.dataset.resMinus).current--; renderContent(); });
  });
  document.querySelectorAll("[data-res-plus]").forEach(button => {
    button.addEventListener("click", () => { character.resources.find(x => x.id == button.dataset.resPlus).current++; renderContent(); });
  });
  document.querySelectorAll("[data-resource-view]").forEach(el => el.addEventListener("click", () => openResourceDetailModal(el.dataset.resourceView)));
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

  document.querySelectorAll("[data-spend-hitdie]").forEach(button => {
    button.addEventListener("click", () => spendHitDie(parseInt(button.dataset.spendHitdie)));
  });

  document.querySelectorAll("[data-roll-tohit]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const weapon = character.inventory.find(i => i.id == button.dataset.rollTohit);
      const atk = calculateAttack(character, weapon);
      showRollToast(weapon.name + " \u2013 To Hit", "1d20" + formatModifier(atk.toHitTotal));
    });
  });
  document.querySelectorAll("[data-roll-damage]").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const weapon = character.inventory.find(i => i.id == button.dataset.rollDamage);
      const atk = calculateAttack(character, weapon);
      showRollToast(weapon.name + " \u2013 Damage", atk.damageDice + formatModifier(atk.damageBonusTotal));
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
  `);

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
    applyHp(b.dataset.hp, result.total);
    showRollToast(b.dataset.hp === "heal" ? "Healing" : b.dataset.hp === "temp" ? "Temp HP" : "Damage", expr);
    closeModal();
    renderContent();
  }));
}

function applyHp(type, amount) {
  if (amount <= 0) return;
  const maxHP = calculateMaxHP(character);
  if (type === "heal") character.hp.current = Math.min(maxHP.total, character.hp.current + amount);
  else if (type === "temp") character.hp.temp = Math.max(character.hp.temp, amount);
  else if (type === "damage") {
    let remaining = amount;
    if (character.hp.temp > 0) {
      const absorbed = Math.min(character.hp.temp, remaining);
      character.hp.temp -= absorbed;
      remaining -= absorbed;
    }
    character.hp.current = Math.max(0, character.hp.current - remaining);
  }
}


/* ---------------- hit dice ---------------- */

// same stance as casting with no slots: warn, but don't block. a table ruling
// or homebrew feature can put a character outside the normal economy.
function spendHitDie(index) {
  const pool = character.hitDice[index];
  if (pool.current <= 0) showToast("No " + pool.die + " hit dice left");
  pool.current--;
  const notation = "1" + pool.die + formatModifier(abilityModifier(effectiveAbilityScore(character, "CON")));
  const result = rollNotation(notation);
  applyHp("heal", result.total);
  showRollToast("Hit Die – " + pool.die, notation);
  renderContent();
}


/* ---------------- effects (conditions) ---------------- */

function openAddEffectModal() {
  openModal("full", `
    <div class="modal-heading">Add Effect</div>
    <div class="field"><label>Category</label><select id="effect-category">${EFFECT_CATEGORIES_GENERAL.map(c => `<option>${c}</option>`).join("")}</select></div>
    <div id="effect-subfields"></div>
    <div class="field"><label>Duration</label>
      <select id="effect-duration-type">
        <option value="Rounds">Rounds</option><option value="Short Rest">Until Short Rest</option>
        <option value="Long Rest">Until Long Rest</option><option value="Permanent">Permanent</option>
      </select>
    </div>
    <div id="effect-duration-rounds"></div>
    <div class="field"><label>Note (optional)</label><input id="effect-note" placeholder="e.g. Bless from the cleric"></div>
    <button class="btn-primary" id="save-effect-button">Add Effect</button>
  `);

  const categorySelect = document.getElementById("effect-category");
  const subfields = document.getElementById("effect-subfields");
  const durationTypeSelect = document.getElementById("effect-duration-type");
  const roundsField = document.getElementById("effect-duration-rounds");

  function renderSubfields() { subfields.innerHTML = effectSubfieldsHtml(categorySelect.value, "effect"); }
  function renderRoundsField() {
    roundsField.innerHTML = durationTypeSelect.value === "Rounds" ? `<div class="field"><label>Number of Rounds</label><input id="effect-rounds" type="number" value="1"></div>` : "";
  }
  categorySelect.addEventListener("change", renderSubfields);
  durationTypeSelect.addEventListener("change", renderRoundsField);
  renderSubfields();
  renderRoundsField();

  document.getElementById("save-effect-button").addEventListener("click", () => {
    const category = categorySelect.value;
    const value = readEffectValueFromForm(category, "effect");
    const durationType = durationTypeSelect.value;
    const duration = { type: durationType, rounds: durationType === "Rounds" ? (parseInt(document.getElementById("effect-rounds").value) || 1) : null };
    const note = document.getElementById("effect-note").value.trim();
    const newId = Math.max(0, ...character.activeEffects.map(e => e.id)) + 1;
    character.activeEffects.push({ id: newId, category, value, duration, note });
    closeModal();
    renderContent();
  });
}

function openEffectDetailModal(effectId) {
  const effect = character.activeEffects.find(e => e.id == effectId);
  openModal("center", `
    <div class="breakdown-title">${effectSummaryLabel(effect)}</div>
    <div class="breakdown-row"><span>Category</span><span>${effect.category}</span></div>
    <div class="breakdown-row"><span>Duration</span><span>${durationLabel(effect)}</span></div>
    ${effect.note ? `<div class="breakdown-row"><span>Note</span><span>${effect.note}</span></div>` : ""}
    <button class="btn-primary" id="remove-effect-button" style="background:#5A2C29;color:#F0908A;">Remove Effect</button>
  `);
  document.getElementById("remove-effect-button").addEventListener("click", () => {
    character.activeEffects = character.activeEffects.filter(e => e.id != effectId);
    closeModal();
    renderContent();
  });
}


/* ---------------- resources ---------------- */

function openAddResourceModal() {
  openModal("sheet", `
    <div class="modal-heading">New Resource</div>
    <div class="field"><label>Name</label><input id="new-res-name" placeholder="e.g. Bardic Inspiration"></div>
    <div class="field"><label>Max Uses</label><input id="new-res-max" type="number" value="1"></div>
    ${rechargeFieldHtml("new-res", "SR")}
    <button class="btn-primary" id="save-res-button">Add Resource</button>
  `);
  wireRechargeField("new-res");
  document.getElementById("save-res-button").addEventListener("click", () => {
    const name = document.getElementById("new-res-name").value.trim() || "New Resource";
    const max = parseInt(document.getElementById("new-res-max").value) || 1;
    const tag = readRechargeValue("new-res");
    const newId = Math.max(0, ...character.resources.map(r => r.id)) + 1;
    character.resources.push({ id: newId, name, tag, current: max, max });
    closeModal();
    renderContent();
  });
}

function openResourceDetailModal(resourceId) {
  const r = character.resources.find(x => x.id == resourceId);
  openModal("sheet", `
    <div class="modal-heading">Edit Resource</div>
    <div class="field"><label>Name</label><input id="edit-res-name" value="${r.name}"></div>
    <div class="field"><label>Max Uses</label><input id="edit-res-max" type="number" value="${r.max}"></div>
    ${rechargeFieldHtml("edit-res", r.tag)}
    <div class="btn-row-2">
      <button class="btn-primary" id="save-edit-res-button">Save Changes</button>
      <button class="btn-primary" id="remove-res-button" style="background:#5A2C29;color:#F0908A;">Remove</button>
    </div>
  `);
  wireRechargeField("edit-res");
  document.getElementById("save-edit-res-button").addEventListener("click", () => {
    r.name = document.getElementById("edit-res-name").value.trim() || r.name;
    r.max = parseInt(document.getElementById("edit-res-max").value) || r.max;
    r.tag = readRechargeValue("edit-res");
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

function openAddAttackModal() {
  openModal("full", `
    <div class="modal-heading">New Attack</div>
    <div class="field"><label>Weapon Name</label><input id="new-atk-name" placeholder="e.g. Dagger"></div>
    <div class="field-row">
      <div class="field"><label>Attack Ability</label><select id="new-atk-ability"><option>STR</option><option>DEX</option></select></div>
      <div class="field"><label>Damage Dice</label><input id="new-atk-dice" placeholder="1d4"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Type</label><select id="new-atk-type"><option value="melee">Melee</option><option value="ranged">Ranged</option></select></div>
      <div class="field"><label>Range</label><input id="new-atk-range" placeholder="5 ft"></div>
    </div>
    <div class="field"><label>Properties (comma separated)</label><input id="new-atk-props" placeholder="Light, Thrown"></div>
    <div class="field"><label>Source (optional \u2014 leave blank for "Custom")</label><input id="new-atk-source" placeholder="e.g. Innate, Warlock Pact"></div>
    <button class="btn-primary" id="save-atk-button">Add Attack</button>
  `);
  document.getElementById("save-atk-button").addEventListener("click", () => {
    const name = document.getElementById("new-atk-name").value.trim() || "New Weapon";
    const ability = document.getElementById("new-atk-ability").value;
    const dice = document.getElementById("new-atk-dice").value.trim() || "1d4";
    const weaponType = document.getElementById("new-atk-type").value;
    const range = document.getElementById("new-atk-range").value.trim();
    const properties = document.getElementById("new-atk-props").value.split(",").map(s => s.trim()).filter(Boolean);
    const customSource = document.getElementById("new-atk-source").value.trim();
    const newId = Math.max(0, ...character.inventory.map(i => i.id)) + 1;
    character.inventory.push({
      id: newId, name, category: "Equipped", weight: 1, qty: 1,
      isWeapon: true, damageDice: dice, attackAbility: ability, damageAbility: ability,
      proficientWithWeapon: true, magicBonus: 0, weaponType, range, properties, customSource
    });
    closeModal();
    renderContent();
  });
}

function openAttackDetailModal(weaponId) {
  const weapon = character.inventory.find(i => i.id == weaponId);
  const atk = calculateAttack(character, weapon);

  openModal("full", `
    <div class="modal-heading">${weapon.name}</div>
    <div class="breakdown-source">${atk.source}${weapon.range ? " \u00B7 " + weapon.range : ""}</div>
    ${weapon.properties && weapon.properties.length ? `<div class="breakdown-source">${weapon.properties.join(", ")}</div>` : ""}

    <div class="breakdown-subhead">To Hit \u2014 ${formatModifier(atk.toHitTotal)}</div>
    ${atk.toHitSources.map(s => `<div class="breakdown-row"><span>${s.label}</span><span>${formatModifier(s.value)}</span></div>`).join("")}

    <div class="breakdown-subhead">Damage \u2014 ${atk.damageDice}${formatModifier(atk.damageBonusTotal)}</div>
    ${atk.damageSources.map(s => `<div class="breakdown-row"><span>${s.label}</span><span>${formatModifier(s.value)}</span></div>`).join("")}

    <div class="modal-heading" style="margin-top:20px;">Edit</div>
    <div class="field"><label>Name</label><input id="edit-atk-name" value="${weapon.name}"></div>
    <div class="field-row">
      <div class="field"><label>Attack Ability</label>
        <select id="edit-atk-ability">
          <option ${weapon.attackAbility === "STR" ? "selected" : ""}>STR</option>
          <option ${weapon.attackAbility === "DEX" ? "selected" : ""}>DEX</option>
        </select>
      </div>
      <div class="field"><label>Damage Dice</label><input id="edit-atk-dice" value="${weapon.damageDice}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Type</label>
        <select id="edit-atk-type">
          <option value="melee" ${weapon.weaponType === "melee" ? "selected" : ""}>Melee</option>
          <option value="ranged" ${weapon.weaponType === "ranged" ? "selected" : ""}>Ranged</option>
        </select>
      </div>
      <div class="field"><label>Range</label><input id="edit-atk-range" value="${weapon.range || ""}"></div>
    </div>
    <div class="field"><label>Properties (comma separated)</label><input id="edit-atk-props" value="${(weapon.properties || []).join(", ")}"></div>
    <div class="field"><label>Source (optional \u2014 leave blank for "Custom")</label><input id="edit-atk-source" value="${weapon.customSource || ""}"></div>
    <div class="field-row">
      <div class="field"><label>Magic Bonus</label><input id="edit-atk-magic" type="number" value="${weapon.magicBonus}"></div>
      <div class="field"><label>Proficient?</label>
        <select id="edit-atk-prof"><option value="yes" ${weapon.proficientWithWeapon ? "selected" : ""}>Yes</option><option value="no" ${!weapon.proficientWithWeapon ? "selected" : ""}>No</option></select>
      </div>
    </div>
    <div class="btn-row-2">
      <button class="btn-primary" id="save-edit-atk-button">Save Changes</button>
      <button class="btn-primary" id="remove-atk-button" style="background:#5A2C29;color:#F0908A;">Remove</button>
    </div>
  `);

  document.getElementById("save-edit-atk-button").addEventListener("click", () => {
    weapon.name = document.getElementById("edit-atk-name").value.trim() || weapon.name;
    weapon.attackAbility = document.getElementById("edit-atk-ability").value;
    weapon.damageAbility = weapon.attackAbility;
    weapon.damageDice = document.getElementById("edit-atk-dice").value.trim() || weapon.damageDice;
    weapon.weaponType = document.getElementById("edit-atk-type").value;
    weapon.range = document.getElementById("edit-atk-range").value.trim();
    weapon.properties = document.getElementById("edit-atk-props").value.split(",").map(s => s.trim()).filter(Boolean);
    weapon.customSource = document.getElementById("edit-atk-source").value.trim();
    weapon.magicBonus = parseInt(document.getElementById("edit-atk-magic").value) || 0;
    weapon.proficientWithWeapon = document.getElementById("edit-atk-prof").value === "yes";
    closeModal();
    renderContent();
  });
  document.getElementById("remove-atk-button").addEventListener("click", () => {
    character.inventory = character.inventory.filter(i => i.id != weaponId);
    closeModal();
    renderContent();
  });
}


/* ============================================================
   CHARACTER TAB
   ============================================================ */

let openSections = { abilityScores: true, savingThrows: true, skills: true, features: true };
let openFeatureCategories = {};

function renderCollapseSection(title, key, bodyHtml) {
  return `
    <div class="section-head-row" data-section-toggle="${key}" style="cursor:pointer;">
      <div class="section-head">${title}</div>
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
        <div class="collapse-head" data-trait-category="${category}">
          <span>${category}</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <button class="mini-edit" data-edit-subsection="${category}">\u270E</button>
            <span>${openFeatureCategories[category] ? "\u2212" : "+"}</span>
          </div>
        </div>
        <div class="collapse-body ${openFeatureCategories[category] ? "open" : ""}">
          ${character.traits[category].map((t, index) => `
            <div class="trait-item" data-feature-view="${category}|||${index}">
              <div class="trait-name">${t.name}</div>
              ${t.desc ? `<div class="trait-desc">${t.desc}</div>` : ""}
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

  document.querySelectorAll("[data-ability]").forEach(box => {
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-edit-ability]")) return;
      const a = box.dataset.ability;
      showRollToast(ABILITY_FULL_NAMES[a] + " Check", "1d20" + formatModifier(abilityModifier(effectiveAbilityScore(character, a))));
    });
  });
  document.querySelectorAll("[data-edit-ability]").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); openEditAbilityModal(btn.dataset.editAbility); }));

  document.querySelectorAll("[data-save]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-edit-save]")) return;
      const a = row.dataset.save;
      const save = calculateSavingThrow(character, a);
      showRollToast(ABILITY_FULL_NAMES[a] + " Save", "1d20" + formatModifier(save.total));
    });
  });
  document.querySelectorAll("[data-edit-save]").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); openEditSavingThrowModal(btn.dataset.editSave); }));

  document.querySelectorAll("[data-skill]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-edit-skill]")) return;
      const skill = calculateSkill(character, row.dataset.skill);
      showRollToast(row.dataset.skill, "1d20" + formatModifier(skill.total));
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

function openEditAbilityModal(ability) {
  openModal("center", `
    <div class="breakdown-title">${ABILITY_FULL_NAMES[ability]}</div>
    <div class="field"><label>Score</label><input id="edit-ability-score" type="number" value="${character.abilities[ability]}"></div>
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

  openModal("center", `
    <div class="breakdown-title">${ABILITY_FULL_NAMES[ability]} Save</div>
    <div class="field"><label>Proficient?</label>
      <select id="edit-save-prof"><option value="yes" ${character.savingThrowProficiency[ability] ? "selected" : ""}>Yes</option><option value="no" ${!character.savingThrowProficiency[ability] ? "selected" : ""}>No</option></select>
    </div>
    <div class="toggle-line"><span>Override bonus</span><div class="switch ${isOverridden ? "on" : ""}" id="save-override-switch"><div class="knob"></div></div></div>
    <div id="save-override-wrap">${isOverridden ? `<div class="field"><label>Bonus</label><input id="edit-save-override-value" type="number" value="${overrideVal}"></div>` : ""}</div>
    <button class="btn-primary" id="save-save-button">Save</button>
  `);

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

  openModal("center", `
    <div class="breakdown-title">${skillName}</div>
    <div class="field"><label>Proficiency</label>
      <select id="edit-skill-prof">
        <option value="0" ${current === 0 ? "selected" : ""}>None</option>
        <option value="1" ${current === 1 ? "selected" : ""}>Proficient</option>
        <option value="2" ${current === 2 ? "selected" : ""}>Expertise</option>
      </select>
    </div>
    <div class="toggle-line"><span>Override bonus</span><div class="switch ${isOverridden ? "on" : ""}" id="skill-override-switch"><div class="knob"></div></div></div>
    <div id="skill-override-wrap">${isOverridden ? `<div class="field"><label>Bonus</label><input id="edit-skill-override-value" type="number" value="${overrideVal}"></div>` : ""}</div>
    <button class="btn-primary" id="save-skill-button">Save</button>
  `);

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
    <div class="field"><label>Name</label><input id="edit-subsection-name" value="${category}"></div>
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
      ? `This section contains ${count} feature${count === 1 ? "" : "s"} that will also be deleted. Remove "${category}"?`
      : `Remove empty section "${category}"?`;
    if (!confirm(warning)) return;
    delete character.traits[category];
    delete openFeatureCategories[category];
    closeModal();
    renderContent();
  });
}

function renderFeatureEffectsList(container, formEffects) {
  container.innerHTML = formEffects.map((eff, idx) => `
    <div class="feature-effect-row">
      <div class="field-row">
        <div class="field"><label>Effect Category</label>
          <select data-eff-category="${idx}">${EFFECT_CATEGORIES_FEATURE.map(c => `<option ${c === eff.category ? "selected" : ""}>${c}</option>`).join("")}</select>
        </div>
        <button class="chip-remove" data-remove-effect="${idx}">\u2715</button>
      </div>
      <div data-subfields-index="${idx}"></div>
    </div>
  `).join("");

  formEffects.forEach((eff, idx) => {
    const subEl = container.querySelector(`[data-subfields-index="${idx}"]`);
    subEl.innerHTML = effectSubfieldsHtml(eff.category, "feature-effect-" + idx);
    prefillEffectSubfields(eff, "feature-effect-" + idx);
  });

  container.querySelectorAll("[data-eff-category]").forEach(sel => {
    sel.addEventListener("change", () => {
      const idx = parseInt(sel.dataset.effCategory);
      formEffects[idx].category = sel.value;
      formEffects[idx].value = {};
      renderFeatureEffectsList(container, formEffects);
    });
  });
  container.querySelectorAll("[data-remove-effect]").forEach(btn => {
    btn.addEventListener("click", () => {
      formEffects.splice(parseInt(btn.dataset.removeEffect), 1);
      renderFeatureEffectsList(container, formEffects);
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
      <div class="field"><label>Section</label><select id="new-feature-category">${categories.map(c => `<option>${c}</option>`).join("")}</select></div>
      <div class="field"><label>Name</label><input id="new-feature-name" placeholder="e.g. Great Weapon Master"></div>
      <div class="field"><label>Description</label><input id="new-feature-desc" placeholder="Optional"></div>
      <div class="field"><label>Effects</label></div>
      <div id="feature-effects-list"></div>
      <button class="add-link" id="add-feature-effect-button">+ Add Effect</button>
      <button class="btn-primary" id="save-feature-button" style="margin-top:14px;">Add Feature</button>
    `;
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
    <div class="field"><label>Name</label><input id="edit-feature-name" value="${trait.name}"></div>
    <div class="field"><label>Description</label><input id="edit-feature-desc" value="${trait.desc || ""}"></div>
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
        <div class="atk-name">${spell.name}</div>
        ${showClassTag ? `<div class="atk-range">${spell.classSource}</div>` : ""}
      </div>
      <div class="spell-tag">${spell.castingTime}</div>
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
      ${classes.length > 1 ? `<div style="text-align:center;font-weight:bold;font-size:13px;color:#F5C37A;margin-top:14px;">${cls.name}</div>` : ""}
      <div class="stat-grid" style="${classes.length > 1 ? "margin-top:6px;" : ""}">
        <div class="stat-box"><div class="stat-label">Ability</div><div class="stat-value">${cls.ability}</div></div>
        <div class="stat-box" data-spell-atk="${cls.name}"><div class="stat-label">Spell Attack</div><div class="stat-value">${formatModifier(atk.total)}</div></div>
        <div class="stat-box" data-spell-dc="${cls.name}"><div class="stat-label">Spell DC</div><div class="stat-value">${dc.total}</div></div>
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
        <div class="section-head" style="font-size:14px;margin:0;">${levelLabel(lvl)}</div>
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
    showRollToast(spell.name, "1d20" + formatModifier(atk.total));
  }
  renderContent();
}

function wireSpellsTab() {
  character.spellcasting.classes.forEach(cls => {
    const atkBox = document.querySelector(`[data-spell-atk="${cls.name}"]`);
    if (atkBox) atkBox.addEventListener("click", () => {
      const atk = calculateSpellAttack(character, cls.ability);
      openBreakdownModal(cls.name + " Spell Attack", formatModifier(atk.total), "", atk.sources,
        { label: cls.name + " Spell Attack", notation: "1d20" + formatModifier(atk.total) });
    });
    const dcBox = document.querySelector(`[data-spell-dc="${cls.name}"]`);
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
        showRollToast(spell.name, "1d20" + formatModifier(atk.total));
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
    <div class="field"><label>Name</label><input id="spell-form-name" value="${spell ? spell.name : ""}" placeholder="e.g. Fireball"></div>
    <div class="field-row">
      <div class="field"><label>Level</label>
        <select id="spell-form-level">
          <option value="0" ${spell && spell.level === 0 ? "selected" : ""}>Cantrip</option>
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => `<option value="${l}" ${spell && spell.level === l ? "selected" : ""}>${levelLabel(l)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>Class</label><select id="spell-form-class">${classOptions.map(c => `<option ${spell && c === spell.classSource ? "selected" : ""}>${c}</option>`).join("")}</select></div>
    </div>
    <div class="field"><label>Casting Time</label>
      <select id="spell-form-time">
        <option value="A" ${spell && spell.castingTime === "A" ? "selected" : ""}>Action</option>
        <option value="B" ${spell && spell.castingTime === "B" ? "selected" : ""}>Bonus Action</option>
        <option value="R" ${spell && spell.castingTime === "R" ? "selected" : ""}>Reaction</option>
      </select>
    </div>
    <div class="toggle-line"><span>Requires spell attack roll</span><div class="switch ${spell && spell.attackRoll ? "on" : ""}" id="spell-form-attack-switch"><div class="knob"></div></div></div>
    <div class="field"><label>Description</label><input id="spell-form-desc" value="${spell ? (spell.desc || "") : ""}" placeholder="Optional"></div>
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
    if (rule && rule.appliesEffects) {
      if (item.acBonus) bonuses.push(formatModifier(item.acBonus) + " AC (" + item.name + ")");
      if (item.attackBonus) bonuses.push(formatModifier(item.attackBonus) + " Attack Rolls (" + item.name + ")");
    }
  });
  const weight = calculateCarriedWeight(character);
  const categories = Object.keys(character.categoryRules);

  return `
    ${bonuses.length ? `<div class="bonus-banner">Active bonuses: ${bonuses.join(" \u00B7 ")}</div>` : ""}
    <div class="weight-line" style="display:flex;align-items:center;justify-content:space-between;">
      <span>Carried weight: <strong>${weight.total} lb</strong></span>
      <button class="add-link" id="add-inventory-button">+ Add</button>
    </div>

    <div id="inventory-sections">
      ${categories.map(cat => {
        const isOpen = openInvCategories[cat] !== false;
        const items = character.inventory.filter(i => i.category === cat);
        return `
          <div class="section-head-row" data-cat-card="${cat}" data-inv-cat-toggle="${cat}" style="cursor:pointer;touch-action:none;">
            <div class="section-head">${cat}</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <button class="mini-edit" data-edit-category="${cat}">\u270E</button>
              <span style="color:#9C9186;font-size:12px;">${isOpen ? "\u2212" : "+"}</span>
            </div>
          </div>
          <div data-cat-body="${cat}" style="${isOpen ? "" : "display:none;"}">
            ${items.map(item => `
              <div class="item-row" data-item-view="${item.id}" data-item-id="${item.id}" style="touch-action:none;">
                <div style="flex:1;">
                  <div class="item-name">${item.name}${item.qty > 1 ? " \u00D7" + item.qty : ""}</div>
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

function openAddInventoryModal(presetCategory) {
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

  function renderItemBody() {
    const defaultCat = presetCategory && categories.includes(presetCategory) ? presetCategory : categories[0];
    body.innerHTML = `
      <div class="field"><label>Name</label><input id="new-item-name" placeholder="e.g. Potion of Healing"></div>
      <div class="field-row">
        <div class="field"><label>Weight (lb)</label><input id="new-item-weight" type="number" value="1"></div>
        <div class="field"><label>Quantity</label><input id="new-item-qty" type="number" value="1"></div>
      </div>
      <div class="field"><label>Category</label><select id="new-item-cat">${categories.map(c => `<option ${c === defaultCat ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div class="field-row">
        <div class="field"><label>AC Bonus (optional)</label><input id="new-item-ac" type="number" value="0"></div>
        <div class="field"><label>Attack Bonus (optional)</label><input id="new-item-atkb" type="number" value="0"></div>
      </div>
      <button class="btn-primary" id="save-item-button">Add Item</button>
    `;
    document.getElementById("save-item-button").addEventListener("click", () => {
      const name = document.getElementById("new-item-name").value.trim() || "New Item";
      const weight = parseFloat(document.getElementById("new-item-weight").value) || 0;
      const qty = parseInt(document.getElementById("new-item-qty").value) || 1;
      const category = document.getElementById("new-item-cat").value;
      const acBonus = parseInt(document.getElementById("new-item-ac").value) || 0;
      const attackBonus = parseInt(document.getElementById("new-item-atkb").value) || 0;
      const newId = Math.max(0, ...character.inventory.map(i => i.id)) + 1;
      const item = { id: newId, name, category, weight, qty };
      if (acBonus) item.acBonus = acBonus;
      if (attackBonus) item.attackBonus = attackBonus;
      character.inventory.push(item);
      openInvCategories[category] = true;
      closeModal();
      renderContent();
    });
  }

  function renderCategoryBody() {
    body.innerHTML = `
      <div class="field"><label>Name</label><input id="new-cat-name" placeholder="e.g. Familiar's Pouch"></div>
      <div class="toggle-line"><span>Counts toward carry weight</span><div class="switch" id="sw-weight"><div class="knob"></div></div></div>
      <div class="toggle-line"><span>Applies item effects (like Worn/Equipped)</span><div class="switch" id="sw-effects"><div class="knob"></div></div></div>
      <button class="btn-primary" id="save-cat-button">Create Category</button>
    `;
    let weightOn = false, effectsOn = false;
    document.getElementById("sw-weight").addEventListener("click", (e) => { weightOn = !weightOn; e.currentTarget.classList.toggle("on", weightOn); });
    document.getElementById("sw-effects").addEventListener("click", (e) => { effectsOn = !effectsOn; e.currentTarget.classList.toggle("on", effectsOn); });
    document.getElementById("save-cat-button").addEventListener("click", () => {
      const name = document.getElementById("new-cat-name").value.trim();
      if (!name || character.categoryRules[name]) { closeModal(); return; }
      character.categoryRules[name] = { countsWeight: weightOn, appliesEffects: effectsOn };
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
  let weightOn = rule.countsWeight, effectsOn = rule.appliesEffects;

  openModal("sheet", `
    <div class="modal-heading">Edit Category</div>
    <div class="field"><label>Name</label><input id="edit-cat-name" value="${category}"></div>
    <div class="toggle-line"><span>Counts toward carry weight</span><div class="switch ${weightOn ? "on" : ""}" id="sw-edit-weight"><div class="knob"></div></div></div>
    <div class="toggle-line"><span>Applies item effects (like Worn/Equipped)</span><div class="switch ${effectsOn ? "on" : ""}" id="sw-edit-effects"><div class="knob"></div></div></div>
    <div class="btn-row-2">
      <button class="btn-primary" id="save-cat-edit-button">Save Changes</button>
      <button class="btn-primary" id="remove-cat-button" style="background:#5A2C29;color:#F0908A;">Remove</button>
    </div>
  `);
  document.getElementById("sw-edit-weight").addEventListener("click", (e) => { weightOn = !weightOn; e.currentTarget.classList.toggle("on", weightOn); });
  document.getElementById("sw-edit-effects").addEventListener("click", (e) => { effectsOn = !effectsOn; e.currentTarget.classList.toggle("on", effectsOn); });

  document.getElementById("save-cat-edit-button").addEventListener("click", () => {
    const newName = document.getElementById("edit-cat-name").value.trim();
    if (!newName || (newName !== category && character.categoryRules[newName])) { closeModal(); return; }
    const newRule = { countsWeight: weightOn, appliesEffects: effectsOn };
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
      ? `This category contains ${count} item${count === 1 ? "" : "s"} that will also be deleted. Remove "${category}"?`
      : `Remove empty category "${category}"?`;
    if (!confirm(warning)) return;
    delete character.categoryRules[category];
    character.inventory = character.inventory.filter(i => i.category !== category);
    delete openInvCategories[category];
    closeModal();
    renderContent();
  });
}

function openItemDetailModal(itemId) {
  const item = character.inventory.find(i => i.id == itemId);
  const categories = Object.keys(character.categoryRules);
  openModal("full", `
    <div class="modal-heading-row">
      <div class="modal-heading">Edit Item</div>
      <button class="icon-btn-delete" id="delete-item-trigger" title="Remove item">\uD83D\uDDD1</button>
    </div>
    <div class="field"><label>Name</label><input id="edit-item-name" value="${item.name}"></div>
    <div class="field-row">
      <div class="field"><label>Weight (lb)</label><input id="edit-item-weight" type="number" value="${item.weight}"></div>
      <div class="field"><label>Quantity</label><input id="edit-item-qty" type="number" value="${item.qty || 1}"></div>
    </div>
    <div class="field"><label>Category</label><select id="edit-item-cat">${categories.map(c => `<option ${c === item.category ? "selected" : ""}>${c}</option>`).join("")}</select></div>
    <div class="field-row">
      <div class="field"><label>AC Bonus</label><input id="edit-item-ac" type="number" value="${item.acBonus || 0}"></div>
      <div class="field"><label>Attack Bonus</label><input id="edit-item-atkb" type="number" value="${item.attackBonus || 0}"></div>
    </div>
    ${item.isWeapon ? `<div class="empty-hint">This is also a weapon \u2014 edit its attack stats from the Combat tab.</div>` : ""}
    <div class="btn-row-2">
      <button class="btn-primary" id="save-item-edit-button">Save Changes</button>
      <button class="btn-primary" id="give-item-button" style="background:#242019;color:#F5C37A;">Give</button>
    </div>
  `);
  document.getElementById("save-item-edit-button").addEventListener("click", () => {
    item.name = document.getElementById("edit-item-name").value.trim() || item.name;
    item.weight = parseFloat(document.getElementById("edit-item-weight").value) || 0;
    item.qty = parseInt(document.getElementById("edit-item-qty").value) || 1;
    item.category = document.getElementById("edit-item-cat").value;
    const ac = parseInt(document.getElementById("edit-item-ac").value) || 0;
    const atkb = parseInt(document.getElementById("edit-item-atkb").value) || 0;
    if (ac) item.acBonus = ac; else delete item.acBonus;
    if (atkb) item.attackBonus = atkb; else delete item.attackBonus;
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
    <div class="modal-heading">Remove ${item.name}?</div>
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
              <div class="recipient-name">${m.name}</div>
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
      <div class="section-head">${sec.name}${sec.receiveFrom ? `<span class="receive-dot" title="Receiving shared notes here"></span>` : ""}</div>
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
      : `<span class="share-tag share-tag-in">\u2193 ${n.sharing.sharedByName}</span>`;
  }
  return `
    <div class="item-row note-row" data-note-view="${n.id}" data-note-id="${n.id}" style="touch-action:none;">
      <div style="flex:1;">
        <div class="item-name">${n.title || "Untitled"}${tag}</div>
        ${preview ? `<div class="item-meta">${preview}</div>` : ""}
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
    <div class="field"><label>Name</label><input id="edit-sec-name" value="${section.name}"></div>
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
      ? `This section contains ${count} note${count === 1 ? "" : "s"} that will also be deleted. Remove "${section.name}"?`
      : `Remove empty section "${section.name}"?`;
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
      const names = note.sharing.sharedWith.map(m => `${m.name} (${m.permission})`).join(", ");
      shareLine = `<div class="share-info">\u2191 Sharing with ${names}${note.sharing.continuous ? "" : " \u00B7 snapshot"}</div>`;
    } else {
      shareLine = `<div class="share-info">\u2193 Shared by ${note.sharing.sharedByName}${note.sharing.permission === "view" ? " \u00B7 view only" : ""}</div>`;
    }
  }

  openModal("full", `
    <div class="modal-heading" style="display:flex;justify-content:space-between;align-items:center;">
      <span>${section.name}</span>
      <button class="add-link" id="note-menu-button" style="font-size:20px;line-height:1;">\u22EF</button>
    </div>
    <input id="note-title-input" class="note-title-field" placeholder="Title" value="${(note.title || "").replace(/"/g, "&quot;")}" ${isReadOnly ? "readonly" : ""}>
    <div class="item-meta" style="margin-bottom:10px;">${new Date(note.updatedAt).toLocaleString()}</div>
    ${shareLine}
    <textarea id="note-body-input" class="note-body-field" placeholder="Note" ${isReadOnly ? "readonly" : ""}>${note.body || ""}</textarea>
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
            <span>${m}</span>
            <button class="toggle-btn" data-perm="${perm}" data-member-btn="${m}">${label}</button>
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

showScreen("selector");