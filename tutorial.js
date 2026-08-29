/* ============================================================
   ONBOARDING TUTORIAL (POC)

   A from-scratch player (the beta tester, cold) needs three things: build a
   character, learn where the five tabs live, and try the handful of things
   a table actually does mid-session. This isn't a blocking wizard bolted on
   top of the creator's own wizard -- it's content that reads whatever
   screen/tab/creator-step is already showing and explains it, so using the
   app for real IS taking the tour. "Skip Tutorial" is always one tap away,
   everywhere it appears.

   State lives in localStorage under its own key, the same independence
   theme/settings/customContent already have -- resetting to the demo
   character, importing a character, none of that should touch whether
   someone's seen the tour.

   Phases, in order:
     welcome  -- a real modal (openModal), shown once on first-ever boot.
                 "Start Tutorial" walks straight into openCharacterCreator()
                 rather than leaving the player to go find the button.
     creation -- text keyed by currentStepKey() (creator.js) while the
                 wizard is open. Rendered INLINE inside the creator's own
                 modal content (see redrawCreator()), not as a floating
                 overlay -- the wizard is a modal-full covering 94% of the
                 phone, so a floating banner would just fight it for space
                 and risk covering the wizard's own Back/Next buttons.
     tabs     -- text keyed by activeTab, shown as a floating banner in
                 #tutorial-overlay (a static slot in index.html between the
                 content area and the tab bar, so it never covers either).
                 Advances once every one of the five tabs has been visited.
     actions  -- two or three floating banners pointing at one real thing
                 to try (a roll, HP tracking, casting a spell). Advancing
                 needs an explicit "Got It" tap on the banner itself, not a
                 hook into castSpell()/showRoll()/etc. -- gating on the real
                 action would mean touching every mutation path that could
                 satisfy it, for a POC-level nice-to-have.
     done     -- a closing modal. Turns tutorialState.active off for good.

   renderTutorialOverlay() is the hook every screen-changing function calls
   (showScreen, renderContent, redrawCreator) -- same "every mutation ends
   in a re-render" discipline app.js already uses for saving. It's cheap and
   idempotent: recompute what should show right now, write it, done. */

const TUTORIAL_KEY = "campfire.tutorial";

let tutorialState = { active: false, phase: null, seenTabs: [], seenActions: [] };

function persistTutorialState() {
  try { localStorage.setItem(TUTORIAL_KEY, JSON.stringify(tutorialState)); }
  catch (err) { /* not fatal */ }
}

// a totally fresh install has no key at all -- that first read is the
// trigger that starts the tour automatically, same moment a real app would
// show a first-run screen
function loadTutorialState() {
  let raw;
  try { raw = localStorage.getItem(TUTORIAL_KEY); }
  catch (err) { return; }                          // storage blocked entirely -- stay inactive

  if (raw === null) {
    tutorialState = { active: true, phase: "welcome", seenTabs: [], seenActions: [] };
    persistTutorialState();
    return;
  }
  try {
    const saved = JSON.parse(raw);
    if (saved && typeof saved === "object") {
      tutorialState = {
        active: !!saved.active,
        phase: saved.phase || null,
        seenTabs: Array.isArray(saved.seenTabs) ? saved.seenTabs : [],
        seenActions: Array.isArray(saved.seenActions) ? saved.seenActions : []
      };
    }
  } catch (err) { /* unreadable -- keep the inactive default rather than crash */ }
}

// the app menu's own "Replay Tutorial" entry -- resets progress and starts over
function startTutorial() {
  tutorialState = { active: true, phase: "welcome", seenTabs: [], seenActions: [] };
  persistTutorialState();
  closeModal();               // closes whatever menu/drawer this was tapped from
  renderTutorialOverlay();
}

function skipTutorial() {
  tutorialState.active = false;
  persistTutorialState();
  clearTutorialGlow();
  const banner = document.getElementById("tutorial-overlay");
  if (banner) banner.innerHTML = "";
  // the creator's own modal renders the inline banner itself -- redraw it so
  // skipping mid-wizard clears it immediately instead of on the next step
  if (typeof creatorState !== "undefined" && creatorState && creatorState.started) redrawCreator();
}

function tutorialActionSeen(action) {
  if (!tutorialState.seenActions.includes(action)) tutorialState.seenActions.push(action);
  persistTutorialState();
}

const TUTORIAL_TAB_ORDER = ["combat", "character", "spells", "inventory", "notes"];

