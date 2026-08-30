/* ============================================================
   PARTY
   ============================================================

   The screens. What a message means is in party-protocol.js, the socket is in
   party-net.js, and this file is only what a player looks at.

   There used to be three invented parties in here and a fake scan that took
   1.1 seconds. Discovery is gone with them, and not because it was hard: a web
   page cannot see what else is on the wifi, and a phone's browser cannot
   accept an incoming connection, so "parties near you" is a thing this app is
   structurally unable to offer. A room code typed from one screen into another
   is what replaces it.

   The passcode went too. With a real relay the room code IS the secret, and a
   second passcode on top of it would be theatre: the relay deliberately does
   not read messages, so it cannot enforce one, and any client is free to
   ignore it. Better to have one secret that actually works than two where one
   is a prop. */

function defaultPartySettings() {
  return { showClasses: true, showLevels: true, hpDisplay: "stats", showCustom: false };
}

/* Whether you can see that someone's character is a custom build.

   The host always can -- they are the one who has to decide whether a
   36-point-buy Barbarian is coming to their table -- and the toggle decides
   whether everyone else does too. Off by default, because "this player broke
   the rules" is the host's information to share, not the app's to broadcast. */
function canSeeCustomBuilds() {
  if (party.status === "hosting") return true;
  return !!(party.settings && party.settings.showCustom);
}

let party = { status: "none", name: null, code: null, cap: null, settings: null, members: [] };
let partyModalScreen = "landing";

// host-form is rebuilt from scratch every time it's opened, so these hold the
// toggle state between redraws the same way the resource and item forms do --
// there's no native checkbox to read a value back from.
let hostFormShowClasses = true;
let hostFormShowLevels = true;
let hostFormShowCustom = false;

/* Which identity you show up as depends on where Party was opened from. The
   app has no login screen, so the character selector -- reached before any
   character is open -- is the closest thing it has to "no character chosen
   yet", and a character's own sheet is the closest thing it has to "playing
   as this character". `settings.username` stands in for an account. */
function myPartyIdentity(extra) {
  const onSheet = currentScreen === "sheet";
  const base = {
    you: true,                                  // marks which roster entry is yours, so it can be found again later
    device: deviceId(),                         // and this is what every other phone knows us by
    name: onSheet ? character.name : settings.username,
    subtext: onSheet ? settings.username : null,
    pic: onSheet ? character.profilePic : null  // local only; never sent, see ROSTER_WIRE_FIELDS
  };
  // there's no character to report class, level or HP for until one is open
  if (onSheet) {
    base.classNames = (character.classes || []).map(c => c.name).join(" / ") || null;
    base.level = totalLevel(character);
    base.hp = character.hp.current;
    base.maxHp = calculateMaxHP(character).total;
    base.deathSaves = character.deathSaves;
    // carried on the roster entry rather than looked up, because the other
    // phones have no sheet of ours to consult
    base.customBuild = !!character.customBuild;
  }
  return Object.assign(base, extra || {});
}

/* The three states the rules actually track (dead, dying, and the 0-HP-but-
   stabilised state after three successful death saves) don't line up with
   the four-word summary a party roster wants, so this reads the same
   deathSaves/HP numbers the sheet does and maps them onto Dead, Dying,
   Bloodied or Stable rather than reusing deathSaveState()'s labels directly. */
function hpEstimateLabel(hp, maxHp, deathSaves) {
  const saves = deathSaves || { successes: 0, failures: 0 };
  if (saves.failures >= 3) return "Dead";
  if (hp <= 0 && saves.failures < 3 && saves.successes < 3) return "Dying";
  const pct = maxHp > 0 ? hp / maxHp : 0;
  return pct < 0.5 ? "Bloodied" : "Stable";
}

// What a roster row says about a member beyond their name -- entirely a
// function of the party's own visibility settings, so the same member data
// renders differently at two different tables.
function partyMemberDetailLine(m) {
  if (!party.settings) return "";
  const parts = [];
  const bits = [];
  if (m.customBuild && canSeeCustomBuilds()) bits.push("Custom");
  if (party.settings.showClasses && m.classNames) bits.push(m.classNames);
  if (party.settings.showLevels && m.level != null) bits.push("Level " + m.level);
  if (bits.length) parts.push(bits.join(" · "));

  if (m.hp != null && m.maxHp != null) {
    if (party.settings.hpDisplay === "stats") parts.push(m.hp + "/" + m.maxHp + " HP");
    else if (party.settings.hpDisplay === "estimate") parts.push(hpEstimateLabel(m.hp, m.maxHp, m.deathSaves));
  }
  return parts.join(" · ");
}

/* Your roster entry is a snapshot, so picking a character (or switching to a
   different one) afterwards would otherwise leave you stuck showing whoever --
   or whatever -- you were before. Called any time the active screen or
   character changes, and again from renderContent for everything else; a
   no-op if you're not in a party. */
