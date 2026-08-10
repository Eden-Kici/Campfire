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
  "Blinded", "Bloodied", "Burned (a)", "Burned (b)", "Challenged", "Charmed", "Concentration",
  "Confused", "Damaged", "Dazed", "Deafened", "Decaying", "Decrepit", "Demoralized", "Despondent",
  "Dominated", "Doomed", "Dulled", "Entombed", "Euphoria", "Exhaustion", "Fatigued", "Frightened",
  "Frigid", "Frozen", "Grappled", "Guilty", "Hidden", "Incapacitated", "Infested", "Intoxicated",
  "Invisible", "Marked", "Paralyzed", "Petrified", "Poisoned", "Possessed", "Prone", "Relaxed",
  "Rested", "Restrained", "Scouted", "Shocked", "Stunned", "Unconscious", "Wounded"
];

/* Rules text for every condition on 5esrd.com/gamemastering/conditions,
   browsable from the content library (see "conditions" in CONTENT_CATEGORIES,
   content.js) -- official SRD conditions and the site's third-party ones
   alike, per instruction not to filter 3pp content out. `official: true`
   marks the 15 conditions that are actually in the SRD 5.1 (the ones this
   app's own mechanics, CONDITION_ROLL_EFFECTS below, can key off); every
   other entry is exactly as billed on the source page, condensed to this
   app's usual one-feature-worth-of-sentences style rather than pasted
   verbatim -- several of the longer ones (Infested, Decaying, Intoxicated)
   are multi-paragraph on the site with their own subheadings.

   ALL_CONDITIONS above stays a flat string array of every name here plus
   "Concentration" -- it feeds the Add Effect combo box (wireCombo expects
   strings) and is also the key CONDITION_ROLL_EFFECTS reads by.
   "Concentration" has no entry here: it isn't a condition in the rules, it's
   this app's own tracking label, so it has no SRD text to show. */
