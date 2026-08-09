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
            <div class="res-name">${esc(party.name)}</div>
            <div class="atk-range">${party.status === "hosting" ? `Hosting \u00B7 Code ${party.code}` : (party.gm ? `Connected \u00B7 GM ${party.gm}` : "Connected \u00B7 No GM")}</div>
          </div>
        </div>
        <div class="breakdown-subhead">Members</div>
        ${party.members.map(m => `
          <div class="member-row">
            <span>${esc(m.name)}</span>
            ${m.owner ? `<span class="res-tag" style="background:var(--accent);color:var(--accent-ink);">OWNER</span>` : ""}
          </div>
        `).join("")}
        <button class="btn-primary" id="leave-party-button" style="background:var(--danger-surface);color:var(--danger-text);margin-top:10px;">${party.status === "hosting" ? "Stop Hosting" : "Leave Party"}</button>
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
        <div class="res-row" data-join-party="${esc(p.name)}" style="cursor:pointer;">
          <div>
            <div class="res-name">${esc(p.name)}</div>
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
      <div class="empty-hint" style="padding:50px 20px;">Connecting to ${esc(partyConnectingTo.name)}\u2026</div>
    `;
  }

  // host-form
  return `
    <div class="modal-heading">Host a Party</div>
    ${textFieldHtml("host-party-name-input", "Party Name", "",
      { placeholder: "e.g. The Rusty Blades", style: "margin-top:10px;" })}
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
