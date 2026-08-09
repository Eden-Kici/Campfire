/* ============================================================
   REFERENCE DATA

   Every static table the app reads and never writes: the condition and damage
   vocabularies, the SRD-shaped races, classes, backgrounds and starting kits,
   and the small fixed lists the forms are built from.

   It lives apart from app.js because none of it is behaviour. Nothing here
   calls a function or touches the DOM, and all of it is a stand-in for content
   a real build would load rather than hardcode -- so keeping it in one file
   means the day that content becomes a fetch, this is the only file that
   changes.

   Loaded first, before character-data.js and app.js.
   ============================================================ */

const ALL_CONDITIONS = [
  "Blinded", "Charmed", "Concentration", "Deafened", "Exhaustion", "Frightened",
  "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"
];

/* Which conditions bend a roll, and which rolls they touch. Only conditions on
   *this* character are modelled -- the many 5e rules keyed to the target's
   condition ("advantage against a prone creature") need a target, which the
   sheet has no concept of. A homebrew or non-SRD condition simply won't appear
   here, which is what the manual override on the roll window is for. */
const CONDITION_ROLL_EFFECTS = {
  Blinded:    [{ applies: "attack", mode: "disadvantage" }],
  Frightened: [{ applies: "attack", mode: "disadvantage" }, { applies: "check", mode: "disadvantage" }],
  Invisible:  [{ applies: "attack", mode: "advantage" }],
  Poisoned:   [{ applies: "attack", mode: "disadvantage" }, { applies: "check", mode: "disadvantage" }],
  Prone:      [{ applies: "attack", mode: "disadvantage" }],
  Restrained: [{ applies: "attack", mode: "disadvantage" }, { applies: "save", ability: "DEX", mode: "disadvantage" }]
  // Exhaustion is handled separately, since which rolls it touches depends on
  // how many levels of it you have
};

const DAMAGE_TYPES = [
  "Slashing", "Piercing", "Bludgeoning", "Acid", "Cold", "Fire", "Force",
  "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder"
];

// suggestions only -- the field is free text, so "Exotic" or "Firearms" work
const WEAPON_PROFICIENCY_TYPES = ["Simple", "Martial"];

const SRD_WEAPON_PROPERTIES = [
  "Ammunition", "Finesse", "Heavy", "Light", "Loading",
  "Range", "Reach", "Special", "Thrown", "Two-Handed", "Versatile"
];

const MODIFIER_STATS = ["AC", "Initiative", "Speed", "Attack Rolls", "Damage Rolls", "Proficiency Bonus", "Spell Attack", "Spell DC"];
const EFFECT_CATEGORIES_GENERAL = ["Condition", "Ability Score", "Saving Throw", "Skill", "Bonus", "Advantage"];
const EFFECT_CATEGORIES_FEATURE = ["Ability Score", "Saving Throw", "Skill", "Bonus", "Advantage"];

// what an "Advantage" effect can apply to. these values match the `kind` passed
// to showRoll, so a custom effect and the condition table speak the same language.
const ROLL_TYPES = [
  { value: "attack", label: "Attack Rolls" },
  { value: "check", label: "Ability Checks" },
  { value: "save", label: "Saving Throws" },
  { value: "damage", label: "Damage Rolls" },
  { value: "all", label: "All Rolls" }
];

const ALIGNMENTS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil"
];

const ALL_SKILLS = [
  { name: "Athletics", ability: "Strength" },
  { name: "Acrobatics", ability: "Dexterity" },
  { name: "Sleight of Hand", ability: "Dexterity" },
  { name: "Stealth", ability: "Dexterity" },
  { name: "Arcana", ability: "Intelligence" },
  { name: "History", ability: "Intelligence" },
  { name: "Investigation", ability: "Intelligence" },
  { name: "Nature", ability: "Intelligence" },
  { name: "Religion", ability: "Intelligence" },
  { name: "Animal Handling", ability: "Wisdom" },
  { name: "Insight", ability: "Wisdom" },
  { name: "Medicine", ability: "Wisdom" },
  { name: "Perception", ability: "Wisdom" },
  { name: "Survival", ability: "Wisdom" },
  { name: "Deception", ability: "Charisma" },
  { name: "Intimidation", ability: "Charisma" },
  { name: "Performance", ability: "Charisma" },
  { name: "Persuasion", ability: "Charisma" }
];
const ALL_SKILL_NAMES = ALL_SKILLS.map(s => s.name);

