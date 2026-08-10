/* ============================================================
   PARTY FINDER (POC — fake discovery, no real networking)
   ============================================================ */

// Each fake party sets its own visibility combo, so hosting's three controls
// -- show classes, show levels, how hit points read -- all have somewhere to
// be seen in the demo, not just in a form nobody submits.
const FAKE_PARTIES = [
  {
    name: "The Rusty Blades", gm: "Mara", cap: 6,
    settings: { showClasses: true, showLevels: true, hpDisplay: "stats" },
    members: [
      { name: "Borin Ashfall", classNames: "Fighter", level: 5, hp: 32, maxHp: 40 },
      { name: "Kira Dawnstrike", classNames: "Cleric", level: 5, hp: 38, maxHp: 38 },
      { name: "Thistle Nix", classNames: "Rogue", level: 4, hp: 12, maxHp: 30 }
    ]
  },
  {
    name: "Ashenvale Company", gm: "Tom\u00e1s", cap: 8,
    settings: { showClasses: true, showLevels: false, hpDisplay: "estimate" },
    members: [
      { name: "Corvin Blackwood", classNames: "Paladin", level: 6, hp: 5, maxHp: 44 },
      { name: "Wren Ashby", classNames: "Ranger", level: 6, hp: 40, maxHp: 40 },
      { name: "Petra Voss", classNames: "Wizard", level: 5, hp: 18, maxHp: 18 },
      { name: "Odalys Marrow", classNames: "Barbarian", level: 6, hp: 0, maxHp: 50, deathSaves: { successes: 1, failures: 1 } },
      { name: "Finch Talbot", classNames: "Bard", level: 5, hp: 22, maxHp: 22 }
    ]
  },
  {
    // the one locked party in the fake pool, so the PIN gate has something to
    // exercise. "0000" is a stand-in for whatever the GM actually set. It's
    // also the most private table -- classes, levels and HP all hidden.
    name: "Order of the Ember", gm: null, cap: 4, locked: true, pin: "0000",
    settings: { showClasses: false, showLevels: false, hpDisplay: "hide" },
    members: [
      { name: "Vex Emberhand", owner: true, classNames: "Warlock", level: 7, hp: 30, maxHp: 46 },
      { name: "Nyla Stormcaller", classNames: "Sorcerer", level: 6, hp: 21, maxHp: 34 }
    ]
  }
];

function defaultPartySettings() {
  return { showClasses: true, showLevels: true, hpDisplay: "stats" };
}

let party = { status: "none", name: null, gm: null, code: null, cap: null, settings: null, members: [] };
let partyModalScreen = "landing";
let partyConnectingTo = null;

// host-form is rebuilt from scratch every time it's opened, so these hold the
// toggle state between redraws the same way the resource and item forms do --
// there's no native checkbox to read a value back from.
let hostFormShowClasses = true;
let hostFormShowLevels = true;

/* Which identity you show up as depends on where Party was opened from. The
   app has no login screen, so the character selector -- reached before any
   character is open -- is the closest thing it has to "no character chosen
   yet", and a character's own sheet is the closest thing it has to "playing
   as this character". `settings.username` stands in for an account. */
