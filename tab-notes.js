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
    <div class="section-head-row" data-note-sec-card="${sec.id}" data-note-sec-toggle="${sec.id}" style="cursor:pointer;touch-action:pan-y;">
      <div class="section-head">${esc(sec.name)}${sec.receiveFrom ? `<span class="receive-dot" title="Receiving shared notes here"></span>` : ""}</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button class="add-link" data-add-note="${sec.id}">+ Add</button>
        <button class="mini-edit" data-edit-section="${sec.id}">\u270E</button>
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
      : `<span class="share-tag share-tag-in">\u2193 ${esc(n.sharing.sharedByName)}</span>`;
  }
  return `
    <div class="item-row note-row" data-note-view="${n.id}" data-note-id="${n.id}" style="touch-action:pan-y;">
      <div style="flex:1;">
        <!-- the title is text and gets escaped; the tag is markup this
             function built, with its own escaping already applied inside -->
        <div class="item-name">${esc(n.title || "Untitled")}${tag}</div>
        ${preview ? `<div class="item-meta">${esc(preview)}</div>` : ""}
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
  const section = character.noteSections.find(s => sameId(s.id, sectionId));
  sectionId = section.id;   // the dataset gives text; store the id in its stored shape
  const newId = makeId(character.notes);
  const now = Date.now();
  const note = { id: newId, sectionId, title: "", body: "", createdAt: now, updatedAt: now, sharing: null };
  if (section.autoShare) {
    note.sharing = {
      sharedByMe: true, continuous: true,
      sharedWith: partyMemberList(party.members, deviceId()).map(m => ({ name: m.name, device: m.device, permission: "edit" }))
    };
  }
  character.notes.push(note);
  partyResendNote(note);
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
        const order = Array.from(wrap.querySelectorAll("[data-note-sec-card]")).map(c => c.dataset.noteSecCard);
        character.noteSections.sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));
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

        const note = character.notes.find(n => sameId(n.id, row.dataset.noteId));
        const newBody = row.closest("[data-note-sec-body]");
        const newSectionId = newBody ? newBody.dataset.noteSecBody : note.sectionId;
        if (!sameId(newSectionId, note.sectionId)) {
          const targetSection = character.noteSections.find(s => sameId(s.id, newSectionId));
          maybeSyncNoteSharingToSection(note, targetSection);
        }

        const newNotes = [];
        document.querySelectorAll("[data-note-sec-body]").forEach(body => {
          const movedTo = character.noteSections.find(s => sameId(s.id, body.dataset.noteSecBody));
          const secId = movedTo ? movedTo.id : body.dataset.noteSecBody;
          body.querySelectorAll(".note-row").forEach(r => {
            const n = character.notes.find(x => sameId(x.id, r.dataset.noteId));
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
    confirmModal({
      title: "Share this note?",
      body: `"${targetSection.name}" auto-shares notes with the whole party.`,
      confirmLabel: "Share",
      onConfirm: () => {
        note.sharing = {
          sharedByMe: true, continuous: true,
          sharedWith: partyMemberList(party.members, deviceId()).map(m => ({ name: m.name, device: m.device, permission: "edit" }))
        };
        partyResendNote(note);
        renderContent();
      }
    });
  } else if (!targetSection.autoShare && currentlyShared) {
    confirmModal({
      title: "Stop sharing this note?",
      body: `"${targetSection.name}" doesn't auto-share notes.`,
      confirmLabel: "Stop sharing", danger: true,
      onConfirm: () => {
        partyUnshareNote(note.id, (note.sharing.sharedWith || []).map(m => m.device).filter(Boolean));
        note.sharing = null;
        note.autoShareOptOut = true;
        renderContent();
      }
    });
  }
}

function openAddSectionModal() {
  openModal("sheet", `
    <div class="modal-heading">New Section</div>
    ${textFieldHtml("new-sec-name", "Name", "", { placeholder: "e.g. Quest Log" })}
    ${toggleLineHtml("sw-autoshare", "Auto-share notes added here", false)}
    ${toggleLineHtml("sw-receive", "Receive shared notes here", false)}
    <button class="btn-primary" id="save-sec-button">Create Section</button>
  `);
  guardModalEdits();
  let autoShare = false, receiveFrom = false;
  document.getElementById("sw-autoshare").addEventListener("click", (e) => { autoShare = !autoShare; e.currentTarget.classList.toggle("on", autoShare); });
  document.getElementById("sw-receive").addEventListener("click", (e) => { receiveFrom = !receiveFrom; e.currentTarget.classList.toggle("on", receiveFrom); });
  document.getElementById("save-sec-button").addEventListener("click", () => {
    const name = document.getElementById("new-sec-name").value.trim();
    if (!name) { closeModal(); return; }
    const newId = makeId(character.noteSections);
    if (receiveFrom) character.noteSections.forEach(s => { s.receiveFrom = false; });
    character.noteSections.push({ id: newId, name, autoShare, receiveFrom });
    openNoteSections[newId] = true;
    closeModal();
    renderContent();
  });
}

