/* ============================================================
   MERGED CONTENT LOOKUPS

   SRD content plus anything authored in Manage Content, in one place.

   These live here rather than in creator.js because rests.js needs them too
   (a custom class has to grant its features on level-up, not just in the
   builder), and shared machinery reaching into a screen file inverts the
   load-order-is-the-dependency-graph rule the rest of the app follows.

   customContent belongs to content.js, which loads later -- these are only
   ever called during a render, by which time it exists, and the guard keeps
   the tests' load-and-evaluate pass honest either way.
   ============================================================ */

function allRaces() {
  return SRD_RACES.concat(typeof customContent !== "undefined" ? customContent.races : []);
}

function allClasses() {
  return SRD_CLASSES.concat(typeof customContent !== "undefined" ? customContent.classes : []);
}

function raceByName(name) { return allRaces().find(r => r.name === name) || null; }
function classByName(name) { return allClasses().find(c => c.name === name) || null; }

// SRD races say `subraces: null`; the custom race editor leaves an empty
// array. Both mean "no subrace to pick", and the Race step's Next button
// used to hang forever on the array.
function subracesFor(race) {
  return (race && Array.isArray(race.subraces) && race.subraces.length) ? race.subraces : [];
}

/* Which class level a class picks its subclass at. srd-classes.js already
   knows this without a new field: a subclass's features carry the level they
   arrive at, so the earliest of those is the level the choice is made --
   which comes out at 1 for exactly Cleric, Sorcerer and Warlock, 2 for Druid
   and Wizard, and 3 for everyone else. Derived rather than a hardcoded list
   of three names so a custom class works too; a custom class can also say so
   outright with `subclassLevel`. A class's own subclasses decide it, not the
   merged list, so bolting a homebrew subclass onto the Fighter can't move
   when a Fighter chooses. Returns null for a class with no subclasses. */
function subclassChoiceLevel(className) {
  const cls = classByName(className);
  if (!cls) return null;
  if (cls.subclassLevel) return cls.subclassLevel;
  const list = (cls.subclasses || []).length ? cls.subclasses : subclassesForClass(className);
  const levels = list.reduce((all, sc) => all.concat((sc.features || []).map(f => f.level || 1)), []);
  return levels.length ? Math.min(...levels) : null;
}

/* Everything you could put in a bag, SRD and your own together, for the search
   in Add Item. Weapons, armour, tools, gear and magic items are five tables in
   the catalogue because that is how the SRD prints them -- but nobody adding a
   longsword to a backpack is thinking about which table it came from. */
function allInventoryItems() {
  const catalogue = [].concat(
    typeof SRD_WEAPONS !== "undefined" ? SRD_WEAPONS : [],
    typeof SRD_ARMOUR !== "undefined" ? SRD_ARMOUR : [],
    typeof SRD_TOOLS !== "undefined" ? SRD_TOOLS : [],
    typeof SRD_GEAR !== "undefined" ? SRD_GEAR : [],
    typeof SRD_MAGIC_ITEMS !== "undefined" ? SRD_MAGIC_ITEMS : []
  );
  const mine = (typeof customContent !== "undefined" && customContent.items) || [];
  // yours first: a custom Longsword is the one you meant
  return mine.concat(catalogue);
}
