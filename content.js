/* ============================================================
   CONTENT LIBRARY (POC)

   SRD content (srd-data.js) is fixed tables the app ships with -- browsable
   in full, but nothing here edits it directly. Duplicating an SRD entry
   copies it into Custom Content, prefixed "Custom ", where it's a real
   editable record instead of a reference table row. Custom Content is a
   device-level store, kept apart from any one character the same way
   settings and theme are.

   This file holds the library's state and the screens that browse it: the
   Manage Content list, the unified per-category browser, SRD detail views,
   and duplicate-to-custom. The editors themselves -- item/race/class/
   background/subclass/feature forms, and the shared feature-list machinery
   they all lean on -- live in content-forms.js, split out once this file
   crossed the line-count ceiling the structure suite enforces. Same global
   scope, just two files; see index.html for load order.

   "+ Add" (contentListHtml) opens a picker for every kind -- race, class,
   background, subclass, feature, item -- and every one of those forms
   accepts a null id and starts blank. Duplicating an SRD entry is still
   there and still the fast path for "start from the Fighter and change
   three things," but it's no longer the only way in.

   SRD and Custom Content share one browsing surface (CONTENT_CATEGORIES):
   each category lists both sides, with a filter and a search box -- shared
   state (contentCategoryFilter/contentCategorySearch) means a search
   started from the top-level Manage Content screen keeps working if you
   drill into one category, and vice versa. Custom entries carry a small
   "CC" tag; deleting one asks first (contentPendingDelete) rather than
   removing it on the first tap.

   Subclasses' SRD side is flattened out of SRD_CLASSES (each tagged with
   `forClass`) instead of only being visible nested inside a class's own
   detail view -- that's also the one bucket actually wired into play, since
   a Custom subclass attaches to an existing class by name rather than
   living inside a duplicated copy of it, so a homebrew subclass for the SRD
   Fighter doesn't require forking Fighter itself. subclassesForClass()
   (rests.js) merges these in wherever a class's subclasses are read, which
   is why they show up in the character builder's Subclass step and
   contribute real leveled features -- see the comment on that function for
   the whole story.

   Features has no SRD side yet -- character.traits.Feats starts empty for
   every build (creator.js), so there's no real feat content to flatten in.
   Sorting out actual SRD/OGL content across every category, not just
   Features, is real future work -- a lot of it -- not faked; it's just not
   this pass.

   Everything else in this library still isn't read anywhere but here --
   Custom races/classes/backgrounds don't feed the creator's pickers or the
   inventory's Add Item form. That wiring is real future work too. */

const CUSTOM_CONTENT_KEY = "campfire.customContent";
let customContent = { races: [], classes: [], backgrounds: [], items: [], subclasses: [], features: [] };

function persistCustomContent() {
  try { localStorage.setItem(CUSTOM_CONTENT_KEY, JSON.stringify(customContent)); }
  catch (err) { /* not fatal */ }
}

function loadCustomContent() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_CONTENT_KEY));
    if (saved && typeof saved === "object") {
      customContent = {
        races: Array.isArray(saved.races) ? saved.races : [],
        classes: Array.isArray(saved.classes) ? saved.classes : [],
        backgrounds: Array.isArray(saved.backgrounds) ? saved.backgrounds : [],
        items: Array.isArray(saved.items) ? saved.items : [],
        subclasses: Array.isArray(saved.subclasses) ? saved.subclasses : [],
        features: Array.isArray(saved.features) ? saved.features : []
      };
    }
  } catch (err) { /* defaults */ }
}

function nextCustomId(bucket) {
  return Math.max(0, ...customContent[bucket].map(entry => entry.id || 0)) + 1;
}

function itemTypeLabel(type) {
  return (ITEM_TYPES.find(t => t.value === type) || {}).label || "Gear";
}

/* Browsing categories -- SRD and Custom Content share one list of
   categories rather than living under two separate headings. Each category
   knows how to list its SRD side and its Custom Content side; search and
   filter work the same way whether you're looking across every category
   (the Manage Content screen itself) or inside just one (a category
   screen) -- see scopedCategoryEntries/contentResultsHtml below. `kind` is
   what duplicateSrdEntry/customBucketFor/the row-click dispatch use to know
   which editor a Custom Content entry in this category opens.

   Subclasses' SRD side is flattened out of SRD_CLASSES rather than kept
   nested -- each SRD class's own subclasses, tagged with which class they
   belong to (`forClass`), so "Champion" shows up here as its own row instead
   of only being visible by opening Fighter first. Duplicating one drops a
   Custom subclass with the same `.forClass`, same as authoring one from
   scratch would.

   Features has no SRD side at all -- the SRD set this app ships with has no
   standalone feats (character.traits.Feats starts empty for every build,
   see creator.js), so every entry here is homebrew until that content gets
   filled in for real. */
