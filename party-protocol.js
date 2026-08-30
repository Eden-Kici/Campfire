/* ============================================================
   PARTY PROTOCOL
   ============================================================

   What a party message means, and what a roster is.

   No DOM and no socket. Every function here is a pure function of its
   arguments, so the rules a table plays by get the same test coverage the
   calculation layer has. The relay understands none of this on purpose: it
   copies bytes between sockets in a room and stops there, which means
   everything that could be wrong is wrong in this file, where a test can
   reach it.

   Everything arriving here came off a network from a phone we do not control,
   so it is read field by field against an allow-list rather than trusted and
   merged. That is not paranoia about other players; it is that a malformed
   message from an older build should degrade a roster row, not crash the
   sheet mid-session. */

const PARTY_PROTOCOL_VERSION = 1;

/* No O or 0, no I or 1. This code gets read off one phone and typed into
   another, across a table, in bad light, by someone half paying attention. */
const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 4;

const EFFECT_DURATION_TYPES = ["Permanent", "Rounds", "Short Rest", "Long Rest"];
const HP_DISPLAY_MODES = ["stats", "estimate", "hide"];

/* Sent, and therefore also the only fields accepted on the way in. `you` is
   local bookkeeping about which row is mine, and `pic` is a base64 image that
   would be far the largest thing this app ever transmits -- six avatars is
   more traffic than a whole session of everything else put together. The
   letter avatar stands in until someone decides pictures earn their bytes. */
const ROSTER_WIRE_FIELDS = ["device", "owner", "name", "subtext", "classNames",
                            "level", "hp", "maxHp", "deathSaves", "customBuild"];

/* An avatar is sent as its own message rather than on the roster entry.

   Roster entries go out on every change to your sheet, so a picture riding
   along would be twenty kilobytes per point of damage taken. A face changes
   about once, so it is sent about once.

   The cap is well under the relay's message limit, and the pattern is strict
   for a reason: this string ends up in an <img src> on somebody else's phone.
   It has to be an image, and it has to be self-contained -- a remote URL would
   have every phone at the table quietly fetch something from a stranger. */
const MAX_AVATAR_BYTES = 48000;

function readAvatar(raw) {
  if (typeof raw !== "string" || raw.length > MAX_AVATAR_BYTES) return null;
  return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(raw) ? raw : null;
}

function makeRoomCode() {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET.charAt(Math.floor(Math.random() * ROOM_CODE_ALPHABET.length));
  }
  return code;
}

/* Forgiving about case and stray spaces, and nothing else. There is no
   0-for-O correction here on purpose: the alphabet contains neither character,
   so a typed 0 means the reader misread something else entirely and guessing
   which would send them to a different party's room. Better to reject it. */
function normaliseRoomCode(value) {
  return String(value == null ? "" : value).toUpperCase().replace(/\s+/g, "");
}

function isRoomCode(value) {
  const code = normaliseRoomCode(value);
  if (code.length !== ROOM_CODE_LENGTH) return false;
  return code.split("").every(ch => ROOM_CODE_ALPHABET.indexOf(ch) !== -1);
}

/* ---------- reading what arrived ---------- */

function clampText(value, max, fallback) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text ? text.slice(0, max) : fallback;
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function clampWhole(value, min, max) {
  const n = Math.round(Number(value));
  if (!isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function readDeathSaves(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    successes: clampWhole(raw.successes, 0, 3) || 0,
    failures: clampWhole(raw.failures, 0, 3) || 0
  };
}

function readRosterEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.device !== "string" || !/^[a-z0-9]{4,16}$/.test(raw.device)) return null;

  const entry = { device: raw.device };
  entry.name = clampText(raw.name, 40, "Adventurer");
  entry.owner = !!raw.owner;
  entry.customBuild = !!raw.customBuild;

  const subtext = clampText(raw.subtext, 40, null);
  if (subtext) entry.subtext = subtext;
  const classNames = clampText(raw.classNames, 60, null);
  if (classNames) entry.classNames = classNames;

  // a character that isn't open yet reports no level or hit points at all,
  // which is different from reporting zero
  if (raw.level != null) entry.level = clampWhole(raw.level, 1, 20);
  if (raw.hp != null) entry.hp = clampWhole(raw.hp, -999, 9999);
  if (raw.maxHp != null) entry.maxHp = clampWhole(raw.maxHp, 0, 9999);
  const saves = readDeathSaves(raw.deathSaves);
  if (saves) entry.deathSaves = saves;

  return entry;
}

