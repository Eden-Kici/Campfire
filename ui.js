/* ============================================================
   MODAL SYSTEM
   ============================================================ */

/* A screen that would lose work if it vanished (the character creator) parks a
   function here while it is open. It runs only on a *user-initiated* dismissal
   -- backdrop, handle, drag-down, X -- and returning false calls it off.
   Programmatic closeModal() stays unconditional, so one modal can always
   replace another. */
window.modalDismissGuard = null;

// whether the overlay currently on screen is the tutorial's own -- tracked
// rather than sniffed out of the DOM so closeModal() behaves identically
// under the test harness's stub, which hands back a permissive proxy for
// every lookup
let openModalIsTutorial = false;

function dismissModal() {
  if (typeof modalDismissGuard === "function" && modalDismissGuard() === false) return;
  const wasTutorial = openModalIsTutorial;
  closeModal();
  // only a *dismissal* moves the tutorial on. Programmatic closeModal() is
  // one modal replacing another, which should leave the tour alone.
  if (wasTutorial && typeof noteTutorialModalClosed === "function") noteTutorialModalClosed();
}

function openModal(mode, contentHtml) {
  closeModal();
  openModalIsTutorial = String(contentHtml).indexOf("data-tutorial-modal") !== -1;
  const phone = document.querySelector(".phone");
  const overlay = document.createElement("div");
  overlay.id = "modal-overlay";
  overlay.className = "modal-overlay modal-" + mode;
  // sheet/full slide up from the bottom and get a drag-to-dismiss handle;
  // center and drawer get a close button instead
  const showHandle = mode === "sheet" || mode === "full";

  overlay.innerHTML = `
    <div class="modal-box">
      ${showHandle ? `<div class="modal-handle"></div>` : `<button class="modal-close-x">\u2715</button>`}
      <div class="modal-content">${contentHtml}</div>
    </div>
  `;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissModal(); });
  phone.appendChild(overlay);
  phone.scrollIntoView({ block: "center" });

  if (showHandle) makeDraggable(overlay.querySelector(".modal-handle"), overlay.querySelector(".modal-box"));
  else overlay.querySelector(".modal-close-x").addEventListener("click", dismissModal);
}

function closeModal() {
  const existing = document.getElementById("modal-overlay");
  if (existing) existing.remove();
  // the guard belongs to the modal that was open, not to the app
  modalDismissGuard = null;
  openModalIsTutorial = false;
  // toasts anchor to the bottom while a modal is up, so a toast that outlives
  // the modal has to be moved back before it lands on the tab bar
  if (typeof repositionToasts === "function") repositionToasts();
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
    if (currentY > 80) { dismissModal(); boxEl.style.transform = "translateY(0)"; }
    else boxEl.style.transform = "translateY(0)";
    currentY = 0;
  });
  handleEl.addEventListener("click", () => dismissModal());
}

/* ============================================================
   CONFIRMATION
   ============================================================ */

/* The app used to ask with the browser's own confirm(), which puts the page's
   origin ("127.0.0.1:5500") above the question and styles the buttons like the
   OS, not like Campfire. It's also synchronous and modal to the whole tab,
   which a phone app can't be.

   This is deliberately NOT built on openModal(): a confirmation is nearly
   always raised from inside another modal (discard the creator, delete a
   category), and openModal() begins by closing whatever is open. So it gets
   its own overlay on its own layer, above modals and above toasts.

   Callers pass onConfirm rather than reading a return value -- the whole
   point is that nothing blocks while the player decides. */
