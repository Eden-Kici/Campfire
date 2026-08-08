/* ============================================================
   1. STORED DATA
   ============================================================ */

const character = {
  name: "Sigrid of Chester",
  classLine: "Fighter 5 / Rogue 2",

  profilePic: null, // data URL, or null for the placeholder
  alignment: "Chaotic Good",
  appearance: "Broad-shouldered, close-cropped grey hair, a long scar across one eyebrow.",
  personalityTraits: "Never backs down from a bar bet. Counts her blessings out loud, every one of them.",
  ideals: "Freedom. Chains are for cowards and kings.",
  bonds: "Owes her life to the militia that took her in after Chester burned.",
  flaws: "Can't resist a locked door, whether it's hers to open or not.",
  backstory: "Once a militia scout in Chester before the town was razed. Took up the blade professionally after, never quite settling down.",

  abilities: {
    STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8
  },

  proficiencyBonus: 3, // base value — calculateProficiencyBonus() adds effects on top
  baseSpeed: 30,

  inspiration: { current: 0, max: 1 },

  hp: { current: 18, temp: 0 },
  baseMaxHP: 24,
  maxHpModifiers: [],

  // hit dice are per class in 5e -- Fighter 5 / Rogue 2 means 5d10 + 2d8.
  // spent individually to heal (die + CON modifier); a long rest gives back
  // half your total, rounded down, minimum one.
  hitDice: [
    { die: "d10", total: 5, current: 4 },
    { die: "d8", total: 2, current: 2 }
  ],

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
        { category: "Bonus", value: { stat: "Attack Rolls", amount: 1 } },
        { category: "Saving Throw", value: { ability: "WIS", amount: 1 } }
      ]
    }
  ],

  // tag can be "SR", "LR", "\u2014" (doesn't recharge), or any custom text.
  // spell slots deliberately do NOT live here -- see spellSlots below.
  resources: [
    { id: 3, name: "Action Surge", tag: "SR", current: 1, max: 1 },
    { id: 4, name: "Second Wind", tag: "LR", current: 2, max: 2 },
    { id: 5, name: "Arrows", tag: "\u2014", current: 20, max: 20 }
  ],

  // Weapons declare what they need (proficiencyRequired); this is what the
  // character actually has. Proficiency on an attack is derived from the two,
  // with a per-weapon override -- the same shape as skills and saves.
  // NOTE: traits > Proficiencies > Weapons still says "Simple, martial" as
  // flavour text. That text is decorative and this list is authoritative; they
  // can drift. Armour and tool proficiencies have no model yet.
  weaponProficiencies: ["Simple", "Martial"],

  savingThrowProficiency: { STR: 1, DEX: 0, CON: 1, INT: 0, WIS: 0, CHA: 0 },
  // present only for a save that's been manually overridden; value replaces the calculated total
  savingThrowOverride: {},

  skillProficiency: {
    Athletics: 1, Insight: 1, Perception: 1, Stealth: 2, SleightOfHand: 2
  },
  // present only for a skill that's been manually overridden; value replaces the calculated total
  skillOverride: {},

  skillAbilityMap: {
    Athletics: "STR", Acrobatics: "DEX", SleightOfHand: "DEX", Stealth: "DEX",
    Arcana: "INT", History: "INT", Investigation: "INT", Nature: "INT", Religion: "INT",
    AnimalHandling: "WIS", Insight: "WIS", Medicine: "WIS", Perception: "WIS", Survival: "WIS",
    Deception: "CHA", Intimidation: "CHA", Performance: "CHA", Persuasion: "CHA"
  },

  // grouped under "Features & Traits". any entry can carry .effects (array,
  // can hold multiple), permanent as long as the feature exists.
  traits: {
    "Race Traits": [
      { name: "Darkvision", desc: "See in dim light within 60 ft as if bright light, and in darkness as if dim light." },
      { name: "Fey Ancestry", desc: "Advantage on saves against being charmed, and magic can't put you to sleep." }
    ],
    "Background Features": [
      { name: "Militia Veteran", desc: "You can requisition simple lodging and food from local militia posts." }
    ],
    "Feats": [
      {
        name: "Alert",
        desc: "Can't be surprised while conscious.",
        effects: [{ category: "Bonus", value: { stat: "Initiative", amount: 5 } }]
      }
    ],
    "Proficiencies": [
      { name: "Armor", desc: "Light, medium, heavy, shields" },
      { name: "Weapons", desc: "Simple, martial" },
      { name: "Tools", desc: "Thieves' tools" }
    ],
    "Languages": [
      { name: "Common", desc: "" },
      { name: "Elvish", desc: "" }
    ]
  },

  // customSource overrides the default "Category – Name" attack source label.
  // isDefaultLoadout marks the pre-seeded weapons so they keep that default
  // label; attacks added later via the UI default to "Custom" instead.
  inventory: [
    { id: 1, name: "Chain Shirt", category: "Worn", weight: 20, qty: 1, acBonus: 3 },
    { id: 2, name: "Cloak of Protection", category: "Worn", weight: 1, qty: 1, acBonus: 1 },
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
      weaponType: "ranged", range: "80/320 ft", properties: ["Ammunition", "Two-Handed"]
    },
    {
      id: 8, name: "Serpent's Fang", category: "Equipped", weight: 1, qty: 1,
      isWeapon: true, isDefaultLoadout: true, attackAbility: "DEX",
      proficiencyRequired: "Exotic", magicBonus: 1,
      damage: [
        { dice: "1d4", type: "Piercing", ability: "DEX" },
        { dice: "1d6", type: "Poison" }
      ],
      weaponType: "melee", range: "5 ft", properties: ["Finesse", "Light"]
    },
    { id: 5, name: "Ring of Precision", category: "Worn", weight: 0, qty: 1, attackBonus: 1 },
    { id: 6, name: "Bag of Holding", category: "Carrying", weight: 15, qty: 1 },
    { id: 7, name: "Spare Chainmail", category: "Camp Storage", weight: 55, qty: 1 }
  ],

  categoryRules: {
    Worn: { countsWeight: true, appliesEffects: true },
    Equipped: { countsWeight: true, appliesEffects: true },
    Carrying: { countsWeight: true, appliesEffects: false },
    "Camp Storage": { countsWeight: false, appliesEffects: false }
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
  spellSlots: {
    1: { current: 3, max: 4, recharge: "LR" },
    2: { current: 2, max: 3, recharge: "LR" },
    3: { current: 1, max: 2, recharge: "LR" }
  },

  // maxPreparedByClass is also a raw ingredient (not calculated from level/ability)
  // until the class/level model is built out further.
  maxPreparedByClass: { Wizard: 4, Cleric: 2 },

  // level 0 = cantrip. prepared is only meaningful for level > 0 (cantrips are
  // always available). attackRoll marks spells that roll to-hit using the
  // casting class's spell attack bonus.
  spells: [
    { id: 1, name: "Fire Bolt", level: 0, classSource: "Wizard", castingTime: "A", attackRoll: true, desc: "Ranged spell attack. 1d10 fire damage." },
    { id: 2, name: "Guidance", level: 0, classSource: "Cleric", castingTime: "A", attackRoll: false, desc: "Target adds 1d4 to one ability check of their choice." },
    { id: 3, name: "Shield", level: 1, classSource: "Wizard", castingTime: "R", attackRoll: false, prepared: true, desc: "+5 AC until the start of your next turn, including against the triggering attack." },
    { id: 4, name: "Magic Missile", level: 1, classSource: "Wizard", castingTime: "A", attackRoll: false, prepared: false, desc: "3 darts, 1d4+1 force damage each, automatically hit." },
    { id: 5, name: "Cure Wounds", level: 1, classSource: "Cleric", castingTime: "A", attackRoll: false, prepared: false, desc: "Heal 1d8 + spellcasting ability modifier." }
  ],

  // mock party roster for the sharing UI -- no real accounts/network yet
  partyMembers: ["Aldric (GM)", "Mira Stonehallow", "Tomas Blackwell", "Wren Ashby"],

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
      sharing: { sharedByMe: false, sharedByName: "Aldric (GM)", continuous: true, permission: "view" }
    },
    {
      id: 2, sectionId: 1, title: "Party gold split",
      body: "412 gold total, split 4 ways after the goblin camp haul. Everyone's owed 103.",
      createdAt: Date.now() - 1000 * 60 * 60 * 5, updatedAt: Date.now() - 1000 * 60 * 60 * 5,
      sharing: {
        sharedByMe: true, continuous: true,
        sharedWith: [
          { name: "Mira Stonehallow", permission: "edit" },
          { name: "Tomas Blackwell", permission: "view" },
          { name: "Wren Ashby", permission: "view" }
        ]
      }
    },
    {
      id: 3, sectionId: 2, title: "Suspicious innkeeper",
      body: "Keeps glancing at the door. Might be watching for someone.",
      createdAt: Date.now() - 1000 * 60 * 30, updatedAt: Date.now() - 1000 * 60 * 30,
      sharing: null
    }
  ]
};