const CONTENT_CATEGORIES = [
  { key: "races", label: "Races", kind: "race", srdList: () => SRD_RACES, customList: () => customContent.races },
  { key: "classes", label: "Classes", kind: "class", srdList: () => SRD_CLASSES, customList: () => customContent.classes },
  { key: "subclasses", label: "Subclasses", kind: "subclass",
    srdList: () => SRD_CLASSES.flatMap(c => (c.subclasses || []).map(sc => Object.assign({ forClass: c.name }, sc))),
    customList: () => customContent.subclasses },
  { key: "backgrounds", label: "Backgrounds", kind: "background", srdList: () => SRD_BACKGROUNDS, customList: () => customContent.backgrounds },
  // SRD_FEATS starts empty and fills in once the feats pass is done -- the
  // category and its plumbing (duplicate, detail view) are real starting now
  { key: "features", label: "Features", kind: "feature", srdList: () => SRD_FEATS, customList: () => customContent.features },
  { key: "weapons", label: "Weapons", kind: "item", srdList: () => Object.values(KIT_ITEMS).filter(i => i.isWeapon), customList: () => customContent.items.filter(i => i.type === "weapon") },
  { key: "armour", label: "Armour", kind: "item", srdList: () => Object.values(KIT_ITEMS).filter(i => i.armour), customList: () => customContent.items.filter(i => i.type === "armour") },
  { key: "gear", label: "Gear", kind: "item", srdList: () => Object.values(KIT_ITEMS).filter(i => !i.isWeapon && !i.armour), customList: () => customContent.items.filter(i => i.type === "gear") },
  // magic items span weapon/armour/gear the same way they do in the rules --
  // this isn't a 4th item type, just SRD_MAGIC_ITEMS entries (and any Custom
  // item with a rarity set) called out as their own browsing category
  { key: "magicitems", label: "Magic Items", kind: "item", srdList: () => SRD_MAGIC_ITEMS, customList: () => customContent.items.filter(i => i.rarity) },
  // read-only: rules text, not editable content. No Custom side and no
  // Duplicate button (see srdDetailHtml / wireSrdDetail) -- a homebrew
  // condition is just a name typed into the Add Effect combo box, which
  // already accepts free text
  { key: "conditions", label: "Conditions", kind: "condition", srdList: () => SRD_CONDITIONS, customList: () => [] }
];

const CONTENT_FILTERS = [{ key: "all", label: "All" }, { key: "srd", label: "SRD" }, { key: "custom", label: "Custom" }];

/* Every entry in one category, SRD and Custom together, tagged with where
   it came from and a stable reference back into its own list -- an index
   for SRD (which has no id of its own) or the Custom entry's real id.
   scopedCategoryEntries additionally tags each row with which category it
   came from, so the same row shape works whether the caller wants one
   category (scopeKey set) or every category at once (scopeKey null) -- the
   Manage Content screen's own search needs the latter. */
function categoryEntries(cat) {
  const srd = cat.srdList().map((entry, i) => ({ source: "srd", ref: i, entry }));
  const custom = cat.customList().map(entry => ({ source: "custom", ref: entry.id, entry }));
  return srd.concat(custom);
}

function scopedCategoryEntries(scopeKey) {
  const cats = scopeKey ? [CONTENT_CATEGORIES.find(c => c.key === scopeKey)] : CONTENT_CATEGORIES;
  return cats.flatMap(cat => categoryEntries(cat).map(row => Object.assign({ catKey: cat.key, catLabel: cat.label }, row)));
}

function filteredContentEntries(scopeKey) {
  let rows = scopedCategoryEntries(scopeKey);
  if (contentCategoryFilter !== "all") rows = rows.filter(row => row.source === contentCategoryFilter);
  const q = contentCategorySearch.trim().toLowerCase();
  if (q) rows = rows.filter(row => row.entry.name.toLowerCase().includes(q));
  return rows;
}

