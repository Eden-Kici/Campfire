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
  c.partyMembers = [HOSTILE];
  c.weaponProficiencies = [HOSTILE];
  c.categoryRules[HOSTILE] = { countsWeight: true, appliesEffects: true, providesAttacks: true };
  c.inventory[0].category = HOSTILE;

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
    ["short rest", () => app.openShortRestModal()],
    ["give item", () => app.openGiveToModal(c.inventory[0], 1)]
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

  suite.section("the roll window");
  try {
    const attack = app.calculateAttack(c, weapon);
    app.showRoll({ label: HOSTILE, notation: "1d20", sources: attack.toHitSources, kind: "attack" });
    suite.ok("roll window", !survived(app.rollWindowHtml()), "raw markup survived");
  } catch (err) {
    suite.ok("roll window", false, err.message);
  }

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
  const notes = clean.renderNotesTab();
  suite.ok("a note shared with you shows an incoming tag", /class="share-tag share-tag-in"/.test(notes));
  suite.ok("a note you share shows an outgoing one", /class="share-tag share-tag-out"/.test(notes));
  suite.ok("and the sharer's name is still escaped inside it",
    !/share-tag-in">[^<]*<script/.test(notes));
};
