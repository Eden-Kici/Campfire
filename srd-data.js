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

/* What each property actually does, so the picker can explain itself rather
   than assuming the player already knows. Kept as a separate map rather than
   folded into SRD_WEAPON_PROPERTIES because that list is consumed as plain
   strings in half a dozen places. SRD 5.1 text, condensed. */
const WEAPON_PROPERTY_INFO = {
  "Ammunition": "You can use a weapon with the ammunition property to make a ranged attack only if you have ammunition to fire from it. Drawing the ammunition is part of the attack. At the end of a battle you can recover half your expended ammunition by spending a minute searching the battlefield.",
  "Finesse": "When making an attack with a finesse weapon, you use your choice of your Strength or Dexterity modifier for the attack and damage rolls. You must use the same modifier for both.",
  "Heavy": "Small creatures have disadvantage on attack rolls with heavy weapons, because a heavy weapon's size and bulk make it too large for them to use effectively.",
  "Light": "A light weapon is small and easy to handle, making it ideal for use when fighting with two weapons.",
  "Loading": "Because of the time required to load this weapon, you can fire only one piece of ammunition from it when you use an action, bonus action or reaction to fire it, regardless of how many attacks you can normally make.",
  "Range": "A weapon that can be used to make a ranged attack has a range in parentheses \u2014 the normal range, then the long range. Attacking beyond the normal range gives you disadvantage; you can't attack past the long range.",
  "Reach": "This weapon adds 5 feet to your reach when you attack with it, and when determining your reach for opportunity attacks.",
  "Special": "A weapon with the special property has unusual rules governing its use, described in the weapon's own entry.",
  "Thrown": "If a weapon has the thrown property, you can throw it to make a ranged attack. You use the same ability modifier as you would for a melee attack with it.",
  "Two-Handed": "This weapon requires two hands when you attack with it.",
  "Versatile": "This weapon can be used with one or two hands. The damage in parentheses is the damage when it is used with two hands to make a melee attack."
};

const MODIFIER_STATS = ["AC", "Initiative", "Speed", "Attack Rolls", "Damage Rolls", "Healing", "Proficiency Bonus", "Spell Attack", "Spell DC"];
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

/* Backgrounds.

   Accuracy note: SRD 5.1 publishes exactly one background -- Acolyte. Soldier,
   Sage and Criminal are PHB content shaped to look like the rest of this table.
   They stay because the creator offers them and removing them would break a
   step, but they are not Open Game Content, so anything shipped for real needs
   them replaced or licensed. Marked `official` the same way SRD_CONDITIONS and
   SRD_FEATS mark theirs.

   `equipment` keys into KIT_ITEMS and `money` is the pouch of coin each
   background hands over. Nothing reads either yet -- buildStartingInventory()
   (creator.js) only walks STARTING_KIT -- so a created character still arrives
   with the class package alone. The data is here first because deciding what a
   background grants is the modelling question; wiring it into the wizard is the
   easy half. Same for `money` on a class kit below: there is no currency on the
   character object at all, which is the gap this records. */
const SRD_BACKGROUNDS = [
  { name: "Soldier", official: false, desc: "You had a military career, trained in combat and discipline.", skills: ["Athletics", "Intimidation"],
    feature: { name: "Military Rank", desc: "You have a military rank and command the respect of soldiers loyal to your former organization." },
    equipment: ["insignia", "trophy", "diceset", "commonclothes", "pouch"], money: { gp: 10 } },
  { name: "Sage", official: false, desc: "You spent years learning the lore of the multiverse.", skills: ["Arcana", "History"],
    feature: { name: "Researcher", desc: "You know how or where to find information, even if you don't know it yourself." },
    equipment: ["ink", "inkpen", "smallknife", "letter", "commonclothes", "pouch"], money: { gp: 10 } },
  { name: "Criminal", official: false, desc: "You have a history of breaking the law and living on its edges.", skills: ["Deception", "Stealth"],
    feature: { name: "Criminal Contact", desc: "You have a reliable contact in the criminal underworld." },
    equipment: ["crowbar", "darkclothes", "pouch"], money: { gp: 15 } },
  { name: "Acolyte", official: true, desc: "You've spent your life in service to a temple.", skills: ["Insight", "Religion"],
    feature: { name: "Shelter of the Faithful", desc: "You command the respect of those who share your faith and can perform religious ceremonies." },
    equipment: ["holysymbol", "prayerbook", "incense", "vestments", "commonclothes", "pouch"], money: { gp: 15 } }
];