const SRD_CONDITIONS = [
  { name: "Blinded", official: true, desc: "A blinded creature can't see and automatically fails any ability check that requires sight. Attack rolls against it have advantage, and its own attack rolls have disadvantage." },
  { name: "Bloodied", official: false, desc: "Automatically applies once a creature drops below half its hit point maximum. On its own it changes nothing, but other effects can key off it -- and anywhere a rule cares about half a creature's hit point maximum, its bloodied value is used instead." },
  { name: "Burned (a)", official: false, desc: "An alternative to a straight damage roll: a GM can shave two dice off an acid/cold/fire/necrotic/poison/radiant effect that calls for a save, and inflict this on a failed save instead. Ends on a lesser restoration or when the creature is fully healed." },
  { name: "Burned (b)", official: false, desc: "The creature is also Bloodied, and has vulnerability to whichever damage type first caused this condition." },
  { name: "Challenged", official: false, desc: "Disadvantage on attack rolls against anything but the challenger, and advantage on attacks against the challenger. No penalty if the challenger can't possibly be attacked, such as while hidden." },
  { name: "Charmed", official: true, desc: "A charmed creature can't attack the charmer or target it with harmful abilities or magic. The charmer has advantage on social ability checks against the creature." },
  { name: "Confused", official: false, desc: "At the start of each of its turns, roll a d10: 1 moves it in a random direction with no action, 2-6 it does nothing, 7-8 it melee attacks a random creature in reach (or nothing, if none is in reach), 9-10 it acts normally." },
  { name: "Damaged", official: false, desc: "A leveled condition for damaged constructs and engines, levels 1-6: advantage on ability checks and saves, blindsight out to 300 ft, advantage on attack rolls, damage retaliation to anyone within 10 ft, doubled damage dealt, and finally the engine can be slain." },
  { name: "Dazed", official: false, desc: "Speed halved, only an action or a bonus action on its turn (not both), and no reactions or legendary actions. A creature immune to Stunned is immune to this too." },
  { name: "Deafened", official: true, desc: "A deafened creature can't hear and automatically fails any ability check that requires hearing." },
  { name: "Decaying", official: false, desc: "A leveled condition, 1-6, picked up by resting in a necropolis domain and lost one level per long rest taken outside it: disadvantage on Charisma checks, vision cut to 60 ft, Deafened, no Dash or Disengage, hit point maximum halved, and finally death." },
  { name: "Decrepit", official: false, desc: "On gaining the condition, and again every 10 minutes it persists, a DC 10 Constitution save or die of old age. The DC rises by 2 on each success, cumulative until the condition ends." },
  { name: "Demoralized", official: false, desc: "Disadvantage on ability checks and attack rolls. Anything that grants bravery or hope against fear suppresses this instead of removing it outright." },
  { name: "Despondent", official: false, desc: "No advantage on social ability checks, and no proficiency bonus on attack rolls or ability checks. Anything that grants advantage against being frightened, or immunity to charm, protects against this too; greater restoration ends it." },
  { name: "Dominated", official: false, desc: "A dominating creature takes total control: the dominated creature only takes actions the dominator allows." },
  { name: "Doomed", official: false, desc: "Disadvantage on death saving throws, and any healing die rolled for this creature uses its lowest possible result instead." },
  { name: "Dulled", official: false, desc: "Disadvantage on Intelligence, Wisdom and Charisma ability checks. Other creatures have advantage on saves of those three abilities against this creature's spells and effects." },
  { name: "Entombed", official: false, desc: "Encased in a solid substance with AC 15 and 100 hit points; speed 0 and no actions besides a Strength (Athletics) check, DC 15 or the source's spell save DC, to break free. Immune to all damage but psychic and whatever type matches the encasing material." },
  { name: "Euphoria", official: false, desc: "Pain feels like pleasure, and the creature can add 1d4 to any attack roll, saving throw, or ability check." },
  { name: "Exhaustion", official: true, desc: "Six cumulative levels, each adding to the last: 1 disadvantage on ability checks, 2 speed halved, 3 disadvantage on attack rolls and saves, 4 hit point maximum halved, 5 speed reduced to 0, 6 death. A long rest with food and drink removes one level." },
  { name: "Fatigued", official: false, desc: "-2 to attack rolls, ability checks and saves using the creature's lowest ability score; a repeat application stacks onto the next-lowest score, up to six times. Ending the condition clears every penalty at once." },
  { name: "Frightened", official: true, desc: "A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is in sight, and can't willingly move closer to it." },
  { name: "Frigid", official: false, desc: "Speed halved and no speed bonus applies; a second application in a row drops speed to 0 until the end of its next turn." },
  { name: "Frozen", official: false, desc: "Encased in ice with AC 15 and 100 hit points; speed 0, no actions but a Strength (Athletics) check, DC 15 or the source's spell save DC, to break free. Immune to all but cold and psychic damage; escaping also ends Restrained and lets it dig free at 4 ft of movement per 1 ft dug." },
  { name: "Grappled", official: true, desc: "A grappled creature's speed becomes 0 and it can't benefit from any speed bonus. Ends if the grappler is incapacitated, or the creature is removed from its reach." },
  { name: "Guilty", official: false, desc: "Vulnerable to damage from other creatures, can't willingly move away from the source of its guilt, and can't be restored to life if slain until it atones." },
  { name: "Hidden", official: false, desc: "Unseen and unheard; lost the moment an attack is made, hit or miss. Attack rolls against the creature have disadvantage, and its own attack rolls have advantage." },
  { name: "Incapacitated", official: true, desc: "An incapacitated creature can't take actions or reactions." },
  { name: "Infested", official: false, desc: "Disadvantage on Constitution saves and Wisdom (Perception) checks while a parasite is aboard, plus whatever unique effect that parasite's own description adds. Detected only by a skill check, treated like poison or disease by anything that cures those, and removed with an antiparasitic." },
  { name: "Intoxicated", official: false, desc: "A leveled condition, 1-4, usually from alcohol and a failed Constitution save: 1 disadvantage on Dexterity saves and checks, 2 can't concentrate plus disadvantage on Charisma checks, 3 falls and can't stand from prone (or speed halved if immune to prone), 4 unconscious for 8 hours. A long rest removes two levels." },
  { name: "Invisible", official: true, desc: "Impossible to see without magic or a special sense; the creature's location can still be given away by noise or tracks. Attack rolls against it have disadvantage, and its own attack rolls have advantage." },
  { name: "Marked", official: false, desc: "The creature that applied the mark gets a free opportunity attack with advantage against the marked creature, once per turn without spending a reaction, until the end of the marker's next turn -- unless something is already stopping the marker from taking reactions." },
  { name: "Paralyzed", official: true, desc: "Incapacitated, can't move or speak, and automatically fails Strength and Dexterity saves. Attack rolls against it have advantage, and any hit from within 5 feet is a critical hit." },
  { name: "Petrified", official: true, desc: "Transformed into solid stone or similar, including anything nonmagical it's wearing -- ten times its normal weight, and it stops aging. Incapacitated, can't move, speak or perceive; automatically fails Strength and Dexterity saves; resistant to all damage; immune to poison and disease, though an existing one is only suspended." },
  { name: "Poisoned", official: true, desc: "A poisoned creature has disadvantage on attack rolls and ability checks." },
  { name: "Possessed", official: false, desc: "Incapacitated, and control of its body passes to the possessing creature." },
  { name: "Prone", official: true, desc: "Can only crawl unless it stands, which ends the condition, and has disadvantage on attack rolls. An attacker within 5 feet has advantage against it; anyone farther away has disadvantage." },
  { name: "Relaxed", official: false, desc: "A leveled condition, 1-3, from rest and comfort: 1 current hit points and maximum both rise by the creature's Constitution score, 2 gains proficiency in a saving throw of its choice, 3 proficiency bonus +1. Exhaustion strips levels of this one-for-one." },
  { name: "Rested", official: false, desc: "Advantage on saves against disease and poison and on checks or saves to recover from injury, plus temporary hit points equal to half its Constitution score that survive a long rest. Ends when those temporary hit points run out; gaining it also ends Fatigued and removes one level of Exhaustion." },
  { name: "Restrained", official: true, desc: "Speed becomes 0 with no speed bonuses. Attack rolls against it have advantage, its own attack rolls have disadvantage, and it has disadvantage on Dexterity saves." },
  { name: "Scouted", official: false, desc: "Reveals its damage vulnerabilities, resistances, immunities and condition immunities to whoever scouted it." },
  { name: "Shocked", official: false, desc: "No reactions until the end of its next turn, and only an action or a bonus action on its turn, not both." },
  { name: "Stunned", official: true, desc: "Incapacitated, can't move, and can only speak falteringly. Automatically fails Strength and Dexterity saves, and attack rolls against it have advantage." },
  { name: "Unconscious", official: true, desc: "Incapacitated, can't move, speak or perceive its surroundings; drops anything held and falls prone. Automatically fails Strength and Dexterity saves; attack rolls against it have advantage, and any hit from within 5 feet is a critical hit." },
  { name: "Wounded", official: false, desc: "Also counts as Bloodied. -5 penalty on Dexterity, Strength and Constitution checks and saves. A long rest can only heal it up to its bloodied value, and it recovers half as many hit dice as normal." }
];

