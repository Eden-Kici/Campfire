/* ---------- themes ----------

   A theme is a set of CSS custom properties; switching one sets an attribute
   and the stylesheet does the rest. Nothing in the app reads a colour, so
   there's no render pass involved.

   Custom is a base theme plus overrides. Storing it that way rather than as a
   full palette means an override only has to name the handful of colours a
   person actually wants to change, and everything else keeps working -- and
   if the palette grows later, existing custom themes don't go stale. */

const THEMES = [
  { value: "ember", label: "Ember", hint: "The original" },
  { value: "fantasy", label: "Fantasy", hint: "Leather and gold" },
  { value: "light", label: "Light", hint: "Paper" }
];

// the ones worth exposing; the rest follow from the base theme
const CUSTOM_SWATCHES = [
  { variable: "--accent", label: "Accent" },
  { variable: "--accent-soft", label: "Accent, soft" },
  { variable: "--frame", label: "Background" },
  { variable: "--surface", label: "Cards" },
  { variable: "--control", label: "Controls" },
  { variable: "--text", label: "Text" }
];

const THEME_KEY = "campfire.theme";
const SETTINGS_KEY = "campfire.settings";

/* App preferences, kept apart from character data so they survive a reset and
   aren't copied around when a character is exported. `username` is the closest
   thing this POC has to an account -- it's what a party sees for you before
   you've opened a character, the way a real login would. */
let settings = {
  alwaysShowDeathSaves: false,
  username: "Adventurer",
  // a party's own visibility rule, not a per-character one: the leader always
  // sees who is custom, and this decides whether everyone else does too
  showCustomToParty: false,
  // a second purse for coin that isn't on you -- a stash, the party fund, a
  // bank. Off by default because most tables don't track it.
  trackStashedMoney: false,
  // coin has weight in the rules (50 to the pound) and most tables ignore it
  moneyCountsWeight: false,
  /* Off means every roll opens unrolled and you tap Roll -- you can look at a
     skill without logging a die for it. On puts it back to resolving on the
     first tap, for tables that want the speed. */
  fastRolls: false,
  /* Which relay the party talks through. Empty means the one the app ships
     with; a value here points at a different one, which is how a table on a
     laptop relay, or a second deployment, gets used without a code change. */
  relayUrl: ""
};

function persistSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (err) { /* not fatal */ }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved && typeof saved === "object") settings = Object.assign(settings, saved);
  } catch (err) { /* defaults */ }
}

function openSettingsModal() {
  openModal("sheet", `
    <div class="modal-heading">Options</div>
    ${textFieldHtml("setting-username", "Username", settings.username,
      { hint: "Shown to other players when you join or host a party" })}
    ${textFieldHtml("setting-relay", "Party Relay", settings.relayUrl,
      { hint: "Leave blank to use the default", placeholder: DEFAULT_RELAY_URL })}
    ${toggleLineHtml("setting-death-saves", "Always show death saves", settings.alwaysShowDeathSaves,
      { hint: "Otherwise they appear only at 0 hit points" })}
    ${toggleLineHtml("setting-fast-rolls", "Fast Rolls", settings.fastRolls,
      { hint: "Roll on the first tap" })}
    ${toggleLineHtml("setting-stashed-money", "Track stashed money", settings.trackStashedMoney,
      { hint: "A second purse for coin you aren't carrying" })}
    ${toggleLineHtml("setting-money-weight", "Coin counts toward weight", settings.moneyCountsWeight,
      { hint: "50 coins to the pound" })}
  `);
  const usernameInput = document.getElementById("setting-username");
  usernameInput.addEventListener("blur", () => {
    settings.username = usernameInput.value.trim() || settings.username;
    usernameInput.value = settings.username;
    persistSettings();
    partyIdentityChanged();
  });
  const relayInput = document.getElementById("setting-relay");
  relayInput.addEventListener("blur", () => {
    settings.relayUrl = relayInput.value.trim();
    persistSettings();
  });
  settingToggle("setting-death-saves", "alwaysShowDeathSaves");
  settingToggle("setting-fast-rolls", "fastRolls");
  settingToggle("setting-stashed-money", "trackStashedMoney");
  settingToggle("setting-money-weight", "moneyCountsWeight");
}

