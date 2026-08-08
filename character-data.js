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
  concentration: { active: false, spell: "", visible: true },

  hp: { current: 18, temp: 0 },
  baseMaxHP: 24,
  maxHpModifiers: [],

  activeEffects: [
    { id: 1, category: "Condition", value: { condition: "Prone" }, duration: { type: "Permanent", rounds: null }, note: "" }
  ],

  // tag can be "SR", "LR", "\u2014" (doesn't recharge), or any custom text.
  // spell slots deliberately do NOT live here -- see spellSlots below.
  resources: [
    { id: 3, name: "Action Surge", tag: "SR", current: 1, max: 1 },
    { id: 4, name: "Second Wind", tag: "LR", current: 2, max: 2 },
    { id: 5, name: "Arrows", tag: "\u2014", current: 20, max: 20 }
  ],

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
    {
      id: 3, name: "Longsword", category: "Equipped", weight: 3, qty: 1,
      isWeapon: true, isDefaultLoadout: true, damageDice: "1d8", attackAbility: "STR", damageAbility: "STR",
      proficientWithWeapon: true, magicBonus: 0,
      weaponType: "melee", range: "5 ft", properties: ["Versatile (1d10)"]
    },
    {
      id: 4, name: "Shortbow", category: "Equipped", weight: 2, qty: 1,
      isWeapon: true, isDefaultLoadout: true, damageDice: "1d6", attackAbility: "DEX", damageAbility: "DEX",
      proficientWithWeapon: true, magicBonus: 0,
      weaponType: "ranged", range: "80/320 ft", properties: ["Ammunition", "Two-Handed"]
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
  spellSlots: {
    1: { current: 3, max: 4 },
    2: { current: 2, max: 3 },
    3: { current: 1, max: 2 }
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
          all.push({ category: effect.category, value: effect.value, note: trait.name });
        });
      }
    });
  });
  return all;
}

function getAllEffects(character) {
  return character.activeEffects.concat(allFeatureEffects(character));
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
  return character.activeEffects.some(e => e.category === "Condition" && e.value.condition === conditionName);
}

function effectSourceLabel(effect) {
  return effect.note && effect.note.trim() ? effect.note : effect.category;
}

function effectSummaryLabel(effect) {
  if (effect.category === "Condition") return effect.value.condition;
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

function calculateSavingThrow(character, ability) {
  const override = character.savingThrowOverride[ability];
  if (override !== undefined && override !== null) {
    return { total: override, sources: [{ label: "Manual override", value: override }], overridden: true };
  }
  const sources = [];
  sources.push({ label: ABILITY_FULL_NAMES[ability] + " modifier", value: abilityModifier(effectiveAbilityScore(character, ability)) });
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
  const sources = [];
  sources.push({ label: ABILITY_FULL_NAMES[ability] + " modifier", value: abilityModifier(effectiveAbilityScore(character, ability)) });

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

function calculateAttack(character, weapon) {
  const toHitSources = [];
  toHitSources.push({
    label: ABILITY_FULL_NAMES[weapon.attackAbility] + " modifier",
    value: abilityModifier(effectiveAbilityScore(character, weapon.attackAbility))
  });
  if (weapon.proficientWithWeapon) toHitSources.push({ label: "Proficiency", value: calculateProficiencyBonus(character).total });
  if (weapon.magicBonus) toHitSources.push({ label: weapon.name + " (magic bonus)", value: weapon.magicBonus });

  equippedEffectItems(character).forEach(item => {
    if (item.attackBonus && item.id !== weapon.id) {
      toHitSources.push({ label: item.category + " \u2013 " + item.name, value: item.attackBonus });
    }
  });
  effectsAffectingStat(character, "Attack Rolls").forEach(e => toHitSources.push({ label: effectSourceLabel(e), value: e.value.amount }));

  const toHitTotal = toHitSources.reduce((sum, s) => sum + s.value, 0);

  const damageSources = [];
  damageSources.push({
    label: ABILITY_FULL_NAMES[weapon.damageAbility] + " modifier",
    value: abilityModifier(effectiveAbilityScore(character, weapon.damageAbility))
  });
  if (weapon.magicBonus) damageSources.push({ label: weapon.name + " (magic bonus)", value: weapon.magicBonus });
  effectsAffectingStat(character, "Damage Rolls").forEach(e => damageSources.push({ label: effectSourceLabel(e), value: e.value.amount }));

  const damageBonusTotal = damageSources.reduce((sum, s) => sum + s.value, 0);

  // custom source: user-typed label wins; otherwise pre-seeded weapons keep
  // their "Category – Name" label, anything newly added just says "Custom"
  const source = (weapon.customSource && weapon.customSource.trim())
    ? weapon.customSource
    : (weapon.isDefaultLoadout ? weapon.category + " \u2013 " + weapon.name : "Custom");

  return {
    source,
    toHitTotal, toHitSources,
    damageDice: weapon.damageDice,
    damageBonusTotal, damageSources
  };
}