/* Result rows -- shared by the Manage Content screen (scopeKey null, every
   category) and a single category screen (scopeKey set). Redrawn on every
   keystroke in the search box and every filter tap, targeting just this
   container so the search input itself is never replaced and never loses
   focus. Custom entries get a small "CC" tag and a delete button (with an
   inline "are you sure" step -- contentPendingDelete -- before anything
   actually leaves the library); SRD entries get "View" and route to the
   read-only breakdown instead. */
function contentResultsHtml(scopeKey) {
  const rows = filteredContentEntries(scopeKey);
  return `
    <div class="breakdown-source" style="margin:4px 0 8px;">${rows.length} ${rows.length === 1 ? "entry" : "entries"}</div>
    ${rows.length ? rows.map(row => contentRowHtml(row, scopeKey)).join("") : `<div class="empty-hint">Nothing matches.</div>`}
  `;
}

function contentRowHtml(row, scopeKey) {
  const rowKey = row.catKey + ":" + row.source + ":" + row.ref;
  const pending = contentPendingDelete && contentPendingDelete.catKey === row.catKey &&
    contentPendingDelete.source === row.source && contentPendingDelete.ref === row.ref;
  if (pending) {
    return `
      <div class="res-row">
        <div class="res-name">Delete "${esc(row.entry.name)}"?</div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn-secondary" data-cc-cancel-delete style="padding:4px 10px;font-size:12px;">Cancel</button>
          <button type="button" class="btn-primary" data-cc-confirm-delete="${rowKey}" style="padding:4px 10px;font-size:12px;background:var(--danger-surface);color:var(--danger-text);">Delete</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="res-row" data-cc-row="${rowKey}" style="cursor:pointer;">
      <div class="res-name">${esc(row.entry.name)}${row.source === "custom" ? ` <span class="res-tag" style="background:var(--control-raised);color:var(--accent-soft);">CC</span>` : ""}${row.entry.official === false ? ` <span class="res-tag" style="background:var(--control-raised);color:var(--text-dim);">3PP</span>` : ""}${!scopeKey ? ` <span class="field-hint">${esc(row.catLabel)}</span>` : ""}${row.entry.forClass ? ` <span class="field-hint">for ${esc(row.entry.forClass)}</span>` : ""}</div>
      ${row.source === "custom" ? `<button class="mini-edit" data-cc-delete="${rowKey}">✕</button>` : `<span class="add-link">View</span>`}
    </div>
  `;
}

/* Wires whatever contentResultsHtml just rendered into `containerId`. Shared
   by the Manage Content screen and a single category screen -- `redraw`
   is each caller's own "re-render just my results container" closure, so a
   delete or a confirm/cancel tap redraws only that container, not the whole
   screen (which would drop focus out of the search box). */
function wireContentResults(scopeKey, redraw) {
  document.querySelectorAll("[data-cc-row]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-cc-delete]")) return;
      const [catKey, source, refStr] = row.dataset.ccRow.split(":");
      const cat = CONTENT_CATEGORIES.find(c => c.key === catKey);
      if (source === "srd") {
        contentSrdEntry = cat.srdList()[parseInt(refStr)];
        contentSrdCategory = catKey;
        contentSrdDetailOrigin = scopeKey ? "category" : "list";
        contentScreen = "srd-detail";
        redrawContentManager();
      } else {
        const id = parseInt(refStr);
        if (cat.kind === "race") openRaceForm(id);
        else if (cat.kind === "class") openClassForm(id);
        else if (cat.kind === "background") openBackgroundForm(id);
        else if (cat.kind === "subclass") openSubclassForm(id);
        else if (cat.kind === "feature") openFeatureForm(id);
        else openCustomItemForm(id);        // weapon / armour / gear share the item form
      }
    });
  });
  document.querySelectorAll("[data-cc-delete]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const [catKey, source, refStr] = btn.dataset.ccDelete.split(":");
      contentPendingDelete = { catKey, source, ref: parseInt(refStr) };
      redraw();
    });
  });
  document.querySelectorAll("[data-cc-cancel-delete]").forEach(btn => {
    btn.addEventListener("click", () => { contentPendingDelete = null; redraw(); });
  });
  document.querySelectorAll("[data-cc-confirm-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [catKey, , refStr] = btn.dataset.ccConfirmDelete.split(":");
      const cat = CONTENT_CATEGORIES.find(c => c.key === catKey);
      const bucket = customBucketFor(cat.kind);
      const id = parseInt(refStr);
      customContent[bucket] = customContent[bucket].filter(entry => entry.id !== id);
      persistCustomContent();
      contentPendingDelete = null;
      showToast("Removed from library");
      redraw();
    });
  });
}