function myPartyIdentity(extra) {
  const onSheet = currentScreen === "sheet";
  const base = {
    you: true,                                  // marks which roster entry is yours, so it can be found again later
    name: onSheet ? character.name : settings.username,
    subtext: onSheet ? settings.username : null,
    pic: onSheet ? character.profilePic : null
  };
  // there's no character to report class, level or HP for until one is open
  if (onSheet) {
    base.classNames = (character.classes || []).map(c => c.name).join(" / ") || null;
    base.level = totalLevel(character);
    base.hp = character.hp.current;
    base.maxHp = calculateMaxHP(character).total;
    base.deathSaves = character.deathSaves;
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
  if (party.settings.showClasses && m.classNames) bits.push(m.classNames);
  if (party.settings.showLevels && m.level != null) bits.push("Level " + m.level);
  if (bits.length) parts.push(bits.join(" · "));

  if (m.hp != null && m.maxHp != null) {
    if (party.settings.hpDisplay === "stats") parts.push(m.hp + "/" + m.maxHp + " HP");
    else if (party.settings.hpDisplay === "estimate") parts.push(hpEstimateLabel(m.hp, m.maxHp, m.deathSaves));
  }
  return parts.join(" · ");
}

/* Your roster entry is a snapshot taken at join/host time, so picking a
   character (or switching to a different one) afterwards would otherwise
   leave you stuck showing whoever -- or whatever -- you were before. Called
   any time the active screen or character changes; a no-op if you're not in
   a party. */
function refreshMyPartyIdentity() {
  if (party.status === "none") return;
  const index = party.members.findIndex(m => m.you);
  if (index === -1) return;
  party.members[index] = myPartyIdentity({ owner: party.members[index].owner });
  redrawPartyModal();
}

function partyStatusLine() {
  const seats = party.members.length + "/" + (party.cap || "\u2014");
  if (party.status === "hosting") return `Hosting \u00b7 ${party.code ? "Code " + esc(party.code) : "Open"} \u00b7 ${seats} players`;
  return `Connected \u00b7 ${party.gm ? "GM " + esc(party.gm) : "No GM"} \u00b7 ${seats} players`;
}

function beginConnectingTo(targetParty) {
  partyConnectingTo = targetParty;
  partyModalScreen = "connecting";
  redrawPartyModal();
  setTimeout(() => {
    party = {
      status: "connected", name: targetParty.name, gm: targetParty.gm, code: null,
      cap: targetParty.cap || null, settings: targetParty.settings || defaultPartySettings(),
      members: [...targetParty.members, myPartyIdentity()]
    };
    partyModalScreen = "landing";
    renderSelectorScreen();
    redrawPartyModal();
    showToast("Connected to " + party.name);
  }, 1200);
}

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
            <div class="atk-range">${partyStatusLine()}</div>
          </div>
        </div>
        <div class="breakdown-subhead">Members</div>
        ${party.members.map(m => {
          const detail = partyMemberDetailLine(m);
          return `
          <div class="member-row">
            <div class="recipient-left">
              <div class="char-avatar">${m.pic ? `<img src="${m.pic}" alt="">` : m.name.trim().charAt(0).toUpperCase()}</div>
              <div>
                <div class="res-name">${esc(m.name)}</div>
                ${m.subtext ? `<div class="atk-range">(${esc(m.subtext)})</div>` : ""}
                ${detail ? `<div class="atk-range">${esc(detail)}</div>` : ""}
              </div>
            </div>
            ${m.owner ? `<span class="res-tag" style="background:var(--accent);color:var(--accent-ink);">OWNER</span>` : ""}
          </div>
        `;
        }).join("")}
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
            <div class="res-name">${p.locked ? "\uD83D\uDD12 " : ""}${esc(p.name)}</div>
            <div class="atk-range">${p.gm ? `GM ${esc(p.gm)} \u00B7 ` : ""}${p.members.length}${p.cap ? "/" + p.cap : ""} player${p.members.length === 1 ? "" : "s"}</div>
          </div>
          <span class="add-link">Join</span>
        </div>
      `).join("")}
      <button class="btn-secondary" id="party-back-button" style="margin-top:6px;">Back</button>
    `;
  }

  if (partyModalScreen === "pin-entry") {
    return `
      <div class="modal-heading">${esc(partyConnectingTo.name)}</div>
      <div class="breakdown-source" style="margin-bottom:14px;">\uD83D\uDD12 This party is locked. Enter the passcode to join.</div>
      ${textFieldHtml("party-pin-input", "Passcode", "", { placeholder: "0000", maxlength: 4, inputmode: "numeric" })}
      <button class="btn-primary" id="party-pin-join-button">Join</button>
      <button class="btn-secondary" id="party-back-button">Back</button>
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
    ${numberFieldHtml("host-party-cap-input", "Player Cap", 6, { min: 1, max: 20 })}
    ${textFieldHtml("host-party-pin-input", "Passcode", "",
      { placeholder: "Optional — leave blank for an open party", maxlength: 4, inputmode: "numeric" })}

    <div class="breakdown-subhead">What the party sees</div>
    ${toggleLineHtml("host-show-classes-switch", "Show Classes", hostFormShowClasses)}
    ${toggleLineHtml("host-show-levels-switch", "Show Levels", hostFormShowLevels)}
    ${selectFieldHtml("host-hp-display-input", "Hit Points", [
      { value: "stats", label: "Show Stats" },
      { value: "estimate", label: "Show Estimate" },
      { value: "hide", label: "Hide" }
    ], "stats")}

    <button class="btn-primary" id="start-hosting-button">Start Hosting</button>
    <button class="btn-secondary" id="party-back-button">Back</button>
  `;
}