function confirmModal(options) {
  const existing = document.getElementById("confirm-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "confirm-overlay";
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-title">${esc(options.title)}</div>
      ${options.body ? `<div class="confirm-body">${esc(options.body)}</div>` : ""}
      <div class="btn-row-2" style="margin-top:16px;">
        <button class="btn-secondary" id="confirm-cancel">${esc(options.cancelLabel || "Cancel")}</button>
        <button class="btn-primary ${options.danger ? "btn-danger" : ""}" id="confirm-ok">${esc(options.confirmLabel || "Confirm")}</button>
      </div>
    </div>
  `;
  document.querySelector(".phone").appendChild(overlay);

  const close = () => { const el = document.getElementById("confirm-overlay"); if (el) el.remove(); };
  overlay.addEventListener("click", (e) => {
    if (e.target !== overlay) return;
    close();
    if (options.onCancel) options.onCancel();
  });
  document.getElementById("confirm-cancel").addEventListener("click", () => {
    close();
    if (options.onCancel) options.onCancel();
  });
  document.getElementById("confirm-ok").addEventListener("click", () => {
    close();
    if (options.onConfirm) options.onConfirm();
  });
}

/* Same layer as confirmModal, for the same reason: an explanation is nearly
   always wanted from *inside* a form, and openModal() would close the form to
   show it. Read-only, so one dismiss button and nothing to cancel. */
function infoModal(title, body, buttonLabel) {
  const existing = document.getElementById("confirm-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "confirm-overlay";
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-title">${esc(title)}</div>
      <div class="confirm-body">${esc(body)}</div>
      <button class="btn-secondary" id="info-close" style="margin-top:16px;">${esc(buttonLabel || "Close")}</button>
    </div>
  `;
  document.querySelector(".phone").appendChild(overlay);

  const close = () => { const el = document.getElementById("confirm-overlay"); if (el) el.remove(); };
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.getElementById("info-close").addEventListener("click", close);
}

/* "Discard changes?" for any modal that is a form.

   Every edit form in the app could be dismissed by dragging the handle, tapping
   the backdrop or hitting the X, and the edit vanished without a word. The
   creator already guarded itself this way; this generalises it so a form only
   has to say that it *is* a form.

   Dirtiness is decided by comparing a signature of the modal's controls at open
   against the same signature at dismiss, rather than by asking each form to
   describe its own fields -- one line per call site instead of a bespoke
   comparison per form, and it can't drift when a field is added.

   Under the test harness querySelectorAll returns [], so the signature is
   constant and the guard never fires. That's correct: there is no drag, no
   backdrop and no unsaved work in a test. */
function modalFieldSignature() {
  const modal = document.getElementById("modal-overlay");
  if (!modal || !modal.querySelectorAll) return "";
  const values = [];
  modal.querySelectorAll("input, textarea").forEach(el => values.push(el.value));
  modal.querySelectorAll(".toggle-line.on, .toggle-btn.active, .mini-checkbox.checked, .prop-row.on")
    .forEach(el => values.push(el.className));
  return values.join("\u0001");
}

function guardModalEdits(options) {
  options = options || {};
  const initial = modalFieldSignature();
  modalDismissGuard = () => {
    if (modalFieldSignature() === initial) return true;
    confirmModal({
      title: options.title || "Discard changes?",
      body: options.body || "Your edits to this form will be lost.",
      confirmLabel: "Discard",
      danger: true,
      onConfirm: () => { modalDismissGuard = null; closeModal(); }
    });
    return false;
  };
}

/* Most breakdown rows are bonuses and want a sign. Some are not: the AC
   breakdown's first row is the armour's base value, and it read "Chain Shirt
   +13" -- a false statement inside the app's best feature. A source can now say
   it is a plain quantity, and the sign is only added where a sign is true.

   `suffix` exists for the same reason: weight rows are pounds, not modifiers. */
/* One item-detail body, used everywhere an item explains itself.

   The character creator grew its own version of this with its own hand-written
   descriptions, which meant two answers to "what is a Priest's Pack" and a
   player who saw less in the creator than in the library. Everything that
   describes an item now renders through here, so the equipment step, the
   content browser and anything later all show the same facts. */
function itemFactsHtml(item) {
  const kind = itemType(item);
  return `
    ${item.official === false ? `<div class="breakdown-source" style="margin-bottom:6px;">Third-party (not core SRD)</div>` : ""}
    ${item.description ? `<div class="trait-desc" style="margin:6px 0 12px;">${esc(item.description)}</div>` : ""}
    ${item.weight != null ? `<div class="breakdown-row"><span>Weight</span><span>${item.weight} lb</span></div>` : ""}
    ${item.cost ? `<div class="breakdown-row"><span>Cost</span><span>${esc(item.cost)}</span></div>` : ""}
    ${item.rarity ? `<div class="breakdown-row"><span>Rarity</span><span>${esc(item.rarity)}</span></div>` : ""}
    ${item.rarity ? `<div class="breakdown-row"><span>Attunement</span><span>${item.attunement ? "Required" : "Not required"}</span></div>` : ""}
    ${kind === "weapon" ? `
      <div class="breakdown-row"><span>Attack Ability</span><span>${esc(item.attackAbility)}</span></div>
      <div class="breakdown-row"><span>Attack Type</span><span>${item.weaponType === "ranged" ? "Ranged" : "Melee"}</span></div>
      <div class="breakdown-row"><span>Range</span><span>${esc(item.range || "\u2014")}</span></div>
      <div class="breakdown-row"><span>Proficiency</span><span>${esc(item.proficiencyRequired || "None")}</span></div>
      ${(item.damage || []).map(d => `<div class="breakdown-row"><span>Damage</span><span>${esc(d.dice)} ${esc(d.type)}</span></div>`).join("")}
      ${item.properties && item.properties.length ? `<div class="item-effect" style="margin-top:6px;">${esc(item.properties.join(", "))}</div>` : ""}
    ` : ""}
    ${kind === "armour" ? `
      <div class="breakdown-row"><span>Base AC</span><span>${item.armour.base}</span></div>
      <div class="breakdown-row"><span>Armour Type</span><span>${esc((ARMOUR_KINDS.find(k => k.value === item.armour.kind) || {}).label || item.armour.kind)}</span></div>
      <div class="breakdown-row"><span>Max Dexterity Bonus</span><span>${item.armour.dexCap == null ? "No limit" : item.armour.dexCap}</span></div>
    ` : ""}`;
}

function breakdownRowsHtml(sources) {
  return sources.map(s => {
    const value = s.plain ? s.value : formatModifier(s.value);
    return `<div class="breakdown-row ${s.heading ? "breakdown-row-heading" : ""}"><span>${esc(s.label)}</span><span>${esc(String(value) + (s.suffix || ""))}</span></div>`;
  }).join("");
}

function openBreakdownModal(title, total, suffix, sources, rollButton) {
  openModal("center", `
    <div class="breakdown-title">${esc(title)}</div>
    ${breakdownRowsHtml(sources)}
    <hr class="breakdown-divider">
    <div class="breakdown-total"><span>Total</span><span>${total}${suffix || ""}</span></div>
    ${rollButton ? `<button class="btn-primary" id="breakdown-roll-btn" style="margin-top:14px;">Roll ${esc(rollButton.label)}</button>` : ""}
  `);
  if (rollButton) document.getElementById("breakdown-roll-btn").addEventListener("click", () =>
    showRoll({ label: rollButton.label, notation: rollButton.notation, sources, kind: rollButton.kind || "check", ability: rollButton.ability }));
}

/* ============================================================
   FORM PRIMITIVES

   A field is a label above a control, and the app has sixty-odd of them. Half
   were already components -- selects and combos had to be, because they
   replace native controls with real behaviour -- and half were hand-written
   markup repeated at every call site. That split is how one field ends up
   without an esc() around its value, or with a different margin than the one
   next to it, and nobody notices until it's on screen.

   So the plain ones get built here too. Escaping stops being a thing anyone
   has to remember, and what a field looks like is one edit rather than sixty.

   `opts` carries the occasional extra: a placeholder, a note under the
   control, an inline style for fields that size themselves inside a row.
   ============================================================ */

/* `labelExtra` is raw markup rather than text, and is the one thing in here
   that is not escaped for you -- it exists so a field can carry a tag beside
   its label, and a tag is markup. Callers pass output from a tag builder, not
   anything a player typed. */
function fieldHtml(label, inner, opts) {
  const { style, hint, className, labelExtra } = opts || {};
  return `<div class="field${className ? " " + className : ""}"${style ? ` style="${style}"` : ""}>` +
    (label ? `<label>${esc(label)}${labelExtra || ""}</label>` : "") +
    inner +
    (hint ? `<div class="field-hint">${esc(hint)}</div>` : "") +
    "</div>";
}

// a label with no control under it, used to title the blocks that build
// themselves -- damage rows, properties, the effects list
function fieldLabelHtml(label, opts) {
  return fieldHtml(label, "", opts);
}

function textFieldHtml(id, label, value, opts) {
  const { placeholder, maxlength, inputmode } = opts || {};
  return fieldHtml(label, `<input id="${id}" type="text" value="${esc(value == null ? "" : value)}"` +
    (placeholder ? ` placeholder="${esc(placeholder)}"` : "") +
    (maxlength ? ` maxlength="${maxlength}"` : "") +
    (inputmode ? ` inputmode="${inputmode}"` : "") + ">", opts);
}

/* Numbers are kept as text on the way in and parsed on the way out, so an
   empty box stays empty rather than becoming a zero -- several fields here
   mean "no limit" when blank. */
function numberFieldHtml(id, label, value, opts) {
  const { placeholder, min, max } = opts || {};
  return fieldHtml(label, `<input id="${id}" type="number" value="${esc(value == null ? "" : value)}"` +
    (min !== undefined ? ` min="${min}"` : "") +
    (max !== undefined ? ` max="${max}"` : "") +
    (placeholder ? ` placeholder="${esc(placeholder)}"` : "") + ">", opts);
}

function textAreaFieldHtml(id, label, value, opts) {
  const { placeholder, large } = opts || {};
  return fieldHtml(label, `<textarea id="${id}"${large ? ` class="field-textarea-lg"` : ""}` +
    (placeholder ? ` placeholder="${esc(placeholder)}"` : "") + `>${esc(value == null ? "" : value)}</textarea>`, opts);
}

/* A switch with its label. `on` is the starting state; the caller wires the
   click, because what a toggle does varies far more than how it looks.

   `note` is a short aside on the same line, `hint` a second line beneath. Both
   are escaped, so neither is a way to smuggle markup back in. */
function toggleLineHtml(id, label, on, opts) {
  const { note, hint, style } = opts || {};
  return `<div class="toggle-line"${style ? ` style="${style}"` : ""}>` +
    `<span>${esc(label)}` +
      (note ? ` <span class="field-hint inline">${esc(note)}</span>` : "") +
      (hint ? `<div class="field-hint">${esc(hint)}</div>` : "") +
    "</span>" +
    `<div class="switch ${on ? "on" : ""}" id="${id}"><div class="knob"></div></div>` +
    "</div>";
}

/* An in-app replacement for <input type="checkbox">, which renders as a
   bare, unstyled OS control -- same reasoning as selectFieldHtml below. It's
   a button carrying data attributes, so an existing click listener on
   data-whatever="value" keeps working; only the tag and the "checked" class
   change. `disabled` greys it out and drops the pointer, same meaning as the
   native attribute. */
/* A <span>, not a <button>, deliberately.

   This used to be a <button>, and the property picker nested it inside another
   <button> -- invalid HTML that Chromium tolerates and every other engine does
   not. A spec-compliant parser auto-closes the outer button, so the row broke
   into three stacked siblings and the label fell outside the tap target. It was
   only ever driven by a click listener anyway, so it gains nothing from being a
   real control and can't be nested wrongly as a span.

   `disabled` is a class rather than an attribute now, so every listener has to
   check it -- a span ignores the attribute. */
function miniCheckboxHtml(dataAttr, value, checked, disabled) {
  return `<span role="checkbox" tabindex="0" aria-checked="${checked ? "true" : "false"}"` +
    ` class="mini-checkbox ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}"` +
    ` data-${dataAttr}="${esc(value)}"></span>`;
}

// every mini-checkbox listener goes through this, because `disabled` stopped
// being an attribute the browser enforces when the element stopped being a button
function miniCheckboxBlocked(el) {
  return el.classList.contains("disabled");
}

/* Three-or-so mutually exclusive choices, side by side. The app already had
   this shape in the item type toggle; giving it a name means "pick one of a
   short fixed set" stops being spelled as a dropdown in some places and a
   segmented control in others. */
function segmentedFieldHtml(id, label, options, value) {
  const items = options.map(o => (typeof o === "string" ? { value: o, label: o } : o));
  const selected = items.find(i => i.value === value) || items[0];
  return fieldHtml(label, `
    <input type="hidden" id="${id}" value="${esc(selected.value)}">
    <div class="type-toggle" data-segmented-for="${id}">
      ${items.map(i => `<button type="button" class="toggle-btn ${i.value === selected.value ? "active" : ""}" data-segment="${esc(i.value)}">${esc(i.label)}</button>`).join("")}
    </div>`);
}

/* Writes the hidden input and fires "change", so a segmented field is a drop-in
   for selectFieldHtml everywhere that reads `.value` or listens for change. */
function wireSegmented(id) {
  const wrap = document.querySelector(`[data-segmented-for="${id}"]`);
  if (!wrap) return;
  const input = document.getElementById(id);
  wrap.querySelectorAll("[data-segment]").forEach(button => {
    button.addEventListener("click", () => {
      input.value = button.dataset.segment;
      wrap.querySelectorAll("[data-segment]").forEach(other =>
        other.classList.toggle("active", other === button));
      input.dispatchEvent(new Event("change"));
    });
  });
}

/* An in-app replacement for <select>, which renders as an OS picker on mobile.

   It keeps a hidden <input> carrying the real id, so everything that already
   reads `getElementById(id).value` or listens for "change" keeps working
   untouched -- picking an option writes the input and dispatches a change
   event by hand. That makes converting the remaining native selects a
   markup-only job. */
function selectFieldHtml(id, label, options, value) {
  const items = options.map(option => (typeof option === "string" ? { value: option, label: option } : option));
  const selected = items.find(item => item.value === value) || items[0];

  return fieldHtml(label, `
      <div class="select" data-select="${id}">
        <input type="hidden" id="${id}" value="${esc(selected ? selected.value : "")}">
        <button type="button" class="select-trigger">
          <span class="select-value">${esc(selected ? selected.label : "")}</span>
          <span class="select-caret">⌄</span>
        </button>
        <div class="select-list" hidden>
          ${items.map(item => `
            <button type="button" class="select-option ${selected && item.value === selected.value ? "active" : ""}${item.disabled ? " disabled" : ""}" data-value="${esc(item.value)}"${item.disabled ? " disabled" : ""}>${esc(item.label)}</button>
          `).join("")}
        </div>
      </div>`);
}

function wireSelect(id) {
  const wrap = document.querySelector(`[data-select="${id}"]`);
  if (!wrap) return;
  const input = document.getElementById(id);
  const trigger = wrap.querySelector(".select-trigger");
  const list = wrap.querySelector(".select-list");

  trigger.addEventListener("click", () => {
    const opening = list.hidden;
    document.querySelectorAll(".select-list").forEach(other => { other.hidden = true; });
    list.hidden = !opening;
  });

  list.querySelectorAll(".select-option").forEach(option => {
    option.addEventListener("click", () => {
      // an option that would do nothing says so by being unavailable, rather
      // than by being pickable and then explained away in a warning underneath
      if (option.classList.contains("disabled")) return;
      input.value = option.dataset.value;
      wrap.querySelector(".select-value").textContent = option.textContent.trim();
      list.querySelectorAll(".select-option").forEach(other => other.classList.toggle("active", other === option));
      list.hidden = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function wireSelectsIn(root) {
  (root || document).querySelectorAll("[data-select]").forEach(wrap => wireSelect(wrap.dataset.select));
}

// Sets a selectFieldHtml control's value from code rather than a click --
// for auto-fill flows (picking a known spell prefills several fields at
// once; see tab-spells.js's SRD picker) where nothing was actually clicked.
// Mirrors wireSelect's own option-click handler so the hidden input, the
// visible label and the "active" option all stay in sync the way a real
// click would leave them.
function setSelectValue(id, value) {
  const wrap = document.querySelector(`[data-select="${id}"]`);
  if (!wrap) return;
  const input = document.getElementById(id);
  const option = Array.from(wrap.querySelectorAll(".select-option")).find(o => o.dataset.value === String(value));
  if (!option) return;
  input.value = value;
  wrap.querySelector(".select-value").textContent = option.textContent.trim();
  wrap.querySelectorAll(".select-option").forEach(o => o.classList.toggle("active", o === option));
}

/* A text field with its own suggestion list. Replaces <datalist>, which renders
   as an OS-native dropdown -- fine on desktop, wrong for something that ships
   as a mobile app. Free text still wins, so non-SRD names work. The list sits
   in normal flow rather than floating, so it can't be clipped by a modal. */
function comboFieldHtml(id, label, placeholder, value) {
  return `
    <div class="field combo">
      <label>${esc(label)}</label>
      <input id="${id}" autocomplete="off" placeholder="${esc(placeholder)}" value="${esc(value || "")}">
      <div class="combo-list" id="${id}-list" hidden></div>
    </div>`;
}

function wireCombo(id, options, onChange) {
  const input = document.getElementById(id);
  const list = document.getElementById(id + "-list");
  if (!input || !list) return;
  const announce = () => { if (onChange) onChange(input.value.trim()); };

  function draw() {
    const query = input.value.trim().toLowerCase();
    const matches = options.filter(option => option.toLowerCase().includes(query));
    list.innerHTML = matches.length
      ? matches.map(option => `<button type="button" class="combo-option" data-pick="${esc(option)}">${esc(option)}</button>`).join("")
      : `<div class="combo-empty">No match — "${esc(input.value.trim())}" will be used as a custom entry</div>`;

    // pointerdown fires before the input loses focus, on both touch and mouse
    list.querySelectorAll("[data-pick]").forEach(button => {
      button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        input.value = button.dataset.pick;
        list.hidden = true;
        announce();
      });
    });
  }

  input.addEventListener("focus", () => { draw(); list.hidden = false; });
  input.addEventListener("input", () => { draw(); announce(); });
  input.addEventListener("blur", () => setTimeout(() => { list.hidden = true; }, 150));
}

/* The condition field reveals a level input when what you've typed is
   exhaustion, and hides it again otherwise. It's the only condition with
   degrees, so a permanent "Level" box on every condition would be noise. */
/* The one list the app uses for "type a name, pick from what matches". Add
   Item, the effect editor's Name and a Condition modifier all use it, because
   three different ways of picking a thing off a list is three things to learn.

   It sits under the field and pushes the form down rather than floating over
   it: a dropdown is fine under a mouse and a poor target for a thumb. Nothing
   shows until you type, and an exact match disappears, because offering back
   the thing you just picked is noise. */
/* Spell slots as pips rather than a fraction. "Three of four" is something you
   read; three filled boxes out of four is something you see, which is why every
   game with a slot economy draws them this way.

   A pip is tappable: a filled one spends, an empty one gives it back. Slots
   above your maximum -- a feature that hands you an extra -- get their own mark
   rather than being lost, because the app lets counts run past the ceiling
   everywhere else too. */
function spellSlotPipsHtml(slot, level) {
  const max = Math.max(0, slot.max || 0);
  const current = Math.max(0, slot.current || 0);
  const shown = Math.min(current, max);
  const spare = Math.max(0, current - max);

  let pips = "";
  for (let i = 0; i < max; i++) {
    pips += `<button class="slot-pip${i < shown ? " filled" : ""}" data-slot-pip="${level}" data-pip-filled="${i < shown ? 1 : 0}" aria-label="Slot ${i + 1}"></button>`;
  }
  for (let i = 0; i < spare; i++) {
    pips += `<button class="slot-pip filled extra" data-slot-pip="${level}" data-pip-filled="1" aria-label="Extra slot"></button>`;
  }
  if (!max && !spare) pips = `<span class="slot-pip-none">none</span>`;
  return `<span class="slot-pips" title="${current}/${max}">${pips}</span>`;
}

/* A pip spends or restores the slot it stands for. stopPropagation because in
   the Spells tab these sit inside the level header, which is itself a toggle --
   without it, spending a slot also collapsed the list you were looking at. */
function wireSlotPips(root) {
  (root || document).querySelectorAll("[data-slot-pip]").forEach(pip => {
    pip.addEventListener("click", (event) => {
      event.stopPropagation();
      const slot = character.spellSlots[pip.dataset.slotPip];
      if (!slot) return;
      slot.current += pip.dataset.pipFilled === "1" ? -1 : 1;
      renderContent();
    });
  });
}

function usingVisualSlots() {
  return typeof settings === "undefined" || settings.visualSpellSlots !== false;
}

function searchListHtml(id) {
  return `<div class="search-list" id="${id}"></div>`;
}

function wireSearchList(inputId, listId, optionsFor, onChange) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) return;

  function redraw() {
    const query = input.value.trim().toLowerCase();
    let matches = query
      ? optionsFor().filter(name => String(name).toLowerCase().indexOf(query) !== -1)
      : [];
    if (matches.length === 1 && String(matches[0]).toLowerCase() === query) matches = [];

    list.innerHTML = matches.slice(0, 8).map(name => `
      <div class="res-row" data-search-pick="${esc(name)}" style="cursor:pointer;">
        <div class="res-name">${esc(name)}</div>
        <span class="add-link">Use</span>
      </div>
    `).join("");

    list.querySelectorAll("[data-search-pick]").forEach(row => {
      row.addEventListener("click", () => {
        input.value = row.dataset.searchPick;
        list.innerHTML = "";
        if (onChange) onChange(input.value);
      });
    });
  }

  input.addEventListener("input", () => { redraw(); if (onChange) onChange(input.value); });
  redraw();
}

function wireConditionField(idPrefix, existingValue) {
  const extra = document.getElementById(idPrefix + "-condition-extra");
  if (!extra) return;
  const input = document.getElementById(idPrefix + "-condition");
  const results = document.getElementById(idPrefix + "-condition-results");

  function reveal(condition) {
    const isExhaustion = String(condition).trim().toLowerCase() === "exhaustion";
    if (!isExhaustion) { extra.innerHTML = ""; return; }
    if (document.getElementById(idPrefix + "-condition-level")) return;   // already shown

    const level = existingValue && existingValue.level ? existingValue.level : 1;
    extra.innerHTML = numberFieldHtml(idPrefix + "-condition-level", "Exhaustion Level", level,
      { min: 1, max: 6 });
  }

  if (!input || !results) return;
  wireSearchList(idPrefix + "-condition", idPrefix + "-condition-results", () => ALL_CONDITIONS, reveal);
  if (existingValue && existingValue.condition) reveal(existingValue.condition);
}

/* `existingValue` (an effect's current .value, when there is one) is what
   lets the Amount field render as a tier list from the start when it's
   already scaling -- prefillEffectSubfields can set a plain input's value
   after the fact, but it can't retroactively turn a number field into a
   tier list, so the amount fields below need to know up front. */
function effectSubfieldsHtml(category, idPrefix, existingValue) {
  if (category === "Condition") {
    /* The same list Add Item uses. A dropdown that appears over the form is
       fine with a mouse and awkward with a thumb; a list that pushes the form
       down is one you can see and hit. */
    return textFieldHtml(idPrefix + "-condition", "Condition", "",
        { placeholder: "Type to search, or write your own" }) +
      searchListHtml(idPrefix + "-condition-results") +
      `<div id="${idPrefix}-condition-extra"></div>`;
  }
  if (category === "Advantage") {
    return `<div class="field-row">
      ${selectFieldHtml(idPrefix + "-rolltype", "Applies To", ROLL_TYPES)}
      ${selectFieldHtml(idPrefix + "-mode", "Effect", [
        { value: "advantage", label: "Advantage" },
        { value: "disadvantage", label: "Disadvantage" }
      ])}
    </div>`;
  }
  if (category === "Ability Score" || category === "Saving Throw") {
    // a saving throw effect can cover the lot; an ability score cannot
    const abilities = category === "Saving Throw"
      ? ["All"].concat(Object.keys(ABILITY_FULL_NAMES))
      : Object.keys(ABILITY_FULL_NAMES);
    return selectFieldHtml(idPrefix + "-ability", "Ability", abilities) +
      scalingValueFieldsHtml(idPrefix + "-amount", (existingValue && existingValue.amount !== undefined) ? existingValue.amount : -2, "Amount");
  }
  if (category === "Skill") {
    return selectFieldHtml(idPrefix + "-skill", "Skill", Object.keys(character.skillAbilityMap)) +
      scalingValueFieldsHtml(idPrefix + "-amount", (existingValue && existingValue.amount !== undefined) ? existingValue.amount : 2, "Amount");
  }
  if (category === "Reroll") {
    return `<div class="field-row">
      ${selectFieldHtml(idPrefix + "-rolltype", "Applies To", REROLL_ROLL_TYPES)}
      ${numberFieldHtml(idPrefix + "-threshold", "Reroll At Or Below", 1, { min: 1, max: 19, hint: "e.g. 1 rerolls a 1; 2 rerolls a 1 or 2" })}
    </div>`;
  }
  return selectFieldHtml(idPrefix + "-stat", "Stat", MODIFIER_STATS) +
    scalingValueFieldsHtml(idPrefix + "-amount", (existingValue && existingValue.amount !== undefined) ? existingValue.amount : 1, "Amount");
}

// `existingValue` (the effect's value before this read) tells the amount
// field whether it's currently rendered as a tier list or a plain number --
// same reason effectSubfieldsHtml needs it on the way in.
function readEffectValueFromForm(category, idPrefix, existingValue) {
  if (category === "Condition") {
    const condition = document.getElementById(idPrefix + "-condition").value.trim();
    const value = { condition };
    // exhaustion is the one condition with degrees
    const levelField = document.getElementById(idPrefix + "-condition-level");
    if (levelField) value.level = Math.max(1, Math.min(6, parseInt(levelField.value) || 1));
    return value;
  }
  if (category === "Advantage") {
    return {
      rollType: document.getElementById(idPrefix + "-rolltype").value,
      mode: document.getElementById(idPrefix + "-mode").value
    };
  }
  const amount = () => syncScalingValueFields(idPrefix + "-amount", (existingValue && existingValue.amount !== undefined) ? existingValue.amount : 0);
  if (category === "Ability Score" || category === "Saving Throw") {
    return { ability: document.getElementById(idPrefix + "-ability").value, amount: amount() };
  }
  if (category === "Skill") {
    return { skill: document.getElementById(idPrefix + "-skill").value, amount: amount() };
  }
  if (category === "Reroll") {
    return { rollType: document.getElementById(idPrefix + "-rolltype").value, threshold: Math.max(1, parseInt(document.getElementById(idPrefix + "-threshold").value) || 1) };
  }
  return { stat: document.getElementById(idPrefix + "-stat").value, amount: amount() };
}

function prefillEffectSubfields(eff, idPrefix) {
  if (!eff.value) return;
  // "amount" is handled at render time (effectSubfieldsHtml takes the
  // existing value directly) since a scaling amount is a tier list, not a
  // single input a value can be poked into after the fact
  const map = { ability: "-ability", skill: "-skill", stat: "-stat", condition: "-condition",
                rollType: "-rolltype", mode: "-mode", threshold: "-threshold" };
  Object.keys(map).forEach(key => {
    if (eff.value[key] === undefined) return;
    const id = idPrefix + map[key];
    /* Most of these are the app's own select, where the value lives in a
       hidden input and the label the player reads is a separate span. Setting
       only the input left an effect on +1d4 Attack Rolls showing "AC" the
       moment you opened it to edit -- a wrong answer that saves itself if you
       touch anything else on the row. setSelectValue moves both; a plain
       input (the condition picker) still takes the direct assignment. */
    if (document.querySelector(`[data-select="${id}"]`)) { setSelectValue(id, eff.value[key]); return; }
    const el = document.getElementById(id);
    if (el) el.value = eff.value[key];
  });
}

// only "SR" and "LR" are understood by the rest system. anything custom is the
// player's to track, so the form says so plainly at the point of choosing it.
function rechargeCustomFieldHtml(idPrefix, value) {
  return `
    ${textFieldHtml(idPrefix + "-tag-custom", "Custom Label", value, { placeholder: "e.g. Per Day" })}
    <div class="form-warning">Custom recharges aren't restored by a Short or Long Rest \u2014 you'll need to reset this one yourself.</div>
  `;
}

/* `opts.noMaximum` means this resource has no capacity to restore to -- an
   uncapped stack. "All" and "Half" are proportions of a maximum, so with no
   maximum they are not choices that do the wrong thing, they are not choices
   at all. Greyed out rather than explained: the control says what is possible,
   which is what a control is for. */
function rechargeFieldHtml(idPrefix, recharge, opts) {
  opts = opts || {};
  recharge = recharge || { on: "SR", amount: "all" };
  const known = ["SR", "LR", "none"];
  const isKnown = known.includes(recharge.on);
  const selectedOn = isKnown ? (recharge.on === "none" ? "None" : recharge.on) : "Custom";
  const amount = recharge.amount === undefined ? "all" : recharge.amount;
  const amountType = (amount === "all" || amount === "half") ? amount : "custom";

  return `
    <div class="field-row">
      ${selectFieldHtml(idPrefix + "-tag-type", "Recharges", [
        { value: "SR", label: "Short Rest" },
        { value: "LR", label: "Long Rest" },
        { value: "None", label: "Doesn't Recharge" },
        { value: "Custom", label: "Custom" }
      ], selectedOn)}
      ${selectFieldHtml(idPrefix + "-amount-type", "Restores", [
        { value: "all", label: "All", disabled: opts.noMaximum },
        { value: "half", label: "Half", disabled: opts.noMaximum },
        { value: "custom", label: "Custom" }
      ], opts.noMaximum && amountType !== "custom" ? "custom" : amountType)}
    </div>
    <div id="${idPrefix}-amount-custom-wrap">
      ${amountType === "custom" || opts.noMaximum ? rechargeAmountFieldHtml(idPrefix, amount) : ""}
    </div>
    <div id="${idPrefix}-tag-custom-wrap">
      ${selectedOn === "Custom" ? rechargeCustomFieldHtml(idPrefix, isKnown ? "" : recharge.on) : ""}
    </div>
  `;
}

function rechargeAmountFieldHtml(idPrefix, amount) {
  const value = (amount === "all" || amount === "half") ? "" : amount;
  return textFieldHtml(idPrefix + "-amount-custom", "How Much", value,
    { placeholder: "a number, or dice like 1d4" });
}

function wireRechargeField(idPrefix) {
  wireSelect(idPrefix + "-tag-type");
  wireSelect(idPrefix + "-amount-type");

  const onSelect = document.getElementById(idPrefix + "-tag-type");
  const onWrap = document.getElementById(idPrefix + "-tag-custom-wrap");
  onSelect.addEventListener("change", () => {
    onWrap.innerHTML = onSelect.value === "Custom" ? rechargeCustomFieldHtml(idPrefix, "") : "";
  });

  const amountSelect = document.getElementById(idPrefix + "-amount-type");
  const amountWrap = document.getElementById(idPrefix + "-amount-custom-wrap");
  amountSelect.addEventListener("change", () => {
    amountWrap.innerHTML = amountSelect.value === "custom" ? rechargeAmountFieldHtml(idPrefix, "") : "";
  });
}

function readRechargeValue(idPrefix) {
  const onType = document.getElementById(idPrefix + "-tag-type").value;
  let on = onType;
  if (onType === "None") on = "none";
  else if (onType === "Custom") {
    const input = document.getElementById(idPrefix + "-tag-custom");
    on = input && input.value.trim() ? input.value.trim() : "Custom";
  }

  const amountType = document.getElementById(idPrefix + "-amount-type").value;
  let amount = amountType;
  if (amountType === "custom") {
    const input = document.getElementById(idPrefix + "-amount-custom");
    const raw = input ? input.value.trim() : "";
    // a recharge restores; a negative amount would drain, which is never wanted
    amount = raw === "" ? "all" : (/^\d+$/.test(raw) ? Math.max(0, parseInt(raw)) : raw.replace(/^-/, ""));
  }

  return { on, amount };
}


/* ============================================================
   SCALING VALUE FIELD

   A number that's either flat (the common case) or scales by character
   level -- a resource's max uses, an effect's bonus amount. Same shape
   resolveScalingValue()/effectAmount()/effectiveResourceMax() (character-
   data.js) read: a plain number, or { tiers: [{level, value}, ...] }.

   The toggle swaps between a single number field and a repeatable list of
   level breakpoints, the same "toggle reveals a different body" pattern the
   race form's skill-choice switch already uses. `accessor` is how it reads
   and writes wherever the value actually lives -- this widget has no idea
   whether that's a feature's resource.max or an effect's value.amount, and
   doesn't need to.
   ============================================================ */

function scalingValueBodyHtml(idPrefix, value) {
  const scaling = value && typeof value === "object" && Array.isArray(value.tiers);
  if (!scaling) {
    return textFieldHtml(idPrefix + "-flat", "Amount",
      typeof value === "number" || typeof value === "string" ? value : 1,
      { hint: "A number, or dice like 1d4" });
  }
  return `
    ${value.tiers.map((t, i) => `
      <div class="field-row" data-tier-row="${i}">
        ${numberFieldHtml(idPrefix + "-tier-" + i + "-level", "At Level", t.level, { min: 1, max: 20 })}
        ${numberFieldHtml(idPrefix + "-tier-" + i + "-value", "Becomes", t.value)}
        <button type="button" class="chip-remove" data-tier-remove="${i}" style="align-self:center;margin-top:18px;">✕</button>
      </div>
    `).join("")}
    <button type="button" class="add-link" data-tier-add="1">+ Add Level Breakpoint</button>
  `;
}

function scalingValueFieldsHtml(idPrefix, value, label) {
  const scaling = value && typeof value === "object" && Array.isArray(value.tiers);
  return `
    ${toggleLineHtml(idPrefix + "-scaleon", (label || "Amount") + " scales by level", scaling)}
    <div id="${idPrefix}-body">${scalingValueBodyHtml(idPrefix, value)}</div>
  `;
}

// reads whatever's currently on screen back into the value shape, given a
// hint of which mode it's in (a fresh render always knows; a caller mid-edit
// passes the mode it last rendered)
function readScalingValueFromForm(idPrefix, wasScaling, tierCount) {
  if (!wasScaling) {
    const flatEl = document.getElementById(idPrefix + "-flat");
    if (!flatEl) return 0;
    const raw = String(flatEl.value).trim().toLowerCase();
    // kept as text when it is dice: "1d4" is rolled, not added
    if (/^\d{0,2}d\d{1,3}$/.test(raw)) return raw;
    return parseInt(raw) || 0;
  }
  const tiers = [];
  for (let i = 0; i < tierCount; i++) {
    const lvlEl = document.getElementById(idPrefix + "-tier-" + i + "-level");
    if (!lvlEl) continue;
    tiers.push({ level: parseInt(lvlEl.value) || 1, value: parseInt(document.getElementById(idPrefix + "-tier-" + i + "-value").value) || 0 });
  }
  return { tiers };
}

// used at outer save/sync time -- resolves the current on-screen value with
// no live accessor needed, the same "read every field back" pattern
// syncFeatureList (content.js) already uses for the rest of a feature row
function syncScalingValueFields(idPrefix, currentValue) {
  const scaling = currentValue && typeof currentValue === "object" && Array.isArray(currentValue.tiers);
  return readScalingValueFromForm(idPrefix, scaling, scaling ? currentValue.tiers.length : 0);
}

function wireScalingValueFields(idPrefix, accessor) {
  const switchEl = document.getElementById(idPrefix + "-scaleon");
  const bodyEl = document.getElementById(idPrefix + "-body");
  if (!switchEl || !bodyEl) return;

  function redraw() {
    const value = accessor.get();
    const scaling = value && typeof value === "object" && Array.isArray(value.tiers);
    switchEl.classList.toggle("on", scaling);
    bodyEl.innerHTML = scalingValueBodyHtml(idPrefix, value);
    wireBody();
  }

  function wireBody() {
    const value = accessor.get();
    const scaling = value && typeof value === "object" && Array.isArray(value.tiers);
    if (!scaling) return;
    bodyEl.querySelectorAll("[data-tier-remove]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tiers = readScalingValueFromForm(idPrefix, true, value.tiers.length).tiers;
        tiers.splice(parseInt(btn.dataset.tierRemove), 1);
        accessor.set({ tiers });
        redraw();
      });
    });
    const addBtn = bodyEl.querySelector("[data-tier-add]");
    if (addBtn) addBtn.addEventListener("click", () => {
      const tiers = readScalingValueFromForm(idPrefix, true, value.tiers.length).tiers;
      const lastLevel = tiers.length ? tiers[tiers.length - 1].level : 0;
      tiers.push({ level: Math.min(20, lastLevel + 1), value: 0 });
      accessor.set({ tiers });
      redraw();
    });
  }

  switchEl.addEventListener("click", () => {
    const value = accessor.get();
    const scaling = value && typeof value === "object" && Array.isArray(value.tiers);
    if (scaling) {
      // collapsing back to flat keeps the highest tier's value -- what it was
      // worth eventually is a more useful starting point than what it started at
      const tiers = readScalingValueFromForm(idPrefix, true, value.tiers.length).tiers;
      accessor.set(tiers.length ? tiers.sort((a, b) => b.level - a.level)[0].value : 0);
    } else {
      const flat = readScalingValueFromForm(idPrefix, false, 0);
      accessor.set({ tiers: [{ level: 1, value: flat }] });
    }
    redraw();
  });

  wireBody();
}