/* ============================================================
   2. HELPERS
   ============================================================ */

const ABILITY_FULL_NAMES = {
  STR: "Strength", DEX: "Dexterity", CON: "Constitution",
  INT: "Intelligence", WIS: "Wisdom", CHA: "Charisma"
};

function formatModifier(number) {
  return number >= 0 ? "+" + number : "" + number;
}

function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

function equippedEffectItems(character) {
  return character.inventory.filter(item => {
    const rule = character.categoryRules[item.category];
    return rule && rule.appliesEffects;
  });
}

function weaponList(character) {
  return character.inventory.filter(item => item.isWeapon);
}

function allFeatureEffects(character) {
  let all = [];
  Object.keys(character.traits).forEach(category => {
    character.traits[category].forEach(trait => {
      if (trait.effects) {
        trait.effects.forEach(effect => {
          all.push({ category: effect.category, value: effect.value, source: trait.name });
        });
      }
    });
  });
  return all;
}

// A group's display name is what shows on its chip and what labels its
// contribution in every stat breakdown. Falls back to describing the first
// modifier so an unnamed group is never blank.
function effectGroupLabel(group) {
  if (group.name && group.name.trim()) return group.name.trim();
  const first = (group.effects || [])[0];
  return first ? effectSummaryLabel(first) : "Effect";
}

