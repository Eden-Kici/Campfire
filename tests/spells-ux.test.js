/* The spells UX pass: the casting-time marker, spell attack/damage pills, the
   spell detail window, and pinning a spell onto the Combat tab.

   The harness never fires a listener, so where a behaviour is a click these
   assertions pin the markup or the state the click depends on; each such case
   says so, and the click itself was driven in real Chromium. */

module.exports = function (suite) {
  const harness = require("./harness");
  const app = harness.loadApp();
  const c = app.character;

  const fireBolt = c.spells.find(s => s.name === "Fire Bolt");        // cantrip, attack roll
  const sacredFlame = c.spells.find(s => s.name === "Sacred Flame");  // cantrip, save for damage
  const mageHand = c.spells.find(s => s.name === "Mage Hand");        // neither
  const spiritual = c.spells.find(s => s.name === "Spiritual Weapon");// leveled, attack roll

  suite.section("the casting-time marker is an annotation, not a control");

  suite.runs("it wears the same tag as a resource row's SR/LR", () => {
    const html = app.renderSpellRow(fireBolt);
    if (!html.includes('<span class="res-tag">A</span>')) {
      throw new Error("expected the casting time to render as a .res-tag");
    }
  });

  suite.runs("nothing renders the filled .spell-tag any more", () => {
    // .spell-tag is a filled pill, and filled means "tap to roll" everywhere
    // else in this app -- it read as a button sitting next to real buttons
    const surfaces = [app.renderSpellsTab(), app.renderCombatTab()];
    if (surfaces.some(html => html.includes("spell-tag"))) throw new Error("a spell-tag survived");
  });

  suite.section("attack spells get the same two pills a weapon does");

  suite.runs("a spell that attacks shows its to-hit bonus, filled", () => {
    const html = app.renderSpellRow(fireBolt);
    if (!html.includes('data-spell-roll="' + fireBolt.id + '"')) throw new Error("expected an attack pill");
    const atk = app.spellAttackBonus(fireBolt);
    if (!html.includes(">" + app.formatModifier(atk.total) + "<")) {
      throw new Error("expected the pill to read the spell attack bonus, got: " + html);
    }
  });

  suite.runs("the bonus comes from the spell's own casting class", () => {
    // Sigrid casts as both a Wizard (INT) and a Cleric (WIS); a spell must use
    // the ability of the class it is cast with, not the first one on the sheet
    const wiz = app.spellAttackBonus(fireBolt);
    const cleric = app.spellAttackBonus(spiritual);
    const byAbility = ability => app.calculateSpellAttack(c, ability).total;
    suite.is("wizard spell uses INT", wiz.total, byAbility("INT"));
    suite.is("cleric spell uses WIS", cleric.total, byAbility("WIS"));
  });

  suite.runs("a spell with damage shows a damage pill", () => {
    const before = fireBolt.damage;
    fireBolt.damage = "1d10";
    const html = app.renderSpellRow(fireBolt);
    fireBolt.damage = before;
    if (!html.includes('data-spell-damage="' + fireBolt.id + '"')) throw new Error("expected a damage pill");
    if (!html.includes(">1d10<")) throw new Error("expected the pill to read the notation");
  });

  suite.runs("a save-for-damage spell gets the damage pill and no attack pill", () => {
    const before = sacredFlame.damage;
    sacredFlame.damage = "1d8";
    const html = app.renderSpellRow(sacredFlame);
    sacredFlame.damage = before;
    if (html.includes("data-spell-roll")) throw new Error("no attack roll, so no attack pill");
    if (!html.includes("data-spell-damage")) throw new Error("expected the damage pill");
  });

  suite.runs("a spell with neither gets neither", () => {
    const html = app.renderSpellRow(mageHand);
    if (html.includes("data-spell-roll") || html.includes("data-spell-damage")) {
      throw new Error("Mage Hand rolls nothing");
    }
  });

  suite.runs("a spell naming a class you don't cast shows a word, not NaN", () => {
    // calculateSpellAttack against an undefined ability produces NaN; the row
    // keeps the pill so the tap can still explain itself (rollSpellAttack)
    const saved = fireBolt.classSource;
    fireBolt.classSource = "Druid";
    const html = app.renderSpellRow(fireBolt);
    fireBolt.classSource = saved;
    if (html.includes("NaN")) throw new Error("NaN reached the sheet");
    if (!html.includes(">Attack<")) throw new Error("expected the pill to fall back to a label");
  });

  suite.runs("the damage notation is escaped", () => {
    // the escaping suite poisons name and desc, but `damage` is new here
    const saved = fireBolt.damage;
    fireBolt.damage = '<img src=x onerror=alert(1)>';
    const row = app.renderSpellRow(fireBolt);
    app.openSpellDetailModal(fireBolt.id);
    const modal = app.__modals[app.__modals.length - 1].html;
    fireBolt.damage = saved;
    if (row.includes("<img src=x")) throw new Error("raw markup survived in the row");
    if (modal.includes("<img src=x")) throw new Error("raw markup survived in the detail window");
  });

  suite.section("damage is authored, and the form suggests it");

  suite.runs("the suggestion reads the first dice the text calls damage", () => {
    suite.is("Fire Bolt", app.suggestedSpellDamage("Ranged spell attack, 1d10 fire damage."), "1d10");
    suite.is("with a modifier", app.suggestedSpellDamage("Three darts, 1d4+1 force damage each."), "1d4+1");
    suite.is("an SRD save spell", app.suggestedSpellDamage("A target takes 8d6 fire damage on a failed save."), "8d6");
  });

  suite.runs("healing dice are not damage", () => {
    suite.is("Cure Wounds", app.suggestedSpellDamage("Heal 1d8 + Wisdom modifier, plus 2 from Disciple of Life."), "");
    suite.is("Bless", app.suggestedSpellDamage("Three creatures add 1d4 to attack rolls and saving throws."), "");
    suite.is("no description at all", app.suggestedSpellDamage(undefined), "");
  });

  // the demo spells now ship with an authored notation, so the suggestion path
  // has to be tested on a spell that has none -- which is what an older save,
  // an import, or a hand-added spell looks like
  suite.runs("the edit form offers the suggestion, and says where it came from", () => {
    const saved = fireBolt.damage;
    delete fireBolt.damage;
    const html = app.spellFormFieldsHtml(fireBolt);
    fireBolt.damage = saved;
    if (!html.includes('id="spell-form-damage"')) throw new Error("expected a Damage field");
    if (!html.includes('value="1d10"')) throw new Error("expected the suggestion pre-filled");
    if (!html.includes("Read out of the description")) {
      throw new Error("a guess has to say it is one, or the player saves it without looking");
    }
  });

  suite.runs("a demo spell ships with its damage already authored", () => {
    // without this the feature is invisible until someone opens and re-saves
    suite.is("Fire Bolt", fireBolt.damage, "1d10");
  });

  suite.runs("a stored notation wins over the suggestion, with no guess hint", () => {
    const saved = fireBolt.damage;
    fireBolt.damage = "2d10";
    const html = app.spellFormFieldsHtml(fireBolt);
    fireBolt.damage = saved;
    if (!html.includes('value="2d10"')) throw new Error("expected the stored value");
    if (html.includes("Read out of the description")) throw new Error("nothing was guessed here");
  });

  suite.section("the row opens the spell, not the editor");

  suite.runs("tapping a spell opens its own window", () => {
    app.openSpellDetailModal(fireBolt.id);
    const modal = app.__modals[app.__modals.length - 1].html;
    if (!modal.includes(">" + fireBolt.name + "<")) throw new Error("expected the spell's name as the heading");
    if (modal.includes("Edit Spell</div>")) throw new Error("this is the form, not the detail window");
    if (!modal.includes("Cantrip")) throw new Error("expected the level");
    if (!modal.includes("Wizard")) throw new Error("expected the class");
    if (!modal.includes("Action")) throw new Error("expected the casting time spelled out");
    if (!modal.includes(fireBolt.desc)) throw new Error("expected the description");
    if (!modal.includes('id="edit-spell-button"')) throw new Error("expected a route to the editor");
  });

  // an attack spell rolls to hit; it never asks for a save, so printing a
  // save DC under its to-hit breakdown read as if the spell used both
  suite.runs("it shows the numbers behind the spell", () => {
    app.openSpellDetailModal(fireBolt.id);
    const modal = app.__modals[app.__modals.length - 1].html;
    if (!modal.includes("To Hit")) throw new Error("expected a to-hit breakdown");
    if (modal.includes("Save DC")) throw new Error("an attack spell forces no save -- expected no DC");
    // a save-for-damage spell is the case the DC belongs to
    app.openSpellDetailModal(sacredFlame.id);
    const saveModal = app.__modals[app.__modals.length - 1].html;
    if (!saveModal.includes("Save DC")) throw new Error("expected the class save DC on a save spell");
    const dc = app.calculateSpellDC(c, "WIS").total;
    if (!saveModal.includes(">" + dc + "<")) throw new Error("expected the DC total on the save spell");


  });

  suite.runs("a spell that doesn't attack has no to-hit section", () => {
    app.openSpellDetailModal(mageHand.id);
    const modal = app.__modals[app.__modals.length - 1].html;
    if (modal.includes("To Hit")) throw new Error("Mage Hand doesn't roll to hit");
  });

  suite.runs("the editor is still where renaming and deleting live", () => {
    app.openSpellEditModal(fireBolt.id);
    const modal = app.__modals[app.__modals.length - 1].html;
    if (!modal.includes("Edit Spell")) throw new Error("expected the form");
    if (!modal.includes('id="spell-form-name"')) throw new Error("expected the name field");
    if (!modal.includes('id="remove-spell-button"')) throw new Error("expected Remove to stay here");
  });

  suite.runs("Remove asks first", () => {
    // now that a spell can also be pinned, "remove" and "unpin" are two
    // different things and only one is permanent. Clicked in Chromium; here we
    // pin that the app's own dialog is in the path and no browser confirm is.
    const src = harness.readFile("tab-spells.js");
    const from = src.indexOf('remove-spell-button").addEventListener');
    if (from === -1) throw new Error("expected a Remove handler");
    const handler = src.slice(from, from + 500);
    if (!handler.includes("confirmModal")) throw new Error("expected confirmModal in the delete path");
    if (/\bconfirm\(/.test(handler)) throw new Error("no browser confirm()");
  });

  suite.section("pinning a spell to the Combat tab");

  suite.runs("nothing pinned means no Spells section on Combat", () => {
    c.spells.forEach(s => delete s.pinned);
    const html = app.renderCombatTab();
    if (html.includes(">Spells<")) throw new Error("an empty section appeared");
  });

  suite.runs("a pinned spell renders on Combat with the same row as the Spells tab", () => {
    fireBolt.pinned = true;
    fireBolt.damage = "1d10";
    const combat = app.renderCombatTab();
    if (!combat.includes(">Spells<")) throw new Error("expected a Spells section");
    if (!combat.includes(app.renderSpellRow(fireBolt))) {
      throw new Error("Combat should reuse the spell row, not a near-duplicate of it");
    }
    if (!combat.includes('data-spell-damage="' + fireBolt.id + '"')) throw new Error("expected the damage pill");
  });

  suite.runs("an unpinned spell stays off Combat and on Spells", () => {
    delete fireBolt.pinned;
    const combat = app.renderCombatTab();
    if (combat.includes('data-spell-view="' + fireBolt.id + '"')) throw new Error("still on Combat");
    if (!app.renderSpellsTab().includes('data-spell-view="' + fireBolt.id + '"')) {
      throw new Error("unpinning must not remove the spell from the Spells tab");
    }
  });

  suite.runs("the detail window is where pinning happens", () => {
    app.openSpellDetailModal(fireBolt.id);
    const modal = app.__modals[app.__modals.length - 1].html;
    if (!modal.includes('id="spell-pin-switch"')) throw new Error("expected a pin control");
  });

  suite.runs("pinned spells are found by reading the spells, not a second list", () => {
    fireBolt.pinned = true;
    suite.is("one pinned", app.pinnedSpells(c).map(s => s.name), ["Fire Bolt"]);
    // deleting the spell can therefore never leave a dangling pin behind
    const kept = c.spells;
    c.spells = c.spells.filter(s => s.id !== fireBolt.id);
    suite.is("deleting it takes the pin with it", app.pinnedSpells(c).length, 0);
    c.spells = kept;
  });

  suite.section("the pin and the damage ride along in the save");

  suite.runs("both survive a round trip", () => {
    fireBolt.pinned = true;
    fireBolt.damage = "1d10";
    app.persistCharacters();
    app.savedCharacters = [];
    app.character = null;
    app.loadCharacters();
    const reloaded = app.character.spells.find(s => s.name === "Fire Bolt");
    if (!reloaded.pinned) throw new Error("the pin was lost");
    if (reloaded.damage !== "1d10") throw new Error("the damage notation was lost");
  });

  suite.section("what had to keep working");

  suite.runs("casting still spends a slot", () => {
    const c2 = app.character;
    const spell = c2.spells.find(s => s.level === 1);
    const before = c2.spellSlots[1].current;
    app.castSpell(spell.id);       // opens the cast window
    app.confirmCast();             // and this is what spends
    if (c2.spellSlots[1].current !== before - 1) throw new Error("the slot wasn't spent");
    c2.spellSlots[1].current = before;
  });

  suite.runs("the prepared count and the dots still agree", () => {
    const c2 = app.character;
    const prepared = app.calculatePreparedSpellCount(c2);
    const html = app.renderSpellsTab();
    if (!html.includes(prepared.count + " / " + prepared.max + " prepared")) throw new Error("the counter moved");
    const dots = (html.match(/class="prof-dot prof"/g) || []).length;
    suite.is("a filled dot per prepared spell", dots, prepared.count);
  });

  suite.runs("the Prepared filter still hides unprepared leveled spells", () => {
    const c2 = app.character;
    const unprepared = c2.spells.find(s => s.level > 0 && !s.prepared)
      || Object.assign(c2.spells.find(s => s.level > 0), { prepared: false });
    app.spellFilter = "prepared";
    const html = app.renderSpellsTab();
    app.spellFilter = "all";
    if (html.includes('data-spell-view="' + unprepared.id + '"')) throw new Error("an unprepared spell showed through");
  });

  suite.runs("a level with no slots still gets a header and its rows", () => {
    const c2 = app.character;
    c2.spells.push({ id: 5150, name: "Fireball", level: 3, prepared: true,
                     classSource: "Wizard", castingTime: "A", attackRoll: false, damage: "8d6", desc: "" });
    const html = app.renderSpellsTab();
    c2.spells = c2.spells.filter(s => s.id !== 5150);
    if (!html.includes(app.levelLabel(3))) throw new Error("expected a 3rd-level header");
    if (!html.includes("no slots")) throw new Error("expected it to say there are no slots");
    if (!html.includes('data-spell-damage="5150"')) throw new Error("expected the row's damage pill");
  });

  suite.runs("the Combat tab still renders its own furniture", () => {
    const html = app.renderCombatTab();
    ["hp-card", "Conditions", "Resources", "Attacks", "data-roll-tohit"].forEach(marker => {
      if (!html.includes(marker)) throw new Error("lost " + marker);
    });
  });
};
