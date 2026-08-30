/* ============================================================
   PARTY NETWORKING
   ============================================================

   The socket, and nothing else. What a message *means* lives in
   party-protocol.js where tests can reach it; this file only carries bytes
   between that and the relay, and owns the one thing a test cannot check:
   whether the connection is actually up.

   Kept deliberately thin, because every line in here is a line that can only
   be verified by having two phones in a room. */

const DEFAULT_RELAY_URL = "wss://campfire-relay.onrender.com";

/* A free relay instance sleeps after a quarter hour of quiet and takes the
   better part of a minute to wake, so the first connection of a session is
   slow in a way that looks exactly like a broken one. The UI says which is
   happening rather than leaving someone staring at a spinner. */
const RELAY_WAKE_HINT_AFTER = 8000;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];

let partySocket = null;
let partyNetStatus = "idle";        // idle | connecting | waking | open | retrying | failed
let partyReconnectAt = 0;
let partyReconnectTimer = null;
let partyWakeTimer = null;
let partyLastAnnounced = null;      // what we last told the room, so we only speak when something changed

function relayEndpoint(code) {
  let base = String(settings.relayUrl || DEFAULT_RELAY_URL).trim().replace(/\/+$/, "");
  // people paste the address out of a browser bar, where it says https
  base = base.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
  if (!/^wss?:/i.test(base)) base = "wss://" + base;
  return base + "/?room=" + encodeURIComponent(code);
}

function partyNetStatusLine() {
  if (partyNetStatus === "open") return null;
  if (partyNetStatus === "connecting") return "Connecting…";
  if (partyNetStatus === "waking") return "Waking the relay… this can take a minute";
  if (partyNetStatus === "retrying") return "Connection lost · reconnecting…";
  if (partyNetStatus === "failed") return "Can't reach the relay";
  return null;
}

function setPartyNetStatus(status) {
  if (partyNetStatus === status) return;
  partyNetStatus = status;
  redrawPartyModal();
  renderSelectorScreen();
}

function partyConnect(code) {
  partyCloseSocket();
  clearTimeout(partyWakeTimer);
  setPartyNetStatus("connecting");

  partyWakeTimer = setTimeout(() => {
    if (partyNetStatus === "connecting") setPartyNetStatus("waking");
  }, RELAY_WAKE_HINT_AFTER);

  let socket;
  try { socket = new WebSocket(relayEndpoint(code)); }
  catch (err) { setPartyNetStatus("failed"); return; }
  partySocket = socket;

  socket.onopen = () => {
    if (partySocket !== socket) return;
    clearTimeout(partyWakeTimer);
    partyReconnectAt = 0;
    setPartyNetStatus("open");
    // announce ourselves; everyone already here answers with their own entry
    partyLastAnnounced = null;
    partyAnnounceMe();
  };

  socket.onmessage = (event) => {
    if (partySocket !== socket) return;
    handlePartyMessage(event.data);
  };

  socket.onclose = () => {
    if (partySocket !== socket) return;
    clearTimeout(partyWakeTimer);
    partySocket = null;
    if (party.status === "none") { setPartyNetStatus("idle"); return; }
    schedulePartyReconnect(code);
  };

  socket.onerror = () => { /* onclose always follows, and does the work */ };
}

/* Reconnects for as long as the player still thinks they are in a party.
   Leaving is the only thing that stops it, because a dropped phone that comes
   back should rejoin without anyone touching it. */
function schedulePartyReconnect(code) {
  const delay = RECONNECT_DELAYS[Math.min(partyReconnectAt, RECONNECT_DELAYS.length - 1)];
  partyReconnectAt += 1;
  setPartyNetStatus(partyReconnectAt > RECONNECT_DELAYS.length ? "failed" : "retrying");
  clearTimeout(partyReconnectTimer);
  partyReconnectTimer = setTimeout(() => {
    if (party.status !== "none") partyConnect(code);
  }, delay);
}

function partyCloseSocket() {
  clearTimeout(partyReconnectTimer);
  clearTimeout(partyWakeTimer);
  const socket = partySocket;
  partySocket = null;
  if (socket) { try { socket.close(); } catch (err) { /* already gone */ } }
}

function partySend(type, payload) {
  if (!partySocket || partySocket.readyState !== 1) return false;
  try { partySocket.send(partyMessage(type, payload)); return true; }
  catch (err) { return false; }
}