/* Which real control each action-teaching banner points at, and which tab it
   lives on -- used both to render the banner and to know which tab to nudge
   the player toward if they've wandered off to another one.
   `available` keeps the tour from teaching something this character can't do.
   A Fighter has no Cast button, so without it the tour sent the player to an
   empty Spells tab and pointed at nothing. Model reads only -- no DOM -- so
   it stays as testable as the rest of tutorialContentFor(). */
const TUTORIAL_ACTIONS = [
  { key: "roll", tab: "combat", target: "[data-roll-tohit]", title: "Roll something",
    body: "Tap an attack, ability score, or saving throw to roll it. Try one, then tap Got It.",
    available: () => true },        // ability checks and saves always roll
  { key: "hp", tab: "combat", target: "#hp-card", title: "Track damage and healing",
    body: "Tap your HP card to log damage, healing, or temp HP.",
    available: () => true },
  { key: "spell", tab: "spells", target: "[data-spell-cast]", title: "Cast a spell",
    body: "Tap Cast on a leveled spell to roll it and spend a slot.",
    available: () => tutorialCanCastSpell() }
];

// a Cast button exists only for a spell above cantrip level that has a slot
// to spend -- the same two conditions renderSpellsTab() draws it from
function tutorialCanCastSpell() {
  if (typeof character === "undefined" || !character || !Array.isArray(character.spells)) return false;
  const slots = character.spellSlots || {};
  return character.spells.some(s => s.level > 0 && slots[s.level] && slots[s.level].max > 0);
}

function tutorialActionsLeft() {
  return TUTORIAL_ACTIONS.filter(a => a.available() && !tutorialState.seenActions.includes(a.key));
}

const TUTORIAL_CREATOR_STEPS = {
  race: { title: "Race", body: "Pick a race. If it grants a choice -- a cantrip, an extra language, a Dragonborn's draconic ancestry -- you resolve it right here, not at the end." },
  class: { title: "Class", body: "Your class sets hit die, saves, and starting proficiencies. Class-level picks like a Fighting Style show up here too." },
  subclass: { title: "Subclass", body: "Not every class picks a subclass at level 1 -- this step only appears when yours does." },
  background: { title: "Background", body: "Backgrounds add two skill proficiencies and a small roleplaying feature." },
  ability: { title: "Ability Scores", body: "Assign your six scores. Every modifier, save and skill on the sheet derives from these." },
  skills: { title: "Skills", body: "Pick the skill proficiencies your race, class and background grant." },
  choices: { title: "Remaining Choices", body: "A few choices -- like a Rogue's Expertise -- need to know your skills first, so they wait until here." },
  equipment: { title: "Equipment", body: "Take your class's starting gear, or buy your own with starting gold." },
  final: { title: "Finishing Touches", body: "Name your character, add any last details, then tap Create Character." }
};

const TUTORIAL_TAB_CONTENT = {
  combat: { title: "Combat", body: "Attacks, AC, HP, conditions and resources -- everything you touch mid-fight." },
  character: { title: "Character", body: "Ability scores, skills, saves, languages, and every feature and trait you have." },
  spells: { title: "Spells", body: "Every spell you know, with spell attack, spell DC, and slot tracking." },
  inventory: { title: "Inventory", body: "What you're carrying, wearing and wielding -- and what it's doing for your AC and attacks." },
  notes: { title: "Notes", body: "Session notes, shareable with the table." }
};

/* Pure read of current app state (tutorialState plus whatever screen/tab/
   creator-step is live right now) -- no writes, no persistence, so tests
   can assert on it without a real page underneath. The one exception is
   deliberately left to the caller: when "actions" has nothing left to show
   for the current tab, this returns null rather than silently advancing to
   "done" itself -- renderTutorialOverlay() owns that transition (and its
   persistence) since a pure content getter shouldn't have side effects. */