/* Both screens' search box and filter chips wire the same way -- this is
   called once with each screen's own redraw closure. */
function wireContentSearchAndFilter(searchInputId, redraw) {
  document.getElementById(searchInputId).addEventListener("input", (e) => {
    contentCategorySearch = e.target.value;
    redraw();
  });
  document.querySelectorAll("[data-cc-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      contentCategoryFilter = btn.dataset.ccFilter;
      document.querySelectorAll("[data-cc-filter]").forEach(b => b.classList.toggle("active", b.dataset.ccFilter === contentCategoryFilter));
      redraw();
    });
  });
}

function contentFilterChipsHtml() {
  return CONTENT_FILTERS.map(f => `<button type="button" class="toggle-btn ${contentCategoryFilter === f.key ? "active" : ""}" data-cc-filter="${f.key}" style="margin:2px;">${esc(f.label)}</button>`).join("");
}

let contentScreen = "list";        // list | add-picker | category | srd-detail | item-form | race-form | class-form | background-form | subclass-form | feature-form
let contentSrdCategory = null;     // the open category's key, e.g. "races" -- SRD and Custom alike
let contentSrdEntry = null;        // the specific SRD race/class/background/item being viewed
let contentSrdDetailOrigin = "category"; // "list" | "category" -- which screen's Back button to return to from srd-detail
let contentCategoryFilter = "all"; // all | srd | custom -- shared by the top-level screen and a category screen, so a search started in one carries into the other
let contentCategorySearch = "";
let contentPendingDelete = null;   // { catKey, source, ref } | null -- the one row currently showing an inline delete confirmation
let contentItemState = null;       // { editingId, type, damage, properties } -- shape of newItemFormState()
let raceFormState = null;
let classFormState = null;
let backgroundFormState = null;
let subclassFormState = null;
let featureFormState = null;

function openContentManager() {
  contentScreen = "list";
  contentCategoryFilter = "all";
  contentCategorySearch = "";
  contentPendingDelete = null;
  openModal("full", "");
  redrawContentManager();
}

function redrawContentManager() {
  const box = document.querySelector("#modal-overlay .modal-content");
  box.innerHTML = contentManagerHtml();
  wireContentManager();
}

function contentManagerHtml() {
  if (contentScreen === "category") return contentCategoryHtml();
  if (contentScreen === "srd-detail") return srdDetailHtml();
  if (contentScreen === "item-form") return customItemFormHtml();
  if (contentScreen === "race-form") return raceFormHtml();
  if (contentScreen === "class-form") return classFormHtml();
  if (contentScreen === "background-form") return backgroundFormHtml();
  if (contentScreen === "subclass-form") return subclassFormHtml();
  if (contentScreen === "feature-form") return featureFormHtml();
  if (contentScreen === "add-picker") return addPickerHtml();
  return contentListHtml();
}

function wireContentManager() {
  if (contentScreen === "category") return wireContentCategory();
  if (contentScreen === "srd-detail") return wireSrdDetail();
  if (contentScreen === "item-form") return wireCustomItemForm();
  if (contentScreen === "race-form") return wireRaceForm();
  if (contentScreen === "class-form") return wireClassForm();
  if (contentScreen === "background-form") return wireBackgroundForm();
  if (contentScreen === "subclass-form") return wireSubclassForm();
  if (contentScreen === "feature-form") return wireFeatureForm();
  if (contentScreen === "add-picker") return wireAddPicker();
  return wireContentList();
}

/* ---------- list ---------- */

function contentListHtml() {
  return `
    <div class="modal-heading">Manage Content</div>
    ${textFieldHtml("mc-search", "Search", contentCategorySearch, { placeholder: "Search all content..." })}
    <div class="chip-row" style="margin-bottom:6px;">${contentFilterChipsHtml()}</div>
    <div id="mc-results">${contentListBodyHtml()}</div>

    <div class="btn-row-2" style="margin-top:14px;">
      <button class="btn-secondary" id="content-import-button">Import</button>
      <button class="btn-primary" id="content-add-button">+ Add</button>
    </div>
    <input type="file" id="content-import-input" accept=".json" style="display:none;">
  `;
}