function refreshMyPartyIdentity() {
  if (party.status === "none") return;
  const index = party.members.findIndex(m => m.you);
  if (index === -1) return;
  party.members[index] = myPartyIdentity({ owner: party.members[index].owner });
  partyAnnounceMe();
  redrawPartyModal();
}

/* The network half of refreshMyPartyIdentity, with no redraw in it, so
   renderContent can call it on every mutation without repainting a modal.
   partyAnnounceMe already drops anything that hasn't changed. */
function announceMyPartyState() {
  if (party.status === "none") return;
  const index = party.members.findIndex(m => m.you);
  if (index === -1) return;
  party.members[index] = myPartyIdentity({ owner: party.members[index].owner });
  partyAnnounceMe();
}

function partyStatusLine() {
  const net = partyNetStatusLine();
  if (net) return net;
  const seats = party.members.length + (party.cap ? "/" + party.cap : "") + " player" + (party.members.length === 1 ? "" : "s");
  return (party.status === "hosting" ? "Hosting" : "Connected") + " · " + seats;
}

function openPartyFinder() {
  partyModalScreen = "landing";
  openModal("sheet", '<div data-party-modal="1"></div>');
  redrawPartyModal();
}

/* Both renderContent and an inbound message reach this, and either can fire
   while the player has some entirely different modal open -- so it repaints
   only when what's on screen is actually ours. */
function redrawPartyModal() {
  const box = document.querySelector("#modal-overlay .modal-content");
  if (!box || !box.querySelector("[data-party-modal]")) return;
  box.innerHTML = partyModalHtml();
  wirePartyModal();
}

function leaveParty() {
  partyAnnounceLeaving();
  partyCloseSocket();
  party = { status: "none", name: null, code: null, cap: null, settings: null, members: [] };
  partyLastAnnounced = null;
  renderSelectorScreen();
  redrawPartyModal();
  if (currentScreen === "sheet") renderContent();
  showToast("Left the party");
}

/* ---------- markup ---------- */

function partyModalHtml() {
  return `<div data-party-modal="1">${partyModalBodyHtml()}</div>`;
}

function partyModalBodyHtml() {
  if (partyModalScreen === "landing" && party.status !== "none") return partyRosterHtml();
  if (partyModalScreen === "landing") return partyStartHtml();
  if (partyModalScreen === "join-form") return partyJoinFormHtml();
  return partyHostFormHtml();
}

function partyStartHtml() {
  return `
    <div class="modal-heading">Party</div>
    <div class="breakdown-source" style="margin-bottom:14px;">Connect with your table.</div>
    <button class="btn-primary" id="join-party-button" style="margin-bottom:8px;">Join a Party</button>
    <button class="btn-secondary" id="host-party-button">Host a Party</button>
  `;
}

function partyRosterHtml() {
  return `
    <div class="modal-heading">Party</div>
    <div class="res-row">
      <div>
        <div class="res-name">${esc(party.name || "Party")}</div>
        <div class="atk-range">${esc(partyStatusLine())}</div>
      </div>
    </div>
    ${party.code ? `
      <div class="breakdown-subhead">Room Code</div>
      <div class="res-row">
        <div class="res-name" style="letter-spacing:4px;font-size:22px;">${esc(party.code)}</div>
        <span class="atk-range">Others type this to join</span>
      </div>` : ""}
    <div class="breakdown-subhead">Members</div>
    ${party.members.map(m => {
      const detail = partyMemberDetailLine(m);
      return `
      <div class="member-row">
        <div class="recipient-left">
          <div class="char-avatar">${m.pic ? `<img src="${esc(m.pic)}" alt="">` : esc(m.name.trim().charAt(0).toUpperCase())}</div>
          <div>
            <div class="res-name">${esc(m.name)}${m.you ? " (you)" : ""}</div>
            ${m.subtext ? `<div class="atk-range">(${esc(m.subtext)})</div>` : ""}
            ${detail ? `<div class="atk-range">${esc(detail)}</div>` : ""}
          </div>
        </div>
        ${m.owner ? `<span class="res-tag" style="background:var(--accent);color:var(--accent-ink);">HOST</span>` : ""}
      </div>
    `;
    }).join("")}
    <button class="btn-primary btn-danger" id="leave-party-button" style="margin-top:10px;">${party.status === "hosting" ? "Stop Hosting" : "Leave Party"}</button>
    <button class="btn-secondary" id="party-done-button">Done</button>
  `;
}

function partyJoinFormHtml() {
  return `
    <div class="modal-heading">Join a Party</div>
    <div class="breakdown-source" style="margin-bottom:14px;">Ask the host for their four-character room code.</div>
    ${textFieldHtml("join-code-input", "Room Code", "",
      { placeholder: "e.g. KT4M", maxlength: 4, autocapitalize: "characters" })}
    <button class="btn-primary" id="join-code-button">Join</button>
    <button class="btn-secondary" id="party-back-button">Back</button>
  `;
}

