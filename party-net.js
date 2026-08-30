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
let pendingIncomingNotes = [];

/* Called when a character is opened. Anything that arrived while there was no
   sheet to put it on gets applied now. */
function drainPendingPartyNotes() {
  if (!pendingIncomingNotes.length || currentScreen !== "sheet") return;
  const waiting = pendingIncomingNotes;
  pendingIncomingNotes = [];
  waiting.forEach(msg => {
    applySharedNote(character, receivedNote(msg.note, msg.fromName, msg.permission, msg.from));
  });
  showToast(waiting.length === 1 ? "A shared note was waiting for you"
                                 : waiting.length + " shared notes were waiting for you");
  renderContent();
}

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
    if (!known) {
      showToast(msg.entry.name + " joined");
      // standing shares are honoured on arrival, not only at the moment you
      // first ticked the box
      partyResendNotesTo(msg.entry.device, msg.entry.name);
    }

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

  if (msg.t === "item-offer") {
    if (msg.to !== deviceId()) return;
    // there is no sheet to put it on, and leaving the giver hanging for a
    // minute is worse than telling them now
    if (currentScreen !== "sheet") { declineOffer(msg, "no character open"); return; }
    // one at a time: two accept prompts stacked on a phone is a way to tap the
    // wrong one
    if (incomingOffer) { declineOffer(msg, "busy"); return; }
    incomingOffer = msg;
    openIncomingItemModal(msg);
    return;
  }

  if (msg.t === "item-reply") {
    if (msg.to !== deviceId()) return;
    const pending = pendingGives[msg.transferId];
    if (!pending || pending.status !== "waiting") return;
    clearTimeout(pending.timer);
    pending.status = msg.accepted ? "accepted" : "declined";
    pending.reason = msg.reason;
    pending.toName = msg.fromName || pending.toName;
    if (!msg.accepted) returnGivenItem(pending);
    // reopens if the giver tapped away while waiting, which they are told they
    // may do
    showGiveStatusModal(msg.transferId);
    return;
  }

  if (msg.t === "note") {
    if (msg.to !== deviceId()) return;
    /* A note arriving while no sheet is open used to be announced and thrown
       away. It is held instead, and applied the moment a character is opened:
       the sender did their part, and losing it here would be invisible to
       both of them. */
    if (currentScreen !== "sheet") {
      pendingIncomingNotes.push(msg);
      showToast(msg.fromName + " shared a note \u2014 open a character to read it");
      return;
    }
    const known = (character.notes || []).some(n => sameId(n.id, msg.note.id));
    const placed = applySharedNote(character, receivedNote(msg.note, msg.fromName, msg.permission, msg.from));
    refreshOpenNoteEditor(placed);
    showToast(known ? msg.fromName + " updated \u201c" + (placed.title || "a note") + "\u201d"
                    : msg.fromName + " shared \u201c" + (placed.title || "a note") + "\u201d");
    renderContent();
    return;
  }

  if (msg.t === "note-edit") {
    if (msg.to !== deviceId()) return;
    const note = (character.notes || []).find(n => sameId(n.id, msg.note.id));
    // silently ignored rather than answered: an edit naming a note we never
    // shared with them, or shared read-only, is not a conversation to have
    if (!canEditSharedNote(note, msg.from)) return;

    note.title = msg.note.title;
    note.body = msg.note.body;
    note.updatedAt = msg.note.updatedAt;
    // as the owner, pass it on to everyone else -- but not back to the person
    // who is still typing it
    partyResendNote(note, msg.from);
    refreshOpenNoteEditor(note);
    showToast(msg.fromName + " edited \u201c" + (note.title || "a note") + "\u201d");
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
  const fromName = myPartyName();
  let sent = 0;
  (recipients || []).forEach(r => {
    if (partySend("note", { note: wireNote(note), to: r.device, from: deviceId(), permission: r.permission, fromName: fromName })) sent += 1;
  });
  return sent;
}

function partyUnshareNote(noteId, devices) {
  const fromName = myPartyName();
  (devices || []).forEach(device => partySend("note-unshare", { id: noteId, to: device, fromName: fromName }));
}

/* Re-sends a note that is shared continuously, to everyone it is shared with.
   Called from the editor's save, so "keep updated for everyone" means what it
   says instead of being a snapshot with a friendlier label. */
function partyResendNote(note, exceptDevice) {
  if (!note.sharing || !note.sharing.sharedByMe || !note.sharing.continuous) return 0;
  return partyShareNote(note, note.sharing.sharedWith.filter(r => r.device && r.device !== exceptDevice));
}

/* An edit to somebody else's note goes to them, not to the room. They own it,
   they are the ones who can check you were actually given edit rights, and
   they pass it on to everyone else. One hub, so two people editing cannot
   quietly diverge into two versions that nobody ever reconciles. */