function tutorialContentFor() {
  if (!tutorialState.active) return null;

  if (tutorialState.phase === "welcome") {
    return {
      placement: "modal", eyebrow: "Welcome", title: "Welcome to Campfire",
      body: "Quick tour: build a character, meet the five tabs, and try a couple of things a table does every session. About two minutes -- skip anytime.",
      nextLabel: "Start Tutorial", showSkip: true,
      onNext: () => {
        tutorialState.phase = "creation";
        persistTutorialState();
        openCharacterCreator();
      }
    };
  }

  if (tutorialState.phase === "creation") {
    if (typeof creatorState === "undefined" || !creatorState) return null;
    // the wizard's own start screen ("Build a Character" / "Import from
    // File") is still part of the lesson, and it is the only place a player
    // who backed out can pick the tour up again
    if (!creatorState.started) {
      return {
        placement: "inline", eyebrow: "Creating a character", title: "Start a character",
        body: "Build one from scratch and the wizard walks you through every choice, or import a character file you already have."
      };
    }
    const step = TUTORIAL_CREATOR_STEPS[currentStepKey()];
    if (!step) return null;
    return { placement: "inline", eyebrow: "Creating a character", title: step.title, body: step.body };
  }

  if (tutorialState.phase === "tabs") {
    const tab = TUTORIAL_TAB_CONTENT[activeTab];
    if (!tab) return null;
    const allSeen = TUTORIAL_TAB_ORDER.every(t => tutorialState.seenTabs.includes(t));
    return {
      // count what's actually been seen -- the position of the current tab in
      // a fixed order jumped around when tabs were visited out of order
      placement: "sheet-banner", eyebrow: "Tab " + tutorialState.seenTabs.length + " of 5",
      target: `[data-tab="${activeTab}"]`, title: tab.title, body: tab.body,
      // the fifth tab needs its own explanation before the tour moves on, so
      // the hand-off to "actions" is an explicit tap rather than something
      // that happens in the same pass that marks the tab seen
      nextLabel: allSeen ? "Got It" : null,
      onNext: allSeen ? (() => { tutorialState.phase = "actions"; persistTutorialState(); }) : null
    };
  }

  if (tutorialState.phase === "actions") {
    const left = tutorialActionsLeft();
    const here = left.find(a => a.tab === activeTab);
    if (here) {
      return {
        placement: "sheet-banner", eyebrow: "Try it", target: here.target, title: here.title, body: here.body,
        nextLabel: "Got It", onNext: () => tutorialActionSeen(here.key)
      };
    }
    const elsewhere = left[0];
    if (elsewhere) {
      return {
        placement: "sheet-banner", eyebrow: "Try it", target: `[data-tab="${elsewhere.tab}"]`,
        title: "One more to try", body: "Head to the " + TUTORIAL_TAB_CONTENT[elsewhere.tab].title + " tab to try the next one."
      };
    }
    return null;   // nothing left -- renderTutorialOverlay() advances to "done"
  }

  if (tutorialState.phase === "done") {
    return {
      placement: "modal", eyebrow: "All set", title: "That's the tour",
      body: "You know enough to run a session. Rests, leveling, the app menu, and Manage Content all reward poking around. Have fun.",
      nextLabel: "Got It", showSkip: false,
      onNext: () => { tutorialState.active = false; persistTutorialState(); }
    };
  }

  return null;
}

/* closeModal() calls this whenever the modal it removed was one of ours.
   Dismissing a tutorial modal has to move the state on, or the next
   renderTutorialOverlay() reopens it -- and because openModal() begins with
   closeModal(), the reopened modal evicts whatever the player opened
   instead. renderContent() alone has 86 call sites, so "reopens" meant
   "reopens on almost any tap". */
function noteTutorialModalClosed() {
  if (!tutorialState.active) return;
  // dismissing the intro reads as "not now" -- Replay Tutorial is in the app menu
  if (tutorialState.phase === "welcome") { skipTutorial(); return; }
  if (tutorialState.phase === "done") {
    tutorialState.active = false;
    persistTutorialState();
  }
}

function clearTutorialGlow() {
  document.querySelectorAll(".tutorial-glow").forEach(el => el.classList.remove("tutorial-glow"));
}

// only creator.js's redrawCreator() calls this -- the "inline" placement is
// handled entirely there (see this file's own header comment for why),
// this just builds the markup so the two files don't duplicate the shape
function tutorialInlineHtml() {
  const content = tutorialContentFor();
  if (!content || content.placement !== "inline") return "";
  return `
    <div class="tutorial-banner tutorial-inline">
      <div class="tutorial-eyebrow">${esc(content.eyebrow)}</div>
      <div class="tutorial-title">${esc(content.title)}</div>
      <div class="tutorial-body">${esc(content.body)}</div>
      <button type="button" class="tutorial-skip" id="tutorial-skip-button">Skip Tutorial</button>
    </div>
  `;
}