/* Starting kit, as real items rather than a list of names -- each entry is
   spread straight into an inventory entry, so a bow arrives with its damage,
   its properties and a quiver already feeding it. The shapes here are the same
   ones the item editor produces.

   Each class offers a few either/or choices, matching how 5e hands out
   equipment. `gear` is granted regardless.

   Four things the SRD says that this shape cannot say, recorded rather than
   faked:

   - "any martial weapon" / "any simple weapon" is an open pick. Every option
     here names one representative and says so in its label: a longsword for
     a martial weapon, a quarterstaff for a simple one, and two shortswords
     where the SRD hands out two martial weapons -- two longswords would be
     legal and useless, since neither is Light enough to fight with in pairs.
     Expressing the real rule needs an option that opens the weapon catalogue
     rather than granting a fixed key.
   - "(if proficient)" qualifies the cleric's warhammer and chain mail. The
     kit is built before proficiencies are known, so both are offered flat.
   - A grant's quantity lives on the item template, not on the reference, so a
     bundle needs its own key: `javelins4` and `javelins5` are the same javelin
     handed out four at a time to a barbarian and five to a paladin. A real
     build wants `["javelin", 4]` and one template.
   - No class package includes coin -- `money` is absent from every kit below,
     which is correct. The SRD's alternative, rolling starting wealth by class
     (5d4 x 10 gp for a barbarian, and so on) and buying your own gear, is a
     different path through this screen entirely and isn't modelled. */
