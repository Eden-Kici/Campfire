/* ============================================================
   THE DEMO CHARACTER
   ============================================================

   Sigrid of Chester: the sheet the app opens with, and the fixture nearly
   every test builds on. Split out of character-data.js when that file hit the
   structure suite's 1,500-line cap -- a clean seam, because everything left
   behind is calculation and this is the one piece that is purely data.

   Every item on her is real catalogue content. That is deliberate and worth
   keeping: source tags compare an item against the catalogue row of the same
   name, so a demo built from near-misses reports its own kit as homebrew. */

/* `character` is the sheet currently open, not a fixed object. Everything in
   the app reads this global fresh on each call and nothing captures it, so
   switching characters is a matter of repointing it -- see selectCharacter().
   The literal below is the demo character used when there's nothing saved. */
let character = {
  id: 1,
  name: "Sigrid of Chester",

  /* Classes are the real record; the line under the character's name is
     derived from them. Each carries its own level, hit die and subclass, so a
     multiclass character is just more than one entry. Proficiency bonus and
     hit dice fall out of this rather than being written down separately. */
  classes: [
    { name: "Fighter", level: 4, subclass: "Champion", hitDie: "d10" },
    { name: "Wizard", level: 2, subclass: "School of Evocation", hitDie: "d6" },
    { name: "Cleric", level: 2, subclass: "Life Domain", hitDie: "d8" }
  ],
  race: "Half-Elf",
  subrace: null,

  profilePic: null, // data URL, or null for the placeholder
  alignment: "Chaotic Good",
  appearance: "Broad-shouldered, close-cropped grey hair, a long scar across one eyebrow.",
  personalityTraits: "Never backs down from a bar bet. Counts her blessings out loud, every one of them.",
  ideals: "Freedom. Chains are for cowards and kings.",
  bonds: "Owes her life to the militia that took her in after Chester burned.",
  flaws: "Can't resist a locked door, whether it's hers to open or not.",
  backstory: "Once a militia scout in Chester before the town was razed. Took up the blade professionally after, never quite settling down.",

  // legal multiclass prerequisites: Fighter needs STR 13, Wizard INT 13, Cleric WIS 13
  abilities: {
    STR: 16, DEX: 14, CON: 14, INT: 13, WIS: 13, CHA: 8
  },

  // derived from total level unless set; see calculateProficiencyBonus
  proficiencyBonusOverride: null,
  baseSpeed: 30,

  inspiration: { current: 0, max: 1 },

  /* 62 = Fighter 1 at a full d10, three more Fighter levels at the d10 average,
     two Wizard at the d6 average, two Cleric at the d8 average, with
     Constitution +2 on every one of the eight. */
  hp: { current: 47, temp: 0 },

  // only meaningful at 0 hit points; healing above 0 clears both tracks
  deathSaves: { successes: 0, failures: 0 },
  baseMaxHP: 62,
  maxHpModifiers: [],

  /* Hit dice are per class: this build is 4d10 + 2d6 + 2d8. Only how many of
     each have been spent is stored. The totals come from the class
     levels above -- see calculateHitDice -- so levelling up can't leave the
     pool disagreeing with the character. */
  hitDiceSpent: { d10: 1 },

  // Effects are grouped by their cause. One spell or condition often produces
  // several modifiers that all begin and end together, so duration and
  // concentration belong to the group rather than to each modifier. This is the
  // same shape as trait.effects, so features and active effects flatten
  // identically. A group with an empty effects array is a valid label-only
  // reminder ("Cursed") with no mechanical bonus.
  activeEffects: [
    {
      id: 1, name: "Prone", concentration: false,
      duration: { type: "Permanent", rounds: null },
      effects: [{ category: "Condition", value: { condition: "Prone" } }]
    },
    {
      id: 2, name: "Bless", concentration: true,
      note: "Cast by Aldric before the goblin camp. Ends if he takes damage and fails the save.",
      duration: { type: "Rounds", rounds: 10 },
      effects: [
        { category: "Bonus", value: { stat: "Attack Rolls", amount: "1d4" } },
        { category: "Saving Throw", value: { ability: "All", amount: "1d4" } }
      ]
    }
  ],

  /* recharge is { on, amount }:
       on     "SR" | "LR" | "none" | any custom text (custom never auto-restores)
       amount "all" | "half" | a number | a dice string like "1d4"
     Splitting the trigger from the quantity is what lets a rest express things
     like hit dice (half on a long rest) or Arcane Recovery without the label
     lying about what actually happens.

     Spell slots deliberately do NOT live here -- see spellSlots below. */
  resources: [
    { id: 3, name: "Second Wind", recharge: { on: "SR", amount: "all" }, current: 1, max: 1 },
    { id: 4, name: "Action Surge", recharge: { on: "SR", amount: "all" }, current: 1, max: 1 },
    { id: 5, name: "Channel Divinity", recharge: { on: "SR", amount: "all" }, current: 1, max: 1 },
    { id: 6, name: "Arcane Recovery", recharge: { on: "LR", amount: "all" }, current: 1, max: 1 }
  ],

  // Weapons declare what they need (proficiencyRequired); this is what the
  // character actually has. Proficiency on an attack is derived from the two,
  // with a per-weapon override -- the same shape as skills and saves.
  // NOTE: traits > Proficiencies > Weapons still says "Simple, martial" as
  // flavour text. That text is decorative and this list is authoritative; they
  // can drift. Armour and tool proficiencies have no model yet.
  weaponProficiencies: ["Simple", "Martial"],

  // flat list, same shape as weaponProficiencies -- the authoritative record.
  // Nothing renders a "Languages" trait category anymore; this is the only
  // place a known language lives, so there's nowhere for it to drift from.
  languages: ["Common", "Elvish"],

  /* Coin. `purse` is on you and can weigh something; `stash` is somewhere else
     and never does. Both exist on every character even when the stash setting
     is off, so turning it on doesn't have to migrate anything. */
  purse: { pp: 0, gp: 42, ep: 0, sp: 15, cp: 8 },
  stash: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },

  /* A choice a granted feature owes you but hasn't answered yet -- "choose an
     extra language," "choose a fighting style." Not every feature creates
     one; only features with a `.choice` descriptor in the SRD data do (see
     srd-data.js). Resolving one applies it (writes to `languages`, sets
     `skillProficiency` to 2 for Expertise, attaches `.effects` to the
     originating trait for a mechanical Fighting Style, adds a spell for a
     Cantrip) and removes it from this list -- there's no partial/resolved
     state to track once it's answered. Choosing "I'll track this myself"
     removes it the same way, just without the mechanical part; the feature
     text granted it is already sitting in traits regardless. */
  pendingChoices: [],

  savingThrowProficiency: { STR: 1, DEX: 0, CON: 1, INT: 0, WIS: 0, CHA: 0 },
  // present only for a save that's been manually overridden; value replaces the calculated total
  savingThrowOverride: {},

  /* Soldier background (Athletics, Intimidation), Fighter's two (Perception,
     Survival), Half-Elf's two (Arcana, Insight). Multiclassing into Wizard or
     Cleric grants no skills, and nothing in this build grants expertise. */
  skillProficiency: {
    Athletics: 1, Intimidation: 1, Perception: 1, Survival: 1, Arcana: 1, Insight: 1
  },
  // present only for a skill that's been manually overridden; value replaces the calculated total
  skillOverride: {},

  skillAbilityMap: JSON.parse(JSON.stringify(SKILL_ABILITY_MAP)),

  // grouped under "Features & Traits". any entry can carry .effects (array,
  // can hold multiple), permanent as long as the feature exists.
  traits: {
    "Race Traits": [
      { name: "Darkvision", desc: "See in dim light within 60 ft as if bright light, and in darkness as if dim light." },
      { name: "Fey Ancestry", desc: "Advantage on saves against being charmed, and magic can't put you to sleep." }
    ],
    "Background Features": [
      { name: "Military Rank", desc: "You have a rank from your career as a soldier, and soldiers loyal to your old organisation still recognise it." }
    ],
    /* Every feature these eight levels actually grant. Both classes call theirs
       "Spellcasting", so each says which class it came from -- otherwise one
       silently stands in for the other. */
    "Class Features": [
      { name: "Fighting Style: Defence", desc: "Fighter 1. +1 AC while wearing armour.",
        effects: [{ category: "Bonus", value: { stat: "AC", amount: 1 } }] },
      { name: "Second Wind", desc: "Fighter 1. Bonus action to regain 1d10 + Fighter level hit points." },
      { name: "Action Surge", desc: "Fighter 2. One additional action on your turn." },
      { name: "Improved Critical", desc: "Champion 3. Weapon attacks crit on a 19 or 20." },
      { name: "Spellcasting (Wizard)", desc: "Wizard 1. Intelligence, prepared from your spellbook." },
      { name: "Arcane Recovery", desc: "Wizard 1. Once a day on a short rest, recover spell slots totalling half your Wizard level." },
      { name: "Sculpt Spells", desc: "Evocation 2. Chosen creatures automatically succeed against your evocations and take no damage." },
      { name: "Spellcasting (Cleric)", desc: "Cleric 1. Wisdom, prepared from the whole Cleric list." },
      { name: "Divine Domain: Life", desc: "Cleric 1. Proficiency with heavy armour, and the domain's spells are always prepared." },
      { name: "Disciple of Life", desc: "Life 1. Your healing spells restore an extra 2 + the spell's level." },
      { name: "Channel Divinity: Preserve Life", desc: "Cleric 2. Restore hit points totalling five times your Cleric level, split among creatures nearby." }
    ],
    "Feats": [
      {
        name: "Alert",
        desc: "Can't be surprised while conscious.",
        effects: [{ category: "Bonus", value: { stat: "Initiative", amount: 5 } }]
      }
    ],
    "Proficiencies": [
      { name: "Armour", desc: "Light, medium, heavy, shields" },
      { name: "Weapons", desc: "Simple, martial" },
      { name: "Tools", desc: "None" }
    ]
  },

  // customSource overrides the default "Category – Name" attack source label.
  // isDefaultLoadout marks the pre-seeded weapons so they keep that default
  // label; attacks added later via the UI default to "Custom" instead.
  inventory: [
    // armour sets a base AC and caps Dexterity, rather than adding a flat bonus
    {
      id: 1, name: "Chain Shirt", category: "Worn", weight: 20, qty: 1,
      description: "Interlocking metal rings worn under clothing.",
      armour: { base: 13, kind: "medium", dexCap: 2 }
    },
    // not armour -- a flat bonus that stacks on top of whatever you're wearing
    /* These carry the catalogue's own fields rather than a hand-written
       approximation of them. The source tag is worked out by comparing an item
       with the catalogue row of the same name, so a demo character built from
       near-misses reported half its own kit as homebrew. */
    { id: 2, name: "Cloak of Protection", category: "Worn", weight: 1, qty: 1, acBonus: 1,
      rarity: "Uncommon", attunement: true,
      description: "You gain a +1 bonus to AC and saving throws while you wear this cloak." },
    // damage is a list, so one weapon can deal several types at once. Only a
    // part that names an `ability` adds that modifier; extra dice (poison,
    // sneak attack, elemental riders) normally don't get it.
    {
      id: 3, name: "Longsword", category: "Equipped", weight: 3, qty: 1,
      isWeapon: true, isDefaultLoadout: true, attackAbility: "STR",
      proficiencyRequired: "Martial", magicBonus: 0,
      damage: [{ dice: "1d8", type: "Slashing", ability: "STR" }],
      weaponType: "melee", range: "5 ft", properties: ["Versatile (1d10)"]
    },
    {
      id: 4, name: "Shortbow", category: "Equipped", weight: 2, qty: 1,
      isWeapon: true, isDefaultLoadout: true, attackAbility: "DEX",
      proficiencyRequired: "Simple", magicBonus: 0,
      damage: [{ dice: "1d6", type: "Piercing", ability: "DEX" }],
      weaponType: "ranged", range: "80/320 ft", properties: ["Ammunition", "Two-Handed"],
      ammunition: "Quiver"   // draws from the quiver, which refills from the arrow stack
    },
    {
      id: 8, name: "Serpent's Fang", category: "Equipped", weight: 1, qty: 1,
      isWeapon: true, isDefaultLoadout: true, attackAbility: "DEX",
      proficiencyRequired: "Exotic", magicBonus: 1,
      description: "A slender blade with a hollow fang for a point, weeping venom.",
      damage: [
        { dice: "1d4", type: "Piercing", ability: "DEX" },
        { dice: "1d6", type: "Poison" }
      ],
      weaponType: "melee", range: "5 ft", properties: ["Finesse", "Light"]
    },
    { id: 5, name: "Ring of Precision", category: "Worn", weight: 0, qty: 1, attackBonus: 1,
      rarity: "Uncommon", attunement: false, description: "A plain band that steadies the hand. You gain a +1 bonus to attack rolls while you wear it." },
    { id: 6, name: "Bag of Holding", category: "Carrying", weight: 15, qty: 1,
      rarity: "Uncommon", attunement: false,
      description: "This bag has an interior space considerably larger than its outside dimensions, roughly 2 feet in diameter at the mouth and 4 feet deep. The bag can hold up to 500 pounds, not exceeding a volume of 64 cubic feet. The bag weighs 15 pounds, regardless of its contents. Retrieving an item from the bag requires an action.\nIf the bag is overloaded, pierced, or torn, it ruptures and is destroyed, and its contents are scattered in the Astral Plane. If the bag is turned inside out, its contents spill forth, unharmed, but the bag must be put right before it can be used again. Breathing creatures inside the bag can survive up to a number of minutes equal to 10 divided by the number of creatures (minimum 1 minute), after which time they begin to suffocate.\nPlacing a bag of holding inside an extradimensional space created by a handy haversack, portable hole, or similar item instantly destroys both items and opens a gate to the Astral Plane. The gate originates where the one item was placed inside the other. Any creature within 10 feet of the gate is sucked through it to a random location on the Astral Plane. The gate then closes. The gate is one-way only and can't be reopened." },
    /* Arrows are a thing you own and a counter you spend. `resource` makes the
       item show up under Resources on the Combat tab, where its quantity IS
       the count -- so there's one number, not an item and a resource that can
       drift apart. */
    {
      id: 9, name: "Arrow", category: "Carrying", weight: 0.05, qty: 60,
      description: "Ammunition for a bow.",
      // a stack: no capacity, so it shows a bare count rather than "60/0"
      resource: { max: 0, recharge: { on: "none", amount: "all" } }
    },
    {
      id: 10, name: "Quiver", category: "Worn", weight: 1, qty: 1,
      description: "Holds up to 20 arrows.",
      // a container: the bow draws from here, and it refills from the stack
      resource: { max: 20, loaded: 20, refillFrom: "Arrow", recharge: { on: "none", amount: "all" } }
    },
    // stored, not worn -- proves armour only counts from a category whose
    // rules say appliesEffects
    {
      id: 7, name: "Chain Mail", category: "Camp Storage", weight: 55, qty: 1,
      description: "Requires Strength 13, or speed drops by 10 feet. Disadvantage on Stealth checks.",
      armour: { base: 16, kind: "heavy", dexCap: 0 }
    }
  ],

  /* providesAttacks decides whether a weapon in this category shows up under
     Attacks. It's separate from appliesEffects because a cloak you're wearing
     applies its bonus without being something you swing, and a greatsword
     strapped to your back is carried without being drawn. */
  categoryRules: {
    Worn: { countsWeight: true, appliesEffects: true, providesAttacks: false },
    Equipped: { countsWeight: true, appliesEffects: true, providesAttacks: true },
    Carrying: { countsWeight: true, appliesEffects: false, providesAttacks: false },
    "Camp Storage": { countsWeight: false, appliesEffects: false, providesAttacks: false }
  },

  spellcasting: {
    classes: [
      { name: "Wizard", ability: "INT" },
      { name: "Cleric", ability: "WIS" }
    ]
  },

  // shared slot pool (multiclass casters draw from one pool in 5e).
  // stored as raw current/max, same as resources -- nothing here is derived.
  //
  // SINGLE SOURCE OF TRUTH for slots. Rendered in two places -- the Combat
  // tab's Resources list and the Spells tab -- both of which read and write
  // this object directly, so the two views can never drift apart. Do not
  // mirror slots into `resources`; that's what caused them to disagree before.
  // recharge uses the same vocabulary as resource tags ("SR" / "LR"), so rests
  // can treat slots and resources with one rule. NOTE: Pact Magic doesn't fit
  // here -- a Warlock's slots recharge on SR *and* live in a separate pool from
  // the shared multiclass pool. That needs its own structure; see notes.
  /* Two Wizard levels plus two Cleric levels is a caster level of four: four
     first-level slots and three second. No third-level slots. */
  spellSlots: {
    1: { current: 3, max: 4, recharge: { on: "LR", amount: "all" } },
    2: { current: 2, max: 3, recharge: { on: "LR", amount: "all" } }
  },

  // maxPreparedByClass is also a raw ingredient (not calculated from level/ability)
  // until the class/level model is built out further.
  // ability modifier (+1 each) plus that class's level (2 each)
  maxPreparedByClass: { Wizard: 3, Cleric: 3 },

  // level 0 = cantrip. prepared is only meaningful for level > 0 (cantrips are
  // always available). attackRoll marks spells that roll to-hit using the
  // casting class's spell attack bonus.
  spells: [
    { id: 1, name: "Fire Bolt", level: 0, classSource: "Wizard", castingTime: "A", attackRoll: true, damage: "1d10", desc: "Ranged spell attack, 1d10 fire damage." },
    { id: 2, name: "Mage Hand", level: 0, classSource: "Wizard", castingTime: "A", attackRoll: false, desc: "A spectral hand that can carry up to 10 pounds." },
    { id: 3, name: "Prestidigitation", level: 0, classSource: "Wizard", castingTime: "A", attackRoll: false, desc: "A handful of harmless minor effects." },
    { id: 4, name: "Guidance", level: 0, classSource: "Cleric", castingTime: "A", attackRoll: false, desc: "Concentration. Target adds 1d4 to one ability check." },
    { id: 5, name: "Sacred Flame", level: 0, classSource: "Cleric", castingTime: "A", attackRoll: false, damage: "1d8", desc: "Dexterity save or 1d8 radiant damage. Cover doesn't help." },
    { id: 6, name: "Thaumaturgy", level: 0, classSource: "Cleric", castingTime: "A", attackRoll: false, desc: "A minor wonder: a booming voice, trembling ground, flickering flames." },

    { id: 7, name: "Shield", level: 1, classSource: "Wizard", castingTime: "R", attackRoll: false, prepared: true, desc: "+5 AC until the start of your next turn, including against the triggering attack." },
    { id: 8, name: "Magic Missile", level: 1, classSource: "Wizard", castingTime: "A", attackRoll: false, prepared: true, damage: "3d4+3", desc: "Three darts, 1d4+1 force damage each, automatically hitting." },
    { id: 9, name: "Cure Wounds", level: 1, classSource: "Cleric", castingTime: "A", attackRoll: false, prepared: true, desc: "Heal 1d8 + Wisdom modifier, plus 2 from Disciple of Life." },
    { id: 10, name: "Bless", level: 1, classSource: "Cleric", castingTime: "A", attackRoll: false, prepared: true, desc: "Concentration. Three creatures add 1d4 to attack rolls and saving throws." },

    { id: 11, name: "Misty Step", level: 2, classSource: "Wizard", castingTime: "B", attackRoll: false, prepared: true, desc: "Teleport up to 30 feet to a space you can see." },
    { id: 12, name: "Spiritual Weapon", level: 2, classSource: "Cleric", castingTime: "B", attackRoll: true, prepared: true, damage: "1d8+3", desc: "A floating weapon, 1d8 + Wisdom modifier force damage." }
  ],

  // mock party roster for the sharing UI -- no real accounts/network yet

  // receiveFrom: at most one section should have this true at a time (see UI logic in app.js)
  noteSections: [
    { id: 1, name: "Shared", autoShare: true, receiveFrom: true },
    { id: 2, name: "Session Notes", autoShare: false, receiveFrom: false }
  ],

  // sharing is null for a private note. otherwise:
  //   sharedByMe: true  -> { sharedByMe: true, continuous, sharedWith: [{ name, permission: "view"|"edit" }] }
  //   sharedByMe: false -> { sharedByMe: false, sharedByName, continuous, permission: "view"|"edit" }
  notes: [
    {
      id: 1, sectionId: 1, title: "Rumor: the old mill",
      body: "Locals say lights have been seen in the abandoned mill north of town after dark.",
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2, updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
      // sharing is real now, so the demo character no longer pretends: this
      // used to claim it came from a GM who has never existed
      sharing: null
    },
    {
      id: 2, sectionId: 1, title: "Party gold split",
      body: "412 gold total, split 4 ways after the goblin camp haul. Everyone's owed 103.",
      createdAt: Date.now() - 1000 * 60 * 60 * 5, updatedAt: Date.now() - 1000 * 60 * 60 * 5,
      // likewise: this was shared with three people who cannot be sent to,
      // which read in the interface as a share that was quietly not happening
      sharing: null
    },
    {
      id: 3, sectionId: 2, title: "Suspicious innkeeper",
      body: "Keeps glancing at the door. Might be watching for someone.",
      createdAt: Date.now() - 1000 * 60 * 30, updatedAt: Date.now() - 1000 * 60 * 30,
      sharing: null
    }
  ]
};
