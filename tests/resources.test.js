/* Resources come from standalone entries and from inventory items. An item
   either counts itself (a stack) or holds a count refilled from elsewhere
   (a container). The point of the model is that no number is stored twice. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { character, resourceRows, findResourceRow, adjustResourceRow, refillContainer,
          isContainer, calculateAttack, calculateCarriedWeight, applyRest } = app;

  const item = name => character.inventory.find(i => i.name === name);
  const row = name => resourceRows(character).find(r => r.name === name);

  suite.section("where rows come from");
  suite.ok("standalone resources appear", !!row("Action Surge"));
  suite.ok("tracked items appear", !!row("Arrows"));
  suite.ok("an item-backed row knows its item", !!row("Arrows").item);
  suite.ok("arrows are not also a standalone resource",
    !character.resources.some(r => r.name === "Arrows"));

  suite.section("a stack counts itself");
  suite.is("the row reads the quantity", row("Arrows").current, item("Arrows").qty);
  adjustResourceRow(findResourceRow(character, row("Arrows").key), -5);
  suite.is("the stepper writes to the quantity", item("Arrows").qty, 55);
  suite.is("and the row follows", row("Arrows").current, 55);
  suite.near("weight follows the count", calculateCarriedWeight(character).sources
    .find(s => s.label === "Arrows").value, 2.75, 0.01);
  item("Arrows").qty = 60;

  suite.section("a container holds a count");
  suite.ok("the quiver is a container", isContainer(item("Quiver")));
  suite.ok("the arrow stack is not", !isContainer(item("Arrows")));
  suite.is("its count is what is loaded", row("Quiver").current, item("Quiver").resource.loaded);
  suite.is("not how many quivers you own", item("Quiver").qty, 1);

  suite.section("the bow draws from the quiver");
  const ammunition = calculateAttack(character, item("Shortbow")).ammunition;
  suite.is("ammunition resolves to the container", ammunition.name, "Quiver");
  adjustResourceRow(findResourceRow(character, ammunition.key), -1);
  suite.is("firing empties the quiver, not the pack", item("Quiver").resource.loaded, 19);
  suite.is("the pack is untouched", item("Arrows").qty, 60);

  suite.section("refilling conserves arrows");
  item("Quiver").resource.loaded = 0;
  const total = item("Arrows").qty;
  let result = refillContainer(character, row("Quiver"));
  suite.is("a full load moves across", result.moved, 20);
  suite.is("the quiver is full", row("Quiver").current, 20);
  suite.is("the pack is down by exactly that", item("Arrows").qty, total - 20);
  suite.is("nothing was created", row("Quiver").current + item("Arrows").qty, total);

  item("Quiver").resource.loaded = 15;
  result = refillContainer(character, row("Quiver"));
  suite.is("a partial refill tops up only the gap", result.moved, 5);

  result = refillContainer(character, row("Quiver"));
  suite.is("refilling a full container does nothing", result.moved, 0);
  suite.is("and says why", result.reason, "full");

  item("Arrows").qty = 3;
  item("Quiver").resource.loaded = 0;
  result = refillContainer(character, row("Quiver"));
  suite.is("a short pack gives what it has", result.moved, 3);
  suite.is("leaving the pack empty", item("Arrows").qty, 0);

  result = refillContainer(character, row("Quiver"));
  suite.is("an empty pack moves nothing", result.moved, 0);
  suite.is("and says why", result.reason, "empty");

  item("Quiver").resource.refillFrom = "Bolts";
  suite.is("a missing source is reported", refillContainer(character, row("Quiver")).reason, "missing");
  item("Quiver").resource.refillFrom = "Arrows";
  item("Arrows").qty = 60;
  item("Quiver").resource.loaded = 20;

  suite.section("item-backed resources recharge like any other");
  item("Arrows").resource.recharge = { on: "LR", amount: "all" };
  item("Arrows").resource.max = 60;
  item("Arrows").qty = 2;
  applyRest("short");
  suite.is("not on a short rest", item("Arrows").qty, 2);
  applyRest("long");
  suite.is("restored on a long rest", item("Arrows").qty, 60);
  item("Arrows").resource.recharge = { on: "none", amount: "all" };
  item("Arrows").resource.max = 0;

  suite.section("an uncapped stack cannot be restored to a full it doesn't have");
  const loose = { id: 950, name: "Loose Coins", current: 40, max: 0, recharge: { on: "LR", amount: "all" } };
  character.resources.push(loose);
  applyRest("long");
  suite.is("restoring all leaves it alone", loose.current, 40);
  loose.recharge = { on: "LR", amount: "half" };
  applyRest("long");
  suite.is("half leaves it alone too, rather than adding one", loose.current, 40);
  loose.recharge = { on: "LR", amount: 5 };
  applyRest("long");
  suite.is("a specific amount still works, uncapped", loose.current, 45);
  loose.recharge = { on: "LR", amount: -3 };
  applyRest("long");
  suite.is("a negative amount never drains it", loose.current, 45);
  character.resources = character.resources.filter(r => r.id !== 950);

  suite.section("untracking keeps the item");
  const arrows = item("Arrows");
  const inventorySize = character.inventory.length;
  delete arrows.resource;
  suite.is("the item survives", character.inventory.length, inventorySize);
  suite.ok("it just leaves the resource list", !resourceRows(character).some(r => r.name === "Arrows"));
  suite.ok("and is still in the bags", /Arrows/.test(app.renderInventoryTab()));
  arrows.resource = { max: 0, recharge: { on: "none", amount: "all" } };

  suite.section("spell slots stay a single source of truth");
  suite.ok("slots are not duplicated into resources",
    !character.resources.some(r => /Spell Slot/i.test(r.name)));
  character.spellSlots[1].current = 1;
  suite.is("the combat tab and spells tab read the same object",
    character.spellSlots[1].current, 1);
};