function wireTutorialInline() {
  const btn = document.getElementById("tutorial-skip-button");
  if (btn) btn.addEventListener("click", () => { skipTutorial(); redrawCreator(); });
}

/* The one hook every screen-changing function calls. Handles the two bits
   of bookkeeping that need to happen outside the pure content getter (tab-
   seen tracking and the tabs->actions->done auto-advances), then renders
   whatever tutorialContentFor() says belongs on this frame -- a real modal,
   the floating #tutorial-overlay banner, or nothing (the "inline"
   placement is drawn by redrawCreator() itself, not here). */
function renderTutorialOverlay() {
  if (tutorialState.active && tutorialState.phase === "tabs" && typeof currentScreen !== "undefined" && currentScreen === "sheet") {
    if (!tutorialState.seenTabs.includes(activeTab)) {
      tutorialState.seenTabs.push(activeTab);
      persistTutorialState();
    }
    // NOT advancing to "actions" here: marking the tab seen and moving on in
    // the same pass meant whichever tab was visited last never got its own
    // banner. The fifth tab's "Got It" owns that transition instead.
  }

  let content = tutorialContentFor();
  if (!content && tutorialState.active && tutorialState.phase === "actions") {
    tutorialState.phase = "done";
    persistTutorialState();
    content = tutorialContentFor();
  }

  clearTutorialGlow();
  // the selector screen has its own slot -- it has no app menu, so a tour
  // that lands back there needs somewhere to put a Skip
  const onSelector = typeof currentScreen !== "undefined" && currentScreen === "selector";
  const banner = document.getElementById(onSelector ? "tutorial-overlay-selector" : "tutorial-overlay");
  const sheetBanner = document.getElementById("tutorial-overlay");
  if (banner) banner.innerHTML = "";
  if (sheetBanner && sheetBanner !== banner) sheetBanner.innerHTML = "";

  // a player who closed the wizard mid-creation is left on the selector with
  // the tour still running and nothing on screen to explain or escape it
  if (content && content.placement === "inline" && onSelector && banner) {
    content = {
      placement: "sheet-banner", eyebrow: "Creating a character", title: "Build your character",
      body: "Tap + New Character to pick up where the tour left off."
    };
  }

  if (!content) return;

  if (content.placement === "modal") {
    openModal("center", `
      <div data-tutorial-modal hidden></div>
      <div class="tutorial-eyebrow">${esc(content.eyebrow)}</div>
      <div class="modal-heading">${esc(content.title)}</div>
      <div class="tutorial-body">${esc(content.body)}</div>
      <div class="tutorial-actions" style="margin-top:14px;justify-content:flex-end;">
        ${content.showSkip ? `<button type="button" class="tutorial-skip" id="tutorial-skip-button">Skip Tutorial</button>` : ""}
        <button class="btn-primary" id="tutorial-next-button">${esc(content.nextLabel)}</button>
      </div>
    `);
    // closeModal() is programmatic, so it leaves the tour alone -- only a
    // dismissal (backdrop, X) counts as "not now"
    document.getElementById("tutorial-next-button").addEventListener("click", () => {
      closeModal(); content.onNext(); renderTutorialOverlay();
    });
    const skipBtn = document.getElementById("tutorial-skip-button");
    if (skipBtn) skipBtn.addEventListener("click", () => { closeModal(); skipTutorial(); });
    return;
  }

  if (content.placement === "sheet-banner" && banner) {
    banner.innerHTML = `
      <div class="tutorial-banner">
        <div class="tutorial-eyebrow">${esc(content.eyebrow)}</div>
        <div class="tutorial-title">${esc(content.title)}</div>
        <div class="tutorial-body">${esc(content.body)}</div>
        <div class="tutorial-actions">
          <button type="button" class="tutorial-skip" id="tutorial-skip-button">Skip Tutorial</button>
          ${content.onNext ? `<button type="button" class="tutorial-next" id="tutorial-next-button">${esc(content.nextLabel || "Got It")}</button>` : ""}
        </div>
      </div>
    `;
    document.getElementById("tutorial-skip-button").addEventListener("click", skipTutorial);
    if (content.onNext) {
      document.getElementById("tutorial-next-button").addEventListener("click", () => {
        content.onNext(); renderTutorialOverlay();
      });
    }
    if (content.target) {
      const targetEl = document.querySelector(content.target);
      if (targetEl) targetEl.classList.add("tutorial-glow");
    }
  }
}