function partyHostFormHtml() {
  return `
    <div class="modal-heading">Host a Party</div>
    ${textFieldHtml("host-party-name-input", "Party Name", "",
      { placeholder: "e.g. The Rusty Blades", style: "margin-top:10px;" })}
    ${numberFieldHtml("host-party-cap-input", "Player Cap", 6, { min: 1, max: 8 })}

    <div class="breakdown-subhead">What the party sees</div>
    ${toggleLineHtml("host-show-classes-switch", "Show Classes", hostFormShowClasses)}
    ${toggleLineHtml("host-show-levels-switch", "Show Levels", hostFormShowLevels)}
    ${toggleLineHtml("host-show-custom-switch", "Show Custom Characters", hostFormShowCustom,
      { hint: "Off, only you see who is a custom build" })}
    ${selectFieldHtml("host-hp-display-input", "Hit Points", [
      { value: "stats", label: "Show Stats" },
      { value: "estimate", label: "Show Estimate" },
      { value: "hide", label: "Hide" }
    ], "stats")}

    <button class="btn-primary" id="start-hosting-button">Start Hosting</button>
    <button class="btn-secondary" id="party-back-button">Back</button>
  `;
}

/* ---------- wiring ---------- */

function wirePartyModal() {
  if (partyModalScreen === "landing" && party.status !== "none") {
    document.getElementById("leave-party-button").addEventListener("click", leaveParty);
    document.getElementById("party-done-button").addEventListener("click", closeModal);
    return;
  }

  if (partyModalScreen === "landing") {
    document.getElementById("join-party-button").addEventListener("click", () => {
      partyModalScreen = "join-form";
      redrawPartyModal();
    });
    document.getElementById("host-party-button").addEventListener("click", () => {
      partyModalScreen = "host-form";
      hostFormShowClasses = true;
      hostFormShowLevels = true;
      hostFormShowCustom = false;
      redrawPartyModal();
    });
    return;
  }

  if (partyModalScreen === "join-form") {
    document.getElementById("join-code-button").addEventListener("click", () => {
      const typed = document.getElementById("join-code-input").value;
      const code = normaliseRoomCode(typed);
      if (!isRoomCode(code)) { showToast("That isn't a room code"); return; }
      joinPartyByCode(code);
    });
    document.getElementById("party-back-button").addEventListener("click", () => {
      partyModalScreen = "landing"; redrawPartyModal();
    });
    return;
  }

  // host-form
  wireSelect("host-hp-display-input");
  document.getElementById("host-show-classes-switch").addEventListener("click", (e) => {
    hostFormShowClasses = !hostFormShowClasses;
    e.currentTarget.classList.toggle("on", hostFormShowClasses);
  });
  document.getElementById("host-show-levels-switch").addEventListener("click", (e) => {
    hostFormShowLevels = !hostFormShowLevels;
    e.currentTarget.classList.toggle("on", hostFormShowLevels);
  });
  document.getElementById("host-show-custom-switch").addEventListener("click", (e) => {
    hostFormShowCustom = !hostFormShowCustom;
    e.currentTarget.classList.toggle("on", hostFormShowCustom);
  });
  document.getElementById("start-hosting-button").addEventListener("click", () => {
    const name = document.getElementById("host-party-name-input").value.trim();
    if (!name) { showToast("Enter a party name"); return; }
    const cap = Math.max(1, Math.min(8, parseInt(document.getElementById("host-party-cap-input").value) || 6));
    startHosting(name, cap, document.getElementById("host-hp-display-input").value);
  });
  document.getElementById("party-back-button").addEventListener("click", () => {
    partyModalScreen = "landing"; redrawPartyModal();
  });
}

function startHosting(name, cap, hpDisplay) {
  const code = makeRoomCode();
  party = {
    status: "hosting", name: name, code: code, cap: cap,
    settings: { showClasses: hostFormShowClasses, showLevels: hostFormShowLevels, hpDisplay: hpDisplay, showCustom: hostFormShowCustom },
    members: [myPartyIdentity({ owner: true })]
  };
  partyModalScreen = "landing";
  partyConnect(code);
  renderSelectorScreen();
  redrawPartyModal();
  if (currentScreen === "sheet") renderContent();
}

/* The name and the visibility rules are the host's to set, so a joiner starts
   with placeholders and adopts the real ones from the host's first message. */
function joinPartyByCode(code) {
  party = {
    status: "connected", name: "Party " + code, code: code, cap: null,
    settings: defaultPartySettings(),
    members: [myPartyIdentity()]
  };
  partyModalScreen = "landing";
  partyConnect(code);
  renderSelectorScreen();
  redrawPartyModal();
  if (currentScreen === "sheet") renderContent();
}