/* Which conditions bend a roll, and which rolls they touch. Only conditions on
   *this* character are modelled -- the many 5e rules keyed to the target's
   condition ("advantage against a prone creature") need a target, which the
   sheet has no concept of. A homebrew or non-SRD condition simply won't appear
   here, which is what the manual override on the roll window is for. */
const CONDITION_ROLL_EFFECTS = {
  Blinded:     [{ applies: "attack", mode: "disadvantage" }],
  Demoralized: [{ applies: "attack", mode: "disadvantage" }, { applies: "check", mode: "disadvantage" }],
  Frightened:  [{ applies: "attack", mode: "disadvantage" }, { applies: "check", mode: "disadvantage" }],
  Hidden:      [{ applies: "attack", mode: "advantage" }],
  Invisible:   [{ applies: "attack", mode: "advantage" }],
  Poisoned:    [{ applies: "attack", mode: "disadvantage" }, { applies: "check", mode: "disadvantage" }],
  Prone:       [{ applies: "attack", mode: "disadvantage" }],
  Restrained:  [{ applies: "attack", mode: "disadvantage" }, { applies: "save", ability: "DEX", mode: "disadvantage" }]
  // Exhaustion is handled separately, since which rolls it touches depends on
  // how many levels of it you have. Demoralized and Hidden are 3pp
  // conditions (see SRD_CONDITIONS) whose self-facing roll effects happen to
  // match this table's existing shape exactly -- Demoralized mirrors
  // Frightened/Poisoned, Hidden mirrors Invisible.
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
const EFFECT_CATEGORIES_GENERAL = ["Condition", "Ability Score", "Saving Throw", "Skill", "Bonus", "Advantage", "Reroll"];
const EFFECT_CATEGORIES_FEATURE = ["Ability Score", "Saving Throw", "Skill", "Bonus", "Advantage", "Reroll"];

// what a "Reroll" effect can apply to -- deliberately narrower than ROLL_TYPES.
// "d20" bundles attack rolls, ability checks and saving throws, since that's
// what a trait like Halfling Lucky actually covers; "damage" is separate
// because Great Weapon Fighting only ever touches weapon damage dice. There's
// no "all" here on purpose -- nothing in the SRD rerolls literally everything.
const REROLL_ROLL_TYPES = [
  { value: "d20", label: "Attack Rolls, Checks & Saves" },
  { value: "damage", label: "Damage Rolls" }
];

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

// the standard 5e language list. A character's actual known languages live on
// character.languages -- this is just what a "choose a language" prompt offers.
const SRD_LANGUAGES = [
  "Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc",
  "Abyssal", "Celestial", "Draconic", "Deep Speech", "Infernal", "Primordial", "Sylvan", "Undercommon"
];

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
      { level: 1, name: "Fighting Style", desc: "You adopt a particular style of fighting as your specialty.",
        choice: { kind: "fightingStyle", count: 1, prompt: "Choose a fighting style" } },
      { level: 1, name: "Second Wind", desc: "You can regain hit points as a bonus action once per short rest.",
        resource: { max: 1, recharge: { on: "SR", amount: "all" } } },
      { level: 2, name: "Action Surge", desc: "You can take one additional action on your turn, once per short rest.",
        resource: { max: 1, recharge: { on: "SR", amount: "all" } } }
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
      { level: 1, name: "Expertise", desc: "Double your proficiency bonus for two skills you're proficient in.",
        choice: { kind: "skill", count: 2, prompt: "Choose two skills you're proficient in for Expertise" } },
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
      { level: 2, name: "Channel Divinity", desc: "You can channel divine energy to fuel magical effects.",
        resource: { max: 1, recharge: { on: "SR", amount: "all" } } }
    ],
    skillChoices: { count: 2, options: ["History", "Insight", "Medicine", "Persuasion", "Religion"] },
    subclasses: [
      { name: "Life Domain", features: [{ level: 1, name: "Disciple of Life", desc: "Your healing spells restore additional hit points." }] },
      { name: "Light Domain", features: [{ level: 1, name: "Warding Flare", desc: "You can impose disadvantage on an attack roll against you." }] }
    ]
  }
];