// Flattens groups into the { category, value, source } shape the calculation
// layer expects, tagging each modifier with the name of whatever caused it.
// `source` here is the causing group's name, distinct from group.note, which
// is the player's own free-text remark about the effect.
function activeEffectModifiers(character) {
  const modifiers = [];
  character.activeEffects.forEach(group => {
    (group.effects || []).forEach(effect => {
      modifiers.push({ category: effect.category, value: effect.value, source: effectGroupLabel(group) });
    });
  });
  return modifiers;
}

function getAllEffects(character) {
  return activeEffectModifiers(character).concat(allFeatureEffects(character));
}

function concentrationGroups(character) {
  return character.activeEffects.filter(group => group.concentration);
}

function effectsAffectingAbility(character, ability) {
  return getAllEffects(character).filter(e => e.category === "Ability Score" && e.value.ability === ability);
}

function effectiveAbilityScore(character, ability) {
  let score = character.abilities[ability];
  effectsAffectingAbility(character, ability).forEach(e => { score += e.value.amount; });
  return score;
}

function effectsAffectingSavingThrow(character, ability) {
  return getAllEffects(character).filter(e => e.category === "Saving Throw" && e.value.ability === ability);
}

function effectsAffectingSkill(character, skillName) {
  return getAllEffects(character).filter(e => e.category === "Skill" && e.value.skill === skillName);
}

function effectsAffectingStat(character, statName) {
  return getAllEffects(character).filter(e => e.category === "Bonus" && e.value.stat === statName);
}

