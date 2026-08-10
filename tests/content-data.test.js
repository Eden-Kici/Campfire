/* A linter for the SRD tables in srd-data.js, not for behaviour.

   The content-import project (races, classes, equipment, magic items, feats,
   conditions, pulled from 5esrd.com) is thousands of lines of hand-typed
   data across several files and several sessions. A typo here doesn't throw
   -- a feature with no desc just renders blank, a choice with a misspelled
   kind just never resolves, a duplicate name just shadows silently. None of
   that fails loudly enough for a person skimming a diff to catch, so it's
   caught here instead: every SRD table gets walked and checked for the same
   handful of shape rules every other table already follows. */

module.exports = function (suite) {
  const harness = require("./harness");
  const app = harness.loadApp();

  function checkFeature(label, f, failures) {
    if (!f.name || typeof f.name !== "string") failures.push(label + " has no name");
    if (!f.desc || typeof f.desc !== "string") failures.push(label + " (" + (f.name || "?") + ") has no desc");
    if (f.choice && !app.CHOICE_KINDS.some(k => k.value === f.choice.kind)) {
      failures.push(label + " (" + f.name + ") choice kind \"" + f.choice.kind + "\" isn't in CHOICE_KINDS");
    }
    if (f.level != null && (typeof f.level !== "number" || f.level < 1 || f.level > 20)) {
      failures.push(label + " (" + f.name + ") has an out-of-range level: " + f.level);
    }
  }

  function checkNoDuplicates(label, names, failures) {
    const seen = new Set();
    const dupes = new Set();
    names.forEach(n => { if (seen.has(n)) dupes.add(n); seen.add(n); });
    if (dupes.size) failures.push(label + " has duplicate names: " + [...dupes].join(", "));
  }

  suite.section("SRD_CONDITIONS");
  {
    const failures = [];
    app.SRD_CONDITIONS.forEach(c => checkFeature("SRD_CONDITIONS", c, failures));
    checkNoDuplicates("SRD_CONDITIONS", app.SRD_CONDITIONS.map(c => c.name), failures);
    const missing = app.SRD_CONDITIONS.map(c => c.name).filter(n => !app.ALL_CONDITIONS.includes(n));
    if (missing.length) failures.push("named in SRD_CONDITIONS but not ALL_CONDITIONS: " + missing.join(", "));
    suite.is("every condition is well-formed and every name is known", failures, []);
  }

  suite.section("SRD_RACES");
  {
    const failures = [];
    checkNoDuplicates("SRD_RACES", app.SRD_RACES.map(r => r.name), failures);
    app.SRD_RACES.forEach(r => {
      r.features.forEach(f => checkFeature("SRD_RACES." + r.name, f, failures));
      if (r.skillChoice) {
        (r.skillChoice.options || []).forEach(name => {
          if (!app.ALL_SKILL_NAMES.includes(name)) failures.push("SRD_RACES." + r.name + " skillChoice offers unknown skill \"" + name + "\"");
        });
      }
      (r.subraces || []).forEach(sr => {
        sr.features.forEach(f => checkFeature("SRD_RACES." + r.name + "." + sr.name, f, failures));
      });
      if (r.subraces) checkNoDuplicates("SRD_RACES." + r.name + " subraces", r.subraces.map(sr => sr.name), failures);
    });
    suite.is("every race, subrace and feature is well-formed", failures, []);
  }

  suite.section("SRD_CLASSES");
  {
    const failures = [];
    checkNoDuplicates("SRD_CLASSES", app.SRD_CLASSES.map(c => c.name), failures);
    app.SRD_CLASSES.forEach(c => {
      if (!app.CREATOR_ABILITY_ORDER.includes(c.mainAbility)) failures.push("SRD_CLASSES." + c.name + " has an unknown mainAbility: " + c.mainAbility);
      (c.saves || []).forEach(s => {
        if (!app.CREATOR_ABILITY_ORDER.includes(s)) failures.push("SRD_CLASSES." + c.name + " has an unknown save: " + s);
      });
      c.features.forEach(f => checkFeature("SRD_CLASSES." + c.name, f, failures));
      (c.skillChoices.options || []).forEach(name => {
        if (!app.ALL_SKILL_NAMES.includes(name)) failures.push("SRD_CLASSES." + c.name + " skillChoices offers unknown skill \"" + name + "\"");
      });
      checkNoDuplicates("SRD_CLASSES." + c.name + " subclasses", (c.subclasses || []).map(sc => sc.name), failures);
      (c.subclasses || []).forEach(sc => {
        sc.features.forEach(f => checkFeature("SRD_CLASSES." + c.name + "." + sc.name, f, failures));
      });
    });
    suite.is("every class, subclass and feature is well-formed", failures, []);
  }

  suite.section("SRD_BACKGROUNDS");
  {
    const failures = [];
    checkNoDuplicates("SRD_BACKGROUNDS", app.SRD_BACKGROUNDS.map(b => b.name), failures);
    app.SRD_BACKGROUNDS.forEach(b => {
      checkFeature("SRD_BACKGROUNDS", b.feature, failures);
      (b.skills || []).forEach(name => {
        if (!app.ALL_SKILL_NAMES.includes(name)) failures.push("SRD_BACKGROUNDS." + b.name + " grants unknown skill \"" + name + "\"");
      });
    });
    suite.is("every background and its feature is well-formed", failures, []);
  }

  suite.section("SRD_FEATS");
  {
    const failures = [];
    checkNoDuplicates("SRD_FEATS", app.SRD_FEATS.map(f => f.name), failures);
    app.SRD_FEATS.forEach(f => checkFeature("SRD_FEATS", f, failures));
    suite.is("every feat is well-formed", failures, []);
  }

  suite.section("SRD_MAGIC_ITEMS");
  {
    const failures = [];
    checkNoDuplicates("SRD_MAGIC_ITEMS", app.SRD_MAGIC_ITEMS.map(i => i.name), failures);
    app.SRD_MAGIC_ITEMS.forEach(i => {
      if (!i.name) failures.push("an SRD_MAGIC_ITEMS entry has no name");
      if (i.rarity && !app.ITEM_RARITIES.includes(i.rarity)) failures.push("SRD_MAGIC_ITEMS." + i.name + " has an unknown rarity: " + i.rarity);
      if (i.weight == null || typeof i.weight !== "number") failures.push("SRD_MAGIC_ITEMS." + i.name + " has no numeric weight");
      suite.runs("SRD_MAGIC_ITEMS." + (i.name || "?") + " resolves an item type", () => app.itemType(i));
    });
    suite.is("every magic item is well-formed", failures, []);
  }

  suite.section("KIT_ITEMS");
  {
    const failures = [];
    Object.entries(app.KIT_ITEMS).forEach(([key, i]) => {
      if (!i.name) failures.push("KIT_ITEMS." + key + " has no name");
      if (i.weight == null || typeof i.weight !== "number") failures.push("KIT_ITEMS." + key + " has no numeric weight");
    });
    suite.is("every starting-kit item is well-formed", failures, []);
  }
};
