/* ============================================================
   TAB SWITCHING
   ============================================================ */

let activeTab = "combat";
const tabButtons = document.querySelectorAll(".tab-item");
tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab;
    updateActiveTabStyling();
    renderContent();
  });
});
function updateActiveTabStyling() {
  tabButtons.forEach(button => button.classList.toggle("active", button.dataset.tab === activeTab));
}

document.getElementById("back-to-selector").addEventListener("click", () => showScreen("selector"));
document.getElementById("char-name-row").addEventListener("click", openCharacterEditorModal);
document.getElementById("app-menu-button").addEventListener("click", openAppMenu);

function renderContent() {
  const content = document.getElementById("content");
  if (activeTab === "combat") { content.innerHTML = renderCombatTab(); wireCombatTab(); }
  else if (activeTab === "character") { content.innerHTML = renderCharacterTab(); wireCharacterTab(); }
  else if (activeTab === "inventory") { content.innerHTML = renderInventoryTab(); wireInventoryTab(); }
  else if (activeTab === "spells") { content.innerHTML = renderSpellsTab(); wireSpellsTab(); }
  else if (activeTab === "notes") { content.innerHTML = renderNotesTab(); wireNotesTab(); }
  else { content.innerHTML = "<p>" + activeTab + " tab coming soon</p>"; }

  // every mutation in the app ends in a re-render, so saving here catches all
  // of them without hunting individual call sites
  persistCharacters();
  renderTutorialOverlay();   // keeps the tabs/actions phases in sync with whichever tab is now active
}



/* ============================================================
   INIT
   ============================================================ */

loadTheme();
loadSettings();
loadCustomContent();
loadTutorialState();
loadRollHistory();
const restored = loadCharacters();
showScreen("selector");
if (restored && restored.stale) {
  showToast("Older save (" + restored.reason + ") kept aside, not loaded");
}

/* Registered, not scripted into the page -- a service worker runs outside the
   document, which is how the app opens with no signal.

   Wrapped and swallowed on purpose: a worker needs HTTPS (or localhost), so
   opening index.html straight off the filesystem throws here. That has to stay
   a no-op rather than taking the boot sequence down, because opening the file
   directly is how this app is developed. */
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(err => {
      console.warn("Service worker not registered (expected over file://):", err.message);
    });
  });
}
