/* The character shape has changed repeatedly, so what matters here is that a
   save round-trips every nested structure intact, and that a save written by
   an older version is refused rather than half-loaded. */

module.exports = function (suite) {
  const harness = require("./harness");
  const app = harness.loadApp();
  const { persistCharacters, loadCharacters, calculateAC, resourceRows,
          weaponList, nextCharacterId, STORAGE_KEY, SCHEMA_VERSION } = app;

  suite.section("what gets written");
  app.character.hp.current = 9;
  app.character.inventory.find(i => i.name === "Arrows").qty = 7;
  persistCharacters();

  const raw = app.localStorage.getItem(STORAGE_KEY);
  suite.ok("something was written", !!raw);
  const blob = JSON.parse(raw);
  suite.is("carries the current schema version", blob.version, SCHEMA_VERSION);
  suite.is("remembers which character was open", blob.openId, app.character.id);
  suite.ok("stores whole characters, not stubs", !!blob.characters[0].abilities);

  suite.section("round trip");
  app.savedCharacters = [];
  app.character = null;
  const result = loadCharacters();
  suite.is("not flagged stale", result.stale, false);
  suite.is("hit points survived", app.character.hp.current, 9);
  suite.is("armour survived as an object",
    app.character.inventory.find(i => i.name === "Chain Shirt").armour.base, 13);
  suite.is("armour class still computes", calculateAC(app.character).total, 16);
  suite.is("recharge survived as an object", app.character.resources[0].recharge.on, "SR");
  suite.ok("effects survived grouped", Array.isArray(app.character.activeEffects[0].effects));
  suite.is("tracked item quantity survived",
    app.character.inventory.find(i => i.name === "Arrows").qty, 7);
  suite.ok("the container survived", resourceRows(app.character).some(r => r.container));
  suite.ok("category rules survived", app.character.categoryRules.Equipped.providesAttacks);
  suite.is("attacks still resolve", weaponList(app.character).length, 3);

  suite.section("more than one character");
  const second = JSON.parse(JSON.stringify(app.character));
  second.id = nextCharacterId();
  second.name = "Brannoc";
  second.hp.current = 3;
  app.savedCharacters.push(second);
  app.character = second;
  persistCharacters();

  app.savedCharacters = [];
  app.character = null;
  loadCharacters();
  suite.is("both come back", app.savedCharacters.length, 2);
  suite.is("reopening the one that was open", app.character.name, "Brannoc");
  suite.is("each keeps its own state", app.character.hp.current, 3);

  suite.section("refusing an older schema");
  const previous = app.savedCharacters.map(c => c.name);
  app.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: SCHEMA_VERSION - 1,
    characters: [{ name: "Ancient" }]
  }));
  const stale = loadCharacters();
  suite.ok("flagged stale", stale.stale);
  suite.ok("saying which version", new RegExp("version " + (SCHEMA_VERSION - 1)).test(stale.reason));
  suite.is("leaving what is loaded alone", app.savedCharacters.map(c => c.name), previous);

  suite.section("damaged and empty stores");
  app.localStorage.setItem(STORAGE_KEY, "{ not json");
  suite.ok("unreadable is stale, not a crash", loadCharacters().stale);
  app.localStorage.removeItem(STORAGE_KEY);
  suite.is("an empty store loads nothing", loadCharacters(), null);

  suite.section("a failing store cannot take the session down");
  const realSet = app.localStorage.setItem;
  const realWarn = app.console.warn;
  app.localStorage.setItem = () => { throw new Error("QuotaExceeded"); };
  app.console.warn = () => {};                     // the warning is the point, not noise
  suite.runs("saving swallows the error", () => persistCharacters());
  app.localStorage.setItem = realSet;
  app.console.warn = realWarn;
};