function wireRosterEntry(entry) {
  const out = {};
  ROSTER_WIRE_FIELDS.forEach(key => {
    if (entry && entry[key] !== undefined && entry[key] !== null) out[key] = entry[key];
  });
  return out;
}

function readPartySettings(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    showClasses: !!raw.showClasses,
    showLevels: !!raw.showLevels,
    showCustom: !!raw.showCustom,
    hpDisplay: HP_DISPLAY_MODES.indexOf(raw.hpDisplay) === -1 ? "stats" : raw.hpDisplay
  };
}

function readEffectValue(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = {};
  Object.keys(raw).slice(0, 8).forEach(key => {
    const v = raw[key];
    if (typeof v === "string") value[key] = v.slice(0, 60);
    else if (typeof v === "number" && isFinite(v)) value[key] = v;
    else if (typeof v === "boolean") value[key] = v;
  });
  return value;
}

function readEffectGroup(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.id == null) return null;

  const rows = Array.isArray(raw.effects) ? raw.effects.slice(0, 12) : [];
  const effects = [];
  rows.forEach(row => {
    if (!row || typeof row !== "object") return;
    const category = clampText(row.category, 30, null);
    const value = readEffectValue(row.value);
    if (category && value) effects.push({ category: category, value: value });
  });

  const durationType = raw.duration && EFFECT_DURATION_TYPES.indexOf(raw.duration.type) !== -1
    ? raw.duration.type : "Permanent";

  return {
    id: String(raw.id).slice(0, 40),
    name: clampText(raw.name, 60, "Effect"),
    note: clampText(raw.note, 200, ""),
    concentration: !!raw.concentration,
    duration: {
      type: durationType,
      rounds: durationType === "Rounds" ? (clampWhole(raw.duration.rounds, 1, 1000) || 1) : null
    },
    effects: effects
  };
}

/* An effect's strength is decided by whoever cast it. But a scaling amount is
   stored as a tiers table and resolved against whoever is *holding* the
   effect, so pushing one across untouched is wrong twice over: the number
   silently changes to suit the recipient's level, and readEffectValue drops
   the table on arrival anyway -- it keeps only plain values -- leaving the
   effect with no amount at all.

   So the sender flattens it at their own level before it goes. The wire
   format carries numbers, never tables, which is also why the validator on
   the far side can stay as strict as it is. */
function wireEffectGroup(group, senderLevel) {
  const flat = JSON.parse(JSON.stringify(group));
  (flat.effects || []).forEach(row => {
    if (row && row.value && row.value.amount && typeof row.value.amount === "object") {
      row.value.amount = resolveScalingValue(row.value.amount, senderLevel);
    }
  });
  return flat;
}

/* ---------- messages ---------- */

function partyMessage(type, payload) {
  return JSON.stringify(Object.assign({ v: PARTY_PROTOCOL_VERSION, t: type }, payload || {}));
}

/* Returns null for anything unreadable, and a "version-mismatch" for a message
   from a build that speaks a different protocol. Two phones on different
   versions is an ordinary situation at a real table -- one player updated on
   the bus, the other did not -- so it gets reported rather than guessed at. */
function parsePartyMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch (err) { return null; }
  if (!msg || typeof msg !== "object") return null;
  // no version at all is not an old build, it is not one of ours
  if (typeof msg.v !== "number") return null;
  if (msg.v !== PARTY_PROTOCOL_VERSION) return { t: "version-mismatch", v: msg.v };

  if (msg.t === "here") {
    const entry = readRosterEntry(msg.entry);
    if (!entry) return null;
    return {
      t: "here",
      entry: entry,
      // only the host sends these, and only the host's copy is authoritative
      settings: readPartySettings(msg.settings),
      partyName: clampText(msg.partyName, 40, null),
      reply: !!msg.reply
    };
  }

  if (msg.t === "face") {
    if (typeof msg.device !== "string") return null;
    // an explicit null clears a face; anything unreadable is dropped entirely,
    // so a malformed picture cannot blank out someone's avatar
    if (msg.pic === null) return { t: "face", device: msg.device, pic: null };
    const pic = readAvatar(msg.pic);
    return pic ? { t: "face", device: msg.device, pic: pic } : null;
  }

  if (msg.t === "bye") {
    if (typeof msg.device !== "string") return null;
    return { t: "bye", device: msg.device };
  }

  if (msg.t === "item-offer") {
    if (msg.transferId == null) return null;
    // an offer is either goods or coin, and has to be one of them
    const item = msg.item ? readItem(msg.item) : null;
    const coin = msg.coin ? readPurse(msg.coin) : null;
    if (!item && !coin) return null;
    return {
      t: "item-offer", item: item, coin: coin,
      transferId: String(msg.transferId).slice(0, 40),
      to: typeof msg.to === "string" ? msg.to : "*",
      from: typeof msg.from === "string" ? msg.from : null,
      fromName: clampText(msg.fromName, 40, "Someone")
    };
  }

  if (msg.t === "item-reply") {
    if (msg.transferId == null) return null;
    return {
      t: "item-reply",
      transferId: String(msg.transferId).slice(0, 40),
      to: typeof msg.to === "string" ? msg.to : "*",
      accepted: !!msg.accepted,
      reason: clampText(msg.reason, 60, null),
      fromName: clampText(msg.fromName, 40, "They")
    };
  }

  if (msg.t === "note") {
    const note = readNote(msg.note);
    if (!note) return null;
    return {
      t: "note", note: note,
      to: typeof msg.to === "string" ? msg.to : "*",
      from: typeof msg.from === "string" ? msg.from : null,
      permission: msg.permission === "edit" ? "edit" : "view",
      fromName: clampText(msg.fromName, 40, "Someone")
    };
  }

  /* An edit travelling back up to the note's owner. Only the owner applies it,
     and only after checking the sender was actually given edit rights -- then
     the owner passes it on to everyone else. One hub, so two editors cannot
     quietly diverge into two versions nobody reconciles. */
  if (msg.t === "note-edit") {
    const note = readNote(msg.note);
    if (!note) return null;
    return {
      t: "note-edit", note: note,
      to: typeof msg.to === "string" ? msg.to : "*",
      from: typeof msg.from === "string" ? msg.from : null,
      fromName: clampText(msg.fromName, 40, "Someone")
    };
  }

  if (msg.t === "note-unshare") {
    if (msg.id == null) return null;
    return {
      t: "note-unshare", id: String(msg.id).slice(0, 40),
      to: typeof msg.to === "string" ? msg.to : "*",
      fromName: clampText(msg.fromName, 40, "Someone")
    };
  }

  if (msg.t === "effect") {
    const group = readEffectGroup(msg.group);
    if (!group) return null;
    return {
      t: "effect",
      group: group,
      to: typeof msg.to === "string" ? msg.to : "*",
      fromName: clampText(msg.fromName, 40, "Someone")
    };
  }

  return null;
}

/* ---------- the roster ---------- */

/* An entry is a snapshot, so an update replaces it rather than being layered
   over the last one. Merging field by field looks harmless and is not: closing
   your character sheet stops you reporting a class, a level and a number of
   hit points, and a merge would leave all three frozen on everyone else's
   screen -- a player who has put their sheet away still showing as a level 6
   Fighter on 22 hit points.

   The exceptions are the two fields that never travel: which row is ours, and
   the avatar, which arrives as its own message. */
