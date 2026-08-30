/* ============================================================
   INVENTORY TAB
   ============================================================ */

let openInvCategories = {};
let suppressInvClickUntil = 0;

/* Coin gets its own row at the top rather than living as an inventory item.
   It's the number a player checks most often in a shop and it doesn't behave
   like an item -- no category, no quantity-of-one, and the denominations
   convert into each other.

   The stash only renders when the setting is on, so a table that doesn't
   track it never sees a second row it has to ignore. */
function coinCellsHtml(purse, target) {
  return COIN_TYPES.map(coin => `
    <button class="coin-cell" data-coin-edit="${target}:${coin.key}" title="${esc(coin.name)}">
      <span class="coin-amount">${coinCount(purse, coin.key)}</span>
      <span class="coin-label">${coin.label}</span>
    </button>`).join("");
}

function moneyRowHtml() {
  const stashOn = typeof settings !== "undefined" && settings.trackStashedMoney;
  return `
    <div class="money-block">
      <div class="money-head">
        <span class="money-head-label">${stashOn ? "Carried" : "Money"}</span>
        <span class="money-total">${formatGold(moneyInGold(character.purse))} gp</span>
      </div>
      <div class="coin-row">${coinCellsHtml(character.purse, "purse")}</div>
      ${stashOn ? `
        <div class="money-head" style="margin-top:10px;">
          <span class="money-head-label">Stashed</span>
          <span class="money-total">${formatGold(moneyInGold(character.stash))} gp</span>
        </div>
        <div class="coin-row">${coinCellsHtml(character.stash, "stash")}</div>` : ""}
      ${(typeof party !== "undefined" && party.status !== "none" && partyMemberList(party.members, deviceId()).length)
        ? `<button class="add-link" id="send-money-button" style="margin-top:10px;">Send Money</button>` : ""}
    </div>`;
}