/* Every options toggle does the same four things, and each one written out by
   hand was another chance to forget the persist or the re-render. */
function settingToggle(id, key) {
  const el = document.getElementById(id);
  if (!el || !el.addEventListener) return;
  el.addEventListener("click", () => {
    settings[key] = !settings[key];
    el.classList.toggle("on", settings[key]);
    persistSettings();
    renderContent();
  });
}

let theme = { base: "ember", custom: {} };

function applyTheme() {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.base);

  // clear any previous overrides before applying the current set
  CUSTOM_SWATCHES.forEach(swatch => root.style.removeProperty(swatch.variable));
  Object.keys(theme.custom || {}).forEach(variable => {
    if (theme.custom[variable]) root.style.setProperty(variable, theme.custom[variable]);
  });
}

function persistTheme() {
  try { localStorage.setItem(THEME_KEY, JSON.stringify(theme)); }
  catch (err) { /* a blocked store just means the choice won't survive a reload */ }
}

function loadTheme() {
  theme = { base: "ember", custom: {} };        // reset first, so this is idempotent
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_KEY));
    if (saved && saved.base) theme = { base: saved.base, custom: saved.custom || {} };
  } catch (err) { /* a damaged value just means the default */ }
  applyTheme();
}

function setTheme(base) {
  theme.base = base;
  applyTheme();
  persistTheme();
}

/* Reading a variable's current value needs the computed style, because a theme
   sets it in a stylesheet rather than inline. That's what lets the colour
   inputs show what you're actually looking at rather than a guess. */
function currentColour(variable) {
  const override = theme.custom && theme.custom[variable];
  if (override) return override;
  const computed = getComputedStyle(document.documentElement).getPropertyValue(variable);
  return (computed || "").trim();
}

function openThemeModal() {
  openModal("sheet", `
    <div class="modal-heading">Theme</div>

    ${THEMES.map(entry => `
      <button class="drawer-item theme-option ${theme.base === entry.value ? "active" : ""}" data-theme-pick="${entry.value}">
        <span class="theme-swatches" data-theme="${entry.value}">
          <i style="background:var(--page)"></i><i style="background:var(--surface)"></i><i style="background:var(--accent)"></i>
        </span>
        <span class="theme-name">${esc(entry.label)}</span>
        <span class="drawer-hint">${esc(entry.hint)}</span>
      </button>
    `).join("")}

    <div class="drawer-section">Adjust</div>
    <div class="theme-swatch-grid">
      ${CUSTOM_SWATCHES.map(swatch => `
        <label class="theme-swatch">
          <input type="color" data-swatch="${swatch.variable}" value="${esc(currentColour(swatch.variable))}">
          <span>${esc(swatch.label)}</span>
        </label>
      `).join("")}
    </div>
    <div class="menu-note" style="margin-top:10px;">Changes sit on top of the chosen theme, so only what you pick is overridden.</div>
    <button class="btn-secondary" id="theme-reset">Reset adjustments</button>
  `);

  document.querySelectorAll("[data-theme-pick]").forEach(button => {
    button.addEventListener("click", () => {
      setTheme(button.dataset.themePick);
      openThemeModal();                       // reopen so the swatches show the new base
    });
  });

  document.querySelectorAll("[data-swatch]").forEach(input => {
    input.addEventListener("input", () => {
      theme.custom[input.dataset.swatch] = input.value;
      applyTheme();
      persistTheme();
    });
  });

  document.getElementById("theme-reset").addEventListener("click", () => {
    theme.custom = {};
    applyTheme();
    persistTheme();
    openThemeModal();
    showToast("Back to the " + (THEMES.find(t => t.value === theme.base) || {}).label + " palette");
  });
}
