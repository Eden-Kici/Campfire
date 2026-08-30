/* Every view is built by interpolating into template literals and assigning
   innerHTML, so any user-authored text must be escaped on the way in.

   Rather than checking individual call sites, this poisons every field a user
   can type into and then renders everything, asserting the payload never
   survives. That is the only version of this test worth having: a curated list
   of sites missed eleven of them when it was first written. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const HOSTILE = '<img src=x onerror=alert(1)> "quoted" & \'apos\'';

  const c = app.character;
  c.name = HOSTILE; c.classLine = HOSTILE; c.appearance = HOSTILE; c.alignment = HOSTILE;
  c.personalityTraits = HOSTILE; c.ideals = HOSTILE; c.bonds = HOSTILE;
  c.flaws = HOSTILE; c.backstory = HOSTILE;

  c.resources.forEach(r => { r.name = HOSTILE; r.recharge = { on: HOSTILE, amount: "all" }; });
  c.inventory.forEach(i => {
    i.name = HOSTILE; i.description = HOSTILE;
    if (i.resource) {
      i.resource.recharge = { on: HOSTILE, amount: "all" };
      if (i.resource.refillFrom) i.resource.refillFrom = HOSTILE;
    }
    if (i.isWeapon) {
      i.range = HOSTILE; i.customSource = HOSTILE; i.ammunition = HOSTILE;
      i.proficiencyRequired = HOSTILE; i.properties = [HOSTILE];
      i.damage = [{ dice: HOSTILE, type: HOSTILE, ability: "STR" }];
    }
  });
  c.activeEffects.forEach(g => {
    g.name = HOSTILE; g.note = HOSTILE;
    (g.effects || []).forEach(e => { if (e.category === "Condition") e.value.condition = HOSTILE; });
  });
  Object.keys(c.traits).forEach(cat => c.traits[cat].forEach(t => { t.name = HOSTILE; t.desc = HOSTILE; }));
  c.spells.forEach(s => { s.name = HOSTILE; s.desc = HOSTILE; });
  c.noteSections.forEach(s => { s.name = HOSTILE; });
  c.notes.forEach(n => {
    n.title = HOSTILE; n.body = HOSTILE;
    if (n.sharing && n.sharing.sharedByName) n.sharing.sharedByName = HOSTILE;
  });
  app.party = {
    status: "connected", name: HOSTILE, code: "KT4M", cap: null,
    settings: { showClasses: true, showLevels: true, hpDisplay: "stats", showCustom: true },
    members: [
      { device: "aaa111", you: true, name: "Me" },
      { device: "bbb222", name: HOSTILE, subtext: HOSTILE, classNames: HOSTILE, level: 3, hp: 5, maxHp: 10 }
    ]
  };
  c.weaponProficiencies = [HOSTILE];
  c.categoryRules[HOSTILE] = { countsWeight: true, appliesEffects: true, providesAttacks: true };
  c.inventory[0].category = HOSTILE;
  c.languages = [HOSTILE];
  c.pendingChoices = [
    { id: 900, source: HOSTILE, traitCategory: "Race Traits", featureName: HOSTILE, kind: "language", prompt: HOSTILE, count: 1 }
  ];

  // custom content's feature-row extras (choice prompt, resource fields) are
  // a new writable surface this pass added -- poison those the same way
  app.customContent.races.push({
    id: 900, name: HOSTILE,
    features: [{ name: HOSTILE, desc: HOSTILE, choice: { kind: "language", count: 1, prompt: HOSTILE },
      resource: { max: 1, recharge: { on: HOSTILE, amount: "all" } }, effects: [{ category: "Bonus", value: { stat: "AC", amount: 1 } }] }],
    skillChoice: null, subraces: [{ name: HOSTILE, features: [{ name: HOSTILE, desc: HOSTILE }] }]
  });
  app.customContent.classes.push({
    id: 900, name: HOSTILE, description: HOSTILE, hitDie: "d8", mainAbility: "Strength", saves: [], armorProf: HOSTILE, weaponProf: HOSTILE,
    skillChoices: { count: 0, options: [] },
    features: [{ level: 1, name: HOSTILE, desc: HOSTILE, choice: { kind: "skill", count: 1, prompt: HOSTILE } }],
    subclasses: [{ name: HOSTILE, features: [{ level: 3, name: HOSTILE, desc: HOSTILE }] }]
  });
  app.customContent.backgrounds.push({
    id: 900, name: HOSTILE, desc: HOSTILE, skills: [],
    feature: { name: HOSTILE, desc: HOSTILE, choice: { kind: "cantrip", count: 1, prompt: HOSTILE } }
  });
  // a custom subclass attaches to an existing class by name and is the one
  // piece of Custom Content actually read outside the manager itself -- the
  // character creator's own Subclass step -- so its text needs checking there too
  app.customContent.subclasses.push({
    id: 900, forClass: "Fighter", name: HOSTILE,
    features: [{ level: 3, name: HOSTILE, desc: HOSTILE }]
  });
  app.customContent.items.push({ id: 900, name: HOSTILE, weight: 1, description: HOSTILE, type: "gear" });
  // a standalone Custom feature -- no race/class/background wrapper around it
  app.customContent.features.push({
    id: 900, name: HOSTILE, desc: HOSTILE, choice: { kind: "language", count: 1, prompt: HOSTILE }
  });

  const survived = html => typeof html === "string" && html.includes("<img src=x");

  suite.section("rendered surfaces");
  [["combat", app.renderCombatTab], ["character", app.renderCharacterTab],
   ["spells", app.renderSpellsTab], ["inventory", app.renderInventoryTab],
   ["notes", app.renderNotesTab], ["selector", app.renderSelectorScreen]]
    .forEach(([name, render]) => {
      try { suite.ok(name, !survived(render()), "raw markup survived"); }
      catch (err) { suite.ok(name, false, err.message); }
    });

  suite.section("modals");
  const weapon = c.inventory.find(i => i.isWeapon);
  const cases = [
    ["item detail", () => app.openItemDetailModal(c.inventory[0].id)],
    ["item editor", () => app.openItemEditModal(c.inventory[0].id)],
    ["add item", () => app.openAddInventoryModal()],
    ["attack detail", () => weapon && app.openAttackDetailModal(weapon.id)],
    ["stow weapon", () => weapon && app.openStowWeaponModal(weapon.id)],
    ["add effect", () => app.openAddEffectModal()],
    ["effect detail", () => app.openEffectDetailModal(c.activeEffects[0].id)],
    ["add resource", () => app.openAddResourceModal()],
    ["resource detail", () => app.openResourceDetailModal(c.resources[0].id)],
    ["feature editor", () => app.openEditFeatureModal(Object.keys(c.traits)[0], 0)],
    ["spell detail", () => app.openSpellDetailModal(c.spells[0].id)],
    ["note editor", () => app.openNoteEditorModal(c.notes[0].id)],
    ["share note", () => app.openShareModal(c.notes[0].id)],
    ["section editor", () => app.openEditSectionModal(c.noteSections[0].id)],
    ["character editor", () => app.openCharacterEditorModal()],
    ["category editor", () => app.openEditCategoryModal(c.inventory[0].category)],
    ["app menu", () => app.openAppMenu()],
    ["resolve choice", () => app.openResolveChoiceModal(900)],
    ["add language", () => app.openAddLanguageModal()],
    ["short rest", () => app.openShortRestModal()],
    ["give item", () => app.openGiveToModal(c.inventory[0], 1)],
    ["attack detail off-hand toggle", () => weapon && app.openAttackDetailModal(weapon.id)]
  ];

  cases.forEach(([name, open]) => {
    const before = app.__modals.length;
    try {
      open();
      const rendered = app.__modals.slice(before);
      suite.ok(name, !rendered.some(m => survived(m.html)), "raw markup survived");
    } catch (err) {
      suite.ok(name, false, err.message);
    }
  });

  /* The content manager and the character creator both open a blank modal
     shell and redraw real content into it afterward via a direct DOM write --
     openModal() only ever captures that first, empty call, so running these
     through the "modals" loop above would silently check nothing. The state
     each open*Form() sets up is real, though, so calling the plain
     Html()-returning function straight after gets the actual markup. */
  suite.section("content manager screens (checked directly -- see comment above)");
  app.openRaceForm(900);
  suite.ok("custom race form", !survived(app.raceFormHtml()), "raw markup survived");
  app.openClassForm(900);
  suite.ok("custom class form", !survived(app.classFormHtml()), "raw markup survived");
  app.openBackgroundForm(900);
  suite.ok("custom background form", !survived(app.backgroundFormHtml()), "raw markup survived");
  app.openSubclassForm(900);
  suite.ok("custom subclass form", !survived(app.subclassFormHtml()), "raw markup survived");
  app.openFeatureForm(900);
  suite.ok("custom feature form", !survived(app.featureFormHtml()), "raw markup survived");
  app.contentScreen = "list";
  app.contentCategoryFilter = "all";
  app.contentCategorySearch = "";
  suite.ok("content manager list", !survived(app.contentManagerHtml()), "raw markup survived");

  // the unified category browser (SRD + Custom merged) renders a custom
  // entry's name, its "for <class>" subtitle on subclasses, and search/filter
  // state -- all real writable surfaces now that the two sections were merged
  ["races", "classes", "subclasses", "backgrounds", "features", "gear"].forEach(key => {
    app.contentSrdCategory = key;
    app.contentCategoryFilter = "all";
    app.contentCategorySearch = "";
    app.contentScreen = "category";
    suite.ok("category browser: " + key, !survived(app.contentCategoryHtml()), "raw markup survived");
  });
  // the search box itself is user-typed text, echoed back into its own value --
  // checked both inside a category and at the top-level Manage Content screen,
  // since search now works from both places over the same shared state
  app.contentSrdCategory = "races";
  app.contentCategorySearch = HOSTILE;
  suite.ok("category browser search box", !survived(app.contentCategoryHtml()), "raw markup survived");
  app.contentScreen = "list";
  suite.ok("Manage Content search box + cross-category results", !survived(app.contentListHtml()), "raw markup survived");
  app.contentCategorySearch = "";

  // the inline "are you sure" delete confirmation echoes the entry's name
  // back into its own row rather than a separate modal
  app.contentPendingDelete = { catKey: "races", source: "custom", ref: 900 };
  suite.ok("inline delete confirmation", !survived(app.contentResultsHtml("races")), "raw markup survived");
  app.contentPendingDelete = null;

  // the character creator does the same "blank modal, then a direct DOM
  // write" thing content manager screens do, so its Subclass step needs the
  // same direct-call treatment -- this is the one creator screen that can
  // now carry Custom Content text (subclassesForClass merges it in)
  app.openCharacterCreator();
  app.creatorState.charClass = "Fighter";
  suite.ok("creator subclass step", !survived(app.subclassStepHtml(1, 5)), "raw markup survived");

  suite.section("the roll window");
  try {
    const attack = app.calculateAttack(c, weapon);
    app.showRoll({ label: HOSTILE, notation: "1d20", sources: attack.toHitSources, kind: "attack" });
    suite.ok("roll window", !survived(app.rollWindowHtml()), "raw markup survived");
  } catch (err) {
    suite.ok("roll window", false, err.message);
  }

  /* Dice history logs a roll's label, and a roll's label is a weapon or spell
     name -- user-authored text that outlives the window it was rolled in.
     The showRoll above has already put a poisoned entry in the log; this
     just renders it. The character name on each entry is poisoned too (c.name
     was set to HOSTILE at the top), and only shows on a mixed-character list,
     so a second entry under a different name is added to force that path. */
  suite.section("dice history");
  app.recordRoll({ label: HOSTILE, notation: HOSTILE, total: 7, detail: HOSTILE, character: HOSTILE, mode: "advantage", dropped: 3 });
  app.recordRoll({ label: HOSTILE, notation: HOSTILE, total: 9, detail: HOSTILE, character: "Someone Else" });
  suite.ok("dice history list", !survived(app.diceHistoryHtml()), "raw markup survived");

  // Help & Rules renders SRD_CONDITIONS rather than anything the player typed,
  // but the conditions search box echoes user-typed text back into its own value
  suite.section("help & rules");
  app.helpTab = "app";
  suite.ok("help topics", !survived(app.helpHtml()), "raw markup survived");
  app.helpTab = "conditions";
  app.helpConditionSearch = HOSTILE;
  suite.ok("help conditions search box", !survived(app.helpHtml()), "raw markup survived");
  app.helpConditionSearch = "";

  suite.section("ordinary text still reads normally");
  const clean = require("./harness").loadApp();
  const combat = clean.renderCombatTab();
  suite.ok("an apostrophe becomes an entity", /Serpent&#39;s Fang/.test(combat));
  suite.ok("nothing is double escaped", !/&amp;(lt|gt|quot|#39|amp);/.test(combat));

  /* The mirror of the test above. Escaping text is the point; escaping markup
     the app built itself turns a tag into visible gibberish. That is exactly
     what happened to the sharing tag in the notes list: a bulk pass wrapped a
     variable called `tag`, which held a span rather than a word.

     Running on clean data means any escaped tag here is the app's own. */
  suite.section("markup the app built is not escaped as if it were text");
  // renderSelectorScreen writes into the DOM rather than returning markup
  [["combat", clean.renderCombatTab], ["character", clean.renderCharacterTab],
   ["spells", clean.renderSpellsTab], ["inventory", clean.renderInventoryTab],
   ["notes", clean.renderNotesTab]]
    .forEach(([name, render]) => {
      const html = render() || "";
      const leaked = (html.match(/&lt;\/?[a-z]+[^&]{0,80}?&gt;/g) || []);
      suite.is(name + " shows no tags as text", leaked.slice(0, 2), []);
    });

  suite.section("the sharing tags in particular");
  /* The demo character used to ship with sharing already set, which quietly
     made this suite depend on demo dressing. It sets up its own now. */
  clean.character.notes[0].sharing = {
    sharedByMe: false, sharedByName: HOSTILE, continuous: true, permission: "view"
  };
  clean.character.notes[1].sharing = {
    sharedByMe: true, continuous: true,
    sharedWith: [{ name: HOSTILE, device: "aaa111", permission: "edit" }]
  };
  const notes = clean.renderNotesTab();
  suite.ok("a note shared with you shows an incoming tag", /class="share-tag share-tag-in"/.test(notes));
  suite.ok("a note you share shows an outgoing one", /class="share-tag share-tag-out"/.test(notes));
  suite.ok("and the sharer's name is still escaped inside it",
    !/share-tag-in">[^<]*<script/.test(notes));
};