// two decimals only when they say something -- "42 gp", not "42.00 gp"
function formatGold(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function roundWeight(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function openCoinEditModal(target, key) {
  const coin = COIN_TYPES.find(c => c.key === key);
  const purse = target === "stash" ? character.stash : character.purse;
  const where = target === "stash" ? "Stashed" : "Carried";

  openModal("center", `
    <div class="modal-heading">${esc(where)} ${esc(coin.name)}</div>
    ${numberFieldHtml("coin-amount-input", coin.name + " pieces", coinCount(purse, key))}
    <button class="btn-primary" id="coin-save">Save</button>
  `);
  guardModalEdits();
  document.getElementById("coin-save").addEventListener("click", () => {
    const value = parseInt(document.getElementById("coin-amount-input").value);
    if (target === "stash") {
      if (!character.stash) character.stash = emptyPurse();
      character.stash[key] = isNaN(value) ? 0 : value;
    } else {
      if (!character.purse) character.purse = emptyPurse();
      character.purse[key] = isNaN(value) ? 0 : value;
    }
    modalDismissGuard = null;
    closeModal();
    renderContent();
  });
}

/* The gear-bonus chips are gone.

   "+1 Attack Ring of Precision" was inert text wearing a control's shape --
   nothing happened when you tapped it -- and the Ring of Precision row a
   hundred pixels below already said "+1 Attack". The CSS comment records that
   an orange callout was removed once before for duplicating the item rows; the
   duplication survived, it just got quieter. The item row is the one place
   this belongs, and the stat it feeds explains itself in its own breakdown. */
function renderInventoryTab() {
  const weight = calculateCarriedWeight(character);
  const categories = Object.keys(character.categoryRules);

  const capacity = calculateCarryingCapacity(character);
  const over = weight.total > capacity.total;

  return `
    ${moneyRowHtml()}
    <div class="weight-line" style="display:flex;align-items:center;justify-content:space-between;">
      <button class="weight-total ${over ? "over" : ""}" id="weight-breakdown">Carried weight: <strong>${roundWeight(weight.total)} / ${capacity.total} lb</strong></button>
      <button class="add-link" id="add-inventory-button">+ Add</button>
    </div>

    <div id="inventory-sections">
      ${categories.map(cat => {
        const isOpen = openInvCategories[cat] !== false;
        const items = character.inventory.filter(i => i.category === cat);
        return `
          <div class="section-head-row" data-cat-card="${esc(cat)}" data-inv-cat-toggle="${esc(cat)}" style="cursor:pointer;touch-action:pan-y;">
            <div class="section-head">${esc(cat)}</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <button class="mini-edit" data-edit-category="${esc(cat)}">\u270E</button>
            </div>
          </div>
          <div data-cat-body="${esc(cat)}" style="${isOpen ? "" : "display:none;"}">
            ${items.map(item => `
              <div class="item-row" data-item-view="${item.id}" data-item-id="${item.id}" style="touch-action:pan-y;">
                <div style="flex:1;">
                  <div class="item-name">${esc(item.name)}${item.qty > 1 ? " \u00D7" + item.qty : ""}</div>
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

/* The row the finger is actually over, ignoring the one being dragged.
   elementFromPoint is no use here: the dragged row moves with the pointer and
   would answer every time. */
function itemRowUnder(e, exclude) {
  return Array.from(document.querySelectorAll(".item-row")).filter(r => r !== exclude).find(r => {
    const box = r.getBoundingClientRect();
    return e.clientY >= box.top && e.clientY <= box.bottom;
  }) || null;
}

function wireItemDragging() {
  document.querySelectorAll(".item-row").forEach(row => {
    let dragged = null;
    let mergeTarget = null;

    const clearMergeMarks = () => {
      document.querySelectorAll(".merge-ready, .merge-hover").forEach(r =>
        r.classList.remove("merge-ready", "merge-hover"));
      mergeTarget = null;
    };

    attachHoldDrag(row, {
      onStart: () => {
        row.classList.add("dragging");
        dragged = character.inventory.find(i => sameId(i.id, row.dataset.itemId));
        /* Lit up before the finger moves, so which piles this one can join is
           something you are shown rather than something you find out by
           dropping it somewhere and seeing what happened. */
        document.querySelectorAll(".item-row").forEach(other => {
          if (other === row) return;
          const item = character.inventory.find(i => sameId(i.id, other.dataset.itemId));
          if (canMergeStacks(dragged, item)) other.classList.add("merge-ready");
        });
      },
      onMove: (e) => {
        /* Over the middle of a matching row means merge, and the row is left
           where it is. The outer quarters still reorder, so dropping a stack
           between two others is unaffected. */
        const over = itemRowUnder(e, row);
        if (over && over.classList.contains("merge-ready")) {
          const box = over.getBoundingClientRect();
          const inMiddle = e.clientY > box.top + box.height * 0.25 && e.clientY < box.bottom - box.height * 0.25;
          if (inMiddle) {
            if (mergeTarget !== over) {
              if (mergeTarget) mergeTarget.classList.remove("merge-hover");
              mergeTarget = over;
              over.classList.add("merge-hover");
            }
            return;
          }
        }
        if (mergeTarget) { mergeTarget.classList.remove("merge-hover"); mergeTarget = null; }

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

        if (mergeTarget) {
          const into = character.inventory.find(i => sameId(i.id, mergeTarget.dataset.itemId));
          clearMergeMarks();
          if (into && dragged) {
            mergeStacks(into, dragged);
            character.inventory = character.inventory.filter(i => i !== dragged);
            showToast(into.qty + " " + into.name);
            renderContent();
            return;
          }
        }
        clearMergeMarks();

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
  const sendMoneyButton = document.getElementById("send-money-button");
  if (sendMoneyButton) sendMoneyButton.addEventListener("click", openSendMoneyModal);

  document.querySelectorAll("[data-coin-edit]").forEach(cell => {
    cell.addEventListener("click", () => {
      const [target, key] = cell.dataset.coinEdit.split(":");
      openCoinEditModal(target, key);
    });
  });

  // the weight total could not explain itself, though it already computed the
  // itemised list -- and there was no capacity to compare it against
  const weightButton = document.getElementById("weight-breakdown");
  if (weightButton && weightButton.addEventListener) weightButton.addEventListener("click", () => {
    const weight = calculateCarriedWeight(character);
    const capacity = calculateCarryingCapacity(character);
    const rows = weight.sources.map(src => ({ label: src.label, value: roundWeight(src.value), plain: true, suffix: " lb" }))
      .concat(capacity.sources.map(src => ({ label: "Capacity \u00B7 " + src.label, value: src.value, plain: true, suffix: " lb", heading: true })));
    openBreakdownModal("Carried Weight", roundWeight(weight.total) + " / " + capacity.total, " lb", rows);
  });

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

/* The same three rules define a category whether you're creating one or
   editing one, and they were written out twice with the labels typed by hand
   in both. One list now, two forms reading it. */
const CATEGORY_RULE_FIELDS = [
  { key: "countsWeight", suffix: "weight", label: "Counts toward carry weight" },
  { key: "appliesEffects", suffix: "effects", label: "Applies item effects (like Worn/Equipped)" },
  { key: "providesAttacks", suffix: "attacks", label: "Weapons here appear under Attacks" }
];

function categoryRuleTogglesHtml(idPrefix, rule) {
  return CATEGORY_RULE_FIELDS
    .map(field => toggleLineHtml(idPrefix + field.suffix, field.label, rule ? !!rule[field.key] : false))
    .join("\n    ");
}


/* ---------- shared item form ----------

   Weapons, armour and gear are all inventory entries, so there is one form for
   all three and a type toggle decides which extra block appears. Combat's
   "+ Add" opens this same form preset to Weapon, and the attack editor sends
   you here rather than keeping a second copy of the weapon fields. */

function itemTypeToggleHtml(current) {
  return `
    <div class="type-toggle">
      ${ITEM_TYPES.map(type => `
        <button class="toggle-btn ${current === type.value ? "active" : ""}" data-item-type="${type.value}">${type.label}</button>
      `).join("")}
    </div>`;
}

function commonItemFieldsHtml(item) {
  item = item || {};
  const categories = Object.keys(character.categoryRules);
  return `
    ${textFieldHtml("if-name", "Name", item.name, { placeholder: "e.g. Potion of Healing" })}
    ${selectFieldHtml("if-category", "Category", categories, item.category || categories[0])}
    <div class="field-row">
      ${numberFieldHtml("if-weight", "Weight (lb)", item.weight != null ? item.weight : 1)}
      ${numberFieldHtml("if-qty", "Quantity", item.qty || 1)}
    </div>
    ${textAreaFieldHtml("if-desc", "Description (optional)", item.description, { placeholder: "What it is, what it does" })}
    <div class="field-row">
      ${numberFieldHtml("if-ac", "AC Bonus", item.acBonus || 0)}
      ${numberFieldHtml("if-atkb", "Attack Bonus", item.attackBonus || 0)}
    </div>
`;
}

/* Tracking is not edited here.

   It used to be a toggle in this form and a set of facts in the item's detail
   view and a full editor under Resources -- three places describing the same
   thing. It belongs where the player is looking at the item, so the toggle
   lives in the detail modal and the fine configuration stays in the Resource
   editor on Combat. This form is for what the item *is*. */

function itemResourceFieldsHtml(resource) {
  resource = resource || {};
  const noMaximum = (resource.max || 0) === 0;
  return `
    ${numberFieldHtml("if-res-max", "Capacity", resource.max != null ? resource.max : 0,
      { placeholder: "0", hint: "Leave at 0 for an uncapped stack — it'll show a bare count." })}
    ${comboFieldHtml("if-res-refill", "Refills From (optional)", "e.g. Arrows", resource.refillFrom)}
    <div class="atk-range" style="margin:-6px 0 12px;">Name another tracked item and this becomes a container: the count is what's loaded, and a Refill button moves units across.</div>
    <div id="if-res-recharge-wrap">
      ${rechargeFieldHtml("if-res", resource.recharge || { on: "none", amount: "all" }, { noMaximum })}
    </div>`;
}

function readItemResourceFields(existing) {
  const max = document.getElementById("if-res-max");
  if (!max) return null;

  const block = {
    max: parseInt(max.value) || 0,
    recharge: readRechargeValue("if-res")
  };

  const refillFrom = document.getElementById("if-res-refill").value.trim();
  if (refillFrom) {
    block.refillFrom = refillFrom;
    // a container keeps its own load; start it full if it didn't have one
    const previous = existing && existing.resource ? existing.resource.loaded : undefined;
    block.loaded = Math.min(block.max, previous !== undefined ? previous : block.max);
  }
  return block;
}

function readCommonItemFields() {
  return {
    name: document.getElementById("if-name").value.trim() || "New Item",
    category: document.getElementById("if-category").value,
    weight: parseFloat(document.getElementById("if-weight").value) || 0,
    qty: parseInt(document.getElementById("if-qty").value) || 1,
    description: document.getElementById("if-desc").value.trim()
  };
}

function weaponFieldsHtml(weapon) {
  weapon = weapon || {};
  const profValue = weapon.proficientOverride === undefined || weapon.proficientOverride === null
    ? "derived" : (weapon.proficientOverride ? "yes" : "no");
  return `
    <div class="field-row">
      ${selectFieldHtml("wf-ability", "Attack Ability", Object.keys(ABILITY_FULL_NAMES), weapon.attackAbility || "STR")}
      ${numberFieldHtml("wf-magic", "Magic Bonus", weapon.magicBonus || 0)}
    </div>
    <div class="field-row">
      ${selectFieldHtml("wf-type", "Attack Type", [{ value: "melee", label: "Melee" }, { value: "ranged", label: "Ranged" }], weapon.weaponType || "melee")}
      ${textFieldHtml("wf-range", "Range", weapon.range, { placeholder: "5 ft" })}
    </div>
    <div class="field-row">
      ${comboFieldHtml("wf-req", "Requires Proficiency", "None", weapon.proficiencyRequired)}
      ${segmentedFieldHtml("wf-prof", "Proficient?", [
        { value: "derived", label: "Auto" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }
      ], profValue)}
    </div>
    ${fieldLabelHtml("Damage")}
    <div id="damage-rows"></div>
    <button class="add-link" id="add-damage-button">+ Add Damage Type</button>
    ${fieldLabelHtml("Properties", { style: "margin-top:16px;" })}
    <div id="property-picker"></div>
    ${comboFieldHtml("wf-ammo", "Spends Ammunition From", "None", weapon.ammunition)}
    ${textFieldHtml("wf-source", 'Source (optional — leave blank for "Custom")', weapon.customSource)}`;
}

function wireWeaponFields(state) {
  wireSelect("wf-ability");
  wireSelect("wf-type");
  wireSegmented("wf-prof");
  wireCombo("wf-req", WEAPON_PROFICIENCY_TYPES);
  wireCombo("wf-ammo", character.resources.map(r => r.name));

  const rows = document.getElementById("damage-rows");
  renderDamageRows(rows, state.damage);
  document.getElementById("add-damage-button").addEventListener("click", () => {
    state.damage.push({ dice: "1d4", type: DAMAGE_TYPES[0] });
    renderDamageRows(rows, state.damage);
  });
  renderPropertyPicker(document.getElementById("property-picker"), state.properties);
}

function readWeaponFields(state) {
  const prof = document.getElementById("wf-prof").value;
  return {
    isWeapon: true,
    attackAbility: document.getElementById("wf-ability").value,
    magicBonus: parseInt(document.getElementById("wf-magic").value) || 0,
    weaponType: document.getElementById("wf-type").value,
    range: document.getElementById("wf-range").value.trim(),
    proficiencyRequired: document.getElementById("wf-req").value.trim(),
    ammunition: document.getElementById("wf-ammo").value.trim(),
    customSource: document.getElementById("wf-source").value.trim(),
    damage: readDamageRows(state.damage),
    properties: state.properties.slice(),
    proficientOverride: prof === "derived" ? undefined : prof === "yes"
  };
}

function armourFieldsHtml(item) {
  const armour = (item && item.armour) || {};
  return `
    <div class="field-row">
      ${numberFieldHtml("af-base", "Base AC", armour.base != null ? armour.base : 11)}
      ${selectFieldHtml("af-kind", "Armour Type", ARMOUR_KINDS, armour.kind || "light")}
    </div>
    ${numberFieldHtml("af-dexcap", "Max Dexterity Bonus", armour.dexCap,
      { placeholder: "Blank for no limit" })}
    <div class="menu-note" style="margin-top:0;">A shield's base is the bonus it adds and stacks with worn armour. Anything else replaces the unarmoured 10.</div>`;
}

function wireArmourFields() {
  wireSelect("af-kind");
  // switching kind drops in that kind's usual Dexterity limit
  document.getElementById("af-kind").addEventListener("change", (e) => {
    const kind = ARMOUR_KINDS.find(k => k.value === e.target.value);
    document.getElementById("af-dexcap").value = kind && kind.dexCap != null ? kind.dexCap : "";
  });
}

function readArmourFields() {
  const raw = document.getElementById("af-dexcap").value.trim();
  return {
    base: parseInt(document.getElementById("af-base").value) || 0,
    kind: document.getElementById("af-kind").value,
    dexCap: raw === "" ? null : (parseInt(raw) || 0)
  };
}

// keeps the stored object honest when the type changes -- a former weapon
// shouldn't keep its damage list once it becomes gear
function applyItemType(item, type, state) {
  if (type === "weapon") {
    Object.assign(item, readWeaponFields(state));
    delete item.armour;
    return;
  }
  ["isWeapon", "attackAbility", "magicBonus", "weaponType", "range", "proficiencyRequired",
   "proficientOverride", "ammunition", "customSource", "damage", "properties", "twoHanded", "isDefaultLoadout"]
    .forEach(key => delete item[key]);
  if (type === "armour") item.armour = readArmourFields();
  else delete item.armour;
}

function renderItemTypeFields(container, type, item, state) {
  container.innerHTML = type === "weapon" ? weaponFieldsHtml(item)
    : type === "armour" ? armourFieldsHtml(item) : "";
  if (type === "weapon") wireWeaponFields(state);
  if (type === "armour") wireArmourFields();
}

function wireItemTypeToggle(state, container, item) {
  document.querySelectorAll("[data-item-type]").forEach(button => {
    button.addEventListener("click", () => {
      state.type = button.dataset.itemType;
      document.querySelectorAll("[data-item-type]").forEach(other =>
        other.classList.toggle("active", other.dataset.itemType === state.type));
      renderItemTypeFields(container, state.type, item, state);
    });
  });
}

function newItemFormState(item) {
  item = item || {};
  return {
    type: item.name ? itemType(item) : "gear",
    damage: JSON.parse(JSON.stringify(item.damage && item.damage.length
      ? item.damage : [{ dice: "1d4", type: DAMAGE_TYPES[0], ability: "STR" }])),
    properties: (item.properties || []).slice()
  };
}

function openAddInventoryModal(presetCategory, presetType) {
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
  guardModalEdits();

  const modeItemBtn = document.getElementById("mode-invitem-btn");
  const modeCatBtn = document.getElementById("mode-invcat-btn");
  const body = document.getElementById("add-inv-body");

  const state = newItemFormState();
  if (presetType) state.type = presetType;

  function renderItemBody() {
    const defaultCat = presetCategory && categories.includes(presetCategory) ? presetCategory : categories[0];
    body.innerHTML = `
      ${itemTypeToggleHtml(state.type)}
      ${commonItemFieldsHtml({ category: defaultCat })}
      <div id="type-fields"></div>
      <button class="btn-primary" id="save-item-button" style="margin-top:16px;">Add Item</button>
    `;
    wireSelect("if-category");

    const typeFields = document.getElementById("type-fields");
    renderItemTypeFields(typeFields, state.type, null, state);
    wireItemTypeToggle(state, typeFields, null);

    document.getElementById("save-item-button").addEventListener("click", () => {
      const newId = makeId(character.inventory);
      const item = Object.assign({ id: newId }, readCommonItemFields());

      const acBonus = parseInt(document.getElementById("if-ac").value) || 0;
      const attackBonus = parseInt(document.getElementById("if-atkb").value) || 0;
      if (acBonus) item.acBonus = acBonus;
      if (attackBonus) item.attackBonus = attackBonus;
      // tracking is turned on from the item's own detail view, not here

      applyItemType(item, state.type, state);

      character.inventory.push(item);
      openInvCategories[item.category] = true;
      closeModal();
      renderContent();
    });
  }

  function renderCategoryBody() {
    body.innerHTML = `
      ${textFieldHtml("new-cat-name", "Name", "", { placeholder: "e.g. Familiar's Pouch" })}
      ${categoryRuleTogglesHtml("sw-", null)}
      <button class="btn-primary" id="save-cat-button">Create Category</button>
    `;
    let weightOn = false, effectsOn = false, attacksOn = false;
    document.getElementById("sw-weight").addEventListener("click", (e) => { weightOn = !weightOn; e.currentTarget.classList.toggle("on", weightOn); });
    document.getElementById("sw-effects").addEventListener("click", (e) => { effectsOn = !effectsOn; e.currentTarget.classList.toggle("on", effectsOn); });
    document.getElementById("sw-attacks").addEventListener("click", (e) => { attacksOn = !attacksOn; e.currentTarget.classList.toggle("on", attacksOn); });
    document.getElementById("save-cat-button").addEventListener("click", () => {
      const name = document.getElementById("new-cat-name").value.trim();
      if (!name || character.categoryRules[name]) { closeModal(); return; }
      character.categoryRules[name] = { countsWeight: weightOn, appliesEffects: effectsOn, providesAttacks: attacksOn };
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
  let weightOn = rule.countsWeight, effectsOn = rule.appliesEffects, attacksOn = !!rule.providesAttacks;

  openModal("sheet", `
    <div class="modal-heading">Edit Category</div>
    ${textFieldHtml("edit-cat-name", "Name", category)}
    ${categoryRuleTogglesHtml("sw-edit-", rule)}
    <div class="btn-row-2">
      <button class="btn-primary" id="save-cat-edit-button">Save Changes</button>
      <button class="btn-primary btn-danger" id="remove-cat-button">Remove</button>
    </div>
  `);
  guardModalEdits();
  document.getElementById("sw-edit-weight").addEventListener("click", (e) => { weightOn = !weightOn; e.currentTarget.classList.toggle("on", weightOn); });
  document.getElementById("sw-edit-effects").addEventListener("click", (e) => { effectsOn = !effectsOn; e.currentTarget.classList.toggle("on", effectsOn); });
  document.getElementById("sw-edit-attacks").addEventListener("click", (e) => { attacksOn = !attacksOn; e.currentTarget.classList.toggle("on", attacksOn); });

  document.getElementById("save-cat-edit-button").addEventListener("click", () => {
    const newName = document.getElementById("edit-cat-name").value.trim();
    if (!newName || (newName !== category && character.categoryRules[newName])) { closeModal(); return; }
    const newRule = { countsWeight: weightOn, appliesEffects: effectsOn, providesAttacks: attacksOn };
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
    confirmModal({
      title: `Remove "${category}"?`,
      body: count > 0
        ? `This category contains ${count} item${count === 1 ? "" : "s"}. They will be deleted too.`
        : "This category is empty.",
      confirmLabel: "Remove", danger: true,
      onConfirm: () => {
        delete character.categoryRules[category];
        character.inventory = character.inventory.filter(i => i.category !== category);
        delete openInvCategories[category];
        closeModal();
        renderContent();
      }
    });
  });
}

/* Tapping an item shows what it is; editing is a deliberate second step. Same
   split as an attack, a skill or an effect -- looking at something shouldn't
   drop you into a form. */
/* A tick or a cross, not the word "yes".

   Whether you're proficient is the one fact in this block a player scans for
   mid-turn, and "yes (needs Simple)" made them read a sentence to find it. The
   mark carries the answer and the colour carries it again, so it survives a
   glance. The category is named plainly beside it -- a player who has got as
   far as equipping a weapon knows what "Martial" means without being told it
   is a thing they need. */
function proficiencyMarkHtml(proficiency) {
  const category = proficiency.required ? ` <span class="prof-need">${esc(proficiency.required)}</span>` : "";
  return proficiency.proficient
    ? `<span class="prof-yes">\u2713${category}</span>`
    : `<span class="prof-no">\u2717${category}</span>`;
}

function openItemDetailModal(itemId) {
  const item = character.inventory.find(i => i.id == itemId);
  if (!item) return;
  const rule = character.categoryRules[item.category] || {};
  const quantity = item.qty || 1;
  const type = itemType(item);

  const facts = [];
  facts.push(["Category", item.category + (rule.providesAttacks && item.isWeapon ? " · drawn" : "")]);
  if (quantity > 1) facts.push(["Quantity", String(quantity)]);
  facts.push(["Weight", rule.countsWeight
    ? (item.weight * quantity) + " lb" + (quantity > 1 ? " (" + item.weight + " each)" : "")
    : "not carried"]);

  if (type === "armour") {
    facts.push(["Base AC", String(item.armour.base)]);
    facts.push(["Armour Type", (ARMOUR_KINDS.find(k => k.value === item.armour.kind) || {}).label || item.armour.kind]);
    facts.push(["Max Dexterity", item.armour.dexCap === null || item.armour.dexCap === undefined ? "no limit" : String(item.armour.dexCap)]);
  }
  if (item.acBonus) facts.push(["AC Bonus", formatModifier(item.acBonus)]);
  if (item.attackBonus) facts.push(["Attack Bonus", formatModifier(item.attackBonus)]);
  if (item.resource) {
    const container = isContainer(item);
    facts.push(["Tracked", container ? "Container, under Resources" : "Stack, under Resources"]);
    if (container) {
      facts.push(["Holds", (item.resource.loaded || 0) + " of " + item.resource.max]);
      facts.push(["Refills from", item.resource.refillFrom]);
    } else if (item.resource.max) {
      facts.push(["Capacity", String(item.resource.max)]);
    }
    if (rechargeLabel(item.resource.recharge) !== "\u2014") {
      facts.push(["Recharges", rechargeLabel(item.resource.recharge)]);
    }
  }

  let weaponBlock = "";
  if (type === "weapon") {
    const atk = calculateAttack(character, item);
    weaponBlock = `
      <div class="breakdown-subhead">Attack</div>
      <div class="breakdown-row"><span>To Hit</span><span>${formatModifier(atk.toHitTotal)}</span></div>
      ${atk.damage.map(part => `
        <div class="breakdown-row"><span>${esc(part.type || "Damage")}</span><span>${esc(part.notation)}</span></div>
      `).join("")}
      <div class="breakdown-row"><span>Proficiency</span>${proficiencyMarkHtml(atk.proficiency)}</div>
      ${item.properties && item.properties.length ? `<div class="breakdown-row"><span>Properties</span><span>${esc(item.properties.join(", "))}</span></div>` : ""}
      ${rule.providesAttacks ? "" : `<div class="menu-note">Stowed in ${esc(item.category)}, so it isn't on your Attacks list.</div>`}
      ${toggleLineHtml("item-offhand-switch", "Off-hand weapon", atk.offHand,
        { hint: atk.suppressedOffHandAbility ? "No ability modifier on damage without Two-Weapon Fighting." : "", style: "margin-top:10px;" })}`;
  }

  openModal("full", `
    <div class="modal-heading-row">
      <div class="modal-heading">${esc(item.name)}</div>
      <button class="icon-btn-delete" id="detail-delete-trigger" title="Remove item">🗑</button>
    </div>
    ${item.description ? `<div class="effect-note">${esc(item.description)}</div>` : ""}

    <div class="breakdown-subhead">Details</div>
    ${facts.map(([label, value]) => `<div class="breakdown-row"><span>${esc(label)}</span><span>${esc(value)}</span></div>`).join("")}
    ${weaponBlock}

    <div class="btn-row-2" style="margin-top:22px;">
      <button class="btn-primary" id="detail-edit-button">Edit</button>
      <button class="btn-primary" id="detail-give-button" style="background:var(--control);color:var(--accent-soft);">Give</button>
    </div>
    ${toggleLineHtml("detail-track-switch", "Track under Resources", !!item.resource,
      { hint: "For things you spend, like arrows", style: "margin-top:14px;" })}
    <div id="detail-resource-fields">${item.resource ? itemResourceFieldsHtml(item.resource) : ""}</div>
    ${item.resource ? `<button class="btn-primary" id="detail-resource-save">Save Tracking</button>` : ""}
  `);

  const offHandSwitch = document.getElementById("item-offhand-switch");
  if (offHandSwitch) offHandSwitch.addEventListener("click", () => {
    item.offHand = !item.offHand;
    closeModal();
    renderContent();
    openItemDetailModal(itemId);
  });

  /* Tracking is turned on and off here, where the player is looking at the
     item -- it used to be a toggle buried in the edit form. Switching it on
     creates an uncapped stack, because the quantity is already the count and
     anything more specific (a capacity, a container to refill from, a
     recharge) belongs in the Resource editor on Combat, which owns it. */
  const trackSwitch = document.getElementById("detail-track-switch");
  if (trackSwitch && trackSwitch.addEventListener) trackSwitch.addEventListener("click", () => {
    if (item.resource) {
      // takes it off the Resources list; the item itself is untouched
      delete item.resource;
      showToast(item.name + " is no longer tracked");
    } else {
      item.resource = { max: 0, recharge: { on: "none", amount: "all" } };
    }
    closeModal();
    renderContent();
    openItemDetailModal(itemId);
  });

  // the whole tracking block lives here: turning it on and configuring it are
  // the same job, and there is nowhere else to set a capacity for an item that
  // isn't tracked yet
  if (item.resource) {
    wireRechargeField("if-res");
    wireCombo("if-res-refill", resourceRows(character).map(r => r.name));

    /* Capacity decides whether "All" and "Half" mean anything, so the Restores
       control has to be rebuilt when capacity changes -- otherwise the greying
       is only correct for the value the form opened with. */
    const capacity = document.getElementById("if-res-max");
    if (capacity && capacity.addEventListener) capacity.addEventListener("input", () => {
      const wrap = document.getElementById("if-res-recharge-wrap");
      if (!wrap) return;
      const current = readRechargeValue("if-res");
      wrap.innerHTML = rechargeFieldHtml("if-res", current, { noMaximum: (parseInt(capacity.value) || 0) === 0 });
      wireRechargeField("if-res");
    });
    const saveTracking = document.getElementById("detail-resource-save");
    if (saveTracking && saveTracking.addEventListener) saveTracking.addEventListener("click", () => {
      const tracked = readItemResourceFields(item);
      if (tracked) item.resource = tracked;
      closeModal();
      renderContent();
      showToast(item.name + " tracking saved");
    });
  }

  document.getElementById("detail-edit-button").addEventListener("click", () => openItemEditModal(itemId));
  document.getElementById("detail-give-button").addEventListener("click", () => startGiveFlow(item));
  document.getElementById("detail-delete-trigger").addEventListener("click", () => confirmDeleteItem(item));
}

function openItemEditModal(itemId) {
  const item = character.inventory.find(i => i.id == itemId);
  const state = newItemFormState(item);

  openModal("full", `
    <div class="modal-heading-row">
      <div class="modal-heading">Edit Item</div>
      <button class="icon-btn-delete" id="delete-item-trigger" title="Remove item">\uD83D\uDDD1</button>
    </div>
    ${itemTypeToggleHtml(state.type)}
    ${commonItemFieldsHtml(item)}
    <div id="type-fields"></div>
    <div class="btn-row-2" style="margin-top:16px;">
      <button class="btn-primary" id="save-item-edit-button">Save Changes</button>
      <button class="btn-primary" id="give-item-button" style="background:var(--control);color:var(--accent-soft);">Give</button>
    </div>
  `);
  guardModalEdits();

  wireSelect("if-category");
  const typeFields = document.getElementById("type-fields");
  renderItemTypeFields(typeFields, state.type, item, state);
  wireItemTypeToggle(state, typeFields, item);

  document.getElementById("save-item-edit-button").addEventListener("click", () => {
    Object.assign(item, readCommonItemFields());
    const ac = parseInt(document.getElementById("if-ac").value) || 0;
    const atkb = parseInt(document.getElementById("if-atkb").value) || 0;
    if (ac) item.acBonus = ac; else delete item.acBonus;
    if (atkb) item.attackBonus = atkb; else delete item.attackBonus;
    // item.resource is deliberately untouched -- this form no longer owns it,
    // and reading an absent field would silently drop a tracked item's config

    applyItemType(item, state.type, state);

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

/* confirmModal, not openModal.

   This was built on openModal, which begins by closing whatever is already
   open. Deleting from inside the edit form therefore destroyed the form: open
   Edit Item, change the name, tap the bin, tap Cancel -- and the edit and the
   unsaved change were both gone. A confirmation is the one dialog that must
   never take its own caller down with it, which is exactly what confirmModal's
   separate layer is for. */
function confirmDeleteItem(item, onDone) {
  confirmModal({
    title: "Remove " + item.name + "?",
    body: "This can't be undone.",
    confirmLabel: "Remove",
    danger: true,
    onConfirm: () => {
      character.inventory = character.inventory.filter(i => i.id !== item.id);
      // the caller decides what to do with itself -- the detail modal closes,
      // the edit form closes, a row just re-renders
      if (onDone) onDone();
      else closeModal();
      renderContent();
      showToast("Removed " + item.name);
    }
  });
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

/* Who is actually in the room, rather than four names baked into the demo
   character. Empty when you aren't in a party, which is the honest answer and
   what the Give screen now says. */
function partyRosterForGiving() {
  return party.members
    .filter(m => !m.you)
    .map(m => ({ name: m.name, role: m.owner ? "Host" : "Player", device: m.device }));
}

function openGiveToModal(item, qty) {
  openRecipientPicker("Give to", recipient => applyGive(item, qty, recipient));
}

function openSendCoinToModal(amount) {
  openRecipientPicker("Send to", recipient => applyGiveCoin(amount, recipient));
}

function openRecipientPicker(heading, onPick) {
  const roster = partyRosterForGiving();
  let selected = null;

  openModal("full", `
    <div class="modal-heading">${esc(heading)}</div>
    <div id="give-to-list">
      ${roster.length ? "" : `<div class="empty-hint">Nobody else is in the party.</div>`}
      ${roster.map((m, i) => `
        <div class="recipient-row" data-give-to="${i}">
          <div class="recipient-left">
            <div class="char-avatar">${m.name.charAt(0).toUpperCase()}</div>
            <div>
              <div class="recipient-name">${esc(m.name)}</div>
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
    onPick(roster[selected]);
  });
}

/* Coin is picked denomination by denomination rather than as a total, because
   that is how it is carried. Handing over 340 silver and having it land as 34
   gold would be the app deciding something about the player's purse that the
   player did not. */
function openSendMoneyModal() {
  openModal("sheet", `
    <div class="modal-heading">Send Money</div>
    <div class="breakdown-source" style="margin-bottom:12px;">Nothing is converted on the way.</div>
    ${COIN_TYPES.map(coin => numberFieldHtml("send-coin-" + coin.key, coin.name,
      0, { min: 0, max: coinCount(character.purse, coin.key) })).join("")}
    <button class="btn-primary" id="send-money-next">Choose a Player</button>
    <button class="btn-secondary" id="send-money-cancel">Cancel</button>
  `);

  document.getElementById("send-money-cancel").addEventListener("click", closeModal);
  document.getElementById("send-money-next").addEventListener("click", () => {
    const amount = {};
    COIN_TYPES.forEach(coin => {
      const value = parseInt(document.getElementById("send-coin-" + coin.key).value) || 0;
      if (value > 0) amount[coin.key] = value;
    });
    if (!purseTotal(amount)) { showToast("Enter an amount"); return; }
    if (!canAffordPurse(character.purse, amount)) { showToast("You don't have that much"); return; }
    openSendCoinToModal(amount);
  });
}

function applyGiveCoin(amount, recipient) {
  const transferId = partyGiveCoin(amount, recipient);
  if (!transferId) { showToast("Not connected \u2014 nothing was sent"); return; }
  takeFromPurse(character.purse, amount);
  closeModal();
  renderContent();
  showGiveStatusModal(transferId);
}

/* A give is an offer, not a delivery. The item leaves the bag as soon as the
   offer is away -- promising the same sword to two people while one of them
   thinks about it is worse than a moment of it looking gone -- and comes back
   on a no. Nothing leaves at all if the socket is down. */
function applyGive(item, qty, recipient) {
  const transferId = partyGiveItem(item, qty, recipient);
  if (!transferId) {
    showToast("Not connected \u2014 nothing was given");
    return;
  }
  const currentQty = item.qty || 1;
  if (qty >= currentQty) character.inventory = character.inventory.filter(i => !sameId(i.id, item.id));
  else item.qty = currentQty - qty;
  closeModal();
  renderContent();
  showGiveStatusModal(transferId);
}

function itemAmountLabel(name, qty) {
  return (qty > 1 ? qty + " " : "") + name;
}

/* What the giver watches while the other player decides. Closeable on purpose:
   a phone held up mid-demo should not be stuck on a spinner, and the window
   comes back by itself the moment an answer arrives. */
function showGiveStatusModal(transferId) {
  const pending = pendingGives[transferId];
  if (!pending) return;
  const what = pending.coin ? purseLabel(pending.coin) : itemAmountLabel(pending.item.name, pending.qty);
  const waiting = pending.status === "waiting";

  let line;
  if (waiting) line = esc(pending.toName) + " is deciding\u2026";
  else if (pending.status === "accepted") line = esc(pending.toName) + " accepted.";
  else if (pending.status === "declined") {
    line = esc(pending.toName) + " declined."
      + (pending.reason ? " (" + esc(pending.reason) + ")" : "")
      + (pending.coin ? " It's back in your purse." : " It's back in your bag.");
  } else {
    line = "No answer from " + esc(pending.toName)
      + (pending.coin ? ". It's back in your purse." : ". It's back in your bag.");
  }

  openModal("center", `
    <div class="breakdown-title">Sending ${esc(what)}</div>
    <div class="breakdown-source" style="margin-bottom:12px;">${line}</div>
    ${waiting ? `<div class="empty-hint" style="padding:0 0 10px;">You can close this \u2014 it comes back when they answer.</div>` : ""}
    <button class="btn-secondary" id="give-status-close">${waiting ? "Close" : "Done"}</button>
  `);
  document.getElementById("modal-overlay")
    .querySelector("#give-status-close")
    .addEventListener("click", () => {
      if (!waiting) delete pendingGives[transferId];
      closeModal();
    });
}

/* An item arriving uninvited is a change to someone's character that they did
   not make, so it is asked rather than done. */
function openIncomingItemModal(offer) {
  const what = offer.coin ? purseLabel(offer.coin) : itemAmountLabel(offer.item.name, offer.item.qty);
  openModal("center", `
    <div class="breakdown-title">${esc(offer.fromName)} wants to give you</div>
    <div class="res-row"><div class="res-name">${esc(what)}</div></div>
    ${(offer.item && offer.item.description) ? `<div class="effect-note">${esc(offer.item.description)}</div>` : ""}
    <button class="btn-primary" id="offer-accept-button" style="margin-top:12px;">Accept</button>
    <button class="btn-secondary" id="offer-decline-button">Decline</button>
  `);
  const modal = document.getElementById("modal-overlay");
  modal.querySelector("#offer-accept-button").addEventListener("click", () => respondToOffer(true));
  modal.querySelector("#offer-decline-button").addEventListener("click", () => respondToOffer(false));
}

function respondToOffer(accepted) {
  const offer = incomingOffer;
  incomingOffer = null;
  if (!offer) { closeModal(); return; }

  let missing = [];
  if (accepted && offer.coin) addToPurse(character.purse, offer.coin);
  if (accepted && offer.item) {
    const landed = receivedItem(offer.item, character, offer.transferId);
    applyReceivedItem(character, landed.item);
    missing = landed.missing;
  }
  if (offer.from) {
    partySend("item-reply", { transferId: offer.transferId, to: offer.from, accepted: accepted, fromName: myPartyName() });
  }
  closeModal();
  if (!accepted) return;

  const what = offer.coin ? purseLabel(offer.coin) : itemAmountLabel(offer.item.name, offer.item.qty);
  showToast(missing.length
    ? "Took " + what + " \u2014 no " + missing.join(" or ") + " here, so it arrived unlinked"
    : "Took " + what);
  renderContent();
}

/* Said no on the player's behalf, when they are in no position to be asked.
   Answering straight away is kinder to the giver than a minute of silence. */
function declineOffer(offer, reason) {
  if (offer.from) {
    partySend("item-reply", {
      transferId: offer.transferId, to: offer.from,
      accepted: false, reason: reason, fromName: myPartyName()
    });
  }
  showToast(offer.fromName + " tried to give you something \u2014 " + reason);
}
