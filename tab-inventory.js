/* ============================================================
   INVENTORY TAB
   ============================================================ */

let openInvCategories = {};
let suppressInvClickUntil = 0;

function renderInventoryTab() {
  const bonuses = [];
  character.inventory.forEach(item => {
    const rule = character.categoryRules[item.category];
    if (!rule || !rule.appliesEffects) return;
    if (item.acBonus) bonuses.push({ value: formatModifier(item.acBonus) + " AC", name: item.name });
    if (item.attackBonus) bonuses.push({ value: formatModifier(item.attackBonus) + " Attack", name: item.name });
  });
  const weight = calculateCarriedWeight(character);
  const categories = Object.keys(character.categoryRules);

  return `
    <div class="weight-line" style="display:flex;align-items:center;justify-content:space-between;">
      <span>Carried weight: <strong>${weight.total} lb</strong></span>
      <button class="add-link" id="add-inventory-button">+ Add</button>
    </div>
    ${bonuses.length ? `
      <div class="chip-row" style="margin-top:10px;">
        ${bonuses.map(bonus => `<div class="chip chip-stat"><span class="chip-value">${esc(bonus.value)}</span>${esc(bonus.name)}</div>`).join("")}
      </div>` : ""}

    <div id="inventory-sections">
      ${categories.map(cat => {
        const isOpen = openInvCategories[cat] !== false;
        const items = character.inventory.filter(i => i.category === cat);
        return `
          <div class="section-head-row" data-cat-card="${esc(cat)}" data-inv-cat-toggle="${esc(cat)}" style="cursor:pointer;touch-action:none;">
            <div class="section-head">${esc(cat)}</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <button class="mini-edit" data-edit-category="${esc(cat)}">\u270E</button>
              <span style="color:var(--text-dim);font-size:12px;">${isOpen ? "\u2212" : "+"}</span>
            </div>
          </div>
          <div data-cat-body="${esc(cat)}" style="${isOpen ? "" : "display:none;"}">
            ${items.map(item => `
              <div class="item-row" data-item-view="${item.id}" data-item-id="${item.id}" style="touch-action:none;">
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
    ${toggleLineHtml("if-resource-switch", "Track under Resources", item.resource,
      { hint: "for things you spend, like arrows" })}
    <div id="if-resource-fields">${item.resource ? itemResourceFieldsHtml(item.resource) : ""}</div>`;
}

function itemResourceFieldsHtml(resource) {
  resource = resource || {};
  return `
    ${numberFieldHtml("if-res-max", "Capacity", resource.max != null ? resource.max : 0,
      { placeholder: "0", hint: "Leave at 0 for an uncapped stack — it'll show a bare count." })}
    ${(resource.max || 0) === 0 && ["all", "half"].includes(resource.recharge && resource.recharge.amount)
      ? `<div class="form-warning">An uncapped stack has no full amount to restore to, so "All" and "Half" do nothing here. Give it a capacity, or set a specific amount.</div>` : ""}
    ${comboFieldHtml("if-res-refill", "Refills From (optional)", "e.g. Arrows", resource.refillFrom)}
    <div class="atk-range" style="margin:-6px 0 12px;">Name another tracked item and this becomes a container: the count is what's loaded, and a Refill button moves units across.</div>
    ${rechargeFieldHtml("if-res", resource.recharge || { on: "none", amount: "all" })}`;
}

// the quantity is the count, so there's no separate "current" to keep in step
function wireItemResourceFields(item) {
  const wrap = document.getElementById("if-resource-fields");
  const toggle = document.getElementById("if-resource-switch");
  let on = !!(item && item.resource);

  function draw() {
    wrap.innerHTML = on ? itemResourceFieldsHtml(item && item.resource) : "";
    if (on) { wireRechargeField("if-res"); wireCombo("if-res-refill", resourceRows(character).map(r => r.name)); }
  }
  toggle.addEventListener("click", () => {
    on = !on;
    toggle.classList.toggle("on", on);
    draw();
  });
  if (on) { wireRechargeField("if-res"); wireCombo("if-res-refill", resourceRows(character).map(r => r.name)); }
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
      ${selectFieldHtml("wf-prof", "Proficient?", [
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
  wireSelect("wf-prof");
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
    wireItemResourceFields(null);

    const typeFields = document.getElementById("type-fields");
    renderItemTypeFields(typeFields, state.type, null, state);
    wireItemTypeToggle(state, typeFields, null);

    document.getElementById("save-item-button").addEventListener("click", () => {
      const newId = Math.max(0, ...character.inventory.map(i => i.id)) + 1;
      const item = Object.assign({ id: newId }, readCommonItemFields());

      const acBonus = parseInt(document.getElementById("if-ac").value) || 0;
      const attackBonus = parseInt(document.getElementById("if-atkb").value) || 0;
      if (acBonus) item.acBonus = acBonus;
      if (attackBonus) item.attackBonus = attackBonus;
      const tracked = readItemResourceFields(null);
      if (tracked) item.resource = tracked;

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
      <button class="btn-primary" id="remove-cat-button" style="background:var(--danger-surface);color:var(--danger-text);">Remove</button>
    </div>
  `);
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
    const warning = count > 0
      ? `This category contains ${count} item${count === 1 ? "" : "s"} that will also be deleted. Remove "${esc(category)}"?`
      : `Remove empty category "${esc(category)}"?`;
    if (!confirm(warning)) return;
    delete character.categoryRules[category];
    character.inventory = character.inventory.filter(i => i.category !== category);
    delete openInvCategories[category];
    closeModal();
    renderContent();
  });
}

/* Tapping an item shows what it is; editing is a deliberate second step. Same
   split as an attack, a skill or an effect -- looking at something shouldn't
   drop you into a form. */
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
      <div class="breakdown-row"><span>Proficiency</span><span>${atk.proficiency.proficient ? "yes" : "no"}${atk.proficiency.required ? " (needs " + esc(atk.proficiency.required) + ")" : ""}</span></div>
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
    ${item.resource ? `<button class="btn-secondary" id="detail-untrack-button">Stop tracking as a resource</button>` : ""}
  `);

  const offHandSwitch = document.getElementById("item-offhand-switch");
  if (offHandSwitch) offHandSwitch.addEventListener("click", () => {
    item.offHand = !item.offHand;
    closeModal();
    renderContent();
    openItemDetailModal(itemId);
  });

  const untrack = document.getElementById("detail-untrack-button");
  if (untrack) untrack.addEventListener("click", () => {
    // takes it off the Resources list; the item itself is untouched
    delete item.resource;
    closeModal();
    renderContent();
    showToast(item.name + " is no longer tracked as a resource");
  });

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

  wireSelect("if-category");
  wireItemResourceFields(item);
  const typeFields = document.getElementById("type-fields");
  renderItemTypeFields(typeFields, state.type, item, state);
  wireItemTypeToggle(state, typeFields, item);

  document.getElementById("save-item-edit-button").addEventListener("click", () => {
    Object.assign(item, readCommonItemFields());
    const ac = parseInt(document.getElementById("if-ac").value) || 0;
    const atkb = parseInt(document.getElementById("if-atkb").value) || 0;
    if (ac) item.acBonus = ac; else delete item.acBonus;
    if (atkb) item.attackBonus = atkb; else delete item.attackBonus;
    const tracked = readItemResourceFields(item);
    if (tracked) item.resource = tracked; else delete item.resource;

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

function confirmDeleteItem(item) {
  openModal("center", `
    <div class="modal-heading">Remove ${esc(item.name)}?</div>
    <div class="breakdown-source" style="margin-bottom:14px;">This can't be undone.</div>
    <button class="btn-primary" id="confirm-remove-item-button" style="background:var(--danger-surface);color:var(--danger-text);margin-bottom:8px;">Remove</button>
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
