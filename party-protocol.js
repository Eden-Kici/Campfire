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

  if (msg.t === "bye") {
    if (typeof msg.device !== "string") return null;
    return { t: "bye", device: msg.device };
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

function mergeRosterEntry(members, entry) {
  const next = (members || []).slice();
  const at = next.findIndex(m => m.device === entry.device);
  // Object.assign rather than replace, so the local-only fields that never
  // travel -- `you`, and the avatar we deliberately don't send -- survive an
  // update from the far side
  if (at === -1) next.push(Object.assign({}, entry));
  else next[at] = Object.assign({}, next[at], entry);
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