/* ---------- saying who we are ---------- */

/* Called from renderContent, which is the app's "something changed" hook, so
   losing hit points or switching character reaches the other phones without
   every mutation having to remember to say so. The comparison against what we
   last sent is what stops that being a message per keystroke. */
function partyAnnounceMe(isReply) {
  if (party.status === "none") return;
  const me = party.members.find(m => m.you);
  if (!me) return;

  const wire = wireRosterEntry(me);
  const asText = JSON.stringify(wire);
  if (!isReply && asText === partyLastAnnounced) return;
  partyLastAnnounced = asText;

  const payload = { entry: wire, reply: !!isReply };
  // only the host's copy of the visibility rules is authoritative, so only
  // the host sends them
  if (party.status === "hosting") {
    payload.settings = party.settings;
    payload.partyName = party.name;
  }
  partySend("here", payload);
}

function partyAnnounceLeaving() {
  partySend("bye", { device: deviceId() });
}

/* ---------- what arrives ---------- */

let partyWarnedAboutVersion = false;

function handlePartyMessage(raw) {
  const msg = parsePartyMessage(raw);
  if (!msg) return;

  if (msg.t === "version-mismatch") {
    if (!partyWarnedAboutVersion) {
      partyWarnedAboutVersion = true;
      showToast("Someone is on a different version of Campfire");
    }
    return;
  }

  if (msg.t === "here") {
    if (msg.entry.device === deviceId()) return;      // our own words, bounced
    const known = party.members.some(m => m.device === msg.entry.device);
    party.members = mergeRosterEntry(party.members, msg.entry);

    // the host is the only one whose settings count, and they travel with it
    if (msg.entry.owner) {
      if (msg.settings) party.settings = msg.settings;
      if (msg.partyName) party.name = msg.partyName;
    }

    // a new arrival gets told who is already here; a reply never triggers
    // another reply, which is what keeps this from echoing forever
    if (!msg.reply) partyAnnounceMe(true);
    if (!known) showToast(msg.entry.name + " joined");

    refreshPartyDependentScreens();
    return;
  }

  if (msg.t === "bye") {
    const leaving = party.members.find(m => m.device === msg.device);
    party.members = dropRosterEntry(party.members, msg.device);
    if (leaving) showToast(leaving.name + " left");
    refreshPartyDependentScreens();
    return;
  }

  if (msg.t === "item") {
    if (msg.to !== deviceId()) return;
    // an unopened sheet cannot take delivery, so say nothing back and let the
    // giver's timeout hand it to them again
    if (currentScreen !== "sheet") { showToast(msg.fromName + " is giving you something \u2014 open a character"); return; }

    const landed = receivedItem(msg.item, character, msg.transferId);
    applyReceivedItem(character, landed.item);
    if (msg.from) partySend("item-ack", { transferId: msg.transferId, to: msg.from });

    const what = landed.item.qty > 1 ? landed.item.qty + " " + landed.item.name : landed.item.name;
    showToast(landed.missing.length
      ? msg.fromName + " gave you " + what + " \u2014 no " + landed.missing.join(" or ") + " here, so it arrived unlinked"
      : msg.fromName + " gave you " + what);
    renderContent();
    return;
  }

  if (msg.t === "item-ack") {
    if (msg.to !== deviceId()) return;
    const pending = pendingGives[msg.transferId];
    if (!pending) return;
    clearTimeout(pending.timer);
    delete pendingGives[msg.transferId];
    return;
  }

  if (msg.t === "note") {
    if (msg.to !== deviceId()) return;
    if (currentScreen !== "sheet") { showToast(msg.fromName + " shared a note \u2014 open a character"); return; }
    const known = (character.notes || []).some(n => sameId(n.id, msg.note.id));
    const placed = applySharedNote(character, receivedNote(msg.note, msg.fromName, msg.permission));
    showToast(known ? msg.fromName + " updated \u201c" + (placed.title || "a note") + "\u201d"
                    : msg.fromName + " shared \u201c" + (placed.title || "a note") + "\u201d");
    renderContent();
    return;
  }

  if (msg.t === "note-unshare") {
    if (msg.to !== deviceId()) return;
    if (currentScreen !== "sheet") return;
    const gone = removeSharedNote(character, msg.id);
    if (!gone) return;
    showToast(msg.fromName + " stopped sharing \u201c" + (gone.title || "a note") + "\u201d");
    renderContent();
    return;
  }

  if (msg.t === "effect") {
    if (msg.to !== "*" && msg.to !== deviceId()) return;
    if (currentScreen !== "sheet") { showToast(msg.fromName + " sent " + msg.group.name + " — open a character"); return; }
    applyEffectGroup(character, receivedEffectGroup(msg.group, msg.fromName));
    showToast(msg.fromName + " gave you " + msg.group.name);
    renderContent();
    return;
  }
}

