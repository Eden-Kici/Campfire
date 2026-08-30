/* The creator's equipment step.

   Lifted out of creator.js when that file hit the 1,500-line cap. It's a clean
   seam: nothing else in the creator reads the kit, and the step owes the rest
   of the app exactly one thing -- buildStartingInventory() turning the player's
   answers into real inventory rows. */

/* One item, resolved.

   KIT_ITEMS used to carry its own name, weight, damage, armour and a
   hand-written description for every entry -- a second copy of the equipment
   catalogue, which is the two-sources-of-truth hazard CLAUDE.md already warns
   about, and it meant the creator showed a player less about a Priest's Pack
   than the content browser did.

   A kit entry now names the catalogue row it means (`srd`) and carries only
   what is kit-specific: which category it lands in, how many, and whether it
   arrives tracked. Everything descriptive comes from the catalogue. The seven
   background trinkets with no catalogue row -- an insignia of rank, a letter
   from a dead colleague -- keep their own fields and render identically. */
function srdCatalogueEntry(name) {
  const all = [].concat(
    typeof SRD_WEAPONS !== "undefined" ? SRD_WEAPONS : [],
    typeof SRD_ARMOUR !== "undefined" ? SRD_ARMOUR : [],
    typeof SRD_GEAR !== "undefined" ? SRD_GEAR : [],
    typeof SRD_TOOLS !== "undefined" ? SRD_TOOLS : []);
  return all.find(entry => entry.name === name) || null;
}

function kitItemTemplate(key) {
  const kit = KIT_ITEMS[key];
  if (!kit) return null;
  const srd = kit.srd ? srdCatalogueEntry(kit.srd) : null;
  if (!srd) return Object.assign({}, kit);
  // the catalogue owns what the thing IS; the kit owns where it lands and how
  // many of it you get
  const merged = Object.assign({}, srd, kit);
  // the kit's name wins. The catalogue is singular -- it sells one arrow --
  // and a stack of twenty on a sheet reads better as "Arrows"
  merged.name = kit.name || srd.name;
  // and the catalogue's description wins where it has one -- the kit's own text
  // is the fallback for the many catalogue rows that carry none
  if (srd.description) merged.description = srd.description;
  delete merged.srd;
  return merged;
}

/* Every item the kit hands over without asking: the class's fixed gear plus
   whatever the background carries. Returned as keys so the caller can decide
   whether it wants names, rows or items. */
function grantedKitKeys() {
  const kit = STARTING_KIT[creatorState.charClass] || {};
  const bg = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
  return (kit.gear || []).concat((bg && bg.equipment) || []);
}

/* Coin comes from the background rather than the class -- no SRD class package
   includes money. Kept as a function because a custom background could add one
   and the step shouldn't have to know where it came from. */
function startingMoney() {
  const kit = STARTING_KIT[creatorState.charClass] || {};
  const bg = SRD_BACKGROUNDS.find(b => b.name === creatorState.background);
  return addCoins(addCoins(emptyPurse(), kit.money), bg && bg.money);
}

function startingMoneyLabel() {
  const purse = startingMoney();
  const parts = COIN_TYPES.filter(coin => coinCount(purse, coin.key))
    .map(coin => coinCount(purse, coin.key) + " " + coin.label.toLowerCase());
  return parts.join(", ");
}

/* Rows, not chips.

   These were `.chip`s, which in this app means "a removable token" -- and
   nothing here is removable. They also wrapped into ragged lines and gave the
   player nowhere to find out what a Priest's Pack actually contains. A row per
   item, tappable, says both things: this is what you get, and here's what it
   is. */
function kitItemRowsHtml(keys, source) {
  return keys.map((key, index) => {
    const item = kitItemTemplate(key);
    if (!item) return "";
    return `
      <button type="button" class="kit-row" data-kit-info="${source}:${index}">
        <span class="kit-row-name">${esc(item.name)}${item.qty > 1 ? ` ×${item.qty}` : ""}</span>
        <span class="kit-row-more">?</span>
      </button>`;
  }).join("");
}

