/* The party protocol. Everything here arrives off a network from a phone we
   do not control, so most of these tests are about what happens when it is
   wrong rather than when it is right. */

module.exports = function (suite) {
  const app = require("./harness").loadApp();
  const { makeRoomCode, normaliseRoomCode, isRoomCode, readRosterEntry, wireRosterEntry,
          readPartySettings, readEffectGroup, partyMessage, parsePartyMessage,
          mergeRosterEntry, dropRosterEntry, partyMemberNames,
          receivedEffectGroup, applyEffectGroup, wireEffectGroup, partyMemberList,
          wireNote, readNote, receivedNote, inboxSection, applySharedNote, removeSharedNote,
          readItem, wireItem, landingCategory, receivedItem, applyReceivedItem, equippedEffectItems,
          weaponList,
          PARTY_PROTOCOL_VERSION } = app;

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

  suite.section("an effect that scales with level");
  /* The caster's level decides how strong it is. Left as a tiers table it
     would resolve against whoever received it instead. */
  const scaling = () => ({
    id: "a1b2c3-4", name: "Aura of Protection", concentration: false,
    duration: { type: "Permanent", rounds: null },
    effects: [{ category: "Bonus", value: { stat: "Saving Throws", amount: { tiers: [
      { level: 1, value: 1 }, { level: 6, value: 2 }, { level: 12, value: 3 }
    ] } } }]
  });

  suite.is("a table is flattened at the sender's level, not the receiver's",
    wireEffectGroup(scaling(), 12).effects[0].value.amount, 3);
  suite.is("a lower-level sender sends the smaller number",
    wireEffectGroup(scaling(), 6).effects[0].value.amount, 2);
  suite.is("the sender's own copy is left alone",
    Array.isArray(scaling().effects[0].value.amount.tiers), true);
  suite.is("a flat amount passes through untouched",
    wireEffectGroup(bless(), 20).effects[0].value.amount, 1);
  suite.is("and the flattened number survives the trip, where a table would not",
    readEffectGroup(JSON.parse(JSON.stringify(wireEffectGroup(scaling(), 12)))).effects[0].value.amount, 3);
  suite.is("proving the point: an unflattened table arrives with no amount at all",
    "amount" in readEffectGroup(scaling()).effects[0].value, false);

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

  suite.section("handing over an item");
  const bow = () => ({
    id: 4, name: "Shortbow", category: "Equipped", weight: 2, qty: 1,
    isWeapon: true, isDefaultLoadout: true, attackAbility: "DEX",
    proficiencyRequired: "Simple", magicBonus: 0,
    damage: [{ dice: "1d6", type: "Piercing", ability: "DEX" }],
    weaponType: "ranged", range: "80/320 ft", properties: ["Ammunition", "Two-Handed"],
    ammunition: "Quiver"
  });
  const cloak = () => ({ id: 2, name: "Cloak of Protection", category: "Worn", weight: 1, qty: 1, acBonus: 1 });

  suite.is("a nameless item is refused", readItem({ weight: 1 }), null);
  suite.is("the sender's category does not travel", "category" in wireItem(bow()), false);
  suite.is("nor does the sender's loadout choice", "isDefaultLoadout" in wireItem(bow()), false);
  suite.is("a fractional weight survives", readItem({ name: "Arrow", weight: 0.05 }).weight, 0.05);
  suite.is("an absurd quantity is clamped", readItem({ name: "Arrow", qty: 1e9 }).qty, 9999);
  suite.is("a quantity below one is clamped", readItem({ name: "Arrow", qty: 0 }).qty, 1);

  /* Dice notation is handed to the roll engine, so it is matched, not trimmed. */
  suite.is("sane dice survive", readItem({ name: "X", damage: [{ dice: "1d6", type: "Piercing" }] }).damage[0].dice, "1d6");
  suite.is("a thousand dice from a stranger are refused",
    "damage" in readItem({ name: "X", damage: [{ dice: "9999d99", type: "Piercing" }] }), false);
  suite.is("so is dice notation that is really a sentence",
    "damage" in readItem({ name: "X", damage: [{ dice: HOSTILE, type: "Piercing" }] }), false);
  suite.is("a hundred properties are cut down",
    readItem({ name: "X", properties: new Array(100).fill("Finesse") }).properties.length, 12);

  suite.section("where a given item lands");
  const sheet = () => ({
    inventory: [], resources: [],
    categoryRules: {
      Worn: { countsWeight: true, appliesEffects: true, providesAttacks: false },
      Equipped: { countsWeight: true, appliesEffects: true, providesAttacks: true },
      Carrying: { countsWeight: true, appliesEffects: false, providesAttacks: false }
    }
  });
  suite.is("it goes to a category that neither equips nor arms", landingCategory(sheet()), "Carrying");

  const noCarrying = { inventory: [], categoryRules: {
    Worn: { countsWeight: true, appliesEffects: true, providesAttacks: false } } };
  suite.is("with no such category, one is made rather than picking a wrong one",
    landingCategory(noCarrying), "Carrying");
  suite.is("and it is a real rule from then on", noCarrying.categoryRules.Carrying.appliesEffects, false);

  /* The reason it matters. A cloak arriving Worn would change the receiver's
     armour class while they were looking at something else. */
  const receiver = sheet();
  const givenCloak = receivedItem(readItem(wireItem(cloak())), receiver, "aaa111-1");
  applyReceivedItem(receiver, givenCloak.item);
  suite.is("a magic cloak does not arrive already worn", givenCloak.item.category, "Carrying");
  suite.is("so it applies nothing until they choose to put it on",
    equippedEffectItems(receiver).length, 0);
  suite.is("and a given weapon is not suddenly drawn", weaponList(receiver).length, 0);

  suite.section("an item that refers to things the receiver doesn't have");
  const empty = sheet();
  const givenBow = receivedItem(readItem(wireItem(bow())), empty, "aaa111-2");
  suite.is("the bow's link to a quiver they lack is cut", "ammunition" in givenBow.item, false);
  suite.is("and the receiver is told what was cut", givenBow.missing, ["Quiver"]);

  const hasQuiver = sheet();
  hasQuiver.inventory.push({ id: 1, name: "Quiver", category: "Worn", qty: 1 });
  const linkedBow = receivedItem(readItem(wireItem(bow())), hasQuiver, "aaa111-3");
  suite.is("but a receiver who has one keeps the link", linkedBow.item.ammunition, "Quiver");
  suite.is("with nothing to report", linkedBow.missing, []);

  const refiller = () => ({ name: "Quiver", qty: 1, weight: 1,
    resource: { max: 20, loaded: 20, refillFrom: "Arrows", recharge: { on: "none", amount: "all" } } });
  const noArrows = receivedItem(readItem(refiller()), sheet(), "aaa111-4");
  suite.is("a quiver that refills from arrows they lack is cut loose too",
    noArrows.item.resource.refillFrom, null);
  suite.is("and reported", noArrows.missing, ["Arrows"]);

  suite.section("the same gift arriving twice");
  const twice = sheet();
  applyReceivedItem(twice, receivedItem(readItem(wireItem(cloak())), twice, "aaa111-9").item);
  applyReceivedItem(twice, receivedItem(readItem(wireItem(cloak())), twice, "aaa111-9").item);
  suite.is("a repeated delivery lands once", twice.inventory.length, 1);
  applyReceivedItem(twice, receivedItem(readItem(wireItem(cloak())), twice, "aaa111-10").item);
  suite.is("but a genuinely second gift is a second row", twice.inventory.length, 2);

  suite.section("item messages");
  const itemMsg = parsePartyMessage(partyMessage("item", {
    transferId: "aaa111-5", item: wireItem(bow()), to: "d4e5f6", from: "a1b2c3", fromName: "Sigrid" }));
  suite.is("an item message reads back its item", itemMsg.item.name, "Shortbow");
  suite.is("and who to answer", itemMsg.from, "a1b2c3");
  suite.is("an item message with no transfer id is refused",
    parsePartyMessage(partyMessage("item", { item: wireItem(bow()), to: "d4e5f6" })), null);
  suite.is("an item message with no item is refused",
    parsePartyMessage(partyMessage("item", { transferId: "aaa111-5", to: "d4e5f6" })), null);
  suite.is("an acknowledgement reads back its transfer id",
    parsePartyMessage(partyMessage("item-ack", { transferId: "aaa111-5", to: "a1b2c3" })).transferId, "aaa111-5");

  suite.section("sharing a note");
  const myNote = () => ({
    id: "a1b2c3-7", sectionId: "a1b2c3-1", title: "The Duke's debts", body: "Owes the guild 400gp.",
    createdAt: 1000, updatedAt: 2000,
    sharing: { sharedByMe: true, continuous: true, sharedWith: [{ name: "Tomas", device: "d4e5f6", permission: "edit" }] }
  });

  /* Where a note sits is the reader's business, so none of it travels. */
  suite.is("the section it sat in does not travel", "sectionId" in wireNote(myNote()), false);
  suite.is("nor does who else it was shared with", "sharing" in wireNote(myNote()), false);
  suite.is("the words do travel", wireNote(myNote()).body, "Owes the guild 400gp.");

  suite.is("a note with no id is refused", readNote({ title: "x" }), null);
  suite.is("an absurd body is cut down", readNote({ id: "x-1", body: "x".repeat(50000) }).body.length, 20000);
  suite.is("a nonsense timestamp is replaced rather than kept",
    typeof readNote({ id: "x-1", updatedAt: "yesterday" }).updatedAt, "number");
  suite.is("a hostile title is kept verbatim for the render layer to escape",
    readNote({ id: "x-1", title: HOSTILE }).title, HOSTILE);

  suite.section("what an arriving note becomes");
  const incoming = receivedNote(readNote(wireNote(myNote())), "Sigrid", "edit");
  suite.is("it is marked as not mine", incoming.sharing.sharedByMe, false);
  suite.is("it says who sent it", incoming.sharing.sharedByName, "Sigrid");
  suite.is("an edit permission is honoured", incoming.sharing.permission, "edit");
  suite.is("anything else falls back to view, the cautious direction",
    receivedNote(readNote(wireNote(myNote())), "Sigrid", "admin").sharing.permission, "view");
  suite.is("a missing permission falls back to view",
    receivedNote(readNote(wireNote(myNote())), "Sigrid").sharing.permission, "view");

  suite.section("where an arriving note lands");
  const withInbox = { noteSections: [{ id: 1, name: "Session" }, { id: 2, name: "Handouts", receiveFrom: true }], notes: [] };
  suite.is("a section flagged to receive gets it", inboxSection(withInbox).id, 2);

  const noInbox = { noteSections: [{ id: 1, name: "Session" }], notes: [] };
  const made = inboxSection(noInbox);
  suite.is("with no inbox, one is made rather than dropping the note", made.name, "Shared with me");
  suite.is("and it is flagged so the next one goes to the same place", made.receiveFrom, true);
  suite.is("a second arrival reuses it instead of making another",
    inboxSection(noInbox).id, made.id);

  const reader = { noteSections: [{ id: 1, name: "Handouts", receiveFrom: true }], notes: [] };
  applySharedNote(reader, incoming);
  suite.is("it lands in the inbox", reader.notes.length, 1);
  suite.is("filed under the receiving section", String(reader.notes[0].sectionId), "1");

  /* The reader moved it. A later edit from the sender is not a reason to
     overrule that. */
  reader.noteSections.push({ id: 9, name: "My own filing" });
  reader.notes[0].sectionId = 9;
  const edited = receivedNote(readNote(wireNote(Object.assign(myNote(), { body: "Paid up." }))), "Sigrid", "edit");
  applySharedNote(reader, edited);
  suite.is("an update does not duplicate", reader.notes.length, 1);
  suite.is("the new words arrive", reader.notes[0].body, "Paid up.");
  suite.is("and it stays where the reader filed it", reader.notes[0].sectionId, 9);

  suite.section("taking a shared note back");
  suite.is("the sender can withdraw it", !!removeSharedNote(reader, "a1b2c3-7"), true);
  suite.is("and it is gone", reader.notes.length, 0);
  suite.is("withdrawing it twice is harmless", removeSharedNote(reader, "a1b2c3-7"), null);

  /* The important one. An unshare names an id, and ids are guessable -- so a
     note of the reader's own must not be removable by someone else asking. */
  const ownNote = { noteSections: [], notes: [{ id: "zzz999-1", title: "My private plan", sharing: null }] };
  suite.is("a note of my own cannot be deleted by an unshare message",
    removeSharedNote(ownNote, "zzz999-1"), null);
  suite.is("and it is still there", ownNote.notes.length, 1);
  const alsoMine = { noteSections: [], notes: [{ id: "zzz999-2", title: "Shared out by me",
    sharing: { sharedByMe: true, continuous: true, sharedWith: [] } }] };
  suite.is("nor can a note I am the sharer of", removeSharedNote(alsoMine, "zzz999-2"), null);

  suite.section("note messages");
  const noteMsg = parsePartyMessage(partyMessage("note", {
    note: wireNote(myNote()), to: "d4e5f6", permission: "edit", fromName: "Sigrid" }));
  suite.is("a note message reads back its body", noteMsg.note.body, "Owes the guild 400gp.");
  suite.is("and its permission", noteMsg.permission, "edit");
  suite.is("a note message with no note is refused",
    parsePartyMessage(partyMessage("note", { to: "d4e5f6" })), null);
  suite.is("an unshare message reads back its id",
    parsePartyMessage(partyMessage("note-unshare", { id: "a1b2c3-7", to: "d4e5f6" })).id, "a1b2c3-7");
  suite.is("an unshare with no id is refused",
    parsePartyMessage(partyMessage("note-unshare", { to: "d4e5f6" })), null);

  suite.section("who sharing offers, with addresses");
  suite.is("the list carries devices, not just names",
    partyMemberList([{ device: "a1b2c3", you: true, name: "Me" }, { device: "d4e5f6", name: "Tomas" }], "a1b2c3"),
    [{ name: "Tomas", device: "d4e5f6" }]);

  suite.section("receiving an effect someone pushed");
  /* Concentration belongs to the caster. The cleric concentrates on Bless;
     the fighter standing in it does not, and must not have their own
     concentration broken by being blessed. */
  const received = receivedEffectGroup(bless(), "Sigrid");
  suite.is("a pushed effect arrives unconcentrated", received.concentration, false);
  suite.is("the sender's own group is untouched", bless().concentration, true);
  suite.is("it says who sent it", received.fromName, "Sigrid");
  suite.is("it keeps the sender's id", received.id, "a1b2c3-9");

  const effectSheet = { activeEffects: [{ id: 1, name: "Prone" }] };
  applyEffectGroup(effectSheet, received);
  suite.is("it lands on the sheet alongside what was there", effectSheet.activeEffects.length, 2);
  applyEffectGroup(effectSheet, receivedEffectGroup(bless(), "Sigrid"));
  suite.is("pushing the same effect twice updates instead of stacking", effectSheet.activeEffects.length, 2);
  suite.is("an effect from a different device does not collide",
    applyEffectGroup(effectSheet, receivedEffectGroup(Object.assign(bless(), { id: "d4e5f6-9" }), "Tomas")).length, 3);
};
