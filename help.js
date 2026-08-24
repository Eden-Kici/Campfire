/* ============================================================
   HELP & RULES

   Two different questions, one screen:

     "How does this app work?"  -- HELP_TOPICS below. Not a rules primer;
       this app makes specific choices (every number explains itself, effects
       come in groups that die with their cause, a stack is different from a
       container) and those choices are invisible until someone tells you
       about them. The onboarding tutorial covers the shape of the app once,
       on the way in; this is the thing you come back to afterwards, when
       you've hit one particular part and want it explained properly.

     "What does Restrained do again?" -- the conditions reference, read
       straight off SRD_CONDITIONS so it can never drift from what the
       Conditions picker actually offers. Manage Content browses the same
       table, but you shouldn't have to go through a content-authoring
       screen to look up a rule mid-fight.

   Both are the same single-open accordion the choice cards and Features &
   Traits already use, so nothing here needs its own interaction vocabulary.

   Every topic is written to be true of what's actually built. Where
   something is faked (party finder) the topic says so rather than
   describing an intention -- the beta tester is going to find out either
   way, and finding out from the help screen is better than finding out by
   trusting it. */

let helpOpenTopic = null;      // single-open accordion, same as the choice cards
let helpTab = "app";           // "app" | "conditions"
let helpConditionSearch = "";

const HELP_TOPICS = [
  { key: "numbers", title: "Every number explains itself",
    body: "Tap any number on the sheet -- AC, a skill, a saving throw, initiative, spell DC -- and you get its full breakdown: what it started as, and every bonus and penalty that moved it, each one named. If a number looks wrong, the breakdown tells you which effect is responsible instead of leaving you to guess. Where a stat can be overridden outright, the breakdown says that too." },
  { key: "effects", title: "Effects, conditions and buffs are all one thing",
    body: "A condition, a spell buff, a debuff from a monster -- internally they're the same shape: a named group holding one or more effects. That's why Bless and Poisoned and a magic cloak all show up the same way in a breakdown. Removing the group removes everything it was doing, so nothing can outlive its cause and quietly keep applying." },
  { key: "concentration", title: "Concentration",
    body: "An effect group can be marked as requiring concentration. Only one such group holds at a time -- starting a second asks before dropping the first. Dropping concentration removes the whole group, and a short or long rest breaks it. Damage doesn't prompt a concentration save automatically; that's still yours to roll, from the saving throw on the Character tab." },
  { key: "rests", title: "Short and long rests",
    body: "Both are in the app menu. A short rest lets you spend hit dice to heal (each rolls its die plus your Constitution modifier) and restores anything tagged SR. A long rest restores hit points, everything tagged SR or LR, half your hit dice, and clears a level of exhaustion. Anything with a custom recharge trigger is deliberately left alone -- the app can't know when \"at dawn\" or \"when you roll initiative\" happened, so those stay yours to track." },
  { key: "resources", title: "Resources and spell slots",
    body: "Class features that have uses -- Rage, Channel Divinity, Bardic Inspiration -- appear as resource rows with a current and a max, and a recharge tag saying which rest brings them back. Spell slots work the same way and show up in both Combat and Spells; they're one set of numbers rendered twice, so the two views can't disagree. Resources are allowed to go over max or below zero on purpose: custom content and table rulings need the room." },
  { key: "hp", title: "Damage, healing and temp HP",
    body: "Tap the HP bar for a calculator that takes an expression, so \"2d6+3\" works as well as a flat number. Temp HP is tracked separately and absorbs damage first, as it should. At 0 hit points the death save tracker appears on its own; three successes stabilises, three failures doesn't, and both are undoable if the table rules otherwise." },
  { key: "inventory", title: "Stacks, containers and what's equipped",
    body: "Where an item sits decides what it does. Worn and Equipped items apply their effects (so armour only adds AC from a category that applies effects), Equipped weapons are the ones that appear under Attacks, and Camp Storage doesn't even count toward weight. Stowing a weapon just moves it between categories -- it never deletes anything. Items with a quantity are either a stack (arrows: a count) or a container (a quiver: what's loaded now, refillable from its stack)." },
  { key: "spells", title: "Spells",
    body: "Adding a spell searches the full SRD list; picking one fills in its level, casting time, description and whether it needs an attack roll, and typing a name that isn't on the list is equally valid for homebrew. Cantrips are always available; leveled spells have a prepared toggle and a Cast button that spends a slot. Casting with no slots left warns you and still lets it through, because the table -- not the app -- decides whether that's allowed." },
  { key: "levelup", title: "Levelling up",
    body: "Level Up is in the app menu. Pick the class to take the level in -- including a new one, which is how multiclassing works here -- and the app grants that level's features, adds hit points and hit dice, and recalculates your proficiency bonus. Any choice the new features owe you (a fighting style, a subclass pick) is asked right then rather than left as a banner to find later." },
  { key: "content", title: "Custom content",
    body: "Manage Content browses everything the app ships with -- races, classes, subclasses, backgrounds, feats, equipment, magic items, spells, conditions -- and everything you've made, in one searchable list. You can build a race, class, subclass, background, feature or item from scratch, or duplicate an SRD entry and edit the copy. Custom subclasses attach to an existing class by name, so homebrewing one for the Fighter doesn't mean forking the Fighter. Custom content is stored per device, not per character." },
  { key: "history", title: "Dice history",
    body: "Every roll the app resolves is logged, newest first, with its breakdown and whether it had advantage. Rerolls are logged as their own entry rather than replacing what came before -- a log you can't trust isn't worth keeping. It's in the app menu, and can be cleared there." },
  { key: "party", title: "Party (not built yet)",
    body: "The party screen is a mockup. There's no networking behind it: the parties it finds are invented, and sharing a note doesn't send it anywhere. It's there to show the shape of what a connected table would look like -- a player pushing a Bless onto an ally's sheet, a GM sending an item into an inventory -- not to do it. Everything else on this sheet is real." }
];