function hasCondition(character, conditionName) {
  return character.activeEffects.some(group =>
    (group.effects || []).some(e => e.category === "Condition" && e.value.condition === conditionName));
}

function effectSourceLabel(effect) {
  return effect.source && effect.source.trim() ? effect.source : effect.category;
}

function rollTypeLabel(rollType) {
  const match = ROLL_TYPES.find(t => t.value === rollType);
  return match ? match.label : rollType;
}

function advantageLabel(effect) {
  const mode = effect.value.mode === "disadvantage" ? "Disadvantage" : "Advantage";
  return mode + " on " + rollTypeLabel(effect.value.rollType);
}

function effectSummaryLabel(effect) {
  if (effect.category === "Condition") return effect.value.condition;
  if (effect.category === "Advantage") return advantageLabel(effect);
  if (effect.category === "Ability Score") return formatModifier(effect.value.amount) + " " + effect.value.ability;
  if (effect.category === "Saving Throw") return formatModifier(effect.value.amount) + " " + effect.value.ability + " Save";
  if (effect.category === "Skill") return formatModifier(effect.value.amount) + " " + effect.value.skill;
  if (effect.category === "Bonus") return formatModifier(effect.value.amount) + " " + effect.value.stat;
  return effect.category;
}

function durationLabel(effect) {
  const d = effect.duration;
  if (d.type === "Rounds") return d.rounds + " round" + (d.rounds === 1 ? "" : "s");
  if (d.type === "Short Rest") return "Until short rest";
  if (d.type === "Long Rest") return "Until long rest";
  return "Permanent";
}

function featureEffectSummary(effect) {
  if (effect.category === "Advantage") return advantageLabel(effect);
  if (effect.category === "Ability Score") return formatModifier(effect.value.amount) + " " + effect.value.ability;
  if (effect.category === "Saving Throw") return formatModifier(effect.value.amount) + " " + effect.value.ability + " Save";
  if (effect.category === "Skill") return formatModifier(effect.value.amount) + " " + effect.value.skill;
  if (effect.category === "Bonus") return formatModifier(effect.value.amount) + " " + effect.value.stat;
  return "";
}


/* ============================================================
   3. CALCULATED STATS
   ============================================================ */

// proficiency bonus is now calculated too, so an item/condition that
// boosts it (rare, but possible) flows into every save/skill/attack
// that uses it, automatically.
function calculateProficiencyBonus(character) {
  const sources = [{ label: "Base", value: character.proficiencyBonus }];
  effectsAffectingStat(character, "Proficiency Bonus").forEach(e => sources.push({ label: effectSourceLabel(e), value: e.value.amount }));
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources };
}

function calculateAC(character) {
  const sources = [];
  sources.push({ label: "Base", value: 10 });
  sources.push({ label: ABILITY_FULL_NAMES.DEX + " modifier", value: abilityModifier(effectiveAbilityScore(character, "DEX")) });

  equippedEffectItems(character).forEach(item => {
    if (item.acBonus) sources.push({ label: item.category + " \u2013 " + item.name, value: item.acBonus });
  });
  effectsAffectingStat(character, "AC").forEach(e => sources.push({ label: effectSourceLabel(e), value: e.value.amount }));

  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources };
}

function calculateMaxHP(character) {
  const sources = [{ label: "Base", value: character.baseMaxHP }];
  character.maxHpModifiers.forEach(m => sources.push(m));
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources };
}

function calculateInitiative(character) {
  const sources = [];
  sources.push({ label: ABILITY_FULL_NAMES.DEX + " modifier", value: abilityModifier(effectiveAbilityScore(character, "DEX")) });
  effectsAffectingStat(character, "Initiative").forEach(e => sources.push({ label: effectSourceLabel(e), value: e.value.amount }));
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources };
}

function calculateSpeed(character) {
  const sources = [{ label: "Base speed", value: character.baseSpeed }];
  if (hasCondition(character, "Restrained") || hasCondition(character, "Grappled")) {
    sources.push({ label: "Restrained/Grappled", value: -character.baseSpeed });
  }
  effectsAffectingStat(character, "Speed").forEach(e => sources.push({ label: effectSourceLabel(e), value: e.value.amount }));
  const total = Math.max(0, sources.reduce((sum, s) => sum + s.value, 0));
  return { total, sources };
}