const STARTING_KIT = {
  Barbarian: {
    gear: ["explorer", "javelins4"],
    choices: [
      { prompt: "Weapon", options: [
        { label: "Greataxe", items: ["greataxe"] },
        { label: "Longsword (any martial melee weapon)", items: ["longsword"] }
      ] },
      { prompt: "Second weapon", options: [
        { label: "Two handaxes", items: ["handaxe", "handaxe"] },
        { label: "Quarterstaff (any simple weapon)", items: ["quarterstaff"] }
      ] }
    ]
  },
  Bard: {
    gear: ["leather", "dagger"],
    choices: [
      { prompt: "Weapon", options: [
        { label: "Rapier", items: ["rapier"] },
        { label: "Longsword", items: ["longsword"] },
        { label: "Quarterstaff (any simple weapon)", items: ["quarterstaff"] }
      ] },
      { prompt: "Pack", options: [
        { label: "Diplomat's pack", items: ["diplomat"] },
        { label: "Entertainer's pack", items: ["entertainer"] }
      ] },
      { prompt: "Instrument", options: [
        { label: "Lute", items: ["lute"] },
        { label: "Flute (any other musical instrument)", items: ["flute"] }
      ] }
    ]
  },
  Cleric: {
    gear: ["shield", "holysymbol"],
    choices: [
      { prompt: "Weapon", options: [
        { label: "Mace", items: ["mace"] },
        { label: "Warhammer", items: ["warhammer"] }
      ] },
      { prompt: "Armour", options: [
        { label: "Scale mail", items: ["scalemail"] },
        { label: "Leather armour", items: ["leather"] },
        { label: "Chain mail", items: ["chainmail"] }
      ] },
      { prompt: "Ranged", options: [
        { label: "Light crossbow and bolts", items: ["lightcrossbow", "bolts"] },
        { label: "Quarterstaff (any simple weapon)", items: ["quarterstaff"] }
      ] },
      { prompt: "Pack", options: [
        { label: "Priest's pack", items: ["priest"] },
        { label: "Explorer's pack", items: ["explorer"] }
      ] }
    ]
  },
  Druid: {
    gear: ["leather", "explorer", "druidicfocus"],
    choices: [
      { prompt: "Shield or weapon", options: [
        { label: "Wooden shield", items: ["shield"] },
        { label: "Quarterstaff (any simple weapon)", items: ["quarterstaff"] }
      ] },
      { prompt: "Weapon", options: [
        { label: "Scimitar", items: ["scimitar"] },
        { label: "Quarterstaff (any simple melee weapon)", items: ["quarterstaff"] }
      ] }
    ]
  },
  Fighter: {
    gear: [],
    choices: [
      { prompt: "Armour", options: [
        { label: "Chain mail", items: ["chainmail"] },
        { label: "Leather armour, longbow and arrows", items: ["leather", "longbow", "arrows"] }
      ] },
      { prompt: "Weapons", options: [
        { label: "Longsword and shield (any martial weapon)", items: ["longsword", "shield"] },
        { label: "Two shortswords (any two martial weapons)", items: ["shortsword", "shortsword"] }
      ] },
      { prompt: "Ranged", options: [
        { label: "Light crossbow and bolts", items: ["lightcrossbow", "bolts"] },
        { label: "Two handaxes", items: ["handaxe", "handaxe"] }
      ] },
      { prompt: "Pack", options: [
        { label: "Dungeoneer's pack", items: ["dungeoneer"] },
        { label: "Explorer's pack", items: ["explorer"] }
      ] }
    ]
  },
  Monk: {
    gear: ["darts10"],
    choices: [
      { prompt: "Weapon", options: [
        { label: "Shortsword", items: ["shortsword"] },
        { label: "Quarterstaff (any simple weapon)", items: ["quarterstaff"] }
      ] },
      { prompt: "Pack", options: [
        { label: "Dungeoneer's pack", items: ["dungeoneer"] },
        { label: "Explorer's pack", items: ["explorer"] }
      ] }
    ]
  },
  Paladin: {
    gear: ["chainmail", "holysymbol"],
    choices: [
      { prompt: "Weapons", options: [
        { label: "Longsword and shield (any martial weapon)", items: ["longsword", "shield"] },
        { label: "Two shortswords (any two martial weapons)", items: ["shortsword", "shortsword"] }
      ] },
      { prompt: "Thrown", options: [
        { label: "Five javelins", items: ["javelins5"] },
        { label: "Quarterstaff (any simple melee weapon)", items: ["quarterstaff"] }
      ] },
      { prompt: "Pack", options: [
        { label: "Priest's pack", items: ["priest"] },
        { label: "Explorer's pack", items: ["explorer"] }
      ] }
    ]
  },
  Ranger: {
    gear: ["longbow", "arrows", "quiver"],
    choices: [
      { prompt: "Armour", options: [
        { label: "Scale mail", items: ["scalemail"] },
        { label: "Leather armour", items: ["leather"] }
      ] },
      { prompt: "Weapons", options: [
        { label: "Two shortswords", items: ["shortsword", "shortsword"] },
        { label: "Two handaxes (any two simple melee weapons)", items: ["handaxe", "handaxe"] }
      ] },
      { prompt: "Pack", options: [
        { label: "Dungeoneer's pack", items: ["dungeoneer"] },
        { label: "Explorer's pack", items: ["explorer"] }
      ] }
    ]
  },
  Rogue: {
    gear: ["leather", "dagger", "dagger", "thievestools"],
    choices: [
      { prompt: "Main weapon", options: [
        { label: "Rapier", items: ["rapier"] },
        { label: "Shortsword", items: ["shortsword"] }
      ] },
      { prompt: "Ranged", options: [
        { label: "Shortbow, arrows and a quiver", items: ["shortbow", "arrows", "quiver"] },
        { label: "Shortsword", items: ["shortsword"] }
      ] },
      { prompt: "Pack", options: [
        { label: "Burglar's pack", items: ["burglar"] },
        { label: "Dungeoneer's pack", items: ["dungeoneer"] },
        { label: "Explorer's pack", items: ["explorer"] }
      ] }
    ]
  },
  Sorcerer: {
    gear: ["dagger", "dagger"],
    choices: [
      { prompt: "Weapon", options: [
        { label: "Light crossbow and bolts", items: ["lightcrossbow", "bolts"] },
        { label: "Quarterstaff (any simple weapon)", items: ["quarterstaff"] }
      ] },
      { prompt: "Spellcasting focus", options: [
        { label: "Component pouch", items: ["componentpouch"] },
        { label: "Arcane focus", items: ["arcanefocus"] }
      ] },
      { prompt: "Pack", options: [
        { label: "Dungeoneer's pack", items: ["dungeoneer"] },
        { label: "Explorer's pack", items: ["explorer"] }
      ] }
    ]
  },
  Warlock: {
    // the granted "any simple weapon" is a quarterstaff, so picking one again
    // below is a legal (if odd) SRD choice and lands as two separate rows
    gear: ["leather", "quarterstaff", "dagger", "dagger"],
    choices: [
      { prompt: "Weapon", options: [
        { label: "Light crossbow and bolts", items: ["lightcrossbow", "bolts"] },
        { label: "Quarterstaff (any simple weapon)", items: ["quarterstaff"] }
      ] },
      { prompt: "Spellcasting focus", options: [
        { label: "Component pouch", items: ["componentpouch"] },
        { label: "Arcane focus", items: ["arcanefocus"] }
      ] },
      { prompt: "Pack", options: [
        { label: "Scholar's pack", items: ["scholar"] },
        { label: "Dungeoneer's pack", items: ["dungeoneer"] }
      ] }
    ]
  },
  Wizard: {
    gear: ["spellbook"],
    choices: [
      { prompt: "Weapon", options: [
        { label: "Quarterstaff", items: ["quarterstaff"] },
        { label: "Dagger", items: ["dagger"] }
      ] },
      { prompt: "Spellcasting focus", options: [
        { label: "Component pouch", items: ["componentpouch"] },
        { label: "Arcane focus", items: ["arcanefocus"] }
      ] },
      { prompt: "Pack", options: [
        { label: "Scholar's pack", items: ["scholar"] },
        { label: "Explorer's pack", items: ["explorer"] }
      ] }
    ]
  }
};

