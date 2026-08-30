/* Packs, and the things inside them. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { isContainerItem, containerContents, topLevelItems, containerWeight,
          putInContainer, takeOutOfContainer, emptyContainer, removeItemAndContents,
          expandContainerContents, canMergeStacks, allInventoryItems,
          readItem, applyReceivedItem, SRD_GEAR } = app;

  const sheet = () => {
    const pack = { id: "a1-1", name: "Dungeoneer's Pack", category: "Carrying", weight: 0, qty: 1, isContainer: true };
    const rope = { id: "a1-2", name: "Rope, Hempen (50 feet)", category: "Carrying", weight: 10, qty: 1, inside: "a1-1" };
    const torch = { id: "a1-3", name: "Torch", category: "Carrying", weight: 1, qty: 10, inside: "a1-1" };
    const sword = { id: "a1-4", name: "Longsword", category: "Equipped", weight: 3, qty: 1 };
    return {
      inventory: [pack, rope, torch, sword],
      categoryRules: {
        Equipped: { countsWeight: true, appliesEffects: true, providesAttacks: true },
        Carrying: { countsWeight: true, appliesEffects: false, providesAttacks: false }
      },
      pack: pack, rope: rope, torch: torch, sword: sword
    };
  };

  suite.section("the catalogue's packs");
  const packs = SRD_GEAR.filter(i => i.isContainer);
  suite.is("all seven are containers now", packs.length, 7);
  suite.ok("and every one lists what is in it", packs.every(p => (p.contents || []).length > 0));
  const named = {};
  allInventoryItems().forEach(row => { named[row.name] = row; });
  const unresolved = [];
  packs.forEach(p => p.contents.forEach(c => {
    if (!named[c.name] && c.weight === undefined) unresolved.push(p.name + " -> " + c.name);
  }));
  suite.is("every content row either matches the catalogue or carries its own weight", unresolved, []);

  suite.section("what is where");
  const s = sheet();
  suite.is("a pack knows it is one", isContainerItem(s.pack), true);
  suite.is("a longsword does not", isContainerItem(s.sword), false);
  suite.is("the pack holds two things", containerContents(s, s.pack).length, 2);
  suite.is("the top of the list shows the pack and the sword, not the contents",
    topLevelItems(s).map(i => i.name), ["Dungeoneer's Pack", "Longsword"]);

  /* An empty backpack reporting 0 lb while holding sixty pounds of rope is the
     thing this replaced. */
  suite.is("a pack weighs what is in it", containerWeight(s, s.pack), 20);
  suite.is("an empty one weighs only itself",
    containerWeight({ inventory: [] }, { id: "x", weight: 5, qty: 1 }), 5);

  suite.section("putting things in and taking them out");
  const t = sheet();
  suite.is("a sword goes in", putInContainer(t, t.sword, t.pack), true);
  suite.is("and is now inside it", t.sword.inside, "a1-1");
  /* The category follows the pack, and that is what keeps the rest of the app
     right: a sword in a bag in Carrying provides no attacks, without a single
     rule about containers being written anywhere near the attack code. */
  suite.is("and takes the pack's category with it", t.sword.category, "Carrying");

  suite.is("a pack cannot go inside a pack",
    putInContainer(t, t.pack, { id: "zz", isContainer: true }), false);
  suite.is("nor inside itself", putInContainer(t, t.pack, t.pack), false);

  suite.is("taking it out again", takeOutOfContainer(t.sword, "Equipped"), true);
  suite.is("clears where it was", "inside" in t.sword, false);
  suite.is("and puts it where you dropped it", t.sword.category, "Equipped");
  suite.is("taking out something that was never in is harmless",
    takeOutOfContainer(t.sword, "Equipped"), false);

  suite.section("tipping one out");
  const u = sheet();
  const spilled = emptyContainer(u, u.pack);
  suite.is("everything comes out", spilled.length, 2);
  suite.is("into the pack's own category", spilled.map(i => i.category), ["Carrying", "Carrying"]);
  suite.is("and the pack is empty", containerContents(u, u.pack).length, 0);
  suite.is("but still on the sheet", u.inventory.length, 4);

  suite.section("getting rid of one");
  const v = sheet();
  const gone = removeItemAndContents(v, v.pack);
  suite.is("the pack and its contents go together", gone.length, 3);
  suite.is("leaving only what was never in it", v.inventory.map(i => i.name), ["Longsword"]);

  suite.section("packs never stack");
  const w = sheet();
  suite.is("two identical packs are not two of a pack",
    canMergeStacks(w.pack, Object.assign({}, w.pack, { id: "b2-1" })), false);

  suite.section("adding one from the catalogue");
  const fresh = { inventory: [], categoryRules: { Carrying: { countsWeight: true } } };
  const bought = { id: "z-1", name: "Explorer's Pack", category: "Carrying", weight: 0, qty: 1, isContainer: true };
  fresh.inventory.push(bought);
  const packed = expandContainerContents(fresh, bought, SRD_GEAR.find(i => i.name === "Explorer's Pack"));
  suite.is("its contents become real rows", packed.length, 8);
  suite.ok("each pointing back at the pack", packed.every(i => i.inside === "z-1"));
  suite.ok("with weights from the catalogue", packed.find(i => i.name === "Torch").weight === 1);
  suite.is("ten torches, not one", packed.find(i => i.name === "Torch").qty, 10);
  suite.is("and the pack now weighs what it holds", containerWeight(fresh, bought), 59);

  suite.section("handing one over");
  const wire = readItem({
    name: "Dungeoneer's Pack", weight: 0, qty: 1, isContainer: true,
    contents: [{ name: "Torch", qty: 10, weight: 1 }, { name: "Crowbar", qty: 1, weight: 5 }]
  });
  suite.is("the contents survive the trip", wire.contents.length, 2);
  suite.is("with their counts", wire.contents.find(c => c.name === "Torch").qty, 10);

  /* Packs inside packs are not a thing, so a message claiming one is flattened
     rather than trusted. */
  const nested = readItem({
    name: "Outer", weight: 1, isContainer: true,
    contents: [{ name: "Inner", weight: 1, isContainer: true, contents: [{ name: "Deep", weight: 1 }] }]
  });
  suite.is("a pack inside a pack arrives as an ordinary item",
    "isContainer" in nested.contents[0], false);
  suite.is("and brings nothing of its own", "contents" in nested.contents[0], false);

  const receiver = { inventory: [], categoryRules: { Carrying: { countsWeight: true } } };
  applyReceivedItem(receiver, { id: "t-1", name: "Dungeoneer's Pack", category: "Carrying", weight: 0, qty: 1, isContainer: true }, wire.contents);
  suite.is("it lands with its contents", receiver.inventory.length, 3);
  suite.is("all pointing at it", receiver.inventory.filter(i => i.inside === "t-1").length, 2);

  applyReceivedItem(receiver, { id: "t-1", name: "Dungeoneer's Pack", category: "Carrying", weight: 0, qty: 1, isContainer: true }, wire.contents);
  suite.is("a repeated delivery does not double the contents", receiver.inventory.length, 3);
};