/* ============================================================
   GENERIC TOAST (non-roll messages)
   ============================================================ */

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "roll-toast";
  toast.innerHTML = `<div class="roll-toast-value" style="font-size:15px;">${esc(message)}</div>`;
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

/* Swiping between tabs.

   Two things have to be true before a sideways drag counts, and both are about
   not stealing a gesture that meant something else. It has to be clearly
   sideways rather than merely not-quite-vertical, or ordinary scrolling would
   flip tabs constantly. And a hold-drag in progress suppresses it outright:
   dragging an item across the screen must not also change the tab out from
   under it.

   Nothing wraps. Swiping past Notes does nothing, because arriving back at
   Combat from the far end is disorienting when the tab bar is right there
   showing you where the ends are. */
const SWIPE_MIN_X = 60;
const SWIPE_SIDEWAYS_RATIO = 1.5;

/* The tab bar's markup carries only the word; the mark is put in from here at
   boot, so index.html and icons.js don't hold two copies of the same six
   paths that can drift apart. */
function drawTabIcons() {
  document.querySelectorAll(".tab-item").forEach(button => {
    const label = button.textContent.trim();
    button.innerHTML = iconSvg("tab-" + button.dataset.tab) + "<span>" + esc(label) + "</span>";
  });
}

function wireTabSwiping() {
  const content = document.getElementById("content");
  let startX = 0, startY = 0, tracking = false;

  content.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
  });

  content.addEventListener("pointercancel", () => { tracking = false; });

  content.addEventListener("pointerup", (e) => {
    if (!tracking) return;
    tracking = false;
    if (document.querySelector(".dragging")) return;      // a drag is using this gesture
    if (document.getElementById("modal-overlay")) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) < SWIPE_MIN_X) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_SIDEWAYS_RATIO) return;
    slideToTab(dx < 0 ? 1 : -1);
  });
}

/* Slides the outgoing tab away and the incoming one in from the other side, so
   the direction of travel is visible. Read off the tab bar rather than a list
   kept here, because two orderings of the same five tabs would eventually
   disagree. */
function slideToTab(direction) {
  const order = Array.from(tabButtons).map(button => button.dataset.tab);
  const next = order[order.indexOf(activeTab) + direction];
  if (!next) return;

  const content = document.getElementById("content");
  const outTo = direction > 0 ? "-9%" : "9%";
  const inFrom = direction > 0 ? "9%" : "-9%";

  content.style.transition = "transform .13s ease-out, opacity .13s ease-out";
  content.style.transform = "translateX(" + outTo + ")";
  content.style.opacity = "0";

  setTimeout(() => {
    activeTab = next;
    updateActiveTabStyling();
    renderContent();
    content.scrollTop = 0;

    content.style.transition = "none";
    content.style.transform = "translateX(" + inFrom + ")";
    requestAnimationFrame(() => {
      content.style.transition = "transform .16s ease-out, opacity .16s ease-out";
      content.style.transform = "";
      content.style.opacity = "";
      setTimeout(() => { content.style.transition = ""; }, 200);
    });
  }, 135);
}
