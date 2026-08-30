/* The party protocol. Everything here arrives off a network from a phone we
   do not control, so most of these tests are about what happens when it is
   wrong rather than when it is right. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { makeRoomCode, normaliseRoomCode, isRoomCode, readRosterEntry, wireRosterEntry,
          readPartySettings, readEffectGroup, partyMessage, parsePartyMessage,
          mergeRosterEntry, dropRosterEntry, partyMemberNames,
          receivedEffectGroup, applyEffectGroup, PARTY_PROTOCOL_VERSION } = app;

  const HOSTILE = '<img src=x onerror="alert(1)">';

  const entry = (over) => Object.assign({
    device: "a1b2c3", name: "Sigrid of Chester", owner: false,
    classNames: "Fighter / Wizard", level: 6, hp: 22, maxHp: 44, customBuild: false
  }, over || {});

  const bless = () => ({
    id: "a1b2c3-9", name: "Bless", note: "", concentration: true,
    duration: { type: "Rounds", rounds: 10 },
    effects: [
      { category: "Bonus", value: { stat: "Attack Rolls", amount: 1 } },
      { category: "Saving Throw", value: { ability: "WIS", amount: 1 } }
    ]
  });

  suite.section("room codes");
  let allValid = true, sawAmbiguous = false;
  for (let i = 0; i < 400; i++) {
    const code = makeRoomCode();
    if (!isRoomCode(code)) allValid = false;
    if (/[O0I1]/.test(code)) sawAmbiguous = true;
  }
  suite.ok("every generated code is a valid code", allValid);
  suite.ok("no generated code contains O, 0, I or 1", !sawAmbiguous);
  suite.is("lowercase is accepted", isRoomCode("kt4m"), true);
  suite.is("stray spaces are accepted", isRoomCode(" KT 4M "), true);
  suite.is("normalising gives the canonical form", normaliseRoomCode(" kt 4m "), "KT4M");
  suite.is("too short is refused", isRoomCode("KT4"), false);
  suite.is("too long is refused", isRoomCode("KT4MX"), false);
  suite.is("an ambiguous character is refused rather than guessed", isRoomCode("KT40"), false);
  suite.is("nothing at all is refused", isRoomCode(null), false);

  suite.section("reading a roster entry off the wire");
  suite.is("a missing device id is refused", readRosterEntry({ name: "X" }), null);
  suite.is("a junk device id is refused", readRosterEntry({ device: "../../etc" }), null);
  suite.is("not an object at all is refused", readRosterEntry("hello"), null);
  suite.is("a good entry keeps its name", readRosterEntry(entry()).name, "Sigrid of Chester");
  suite.is("a nameless entry gets a stand-in", readRosterEntry({ device: "a1b2c3" }).name, "Adventurer");
  suite.is("an absurd name is cut to length",
    readRosterEntry(entry({ name: "x".repeat(500) })).name.length, 40);
  suite.is("a level above 20 is clamped", readRosterEntry(entry({ level: 99 })).level, 20);
  suite.is("a level below 1 is clamped", readRosterEntry(entry({ level: 0 })).level, 1);
  suite.is("hit points that aren't numbers become nothing",
    readRosterEntry(entry({ hp: "lots" })).hp, null);

  /* A character that hasn't been opened yet reports no level and no hit
     points, which has to stay different from reporting zero of them. */
  const noCharacter = readRosterEntry({ device: "a1b2c3", name: "Adventurer" });
  suite.is("no character open means no level field", "level" in noCharacter, false);
  suite.is("no character open means no hit points field", "hp" in noCharacter, false);

  suite.section("what an entry is not allowed to smuggle in");
  const sneaky = readRosterEntry(entry({ isGM: true, adminToken: "x", profilePic: "data:..." }));
  suite.is("unknown fields are dropped, not merged", Object.keys(sneaky).sort(),
    ["classNames", "customBuild", "device", "hp", "level", "maxHp", "name", "owner"]);
  suite.is("a hostile name is kept verbatim as data for the render layer to escape",
    readRosterEntry(entry({ name: HOSTILE })).name, HOSTILE);

  suite.section("what we send");
  const mine = entry({ you: true, pic: "data:image/png;base64,AAAA" });
  suite.is("our own 'you' marker never goes over the wire", "you" in wireRosterEntry(mine), false);
  suite.is("the avatar never goes over the wire", "pic" in wireRosterEntry(mine), false);
  suite.is("a full entry survives the round trip",
    readRosterEntry(JSON.parse(JSON.stringify(wireRosterEntry(entry())))).name, "Sigrid of Chester");

  suite.section("party settings");
  suite.is("a nonsense hit point mode falls back to stats",
    readPartySettings({ hpDisplay: "telepathy" }).hpDisplay, "stats");
  suite.is("a real mode is kept", readPartySettings({ hpDisplay: "estimate" }).hpDisplay, "estimate");
  suite.is("missing toggles read as off", readPartySettings({}).showClasses, false);

  suite.section("messages");
  suite.is("garbage is not a message", parsePartyMessage("not json"), null);
  suite.is("an empty object is not a message", parsePartyMessage("{}"), null);
  suite.is("an unknown type is not a message", parsePartyMessage('{"v":1,"t":"launch"}'), null);
  suite.is("a message from another protocol version is reported, not guessed at",
    parsePartyMessage('{"v":99,"t":"here"}').t, "version-mismatch");

  const hereMsg = parsePartyMessage(partyMessage("here", {
    entry: wireRosterEntry(entry()), settings: { hpDisplay: "estimate" }, partyName: "The Rusty Blades"
  }));
  suite.is("a here message reads back its entry", hereMsg.entry.device, "a1b2c3");
  suite.is("a here message carries the host's settings", hereMsg.settings.hpDisplay, "estimate");
  suite.is("a here message with a broken entry is refused",
    parsePartyMessage(partyMessage("here", { entry: { name: "no device" } })), null);

  suite.is("a bye message reads back its device",
    parsePartyMessage(partyMessage("bye", { device: "a1b2c3" })).device, "a1b2c3");
  suite.is("a bye message without a device is refused",
    parsePartyMessage(partyMessage("bye", {})), null);

  const effMsg = parsePartyMessage(partyMessage("effect", { group: bless(), to: "d4e5f6", fromName: "Sigrid" }));
  suite.is("an effect message reads back its group", effMsg.group.name, "Bless");
  suite.is("an effect message without a target goes to everyone",
    parsePartyMessage(partyMessage("effect", { group: bless() })).to, "*");

  suite.section("reading an effect group off the wire");
  suite.is("an idless group is refused", readEffectGroup({ name: "Bless" }), null);
  suite.is("a made-up duration falls back to permanent",
    readEffectGroup({ id: "x-1", duration: { type: "Forever" } }).duration.type, "Permanent");
  suite.is("a permanent effect has no round count",
    readEffectGroup({ id: "x-1" }).duration.rounds, null);
  suite.is("an absurd round count is clamped",
    readEffectGroup({ id: "x-1", duration: { type: "Rounds", rounds: 1e9 } }).duration.rounds, 1000);
  suite.is("a hundred modifier rows are cut down",
    readEffectGroup({ id: "x-1", effects: new Array(100).fill({ category: "Bonus", value: { amount: 1 } }) }).effects.length, 12);
  suite.is("a modifier row with no category is dropped",
    readEffectGroup({ id: "x-1", effects: [{ value: { amount: 1 } }] }).effects.length, 0);
  suite.is("a modifier value that is an array is refused",
    readEffectGroup({ id: "x-1", effects: [{ category: "Bonus", value: [1, 2] }] }).effects.length, 0);
  suite.is("a nested object inside a modifier value is dropped",
    JSON.stringify(readEffectGroup({ id: "x-1", effects: [{ category: "Bonus", value: { amount: 1, deep: { a: 1 } } }] }).effects[0].value),
    JSON.stringify({ amount: 1 }));

  suite.section("keeping the roster");
  let members = [];
  members = mergeRosterEntry(members, entry());
  suite.is("a new device joins the roster", members.length, 1);
  members = mergeRosterEntry(members, entry({ hp: 3 }));
  suite.is("the same device updates rather than duplicating", members.length, 1);
  suite.is("and the update lands", members[0].hp, 3);

  members = mergeRosterEntry([{ device: "a1b2c3", name: "Me", you: true, pic: "data:x" }], entry({ hp: 9 }));
  suite.is("an update from the far side does not wipe our local 'you' marker", members[0].you, true);
  suite.is("nor the avatar it never knew about", members[0].pic, "data:x");

  members = mergeRosterEntry(members, entry({ device: "d4e5f6", name: "Tomas" }));
  suite.is("a second device joins", members.length, 2);
  suite.is("leaving removes exactly one", dropRosterEntry(members, "a1b2c3").length, 1);
  suite.is("leaving twice is harmless", dropRosterEntry(dropRosterEntry(members, "a1b2c3"), "a1b2c3").length, 1);

  suite.section("who Note Share and item Give offer you");
  suite.is("everyone but yourself", partyMemberNames(members, "a1b2c3"), ["Tomas"]);
  suite.is("nobody at all when you are not in a party", partyMemberNames([], "a1b2c3"), []);

  suite.section("receiving an effect someone pushed");
  /* Concentration belongs to the caster. The cleric concentrates on Bless;
     the fighter standing in it does not, and must not have their own
     concentration broken by being blessed. */
  const received = receivedEffectGroup(bless(), "Sigrid");
  suite.is("a pushed effect arrives unconcentrated", received.concentration, false);
  suite.is("the sender's own group is untouched", bless().concentration, true);
  suite.is("it says who sent it", received.fromName, "Sigrid");
  suite.is("it keeps the sender's id", received.id, "a1b2c3-9");

  const sheet = { activeEffects: [{ id: 1, name: "Prone" }] };
  applyEffectGroup(sheet, received);
  suite.is("it lands on the sheet alongside what was there", sheet.activeEffects.length, 2);
  applyEffectGroup(sheet, receivedEffectGroup(bless(), "Sigrid"));
  suite.is("pushing the same effect twice updates instead of stacking", sheet.activeEffects.length, 2);
  suite.is("an effect from a different device does not collide",
    applyEffectGroup(sheet, receivedEffectGroup(Object.assign(bless(), { id: "d4e5f6-9" }), "Tomas")).length, 3);
};