const SRD_RACES = [
  {
    name: "Human", subraces: null,
    features: [
      { name: "Ability Score Versatility", desc: "Humans adapt readily to any calling, gaining broad training over specialization." },
      { name: "Extra Language", desc: "You can speak, read, and write one additional language of your choice." }
    ],
    skillChoice: { count: 1, options: ALL_SKILL_NAMES }
  },
  {
    name: "Elf", subraces: [
      { name: "High Elf", features: [
        { name: "Elf Weapon Training", desc: "Proficiency with the longsword, shortsword, shortbow, and longbow." },
        { name: "Cantrip", desc: "You know one wizard cantrip of your choice." }
      ] },
      { name: "Wood Elf", features: [
        { name: "Elf Weapon Training", desc: "Proficiency with the longsword, shortsword, shortbow, and longbow." },
        { name: "Fleet of Foot", desc: "Your base walking speed increases to 35 feet." }
      ] }
    ],
    features: [
      { name: "Darkvision", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Fey Ancestry", desc: "You have advantage on saving throws against being charmed, and magic can't put you to sleep." },
      { name: "Trance", desc: "You don't need to sleep. Instead you meditate deeply for 4 hours a day." }
    ]
  },
  {
    name: "Dwarf", subraces: [
      { name: "Hill Dwarf", features: [
        { name: "Dwarven Toughness", desc: "Your hit point maximum increases by 1, and again whenever you gain a level." }
      ] },
      { name: "Mountain Dwarf", features: [
        { name: "Dwarven Armor Training", desc: "Proficiency with light and medium armor." }
      ] }
    ],
    features: [
      { name: "Darkvision", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Dwarven Resilience", desc: "You have advantage on saving throws against poison, and resistance to poison damage." },
      { name: "Stonecunning", desc: "You have expertise on checks related to the history of stonework." }
    ]
  },
  {
    name: "Halfling", subraces: [
      { name: "Lightfoot", features: [
        { name: "Naturally Stealthy", desc: "You can attempt to hide even when obscured only by a creature at least one size larger than you." }
      ] },
      { name: "Stout", features: [
        { name: "Stout Resilience", desc: "You have advantage on saving throws against poison, and resistance to poison damage." }
      ] }
    ],
    features: [
      { name: "Lucky", desc: "When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die." },
      { name: "Brave", desc: "You have advantage on saving throws against being frightened." },
      { name: "Halfling Nimbleness", desc: "You can move through the space of any creature that is a size larger than you." }
    ]
  }
];

/* Features carry the level they're gained at. The SRD does specify this --
   the omission was mine: this list was written by hand as creator scaffolding
   and only ever needed to be displayed, never granted. With a level on each,
   levelling up can hand them over. */
const SRD_CLASSES = [
  {
    name: "Fighter", mainAbility: "Strength", hitDie: "d10",
    saves: ["Strength", "Constitution"],
    armorProf: "All armor, shields", weaponProf: "Simple and martial weapons",
    description: "A master of martial combat, skilled with a variety of weapons and armor.",
    features: [
      { level: 1, name: "Fighting Style", desc: "You adopt a particular style of fighting as your specialty." },
      { level: 1, name: "Second Wind", desc: "You can regain hit points as a bonus action once per short rest." },
      { level: 2, name: "Action Surge", desc: "You can take one additional action on your turn, once per short rest." }
    ],
    skillChoices: { count: 2, options: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"] },
    subclasses: [
      { name: "Champion", features: [{ level: 3, name: "Improved Critical", desc: "Your weapon attacks score a critical hit on a roll of 19 or 20." }] },
      { name: "Battle Master", features: [{ level: 3, name: "Combat Superiority", desc: "You learn maneuvers fueled by superiority dice to enhance your attacks." }] }
    ]
  },
  {
    name: "Wizard", mainAbility: "Intelligence", hitDie: "d6",
    saves: ["Intelligence", "Wisdom"],
    armorProf: "None", weaponProf: "Daggers, darts, slings, quarterstaffs, light crossbows",
    description: "A scholarly magic-user capable of manipulating the structures of reality.",
    features: [
      { level: 1, name: "Spellcasting", desc: "You cast wizard spells using Intelligence, prepared from your spellbook." },
      { level: 1, name: "Arcane Recovery", desc: "Once per day, you can recover spell slots during a short rest." }
    ],
    skillChoices: { count: 2, options: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"] },
    subclasses: [
      { name: "School of Evocation", features: [{ level: 2, name: "Sculpt Spells", desc: "You can create pockets of relative safety within your evocation spells." }] },
      { name: "School of Abjuration", features: [{ level: 2, name: "Arcane Ward", desc: "A magical ward absorbs damage on your behalf." }] }
    ]
  },
  {
    name: "Rogue", mainAbility: "Dexterity", hitDie: "d8",
    saves: ["Dexterity", "Intelligence"],
    armorProf: "Light armor", weaponProf: "Simple weapons, hand crossbows, longswords, rapiers, shortswords",
    description: "A scoundrel who uses stealth and trickery to overcome obstacles and enemies.",
    features: [
      { level: 1, name: "Expertise", desc: "Double your proficiency bonus for two skills you're proficient in." },
      { level: 1, name: "Sneak Attack", desc: "Deal extra damage once per turn when you have advantage or an ally nearby." },
      { level: 2, name: "Cunning Action", desc: "You can Dash, Disengage, or Hide as a bonus action." }
    ],
    skillChoices: { count: 4, options: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Performance", "Persuasion", "Sleight of Hand", "Stealth"] },
    subclasses: [
      { name: "Thief", features: [{ level: 3, name: "Fast Hands", desc: "Use your bonus action for Sleight of Hand checks, disarming traps, or using items." }] },
      { name: "Assassin", features: [{ level: 3, name: "Assassinate", desc: "You have advantage on attacks against creatures that haven't acted yet in combat." }] }
    ]
  },
  {
    name: "Cleric", mainAbility: "Wisdom", hitDie: "d8",
    saves: ["Wisdom", "Charisma"],
    armorProf: "Light and medium armor, shields", weaponProf: "Simple weapons",
    description: "A priestly champion who wields divine magic in service of a higher power.",
    features: [
      { level: 1, name: "Spellcasting", desc: "You cast cleric spells using Wisdom, prepared from your available list." },
      { level: 1, name: "Divine Domain", desc: "You choose a domain related to your deity, granting additional features." },
      { level: 2, name: "Channel Divinity", desc: "You can channel divine energy to fuel magical effects." }
    ],
    skillChoices: { count: 2, options: ["History", "Insight", "Medicine", "Persuasion", "Religion"] },
    subclasses: [
      { name: "Life Domain", features: [{ level: 1, name: "Disciple of Life", desc: "Your healing spells restore additional hit points." }] },
      { name: "Light Domain", features: [{ level: 1, name: "Warding Flare", desc: "You can impose disadvantage on an attack roll against you." }] }
    ]
  }
];

const SRD_BACKGROUNDS = [
  { name: "Soldier", desc: "You had a military career, trained in combat and discipline.", skills: ["Athletics", "Intimidation"], feature: { name: "Military Rank", desc: "You have a military rank and command the respect of soldiers loyal to your former organization." } },
  { name: "Sage", desc: "You spent years learning the lore of the multiverse.", skills: ["Arcana", "History"], feature: { name: "Researcher", desc: "You know how or where to find information, even if you don't know it yourself." } },
  { name: "Criminal", desc: "You have a history of breaking the law and living on its edges.", skills: ["Deception", "Stealth"], feature: { name: "Criminal Contact", desc: "You have a reliable contact in the criminal underworld." } },
  { name: "Acolyte", desc: "You've spent your life in service to a temple.", skills: ["Insight", "Religion"], feature: { name: "Shelter of the Faithful", desc: "You command the respect of those who share your faith and can perform religious ceremonies." } }
];

/* Starting kit, as real items rather than a list of names -- each entry is
   spread straight into an inventory entry, so a bow arrives with its damage,
   its properties and a quiver already feeding it. The shapes here are the same
   ones the item editor produces.

   Each class offers a few either/or choices, matching how 5e hands out
   equipment. `gear` is granted regardless. */
const STARTING_KIT = {
  Fighter: {
    gear: ["explorer", "rations"],
    choices: [
      { prompt: "Armour", options: [
        { label: "Chain mail", items: ["chainmail"] },
        { label: "Leather armour, longbow and arrows", items: ["leather", "longbow", "arrows", "quiver"] }
      ] },
      { prompt: "Weapons", options: [
        { label: "Longsword and shield", items: ["longsword", "shield"] },
        { label: "Two shortswords", items: ["shortsword", "shortsword"] }
      ] }
    ]
  },
  Rogue: {
    gear: ["leather", "thievestools", "rations"],
    choices: [
      { prompt: "Main weapon", options: [
        { label: "Rapier", items: ["rapier"] },
        { label: "Shortsword", items: ["shortsword"] }
      ] },
      { prompt: "Ranged", options: [
        { label: "Shortbow, arrows and a quiver", items: ["shortbow", "arrows", "quiver"] },
        { label: "Two daggers", items: ["dagger", "dagger"] }
      ] }
    ]
  },
  Wizard: {
    gear: ["spellbook", "rations"],
    choices: [
      { prompt: "Weapon", options: [
        { label: "Quarterstaff", items: ["quarterstaff"] },
        { label: "Dagger", items: ["dagger"] }
      ] }
    ]
  },
  Cleric: {
    gear: ["shield", "rations"],
    choices: [
      { prompt: "Armour", options: [
        { label: "Scale mail", items: ["scalemail"] },
        { label: "Leather armour", items: ["leather"] }
      ] },
      { prompt: "Weapon", options: [
        { label: "Mace", items: ["mace"] },
        { label: "Warhammer", items: ["warhammer"] }
      ] }
    ]
  }
};

const KIT_ITEMS = {
  chainmail:   { name: "Chain Mail", category: "Worn", weight: 55, armour: { base: 16, kind: "heavy", dexCap: 0 } },
  scalemail:   { name: "Scale Mail", category: "Worn", weight: 45, armour: { base: 14, kind: "medium", dexCap: 2 } },
  leather:     { name: "Leather Armour", category: "Worn", weight: 10, armour: { base: 11, kind: "light", dexCap: null } },
  shield:      { name: "Shield", category: "Worn", weight: 6, armour: { base: 2, kind: "shield", dexCap: null } },

  longsword:   { name: "Longsword", category: "Equipped", weight: 3, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Versatile (1d10)"], damage: [{ dice: "1d8", type: "Slashing", ability: "STR" }] },
  shortsword:  { name: "Shortsword", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Finesse", "Light"], damage: [{ dice: "1d6", type: "Piercing", ability: "DEX" }] },
  rapier:      { name: "Rapier", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Finesse"], damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }] },
  dagger:      { name: "Dagger", category: "Equipped", weight: 1, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Finesse", "Light", "Thrown (range 20/60)"],
                 damage: [{ dice: "1d4", type: "Piercing", ability: "DEX" }] },
  mace:        { name: "Mace", category: "Equipped", weight: 4, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: [], damage: [{ dice: "1d6", type: "Bludgeoning", ability: "STR" }] },
  warhammer:   { name: "Warhammer", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Versatile (1d10)"], damage: [{ dice: "1d8", type: "Bludgeoning", ability: "STR" }] },
  quarterstaff:{ name: "Quarterstaff", category: "Equipped", weight: 4, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Versatile (1d8)"], damage: [{ dice: "1d6", type: "Bludgeoning", ability: "STR" }] },
  shortbow:    { name: "Shortbow", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "ranged", range: "80/320 ft",
                 properties: ["Ammunition", "Two-Handed"], ammunition: "Quiver",
                 damage: [{ dice: "1d6", type: "Piercing", ability: "DEX" }] },
  longbow:     { name: "Longbow", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "150/600 ft",
                 properties: ["Ammunition", "Heavy", "Two-Handed"], ammunition: "Quiver",
                 damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }] },

  arrows:      { name: "Arrows", category: "Carrying", weight: 0.05, qty: 40,
                 description: "Loose arrows, kept in the pack.",
                 resource: { max: 0, recharge: { on: "none", amount: "all" } } },
  quiver:      { name: "Quiver", category: "Worn", weight: 1,
                 description: "Holds twenty arrows within easy reach.",
                 resource: { max: 20, loaded: 20, refillFrom: "Arrows", recharge: { on: "none", amount: "all" } } },

  explorer:    { name: "Explorer's Pack", category: "Carrying", weight: 59,
                 description: "Backpack, bedroll, mess kit, tinderbox, torches, rations and rope." },
  spellbook:   { name: "Spellbook", category: "Carrying", weight: 3, description: "Your spells, written down." },
  thievestools:{ name: "Thieves' Tools", category: "Carrying", weight: 1, description: "Picks, a small file, and a mirror on a handle." },
  rations:     { name: "Rations", category: "Carrying", weight: 2, qty: 5,
                 resource: { max: 0, recharge: { on: "none", amount: "all" } } }
};

const CREATOR_ABILITY_ORDER = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_LIMIT = 27;
const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

const ITEM_TYPES = [
  { value: "gear", label: "Gear" },
  { value: "weapon", label: "Weapon" },
  { value: "armour", label: "Armour" }
];

const ARMOUR_KINDS = [
  { value: "light", label: "Light", dexCap: null },
  { value: "medium", label: "Medium", dexCap: 2 },
  { value: "heavy", label: "Heavy", dexCap: 0 },
  { value: "shield", label: "Shield", dexCap: null }
];
