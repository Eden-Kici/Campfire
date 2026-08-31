/* The icon set: that every icon is reachable, that none of them can fight the
   theme, and that the name-guesser puts something sensible on a sheet nobody
   has decorated by hand. */

module.exports = function (suite) {
  const harness = require("./harness");
  const app = harness.loadApp();
  const { ICONS, ICON_GROUPS, ICON_KEYWORDS, iconSvg, guessIcon, iconFor,
          iconPickerMatches, character } = app;

  const contentIcons = Object.keys(ICONS).filter(n => n.indexOf("tab-") !== 0);
  const grouped = ICON_GROUPS.reduce((all, g) => all.concat(g.icons), []);

  suite.section("every icon is reachable, and every name in the picker is real");
  /* Both directions matter and they fail differently: an icon missing from the
     groups is one nobody can ever choose, and a name in a group with no icon
     is a hole in the grid. */
  suite.is("nothing is drawn but unreachable",
    contentIcons.filter(n => grouped.indexOf(n) === -1), []);
  suite.is("nothing is offered but undrawn",
    grouped.filter(n => !ICONS[n]), []);
  suite.is("and nothing is listed twice",
    grouped.filter((n, i) => grouped.indexOf(n) !== i), []);
  suite.ok("there are enough of them to be worth a picker", contentIcons.length >= 100);

  suite.section("the five tabs all have a mark");
  ["combat", "character", "spells", "inventory", "notes"].forEach(tab => {
    suite.ok(tab, !!ICONS["tab-" + tab]);
  });

  suite.section("an icon cannot fight the theme");
  /* Every icon strokes with currentColor and carries no colour of its own. One
     with a fill, or its own stroke, would sit on a light theme as a dark blob
     and no amount of CSS would reach it. */
  /* width/height on a <rect> is geometry, not styling, so only the attributes
     that would override what iconSvg sets are checked. */
  const offenders = Object.keys(ICONS).filter(n =>
    /\b(fill|stroke|stroke-width|stroke-linecap|style|viewBox)=/.test(ICONS[n]));
  suite.is("none carry their own colour", offenders, []);
  suite.is("and none smuggle one in through a class",
    Object.keys(ICONS).filter(n => /class=/.test(ICONS[n])), []);

  suite.section("what iconSvg hands back");
  const svg = iconSvg("sword");
  suite.ok("is an svg", /^<svg /.test(svg));
  suite.ok("that strokes with currentColor", svg.indexOf('stroke="currentColor"') !== -1);
  suite.ok("and fills with nothing", svg.indexOf('fill="none"') !== -1);
  suite.ok("hidden from screen readers, since the name is always right there",
    svg.indexOf('aria-hidden="true"') !== -1);
  suite.is("an icon that doesn't exist draws nothing rather than a broken tag",
    iconSvg("no-such-icon"), "");

  suite.section("what a thing looks like, worked out from its name");
  /* The whole sheet is iconed on first run because of this table -- nobody has
     to visit 40 rows and pick. These are the ones the demo actually shows. */
  const guesses = {
    "Longsword": "sword", "Greatsword": "greatsword", "Shortbow": "bow",
    "Arrow": "arrow", "Crossbow Bolt": "arrow", "Chain Shirt": "cloak",
    "Cloak of Protection": "cloak", "Quiver": "quiver", "Torch": "torch",
    "Rope, Hempen (50 feet)": "rope", "Rations (1 day)": "bread",
    "Potion of Healing": "healing-cross", "Thieves' Tools": "lockpick",
    "Cure Wounds": "healing-cross", "Fire Bolt": "flame", "Sacred Flame": "flame",
    "Magic Missile": "force", "Mage Hand": "hand", "Bless": "radiant",
    "Shield": "shield", "Unarmed Strike": "unarmed", "Explorer's Pack": "backpack"
  };
  Object.keys(guesses).forEach(name => {
    suite.is(name, guessIcon(name), guesses[name]);
  });

  /* Order in the table is load-bearing and easy to break by adding a rule in
     the wrong place. These are the three collisions that actually bit. */
  suite.section("the collisions the table has to get right");
  suite.is("a Fire Bolt is a fire, not a bolt", guessIcon("Fire Bolt"), "flame");
  suite.is("but a Crossbow Bolt is ammunition, not a bow", guessIcon("Crossbow Bolt"), "arrow");
  suite.is("a Potion of Healing heals rather than poisons", guessIcon("Potion of Healing"), "healing-cross");
  suite.is("and Bardic Inspiration is not a ration", guessIcon("Bardic Inspiration") === "bread", false);

  suite.section("nothing on a sheet is ever iconless");
  suite.ok("an unrecognisable item still gets one", !!ICONS[guessIcon("Zzyzx", "item")]);
  suite.ok("so does an unrecognisable spell", !!ICONS[guessIcon("Zzyzx", "spell")]);
  suite.ok("and an unrecognisable resource", !!ICONS[guessIcon("Zzyzx", "resource")]);

  suite.section("a chosen icon wins, and a retired one does not empty the row");
  suite.is("what you picked", iconFor({ name: "Longsword", icon: "flame" }, "item"), "flame");
  suite.is("a name that no longer exists falls back to the guess",
    iconFor({ name: "Longsword", icon: "retired-in-a-later-version" }, "item"), "sword");
  suite.is("and no choice at all is the guess", iconFor({ name: "Longsword" }, "item"), "sword");

  suite.section("searching by the word people actually type");
  const found = q => iconPickerMatches(q).reduce((all, g) => all.concat(g.icons), []);
  suite.ok("fire finds the flame", found("fire").indexOf("flame") !== -1);
  suite.ok("armor finds the armour", found("armor").indexOf("cloak") !== -1);
  suite.ok("potion finds the flask", found("potion").indexOf("poison") !== -1);
  suite.ok("undead finds the skull", found("undead").indexOf("necrotic") !== -1);
  suite.is("and nonsense finds nothing rather than everything", iconPickerMatches("qqzzxx"), []);
  suite.is("an empty search is not a search at all", iconPickerMatches("   "), null);

  suite.section("every icon actually draws something, and draws its own thing");
  /* Whether a shape reads as what it claims to be is a thing you can only
     settle by looking at it, and every one of these was looked at. What can be
     checked here is the mechanical half: that nothing is empty, and that no two
     names share markup -- a duplicate is nearly always a copy-paste that never
     got its second drawing, and it hides as "two icons" in the picker. */
  const empty = Object.keys(ICONS).filter(n => !/<(path|circle|rect|line|ellipse|poly)/.test(ICONS[n]));
  suite.is("nothing is blank", empty, []);
  const seen = {};
  const twins = [];
  Object.keys(ICONS).forEach(n => {
    const key = ICONS[n];
    if (seen[key]) twins.push(seen[key] + "/" + n); else seen[key] = n;
  });
  suite.is("and no two are the same drawing", twins, []);

  suite.section("the demo character comes out decorated");
  const undecorated = character.inventory.filter(i => !ICONS[iconFor(i, "item")]);
  suite.is("every item has a mark", undecorated.map(i => i.name), []);
  suite.is("every spell has one too",
    character.spells.filter(s => !ICONS[iconFor(s, "spell")]).map(s => s.name), []);
  suite.is("and every resource",
    character.resources.filter(r => !ICONS[iconFor(r, "resource")]).map(r => r.name), []);

  suite.section("the set loads before anything that draws with it");
  const scripts = harness.scriptFiles();
  suite.ok("icons.js is in the page", scripts.indexOf("icons.js") !== -1);
  suite.ok("and ahead of ui.js, which builds the picker's fields out of it",
    scripts.indexOf("icons.js") < scripts.indexOf("ui.js"));
};
