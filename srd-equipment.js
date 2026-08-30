/* ============================================================
   SRD EQUIPMENT

   Weapons, armour, tools and adventuring gear. Split out of srd-data.js for
   the same reason as srd-races.js (see its header). Loaded right after
   srd-classes.js, before character-data.js.
   ============================================================ */

/* Sourced from https://www.5esrd.com/equipment/weapons/, /armor/,
   /adventuring-gear/ and /tools/ -- the SRD 5.1 equipment catalogue
   (weapons, armour, gear, tools), which the user's scope explicitly asked
   for while excluding equipment of quality, expenses, mounts/vehicles and
   trade goods. Same item shape KIT_ITEMS already uses (isWeapon/armour
   drive itemType()); `official`/`cost` are new fields layered on rather
   than reworking the existing shape. `cost` is pure display text -- this
   app has no currency/gold model to attach a number to, and inventing one
   wasn't in scope here, so the SRD price rides along as a fact worth
   keeping rather than a mechanic.

   The gear and armour tables are unambiguously official OGC (no Section 15
   notice on either index page). Weapons is not quite as clean: the core
   Simple/Martial tables are official, but five entries are inline-tagged
   "[3pp]" by 5esrd.com itself, sourced to a single splatbook (Player's
   Advantage -- Barbarian) -- included per "do not filter out the 3pp
   content" and marked official:false. The same Weapons page also holds a
   much larger body of exotic weapon-culture content (Monk/Dwarven/Elven/
   Kobold/Orcish weapons, "Beyond Damage Dice," a whole "Weapon Options"
   maneuver subsystem) that's a different kind of thing entirely -- optional
   combat rules, not a basic equipment list -- and is out of scope here the
   same way Feats' 1,385-entry database and Races' Ancestry-and-Culture
   were: a bounded catalogue got curated in, an open-ended rules expansion
   got left out.

   Conditional narrow rules with no clean effect mapping (a heavy-armour
   Strength requirement's speed penalty, stealth disadvantage, a weapon's
   "Special" property) ride along as description text, same discipline as
   every step before this one -- nothing here invents a mechanic the app
   doesn't already have a category for. */
