/* ============================================================
   SRD RACES

   Split out of srd-data.js once the file crossed the 1,500-line cap the
   structure suite enforces -- see srd-classes.js and srd-equipment.js for
   the other two splits from that same pass. Loaded right after srd-data.js,
   before character-data.js.
   ============================================================ */

/* Sourced from https://www.5esrd.com/races/, which mirrors the nine playable
   races of the 5e SRD 5.1. Subraces are the harder call: WotC only released
   one subrace per Dwarf/Elf/Gnome/Halfling as Open Game Content (Hill Dwarf,
   High Elf, Rock Gnome, Lightfoot -- each page carries no Section 15 notice,
   unlike the third-party ones, which cite a publisher explicitly). The site's
   own subrace lists don't cover the rest of the true SRD 5.1 either -- no
   Mountain Dwarf, Wood Elf, Drow, or Stout Halfling appear at all -- so
   rather than backfill from memory and break "sourced from 5esrd.com", each
   race gets its one official subrace plus one curated third-party subrace
   (tagged official:false, per "do not filter out the 3pp content"): Guardian
   Dwarf and Surefoot Halfling (Fateforge, Studio Agate), Wild Elf/Wyld
   (Aaralyn's Stolen Notes to Velea, Anne Gregersen), River Gnome (Book of
   Heroic Races, Jon Brazer Enterprises).

   Deliberately out of scope, not merely uncurated: "Ancestry and Culture: An
   Alternative to Races" (a separate alt-ruleset system -- Aasimar, Catfolk,
   Firbolg and the like, not a race with variants) and Dragonborn's
   "Retroverse" 3pp variants (Neon/Laser/Xenon/Tesla/Beat/Code Dragonborn), a
   setting-specific novelty with no generic table use. Human's "Optional
   Human Traits" (swap the ASI for two +1s, a bonus skill, and a feat) is
   real SRD text but needs the feat system wired to a race choice to model
   honestly, which is further than this step goes -- left as prose nowhere,
   same as spell lists.

   Advantage/resistance scoped to one damage type or one condition (Dwarven
   Resilience, Hellish Resistance, Fey Ancestry) has no category narrow
   enough to express correctly, and flat proficiency grants (Keen Senses,
   Menacing, tool and weapon proficiencies) have no generic grant-mechanism
   in the app -- both stay text-only, the same discipline FIGHTING_STYLES'
   Protection already established. Tiefling's Infernal Legacy names specific
   spells (thaumaturgy, hellish rebuke, darkness) that aren't part of this
   app's cantrip/spell scope, so it's text-only too. */
