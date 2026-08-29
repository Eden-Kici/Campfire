/* ============================================================
   DICE HISTORY

   Every roll the app resolves gets recorded here. "Did that hit?" and "what
   did I roll for damage again?" are the two questions a table asks most, and
   the roll window is modal -- once it closes the number is gone. This is the
   log that answers them.

   Device-level, not per-character: the menu item is app-level, and a session
   where someone switches sheets (a player running two characters, a GM
   testing) still wants one chronological list. Each entry carries the
   character's name so a mixed list still reads correctly.

   Capped at HISTORY_LIMIT and persisted under its own key, the same
   independence theme/settings/customContent/tutorial already have -- resetting
   the demo character or refusing a stale save shouldn't wipe the log, and the
   log going missing shouldn't take a character with it.

   Rerolling records a second entry rather than replacing the first. A reroll
   IS another roll; hiding the one you didn't like would make this a log you
   can't trust, which is worse than no log. */

const ROLL_HISTORY_KEY = "campfire.rollHistory";
/* 500 rather than 50: a session's worth of rolls is the point of a history,
   and each entry is a handful of short fields -- 500 of them is well under
   100KB of JSON, which localStorage carries without noticing. The cap exists
   to stop unbounded growth, not to keep the list short. */
const HISTORY_LIMIT = 500;

let rollHistory = [];

function persistRollHistory() {
  try { localStorage.setItem(ROLL_HISTORY_KEY, JSON.stringify(rollHistory)); }
  catch (err) { /* not fatal -- a full store shouldn't stop you rolling */ }
}

function loadRollHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROLL_HISTORY_KEY));
    if (Array.isArray(saved)) rollHistory = saved.slice(0, HISTORY_LIMIT);
  } catch (err) { /* unreadable -- an empty log is a fine fallback */ }
}

/* `detail` is the dice breakdown as the roll window itself renders it
   ("(4+3)+2"), kept as text rather than structured parts -- nothing re-rolls
   from history, so the numbers only need to be readable, and every roll path
   (the full roll window, the lightweight HP/hit-dice toasts) can produce a
   string without agreeing on a shape first. */
function recordRoll(entry) {
  rollHistory.unshift({
    id: Date.now() + Math.random(),      // display order is array order; the id is just a key
    label: entry.label || "Roll",
    notation: entry.notation || "",
    total: entry.total,
    detail: entry.detail || "",
    kind: entry.kind || "",
    mode: entry.mode && entry.mode !== "normal" ? entry.mode : "",
    dropped: entry.dropped == null ? null : entry.dropped,
    character: entry.character || (typeof character !== "undefined" && character ? character.name : ""),
    at: entry.at || Date.now()
  });
  if (rollHistory.length > HISTORY_LIMIT) rollHistory.length = HISTORY_LIMIT;
  persistRollHistory();
}

function clearRollHistory() {
  rollHistory = [];
  persistRollHistory();
}

// "2m ago" beats a wall-clock time on a sheet nobody keeps open for hours,
// and it sidesteps having to care about the device's locale or timezone
function historyAgo(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  return Math.floor(hours / 24) + "d ago";
}

// only shown on a mixed list -- a log where every entry is the open character
// doesn't need every row repeating their name back at them
function historyShowsCharacters() {
  return new Set(rollHistory.map(r => r.character)).size > 1;
}

function diceHistoryHtml() {
  const showWho = historyShowsCharacters();
  return `
    <div class="modal-heading">Dice History</div>
    <div class="breakdown-source" style="margin-bottom:12px;">Newest first. The last ${HISTORY_LIMIT} are kept.</div>
    ${rollHistory.length ? `
      ${rollHistory.map(r => `
        <div class="res-row" style="align-items:flex-start;">
          <div style="flex:1;min-width:0;">
            <div class="res-name">${esc(r.label)}${r.mode ? ` <span class="res-tag" style="background:var(--control-raised);color:var(--accent-soft);">${esc(r.mode === "advantage" ? "ADV" : "DIS")}</span>` : ""}</div>
            <div class="atk-range">${esc(r.notation)}${r.detail ? " · " + esc(r.detail) : ""}${r.dropped != null ? " · dropped " + r.dropped : ""}</div>
            <div class="field-hint">${showWho && r.character ? esc(r.character) + " · " : ""}${esc(historyAgo(r.at))}</div>
          </div>
          <div class="roll-toast-value" style="font-size:22px;margin-top:0;">${r.total}</div>
        </div>
      `).join("")}
      <button class="btn-secondary" id="clear-history-button" style="margin-top:14px;">Clear History</button>
    ` : `<div class="empty-hint">Nothing rolled yet. Tap an attack, skill or saving throw and it'll show up here.</div>`}
  `;
}

function openDiceHistoryModal() {
  openModal("full", diceHistoryHtml());
  wireDiceHistoryModal();
}

function wireDiceHistoryModal() {
  const clear = document.getElementById("clear-history-button");
  if (clear) clear.addEventListener("click", () => {
    clearRollHistory();
    // redraw in place rather than closing -- the empty state is the
    // confirmation that it worked, same as the content manager's own
    // delete flow redraws its list instead of dropping you out of it
    const box = document.querySelector("#modal-overlay .modal-content");
    if (box) { box.innerHTML = diceHistoryHtml(); wireDiceHistoryModal(); }
    showToast("Dice history cleared");
  });
}