/* The items the kits and backgrounds hand out. Names, weights, damage, AC and
   properties are the same values as the fuller catalogue in srd-equipment.js --
   the two tables had drifted (chain mail had lost its Strength requirement and
   Stealth note, the bows drew from "Quiver" where the catalogue says "Arrow",
   leather armour was "Leather Armour" here and "Leather" there), and a starting
   longsword that isn't the catalogue's longsword is a bug waiting to be found
   by a player.

   `desc` is the plain-language line for tapping an item open. Note that the
   inventory detail (tab-inventory.js) reads `description`, which is what
   srd-equipment.js and the item editor both write -- so a kit item's `desc`
   renders nowhere yet. One of the two names has to win before either surface
   can rely on it; duplicating the text into both would just be the same drift
   this table was fixed for.

   Two places where matching the catalogue exactly is worth knowing about:

   - Packs weigh 0, as they do in SRD_GEAR, which folds each pack's contents
     into text rather than into items. So a pack costs nothing to carry on the
     sheet, when an explorer's pack is really 59 lb of gear. Encumbrance can't
     be right until a pack is a container of real items; correcting it in one
     table only would put the two back out of step.
   - Ammunition weight is per unit here (an arrow is 0.05 lb) because `qty` is a
     stack count, where the catalogue prices a bundle of 20 at 1 lb. Same total,
     different unit.

   Rations are no longer granted loose: every SRD pack already contains days of
   rations, so the old flat 5 was a second helping on top of the pack's own. */