// An ability check is just the modifier, but the modifier moves in steps of one
// per two points of score, so effects can't be shown as flat addends. Each
// source reports the change it actually made to the modifier, which telescopes
// to the right total.
function calculateAbilityCheck(character, ability) {
  const baseScore = character.abilities[ability];
  const sources = [{ label: ABILITY_FULL_NAMES[ability] + " (base " + baseScore + ")", value: abilityModifier(baseScore) }];

  let runningScore = baseScore;
  effectsAffectingAbility(character, ability).forEach(effect => {
    const before = abilityModifier(runningScore);
    runningScore += effect.value.amount;
    sources.push({
      label: effectSourceLabel(effect) + " (" + formatModifier(effect.value.amount) + " score)",
      value: abilityModifier(runningScore) - before
    });
  });

  return { total: abilityModifier(runningScore), sources, score: runningScore };
}

function calculateSavingThrow(character, ability) {
  const override = character.savingThrowOverride[ability];
  if (override !== undefined && override !== null) {
    return { total: override, sources: [{ label: "Manual override", value: override }], overridden: true };
  }
  // borrow the ability check's decomposition so a buff that raised the score
  // shows up as its own line instead of disappearing into "Strength modifier"
  const sources = calculateAbilityCheck(character, ability).sources.slice();
  if (character.savingThrowProficiency[ability]) {
    sources.push({ label: "Proficiency", value: calculateProficiencyBonus(character).total });
  }
  effectsAffectingSavingThrow(character, ability).forEach(e => sources.push({ label: effectSourceLabel(e), value: e.value.amount }));
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources, overridden: false };
}

function calculateSkill(character, skillName) {
  const override = character.skillOverride[skillName];
  if (override !== undefined && override !== null) {
    return { total: override, sources: [{ label: "Manual override", value: override }], overridden: true };
  }
  const ability = character.skillAbilityMap[skillName];
  const sources = calculateAbilityCheck(character, ability).sources.slice();

  const profLevel = character.skillProficiency[skillName] || 0;
  const profBonus = calculateProficiencyBonus(character).total;
  if (profLevel === 1) sources.push({ label: "Proficiency", value: profBonus });
  else if (profLevel === 2) sources.push({ label: "Expertise", value: profBonus * 2 });

  effectsAffectingSkill(character, skillName).forEach(e => sources.push({ label: effectSourceLabel(e), value: e.value.amount }));
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources, overridden: false };
}

function calculatePassivePerception(character) {
  const perception = calculateSkill(character, "Perception");
  const sources = [{ label: "Base", value: 10 }].concat(perception.sources);
  const total = 10 + perception.total;
  return { total, sources };
}

function calculateCarriedWeight(character) {
  const sources = [];
  character.inventory.forEach(item => {
    const rule = character.categoryRules[item.category];
    if (rule && rule.countsWeight) sources.push({ label: item.name, value: item.weight * (item.qty || 1) });
  });
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources };
}

function calculateSpellAttack(character, ability) {
  const sources = [];
  sources.push({ label: "Proficiency Bonus", value: calculateProficiencyBonus(character).total });
  sources.push({ label: ABILITY_FULL_NAMES[ability] + " Modifier", value: abilityModifier(effectiveAbilityScore(character, ability)) });
  effectsAffectingStat(character, "Spell Attack").forEach(e => sources.push({ label: effectSourceLabel(e), value: e.value.amount }));
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources };
}

function calculateSpellDC(character, ability) {
  const sources = [{ label: "Base", value: 8 }];
  sources.push({ label: "Proficiency Bonus", value: calculateProficiencyBonus(character).total });
  sources.push({ label: ABILITY_FULL_NAMES[ability] + " Modifier", value: abilityModifier(effectiveAbilityScore(character, ability)) });
  effectsAffectingStat(character, "Spell DC").forEach(e => sources.push({ label: effectSourceLabel(e), value: e.value.amount }));
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources };
}

