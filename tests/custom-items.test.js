/* Adding an item from the catalogue, and what happens when you change it on
   the way in. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { allInventoryItems, itemDiffersFromSource, itemSource, itemSourceTagHtml,
          rememberCustomItem, contentShape, itemType } = app;

  suite.section("what the search looks through");
  const catalogue = allInventoryItems();
  suite.ok("weapons are in it", catalogue.some(i => i.name === "Longsword"));
  suite.ok("armour is in it", catalogue.some(i => i.name === "Chain Shirt"));
  suite.ok("gear is in it", catalogue.some(i => i.name === "Arrow"));
  suite.ok("magic items are in it", catalogue.some(i => /^Armor, \+1$/.test(i.name)));
  suite.is("nothing in it is still sold as a bundle",
    catalogue.filter(i => /\(\d+\)/.test(i.name)).map(i => i.name), []);

  app.customContent.items.push({ id: 900, name: "Zzz Test Blade", official: false, type: "weapon", weight: 3 });
  const withMine = allInventoryItems();
  suite.ok("your own content is in it too", withMine.some(i => i.name === "Zzz Test Blade"));
  suite.is("and comes first, because a custom Longsword is the one you meant",
    withMine[0].name, "Zzz Test Blade");

  suite.section("what counts as changing it");
  /* The real catalogue row, not a hand-written stand-in. A fixture that merely
     resembles a Longsword matches nothing, and the whole point of itemSource is
     that it compares against what is actually in the catalogue. */
  const base = Object.assign({ qty: 1 }, allInventoryItems().find(i => i.name === "Longsword"));
  const like = (over) => Object.assign({}, base, over || {});

  suite.is("an item typed from scratch is never a variant",
    itemDiffersFromSource(like(), null), false);
  suite.is("picking one and saving it untouched is not a change",
    itemDiffersFromSource(like(), like()), false);

  /* Buying three of something is not inventing a new thing, and where it sits
     on your sheet is where you keep it rather than what it is. */
  suite.is("quantity alone is not a change", itemDiffersFromSource(like({ qty: 3 }), like()), false);
  suite.is("category alone is not a change",
    itemDiffersFromSource(like({ category: "Camp Storage" }), like()), false);

  suite.is("weight is a change", itemDiffersFromSource(like({ weight: 2 }), like()), true);
  suite.is("a magic bonus is a change", itemDiffersFromSource(like({ magicBonus: 1 }), like()), true);
  suite.is("so is the damage it deals",
    itemDiffersFromSource(like({ damage: [{ dice: "1d10", type: "Slashing", ability: "STR" }] }), like()), true);
  suite.is("and renaming it yourself",
    itemDiffersFromSource(like({ name: "Sigrid's Blade" }), like()), true);

  suite.section("keeping it");
  const before = app.customContent.items.length;
  /* A variant keeps the name it came from and is marked as yours instead --
     "Longsword (Custom)" made every variation read like a different weapon. */
  const variant = like({ magicBonus: 1, id: 77 });
  suite.is("a variant is kept", rememberCustomItem(variant), true);
  suite.is("in your content", app.customContent.items.length, before + 1);

  const kept = app.customContent.items[app.customContent.items.length - 1];
  suite.is("marked as yours, not the SRD's", kept.official, false);
  suite.is("tagged with what kind of thing it is", kept.type, "weapon");
  suite.is("without the quantity you happened to buy", "qty" in kept, false);
  suite.is("and with an id of its own, not the inventory row's", kept.id === 77, false);

  suite.is("it keeps the name it came from", kept.name, "Longsword");
  suite.is("saving the very same variant again does not duplicate it", rememberCustomItem(variant), false);
  suite.is("so your content has one of them", app.customContent.items.length, before + 1);

  /* Matched on shape, not name: a second, different custom longsword is a
     second entry rather than a collision. */
  suite.is("but a different variant of the same thing is its own entry",
    rememberCustomItem(like({ weight: 9, id: 78 })), true);
  suite.is("so now there are two", app.customContent.items.length, before + 2);

  suite.section("where a row came from, worked out rather than remembered");
  suite.is("one matching your content is yours", itemSource(like({ magicBonus: 1 })), "CC");
  suite.is("an untouched catalogue row is the SRD's", itemSource(like()), "SRD");
  suite.is("a name nothing in the catalogue has is yours",
    itemSource(like({ name: "Sigrid's Blade" })), "CC");
  suite.is("and so is a preset you have changed",
    itemSource(like({ weight: 99 })), "CC");

  /* The decisions you make about your copy are not changes to the thing. */
  suite.is("tracking a stack does not make it homebrew",
    itemSource(like({ resource: { max: 0, recharge: { on: "none", amount: "all" } } })), "SRD");
  suite.is("nor does turning it into a container", itemSource(like({ isContainer: true })), "SRD");
  suite.is("nor marking it off-hand", itemSource(like({ offHand: true })), "SRD");
  suite.is("nor stowing it somewhere else", itemSource(like({ category: "Camp Storage" })), "SRD");
  suite.is("nor buying three", itemSource(like({ qty: 3 })), "SRD");

  suite.section("which tags actually show");
  app.settings.showSourceTags = false;
  suite.ok("yours is always marked", /CC/.test(itemSourceTagHtml(like({ magicBonus: 1 }))));
  suite.is("the SRD's is not, by default", itemSourceTagHtml(like()), "");
  app.settings.showSourceTags = true;
  suite.ok("until you ask for tags", /SRD/.test(itemSourceTagHtml(like())));
  suite.ok("and yours still says CC", /CC/.test(itemSourceTagHtml(like({ magicBonus: 1 }))));
  app.settings.showSourceTags = false;
};
