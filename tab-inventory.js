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
        <span class="money-head-label">${stashOn ? "Carried" : "Coins"}</span>
        ${(typeof party !== "undefined" && party.status !== "none" && partyMemberList(party.members, deviceId()).length)
          ? `<button class="add-link" id="send-money-button">Send</button>` : ""}
        <span class="money-total">${formatGold(moneyInGold(character.purse))} gp</span>
      </div>
      <div class="coin-row">${coinCellsHtml(character.purse, "purse")}</div>
      ${stashOn ? `
        <div class="money-head" style="margin-top:10px;">
          <span class="money-head-label">Stashed</span>
          <span class="money-total">${formatGold(moneyInGold(character.stash))} gp</span>
        </div>
        <div class="coin-row">${coinCellsHtml(character.stash, "stash")}</div>` : ""}
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
        // contained items draw under their pack, not beside it
        const items = character.inventory.filter(i => i.category === cat && i.inside == null);
        return `
          <div class="section-head-row" data-cat-card="${esc(cat)}" data-inv-cat-toggle="${esc(cat)}" style="cursor:pointer;touch-action:pan-y;">
            <div class="section-head">${esc(cat)}</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <button class="mini-edit" data-edit-category="${esc(cat)}">\u270E</button>
            </div>
          </div>
          <div data-cat-body="${esc(cat)}" style="${isOpen ? "" : "display:none;"}">
            ${items.map(item => itemRowHtml(item, cat)).join("") || `<div class="empty-hint">No items in this category</div>`}
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

    let packTarget = null;

    const clearMergeMarks = () => {
      document.querySelectorAll(".merge-ready, .merge-hover, .pack-ready, .pack-hover").forEach(r =>
        r.classList.remove("merge-ready", "merge-hover", "pack-ready", "pack-hover"));
      mergeTarget = null;
      packTarget = null;
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
          if (canMergeStacks(dragged, item)) { other.classList.add("merge-ready"); return; }
          // a pack you could drop this into: not itself, not another pack, and
          // not the one it is already sitting in
          if (isContainerItem(item) && dragged && !isContainerItem(dragged) && !sameId(dragged.inside, item.id)) {
            other.classList.add("pack-ready");
          }
        });
      },
      onMove: (e) => {
        /* Over the middle of a matching row means merge, and the row is left
           where it is. The outer quarters still reorder, so dropping a stack
           between two others is unaffected. */
        const over = itemRowUnder(e, row);
        const overMiddle = over && (() => {
          const box = over.getBoundingClientRect();
          return e.clientY > box.top + box.height * 0.25 && e.clientY < box.bottom - box.height * 0.25;
        })();

        if (over && overMiddle && over.classList.contains("merge-ready")) {
          if (mergeTarget !== over) {
            if (mergeTarget) mergeTarget.classList.remove("merge-hover");
            if (packTarget) { packTarget.classList.remove("pack-hover"); packTarget = null; }
            mergeTarget = over;
            over.classList.add("merge-hover");
          }
          return;
        }
        if (over && overMiddle && over.classList.contains("pack-ready")) {
          if (packTarget !== over) {
            if (packTarget) packTarget.classList.remove("pack-hover");
            if (mergeTarget) { mergeTarget.classList.remove("merge-hover"); mergeTarget = null; }
            packTarget = over;
            over.classList.add("pack-hover");
          }
          return;
        }
        if (mergeTarget) { mergeTarget.classList.remove("merge-hover"); mergeTarget = null; }
        if (packTarget) { packTarget.classList.remove("pack-hover"); packTarget = null; }

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
        if (packTarget) {
          const pack = character.inventory.find(i => sameId(i.id, packTarget.dataset.itemId));
          clearMergeMarks();
          if (pack && dragged && putInContainer(character, dragged, pack)) {
            openInvContainers[pack.id] = true;
            showToast(dragged.name + " \u2192 " + pack.name);
            renderContent();
            return;
          }
        }
        clearMergeMarks();

        /* Rebuilt from what is on screen, which is also how something leaves a
           pack: a row dragged out of a pack's list is no longer inside one, and
           a row dropped into it is. `closest` answers that for both at once. */
        const rebuilt = [];
        document.querySelectorAll("[data-cat-body]").forEach(body => {
          const cat = body.dataset.catBody;
          body.querySelectorAll(".item-row").forEach(r => {
            const item = character.inventory.find(i => sameId(i.id, r.dataset.itemId));
            if (!item) return;
            const packBody = r.closest("[data-pack-body]");
            if (packBody) item.inside = packBody.dataset.packBody;
            else delete item.inside;
            item.category = cat;
            rebuilt.push(item);
          });
        });
        character.inventory = rebuilt;
        renderContent();
      }
    });
  });
}

let openInvContainers = {};

function wireInventoryTab() {
  document.querySelectorAll("[data-container-toggle]").forEach(caret => {
    caret.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = caret.dataset.containerToggle;
      openInvContainers[id] = openInvContainers[id] === false;
      renderContent();
    });
  });
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

/* One inventory row. A pack draws its contents underneath it, indented and
   collapsible, and reports the weight of everything inside rather than its own
   nothing -- an empty backpack weighing 0 lb while holding sixty pounds of rope
   and rations is the thing this replaced. */
function itemRowHtml(item, cat, nested) {
  const rule = character.categoryRules[cat] || {};
  const container = isContainerItem(item);
  const contents = container ? containerContents(character, item) : [];
  const isOpen = container && openInvContainers[item.id] !== false;
  const weight = container ? containerWeight(character, item) : (item.weight || 0) * (item.qty || 1);

  return `
    <div class="item-row${nested ? " item-nested" : ""}" data-item-view="${item.id}" data-item-id="${item.id}"
         ${container ? `data-container-row="${item.id}"` : ""} style="touch-action:pan-y;">
      <div style="flex:1;">
        <div class="item-name">${container ? `<span class="pack-caret" data-container-toggle="${item.id}">${isOpen ? "\u25BE" : "\u25B8"}</span> ` : ""}${esc(item.name)}${item.qty > 1 ? " \u00D7" + item.qty : ""}${itemSourceTagHtml(item)}</div>
        ${(rule.appliesEffects && (item.acBonus || item.attackBonus)) ? `<div class="item-effect">${item.acBonus ? formatModifier(item.acBonus) + " AC " : ""}${item.attackBonus ? formatModifier(item.attackBonus) + " Attack " : ""}</div>` : ""}
        <div class="item-meta">${rule.countsWeight ? roundWeight(weight) + " lb" : "No weight"}${container ? " \u00b7 " + contents.length + (contents.length === 1 ? " item" : " items") : ""}${container && item.ignoresContentWeight ? " \u00b7 weightless" : ""}</div>
      </div>
    </div>
    ${container && isOpen ? `<div class="pack-contents" data-pack-body="${item.id}">
      ${contents.map(inner => itemRowHtml(inner, cat, true)).join("") || `<div class="empty-hint" style="padding:8px 0 8px 22px;">Empty</div>`}
    </div>` : ""}
  `;
}

function itemTypeToggleHtml(current) {
  return `
    <div class="type-toggle">
      ${ITEM_TYPES.map(type => `
        <button class="toggle-btn ${current === type.value ? "active" : ""}" data-item-type="${type.value}">${type.label}</button>
      `).join("")}
    </div>`;
}

function commonItemFieldsHtml(item, afterName) {
  item = item || {};
  const categories = Object.keys(character.categoryRules);
  return `
    ${textFieldHtml("if-name", "Name", item.name, {
      placeholder: "e.g. Potion of Healing",
      labelExtra: `<span id="if-name-tag">${itemSourceTagHtml(item)}</span>`
    })}
    ${afterName || ""}
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