/* Fighter's Fighting Style choice. Most of these are now real mechanics:

     - Defense, Archery: a flat, permanent numeric bonus -- exactly what the
       existing feature-effects mechanism already models (see the demo
       character's "Fighting Style: Defence" trait entry in character-data.js,
       which is this same shape hand-authored). These get an `effect`, and
       resolving the choice attaches it to the granted feature directly.
     - Dueling: also a Bonus effect, but calculateAttack() only honors it when
       the weapon actually qualifies (one-handed, melee, and no other weapon
       on the Attacks list) -- see qualifiesForDueling() in character-data.js.
       A generic effect object can't express that condition, so the gating
       lives at the point of use instead.
     - Great Weapon Fighting: a Reroll effect (reroll 1s and 2s on damage
       dice), honored by rerollThresholdFor()/showRoll().
     - Two-Weapon Fighting: no generic effect to attach -- what it does is add
       the ability modifier to off-hand damage, which is a suppression
       calculateAttack() applies by default and un-suppresses when this style
       is present (see hasFightingStyle()). `modeledElsewhere` says so, so
       resolving it doesn't get flagged as unmodeled.
     - Protection: a reaction spent on someone else's turn, against an
       attack roll this app never generates. It doesn't change anything on
       this sheet, and there's no ally sheet here for it to change either --
       mechanics are reserved for things that land on a sheet, so this one
       just gets recorded like any other feature, no disclaimer attached. */