/* Sharing is per recipient, because the permission is. One message each
   rather than one broadcast, so "can edit" for one person and "can view" for
   another is a thing the protocol can actually say. */
function partyShareNote(note, recipients) {
  const me = party.members.find(m => m.you);
  const fromName = me ? me.name : settings.username;
  let sent = 0;
  (recipients || []).forEach(r => {
    if (partySend("note", { note: wireNote(note), to: r.device, permission: r.permission, fromName: fromName })) sent += 1;
  });
  return sent;
}

function partyUnshareNote(noteId, devices) {
  const me = party.members.find(m => m.you);
  const fromName = me ? me.name : settings.username;
  (devices || []).forEach(device => partySend("note-unshare", { id: noteId, to: device, fromName: fromName }));
}

/* Re-sends a note that is shared continuously, to everyone it is shared with.
   Called from the editor's save, so "keep updated for everyone" means what it
   says instead of being a snapshot with a friendlier label. */
function partyResendNote(note) {
  if (!note.sharing || !note.sharing.sharedByMe || !note.sharing.continuous) return 0;
  return partyShareNote(note, note.sharing.sharedWith.filter(r => r.device));
}

/* The note editor commits on every keystroke, which is right for saving and
   very wrong for sending: typing a paragraph would be a message per letter.
   Typing pauses are where a reader is actually able to read anything, so the
   send waits for one. */
let noteResendTimer = null;
function partyResendNoteSoon(note) {
  if (!note.sharing || !note.sharing.sharedByMe || !note.sharing.continuous) return;
  clearTimeout(noteResendTimer);
  noteResendTimer = setTimeout(() => partyResendNote(note), 700);
}

/* Giving is the only thing in this app that destroys something on this phone
   in order to create it on another, so it is the only thing that waits to hear
   back. The item leaves your bag immediately, because a demo where you tap
   Give and nothing happens for a second reads as broken -- but it is held
   aside, and if nobody acknowledges it within a few seconds it comes back.

   Without this, one message lost in flight destroys the item for both players
   and neither of them ever finds out. */
const GIVE_ACK_TIMEOUT = 8000;
let pendingGives = {};

function partyGiveItem(item, qty, toDevice) {
  const me = party.members.find(m => m.you);
  const transferId = makeId(character.inventory);
  const parcel = Object.assign({}, item, { qty: qty });
  const ok = partySend("item", {
    transferId: transferId,
    item: wireItem(parcel),
    to: toDevice,
    from: deviceId(),
    fromName: me ? me.name : settings.username
  });
  if (!ok) return null;

  pendingGives[transferId] = {
    item: JSON.parse(JSON.stringify(item)),
    qty: qty,
    timer: setTimeout(() => giveWentUnanswered(transferId), GIVE_ACK_TIMEOUT)
  };
  return transferId;
}

function giveWentUnanswered(transferId) {
  const pending = pendingGives[transferId];
  if (!pending) return;
  delete pendingGives[transferId];

  // back in the bag: onto the original stack if it survived, as its own row if
  // the whole thing was handed over
  const stack = character.inventory.find(i => sameId(i.id, pending.item.id));
  if (stack) stack.qty = (stack.qty || 0) + pending.qty;
  else character.inventory.push(Object.assign({}, pending.item, { qty: pending.qty }));

  showToast("No answer \u2014 kept your " + pending.item.name);
  renderContent();
}

function partyPushEffect(group, toDevice) {
  const me = party.members.find(m => m.you);
  return partySend("effect", {
    // flattened at our level, not theirs -- see wireEffectGroup
    group: wireEffectGroup(group, totalLevel(character)),
    to: toDevice || "*",
    fromName: me ? me.name : settings.username
  });
}

/* The roster shows up in three places, and all three are wrong the moment it
   changes. */
function refreshPartyDependentScreens() {
  redrawPartyModal();
  renderSelectorScreen();
  if (currentScreen === "sheet") renderContent();
}