let noteEditTimer = null;
function partyPushNoteEditSoon(note) {
  const share = note.sharing;
  if (!share || share.sharedByMe) return;
  if (share.permission !== "edit" || !share.sharedByDevice) return;
  clearTimeout(noteEditTimer);
  noteEditTimer = setTimeout(() => {
    partySend("note-edit", {
      note: wireNote(note), to: share.sharedByDevice,
      from: deviceId(), fromName: myPartyName()
    });
  }, 700);
}

/* One call for the note editor, because from in there it is the same act:
   you typed, and whoever should see that should see it. */
function partyPropagateNoteEdit(note) {
  if (!note.sharing) return;
  if (note.sharing.sharedByMe) partyResendNoteSoon(note);
  else partyPushNoteEditSoon(note);
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

/* Giving is the only thing in this app that destroys something on one phone in
   order to create it on another, and it is now the only thing that asks
   permission first. An item is not a notification: arriving in someone's bag
   uninvited is a change to their character that they did not make.

   So a give is an offer. The item leaves the giver's bag straight away -- they
   should not be able to promise the same sword to two people while one of them
   thinks about it -- and comes back if the answer is no, or if no answer comes
   at all. */
const GIVE_ANSWER_TIMEOUT = 60000;
let pendingGives = {};
let incomingOffer = null;

function myPartyName() {
  const me = party.members.find(m => m.you);
  return me ? me.name : settings.username;
}

function partyGiveItem(item, qty, recipient) {
  const transferId = makeId(character.inventory);
  const ok = partySend("item-offer", {
    transferId: transferId,
    item: wireItem(Object.assign({}, item, { qty: qty })),
    to: recipient.device,
    from: deviceId(),
    fromName: myPartyName()
  });
  if (!ok) return null;

  pendingGives[transferId] = {
    item: JSON.parse(JSON.stringify(item)),
    qty: qty,
    toName: recipient.name,
    status: "waiting",
    timer: setTimeout(() => giveWentUnanswered(transferId), GIVE_ANSWER_TIMEOUT)
  };
  return transferId;
}

function partyGiveCoin(amount, recipient) {
  const transferId = makeId(character.inventory);
  const ok = partySend("item-offer", {
    transferId: transferId,
    coin: amount,
    to: recipient.device,
    from: deviceId(),
    fromName: myPartyName()
  });
  if (!ok) return null;

  pendingGives[transferId] = {
    coin: JSON.parse(JSON.stringify(amount)),
    toName: recipient.name,
    status: "waiting",
    timer: setTimeout(() => giveWentUnanswered(transferId), GIVE_ANSWER_TIMEOUT)
  };
  return transferId;
}

/* Back in the bag: onto the original stack if it survived, as its own row if
   the whole thing was handed over. Coin simply goes back in the purse. */
function returnGivenItem(pending) {
  if (pending.coin) { addToPurse(character.purse, pending.coin); renderContent(); return; }
  const stack = character.inventory.find(i => sameId(i.id, pending.item.id));
  if (stack) stack.qty = (stack.qty || 0) + pending.qty;
  else character.inventory.push(Object.assign({}, pending.item, { qty: pending.qty }));
  renderContent();
}

function giveWentUnanswered(transferId) {
  const pending = pendingGives[transferId];
  if (!pending || pending.status !== "waiting") return;
  pending.status = "unanswered";
  returnGivenItem(pending);
  showGiveStatusModal(transferId);
}

/* Sharing is a standing arrangement rather than a single send. Someone who was
   offline when you shared, or who joined the party afterwards, has nothing
   until they are told again -- so the moment a device appears on the roster,
   every note already marked as shared with it goes out.

   This is the whole reason sharing is stored by device and kept after the
   session ends. */
function partyResendNotesTo(device, theirName) {
  const fromName = myPartyName();
  // a section set to auto-share means everyone at the table, including whoever
  // just walked in
  enrolInAutoShares(character, device, theirName || "Player");
  let sent = 0;
  notesSharedWith(character, device).forEach(note => {
    const permission = sharePermissionFor(note, device);
    if (partySend("note", { note: wireNote(note), to: device, from: deviceId(), permission: permission, fromName: fromName })) sent += 1;
  });
  return sent;
}

function partyPushEffect(group, toDevice) {
  return partySend("effect", {
    // flattened at our level, not theirs -- see wireEffectGroup
    group: wireEffectGroup(group, totalLevel(character)),
    to: toDevice || "*",
    fromName: myPartyName()
  });
}

/* The roster shows up in three places, and all three are wrong the moment it
   changes. */
function refreshPartyDependentScreens() {
  redrawPartyModal();
  renderSelectorScreen();
  if (currentScreen === "sheet") renderContent();
}