const FIGHTING_STYLES = [
  { value: "Defense", label: "Defense", desc: "+1 AC while wearing armor.",
    effect: { category: "Bonus", value: { stat: "AC", amount: 1 } } },
  { value: "Dueling", label: "Dueling", desc: "+2 damage when wielding a one-handed melee weapon and no other weapon.",
    effect: { category: "Bonus", value: { stat: "Damage Rolls", amount: 2 } } },
  { value: "Archery", label: "Archery", desc: "+2 to attack rolls with ranged weapons.",
    effect: { category: "Bonus", value: { stat: "Attack Rolls", amount: 2 } } },
  { value: "Protection", label: "Protection", desc: "Use your reaction to impose disadvantage on an attack against a nearby ally.", effect: null, noMechanicNeeded: true },
  { value: "Great Weapon Fighting", label: "Great Weapon Fighting", desc: "Reroll 1s and 2s on weapon damage dice.",
    effect: { category: "Reroll", value: { rollType: "damage", threshold: 2 } } },
  { value: "Two-Weapon Fighting", label: "Two-Weapon Fighting", desc: "Add your ability modifier to off-hand damage.",
    effect: null, modeledElsewhere: true }
];

// the four `.choice` kinds pendingChoiceFor()/applyChoiceResolution()
// (rests.js / choices.js) know how to resolve. Custom content's feature
// editor (content.js) offers exactly this list -- a custom feature can only
// ask for a choice the app already knows how to grant.
const CHOICE_KINDS = [
  { value: "language", label: "Language" },
  { value: "skill", label: "Skill (Expertise)" },
  { value: "cantrip", label: "Cantrip" },
  { value: "fightingStyle", label: "Fighting Style" },
  { value: "custom", label: "Custom (author your own options)" }
];