/* Everything on this sheet that a weapon could spend, or a container refill
   from: things in your bags and things on the Resources list.

   The ammunition picker used to offer `character.resources` alone, which is the
   standalone list -- so a bow could be pointed at Action Surge and not at your
   arrows. The refill picker offered every resource row including the container
   doing the asking, so a quiver was happy to refill from itself. */
function sheetSourceNames(exceptName) {
  const names = ((character.inventory || []).map(i => i.name))
    .concat((character.resources || []).map(r => r.name));
  return names
    .filter(name => name && name !== exceptName)
    .filter((name, index, all) => all.indexOf(name) === index)
    .sort();
}

function itemResourceFieldsHtml(resource, ownName) {
  resource = resource || {};
  const noMaximum = (resource.max || 0) === 0;
  return `
    ${numberFieldHtml("if-res-max", "Capacity", resource.max != null ? resource.max : 0,
      { placeholder: "0", hint: "Leave at 0 for an uncapped stack — it'll show a bare count." })}
    ${textFieldHtml("if-res-refill", "Refills From (optional)", resource.refillFrom,
      { placeholder: "e.g. Arrow" })}
    ${searchListHtml("if-res-refill-results")}
    <input type="hidden" id="if-res-refill-owner" value="${esc(ownName || "")}">
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
    ${textFieldHtml("wf-ammo", "Spends Ammunition From", weapon.ammunition, { placeholder: "None" })}
    ${searchListHtml("wf-ammo-results")}
    ${textFieldHtml("wf-source", 'Source (optional — leave blank for "Custom")', weapon.customSource)}`;
}

