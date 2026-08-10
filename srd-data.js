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

const SRD_RACES = [
  {
    name: "Human", subraces: null,
    features: [
      { name: "Ability Score Versatility", desc: "Humans adapt readily to any calling, gaining broad training over specialization." },
      { name: "Extra Language", desc: "You can speak, read, and write one additional language of your choice.",
        choice: { kind: "language", count: 1, prompt: "Choose an extra language" } }
    ],
    skillChoice: { count: 1, options: ALL_SKILL_NAMES }
  },
  {
    name: "Elf", subraces: [
      { name: "High Elf", features: [
        { name: "Elf Weapon Training", desc: "Proficiency with the longsword, shortsword, shortbow, and longbow." },
        { name: "Cantrip", desc: "You know one wizard cantrip of your choice.",
          choice: { kind: "cantrip", count: 1, prompt: "Choose a wizard cantrip" } }
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
      { name: "Lucky", desc: "When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die.",
        effects: [{ category: "Reroll", value: { rollType: "d20", threshold: 1 } }] },
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

/* Standalone features -- feats, not tied to a race, class, subclass or
   background. Same shape as any other feature (name/desc, optional
   effects/choice/resource), plus `prereq`: free text rather than modeled
   data, since prerequisites range from an ability score minimum to "must be
   a spellcaster" to nothing at all. Empty until the actual pass over
   5esrd.com's feat list (SRD and third-party alike). */
const SRD_FEATS = [];

/* Magic items reuse the mundane item shape (weapon / armour / gear) with two
   extra optional fields: `rarity` (one of ITEM_RARITIES) and `attunement`
   (boolean). Kept in its own table rather than folded into KIT_ITEMS because
   KIT_ITEMS is starting-equipment scaffolding for the creator, and nothing
   here is ever handed out at character creation. Empty until the pass over
   5esrd.com's magic item list. */
const SRD_MAGIC_ITEMS = [];