// a small slice of the wizard cantrip list, enough for High Elf's Cantrip
// choice to offer something real rather than free text only
const SRD_CANTRIPS = [
  { name: "Fire Bolt", desc: "Ranged spell attack, 1d10 fire damage." },
  { name: "Mage Hand", desc: "A spectral hand that can carry up to 10 pounds." },
  { name: "Minor Illusion", desc: "Create a sound or an image, no larger than a 5-foot cube." },
  { name: "Prestidigitation", desc: "A handful of harmless minor magical effects." },
  { name: "Ray of Frost", desc: "Ranged spell attack, 1d8 cold damage and the target's speed is reduced by 10 feet." }
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

const ITEM_RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"];

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
  { name: "Crossbow, Light", official: true, cost: "25 gp", category: "Equipped", weight: 5, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "ranged", range: "80/320 ft", properties: ["Ammunition", "Loading", "Two-Handed"], ammunition: "Crossbow Bolts", damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }] },
  { name: "Dart", official: true, cost: "5 cp", category: "Equipped", weight: 0.25, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "ranged", range: "20/60 ft", properties: ["Finesse", "Thrown"], damage: [{ dice: "1d4", type: "Piercing", ability: "DEX" }] },
  { name: "Shortbow", official: true, cost: "25 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Simple", magicBonus: 0, weaponType: "ranged", range: "80/320 ft", properties: ["Ammunition", "Two-Handed"], ammunition: "Arrows", damage: [{ dice: "1d6", type: "Piercing", ability: "DEX" }] },
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
  { name: "Crossbow, Hand", official: true, cost: "75 gp", category: "Equipped", weight: 3, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "30/120 ft", properties: ["Ammunition", "Light", "Loading"], ammunition: "Crossbow Bolts", damage: [{ dice: "1d6", type: "Piercing", ability: "DEX" }] },
  { name: "Crossbow, Heavy", official: true, cost: "50 gp", category: "Equipped", weight: 18, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "100/400 ft", properties: ["Ammunition", "Heavy", "Loading", "Two-Handed"], ammunition: "Crossbow Bolts", damage: [{ dice: "1d10", type: "Piercing", ability: "DEX" }] },
  { name: "Longbow", official: true, cost: "50 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "150/600 ft", properties: ["Ammunition", "Heavy", "Two-Handed"], ammunition: "Arrows", damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }] },
  { name: "Net", official: true, cost: "1 gp", category: "Equipped", weight: 3, isWeapon: true, attackAbility: "STR", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "5/15 ft", properties: ["Special", "Thrown"], description: "No damage. A Large or smaller target that's hit is restrained until it or another creature spends an action on a DC 10 Strength check to free it, or someone deals 5 slashing damage to the net (AC 10).", damage: [] },
  { name: "Great Bow", official: false, cost: "100 gp", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX", proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "150/600 ft", properties: ["Ammunition", "Heavy", "Special", "Two-Handed"], ammunition: "Arrows", description: "Bonus action to steady yourself; while steadied (and not having moved), damage rises to 2d6 piercing.", damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }] }
];

const SRD_ARMOUR = [
  { name: "Padded", official: true, cost: "5 gp", category: "Worn", weight: 8, description: "Disadvantage on Stealth checks.", armour: { base: 11, kind: "light", dexCap: null } },
  { name: "Leather", official: true, cost: "10 gp", category: "Worn", weight: 10, armour: { base: 11, kind: "light", dexCap: null } },
  { name: "Studded Leather", official: true, cost: "45 gp", category: "Worn", weight: 13, armour: { base: 12, kind: "light", dexCap: null } },
  { name: "Hide", official: true, cost: "10 gp", category: "Worn", weight: 12, armour: { base: 12, kind: "medium", dexCap: 2 } },
  { name: "Chain Shirt", official: true, cost: "50 gp", category: "Worn", weight: 20, armour: { base: 13, kind: "medium", dexCap: 2 } },
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
  { name: "Arrows (20)", official: true, cost: "1 gp", category: "Carrying", weight: 1, qty: 20, resource: { max: 0, recharge: { on: "none", amount: "all" } } },
  { name: "Blowgun Needles (50)", official: true, cost: "1 gp", category: "Carrying", weight: 1, qty: 50, resource: { max: 0, recharge: { on: "none", amount: "all" } } },
  { name: "Crossbow Bolts (20)", official: true, cost: "1 gp", category: "Carrying", weight: 1.5, qty: 20, resource: { max: 0, recharge: { on: "none", amount: "all" } } },
  { name: "Sling Bullets (20)", official: true, cost: "4 cp", category: "Carrying", weight: 1.5, qty: 20, resource: { max: 0, recharge: { on: "none", amount: "all" } } },
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
  { name: "Sack", official: true, cost: "1 cp", category: "Carrying", weight: 0.5, description: "Holds 1 cubic foot or 30 lb of gear." },
  { name: "Scale, Merchant's", official: true, cost: "5 gp", category: "Carrying", weight: 3, description: "A small balance, pans and weights up to 2 lb, for measuring the exact weight of small objects." },
  { name: "Sealing Wax", official: true, cost: "5 sp", category: "Carrying", weight: 0 },
  { name: "Shovel", official: true, cost: "2 gp", category: "Carrying", weight: 5 },
  { name: "Signal Whistle", official: true, cost: "5 cp", category: "Carrying", weight: 0 },
  { name: "Signet Ring", official: true, cost: "5 gp", category: "Carrying", weight: 0, description: "Can serve as a holy symbol." },
  { name: "Soap", official: true, cost: "2 cp", category: "Carrying", weight: 0 },
  { name: "Spellbook", official: true, cost: "50 gp", category: "Carrying", weight: 3, description: "A leather-bound tome with 100 blank vellum pages for recording spells." },
  { name: "Spikes, Iron (10)", official: true, cost: "1 gp", category: "Carrying", weight: 5 },
  { name: "Spyglass", official: true, cost: "1,000 gp", category: "Carrying", weight: 1, description: "Magnifies viewed objects to twice their size." },
  { name: "Tent, Two-Person", official: true, cost: "2 gp", category: "Carrying", weight: 20 },
  { name: "Tinderbox", official: true, cost: "5 sp", category: "Carrying", weight: 1, description: "Flint, fire steel and tinder. Action to light a torch or similar; 1 minute for anything else." },
  { name: "Torch", official: true, cost: "1 cp", category: "Carrying", weight: 1, description: "Burns 1 hour: bright light in a 20-ft radius, dim light for 20 more feet. A melee hit with a burning torch deals 1 fire damage." },
  { name: "Vial", official: true, cost: "1 gp", category: "Carrying", weight: 0, description: "Holds 4 ounces liquid." },
  { name: "Waterskin", official: true, cost: "2 sp", category: "Carrying", weight: 5, description: "Holds 4 pints liquid." },
  { name: "Whetstone", official: true, cost: "1 cp", category: "Carrying", weight: 1 },
  { name: "Burglar's Pack", official: true, cost: "16 gp", category: "Carrying", weight: 0, description: "Backpack, 1,000 ball bearings, 10 ft of string, a bell, 5 candles, a crowbar, a hammer, 10 pitons, a hooded lantern, 2 flasks of oil, 5 days of rations, a tinderbox, a waterskin, and 50 feet of hempen rope strapped to the side." },
  { name: "Diplomat's Pack", official: true, cost: "39 gp", category: "Carrying", weight: 0, description: "Chest, 2 cases for maps and scrolls, fine clothes, a bottle of ink, an ink pen, a lamp, 2 flasks of oil, 5 sheets of paper, a vial of perfume, sealing wax and soap." },
  { name: "Dungeoneer's Pack", official: true, cost: "12 gp", category: "Carrying", weight: 0, description: "Backpack, a crowbar, a hammer, 10 pitons, 10 torches, a tinderbox, 10 days of rations, a waterskin, and 50 feet of hempen rope strapped to the side." },
  { name: "Entertainer's Pack", official: true, cost: "40 gp", category: "Carrying", weight: 0, description: "Backpack, a bedroll, 2 costumes, 5 candles, 5 days of rations, a waterskin, and a disguise kit." },
  { name: "Explorer's Pack", official: true, cost: "10 gp", category: "Carrying", weight: 0, description: "Backpack, a bedroll, a mess kit, a tinderbox, 10 torches, 10 days of rations, a waterskin, and 50 feet of hempen rope strapped to the side." },
  { name: "Priest's Pack", official: true, cost: "19 gp", category: "Carrying", weight: 0, description: "Backpack, a blanket, 10 candles, a tinderbox, an alms box, 2 blocks of incense, a censer, vestments, 2 days of rations, and a waterskin." },
  { name: "Scholar's Pack", official: true, cost: "40 gp", category: "Carrying", weight: 0, description: "Backpack, a book of lore, a bottle of ink, an ink pen, 10 sheets of parchment, a small bag of sand, and a small knife." }
];

/* Standalone features -- feats, not tied to a race, class, subclass or
   background. Same shape as any other feature (name/desc, optional
   effects/choice/resource), plus `prereq`: free text rather than modeled
   data, since prerequisites range from an ability score minimum to "must be
   a spellcaster" to nothing at all.

   The 5.1 SRD only released one feat as Open Game Content -- Grappler,
   marked `official: true` below, same tagging convention as SRD_CONDITIONS.
   Every other feat that could plausibly be built is 5esrd.com's own
   third-party database, which runs to 1,385 entries across dozens of
   publishers -- not a bounded list the way Conditions was. Rather than
   import that wholesale, the rest here is a curated set from "Fifth Edition
   Feats" (Total Party Kill Games, 2016): the one sourcebook in that database
   that reads as a generic, table-agnostic feat expansion rather than
   setting-specific splatbook content, so its feats are broadly useful
   regardless of campaign. More can be added the same way later.

   Mechanics: only bullets that map cleanly onto this app's existing effect
   categories got one -- a flat, unconditional bonus (Alertness, Blocking
   Expertise) or a real choice (Acrobatic's Strength-or-Dexterity pick, same
   pattern as a Fighting Style option). Bullets that are conditional on
   something the sheet has no concept of (a specific enemy type, "while you
   can hear but not see," negating a crit on a die roll) are recorded as
   text only, same standard as Protection in FIGHTING_STYLES -- forcing a
   generic effect onto a narrower rule would misrepresent it. Combat
   Reflexes is the clearest case: "advantage on opportunity attacks" is not
   the same as advantage on attack rolls generally, and the effect system
   has no way to scope it, so it stays text-only rather than overgrant. */
const SRD_FEATS = [
  { name: "Grappler", official: true, prereq: "Strength 13 or higher",
    desc: "You have advantage on attack rolls against a creature you are grappling. You can also use your action to try to pin a creature grappled by you -- make another grapple check, and on a success you're both restrained until the grapple ends." },
  { name: "Acrobatic", official: false, prereq: "Dexterity 13+, Acrobatics proficiency",
    desc: "Your Strength or Dexterity score (choose one) increases by 1. You gain expertise with Acrobatics, can stand from prone by spending only 5 feet of movement instead of half your speed, and once per short rest can gain advantage on a Dexterity-based skill check.",
    choice: { kind: "custom", count: 1, prompt: "Choose Strength or Dexterity to increase by 1",
      options: [
        { label: "Strength +1", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 1 } }] },
        { label: "Dexterity +1", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 1 } }] }
      ] } },
  { name: "Alertness", official: false, prereq: "Perception proficiency",
    desc: "You have a +2 bonus to initiative. You are never surprised unless stunned or unconscious, and enemies never gain advantage attacking you from stealth.",
    effects: [{ category: "Bonus", value: { stat: "Initiative", amount: 2 } }] },
  { name: "Athletic", official: false, prereq: "Strength and Constitution 13+, Athletics proficiency",
    desc: "You gain expertise with Athletics, can climb at your full speed instead of half, can make a running jump after moving only 5 feet instead of 10, and once per short rest can gain advantage on a Strength- or Constitution-based skill check." },
  { name: "Blind-Fight", official: false, prereq: "Wisdom 13+, Perception proficiency",
    desc: "As long as you can hear an opponent you can't see, it gets no advantage attacking you and you suffer no disadvantage attacking it. You can make a Perception check to locate an unseen target within 30 feet, at disadvantage beyond that." },
  { name: "Bodyguard", official: false, prereq: "Shield proficiency, Combat Reflexes",
    desc: "You can grant your shield's AC bonus to an adjacent ally instead of yourself. When an adjacent ally is attacked, you can use your reaction to impose disadvantage on the attack, or to redirect it to yourself instead." },
  { name: "Combat Reflexes", official: false, prereq: "Dexterity 13+",
    desc: "You can make a number of opportunity attacks per round equal to your Dexterity modifier (minimum 1), and you have advantage on all of them." },
  { name: "Blocking Expertise", official: false, prereq: "Shield proficiency",
    desc: "Your Strength score increases by 1. While wielding a shield, a critical hit against you has a 50% chance to be treated as a normal hit instead.",
    effects: [{ category: "Ability Score", value: { ability: "STR", amount: 1 } }] },
  { name: "Beast Slayer", official: false, prereq: "Wisdom 13+, Nature proficiency",
    desc: "You gain +1 to attack rolls against beasts and +1 AC against their attacks, your proficiency bonus applies to Survival checks made to track beasts, and your critical threat range against them increases by 1." }
];

/* Magic items reuse the mundane item shape (weapon / armour / gear) with two
   extra optional fields: `rarity` (one of ITEM_RARITIES) and `attunement`
   (boolean). Kept in its own table rather than folded into KIT_ITEMS because
   KIT_ITEMS is starting-equipment scaffolding for the creator, and nothing
   here is ever handed out at character creation. Empty until the pass over
   5esrd.com's magic item list. */
const SRD_MAGIC_ITEMS = [];
