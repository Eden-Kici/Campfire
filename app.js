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
}



/* ============================================================
   INIT
   ============================================================ */

loadTheme();
loadSettings();
const restored = loadCharacters();
showScreen("selector");
if (restored && restored.stale) {
  showToast("Saved characters were from an older version (" + restored.reason + ") and weren't loaded");
}