/* Browsing by category (the default) vs. flat results across every category
   at once, once a search or filter narrows things down. Browsing by
   category stops making sense the moment you're looking for something
   specific -- searching "longsword" shouldn't require picking Weapons
   first, and the filter chips ("SRD" / "Custom") are meaningless applied to
   a bare list of category names. */
function contentListBodyHtml() {
  const searching = contentCategorySearch.trim() !== "" || contentCategoryFilter !== "all";
  if (!searching) {
    return CONTENT_CATEGORIES.map(cat => `
      <div class="res-row" data-content-cat="${cat.key}" style="cursor:pointer;">
        <div class="res-name">${esc(cat.label)}</div>
        <span class="atk-range">${cat.srdList().length + cat.customList().length}</span>
      </div>
    `).join("");
  }
  return contentResultsHtml(null);
}

/* ---------- add picker ----------

   One button, one place it can lead: every kind of Custom Content -- race,
   class, background, subclass, item -- opens from here, all starting blank.
   Race/Class/Background used to be reachable only by duplicating an SRD
   entry first; they still can be (that stays the fast path for "start from
   the Fighter and change three things"), but "+ Add" no longer requires it. */
const ADD_PICKER_KINDS = [
  { kind: "race", label: "Race", hint: "A playable race with its own features." },
  { kind: "class", label: "Class", hint: "A class with features, subclasses and proficiencies." },
  { kind: "background", label: "Background", hint: "Skills and a background feature." },
  { kind: "subclass", label: "Subclass", hint: "Attaches to a class you already have -- SRD or Custom." },
  { kind: "feature", label: "Feature", hint: "A standalone feature or feat, not tied to a race, class, subclass or background." },
  { kind: "item", label: "Item", hint: "A weapon, armour or piece of gear." }
];

