/* ============================================================
   CHARACTER SELECTOR (POC — list is faked, only Sigrid is real)
   ============================================================ */

/* savedCharacters holds whole character objects, not stubs. Opening one points
   the global `character` at it, so every calculation and render reads the
   right sheet without any of them knowing a switch happened. */
let savedCharacters = [character];




/* ---------- persistence ----------

   The character shape has changed repeatedly, so the saved blob carries a
   schema version. A blob from an older version is set aside rather than
   loaded, because a half-migrated character is worse than a missing one --
   the earlier flat effects, string recharges and flat armour bonuses would
   all read as silently wrong rather than failing loudly.

   A real build would migrate. A POC only needs to notice. */

const STORAGE_KEY = "campfire.characters";
const SCHEMA_VERSION = 8;   // added character.languages and character.pendingChoices

function persistCharacters() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: SCHEMA_VERSION,
      openId: character ? character.id : null,
      characters: savedCharacters
    }));
  } catch (err) {
    // a full or unavailable store shouldn't take the app down mid-session
    console.warn("Couldn't save characters:", err);
  }
}

function loadCharacters() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    return null;                                  // storage blocked entirely
  }
  if (!raw) return null;

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (err) {
    return { stale: true, reason: "unreadable" };
  }
  if (!saved || !Array.isArray(saved.characters) || !saved.characters.length) return null;
  if (saved.version !== SCHEMA_VERSION) {
    /* Set aside, not discarded.

       This used to just refuse the blob -- and then the very next thing the app
       did was render the selector, which calls persistCharacters(), which wrote
       the default demo character straight over it. The toast said the saves
       "weren't loaded", which read as "they're still there". They weren't: a
       schema bump silently destroyed every character the player had.

       Moving it to a versioned key means the data survives the bump, and a
       migration written later has something to migrate. */
    stashStaleSave(raw, saved.version);
    return { stale: true, reason: "version " + saved.version };
  }

  savedCharacters = saved.characters;
  // sharing written before it meant anything names people with no address
  savedCharacters.forEach(normaliseNoteSharing);
  character = savedCharacters.find(c => sameId(c.id, saved.openId)) || savedCharacters[0];
  return { stale: false };
}

/* Keeps the old blob under its own key rather than letting the next write
   clobber it. Never overwrites an existing stash -- the first refusal is the
   one holding the real data; a second boot would otherwise stash the demo
   character over it. */
function stashStaleSave(raw, version) {
  try {
    const key = STORAGE_KEY + ".v" + version;
    if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
  } catch (err) {
    console.warn("Couldn't set aside the older save:", err);
  }
}

function selectCharacter(id) {
  const found = savedCharacters.find(c => sameId(c.id, id));
  if (found) character = found;
  return found;
}

function nextCharacterId() {
  return makeId(savedCharacters);
}

let currentScreen = "selector";

function showScreen(screen) {
  currentScreen = screen;
  document.getElementById("selector-screen").style.display = screen === "selector" ? "flex" : "none";
  document.getElementById("sheet-screen").style.display = screen === "sheet" ? "flex" : "none";
  refreshMyPartyIdentity();          // no-op unless you're actually in a party
  drainPendingPartyNotes();          // anything that arrived while no sheet was open
  if (screen === "selector") renderSelectorScreen();
  else { renderSheetHeader(); renderContent(); }
  // landing on the sheet mid-tutorial means a character just got built (or
  // imported) -- the creation phase's job is done, hand off to the tab tour.
  // renderContent() already calls renderTutorialOverlay() for the sheet
  // case; this call is what covers the selector screen (the welcome modal)
  // and this same phase flip.
  if (screen === "sheet" && tutorialState.active && tutorialState.phase === "creation") {
    tutorialState.phase = "tabs";
    persistTutorialState();
  }
  renderTutorialOverlay();
}

function renderSheetHeader() {
  document.getElementById("char-name-display").textContent = character.name;
  document.getElementById("char-class-display").textContent = classLineFor(character);
  const avatar = document.getElementById("char-avatar");
  avatar.innerHTML = character.profilePic
    ? `<img src="${esc(character.profilePic)}" alt="">`
    : character.name.trim().charAt(0).toUpperCase();
}

/* A photo straight off a phone camera is 3-4MB, and as a data URL inside the
   character JSON that is the entire localStorage quota for one avatar --
   after which persistCharacters() starts failing, swallows the error, and the
   player keeps playing against state that is no longer being saved.

   256px is plenty for a 40px circle at 3x, and it turns a 4MB blob into about
   20KB. The canvas also strips EXIF, which is a small privacy win: phone photos
   carry GPS coordinates. */
const AVATAR_MAX_PX = 256;