function calculatePreparedSpellCount(character) {
  const count = character.spells.filter(s => s.level > 0 && s.prepared).length;
  const max = Object.values(character.maxPreparedByClass).reduce((sum, v) => sum + v, 0);
  return { count, max };
}

// Proficiency with a weapon is derived from what the weapon requires against
// what the character actually has, with an explicit per-weapon override --
// the same derived-plus-override shape as skills and saving throws. A weapon
// that requires nothing is always proficient.
function weaponProficiency(character, weapon) {
  const required = (weapon.proficiencyRequired || "").trim();
  if (weapon.proficientOverride !== undefined && weapon.proficientOverride !== null) {
    return { proficient: !!weapon.proficientOverride, overridden: true, required };
  }
  if (!required) return { proficient: true, overridden: false, required: "" };
  const held = character.weaponProficiencies || [];
  return {
    proficient: held.some(p => p.toLowerCase() === required.toLowerCase()),
    overridden: false,
    required
  };
}

function calculateAttack(character, weapon) {
  const proficiency = weaponProficiency(character, weapon);

  const toHitSources = [];
  toHitSources.push({
    label: ABILITY_FULL_NAMES[weapon.attackAbility] + " modifier",
    value: abilityModifier(effectiveAbilityScore(character, weapon.attackAbility))
  });
  if (proficiency.proficient) {
    toHitSources.push({
      label: "Proficiency" + (proficiency.required ? " (" + proficiency.required + ")" : ""),
      value: calculateProficiencyBonus(character).total
    });
  }
  if (weapon.magicBonus) toHitSources.push({ label: weapon.name + " (magic bonus)", value: weapon.magicBonus });

  equippedEffectItems(character).forEach(item => {
    if (item.attackBonus && item.id !== weapon.id) {
      toHitSources.push({ label: item.category + " \u2013 " + item.name, value: item.attackBonus });
    }
  });
  effectsAffectingStat(character, "Attack Rolls").forEach(e => toHitSources.push({ label: effectSourceLabel(e), value: e.value.amount }));

  const toHitTotal = toHitSources.reduce((sum, s) => sum + s.value, 0);

  /* A magic bonus and any blanket "Damage Rolls" effect apply once per attack,
     not once per damage type, so they land on the first part only. A part adds
     an ability modifier only if it names one -- rider dice like poison or sneak
     attack normally don't get it. */
  const onceOnly = [];
  if (weapon.magicBonus) onceOnly.push({ label: weapon.name + " (magic bonus)", value: weapon.magicBonus });
  effectsAffectingStat(character, "Damage Rolls").forEach(e => onceOnly.push({ label: effectSourceLabel(e), value: e.value.amount }));

  const damage = (weapon.damage || []).map((part, index) => {
    const sources = [];
    if (part.ability) {
      sources.push({
        label: ABILITY_FULL_NAMES[part.ability] + " modifier",
        value: abilityModifier(effectiveAbilityScore(character, part.ability))
      });
    }
    if (index === 0) onceOnly.forEach(s => sources.push(s));
    const bonusTotal = sources.reduce((sum, s) => sum + s.value, 0);
    return {
      dice: part.dice,
      type: part.type || "",
      bonusTotal,
      sources,
      notation: part.dice + (bonusTotal ? formatModifier(bonusTotal) : "")
    };
  });

  // custom source: user-typed label wins; otherwise pre-seeded weapons keep
  // their "Category – Name" label, anything newly added just says "Custom"
  const source = (weapon.customSource && weapon.customSource.trim())
    ? weapon.customSource
    : (weapon.isDefaultLoadout ? weapon.category + " \u2013 " + weapon.name : "Custom");

  return {
    source, proficiency,
    toHitTotal, toHitSources,
    damage,
    damageNotation: damage.map(d => d.notation).join(" + ") || "—"
  };
}