function wirePartyModal() {
  if (partyModalScreen === "landing") {
    if (party.status !== "none") {
      document.getElementById("leave-party-button").addEventListener("click", () => {
        party = { status: "none", name: null, gm: null, code: null, cap: null, settings: null, members: [] };
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
      hostFormShowClasses = true;
      hostFormShowLevels = true;
      redrawPartyModal();
    });
    return;
  }

  if (partyModalScreen === "join-list") {
    document.querySelectorAll("[data-join-party]").forEach(row => {
      row.addEventListener("click", () => {
        const target = FAKE_PARTIES.find(p => p.name === row.dataset.joinParty);
        if (target.locked) {
          partyConnectingTo = target;
          partyModalScreen = "pin-entry";
          redrawPartyModal();
          return;
        }
        beginConnectingTo(target);
      });
    });
    document.getElementById("party-back-button").addEventListener("click", () => {
      partyModalScreen = "landing"; redrawPartyModal();
    });
    return;
  }

  if (partyModalScreen === "pin-entry") {
    document.getElementById("party-pin-join-button").addEventListener("click", () => {
      const entered = document.getElementById("party-pin-input").value.trim();
      if (entered !== partyConnectingTo.pin) { showToast("Incorrect passcode"); return; }
      beginConnectingTo(partyConnectingTo);
    });
    document.getElementById("party-back-button").addEventListener("click", () => {
      partyModalScreen = "join-list"; redrawPartyModal();
    });
    return;
  }

  if (partyModalScreen === "host-form") {
    wireSelect("host-hp-display-input");
    document.getElementById("host-show-classes-switch").addEventListener("click", (e) => {
      hostFormShowClasses = !hostFormShowClasses;
      e.currentTarget.classList.toggle("on", hostFormShowClasses);
    });
    document.getElementById("host-show-levels-switch").addEventListener("click", (e) => {
      hostFormShowLevels = !hostFormShowLevels;
      e.currentTarget.classList.toggle("on", hostFormShowLevels);
    });
    document.getElementById("start-hosting-button").addEventListener("click", () => {
      const name = document.getElementById("host-party-name-input").value.trim();
      if (!name) { showToast("Enter a party name"); return; }
      const cap = Math.max(1, parseInt(document.getElementById("host-party-cap-input").value) || 6);
      const pin = document.getElementById("host-party-pin-input").value.trim();
      if (pin && !/^\d{4}$/.test(pin)) { showToast("Passcode must be 4 digits"); return; }
      const hpDisplay = document.getElementById("host-hp-display-input").value;
      party = {
        status: "hosting", name, gm: null, code: pin || null, cap,
        settings: { showClasses: hostFormShowClasses, showLevels: hostFormShowLevels, hpDisplay },
        members: [myPartyIdentity({ owner: true })]
      };
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