function helpHtml() {
  return `
    <div class="modal-heading">Help &amp; Rules</div>
    <div class="btn-row-2" style="margin-bottom:10px;">
      <button class="toggle-btn ${helpTab === "app" ? "active" : ""}" data-help-tab="app" style="flex:1;padding:10px 0;">Using the App</button>
      <button class="toggle-btn ${helpTab === "conditions" ? "active" : ""}" data-help-tab="conditions" style="flex:1;padding:10px 0;">Conditions</button>
    </div>
    ${helpTab === "app" ? helpTopicsHtml() : helpConditionsHtml()}
  `;
}

function helpTopicsHtml() {
  return HELP_TOPICS.map(topic => helpCardHtml(topic.key, topic.title, topic.body, "")).join("");
}

/* Read straight off SRD_CONDITIONS rather than a second hand-written list --
   a condition the picker offers but the help screen has never heard of is
   exactly the drift this avoids. Third-party entries keep the same 3PP tag
   they carry everywhere else, so nobody mistakes one for a core rule. */
function helpConditionsHtml() {
  return `
    ${textFieldHtml("help-condition-search", "Search", helpConditionSearch, { placeholder: "Search conditions..." })}
    <div id="help-condition-results">${helpConditionResultsHtml()}</div>
  `;
}

function helpConditionResultsHtml() {
  const query = helpConditionSearch.trim().toLowerCase();
  const matches = SRD_CONDITIONS.filter(c => !query || c.name.toLowerCase().includes(query));
  return `
    <div class="breakdown-source" style="margin:4px 0 8px;">${matches.length} ${matches.length === 1 ? "condition" : "conditions"}</div>
    ${matches.length
      ? matches.map(c => helpCardHtml("cond-" + c.name, c.name, c.desc,
          c.official === false ? `<span class="res-tag" style="background:var(--control-raised);color:var(--text-dim);">3PP</span>` : "")).join("")
      : `<div class="empty-hint">Nothing matches.</div>`}
  `;
}

function helpCardHtml(key, title, body, tagHtml) {
  const isOpen = helpOpenTopic === key;
  return `
    <div class="collapse-card" style="margin-bottom:8px;">
      <div class="collapse-head" data-help-topic="${esc(key)}" style="padding:11px 14px;">
        <span>${esc(title)}${tagHtml ? " " + tagHtml : ""}</span>
        <span>${isOpen ? "−" : "+"}</span>
      </div>
      <div class="collapse-body ${isOpen ? "open" : ""}" style="padding:0 14px 12px;">
        <div class="trait-desc">${esc(body)}</div>
      </div>
    </div>
  `;
}

function openHelpModal() {
  helpOpenTopic = null;
  helpTab = "app";
  helpConditionSearch = "";
  openModal("full", helpHtml());
  wireHelpModal();
}

function redrawHelp() {
  const box = document.querySelector("#modal-overlay .modal-content");
  if (!box) return;
  box.innerHTML = helpHtml();
  wireHelpModal();
}

function wireHelpModal() {
  document.querySelectorAll("[data-help-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      helpTab = btn.dataset.helpTab;
      helpOpenTopic = null;          // a card left open in one tab shouldn't reopen in the other
      redrawHelp();
    });
  });

  wireHelpCards();

  /* Typing redraws only the results container, never the screen around it --
     replacing the search input while someone is typing in it drops focus on
     the first keystroke. Same split the content manager uses for the same
     reason. */
  const search = document.getElementById("help-condition-search");
  if (search) search.addEventListener("input", (e) => {
    helpConditionSearch = e.target.value;
    helpOpenTopic = null;
    const results = document.getElementById("help-condition-results");
    if (results) { results.innerHTML = helpConditionResultsHtml(); wireHelpCards(); }
  });
}

function wireHelpCards() {
  document.querySelectorAll("[data-help-topic]").forEach(head => {
    head.addEventListener("click", () => {
      const key = head.dataset.helpTopic;
      helpOpenTopic = helpOpenTopic === key ? null : key;
      // an accordion toggle inside the conditions list only needs the list
      // back, not the search field above it
      const results = document.getElementById("help-condition-results");
      if (helpTab === "conditions" && results) { results.innerHTML = helpConditionResultsHtml(); wireHelpCards(); }
      else redrawHelp();
    });
  });
}