const KIT_ITEMS = {
  /* ---------- armour ---------- */
  chainmail:   { srd: "Chain Mail", name: "Chain Mail", category: "Worn", weight: 55, armour: { base: 16, kind: "heavy", dexCap: 0 },
                 description: "Heavy armour, AC 16. Requires Strength 13, or your speed drops by 10 feet. Disadvantage on Stealth checks." },
  scalemail:   { srd: "Scale Mail", name: "Scale Mail", category: "Worn", weight: 45, armour: { base: 14, kind: "medium", dexCap: 2 },
                 description: "Medium armour, AC 14 plus Dexterity (max +2). Disadvantage on Stealth checks." },
  leather:     { srd: "Leather", name: "Leather", category: "Worn", weight: 10, armour: { base: 11, kind: "light", dexCap: null },
                 description: "Light armour, AC 11 plus your full Dexterity modifier." },
  shield:      { srd: "Shield", name: "Shield", category: "Worn", weight: 6, armour: { base: 2, kind: "shield", dexCap: null },
                 description: "+2 AC while carried in one hand." },

  /* ---------- weapons ---------- */
  greataxe:    { srd: "Greataxe", name: "Greataxe", category: "Equipped", weight: 7, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Heavy", "Two-Handed"], damage: [{ dice: "1d12", type: "Slashing", ability: "STR" }],
                 description: "A two-handed axe. The hardest single hit on the martial table." },
  longsword:   { srd: "Longsword", name: "Longsword", category: "Equipped", weight: 3, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Versatile (1d10)"], damage: [{ dice: "1d8", type: "Slashing", ability: "STR" }],
                 description: "A straight blade for one hand, or 1d10 in two." },
  shortsword:  { srd: "Shortsword", name: "Shortsword", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Finesse", "Light"], damage: [{ dice: "1d6", type: "Piercing", ability: "DEX" }],
                 description: "A short stabbing blade. Light enough to pair with a second weapon." },
  rapier:      { srd: "Rapier", name: "Rapier", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Finesse"], damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }],
                 description: "A duelling blade that uses Dexterity rather than Strength." },
  scimitar:    { srd: "Scimitar", name: "Scimitar", category: "Equipped", weight: 3, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Finesse", "Light"], damage: [{ dice: "1d6", type: "Slashing", ability: "DEX" }],
                 description: "A curved single-edged sword, light and quick." },
  handaxe:     { srd: "Handaxe", name: "Handaxe", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Light", "Thrown (range 20/60)"], damage: [{ dice: "1d6", type: "Slashing", ability: "STR" }],
                 description: "A one-handed axe you can also throw up to 60 feet." },
  dagger:      { srd: "Dagger", name: "Dagger", category: "Equipped", weight: 1, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Finesse", "Light", "Thrown (range 20/60)"],
                 damage: [{ dice: "1d4", type: "Piercing", ability: "DEX" }],
                 description: "A small blade, thrown or held. Concealable and always useful." },
  mace:        { srd: "Mace", name: "Mace", category: "Equipped", weight: 4, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: [], damage: [{ dice: "1d6", type: "Bludgeoning", ability: "STR" }],
                 description: "A weighted club. Simple to use and hard on armour." },
  warhammer:   { srd: "Warhammer", name: "Warhammer", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Versatile (1d10)"], damage: [{ dice: "1d8", type: "Bludgeoning", ability: "STR" }],
                 description: "A heavy hammer for one hand, or 1d10 in two." },
  quarterstaff:{ srd: "Quarterstaff", name: "Quarterstaff", category: "Equipped", weight: 4, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Versatile (1d8)"], damage: [{ dice: "1d6", type: "Bludgeoning", ability: "STR" }],
                 description: "A stout wooden staff. 1d8 when held in both hands." },
  javelins4:   { srd: "Javelin", name: "Javelin", category: "Equipped", weight: 2, qty: 4, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Thrown (range 30/120)"], damage: [{ dice: "1d6", type: "Piercing", ability: "STR" }],
                 description: "Throwing spears, good to 120 feet." },
  javelins5:   { srd: "Javelin", name: "Javelin", category: "Equipped", weight: 2, qty: 5, isWeapon: true, attackAbility: "STR",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "melee", range: "5 ft",
                 properties: ["Thrown (range 30/120)"], damage: [{ dice: "1d6", type: "Piercing", ability: "STR" }],
                 description: "Throwing spears, good to 120 feet." },
  darts10:     { srd: "Dart", name: "Dart", category: "Equipped", weight: 0.25, qty: 10, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "ranged", range: "20/60 ft",
                 properties: ["Finesse", "Thrown"], damage: [{ dice: "1d4", type: "Piercing", ability: "DEX" }],
                 description: "A weighted throwing dart, thrown with Dexterity." },
  shortbow:    { srd: "Shortbow", name: "Shortbow", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "ranged", range: "80/320 ft",
                 properties: ["Ammunition", "Two-Handed"], ammunition: "Arrow",
                 damage: [{ dice: "1d6", type: "Piercing", ability: "DEX" }],
                 description: "A short two-handed bow. Spends an arrow per shot." },
  longbow:     { srd: "Longbow", name: "Longbow", category: "Equipped", weight: 2, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Martial", magicBonus: 0, weaponType: "ranged", range: "150/600 ft",
                 properties: ["Ammunition", "Heavy", "Two-Handed"], ammunition: "Arrow",
                 damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }],
                 description: "A tall two-handed bow reaching 600 feet. Spends an arrow per shot." },
  lightcrossbow:{ srd: "Crossbow, Light", name: "Crossbow, Light", category: "Equipped", weight: 5, isWeapon: true, attackAbility: "DEX",
                 proficiencyRequired: "Simple", magicBonus: 0, weaponType: "ranged", range: "80/320 ft",
                 properties: ["Ammunition", "Loading", "Two-Handed"], ammunition: "Crossbow Bolt",
                 damage: [{ dice: "1d8", type: "Piercing", ability: "DEX" }],
                 description: "A two-handed crossbow. One shot per action, however many attacks you have." },

  /* ---------- ammunition and its containers ---------- */
  /* The SRD grants 20 arrows, so 20 is what the stack holds -- the old kit gave
     40 loose plus a full quiver of 20 on top. The quiver arrives empty and the
     player's first Refill moves arrows into it; putting the 20 in both places
     is what produced 60 in the first place. */
  arrows:      { srd: "Arrow", name: "Arrow", category: "Carrying", weight: 0.05, qty: 20,
                 description: "Ammunition for a bow.",
                 resource: { max: 0, recharge: { on: "none", amount: "all" } } },
  bolts:       { srd: "Crossbow Bolt", name: "Crossbow Bolt", category: "Carrying", weight: 0.075, qty: 20,
                 description: "Ammunition for a crossbow.",
                 resource: { max: 0, recharge: { on: "none", amount: "all" } } },
  quiver:      { srd: "Quiver", name: "Quiver", category: "Worn", weight: 1,
                 description: "Holds up to 20 arrows within easy reach. Refill draws from your arrow stack.",
                 resource: { max: 20, loaded: 0, refillFrom: "Arrow", recharge: { on: "none", amount: "all" } } },

  /* ---------- equipment packs ---------- */
  burglar:     { srd: "Burglar's Pack", name: "Burglar's Pack", category: "Carrying", weight: 0,
                 description: "Backpack, 1,000 ball bearings, 10 ft of string, a bell, 5 candles, a crowbar, a hammer, 10 pitons, a hooded lantern, 2 flasks of oil, 5 days of rations, a tinderbox, a waterskin, and 50 feet of rope." },
  diplomat:    { srd: "Diplomat's Pack", name: "Diplomat's Pack", category: "Carrying", weight: 0,
                 description: "Chest, 2 map cases, fine clothes, ink, an ink pen, a lamp, 2 flasks of oil, 5 sheets of paper, perfume, sealing wax and soap." },
  dungeoneer:  { srd: "Dungeoneer's Pack", name: "Dungeoneer's Pack", category: "Carrying", weight: 0,
                 description: "Backpack, a crowbar, a hammer, 10 pitons, 10 torches, a tinderbox, 10 days of rations, a waterskin, and 50 feet of rope." },
  entertainer: { srd: "Entertainer's Pack", name: "Entertainer's Pack", category: "Carrying", weight: 0,
                 description: "Backpack, a bedroll, 2 costumes, 5 candles, 5 days of rations, a waterskin, and a disguise kit." },
  explorer:    { srd: "Explorer's Pack", name: "Explorer's Pack", category: "Carrying", weight: 0,
                 description: "Backpack, a bedroll, a mess kit, a tinderbox, 10 torches, 10 days of rations, a waterskin, and 50 feet of rope." },
  priest:      { srd: "Priest's Pack", name: "Priest's Pack", category: "Carrying", weight: 0,
                 description: "Backpack, a blanket, 10 candles, a tinderbox, an alms box, 2 blocks of incense, a censer, vestments, 2 days of rations, and a waterskin." },
  scholar:     { srd: "Scholar's Pack", name: "Scholar's Pack", category: "Carrying", weight: 0,
                 description: "Backpack, a book of lore, ink, an ink pen, 10 sheets of parchment, a bag of sand, and a small knife." },

  /* ---------- spellcasting focuses ---------- */
  componentpouch: { srd: "Component Pouch", name: "Component Pouch", category: "Carrying", weight: 2,
                 description: "A watertight belt pouch of material components. Covers any spell component without a stated cost." },
  arcanefocus: { srd: "Arcane Focus, Crystal", name: "Arcane Focus, Crystal", category: "Carrying", weight: 1,
                 description: "A spellcasting focus for sorcerer, warlock or wizard spells, used in place of components." },
  druidicfocus:{ srd: "Druidic Focus, Sprig of Mistletoe", name: "Druidic Focus, Sprig of Mistletoe", category: "Carrying", weight: 0,
                 description: "A spellcasting focus for druid spells, used in place of components." },
  holysymbol:  { srd: "Amulet", name: "Amulet", category: "Carrying", weight: 1,
                 description: "A holy symbol worn at the throat. A cleric or paladin casts through it in place of components." },

  /* ---------- tools, instruments and gear ---------- */
  thievestools:{ srd: "Thieves' Tools", name: "Thieves' Tools", category: "Carrying", weight: 1,
                 description: "Lock picks, a file, a small mirror, scissors and pliers. Proficiency adds your bonus to picking locks and disarming traps." },
  lute:        { srd: "Lute", name: "Lute", category: "Carrying", weight: 2, description: "A stringed instrument. Proficiency lets you add your bonus to performing with it." },
  flute:       { srd: "Flute", name: "Flute", category: "Carrying", weight: 1, description: "A wind instrument. Proficiency lets you add your bonus to performing with it." },
  spellbook:   { srd: "Spellbook", name: "Spellbook", category: "Carrying", weight: 3, description: "A leather-bound tome of 100 blank vellum pages. A wizard's spells live here, not in memory." },

  /* ---------- background items ----------
     The four backgrounds' gear. Weights follow srd-equipment.js where it has
     the item; vestments, incense, the small knife and the three keepsakes
     (letter, insignia, trophy) are background-only and have no catalogue
     entry to match, so they're recorded at their nearest sensible weight. */
  crowbar:     { srd: "Crowbar", name: "Crowbar", category: "Carrying", weight: 5, description: "Advantage on Strength checks where leverage applies." },
  commonclothes:{ srd: "Clothes, Common", name: "Clothes, Common", category: "Carrying", weight: 3, description: "An ordinary outfit -- what most people wear most days." },
  darkclothes: { srd: "Clothes, Common", name: "Clothes, Common (dark, hooded)", category: "Carrying", weight: 3, description: "Plain dark clothes with a hood, for not being looked at twice." },
  pouch:       { srd: "Pouch", name: "Pouch", category: "Carrying", weight: 1, description: "A belt pouch. Holds coin, sling bullets, or anything else small." },
  ink:         { srd: "Ink (1 ounce bottle)", name: "Ink (1 ounce bottle)", category: "Carrying", weight: 0, description: "A bottle of black ink." },
  inkpen:      { srd: "Ink Pen", name: "Ink Pen", category: "Carrying", weight: 0, description: "A quill cut for writing." },
  smallknife:  { name: "Knife, Small", category: "Carrying", weight: 0.5, description: "A small utility knife -- for sharpening quills and cutting pages, not for fighting." },
  letter:      { name: "Letter from a Dead Colleague", category: "Carrying", weight: 0, description: "A letter posing a question you have not yet been able to answer." },
  insignia:    { name: "Insignia of Rank", category: "Carrying", weight: 0, description: "The badge of the rank you held, recognised by anyone who served." },
  trophy:      { name: "Trophy from a Fallen Enemy", category: "Carrying", weight: 0, description: "A dagger, broken blade or piece of a banner taken from an enemy you beat." },
  diceset:     { srd: "Dice Set", name: "Dice Set", category: "Carrying", weight: 0, description: "Bone dice, for passing a watch." },
  prayerbook:  { name: "Prayer Book", category: "Carrying", weight: 5, description: "The prayers of your faith, written down. A prayer wheel serves the same purpose." },
  incense:     { name: "Incense", category: "Carrying", weight: 0, qty: 5, description: "A stick of incense, burned during a rite." },
  vestments:   { name: "Vestments", category: "Carrying", weight: 4, description: "The robes you wear to lead a ceremony." }
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

// the 8 schools of magic every SRD_SPELLS entry's `school` is drawn from --
// used by content-data.test.js to catch a typo the same way ITEM_RARITIES
// already does for magic items
const SPELL_SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];

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