function equipmentStepHtml(stepNum) {
  const kit = STARTING_KIT[creatorState.charClass];
  const granted = grantedKitKeys();
  const money = startingMoneyLabel();

  return `
    ${creatorHeaderHtml("Equipment", creatorStepLabel(stepNum, "Starting Gear"))}

    ${kit.choices.map((choice, choiceIndex) => `
      <div class="breakdown-subhead">${esc(choice.prompt)}</div>
      ${choice.options.map((option, optionIndex) => {
        // two data attributes, so this is the one option row optionButtonHtml
        // can't build -- same class and same markup shape all the same
        const active = creatorState.equipment[choiceIndex] === optionIndex;
        return `
        <button type="button" class="creator-option ${active ? "active" : ""}"
          data-kit-choice="${choiceIndex}" data-kit-option="${optionIndex}">
          <span class="creator-option-label">${esc(option.label)}</span>
          <span class="creator-option-mark">${active ? "✓" : ""}</span>
        </button>
        ${active ? kitItemRowsHtml(option.items, "choice" + choiceIndex) : ""}`;
      }).join("")}
    `).join("")}

    ${granted.length ? `
      <div class="breakdown-subhead">Also carried</div>
      ${kitItemRowsHtml(granted, "granted")}
    ` : ""}

    ${money ? `
      <div class="breakdown-subhead">Coins</div>
      <div class="kit-money">${esc(money)}</div>
    ` : ""}

    ${creatorNavHtml()}`;
}

/* Its own overlay rather than openModal, because the creator is a modal and
   openModal begins by closing whatever is open -- the same reason confirmModal
   and infoModal have their own layer. */
function openKitItemModal(item) {
  const existing = document.getElementById("confirm-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "confirm-overlay";
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-title">${esc(item.name)}${item.qty > 1 ? " \u00D7" + item.qty : ""}</div>
      ${itemFactsHtml(item)}
      <button class="btn-secondary" id="info-close" style="margin-top:16px;">Close</button>
    </div>`;
  document.querySelector(".phone").appendChild(overlay);

  const close = () => { const el = document.getElementById("confirm-overlay"); if (el) el.remove(); };
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.getElementById("info-close").addEventListener("click", close);
}

function wireEquipmentStep() {
  document.querySelectorAll("[data-kit-choice]").forEach(button => {
    button.addEventListener("click", () => {
      creatorState.equipment[parseInt(button.dataset.kitChoice)] = parseInt(button.dataset.kitOption);
      redrawCreator();
    });
  });

  /* Tapping an item explains it. infoModal sits on its own layer, so this works
     from inside the creator without closing it -- the same reason the weapon
     property picker uses it. */
  document.querySelectorAll("[data-kit-info]").forEach(row => {
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      const [source, indexStr] = row.dataset.kitInfo.split(":");
      const kit = STARTING_KIT[creatorState.charClass];
      let keys;
      if (source === "granted") keys = grantedKitKeys();
      else {
        const choiceIndex = parseInt(source.replace("choice", ""));
        keys = kit.choices[choiceIndex].options[creatorState.equipment[choiceIndex]].items;
      }
      const item = kitItemTemplate(keys[parseInt(indexStr)]);
      // the same detail body the content browser shows -- weight, cost, damage,
      // properties, AC -- rather than a sentence written for this screen alone
      if (item) openKitItemModal(item);
    });
  });

  document.getElementById("creator-back-button").addEventListener("click", goBack);
  document.getElementById("creator-next-button").addEventListener("click", () => {
    const kit = STARTING_KIT[creatorState.charClass];
    const undecided = kit.choices.findIndex((choice, index) => creatorState.equipment[index] === undefined);
    if (undecided !== -1) { showToast("Choose your " + kit.choices[undecided].prompt.toLowerCase()); return; }
    goNext();
  });
}

/* Turns the chosen keys into inventory entries. Stacks of the same thing merge
   rather than appearing twice, so picking two daggers gives you one entry with
   a quantity of two. */
function buildStartingInventory() {
  const kit = STARTING_KIT[creatorState.charClass];
  if (!kit) return [];

  const keys = grantedKitKeys();
  kit.choices.forEach((choice, index) => {
    const chosen = choice.options[creatorState.equipment[index]];
    if (chosen) keys.push(...chosen.items);
  });

  const inventory = [];
  let nextId = 1;
  keys.forEach(key => {
    const template = kitItemTemplate(key);
    if (!template) return;

    // a second dagger is a quantity, not a second row -- but only for things
    // that stack; two weapons you wield separately stay separate
    const stackable = !template.isWeapon && !template.armour;
    const existing = stackable && inventory.find(entry => entry.name === template.name);
    if (existing) { existing.qty += (template.qty || 1); return; }

    inventory.push(Object.assign({ id: nextId++, qty: 1 }, JSON.parse(JSON.stringify(template))));
  });

  return inventory;
}