function mergeRosterEntry(members, entry) {
  const next = (members || []).slice();
  const at = next.findIndex(m => m.device === entry.device);
  if (at === -1) { next.push(Object.assign({}, entry)); return next; }

  const local = {};
  if (next[at].you) local.you = true;
  if (next[at].pic !== undefined) local.pic = next[at].pic;
  next[at] = Object.assign({}, entry, local);
  return next;
}

function dropRosterEntry(members, device) {
  return (members || []).filter(m => m.device !== device);
}

/* The names Note Share and item Give offer you. Everyone but yourself, and
   nobody at all when you aren't in a party -- which is the honest answer, and
   a change from the four hardcoded names those screens used to show. */
function partyMemberNames(members, myDevice) {
  return (members || []).filter(m => m.device !== myDevice).map(m => m.name);
}

/* The same list, with the address attached. Sharing has to record *who* in a
   way that survives two players having the same character name, so anything
   that will later send something keeps the device rather than the name. */
function partyMemberList(members, myDevice) {
  return (members || [])
    .filter(m => m.device !== myDevice)
    .map(m => ({ name: m.name, device: m.device }));
}

/* ---------- items ---------- */

/* An item is the hardest thing in this app to hand over, and none of the
   difficulty is in the sending.

   An item refers to the *holder's* world by name. Its `category` is a key into
   their `categoryRules`, and an item in a category they have never created
   matches no rule, so it shows under no heading and provides no attack -- it
   arrives and is simply invisible. `ammunition` and `resource.refillFrom` name
   a stack on the holder's sheet: hand someone a bow and it points at a quiver
   that does not exist for them.

   So the fields that describe the item travel, and the fields that describe
   its place in someone's life do not. */
const ITEM_TEXT_FIELDS = {
  name: 60, description: 500, attackAbility: 8, proficiencyRequired: 20,
  weaponType: 20, range: 30, ammunition: 60, type: 20, rarity: 20
};
const ITEM_NUMBER_FIELDS = {
  weight: [0, 5000], acBonus: [-10, 10], attackBonus: [-10, 10], magicBonus: [-10, 10]
};

function readDamageRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  // dice notation is fed to the roll engine, so it is matched rather than
  // merely trimmed -- "9999d99" from a stranger is a denial of service
  const dice = clampText(raw.dice, 20, null);
  if (!dice || !/^\s*\d{1,3}d\d{1,3}\s*([+-]\s*\d{1,3})?\s*$/.test(dice)) return null;
  const row = { dice: dice.replace(/\s+/g, ""), type: clampText(raw.type, 30, "Bludgeoning") };
  const ability = clampText(raw.ability, 8, null);
  if (ability) row.ability = ability;
  return row;
}

function readItemResource(raw) {
  if (!raw || typeof raw !== "object") return null;
  const resource = { max: clampWhole(raw.max, 0, 9999) || 0 };
  if (raw.loaded != null) resource.loaded = clampWhole(raw.loaded, 0, 9999) || 0;
  const refill = clampText(raw.refillFrom, 60, null);
  if (refill) resource.refillFrom = refill;
  const on = raw.recharge && clampText(raw.recharge.on, 12, null);
  resource.recharge = { on: on || "none", amount: "all" };
  return resource;
}

function readItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = clampText(raw.name, 60, null);
  if (!name) return null;

  const item = { name: name, qty: clampWhole(raw.qty, 1, 9999) || 1 };
  Object.keys(ITEM_TEXT_FIELDS).forEach(key => {
    if (key === "name") return;
    const value = clampText(raw[key], ITEM_TEXT_FIELDS[key], null);
    if (value) item[key] = value;
  });
  Object.keys(ITEM_NUMBER_FIELDS).forEach(key => {
    if (raw[key] == null) return;
    const bounds = ITEM_NUMBER_FIELDS[key];
    const value = clampNumber(raw[key], bounds[0], bounds[1]);
    if (value != null) item[key] = value;
  });
  if (raw.isWeapon) item.isWeapon = true;
  if (raw.attunement) item.attunement = true;

  if (Array.isArray(raw.damage)) {
    const rows = raw.damage.slice(0, 6).map(readDamageRow).filter(Boolean);
    if (rows.length) item.damage = rows;
  }
  if (Array.isArray(raw.properties)) {
    item.properties = raw.properties.slice(0, 12)
      .map(p => clampText(p, 40, null)).filter(Boolean);
  }
  if (raw.armour && typeof raw.armour === "object") {
    item.armour = {
      base: clampWhole(raw.armour.base, 0, 30) || 10,
      kind: clampText(raw.armour.kind, 12, "light"),
      dexCap: raw.armour.dexCap == null ? null : clampWhole(raw.armour.dexCap, 0, 10)
    };
  }
  const resource = readItemResource(raw.resource);
  if (resource) item.resource = resource;

  return item;
}

/* Coin travels denomination by denomination, never as a total. Converting it
   to gold on the way and back again would hand someone 34 gold when they were
   given 340 silver, which is not the same thing to carry or to spend. */
function readPurse(raw) {
  if (!raw || typeof raw !== "object") return null;
  const purse = {};
  let any = false;
  COIN_TYPES.forEach(coin => {
    const amount = clampWhole(raw[coin.key], 0, 999999) || 0;
    if (amount > 0) { purse[coin.key] = amount; any = true; }
  });
  return any ? purse : null;
}

function wireItem(item) {
  // everything the far side is willing to read, and nothing else: `category`
  // and `isDefaultLoadout` are this sheet's arrangement, not the item
  return readItem(item);
}

/* Where a given item lands, and it is never where it left from.

   Partly because the sender's category may not exist on the far sheet. But
   mostly because arriving equipped would apply the item's effects to someone
   who never chose to put it on -- hand over a cloak and their armour class
   changes while they are looking at something else. An item you are handed
   goes in your pack. Putting it on is a decision, and it stays theirs. */
function landingCategory(target) {
  const rules = target.categoryRules || {};
  const carrying = Object.keys(rules).find(name =>
    rules[name] && !rules[name].providesAttacks && !rules[name].appliesEffects);
  if (carrying) return carrying;
  target.categoryRules = Object.assign({}, rules, {
    Carrying: { countsWeight: true, appliesEffects: false, providesAttacks: false }
  });
  return "Carrying";
}

function namedStackExists(target, name) {
  if ((target.inventory || []).some(i => i.name === name)) return true;
  return (target.resources || []).some(r => r.name === name);
}

/* Returns what landed and what had to be cut loose, so the receiver can be
   told rather than left with a bow that quietly never tracks ammunition. */
function receivedItem(rawItem, target, transferId) {
  const item = JSON.parse(JSON.stringify(rawItem));
  item.id = transferId;
  item.category = landingCategory(target);

  const missing = [];
  if (item.ammunition && !namedStackExists(target, item.ammunition)) {
    missing.push(item.ammunition);
    delete item.ammunition;
  }
  if (item.resource && item.resource.refillFrom && !namedStackExists(target, item.resource.refillFrom)) {
    missing.push(item.resource.refillFrom);
    item.resource = Object.assign({}, item.resource, { refillFrom: null });
  }
  return { item: item, missing: missing };
}

/* Keyed on the transfer, not the item. Two separate gifts of one arrow are two
   transfers and land as two rows; the same gift arriving twice, because a
   phone reconnected and the relay repeated itself, lands once. */
function applyReceivedItem(target, item) {
  if (!target.inventory) target.inventory = [];
  const at = target.inventory.findIndex(i => sameId(i.id, item.id));
  if (at === -1) target.inventory.push(item);
  else target.inventory[at] = item;
  return item;
}

/* ---------- notes ---------- */