function openEditSectionModal(sectionId) {
  const section = character.noteSections.find(s => sameId(s.id, sectionId));
  sectionId = section ? section.id : sectionId;
  let autoShare = section.autoShare, receiveFrom = section.receiveFrom;

  openModal("sheet", `
    <div class="modal-heading">Edit Section</div>
    ${textFieldHtml("edit-sec-name", "Name", section.name)}
    ${toggleLineHtml("sw-edit-autoshare", "Auto-share notes added here", autoShare)}
    ${toggleLineHtml("sw-edit-receive", "Receive shared notes here", receiveFrom)}
    <div class="btn-row-2">
      <button class="btn-primary" id="save-sec-edit-button">Save Changes</button>
      <button class="btn-primary btn-danger" id="remove-sec-button">Remove</button>
    </div>
  `);
  guardModalEdits();

  document.getElementById("sw-edit-autoshare").addEventListener("click", (e) => { autoShare = !autoShare; e.currentTarget.classList.toggle("on", autoShare); });
  document.getElementById("sw-edit-receive").addEventListener("click", (e) => {
    if (!receiveFrom) {
      receiveFrom = true;
      e.currentTarget.classList.add("on");
    } else {
      const othersOn = character.noteSections.some(s => s.id !== sectionId && s.receiveFrom);
      const turnOff = (el) => { receiveFrom = false; el.classList.remove("on"); };
      if (othersOn) { turnOff(e.currentTarget); return; }
      const toggleEl = e.currentTarget;
      confirmModal({
        title: "Stop receiving shared notes?",
        body: "No other section is set to receive them, so you won't get any until you turn it on somewhere.",
        confirmLabel: "Turn off", danger: true,
        onConfirm: () => turnOff(toggleEl)
      });
      return;
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
    confirmModal({
      title: `Remove "${section.name}"?`,
      body: count > 0
        ? `This section contains ${count} note${count === 1 ? "" : "s"}. They will be deleted too.`
        : "This section is empty.",
      confirmLabel: "Remove", danger: true,
      onConfirm: () => {
        character.noteSections = character.noteSections.filter(s => s.id !== sectionId);
        character.notes = character.notes.filter(n => n.sectionId !== sectionId);
        delete openNoteSections[sectionId];
        closeModal();
        renderContent();
      }
    });
  });
}

function openNoteEditorModal(noteId) {
  const note = character.notes.find(n => sameId(n.id, noteId));
  noteId = note ? note.id : noteId;
  const section = character.noteSections.find(s => s.id === note.sectionId);
  const isReadOnly = !!(note.sharing && !note.sharing.sharedByMe && note.sharing.permission === "view");

  let shareLine = "";
  if (note.sharing) {
    if (note.sharing.sharedByMe) {
      const names = note.sharing.sharedWith.map(m => `${esc(m.name)} (${m.permission})`).join(", ");
      shareLine = `<div class="share-info">\u2191 Sharing with ${esc(names)}${note.sharing.continuous ? "" : " \u00B7 snapshot"}</div>`;
    } else {
      shareLine = `<div class="share-info">\u2193 Shared by ${esc(note.sharing.sharedByName)}${note.sharing.permission === "view" ? " \u00B7 view only" : ""}</div>`;
    }
  }

  openModal("full", `
    <div class="modal-heading" style="display:flex;justify-content:space-between;align-items:center;">
      <span>${esc(section.name)}</span>
      <button class="add-link" id="note-menu-button" style="font-size:20px;line-height:1;">\u22EF</button>
    </div>
    <input id="note-title-input" class="note-title-field" placeholder="Title" value="${esc(note.title)}" ${isReadOnly ? "readonly" : ""}>
    <div class="item-meta" style="margin-bottom:10px;">${new Date(note.updatedAt).toLocaleString()}</div>
    ${shareLine}
    <textarea id="note-body-input" class="note-body-field" placeholder="Note" ${isReadOnly ? "readonly" : ""}>${esc(note.body)}</textarea>
    <button class="btn-primary" id="save-note-button" style="margin-top:10px;">Save</button>
  `);
  guardModalEdits();

  function commit() {
    if (isReadOnly) return;
    note.title = document.getElementById("note-title-input").value;
    note.body = document.getElementById("note-body-input").value;
    note.updatedAt = Date.now();
    partyResendNoteSoon(note);   // debounced; no-op unless shared continuously
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
    <button class="btn-primary btn-danger" id="menu-delete-button">Delete</button>
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
  const newId = makeId(character.notes);
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
  confirmModal({
    title: `Delete "${note.title || "Untitled"}"?`,
    confirmLabel: "Delete", danger: true,
    onConfirm: () => {
      character.notes = character.notes.filter(n => n.id !== noteId);
      renderContent();
    }
  });
}

/* One row per person the note is or could be shared with. The permission is
   carried on the button, and so is the device -- the name is only ever a
   label, because two players can bring characters called the same thing. */
function shareRowHtml(name, device, permission) {
  const label = permission === "off" ? "Not shared" : (permission === "edit" ? "Can Edit" : "Can View");
  return `
    <div class="member-row">
      <span>${esc(name)}</span>
      <button class="toggle-btn" data-perm="${esc(permission)}" data-member-btn="${esc(name)}" data-member-device="${esc(device)}">${esc(label)}</button>
    </div>
  `;
}

function openShareModal(noteId) {
  const note = character.notes.find(n => sameId(n.id, noteId));
  // keyed by device, not name: two players can bring characters with the same
  // name, and the thing we ultimately send to is the device
  const existing = {};
  if (note.sharing && note.sharing.sharedByMe) {
    note.sharing.sharedWith.forEach(m => { if (m.device) existing[m.device] = m.permission; });
  }
  const wasSharedWith = note.sharing && note.sharing.sharedByMe
    ? note.sharing.sharedWith.map(m => m.device).filter(Boolean) : [];
  const here = partyMemberList(party.members, deviceId());
  const away = absentShares(note, party.members, deviceId());
  let continuous = note.sharing && note.sharing.sharedByMe ? note.sharing.continuous : true;

  openModal("full", `
    <div class="modal-heading">Share Note</div>
    ${toggleLineHtml("sw-continuous", "Keep updated for everyone (continuous)", continuous)}
    ${fieldLabelHtml("Party", { style: "margin-top:14px;" })}
    <div id="share-member-list">
      ${here.map(m => shareRowHtml(m.name, m.device, existing[m.device] || "off")).join("")}
      ${here.length ? "" : `<div class="empty-hint">Nobody else is in the party.</div>`}
      ${away.length ? `
        <div class="breakdown-subhead">Not at the table right now</div>
        <div class="breakdown-source" style="margin-bottom:8px;">Still shared. They get it again when they rejoin.</div>
        ${away.map(s => shareRowHtml(s.name, s.device, s.permission)).join("")}
      ` : ""}
    </div>
    <button class="btn-primary" id="save-share-button" style="margin-top:14px;">Save Sharing</button>
    ${note.sharing && note.sharing.sharedByMe ? `<button class="btn-primary btn-danger" id="stop-share-button" style="margin-top:8px;">Stop Sharing</button>` : ""}
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
      if (btn.dataset.perm !== "off") {
        sharedWith.push({ name: btn.dataset.memberBtn, device: btn.dataset.memberDevice, permission: btn.dataset.perm });
      }
    });
    note.sharing = sharedWith.length ? { sharedByMe: true, continuous, sharedWith } : null;
    if (sharedWith.length) delete note.autoShareOptOut;

    /* Anyone dropped from the list has to be told, or their copy sits there
       looking shared forever. Taking something back is as much a part of
       sharing as handing it over. */
    const nowShared = sharedWith.map(m => m.device);
    partyUnshareNote(note.id, wasSharedWith.filter(d => nowShared.indexOf(d) === -1));
    const sent = partyShareNote(note, sharedWith.filter(m => m.device));

    closeModal();
    renderContent();
    if (sharedWith.length) showToast(sent ? "Shared with " + sent + (sent === 1 ? " player" : " players") : "Not connected \u2014 nothing sent");
    openNoteEditorModal(noteId);
  });

  const stopBtn = document.getElementById("stop-share-button");
  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      partyUnshareNote(note.id, (note.sharing.sharedWith || []).map(m => m.device).filter(Boolean));
      note.sharing = null;
      note.autoShareOptOut = true;   // outranks the section's auto-share rule
      closeModal();
      renderContent();
      openNoteEditorModal(noteId);
    });
  }
}