const SRD_WEAPONS = [
  // Simple Melee
  { name: "Club", official: true, cost: "1 sp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Light"], damage: [{ dice: "1d4", type: "Bludgeoning", ability: "STR" }] },
  { name: "Dagger", official: true, cost: "2 gp", category: "Equipped", weight: 1, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Finesse", "Light", "Thrown (range 20/60)"], damage: [{ dice: "1d4", type: "Piercing", ability: "DEX" }] },
  { name: "Greatclub", official: true, cost: "2 sp", category: "Equipped", weight: 10, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Two-Handed"], damage: [{ dice: "1d8", type: "Bludgeoning", ability: "STR" }] },
  { name: "Handaxe", official: true, cost: "5 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Light", "Thrown (range 20/60)"], damage: [{ dice: "1d6", type: "Slashing", ability: "STR" }] },
  { name: "Javelin", official: true, cost: "5 sp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Thrown (range 30/120)"], damage: [{ dice: "1d6", type: "Piercing", ability: "STR" }] },
  { name: "Light Hammer", official: true, cost: "2 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Light", "Thrown (range 20/60)"], damage: [{ dice: "1d4", type: "Bludgeoning", ability: "STR" }] },
  { name: "Mace", official: true, cost: "5 gp", category: "Equipped", weight: 4, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: [], damage: [{ dice: "1d6", type: "Bludgeoning", ability: "STR" }] },
  { name: "Quarterstaff", official: true, cost: "2 sp", category: "Equipped", weight: 4, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Versatile (1d8)"], damage: [{ dice: "1d6", type: "Bludgeoning", ability: "STR" }] },
  { name: "Sickle", official: true, cost: "1 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Light"], damage: [{ dice: "1d4", type: "Slashing", ability: "STR" }] },
  { name: "Spear", official: true, cost: "1 gp", category: "Equipped", weight: 3, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Thrown (range 20/60)", "Versatile (1d8)"], damage: [{ dice: "1d6", type: "Piercing", ability: "STR" }] },
  // Simple Ranged
  { name: "Crossbow, Light", official: true, cost: "25 gp", category: "Equipped", weight: 5, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "ranged", range: "80/320 ft", properties: ["Ammunition", "Loading", "Two-Handed"], ammunition: "Crossbow Bolt", damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }] },
  { name: "Dart", official: true, cost: "5 cp", category: "Equipped", weight: 0.25, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "ranged", range: "20/60 ft", properties: ["Finesse", "Thrown"], damage: [{ dice: "1d4", type: "Piercing", ability: "DEX" }] },
  { name: "Shortbow", official: true, cost: "25 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "ranged", range: "80/320 ft", properties: ["Ammunition", "Two-Handed"], ammunition: "Arrow", damage: [{ dice: "1d6", type: "Piercing", ability: "DEX" }] },
  { name: "Sling", official: true, cost: "1 sp", category: "Equipped", weight: 0, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "ranged", range: "30/120 ft", properties: ["Ammunition"], ammunition: "Sling Bullets", damage: [{ dice: "1d4", type: "Bludgeoning", ability: "DEX" }] },
  // Martial Melee
  { name: "Battleaxe", official: true, cost: "10 gp", category: "Equipped", weight: 4, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Versatile (1d10)"], damage: [{ dice: "1d8", type: "Slashing", ability: "STR" }] },
  { name: "Flail", official: true, cost: "10 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: [], damage: [{ dice: "1d8", type: "Bludgeoning", ability: "STR" }] },
  { name: "Glaive", official: true, cost: "20 gp", category: "Equipped", weight: 6, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "10 ft", properties: ["Heavy", "Reach", "Two-Handed"], damage: [{ dice: "1d10", type: "Slashing", ability: "STR" }] },
  { name: "Greataxe", official: true, cost: "30 gp", category: "Equipped", weight: 7, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Heavy", "Two-Handed"], damage: [{ dice: "1d12", type: "Slashing", ability: "STR" }] },
  { name: "Greatsword", official: true, cost: "50 gp", category: "Equipped", weight: 6, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Heavy", "Two-Handed"], damage: [{ dice: "2d6", type: "Slashing", ability: "STR" }] },
  { name: "Halberd", official: true, cost: "20 gp", category: "Equipped", weight: 6, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "10 ft", properties: ["Heavy", "Reach", "Two-Handed"], damage: [{ dice: "1d10", type: "Slashing", ability: "STR" }] },
  { name: "Lance", official: true, cost: "10 gp", category: "Equipped", weight: 6, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "10 ft", properties: ["Reach", "Special"], description: "Disadvantage against a target within 5 feet. Requires two hands to wield unless you're mounted.", damage: [{ dice: "1d12", type: "Piercing", ability: "STR" }] },
  { name: "Longsword", official: true, cost: "15 gp", category: "Equipped", weight: 3, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Versatile (1d10)"], damage: [{ dice: "1d8", type: "Slashing", ability: "STR" }] },
  { name: "Maul", official: true, cost: "10 gp", category: "Equipped", weight: 10, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Heavy", "Two-Handed"], damage: [{ dice: "2d6", type: "Bludgeoning", ability: "STR" }] },
  { name: "Morningstar", official: true, cost: "15 gp", category: "Equipped", weight: 4, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: [], damage: [{ dice: "1d8", type: "Piercing", ability: "STR" }] },
  { name: "Pike", official: true, cost: "5 gp", category: "Equipped", weight: 18, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "10 ft", properties: ["Heavy", "Reach", "Two-Handed"], damage: [{ dice: "1d10", type: "Piercing", ability: "STR" }] },
  { name: "Rapier", official: true, cost: "25 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Finesse"], damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }] },
  { name: "Scimitar", official: true, cost: "25 gp", category: "Equipped", weight: 3, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Finesse", "Light"], damage: [{ dice: "1d6", type: "Slashing", ability: "DEX" }] },
  { name: "Shortsword", official: true, cost: "10 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Finesse", "Light"], damage: [{ dice: "1d6", type: "Piercing", ability: "DEX" }] },
  { name: "Trident", official: true, cost: "5 gp", category: "Equipped", weight: 4, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Thrown (range 20/60)", "Versatile (1d8)"], damage: [{ dice: "1d6", type: "Piercing", ability: "STR" }] },
  { name: "War Pick", official: true, cost: "5 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: [], damage: [{ dice: "1d8", type: "Piercing", ability: "STR" }] },
  { name: "Warhammer", official: true, cost: "15 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Versatile (1d10)"], damage: [{ dice: "1d8", type: "Bludgeoning", ability: "STR" }] },
  { name: "Whip", official: true, cost: "2 gp", category: "Equipped", weight: 3, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "10 ft", properties: ["Finesse", "Reach"], damage: [{ dice: "1d4", type: "Slashing", ability: "DEX" }] },
  { name: "Dwarven Urgrosh", official: false, cost: "22 gp", category: "Equipped", weight: 4, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Special", "Two-Handed"], description: "One end is a spear, the other an axe -- 1d8 piercing or 1d10 slashing, your choice each attack. With Two-Weapon Fighting or a matching feat, it splits into a one-handed spear and battleaxe.", damage: [{ dice: "1d8", type: "Piercing", ability: "STR" }] },
  { name: "Elven Crescent Blade", official: false, cost: "80 gp", category: "Equipped", weight: 6, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Heavy", "Special", "Two-Handed"], damage: [{ dice: "2d6", type: "Slashing", ability: "STR" }] },
  { name: "Spiked Chain", official: false, cost: "50 gp", category: "Equipped", weight: 10, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "10 ft", properties: ["Finesse", "Heavy", "Reach", "Special", "Two-Handed"], damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }] },
  { name: "War Scythe", official: false, cost: "25 gp", category: "Equipped", weight: 4, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft", properties: ["Special", "Two-Handed"], description: "Can't be wielded one-handed.", damage: [{ dice: "1d10", type: "Slashing", ability: "STR" }] },
  // Martial Ranged
  { name: "Crossbow, Hand", official: true, cost: "75 gp", category: "Equipped", weight: 3, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "30/120 ft", properties: ["Ammunition", "Light", "Loading"], ammunition: "Crossbow Bolt", damage: [{ dice: "1d6", type: "Piercing", ability: "DEX" }] },
  { name: "Crossbow, Heavy", official: true, cost: "50 gp", category: "Equipped", weight: 18, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "100/400 ft", properties: ["Ammunition", "Heavy", "Loading", "Two-Handed"], ammunition: "Crossbow Bolt", damage: [{ dice: "1d10", type: "Piercing", ability: "DEX" }] },
  { name: "Longbow", official: true, cost: "50 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "150/600 ft", properties: ["Ammunition", "Heavy", "Two-Handed"], ammunition: "Arrow", damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }] },
  { name: "Net", official: true, cost: "1 gp", category: "Equipped", weight: 3, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "5/15 ft", properties: ["Special", "Thrown"], description: "No damage. A Large or smaller target that's hit is restrained until it or another creature spends an action on a DC 10 Strength check to free it, or someone deals 5 slashing damage to the net (AC 10).", damage: [] },
  { name: "Great Bow", official: false, cost: "100 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "150/600 ft", properties: ["Ammunition", "Heavy", "Special", "Two-Handed"], ammunition: "Arrow", description: "Bonus action to steady yourself; while steadied (and not having moved), damage rises to 2d6 piercing.", damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }] }
];

const SRD_ARMOUR = [
  { name: "Padded", official: true, cost: "5 gp", category: "Worn", weight: 8, description: "Disadvantage on Stealth checks.", armour: { base: 11, kind: "light", dexCap: null } },
  { name: "Leather", official: true, cost: "10 gp", category: "Worn", weight: 10, armour: { base: 11, kind: "light", dexCap: null } },
  { name: "Studded Leather", official: true, cost: "45 gp", category: "Worn", weight: 13, armour: { base: 12, kind: "light", dexCap: null } },
  { name: "Hide", official: true, cost: "10 gp", category: "Worn", weight: 12, armour: { base: 12, kind: "medium", dexCap: 2 } },
  { name: "Chain Shirt", official: true, description: "Interlocking metal rings worn under clothing.", cost: "50 gp", category: "Worn", weight: 20, armour: { base: 13, kind: "medium", dexCap: 2 } },
  { name: "Scale Mail", official: true, cost: "50 gp", category: "Worn", weight: 45, description: "Disadvantage on Stealth checks.", armour: { base: 14, kind: "medium", dexCap: 2 } },
  { name: "Breastplate", official: true, cost: "400 gp", category: "Worn", weight: 20, armour: { base: 14, kind: "medium", dexCap: 2 } },
  { name: "Half Plate", official: true, cost: "750 gp", category: "Worn", weight: 40, description: "Disadvantage on Stealth checks.", armour: { base: 15, kind: "medium", dexCap: 2 } },
  { name: "Ring Mail", official: true, cost: "30 gp", category: "Worn", weight: 40, description: "Disadvantage on Stealth checks.", armour: { base: 14, kind: "heavy", dexCap: 0 } },
  { name: "Chain Mail", official: true, cost: "75 gp", category: "Worn", weight: 55, description: "Requires Strength 13, or speed drops by 10 feet. Disadvantage on Stealth checks.", armour: { base: 16, kind: "heavy", dexCap: 0 } },
  { name: "Splint", official: true, cost: "200 gp", category: "Worn", weight: 60, description: "Requires Strength 15, or speed drops by 10 feet. Disadvantage on Stealth checks.", armour: { base: 17, kind: "heavy", dexCap: 0 } },
  { name: "Plate", official: true, cost: "1,500 gp", category: "Worn", weight: 65, description: "Requires Strength 15, or speed drops by 10 feet. Disadvantage on Stealth checks.", armour: { base: 18, kind: "heavy", dexCap: 0 } },
  { name: "Shield", official: true, cost: "10 gp", category: "Worn", weight: 6, armour: { base: 2, kind: "shield", dexCap: null } }
];

const SRD_TOOLS = [
  { name: "Alchemist's Supplies", official: true, cost: "50 gp", category: "Carrying", weight: 8 },
  { name: "Brewer's Supplies", official: true, cost: "20 gp", category: "Carrying", weight: 9 },
  { name: "Calligrapher's Supplies", official: true, cost: "10 gp", category: "Carrying", weight: 5 },
  { name: "Carpenter's Tools", official: true, cost: "8 gp", category: "Carrying", weight: 6 },
  { name: "Cartographer's Tools", official: true, cost: "15 gp", category: "Carrying", weight: 6 },
  { name: "Cobbler's Tools", official: true, cost: "5 gp", category: "Carrying", weight: 5 },
  { name: "Cook's Utensils", official: true, cost: "1 gp", category: "Carrying", weight: 8 },
  { name: "Glassblower's Tools", official: true, cost: "30 gp", category: "Carrying", weight: 5 },
  { name: "Jeweler's Tools", official: true, cost: "25 gp", category: "Carrying", weight: 2 },
  { name: "Leatherworker's Tools", official: true, cost: "5 gp", category: "Carrying", weight: 5 },
  { name: "Mason's Tools", official: true, cost: "10 gp", category: "Carrying", weight: 8 },
  { name: "Painter's Supplies", official: true, cost: "10 gp", category: "Carrying", weight: 5 },
  { name: "Potter's Tools", official: true, cost: "10 gp", category: "Carrying", weight: 3 },
  { name: "Smith's Tools", official: true, cost: "20 gp", category: "Carrying", weight: 8 },
  { name: "Tinker's Tools", official: true, cost: "50 gp", category: "Carrying", weight: 10 },
  { name: "Weaver's Tools", official: true, cost: "1 gp", category: "Carrying", weight: 5 },
  { name: "Woodcarver's Tools", official: true, cost: "1 gp", category: "Carrying", weight: 5 },
  { name: "Dice Set", official: true, cost: "1 sp", category: "Carrying", weight: 0 },
  { name: "Playing Card Set", official: true, cost: "5 sp", category: "Carrying", weight: 0 },
  { name: "Bagpipes", official: true, cost: "30 gp", category: "Carrying", weight: 6 },
  { name: "Drum", official: true, cost: "6 gp", category: "Carrying", weight: 3 },
  { name: "Dulcimer", official: true, cost: "25 gp", category: "Carrying", weight: 10 },
  { name: "Flute", official: true, cost: "2 gp", category: "Carrying", weight: 1 },
  { name: "Lute", official: true, cost: "35 gp", category: "Carrying", weight: 2 },
  { name: "Lyre", official: true, cost: "30 gp", category: "Carrying", weight: 2 },
  { name: "Horn", official: true, cost: "3 gp", category: "Carrying", weight: 2 },
  { name: "Pan Flute", official: true, cost: "12 gp", category: "Carrying", weight: 2 },
  { name: "Shawm", official: true, cost: "2 gp", category: "Carrying", weight: 1 },
  { name: "Viol", official: true, cost: "30 gp", category: "Carrying", weight: 1 },
  { name: "Navigator's Tools", official: true, cost: "25 gp", category: "Carrying", weight: 2, description: "Chart a ship's course and follow navigation charts; add your proficiency bonus to checks made to avoid getting lost at sea." },
  { name: "Thieves' Tools", official: true, cost: "25 gp", category: "Carrying", weight: 1, description: "A file, lock picks, a small mirror on a handle, narrow-bladed scissors and pliers. Proficiency lets you add your bonus to checks to disarm traps or open locks." },
  { name: "Disguise Kit", official: true, cost: "25 gp", category: "Carrying", weight: 3, description: "Cosmetics, hair dye and small props for changing your physical appearance." },
  { name: "Forgery Kit", official: true, cost: "15 gp", category: "Carrying", weight: 5, description: "Papers, pens, inks, seals and gold/silver leaf for forging physical documents." },
  { name: "Herbalism Kit", official: true, cost: "5 gp", category: "Carrying", weight: 3, description: "Clippers, mortar and pestle, pouches and vials. Required to craft antitoxin and potions of healing." },
  { name: "Poisoner's Kit", official: true, cost: "50 gp", category: "Carrying", weight: 2, description: "Vials, chemicals and equipment for crafting or using poisons." }
];

/* The Adventuring Gear table plus the Equipment Packs it references, each
   pack's contents folded flat into `contains` rather than modeled as
   nested items -- this app doesn't have a container-of-containers concept
   beyond the Quiver/Arrows refill pattern, and packs aren't refillable, so
   there's nothing to gain by going further. */
const SRD_GEAR = [
  { name: "Abacus", official: true, cost: "2 gp", category: "Carrying", weight: 2 },
  { name: "Acid (vial)", official: true, cost: "25 gp", category: "Carrying", weight: 1, description: "Action: splash on a creature within 5 ft, or throw up to 20 ft as an improvised ranged weapon. On a hit, 2d6 acid damage." },
  { name: "Alchemist's Fire (flask)", official: true, cost: "50 gp", category: "Carrying", weight: 1, description: "Action: throw up to 20 ft as an improvised ranged weapon. On a hit, 1d4 fire damage at the start of each of the target's turns until it spends an action on a DC 10 Dexterity check to put out the flames." },
  /* Ammunition is sold by the bundle and owned one at a time. The catalogue
     used to carry the bundle in the name -- "Arrows (20)" -- which made the
     row unusable for anything except buying exactly twenty: you could not add
     three, and a stack of sixty still called itself a stack of twenty. The
     count is a quantity now, the weight is per arrow, and the price says what
     a bundle costs without pretending the bundle is the item. */
  { name: "Arrow", official: true, cost: "1 gp per 20", category: "Carrying", weight: 0.05, qty: 1, description: "Ammunition for a bow.", resource: { max: 0, recharge: { on: "none", amount: "all" } } },
  { name: "Blowgun Needle", official: true, cost: "1 gp per 50", category: "Carrying", weight: 0.02, qty: 1, resource: { max: 0, recharge: { on: "none", amount: "all" } } },
  { name: "Crossbow Bolt", official: true, cost: "1 gp per 20", category: "Carrying", weight: 0.075, qty: 1, description: "Ammunition for a crossbow.", resource: { max: 0, recharge: { on: "none", amount: "all" } } },
  { name: "Sling Bullet", official: true, cost: "4 cp per 20", category: "Carrying", weight: 0.075, qty: 1, resource: { max: 0, recharge: { on: "none", amount: "all" } } },
  { name: "Amulet", official: true, cost: "5 gp", category: "Carrying", weight: 1, description: "Can serve as a holy symbol." },
  { name: "Antitoxin (vial)", official: true, cost: "50 gp", category: "Carrying", weight: 0, description: "A creature that drinks this gains advantage on saving throws against poison for 1 hour. No benefit to undead or constructs." },
  { name: "Arcane Focus, Crystal", official: true, cost: "10 gp", category: "Carrying", weight: 1, description: "A spellcasting focus for sorcerer, warlock or wizard spells." },
  { name: "Arcane Focus, Orb", official: true, cost: "20 gp", category: "Carrying", weight: 3, description: "A spellcasting focus for sorcerer, warlock or wizard spells." },
  { name: "Arcane Focus, Rod", official: true, cost: "10 gp", category: "Carrying", weight: 2, description: "A spellcasting focus for sorcerer, warlock or wizard spells." },
  { name: "Arcane Focus, Staff", official: true, cost: "5 gp", category: "Carrying", weight: 4, description: "A spellcasting focus for sorcerer, warlock or wizard spells. Can double as a quarterstaff." },
  { name: "Arcane Focus, Wand", official: true, cost: "10 gp", category: "Carrying", weight: 1, description: "A spellcasting focus for sorcerer, warlock or wizard spells." },
  { name: "Backpack", official: true, cost: "2 gp", category: "Carrying", weight: 5, description: "Holds 1 cubic foot or 30 lb of gear." },
  { name: "Ball Bearings (bag of 1,000)", official: true, cost: "1 gp", category: "Carrying", weight: 2, description: "Action: spill across a 10-foot-by-10-foot area. A creature moving through it at normal speed must succeed on a DC 10 Dexterity save or fall prone." },
  { name: "Barrel", official: true, cost: "2 gp", category: "Carrying", weight: 70, description: "Holds 40 gallons liquid or 4 cubic feet solid." },
  { name: "Basket", official: true, cost: "4 sp", category: "Carrying", weight: 2, description: "Holds 2 cubic feet or 40 lb of gear." },
  { name: "Bedroll", official: true, cost: "1 gp", category: "Carrying", weight: 7 },
  { name: "Bell", official: true, cost: "1 gp", category: "Carrying", weight: 0 },
  { name: "Blanket", official: true, cost: "5 sp", category: "Carrying", weight: 3 },
  { name: "Block and Tackle", official: true, cost: "1 gp", category: "Carrying", weight: 5, description: "Lets you hoist up to four times the weight you could normally lift." },
  { name: "Book", official: true, cost: "25 gp", category: "Carrying", weight: 5 },
  { name: "Bottle, Glass", official: true, cost: "2 gp", category: "Carrying", weight: 2, description: "Holds 1.5 pints liquid." },
  { name: "Bucket", official: true, cost: "5 cp", category: "Carrying", weight: 2, description: "Holds 3 gallons liquid or half a cubic foot solid." },
  { name: "Caltrops (bag of 20)", official: true, cost: "1 gp", category: "Carrying", weight: 2, description: "Action: spread across a 5-by-5 area. A creature entering it must succeed on a DC 15 Dexterity save or stop moving and take 1 piercing damage, reducing its speed by 10 feet until it regains at least 1 hit point." },
  { name: "Candle", official: true, cost: "1 cp", category: "Carrying", weight: 0, description: "Burns 1 hour: bright light in a 5-ft radius, dim light for 5 more feet." },
  { name: "Case, Crossbow Bolt", official: true, cost: "1 gp", category: "Carrying", weight: 1, description: "Holds up to 20 crossbow bolts." },
  { name: "Case, Map or Scroll", official: true, cost: "1 gp", category: "Carrying", weight: 1, description: "Holds up to 10 rolled sheets of paper or 5 of parchment." },
  { name: "Chain (10 feet)", official: true, cost: "5 gp", category: "Carrying", weight: 10, description: "10 hit points; bursts with a DC 20 Strength check." },
  { name: "Chalk (1 piece)", official: true, cost: "1 cp", category: "Carrying", weight: 0 },
  { name: "Chest", official: true, cost: "5 gp", category: "Carrying", weight: 25, description: "Holds 12 cubic feet or 300 lb of gear." },
  { name: "Clothes, Common", official: true, cost: "5 sp", category: "Carrying", weight: 3 },
  { name: "Clothes, Costume", official: true, cost: "5 gp", category: "Carrying", weight: 4 },
  { name: "Clothes, Fine", official: true, cost: "15 gp", category: "Carrying", weight: 6 },
  { name: "Clothes, Traveler's", official: true, cost: "2 gp", category: "Carrying", weight: 4 },
  { name: "Component Pouch", official: true, cost: "25 gp", category: "Carrying", weight: 2, description: "A watertight belt pouch holding material components for spells (except ones with a stated cost)." },
  { name: "Crowbar", official: true, cost: "2 gp", category: "Carrying", weight: 5, description: "Advantage on Strength checks where the crowbar's leverage applies." },
  { name: "Druidic Focus, Sprig of Mistletoe", official: true, cost: "1 gp", category: "Carrying", weight: 0, description: "A spellcasting focus for druid spells." },
  { name: "Druidic Focus, Totem", official: true, cost: "1 gp", category: "Carrying", weight: 0, description: "A spellcasting focus for druid spells." },
  { name: "Druidic Focus, Wooden Staff", official: true, cost: "5 gp", category: "Carrying", weight: 4, description: "A spellcasting focus for druid spells. Can double as a quarterstaff." },
  { name: "Druidic Focus, Yew Wand", official: true, cost: "10 gp", category: "Carrying", weight: 1, description: "A spellcasting focus for druid spells." },
  { name: "Emblem", official: true, cost: "5 gp", category: "Carrying", weight: 0, description: "Can serve as a holy symbol." },
  { name: "Fishing Tackle", official: true, cost: "1 gp", category: "Carrying", weight: 4, description: "A rod, silken line, bobbers, hooks, sinkers, lures and netting." },
  { name: "Flask or Tankard", official: true, cost: "2 cp", category: "Carrying", weight: 1, description: "Holds 1 pint liquid." },
  { name: "Grappling Hook", official: true, cost: "2 gp", category: "Carrying", weight: 4 },
  { name: "Hammer", official: true, cost: "1 gp", category: "Carrying", weight: 3 },
  { name: "Hammer, Sledge", official: true, cost: "2 gp", category: "Carrying", weight: 10 },
  { name: "Holy Water (flask)", official: true, cost: "25 gp", category: "Carrying", weight: 1, description: "Action: splash on a creature within 5 ft, or throw up to 20 ft as an improvised ranged weapon. A fiend or undead hit takes 2d6 radiant damage." },
  { name: "Hourglass", official: true, cost: "25 gp", category: "Carrying", weight: 1 },
  { name: "Hunting Trap", official: true, cost: "5 gp", category: "Carrying", weight: 25, description: "Action to set: a saw-toothed ring on a chain, snapping shut on a creature that steps on its pressure plate (DC 13 Dexterity save or take 1d4 piercing and stop moving). Escape with a DC 13 Strength check." },
  { name: "Ink (1 ounce bottle)", official: true, cost: "10 gp", category: "Carrying", weight: 0 },
  { name: "Ink Pen", official: true, cost: "2 cp", category: "Carrying", weight: 0 },
  { name: "Jug or Pitcher", official: true, cost: "2 cp", category: "Carrying", weight: 4, description: "Holds 1 gallon liquid." },
  { name: "Kit, Climber's", official: true, cost: "25 gp", category: "Carrying", weight: 12, description: "Special pitons, boot tips, gloves and a harness. Action to anchor yourself: you can't fall more than 25 ft from, or climb more than 25 ft away from, the anchor point without undoing it." },
  { name: "Kit, Disguise", official: true, cost: "25 gp", category: "Carrying", weight: 3 },
  { name: "Kit, Forgery", official: true, cost: "15 gp", category: "Carrying", weight: 5 },
  { name: "Kit, Herbalism", official: true, cost: "5 gp", category: "Carrying", weight: 3 },
  { name: "Kit, Healer's", official: true, cost: "5 gp", category: "Carrying", weight: 3, qty: 10, description: "10 uses. Action, spend one use: stabilize a creature at 0 hit points with no ability check needed.", resource: { max: 0, recharge: { on: "none", amount: "all" } } },
  { name: "Kit, Mess", official: true, cost: "2 sp", category: "Carrying", weight: 1 },
  { name: "Kit, Poisoner's", official: true, cost: "50 gp", category: "Carrying", weight: 2 },
  { name: "Ladder (10-foot)", official: true, cost: "1 sp", category: "Carrying", weight: 25 },
  { name: "Lamp", official: true, cost: "5 sp", category: "Carrying", weight: 1, description: "Bright light in a 15-ft radius, dim for 30 more feet. Burns 6 hours on a flask of oil." },
  { name: "Lantern, Bullseye", official: true, cost: "10 gp", category: "Carrying", weight: 2, description: "Bright light in a 60-ft cone, dim for 60 more feet. Burns 6 hours on a flask of oil." },
  { name: "Lantern, Hooded", official: true, cost: "5 gp", category: "Carrying", weight: 2, description: "Bright light in a 30-ft radius, dim for 30 more feet. Burns 6 hours on a flask of oil. Action to lower the hood: dim light in a 5-ft radius instead." },
  { name: "Lock", official: true, cost: "10 gp", category: "Carrying", weight: 1, description: "Comes with a key. Without it, a creature proficient with thieves' tools can pick it with a DC 15 Dexterity check." },
  { name: "Magnifying Glass", official: true, cost: "100 gp", category: "Carrying", weight: 0, description: "Advantage on ability checks to appraise or inspect a small or detailed item. Can substitute for flint and steel to start a fire, given bright sunlight and about 5 minutes." },
  { name: "Manacles", official: true, cost: "2 gp", category: "Carrying", weight: 6, description: "Binds a Small or Medium creature. DC 20 Dexterity check to escape, DC 20 Strength check to break. Comes with one key; without it, DC 15 Dexterity check with thieves' tools. 15 hit points." },
  { name: "Mirror, Steel", official: true, cost: "5 gp", category: "Carrying", weight: 0.5 },
  { name: "Oil (flask)", official: true, cost: "1 sp", category: "Carrying", weight: 1, description: "Action: splash on a creature within 5 ft, or throw up to 20 ft as an improvised ranged weapon, coating the target in oil -- the next fire damage it takes before the oil dries (1 minute) is +5. Can instead be poured and lit to cover a 5-ft square, burning 2 rounds for 5 fire damage to anyone entering or ending their turn there." },
  { name: "Paper (one sheet)", official: true, cost: "2 sp", category: "Carrying", weight: 0 },
  { name: "Parchment (one sheet)", official: true, cost: "1 sp", category: "Carrying", weight: 0 },
  { name: "Perfume (vial)", official: true, cost: "5 gp", category: "Carrying", weight: 0 },
  { name: "Pick, Miner's", official: true, cost: "2 gp", category: "Carrying", weight: 10 },
  { name: "Piton", official: true, cost: "5 cp", category: "Carrying", weight: 0.25 },
  { name: "Poison, Basic (vial)", official: true, cost: "100 gp", category: "Carrying", weight: 0, description: "Coats one slashing/piercing weapon or up to 3 pieces of ammunition (action to apply). A creature hit must succeed on a DC 10 Constitution save or take 1d4 poison damage. Retains potency 1 minute before drying." },
  { name: "Pole (10-foot)", official: true, cost: "5 cp", category: "Carrying", weight: 7 },
  { name: "Pot, Iron", official: true, cost: "2 gp", category: "Carrying", weight: 10, description: "Holds 1 gallon liquid." },
  { name: "Potion of Healing", official: true, cost: "50 gp", category: "Carrying", weight: 0.5, description: "Drinking or administering (an action) restores 2d4 + 2 hit points." },
  { name: "Pouch", official: true, cost: "5 sp", category: "Carrying", weight: 1, description: "Holds up to 20 sling bullets or 50 blowgun needles, among other small things." },
  { name: "Quiver", official: true, cost: "1 gp", category: "Carrying", weight: 1, description: "Holds up to 20 arrows." },
  { name: "Ram, Portable", official: true, cost: "4 gp", category: "Carrying", weight: 35, description: "+4 bonus on the Strength check to break down a door. A second character helping gives advantage instead." },
  { name: "Reliquary", official: true, cost: "5 gp", category: "Carrying", weight: 2, description: "Can serve as a holy symbol." },
  { name: "Robes", official: true, cost: "1 gp", category: "Carrying", weight: 4 },
  { name: "Rope, Hempen (50 feet)", official: true, cost: "1 gp", category: "Carrying", weight: 10, description: "2 hit points; bursts with a DC 17 Strength check." },
  { name: "Rope, Silk (50 feet)", official: true, cost: "10 gp", category: "Carrying", weight: 5, description: "2 hit points; bursts with a DC 17 Strength check." },
  { name: "Rations (1 day)", official: true, cost: "5 sp", category: "Carrying", weight: 2, qty: 1 },
  { name: "String (10 feet)", official: true, cost: "1 cp", category: "Carrying", weight: 0, qty: 1 },
  { name: "Sack", official: true, cost: "1 cp", category: "Carrying", weight: 0.5, description: "Holds 1 cubic foot or 30 lb of gear." },
  { name: "Scale, Merchant's", official: true, cost: "5 gp", category: "Carrying", weight: 3, description: "A small balance, pans and weights up to 2 lb, for measuring the exact weight of small objects." },
  { name: "Sealing Wax", official: true, cost: "5 sp", category: "Carrying", weight: 0 },
  { name: "Shovel", official: true, cost: "2 gp", category: "Carrying", weight: 5 },
  { name: "Signal Whistle", official: true, cost: "5 cp", category: "Carrying", weight: 0 },
  { name: "Signet Ring", official: true, cost: "5 gp", category: "Carrying", weight: 0, description: "Can serve as a holy symbol." },
  { name: "Soap", official: true, cost: "2 cp", category: "Carrying", weight: 0 },
  { name: "Spellbook", official: true, cost: "50 gp", category: "Carrying", weight: 3, description: "A leather-bound tome with 100 blank vellum pages for recording spells." },
  { name: "Iron Spike", official: true, cost: "1 gp per 10", category: "Carrying", weight: 0.5, qty: 1 },
  { name: "Spyglass", official: true, cost: "1,000 gp", category: "Carrying", weight: 1, description: "Magnifies viewed objects to twice their size." },
  { name: "Tent, Two-Person", official: true, cost: "2 gp", category: "Carrying", weight: 20 },
  { name: "Tinderbox", official: true, cost: "5 sp", category: "Carrying", weight: 1, description: "Flint, fire steel and tinder. Action to light a torch or similar; 1 minute for anything else." },
  { name: "Torch", official: true, cost: "1 cp", category: "Carrying", weight: 1, description: "Burns 1 hour: bright light in a 20-ft radius, dim light for 20 more feet. A melee hit with a burning torch deals 1 fire damage." },
  { name: "Vial", official: true, cost: "1 gp", category: "Carrying", weight: 0, description: "Holds 4 ounces liquid." },
  { name: "Waterskin", official: true, cost: "2 sp", category: "Carrying", weight: 5, description: "Holds 4 pints liquid." },
  { name: "Whetstone", official: true, cost: "1 cp", category: "Carrying", weight: 1 },
  { name: "Burglar's Pack", official: true, isContainer: true, contents: [
      { name: "Backpack", qty: 1 },
      { name: "Ball Bearings (bag of 1,000)", qty: 1 },
      { name: "String (10 feet)", qty: 1 },
      { name: "Bell", qty: 1 },
      { name: "Candle", qty: 5 },
      { name: "Crowbar", qty: 1 },
      { name: "Hammer", qty: 1 },
      { name: "Piton", qty: 10 },
      { name: "Lantern, Hooded", qty: 1 },
      { name: "Oil (flask)", qty: 2 },
      { name: "Rations (1 day)", qty: 5 },
      { name: "Tinderbox", qty: 1 },
      { name: "Waterskin", qty: 1 },
      { name: "Rope, Hempen (50 feet)", qty: 1 }
    ], cost: "16 gp", category: "Carrying", weight: 0, description: "Backpack, 1,000 ball bearings, 10 ft of string, a bell, 5 candles, a crowbar, a hammer, 10 pitons, a hooded lantern, 2 flasks of oil, 5 days of rations, a tinderbox, a waterskin, and 50 feet of hempen rope strapped to the side." },
  { name: "Diplomat's Pack", official: true, isContainer: true, contents: [
      { name: "Chest", qty: 1 },
      { name: "Case, Map or Scroll", qty: 2 },
      { name: "Clothes, Fine", qty: 1 },
      { name: "Ink (1 ounce bottle)", qty: 1 },
      { name: "Ink Pen", qty: 1 },
      { name: "Lamp", qty: 1 },
      { name: "Oil (flask)", qty: 2 },
      { name: "Paper (one sheet)", qty: 5 },
      { name: "Perfume (vial)", qty: 1 },
      { name: "Sealing Wax", qty: 1 },
      { name: "Soap", qty: 1 }
    ], cost: "39 gp", category: "Carrying", weight: 0, description: "Chest, 2 cases for maps and scrolls, fine clothes, a bottle of ink, an ink pen, a lamp, 2 flasks of oil, 5 sheets of paper, a vial of perfume, sealing wax and soap." },
  { name: "Dungeoneer's Pack", official: true, isContainer: true, contents: [
      { name: "Backpack", qty: 1 },
      { name: "Crowbar", qty: 1 },
      { name: "Hammer", qty: 1 },
      { name: "Piton", qty: 10 },
      { name: "Torch", qty: 10 },
      { name: "Tinderbox", qty: 1 },
      { name: "Rations (1 day)", qty: 10 },
      { name: "Waterskin", qty: 1 },
      { name: "Rope, Hempen (50 feet)", qty: 1 }
    ], cost: "12 gp", category: "Carrying", weight: 0, description: "Backpack, a crowbar, a hammer, 10 pitons, 10 torches, a tinderbox, 10 days of rations, a waterskin, and 50 feet of hempen rope strapped to the side." },
  { name: "Entertainer's Pack", official: true, isContainer: true, contents: [
      { name: "Backpack", qty: 1 },
      { name: "Bedroll", qty: 1 },
      { name: "Clothes, Costume", qty: 2 },
      { name: "Candle", qty: 5 },
      { name: "Rations (1 day)", qty: 5 },
      { name: "Waterskin", qty: 1 },
      { name: "Kit, Disguise", qty: 1 }
    ], cost: "40 gp", category: "Carrying", weight: 0, description: "Backpack, a bedroll, 2 costumes, 5 candles, 5 days of rations, a waterskin, and a disguise kit." },
  { name: "Explorer's Pack", official: true, isContainer: true, contents: [
      { name: "Backpack", qty: 1 },
      { name: "Bedroll", qty: 1 },
      { name: "Kit, Mess", qty: 1 },
      { name: "Tinderbox", qty: 1 },
      { name: "Torch", qty: 10 },
      { name: "Rations (1 day)", qty: 10 },
      { name: "Waterskin", qty: 1 },
      { name: "Rope, Hempen (50 feet)", qty: 1 }
    ], cost: "10 gp", category: "Carrying", weight: 0, description: "Backpack, a bedroll, a mess kit, a tinderbox, 10 torches, 10 days of rations, a waterskin, and 50 feet of hempen rope strapped to the side." },
  { name: "Priest's Pack", official: true, isContainer: true, contents: [
      { name: "Backpack", qty: 1 },
      { name: "Blanket", qty: 1 },
      { name: "Candle", qty: 10 },
      { name: "Tinderbox", qty: 1 },
      { name: "Alms Box", qty: 1, weight: 1 },
      { name: "Incense (block)", qty: 2, weight: 0 },
      { name: "Censer", qty: 1, weight: 1 },
      { name: "Vestments", qty: 1, weight: 4 },
      { name: "Rations (1 day)", qty: 2 },
      { name: "Waterskin", qty: 1 }
    ], cost: "19 gp", category: "Carrying", weight: 0, description: "Backpack, a blanket, 10 candles, a tinderbox, an alms box, 2 blocks of incense, a censer, vestments, 2 days of rations, and a waterskin." },
  { name: "Scholar's Pack", official: true, isContainer: true, contents: [
      { name: "Backpack", qty: 1 },
      { name: "Book", qty: 1 },
      { name: "Ink (1 ounce bottle)", qty: 1 },
      { name: "Ink Pen", qty: 1 },
      { name: "Parchment (one sheet)", qty: 10 },
      { name: "Bag of Sand", qty: 1, weight: 1 },
      { name: "Knife, Small", qty: 1, weight: 0.5 }
    ], cost: "40 gp", category: "Carrying", weight: 0, description: "Backpack, a book of lore, a bottle of ink, an ink pen, 10 sheets of parchment, a small bag of sand, and a small knife." }
];