function downscaleImage(file, maxPx, done) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      done(canvas.toDataURL("image/jpeg", 0.82));
    };
    // a file the browser can't decode shouldn't take the form down; keep the
    // original rather than losing the upload
    img.onerror = () => done(reader.result);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function openCharacterEditorModal() {
  let pendingPic = character.profilePic;

  openModal("full", `
    <div class="modal-heading">Edit Character</div>

    <div class="avatar-edit-row">
      <div class="char-avatar char-avatar-lg" id="editor-avatar">
        ${character.profilePic ? `<img src="${esc(character.profilePic)}" alt="">` : esc(character.name.trim().charAt(0).toUpperCase())}
      </div>
      <div class="avatar-edit-actions">
        <button class="add-link" id="editor-pic-upload-btn">Upload Photo</button>
        ${character.profilePic ? `<button class="add-link" id="editor-pic-remove-btn" style="color:var(--danger-text);">Remove</button>` : ""}
      </div>
      <input type="file" id="editor-pic-input" accept="image/*" style="display:none;">
    </div>

    ${textFieldHtml("editor-name-input", "Name", character.name)}
    ${fieldHtml("Alignment", selectFieldHtml("editor-alignment-input", "", ALIGNMENTS, character.alignment))}
    ${textAreaFieldHtml("editor-appearance-input", "Appearance", character.appearance, { placeholder: "Physical description" })}
    ${textAreaFieldHtml("editor-traits-input", "Personality Traits", character.personalityTraits, { placeholder: "How they act, talk, carry themselves" })}
    ${textAreaFieldHtml("editor-ideals-input", "Ideals", character.ideals, { placeholder: "What they believe in" })}
    ${textAreaFieldHtml("editor-bonds-input", "Bonds", character.bonds, { placeholder: "Who or what they're tied to" })}
    ${textAreaFieldHtml("editor-flaws-input", "Flaws", character.flaws, { placeholder: "What holds them back" })}
    ${textAreaFieldHtml("editor-backstory-input", "Backstory", character.backstory, { placeholder: "Their history", large: true })}

    <button class="btn-primary" id="editor-save-button">Save</button>
  `);
  guardModalEdits();

  wireSelect("editor-alignment-input");

  const avatarPreview = document.getElementById("editor-avatar");
  const picInput = document.getElementById("editor-pic-input");

  document.getElementById("editor-pic-upload-btn").addEventListener("click", () => picInput.click());
  picInput.addEventListener("change", () => {
    const file = picInput.files[0];
    picInput.value = "";
    if (!file) return;
    downscaleImage(file, AVATAR_MAX_PX, (dataUrl) => {
      pendingPic = dataUrl;
      avatarPreview.innerHTML = `<img src="${esc(pendingPic)}" alt="">`;
    });
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
  persistCharacters();          // creating, importing and deleting all land here

  const listHtml = savedCharacters.length
    ? savedCharacters.map(c => `
        <div class="char-card" data-open-char="${c.id}">
          <div class="recipient-left">
            <div class="char-avatar">${c.profilePic ? `<img src="${esc(c.profilePic)}" alt="">` : esc(c.name.trim().charAt(0).toUpperCase())}</div>
            <div>
              <div class="char-card-name">${esc(c.name)}${c.customBuild ? ` <span class="res-tag" style="background:var(--danger-surface);color:var(--danger-text);">CUSTOM</span>` : ""}</div>
              <div class="char-card-class">${esc(classLineFor(c))}</div>
            </div>
          </div>
          <button class="char-card-menu" data-char-menu="${c.id}">\u22EF</button>
        </div>
      `).join("")
    : `<div class="empty-hint" style="padding:70px 20px;">No characters yet.<br>Create or import one to get started.</div>`;

  el.innerHTML = `
    <div class="app-header">
      <div class="brand-row">
        <span class="brand-name">Campfire</span>
        <button class="menu-button" id="selector-menu-button" style="margin-left:auto;">&#9776;</button>
      </div>
      <div class="char-name" style="margin-top:14px;">Your Characters</div>
    </div>
    <div class="content">${listHtml}</div>
    <div id="tutorial-overlay-selector"></div>
    <div class="selector-actions btn-row-2">
      <button class="btn-secondary" id="party-finder-button">${party.status === "none" ? "Party" : party.status === "hosting" ? "Hosting" : "Connected"}</button>
      <button class="btn-primary" id="new-char-button">+ New Character</button>
    </div>
  `;

  // this screen has no app menu, so without a banner slot here a tour that
  // ends up back on the selector has no Skip anywhere on screen
  renderTutorialOverlay();

  document.getElementById("party-finder-button").addEventListener("click", openPartyFinder);
  // openAppMenu() drops the entries that need an open character; without a
  // button here that whole branch was unreachable
  document.getElementById("selector-menu-button").addEventListener("click", openAppMenu);

  document.querySelectorAll("[data-open-char]").forEach(card => {
    card.addEventListener("click", () => {
      selectCharacter(card.dataset.openChar);
      showScreen("sheet");
    });
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
}

function openCharacterMenu(id) {
  const c = savedCharacters.find(x => x.id === id);
  openModal("center", `
    <div class="modal-heading">${esc(c.name)}</div>
    <button class="btn-primary" id="export-char-button" style="margin-bottom:8px;">Export</button>
    <button class="btn-primary btn-danger" id="delete-char-button">Delete</button>
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

// exports the card you picked, not whichever sheet happens to be open
function exportCharacter(c) {
  const filename = c.name.replace(/[^a-z0-9]+/gi, "_") + ".json";
  const dataStr = JSON.stringify(c, null, 2);
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
    <div class="modal-heading">Delete ${esc(c.name)}?</div>
    <div class="breakdown-source" style="margin-bottom:14px;">This can't be undone.</div>
    <button class="btn-primary btn-danger" id="confirm-delete-char-button" style="margin-bottom:8px;">Delete</button>
    <button class="btn-secondary" id="cancel-delete-char-button">Cancel</button>
  `);
  document.getElementById("confirm-delete-char-button").addEventListener("click", () => {
    savedCharacters = savedCharacters.filter(x => x.id !== id);
    // don't leave `character` pointing at something that no longer exists
    if (character && character.id === id) character = savedCharacters[0] || null;
    closeModal();
    renderSelectorScreen();
    showToast("Character deleted");
  });
  document.getElementById("cancel-delete-char-button").addEventListener("click", closeModal);
}