/* A note is the one thing in this app that can cross to another sheet and be
   unambiguously correct on arrival: it is a title and a body, and it refers
   to nothing on the receiver's character. Everything about *where* it sits --
   its section, its position -- is the receiver's business, so none of it
   travels. */
function wireNote(note) {
  return {
    id: note.id, title: note.title || "", body: note.body || "",
    createdAt: note.createdAt || Date.now(), updatedAt: note.updatedAt || Date.now()
  };
}

function readNote(raw) {
  if (!raw || typeof raw !== "object" || raw.id == null) return null;
  const now = Date.now();
  return {
    id: String(raw.id).slice(0, 40),
    title: typeof raw.title === "string" ? raw.title.slice(0, 200) : "",
    // generous, but an order of magnitude under the relay's message cap
    body: typeof raw.body === "string" ? raw.body.slice(0, 20000) : "",
    createdAt: clampWhole(raw.createdAt, 0, 4102444800000) || now,
    updatedAt: clampWhole(raw.updatedAt, 0, 4102444800000) || now
  };
}

function receivedNote(note, fromName, permission, fromDevice) {
  return {
    id: note.id, sectionId: null,
    title: note.title, body: note.body,
    createdAt: note.createdAt, updatedAt: note.updatedAt,
    sharing: {
      sharedByMe: false,
      sharedByName: fromName || "Someone",
      // where an edit has to be sent back to. Without it, "can edit" means
      // you may type into your own copy and nobody ever sees it
      sharedByDevice: fromDevice || null,
      // anything that isn't explicitly edit is view: the cautious direction
      permission: permission === "edit" ? "edit" : "view"
    }
  };
}

/* Whether an edit arriving from a given device is allowed to change this note.
   The owner decides: an edit names a note by id, and ids travel, so without
   this anyone in the room could rewrite a note they were only shown. */
function canEditSharedNote(note, device) {
  if (!note || !note.sharing || !note.sharing.sharedByMe) return false;
  const share = (note.sharing.sharedWith || []).find(s => s.device === device);
  return !!(share && share.permission === "edit");
}

/* Where an arriving note lands. A section flagged "receive shared notes here"
   is the inbox when there is one. When there isn't, one gets made -- a note
   that arrives with nowhere to sit is a note the player never sees, and
   silently dropping it is the worst of the available options. */
function inboxSection(target) {
  if (!target.noteSections) target.noteSections = [];
  const flagged = target.noteSections.find(s => s.receiveFrom);
  if (flagged) return flagged;
  const made = { id: makeId(target.noteSections), name: "Shared with me", autoShare: false, receiveFrom: true };
  target.noteSections.push(made);
  return made;
}

function applySharedNote(target, note) {
  if (!target.notes) target.notes = [];
  const at = target.notes.findIndex(n => sameId(n.id, note.id));
  if (at === -1) {
    const placed = Object.assign({}, note, { sectionId: inboxSection(target).id });
    target.notes.push(placed);
    return placed;
  }
  /* Updated in place rather than replaced. The note editor holds a reference
     to the object it opened, so swapping in a new one would leave whoever is
     reading it typing into an orphan.

     The section is deliberately not touched: they moved it, that was a
     decision, and a later edit from the sender is not a reason to overrule
     it. */
  const existing = target.notes[at];
  existing.title = note.title;
  existing.body = note.body;
  existing.updatedAt = note.updatedAt;
  existing.sharing = note.sharing;
  return existing;
}

function removeSharedNote(target, id) {
  const gone = (target.notes || []).find(n => sameId(n.id, id) && n.sharing && !n.sharing.sharedByMe);
  if (!gone) return null;
  target.notes = target.notes.filter(n => n !== gone);
  return gone;
}

/* Sharing is a standing arrangement, and it is kept by device rather than by
   name -- a name is not an address. Two players can bring characters called
   the same thing, and a name tells you nothing about where to send.

   Entries written before sharing was real carry a name and nothing else. They
   can never be delivered to anybody, so they are cleared rather than left in
   the interface claiming a share that is not happening. */
