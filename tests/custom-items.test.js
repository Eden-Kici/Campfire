/* Adding an item from the catalogue, and what happens when you change it on
   the way in. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { allInventoryItems, customVariantName, itemDiffersFromSource,
          rememberCustomItem, stackSignature, itemType } = app;

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

  suite.section("naming a variant");
  suite.is("a change earns a suffix", customVariantName("Longsword"), "Longsword (Custom)");
  suite.is("changing it again does not stack suffixes",
    customVariantName("Longsword (Custom)"), "Longsword (Custom)");
  suite.is("whatever the casing was", customVariantName("Longsword (custom)"), "Longsword (custom)");

  suite.section("what counts as changing it");
  const base = { name: "Longsword", category: "Equipped", weight: 3, qty: 1, isWeapon: true,
                 magicBonus: 0, damage: [{ dice: "1d8", type: "Slashing", ability: "STR" }] };
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
  const variant = like({ name: "Longsword (Custom)", magicBonus: 1, id: 77 });
  suite.is("a variant is kept", rememberCustomItem(variant), true);
  suite.is("in your content", app.customContent.items.length, before + 1);

  const kept = app.customContent.items[app.customContent.items.length - 1];
  suite.is("marked as yours, not the SRD's", kept.official, false);
  suite.is("tagged with what kind of thing it is", kept.type, "weapon");
  suite.is("without the quantity you happened to buy", "qty" in kept, false);
  suite.is("and with an id of its own, not the inventory row's", kept.id === 77, false);

  suite.is("keeping the same name twice does not duplicate it", rememberCustomItem(variant), false);
  suite.is("so your content has one of them", app.customContent.items.length, before + 1);
  suite.ok("and it is now searchable", allInventoryItems().some(i => i.name === "Longsword (Custom)"));
};
