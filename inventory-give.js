/* ============================================================
   GIVING
   ============================================================

   Handing an item, a pack or a purse of coin to another player: the quantity
   picker, the recipient picker, the offer the other phone answers, and the
   window the giver watches while they decide.

   Lifted out of tab-inventory.js when that file hit the structure suite's
   1,500-line cap. It is a clean seam rather than an arbitrary one -- everything
   here is about the moment something leaves your sheet for somebody else's, and
   none of it is needed to draw an inventory. */

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
    <div class="modal-heading">Send Coins</div>
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
  if (qty >= currentQty) removeItemAndContents(character, item);
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
    applyReceivedItem(character, landed.item, offer.item.contents);
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