function normaliseNoteSharing(target) {
  (target.notes || []).forEach(note => {
    if (!note.sharing) return;
    if (!note.sharing.sharedByMe) {
      /* A note someone really gave us keeps the sender's device-prefixed id.
         A bare number cannot have come off a wire, so an incoming share on one
         is dressing from before any of this was real. */
      if (typeof note.id === "number") note.sharing = null;
      return;
    }
    const real = (note.sharing.sharedWith || []).filter(s => s && s.device);
    note.sharing = real.length ? Object.assign({}, note.sharing, { sharedWith: real }) : null;
  });
  return target;
}

/* Auto-share belongs to the section, not to the instant a note was written in
   it. A note made in an auto-share section while you were the only person here
   was shared with nobody, and without this it would stay that way for the rest
   of its life -- which is the most likely reason a note "isn't arriving".

   Explicitly stopping a note's sharing sets autoShareOptOut, and that is the
   one thing that overrules the section: a decision the player made by hand
   outranks a rule they set once. */
function autoSharedNotes(target) {
  const auto = {};
  (target.noteSections || []).forEach(s => { if (s.autoShare) auto[String(s.id)] = true; });
  return (target.notes || []).filter(note =>
    !note.autoShareOptOut &&
    auto[String(note.sectionId)] &&
    (!note.sharing || note.sharing.sharedByMe));
}

function enrolInAutoShares(target, device, name) {
  const enrolled = [];
  autoSharedNotes(target).forEach(note => {
    if (!note.sharing) note.sharing = { sharedByMe: true, continuous: true, sharedWith: [] };
    if (!note.sharing.sharedWith.some(s => s.device === device)) {
      note.sharing.sharedWith.push({ name: name, device: device, permission: "edit" });
      enrolled.push(note);
    }
  });
  return enrolled;
}

function notesSharedWith(target, device) {
  return (target.notes || []).filter(note =>
    note.sharing && note.sharing.sharedByMe &&
    (note.sharing.sharedWith || []).some(s => s.device === device));
}

function sharePermissionFor(note, device) {
  const list = (note.sharing && note.sharing.sharedWith) || [];
  const share = list.find(s => s.device === device);
  return share ? share.permission : null;
}

/* Who a note is shared with but who isn't at the table right now. Shown in the
   share screen so a standing share is visible rather than invisible -- the
   arrangement outlives the session, and something you can't see is something
   you can't take back. */
function absentShares(note, members, myDevice) {
  if (!note.sharing || !note.sharing.sharedByMe) return [];
  const here = partyMemberList(members, myDevice).map(m => m.device);
  return (note.sharing.sharedWith || []).filter(s => s.device && here.indexOf(s.device) === -1);
}

/* ---------- receiving an effect ---------- */

/* Concentration belongs to the caster, not the target. Bless is concentrated
   on by the cleric who cast it; the three people standing in it are not
   concentrating on anything and should not have their own concentration
   dropped by receiving it. So a pushed group always lands unconcentrated,
   and says who it came from instead.

   The id is kept exactly as the sender minted it. It already carries their
   device prefix, so it cannot collide with anything of ours, and keeping it
   means pushing Bless a second time updates the group that is already there
   rather than stacking a duplicate. This is the entire reason ids grew a
   device prefix before any of this was built. */
function receivedEffectGroup(group, fromName) {
  const received = JSON.parse(JSON.stringify(group));
  received.concentration = false;
  received.fromName = fromName || "Someone";
  received.note = received.note || ("From " + received.fromName);
  return received;
}

function applyEffectGroup(target, group) {
  if (!target.activeEffects) target.activeEffects = [];
  const at = target.activeEffects.findIndex(g => sameId(g.id, group.id));
  if (at === -1) target.activeEffects.push(group);
  else target.activeEffects[at] = group;
  return target.activeEffects;
}