function addPickerHtml() {
  return `
    <div class="modal-heading">Add Custom Content</div>
    <div class="breakdown-source" style="margin-bottom:10px;">What are you creating?</div>
    ${ADD_PICKER_KINDS.map(k => `
      <button type="button" class="toggle-btn creator-option" data-add-kind="${k.kind}" style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px 14px;">
        <div>${esc(k.label)}</div>
        <div class="field-hint" style="margin-top:2px;">${esc(k.hint)}</div>
      </button>
    `).join("")}
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function wireAddPicker() {
  document.querySelectorAll("[data-add-kind]").forEach(btn => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.addKind;
      if (kind === "race") openRaceForm(null);
      else if (kind === "class") openClassForm(null);
      else if (kind === "background") openBackgroundForm(null);
      else if (kind === "subclass") openSubclassForm(null);
      else if (kind === "feature") openFeatureForm(null);
      else openCustomItemForm(null);
    });
  });
  document.getElementById("content-back-button").addEventListener("click", () => {
    contentScreen = "list"; redrawContentManager();
  });
}

function customBucketFor(kind) {
  if (kind === "race") return "races";
  if (kind === "class") return "classes";
  if (kind === "background") return "backgrounds";
  if (kind === "subclass") return "subclasses";
  if (kind === "feature") return "features";
  return "items";                 // weapon, armour and gear all live in items
}

function wireContentList() {
  function redrawList() {
    document.getElementById("mc-results").innerHTML = contentListBodyHtml();
    wireListBody();
  }

  // browsing-by-category rows only ever show up when search is empty and
  // the filter is "all" (contentListBodyHtml), so there's nothing to carry
  // over here -- clicking one always starts a category screen from the same
  // neutral state this screen was already in
  function wireListBody() {
    document.querySelectorAll("[data-content-cat]").forEach(row => {
      row.addEventListener("click", () => {
        contentSrdCategory = row.dataset.contentCat;
        contentScreen = "category";
        redrawContentManager();
      });
    });
    wireContentResults(null, redrawList);
  }

  wireContentSearchAndFilter("mc-search", redrawList);

  document.getElementById("content-add-button").addEventListener("click", () => {
    contentScreen = "add-picker"; redrawContentManager();
  });

  const fileInput = document.getElementById("content-import-input");
  document.getElementById("content-import-button").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (err) {
        showToast("That file isn't valid JSON");
        return;
      }
      // a file can hold one item or a whole pack -- either way, only entries
      // that at least have a name are worth keeping. Import stays items-only
      // for now, matching what the form on this screen can actually edit.
      const incoming = Array.isArray(parsed) ? parsed : [parsed];
      const valid = incoming.filter(entry => entry && typeof entry === "object" && entry.name);
      if (!valid.length) { showToast("That doesn't look like content"); return; }

      valid.forEach(entry => {
        entry.id = nextCustomId("items");
        entry.type = entry.type || itemType(entry);
        customContent.items.push(entry);
      });
      persistCustomContent();
      redrawContentManager();
      showToast("Imported " + valid.length + (valid.length === 1 ? " item" : " items"));
    };
    reader.onerror = () => showToast("Couldn't read that file");
    reader.readAsText(file);
  });

  wireListBody();
}

/* ---------- SRD browsing ---------- */

function contentCategoryHtml() {
  const cat = CONTENT_CATEGORIES.find(c => c.key === contentSrdCategory);
  return `
    <div class="modal-heading">${esc(cat.label)}</div>
    ${textFieldHtml("cc-search", "Search", contentCategorySearch, { placeholder: "Search " + cat.label.toLowerCase() })}
    <div class="chip-row" style="margin-bottom:6px;">${contentFilterChipsHtml()}</div>
    <div id="cc-results">${contentResultsHtml(cat.key)}</div>
    <button class="btn-secondary" id="content-back-button" style="margin-top:10px;">Back</button>
  `;
}

function wireContentCategory() {
  const cat = CONTENT_CATEGORIES.find(c => c.key === contentSrdCategory);

  function redrawResults() {
    document.getElementById("cc-results").innerHTML = contentResultsHtml(cat.key);
    wireContentResults(cat.key, redrawResults);
  }

  wireContentSearchAndFilter("cc-search", redrawResults);

  document.getElementById("content-back-button").addEventListener("click", () => {
    contentPendingDelete = null;
    contentScreen = "list"; redrawContentManager();
  });

  wireContentResults(cat.key, redrawResults);
}

/* Full breakdowns. featureRowHtml (creator.js) is used unescaped here on
   purpose -- it's only ever fed SRD_RACES / SRD_CLASSES / SRD_BACKGROUNDS,
   which are static data this app ships with, the same trust level the
   creator already reads them at. */
function leveledFeatureRowHtml(f) {
  return `<div class="trait-item" style="border-top:1px solid var(--border);padding:8px 0;">
    <div class="trait-name">Level ${f.level} — ${f.name}</div>
    <div class="trait-desc">${f.desc}</div>
  </div>`;
}

function srdDetailHtml() {
  const cat = CONTENT_CATEGORIES.find(c => c.key === contentSrdCategory);
  if (cat.kind === "race") return raceDetailHtml(contentSrdEntry);
  if (cat.kind === "class") return classDetailHtml(contentSrdEntry);
  if (cat.kind === "subclass") return subclassDetailHtml(contentSrdEntry);
  if (cat.kind === "background") return backgroundDetailHtml(contentSrdEntry);
  if (cat.kind === "condition") return conditionDetailHtml(contentSrdEntry);
  if (cat.kind === "feature") return featureDetailHtml(contentSrdEntry);
  return srdItemDetailHtml(contentSrdEntry);
}

// no Duplicate button -- conditions have no Custom Content editor of their
// own (see the "conditions" category comment above)
function conditionDetailHtml(cond) {
  return `
    <div class="modal-heading">${esc(cond.name)}</div>
    ${cond.official === false ? `<div class="breakdown-source" style="margin-bottom:6px;">Third-party (not core SRD)</div>` : ""}
    <div class="trait-desc" style="margin:10px 0;">${esc(cond.desc)}</div>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

// a standalone feature/feat -- name, description, optional prerequisite and
// the same effect/choice/resource mechanics any other feature can carry
function featureDetailHtml(f) {
  return `
    <div class="modal-heading">${esc(f.name)}</div>
    ${f.official === false ? `<div class="breakdown-source" style="margin-bottom:6px;">Third-party (not core SRD)</div>` : ""}
    ${f.prereq ? `<div class="breakdown-source" style="margin-bottom:6px;">Prerequisite: ${esc(f.prereq)}</div>` : ""}
    <div class="trait-desc" style="margin:10px 0;">${esc(f.desc)}</div>
    <button class="btn-primary" id="content-duplicate-button" style="margin-top:14px;">Duplicate to Custom</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function raceDetailHtml(race) {
  return `
    <div class="modal-heading">${esc(race.name)}</div>
    <div class="breakdown-subhead">Features</div>
    ${race.features.map(featureRowHtml).join("")}
    ${race.skillChoice ? `<div class="item-effect" style="margin-top:8px;">Grants ${race.skillChoice.count} bonus skill ${race.skillChoice.count === 1 ? "proficiency" : "proficiencies"} from: ${esc(race.skillChoice.options.join(", "))}</div>` : ""}
    ${(race.subraces || []).map(sr => `
      <div class="breakdown-subhead" style="margin-top:14px;">${esc(sr.name)}</div>
      ${sr.features.map(featureRowHtml).join("")}
    `).join("")}
    <button class="btn-primary" id="content-duplicate-button" style="margin-top:14px;">Duplicate to Custom</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function classDetailHtml(cls) {
  return `
    <div class="modal-heading">${esc(cls.name)}</div>
    <div class="trait-desc" style="margin:10px 0;">${esc(cls.description)}</div>
    <div class="breakdown-row"><span>Hit Die</span><span>${esc(cls.hitDie)}</span></div>
    <div class="breakdown-row"><span>Main Ability</span><span>${esc(cls.mainAbility)}</span></div>
    <div class="breakdown-row"><span>Saving Throws</span><span>${esc(cls.saves.join(", "))}</span></div>
    <div class="breakdown-row"><span>Armor</span><span>${esc(cls.armorProf)}</span></div>
    <div class="breakdown-row"><span>Weapons</span><span>${esc(cls.weaponProf)}</span></div>
    <div class="breakdown-row"><span>Skill Choices</span><span>${cls.skillChoices.count} of ${cls.skillChoices.options.length}</span></div>
    <div class="breakdown-subhead">Features</div>
    ${cls.features.map(leveledFeatureRowHtml).join("")}
    ${cls.subclasses.map(sc => `
      <div class="breakdown-subhead" style="margin-top:14px;">${esc(sc.name)}</div>
      ${sc.features.map(leveledFeatureRowHtml).join("")}
    `).join("")}
    <button class="btn-primary" id="content-duplicate-button" style="margin-top:14px;">Duplicate to Custom</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

/* An SRD subclass's own detail view -- reachable now that the Subclasses
   category flattens them out of their class instead of leaving them only
   visible nested inside classDetailHtml. Duplicating one drops a Custom
   subclass with the same forClass (duplicateSrdEntry), not a whole cloned
   class. */
function subclassDetailHtml(sc) {
  return `
    <div class="modal-heading">${esc(sc.name)}</div>
    <div class="breakdown-source" style="margin-bottom:10px;">For ${esc(sc.forClass)}</div>
    <div class="breakdown-subhead">Features</div>
    ${sc.features.map(leveledFeatureRowHtml).join("")}
    <button class="btn-primary" id="content-duplicate-button" style="margin-top:14px;">Duplicate to Custom</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function backgroundDetailHtml(bg) {
  return `
    <div class="modal-heading">${esc(bg.name)}</div>
    <div class="trait-desc" style="margin:10px 0;">${esc(bg.desc)}</div>
    <div class="breakdown-row"><span>Skill Proficiencies</span><span>${esc(bg.skills.join(", "))}</span></div>
    <div class="breakdown-subhead">Feature</div>
    ${featureRowHtml(bg.feature)}
    <button class="btn-primary" id="content-duplicate-button" style="margin-top:14px;">Duplicate to Custom</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function srdItemDetailHtml(item) {
  const kind = itemType(item);
  return `
    <div class="modal-heading">${esc(item.name)}</div>
    ${item.description ? `<div class="trait-desc" style="margin:6px 0 12px;">${esc(item.description)}</div>` : ""}
    <div class="breakdown-row"><span>Weight</span><span>${item.weight} lb</span></div>
    ${item.rarity ? `<div class="breakdown-row"><span>Rarity</span><span>${esc(item.rarity)}</span></div>` : ""}
    ${item.rarity ? `<div class="breakdown-row"><span>Attunement</span><span>${item.attunement ? "Required" : "Not required"}</span></div>` : ""}
    ${kind === "weapon" ? `
      <div class="breakdown-row"><span>Attack Ability</span><span>${esc(item.attackAbility)}</span></div>
      <div class="breakdown-row"><span>Attack Type</span><span>${item.weaponType === "ranged" ? "Ranged" : "Melee"}</span></div>
      <div class="breakdown-row"><span>Range</span><span>${esc(item.range || "—")}</span></div>
      <div class="breakdown-row"><span>Proficiency</span><span>${esc(item.proficiencyRequired || "None")}</span></div>
      ${(item.damage || []).map(d => `<div class="breakdown-row"><span>Damage</span><span>${esc(d.dice)} ${esc(d.type)}</span></div>`).join("")}
      ${item.properties && item.properties.length ? `<div class="item-effect" style="margin-top:6px;">${esc(item.properties.join(", "))}</div>` : ""}
    ` : ""}
    ${kind === "armour" ? `
      <div class="breakdown-row"><span>Base AC</span><span>${item.armour.base}</span></div>
      <div class="breakdown-row"><span>Armour Type</span><span>${esc((ARMOUR_KINDS.find(k => k.value === item.armour.kind) || {}).label || item.armour.kind)}</span></div>
      <div class="breakdown-row"><span>Max Dexterity Bonus</span><span>${item.armour.dexCap == null ? "No limit" : item.armour.dexCap}</span></div>
    ` : ""}
    <button class="btn-primary" id="content-duplicate-button" style="margin-top:14px;">Duplicate to Custom</button>
    <button class="btn-secondary" id="content-back-button">Back</button>
  `;
}

function wireSrdDetail() {
  // conditions have no Duplicate button (conditionDetailHtml doesn't render
  // one -- see the "conditions" category comment above)
  const dupButton = document.getElementById("content-duplicate-button");
  if (dupButton) {
    dupButton.addEventListener("click", () => {
      const cat = CONTENT_CATEGORIES.find(c => c.key === contentSrdCategory);
      duplicateSrdEntry(cat.kind, contentSrdEntry);
    });
  }
  document.getElementById("content-back-button").addEventListener("click", () => {
    contentScreen = contentSrdDetailOrigin; redrawContentManager();
  });
}

/* The original stays put -- this clones it, renames the clone, drops it in
   the matching Custom bucket, and opens that clone's editor so there's
   somewhere to make it yours immediately. */
function duplicateSrdEntry(kind, entry) {
  const clone = JSON.parse(JSON.stringify(entry));
  clone.name = "Custom " + clone.name;

  if (kind === "race") {
    clone.id = nextCustomId("races");
    customContent.races.push(clone);
    persistCustomContent();
    openRaceForm(clone.id);
    return;
  }
  if (kind === "class") {
    clone.id = nextCustomId("classes");
    customContent.classes.push(clone);
    persistCustomContent();
    openClassForm(clone.id);
    return;
  }
  if (kind === "subclass") {
    // forClass carries straight over -- duplicating "Champion" still means
    // "for Fighter," same as the original
    clone.id = nextCustomId("subclasses");
    customContent.subclasses.push(clone);
    persistCustomContent();
    openSubclassForm(clone.id);
    return;
  }
  if (kind === "background") {
    clone.id = nextCustomId("backgrounds");
    customContent.backgrounds.push(clone);
    persistCustomContent();
    openBackgroundForm(clone.id);
    return;
  }
  if (kind === "feature") {
    // a standalone feature/feat, not an item -- this was falling through to
    // the item branch below before the Features category had any real SRD
    // content to duplicate, so the bug never fired
    clone.id = nextCustomId("features");
    customContent.features.push(clone);
    persistCustomContent();
    openFeatureForm(clone.id);
    return;
  }

  // item: category/qty/resource are instance-level concerns the item form
  // here doesn't expose, so they're dropped rather than carried over silently
  delete clone.category;
  delete clone.qty;
  delete clone.resource;
  clone.id = nextCustomId("items");
  clone.type = itemType(clone);
  customContent.items.push(clone);
  persistCustomContent();
  openCustomItemForm(clone.id);
}

