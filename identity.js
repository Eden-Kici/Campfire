/* ============================================================
   DEVICE IDENTITY AND IDS
   ============================================================ */

/* Every id in this app used to be Math.max(...) + 1 over one array on one
   device. That is correct while nothing ever leaves the phone, and wrong the
   instant anything does: two phones both hand out 4, and whichever arrives
   second silently overwrites the first. Ids are now "<device>-<n>".

   The per-array counter stays. A short readable id is worth keeping and the
   device prefix already does all the uniqueness work, so there is nothing to
   gain by making the number global as well. */

const DEVICE_KEY = "campfire.device";

let deviceIdValue = null;

/* Six hex characters rather than a whole UUID. This has to be unique across
   the two or three phones at one table, not across the internet, and it is
   printed inside every id the app creates -- something you can read aloud
   while debugging on a table is worth more here than collision resistance
   nobody will ever reach. */
function makeDeviceId() {
  const source = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, "")
    // randomUUID is only defined in a secure context, and this app is opened
    // over plain http, and over file://, during development
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
  return source.slice(0, 6);
}

/* Survives reinstalling a character but not clearing site data, which is the
   right lifetime: it identifies this installation, and a cleared install is a
   new one. Kept out of `settings` deliberately -- settings are preferences the
   player chose and might reasonably want to export, this is machine state. */
function deviceId() {
  if (deviceIdValue) return deviceIdValue;
  try { deviceIdValue = localStorage.getItem(DEVICE_KEY) || null; } catch (err) { /* private mode */ }
  if (!deviceIdValue) {
    deviceIdValue = makeDeviceId();
    try { localStorage.setItem(DEVICE_KEY, deviceIdValue); } catch (err) { /* not fatal */ }
  }
  return deviceIdValue;
}

/* Saves written before this file existed hold bare numbers, so both shapes
   have to count. Without this a phone with a full sheet would restart its
   numbering at 1 and collide with itself. */
function idSuffix(id) {
  if (typeof id === "number") return id;
  const match = /-(\d+)$/.exec(String(id == null ? "" : id));
  return match ? parseInt(match[1], 10) : 0;
}

function makeId(list) {
  let max = 0;
  (list || []).forEach(entry => {
    const n = idSuffix(entry && entry.id);
    if (n > max) max = n;
  });
  return deviceId() + "-" + (max + 1);
}

/* A dataset value is always a string, and a stored id is a string here or a
   number in an older save, so every lookup that starts from the DOM compares
   as text. parseInt() on an id is now a bug: it returns NaN for the new
   shape, and NaN matches nothing. */
function sameId(a, b) {
  return String(a) === String(b);
}