function wireWeaponFields(state) {
  wireSelect("wf-ability");
  wireSelect("wf-type");
  wireSegmented("wf-prof");
  wireCombo("wf-req", WEAPON_PROFICIENCY_TYPES);
  /* A name that matches nothing is left alone rather than corrected: you can
     point a bow at a stack you have not bought yet, and it starts working the
     moment you do. Nothing is written down about it either way. */
  wireSearchList("wf-ammo", "wf-ammo-results", () => sheetSourceNames(document.getElementById("if-name") ? document.getElementById("if-name").value.trim() : null));

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

/* Everything the Add Item form is currently saying, as an item. Pulled out so
   the same call can build what gets saved and, at the moment a catalogue row is
   picked, what that row would have produced untouched. */
/* Repaints the tag beside the Name field as the form changes, so changing a
   preset marks it yours the moment you do it and undoing the change takes the
   mark away again. `base` is whatever the item already carries that the form
   has no field for -- tracking, container-ness -- so editing a tracked arrow
   is not mistaken for inventing one. */
function wireLiveSourceTag(state, base) {
  const tag = document.getElementById("if-name-tag");
  const modal = document.getElementById("modal-overlay");
  if (!tag || !modal) return;
  const refresh = () => {
    tag.innerHTML = itemSourceTagHtml(Object.assign({}, base || {}, buildItemFromForm(state)));
  };
  modal.addEventListener("input", refresh);
  modal.addEventListener("change", refresh);
  refresh();
}

function buildItemFromForm(state) {
  const item = Object.assign({}, readCommonItemFields());
  const acBonus = parseInt(document.getElementById("if-ac").value) || 0;
  const attackBonus = parseInt(document.getElementById("if-atkb").value) || 0;
  if (acBonus) item.acBonus = acBonus;
  if (attackBonus) item.attackBonus = attackBonus;
  applyItemType(item, state.type, state);
  return item;
}

/* What "you changed it" means, precisely: the item this form would produce
   now, against the item it produced the moment the catalogue row was picked.

   Comparing against the catalogue row itself would flag every single pick as
   modified, because the form cannot express half of what a row carries -- its
   price, its official flag, its table.

   Quantity is excluded because buying three of something is not inventing a
   new thing. So is category: where it sits on your sheet is where you keep it,
   not what it is. stackSignature already ignores both. */
function itemDiffersFromSource(item, baseline) {
  return !!baseline && stackSignature(item) !== stackSignature(baseline);
}

/* A changed catalogue item becomes yours for good. That is the whole point:
   the next character you build picks your version out of the same search
   rather than you re-typing the same three edits. */
function rememberCustomItem(item) {
  const entry = Object.assign({}, item);
  delete entry.id;
  delete entry.qty;          // a quantity is this pile, not the thing
  entry.official = false;
  entry.type = itemType(entry);
  if (!customContent.items) customContent.items = [];
  /* Matched on what the thing is rather than on its name, now that a variant
     keeps the name it came from. Two different custom longswords are two
     entries; saving the same one twice is one. */
  if (customContent.items.some(existing => contentShape(existing) === contentShape(entry))) return false;
  entry.id = nextCustomId("items");
  customContent.items.push(entry);
  persistCustomContent();
  return true;
}

/* A catalogue row and an inventory row describe the same thing in different
   words: the catalogue also carries a price, an official flag, a table name
   and, for a pack, its shopping list. None of that is the item, and comparing
   with it left means nothing on a sheet ever matches anything in your content. */
function contentShape(entry) {
  const bones = Object.assign({}, entry);
  // the catalogue's bookkeeping, which is not the item
  delete bones.official;
  delete bones.type;
  delete bones.cost;
  delete bones.contents;
  /* And the decisions you make about your copy rather than about the thing:
     tracking a stack, turning a barrel into a container, marking a weapon as
     off-hand, or a kit deciding it starts equipped. Using half a quiver should
     not turn it into homebrew. */
  delete bones.resource;
  delete bones.isContainer;
  delete bones.ignoresContentWeight;
  delete bones.offHand;
  delete bones.isDefaultLoadout;
  /* `ammunition` names a row on *your* sheet, not a property of the bow. The
     catalogue's value is a default -- pointing yours at a quiver instead of the
     loose stack is an arrangement, the same as which pocket you keep it in. */
  delete bones.ammunition;
  /* An empty box and a field that was never there say the same thing. The form
     hands back "" for a description nobody typed, the catalogue simply has no
     description, and without this every single item read as modified the
     moment its editor was opened. */
  Object.keys(bones).forEach(key => {
    if (bones[key] === "" || bones[key] === null || bones[key] === undefined) delete bones[key];
  });
  return stackSignature(bones);
}

/* Where an item came from, worked out from the item rather than recorded on
   it. A row that matches a catalogue entry of the same name *is* that entry;
   one that does not is yours, whether you built it from scratch or changed a
   preset three sessions ago. Nothing has to be stamped on an item at the
   moment it is created for this to keep being true later -- which is what lets
   the tag appear and disappear live as you edit. */
function itemSource(item) {
  if (!item || !item.name) return null;
  const shape = contentShape(item);
  const mine = (typeof customContent !== "undefined" && customContent.items) || [];
  if (mine.some(entry => entry.name === item.name && contentShape(entry) === shape)) return "CC";

  const match = (typeof srdInventoryItems === "function" ? srdInventoryItems() : [])
    .find(entry => entry.name === item.name && contentShape(entry) === shape);
  if (!match) return "CC";
  return match.official === false ? "3PP" : "SRD";
}

/* CC always shows: knowing a thing is not official content matters whether or
   not you asked for tags. SRD and 3PP only show when you turn tags on, because
   tagging every single row "SRD" is noise on a sheet where nearly everything
   is. */
function itemSourceTagHtml(item) {
  const source = itemSource(item);
  if (!source) return "";
  const always = typeof settings !== "undefined" && settings.showSourceTags;
  if (source !== "CC" && !always) return "";
  const colour = source === "CC" ? "var(--accent-soft)" : "var(--text-dim)";
  return ` <span class="res-tag" style="background:var(--control-raised);color:${colour};">${source}</span>`;
}

function itemSearchResultsHtml(matches) {
  if (!matches.length) return "";
  return matches.map((entry, index) => `
    <div class="res-row" data-pick-item="${index}" style="cursor:pointer;">
      <div>
        <div class="res-name">${esc(entry.name)}${itemSourceTagHtml(entry)}</div>
        <div class="atk-range">${esc(itemTypeLabel(itemType(entry)))}${entry.cost ? " \u00b7 " + esc(entry.cost) : ""}</div>
      </div>
      <span class="add-link">Use</span>
    </div>
  `).join("");
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

  /* The catalogue row this form was started from, and what that row produced
     before anything was touched. Both null for an item typed from scratch,
     which is why a blank form is never "custom". */
  let pickedSource = null;
  let pickedBaseline = null;

  function pickCatalogueItem(entry) {
    pickedSource = entry;
    Object.assign(state, newItemFormState(entry));
    renderItemBody();
  }

  function startBlank() {
    pickedSource = null;
    pickedBaseline = null;
    Object.assign(state, newItemFormState());
    renderItemBody();
  }

  function renderItemBody() {
    const defaultCat = presetCategory && categories.includes(presetCategory) ? presetCategory : categories[0];
    // a catalogue row names a category this character may never have created
    const prefill = pickedSource
      ? Object.assign({}, pickedSource, {
          category: categories.includes(pickedSource.category) ? pickedSource.category : defaultCat
        })
      : { category: defaultCat };

    /* One field, not two. Typing a name searches for it; picking a result
       fills the form in and leaves the name where you were already looking.
       A separate "Search content" box above a "Name" box asked the player to
       understand the difference before they had done anything. */
    body.innerHTML = `
      ${itemTypeToggleHtml(state.type)}
      ${commonItemFieldsHtml(prefill, `<div id="item-search-results"></div>
        ${pickedSource ? `<div class="breakdown-source" style="margin:2px 0 10px;">From ${esc(pickedSource.name)} \u00b7 <span class="add-link" id="item-clear-pick">start blank</span></div>` : ""}`)}
      <div id="type-fields"></div>
      <button class="btn-primary" id="save-item-button" style="margin-top:16px;">Add Item</button>
    `;
    wireSelect("if-category");
    wireItemSearch();

    const typeFields = document.getElementById("type-fields");
    renderItemTypeFields(typeFields, state.type, pickedSource, state);
    wireItemTypeToggle(state, typeFields, pickedSource);

    const clearPick = document.getElementById("item-clear-pick");
    if (clearPick) clearPick.addEventListener("click", startBlank);
    wireLiveSourceTag(state, pickedSource ? { isContainer: pickedSource.isContainer } : null);

    // read back what the form is saying right now, before the player touches
    // it -- that is the thing "did you change it" gets measured against
    if (pickedSource) pickedBaseline = buildItemFromForm(state);

    document.getElementById("save-item-button").addEventListener("click", () => {
      const item = buildItemFromForm(state);
      // a changed catalogue row keeps its name and is marked as yours instead.
      // "Longsword (Custom)" made every variant read like a different weapon
      let kept = false;
      if (itemDiffersFromSource(item, pickedBaseline)) kept = rememberCustomItem(item);
      item.id = makeId(character.inventory);
      // the form has no field for "is a pack", so it comes off the row picked
      if (pickedSource && pickedSource.isContainer) item.isContainer = true;
      // tracking is turned on from the item's own detail view, not here

      character.inventory.push(item);
      if (item.isContainer && pickedSource) {
        const packed = expandContainerContents(character, item, pickedSource);
        if (packed.length) openInvContainers[item.id] = true;
      }
      openInvCategories[item.category] = true;
      closeModal();
      renderContent();
      if (kept) showToast(item.name + " saved to your content");
    });
  }

  function wireItemSearch() {
    const input = document.getElementById("if-name");
    const results = document.getElementById("item-search-results");
    let matches = [];
    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      matches = query
        ? allInventoryItems().filter(entry => entry.name.toLowerCase().indexOf(query) !== -1).slice(0, 8)
        : [];
      // an exact match is what you already picked; offering it back is noise
      if (matches.length === 1 && matches[0].name.toLowerCase() === query) matches = [];
      results.innerHTML = itemSearchResultsHtml(matches);
      results.querySelectorAll("[data-pick-item]").forEach(row => {
        row.addEventListener("click", () => pickCatalogueItem(matches[parseInt(row.dataset.pickItem)]));
      });
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
      <div class="modal-heading">${esc(item.name)}${itemSourceTagHtml(item)}</div>
      <button class="icon-btn-delete" id="detail-delete-trigger" title="Remove item">🗑</button>
    </div>
    ${item.description ? `<div class="effect-note">${esc(item.description)}</div>` : ""}

    <div class="breakdown-subhead">Details</div>
    ${facts.map(([label, value]) => `<div class="breakdown-row"><span>${esc(label)}</span><span>${esc(value)}</span></div>`).join("")}
    ${weaponBlock}

    <div class="btn-row-2" style="margin-top:22px;">
      <button class="btn-primary" id="detail-edit-button">Edit</button>
      ${isContainerItem(item) && containerContents(character, item).length
        ? `<button class="btn-secondary" id="detail-unpack-button">Tip Out (${containerContents(character, item).length} items)</button>` : ""}
      <button class="btn-primary" id="detail-give-button" style="background:var(--control);color:var(--accent-soft);">Give</button>
    </div>
    ${toggleLineHtml("detail-track-switch", "Track under Resources", !!item.resource,
      { hint: "For things you spend, like arrows", style: "margin-top:14px;" })}
    <div id="detail-resource-fields">${item.resource ? itemResourceFieldsHtml(item.resource, item.name) : ""}</div>
    ${item.resource ? `<button class="btn-primary" id="detail-resource-save">Save Tracking</button>` : ""}
    ${toggleLineHtml("detail-container-switch", "Turn into container", isContainerItem(item),
      { hint: "Other items can be dragged inside it" })}
    ${isContainerItem(item) ? toggleLineHtml("detail-weightless-switch", "Contents weigh nothing",
      !!item.ignoresContentWeight, { hint: "For a bag of holding, or anything else that cheats" }) : ""}
  `);

  const offHandSwitch = document.getElementById("item-offhand-switch");
  if (offHandSwitch) offHandSwitch.addEventListener("click", () => {
    item.offHand = !item.offHand;
    closeModal();
    renderContent();
    openItemDetailModal(itemId);
  });

  /* Anything can be a container: a barrel, a chest, a saddlebag, a bag of
     holding. Turning it off tips out what was inside rather than stranding it
     pointing at something that no longer holds anything. */
  const containerSwitch = document.getElementById("detail-container-switch");
  if (containerSwitch && containerSwitch.addEventListener) containerSwitch.addEventListener("click", () => {
    if (isContainerItem(item)) {
      const spilled = emptyContainer(character, item);
      delete item.isContainer;
      delete item.ignoresContentWeight;
      if (spilled.length) showToast(spilled.length + (spilled.length === 1 ? " item" : " items") + " tipped out");
    } else {
      item.isContainer = true;
      openInvContainers[item.id] = true;
    }
    closeModal();
    renderContent();
    openItemDetailModal(itemId);
  });

  const weightlessSwitch = document.getElementById("detail-weightless-switch");
  if (weightlessSwitch && weightlessSwitch.addEventListener) weightlessSwitch.addEventListener("click", () => {
    item.ignoresContentWeight = !item.ignoresContentWeight;
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
    wireSearchList("if-res-refill", "if-res-refill-results", () => sheetSourceNames(item.name));

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
  const unpackButton = document.getElementById("detail-unpack-button");
  if (unpackButton) {
    unpackButton.addEventListener("click", () => {
      const spilled = emptyContainer(character, item);
      closeModal();
      renderContent();
      showToast(spilled.length + (spilled.length === 1 ? " item" : " items") + " out of " + item.name);
    });
  }
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
  wireLiveSourceTag(state, item);

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
      removeItemAndContents(character, item);
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