const SRD_RACES = [
  {
    name: "Human", official: true, subraces: null,
    features: [
      { name: "Ability Score Increase", desc: "Your ability scores each increase by 1.",
        effects: [
          { category: "Ability Score", value: { ability: "STR", amount: 1 } },
          { category: "Ability Score", value: { ability: "DEX", amount: 1 } },
          { category: "Ability Score", value: { ability: "CON", amount: 1 } },
          { category: "Ability Score", value: { ability: "INT", amount: 1 } },
          { category: "Ability Score", value: { ability: "WIS", amount: 1 } },
          { category: "Ability Score", value: { ability: "CHA", amount: 1 } }
        ] },
      { name: "Extra Language", desc: "You can speak, read, and write Common and one extra language of your choice.",
        choice: { kind: "language", count: 1, prompt: "Choose an extra language" } }
    ],
    skillChoice: null
  },
  {
    name: "Dwarf", official: true,
    subraces: [
      { name: "Hill Dwarf", official: true, features: [
        { name: "Ability Score Increase", desc: "Your Wisdom score increases by 1.",
          effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 1 } }] },
        { name: "Dwarven Toughness", desc: "Your hit point maximum increases by 1, and it increases by 1 every time you gain a level." }
      ] },
      { name: "Guardian Dwarf", official: false, features: [
        { name: "Ability Score Increase", desc: "Your Wisdom score increases by 1.",
          effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 1 } }] },
        { name: "Guardian", desc: "You have proficiency with shields." },
        { name: "Resilient to Corruption", desc: "You have advantage on saving throws against madness and corruption spells." }
      ] }
    ],
    features: [
      { name: "Ability Score Increase", desc: "Your Constitution score increases by 2.",
        effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
      { name: "Darkvision", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Dwarven Resilience", desc: "You have advantage on saving throws against poison, and resistance to poison damage." },
      { name: "Dwarven Combat Training", desc: "You have proficiency with the battleaxe, handaxe, light hammer, and warhammer." },
      { name: "Tool Proficiency", desc: "You gain proficiency with one type of artisan's tools of your choice: smith's tools, brewer's supplies, or mason's tools." },
      { name: "Stonecunning", desc: "Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in History and add double your proficiency bonus to the check." }
    ]
  },
  {
    name: "Elf", official: true,
    subraces: [
      { name: "High Elf", official: true, features: [
        { name: "Ability Score Increase", desc: "Your Intelligence score increases by 1.",
          effects: [{ category: "Ability Score", value: { ability: "INT", amount: 1 } }] },
        { name: "Elf Weapon Training", desc: "You have proficiency with the longsword, shortsword, shortbow, and longbow." },
        { name: "Cantrip", desc: "You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.",
          choice: { kind: "cantrip", count: 1, prompt: "Choose a wizard cantrip" } },
        { name: "Extra Language", desc: "You can speak, read, and write one extra language of your choice.",
          choice: { kind: "language", count: 1, prompt: "Choose an extra language" } }
      ] },
      { name: "Wild Elf (Wyld)", official: false, features: [
        { name: "Ability Score Increase", desc: "Your Constitution score increases by 1.",
          effects: [{ category: "Ability Score", value: { ability: "CON", amount: 1 } }] },
        { name: "Grovespeaker", desc: "You know the druidcraft cantrip. At 3rd level you can speak with medium or smaller beasts once between rests, as speak with animals; at 5th level this extends to trees, as speak with plants. Using it leaves you with disadvantage on your next Charisma-based roll before your next long rest." },
        { name: "Mask of the Beast", desc: "You have advantage on Stealth checks when hiding among groups of animals." },
        { name: "Wyld Weapon Training", desc: "You have proficiency with the spear, quarterstaff, shortbow, and longbow." }
      ] }
    ],
    features: [
      { name: "Ability Score Increase", desc: "Your Dexterity score increases by 2.",
        effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
      { name: "Darkvision", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Keen Senses", desc: "You have proficiency in the Perception skill." },
      { name: "Fey Ancestry", desc: "You have advantage on saving throws against being charmed, and magic can't put you to sleep." },
      { name: "Trance", desc: "Elves don't need to sleep. Instead they meditate deeply for 4 hours a day, gaining the same benefit a human does from 8 hours of sleep." }
    ]
  },
  {
    name: "Halfling", official: true,
    subraces: [
      { name: "Lightfoot", official: true, features: [
        { name: "Ability Score Increase", desc: "Your Charisma score increases by 1.",
          effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 1 } }] },
        { name: "Naturally Stealthy", desc: "You can attempt to hide even when obscured only by a creature that is at least one size larger than you." }
      ] },
      { name: "Surefoot Halfling", official: false, features: [
        { name: "Ability Score Increase", desc: "Your Constitution score increases by 1.",
          effects: [{ category: "Ability Score", value: { ability: "CON", amount: 1 } }] },
        { name: "Wild Harmony", desc: "You have proficiency in the Survival skill." },
        { name: "Tribal Warfare", desc: "You have proficiency with the shortbow, net, spear, and blowgun." }
      ] }
    ],
    features: [
      { name: "Ability Score Increase", desc: "Your Dexterity score increases by 2.",
        effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
      { name: "Lucky", desc: "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.",
        effects: [{ category: "Reroll", value: { rollType: "d20", threshold: 1 } }] },
      { name: "Brave", desc: "You have advantage on saving throws against being frightened." },
      { name: "Halfling Nimbleness", desc: "You can move through the space of any creature that is of a size larger than yours." }
    ]
  },
  {
    name: "Gnome", official: true,
    subraces: [
      { name: "Rock Gnome", official: true, features: [
        { name: "Ability Score Increase", desc: "Your Constitution score increases by 1.",
          effects: [{ category: "Ability Score", value: { ability: "CON", amount: 1 } }] },
        { name: "Artificer's Lore", desc: "Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you add double your proficiency bonus instead of any proficiency bonus you normally apply." },
        { name: "Tinker", desc: "Proficiency with tinker's tools. With 1 hour and 10 gp of materials, you can build a Tiny clockwork device (AC 5, 1 hp) -- a clockwork toy, a fire starter, or a music box -- that stops working after 24 hours unless repaired. You can have up to three active at once." }
      ] },
      { name: "River Gnome", official: false, features: [
        { name: "Ability Score Increase", desc: "Your Wisdom score increases by 1.",
          effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 1 } }] },
        { name: "Natural Swimmer", desc: "You have advantage on Strength (Athletics) checks made to swim or otherwise maneuver in the water." },
        { name: "River Child", desc: "You are proficient with water vehicles and navigator's tools." }
      ] }
    ],
    features: [
      { name: "Ability Score Increase", desc: "Your Intelligence score increases by 2.",
        effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
      { name: "Darkvision", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Gnome Cunning", desc: "You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic." }
    ]
  },
  {
    name: "Dragonborn", official: true, subraces: null,
    features: [
      { name: "Ability Score Increase", desc: "Your Strength score increases by 2, and your Charisma score increases by 1.",
        effects: [
          { category: "Ability Score", value: { ability: "STR", amount: 2 } },
          { category: "Ability Score", value: { ability: "CHA", amount: 1 } }
        ] },
      { name: "Draconic Ancestry", desc: "Choose one type of dragon. It determines the damage type and shape of your Breath Weapon, and the damage you resist.",
        choice: { kind: "custom", count: 1, prompt: "Choose your draconic ancestry",
          options: [
            { label: "Black -- Acid, 5x30 ft. line (Dex save)" },
            { label: "Blue -- Lightning, 5x30 ft. line (Dex save)" },
            { label: "Brass -- Fire, 5x30 ft. line (Dex save)" },
            { label: "Bronze -- Lightning, 5x30 ft. line (Dex save)" },
            { label: "Copper -- Acid, 5x30 ft. line (Dex save)" },
            { label: "Gold -- Fire, 15 ft. cone (Dex save)" },
            { label: "Green -- Poison, 15 ft. cone (Con save)" },
            { label: "Red -- Fire, 15 ft. cone (Dex save)" },
            { label: "Silver -- Cold, 15 ft. cone (Con save)" },
            { label: "White -- Cold, 15 ft. cone (Con save)" }
          ] } },
      { name: "Breath Weapon", desc: "Action: exhale destructive energy in the shape your draconic ancestry determines. Each creature in the area makes a saving throw (DC 8 + Constitution modifier + proficiency bonus), taking 2d6 damage on a failure (half on a success). Damage rises to 3d6 at 6th level, 4d6 at 11th, 5d6 at 16th.",
        resource: { max: 1, recharge: { on: "SR", amount: "all" } } },
      { name: "Damage Resistance", desc: "You have resistance to the damage type associated with your draconic ancestry." }
    ]
  },
  {
    name: "Half-Elf", official: true, subraces: null,
    features: [
      { name: "Ability Score Increase", desc: "Your Charisma score increases by 2, and two other ability scores of your choice each increase by 1.",
        effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }],
        choice: { kind: "custom", count: 2, prompt: "Choose two other ability scores to increase by 1",
          options: [
            { label: "Strength +1", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 1 } }] },
            { label: "Dexterity +1", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 1 } }] },
            { label: "Constitution +1", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 1 } }] },
            { label: "Intelligence +1", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 1 } }] },
            { label: "Wisdom +1", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 1 } }] }
          ] } },
      { name: "Darkvision", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Fey Ancestry", desc: "You have advantage on saving throws against being charmed, and magic can't put you to sleep." },
      { name: "Skill Versatility", desc: "You gain proficiency in two skills of your choice.",
        choice: { kind: "skill", count: 2, prompt: "Choose two skills" } },
      { name: "Extra Language", desc: "You can speak, read, and write Common, Elvish, and one extra language of your choice.",
        choice: { kind: "language", count: 1, prompt: "Choose an extra language" } }
    ]
  },
  {
    name: "Half-Orc", official: true, subraces: null,
    features: [
      { name: "Ability Score Increase", desc: "Your Strength score increases by 2, and your Constitution score increases by 1.",
        effects: [
          { category: "Ability Score", value: { ability: "STR", amount: 2 } },
          { category: "Ability Score", value: { ability: "CON", amount: 1 } }
        ] },
      { name: "Darkvision", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Menacing", desc: "You gain proficiency in the Intimidation skill." },
      { name: "Relentless Endurance", desc: "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can't use this again until you finish a long rest.",
        resource: { max: 1, recharge: { on: "LR", amount: "all" } } },
      { name: "Savage Attacks", desc: "When you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage of the critical hit." }
    ]
  },
  {
    name: "Tiefling", official: true, subraces: null,
    features: [
      { name: "Ability Score Increase", desc: "Your Intelligence score increases by 1, and your Charisma score increases by 2.",
        effects: [
          { category: "Ability Score", value: { ability: "INT", amount: 1 } },
          { category: "Ability Score", value: { ability: "CHA", amount: 2 } }
        ] },
      { name: "Darkvision", desc: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
      { name: "Hellish Resistance", desc: "You have resistance to fire damage." },
      { name: "Infernal Legacy", desc: "You know the thaumaturgy cantrip. At 3rd level you can cast hellish rebuke as a 2nd-level spell once per long rest; at 5th level you can cast darkness once per long rest. Charisma is your spellcasting ability for these." }
    ]
  }
];
