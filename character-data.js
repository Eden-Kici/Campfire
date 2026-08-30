/* ============================================================
   1. STORED DATA
   ============================================================ */

/* Which ability each skill keys off. Held per character so a homebrew game can
   rekey one, but every character starts from this. Copy it rather than sharing
   the object, or two characters end up editing the same map. */
const SKILL_ABILITY_MAP = {
  Athletics: "STR", Acrobatics: "DEX", SleightOfHand: "DEX", Stealth: "DEX",
  Arcana: "INT", History: "INT", Investigation: "INT", Nature: "INT", Religion: "INT",
  AnimalHandling: "WIS", Insight: "WIS", Medicine: "WIS", Perception: "WIS", Survival: "WIS",
  Deception: "CHA", Intimidation: "CHA", Performance: "CHA", Persuasion: "CHA"
};



/* ============================================================
   2. HELPERS
   ============================================================ */

const ABILITY_FULL_NAMES = {
  STR: "Strength", DEX: "Dexterity", CON: "Constitution",
  INT: "Intelligence", WIS: "Wisdom", CHA: "Charisma"
};

/* Every view in this app is built by interpolating into template literals and
   assigning innerHTML, so any user-authored text has to be escaped on the way
   in. Without it a name containing a quote truncates the input it is rendered
   into -- value="Sword "Widowmaker"" parses as value="Sword " -- and saving
   then writes the truncated name back. Angle brackets are worse.

   The proper fix is to stop building markup from strings; this is the fix that
   fits the current architecture. */
/* Exhaustion is the one condition with degrees, and each level adds to the one
   below it. It's stored as a level on the effect's value rather than as six
   separate conditions, so a long rest can step it down and the penalties can
   be derived rather than hand-applied. */
const EXHAUSTION_LEVELS = [
  { level: 1, effect: "Disadvantage on ability checks" },
  { level: 2, effect: "Speed halved" },
  { level: 3, effect: "Disadvantage on attack rolls and saving throws" },
  { level: 4, effect: "Hit point maximum halved" },
  { level: 5, effect: "Speed reduced to 0" },
  { level: 6, effect: "Death" }
];

function exhaustionLevel(character) {
  let highest = 0;
  character.activeEffects.forEach(group => {
    (group.effects || []).forEach(effect => {
      if (effect.category !== "Condition") return;
      if (String(effect.value.condition).toLowerCase() !== "exhaustion") return;
      highest = Math.max(highest, effect.value.level || 1);
    });
  });
  return Math.min(6, highest);
}

function exhaustionEffects(level) {
  return EXHAUSTION_LEVELS.filter(tier => tier.level <= level);
}

function setExhaustionLevel(character, level) {
  const clamped = Math.max(0, Math.min(6, level));
  character.activeEffects = character.activeEffects.filter(group =>
    !(group.effects || []).some(e =>
      e.category === "Condition" && String(e.value.condition).toLowerCase() === "exhaustion"));

  if (clamped === 0) return;
  const nextId = makeId(character.activeEffects);
  character.activeEffects.push({
    id: nextId,
    name: "Exhaustion " + clamped,
    concentration: false,
    duration: { type: "Permanent", rounds: null },
    effects: [{ category: "Condition", value: { condition: "Exhaustion", level: clamped } }]
  });
}

// short tag shown next to a resource: "SR", "LR", "½ LR", "1d4 SR", "—"
function rechargeLabel(recharge) {
  if (!recharge || !recharge.on || recharge.on === "none") return "—";
  const amount = recharge.amount === undefined ? "all" : recharge.amount;
  if (amount === "all") return recharge.on;
  if (amount === "half") return "½ " + recharge.on;
  return amount + " " + recharge.on;
}

function esc(text) {
  return String(text === null || text === undefined ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

// a weapon only appears under Attacks while it sits in a category that
// provides them -- stowing it in Carrying takes it off the list
function weaponList(character) {
  return character.inventory.filter(item => {
    if (!item.isWeapon) return false;
    const rule = character.categoryRules[item.category];
    return !!(rule && rule.providesAttacks);
  });
}

// Dueling reads "while you are wielding a melee weapon in one hand and no
// other weapons" -- not just "your off hand is empty," but genuinely no
// other weapon on the Attacks list. A generic Bonus effect can't express
// that condition, so it's checked here rather than baked into the effect.
function qualifiesForDueling(character, weapon) {
  if (weapon.weaponType !== "melee" || weapon.twoHanded || weapon.offHand) return false;
  return weaponList(character).every(w => w.id === weapon.id);
}

function attackCategories(character) {
  return Object.keys(character.categoryRules).filter(name => character.categoryRules[name].providesAttacks);
}

function stowCategories(character) {
  return Object.keys(character.categoryRules).filter(name => !character.categoryRules[name].providesAttacks);
}

/* Properties are stored as free strings because several carry a parameter --
   "Versatile (1d10)". Lookups therefore match on the base name, the text
   before any bracket. */
function propertyBaseName(text) {
  return String(text).split("(")[0].trim().toLowerCase();
}

function weaponProperty(weapon, name) {
  return (weapon.properties || []).find(p => propertyBaseName(p) === name.toLowerCase()) || null;
}

// "Versatile (1d10)" -> "1d10". Null if absent or if no die was written down.
function versatileDie(weapon) {
  const property = weaponProperty(weapon, "Versatile");
  const match = property && property.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : null;
}

/* Finesse lets a weapon use Strength or Dexterity, "your choice". Taking the
   better of the two is what that choice always amounts to in practice. Only
   swaps between those two, so a homebrew weapon keyed to another ability is
   left alone. */
function finesseAbility(character, weapon) {
  if (!weaponProperty(weapon, "Finesse")) return null;
  const strength = abilityModifier(effectiveAbilityScore(character, "STR"));
  const dexterity = abilityModifier(effectiveAbilityScore(character, "DEX"));
  return dexterity > strength ? "DEX" : "STR";
}

/* Resources come from two places: standalone entries like Action Surge, and
   inventory items that opted into being tracked. They render and recharge
   identically; a row knows which object backs it so a stepper writes to the
   right one.

   An item counts one of two ways:

     a stack   -- arrows, rations. The item's own quantity IS the count, so
                  there is one number and nothing can drift.
     a container -- a quiver, a magazine. It holds a count separate from how
                  many of the container you own, and is refilled from a stack
                  elsewhere in your inventory. `refillFrom` names that stack,
                  `loaded` is what's currently in it. */
function isContainer(item) {
  return !!(item.resource && item.resource.refillFrom);
}

/* A resource added from a level-scaling feature (see "+ Add to Resources"
   on the Character tab) carries its max as a { tiers } table instead of a
   flat number, the same shape an effect's scaling amount uses -- resolved
   here rather than at add-time, so leveling up moves the ceiling without
   anyone having to come back and edit the resource by hand. `maxOverride`
   is the same derived-plus-override shape as everything else on this sheet:
   set it to replace the computed ceiling with a table ruling. */
function effectiveResourceMax(character, resource) {
  if (resource.maxOverride !== undefined && resource.maxOverride !== null) return resource.maxOverride;
  return resolveScalingValue(resource.max, totalLevel(character));
}

function resourceRows(character) {
  const rows = character.resources.map(resource => ({
    key: "res:" + resource.id,
    name: resource.name,
    recharge: resource.recharge,
    current: resource.current,
    max: effectiveResourceMax(character, resource),
    resource
  }));

  character.inventory.forEach(item => {
    if (!item.resource) return;
    const container = isContainer(item);
    rows.push({
      key: "item:" + item.id,
      name: item.name,
      recharge: item.resource.recharge,
      current: container ? (item.resource.loaded || 0) : (item.qty || 0),
      max: item.resource.max,
      refillFrom: container ? item.resource.refillFrom : null,
      container,
      item
    });
  });

  return rows;
}

function findResourceRow(character, key) {
  return resourceRows(character).find(row => row.key === key) || null;
}

function adjustResourceRow(row, delta) {
  if (!row) return;
  if (row.container) row.item.resource.loaded = (row.item.resource.loaded || 0) + delta;
  else if (row.item) row.item.qty = (row.item.qty || 0) + delta;
  else row.resource.current += delta;
}

/* Refilling moves units out of the source stack and into the container, as
   many as will fit or as many as remain, whichever is fewer. Nothing is
   created: what leaves the quiver's source is exactly what arrives in it. */
function refillContainer(character, row) {
  if (!row || !row.container) return { moved: 0, reason: "not a container" };

  /* The source is looked up by name against the whole inventory, not only
     against things tracked as resources. A quiver should still find your
     arrows after you stop tracking them -- being tracked is a display choice,
     not what makes them exist. Rows are rebuilt on every call, so identity is
     compared by key rather than by object. */
  const sourceRow = resourceRows(character).find(other => other.name === row.refillFrom && other.key !== row.key);
  const sourceItem = character.inventory.find(item => item.name === row.refillFrom && item !== row.item);

  if (!sourceRow && !sourceItem) return { moved: 0, reason: "missing", from: row.refillFrom };

  const available = sourceRow ? sourceRow.current : (sourceItem.qty || 0);
  const space = (row.max || 0) - row.current;
  if (space <= 0) return { moved: 0, reason: "full" };
  if (available <= 0) return { moved: 0, reason: "empty", from: row.refillFrom };

  const moved = Math.min(space, available);
  if (sourceRow) adjustResourceRow(sourceRow, -moved);
  else sourceItem.qty -= moved;
  adjustResourceRow(row, moved);
  return { moved, from: row.refillFrom };
}

// a weapon's ammunition may be a standalone resource or an inventory item
function ammunitionResource(character, weapon) {
  if (!weapon.ammunition) return null;
  return resourceRows(character).find(row => row.name === weapon.ammunition) || null;
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
  effectsAffectingAbility(character, ability).forEach(e => { score += effectAmount(character, e); });
  return score;
}

/* "All" is a real answer here, and Bless is why: it lifts every saving throw,
   not a chosen one. Without it the only way to write Bless down was six
   separate modifiers that could drift apart. */
function effectsAffectingSavingThrow(character, ability) {
  return getAllEffects(character).filter(e => e.category === "Saving Throw" &&
    (e.value.ability === ability || e.value.ability === "All"));
}

function effectsAffectingSkill(character, skillName) {
  return getAllEffects(character).filter(e => e.category === "Skill" && e.value.skill === skillName);
}

function effectsAffectingStat(character, statName) {
  return getAllEffects(character).filter(e => e.category === "Bonus" && e.value.stat === statName);
}

/* An effect's numeric amount is either a flat number (the common case) or a
   { tiers: [{level, value}, ...] } table for something that scales with
   level (a custom 2024-style Second Wind, a homebrew feature whose bonus
   improves later). `level == null` means "no character to scale against" --
   used by the handful of display-only call sites that don't have one handy
   -- and falls back to the highest tier, i.e. the value it eventually
   becomes, rather than guessing at zero. */
function resolveScalingValue(value, level) {
  if (typeof value === "number") return value;
  if (!value || !Array.isArray(value.tiers) || !value.tiers.length) return 0;
  if (level == null) return Math.max(...value.tiers.map(t => t.value));
  const eligible = value.tiers.filter(t => t.level <= level);
  if (!eligible.length) return 0;
  return eligible.sort((a, b) => b.level - a.level)[0].value;
}

function effectAmount(character, effect) {
  // a dice bonus resolves to 0 here on purpose: it is not a number you add to
  // a total, it is dice you roll. See effectDice.
  return resolveScalingValue(effect.value.amount, totalLevel(character));
}

/* Bless adds 1d4 to a roll. That cannot be folded into "your attack bonus is
   +7", because the whole point is that it is rolled fresh each time -- so it
   travels beside the modifier rather than inside it, in the notation and on
   whatever pill shows the number. */
function effectDice(effect) {
  const amount = effect && effect.value && effect.value.amount;
  if (typeof amount !== "string") return null;
  const dice = amount.trim().toLowerCase();
  return /^\d{0,2}d\d{1,3}$/.test(dice) ? dice : null;
}

function statBonusDice(character, statName) {
  return effectsAffectingStat(character, statName).map(effectDice).filter(Boolean);
}

function savingThrowBonusDice(character, ability) {
  return effectsAffectingSavingThrow(character, ability).map(effectDice).filter(Boolean);
}

function skillBonusDice(character, skillName) {
  return effectsAffectingSkill(character, skillName).map(effectDice).filter(Boolean);
}

/* A spell attack is an attack roll, so anything lifting attack rolls lifts it
   too. The flat side of the app does not do this yet -- calculateSpellAttack
   reads only "Spell Attack" -- but dice are new, so there is no old behaviour
   here to preserve, and being right costs nothing. */
function spellAttackBonusDice(character) {
  return statBonusDice(character, "Attack Rolls").concat(statBonusDice(character, "Spell Attack"));
}

function withBonusDice(text, dice) {
  return (dice || []).reduce((out, die) => out + "+" + die, text);
}

// the smallest and largest a pile of dice can come to
function diceSpan(dice) {
  return (dice || []).reduce((span, die) => {
    const match = /^(\d*)d(\d+)$/.exec(die);
    if (!match) return span;
    const count = parseInt(match[1] || "1", 10);
    return { min: span.min + count, max: span.max + count * parseInt(match[2], 10) };
  }, { min: 0, max: 0 });
}

/* What a bonus is actually worth right now. With nothing temporary up it is
   the plain modifier. With Bless up, "+7" is a lie and "+7+1d4" is arithmetic
   homework, so it reads "+8~11": the range that number can now land in. */
function bonusLabel(total, dice) {
  if (!dice || !dice.length) return formatModifier(total);
  const span = diceSpan(dice);
  return formatModifier(total + span.min) + "~" + (total + span.max);
}

/* What a pill on the *sheet* shows, which is a matter of taste and therefore a
   setting. Off, the sheet keeps the steady number it has when nothing is up,
   and the range appears when you go to roll. On, the sheet says the range
   everywhere. The roll window shows the total either way -- knowing what you
   are about to throw is not a preference. */
function sheetBonusLabel(total, dice) {
  const showRange = typeof settings !== "undefined" && settings.showBonusRange;
  return showRange ? bonusLabel(total, dice) : formatModifier(total);
}

/* "d20" covers attack rolls, ability checks and saving throws (Halfling
   Lucky); "damage" is its own bucket (Great Weapon Fighting). A roll kind
   of "check"/"attack"/"save" all read the d20 bucket; "damage" reads its
   own. Multiple sources stack to the highest threshold rather than adding,
   since "reroll 1s" and "reroll 1s and 2s" aren't cumulative in 5e. */
function rerollThresholdFor(character, kind) {
  const bucket = kind === "damage" ? "damage" : "d20";
  let max = 0;
  getAllEffects(character).forEach(e => {
    if (e.category === "Reroll" && e.value.rollType === bucket) max = Math.max(max, e.value.threshold || 0);
  });
  return max;
}

// A resolved Fighting Style renames its granting feature to "Fighting Style:
// <label>" (see applyChoiceResolution in choices.js) -- this is the same
// lookup, used by calculateAttack for styles like Two-Weapon Fighting that
// change behavior without a generic effect to attach.
function hasFightingStyle(character, label) {
  const target = "Fighting Style: " + label;
  return Object.keys(character.traits).some(cat => character.traits[cat].some(t => t.name === target));
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

// `level` is optional -- callers with a character handy pass totalLevel(it)
// so a scaling amount shows what it's actually worth right now; callers
// without one (there are a couple) get resolveScalingValue's fallback,
// the value it eventually becomes.
/* A dice bonus resolves to zero as a number, which is correct arithmetic and a
   useless thing to read: Bless showed as "+0 Attack Rolls". It says what it
   actually gives you instead. */
function effectValueLabel(effect, level) {
  const dice = effectDice(effect);
  return dice ? "+" + dice : formatModifier(resolveScalingValue(effect.value.amount, level));
}

function effectSummaryLabel(effect, level) {
  if (effect.category === "Condition") return effect.value.condition;
  if (effect.category === "Advantage") return advantageLabel(effect);
  if (effect.category === "Ability Score") return effectValueLabel(effect, level) + " " + effect.value.ability;
  if (effect.category === "Saving Throw") return effectValueLabel(effect, level) + " " + effect.value.ability + (effect.value.ability === "All" ? " Saves" : " Save");
  if (effect.category === "Skill") return effectValueLabel(effect, level) + " " + effect.value.skill;
  if (effect.category === "Bonus") return effectValueLabel(effect, level) + " " + effect.value.stat;
  if (effect.category === "Reroll") {
    const label = effect.value.rollType === "damage" ? "Damage Rolls" : "Attack Rolls, Checks & Saves";
    return "Reroll " + (effect.value.threshold <= 1 ? "1s" : "1-" + effect.value.threshold + "s") + " on " + label;
  }
  return effect.category;
}

function durationLabel(effect) {
  const d = effect.duration;
  if (d.type === "Rounds") return d.rounds + " round" + (d.rounds === 1 ? "" : "s");
  if (d.type === "Short Rest") return "Until short rest";
  if (d.type === "Long Rest") return "Until long rest";
  return "Permanent";
}

function featureEffectSummary(effect, level) {
  if (effect.category === "Advantage") return advantageLabel(effect);
  if (effect.category === "Ability Score") return formatModifier(resolveScalingValue(effect.value.amount, level)) + " " + effect.value.ability;
  if (effect.category === "Saving Throw") return formatModifier(resolveScalingValue(effect.value.amount, level)) + " " + effect.value.ability + " Save";
  if (effect.category === "Skill") return formatModifier(resolveScalingValue(effect.value.amount, level)) + " " + effect.value.skill;
  if (effect.category === "Bonus") return formatModifier(resolveScalingValue(effect.value.amount, level)) + " " + effect.value.stat;
  if (effect.category === "Reroll") return effectSummaryLabel(effect);
  return "";
}


/* ============================================================
   3. CALCULATED STATS
   ============================================================ */

// proficiency bonus is now calculated too, so an item/condition that
// boosts it (rare, but possible) flows into every save/skill/attack
// that uses it, automatically.
/* ---------- levels ---------- */

function totalLevel(character) {
  return (character.classes || []).reduce((sum, entry) => sum + (entry.level || 0), 0);
}

// 5e: +2 at level 1, rising by one every four levels thereafter
function proficiencyBonusForLevel(level) {
  return 2 + Math.floor(Math.max(1, level - 1) / 4);
}

function classLineFor(character) {
  if (!character.classes || !character.classes.length) return "No class";
  return character.classes
    .map(entry => entry.name + (entry.subclass ? " (" + entry.subclass + ")" : "") + " " + entry.level)
    .join(" / ");
}

/* Hit dice totals are a function of class levels. Only how many have been
   spent is stored, so a level up adds a die without anyone maintaining two
   numbers that could disagree. */
function calculateHitDice(character) {
  const byDie = {};
  (character.classes || []).forEach(entry => {
    const die = entry.hitDie || "d8";
    byDie[die] = (byDie[die] || 0) + (entry.level || 0);
  });

  const spent = character.hitDiceSpent || {};
  return Object.keys(byDie).map(die => ({
    die,
    total: byDie[die],
    current: Math.max(0, byDie[die] - (spent[die] || 0)),
    recharge: { on: "LR", amount: "half" }
  }));
}

function spendHitDieOfSize(character, die, count) {
  if (!character.hitDiceSpent) character.hitDiceSpent = {};
  character.hitDiceSpent[die] = Math.max(0, (character.hitDiceSpent[die] || 0) + count);
}

function calculateProficiencyBonus(character) {
  const level = totalLevel(character);
  const override = character.proficiencyBonusOverride;
  const derived = override === null || override === undefined
    ? proficiencyBonusForLevel(level)
    : override;

  const sources = [{
    label: override === null || override === undefined ? "Level " + level : "Manual override",
    value: derived
  }];
  effectsAffectingStat(character, "Proficiency Bonus").forEach(e => sources.push({ label: effectSourceLabel(e), value: effectAmount(character, e) }));
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources, level, overridden: override !== null && override !== undefined };
}

function itemType(item) {
  if (item.isWeapon) return "weapon";
  if (item.armour) return "armour";
  return "gear";
}

function equippedArmour(character) {
  return equippedEffectItems(character).filter(i => i.armour && i.armour.kind !== "shield");
}

function equippedShields(character) {
  return equippedEffectItems(character).filter(i => i.armour && i.armour.kind === "shield");
}

/* 5e armour sets a base AC and limits how much Dexterity you may add, rather
   than adding a bonus on top of 10 + Dex. Light armour takes full Dex, medium
   caps it at 2, heavy allows none, and shields are a flat addition that stacks
   with whatever you're wearing. Unarmoured falls back to 10 + Dex.

   Only one suit of body armour can apply; if somehow two are equipped the
   better base wins. A dexCap of null means no limit. */
function calculateAC(character) {
  const sources = [];
  const dexModifier = abilityModifier(effectiveAbilityScore(character, "DEX"));

  const worn = equippedArmour(character)
    .slice()
    .sort((a, b) => (b.armour.base || 0) - (a.armour.base || 0))[0];

  let dexAllowed = dexModifier;
  if (worn) {
    // the armour's base AC is a value, not a bonus -- printed with a sign it
    // read "Chain Shirt +13", which is simply untrue
    sources.push({ label: worn.name, value: worn.armour.base || 0, plain: true });
    const cap = worn.armour.dexCap;
    if (cap !== null && cap !== undefined) dexAllowed = Math.min(dexModifier, cap);
  } else {
    sources.push({ label: "Unarmoured", value: 10, plain: true });
  }

  const capped = worn && worn.armour.dexCap !== null && worn.armour.dexCap !== undefined && dexModifier > worn.armour.dexCap;
  sources.push({
    label: ABILITY_FULL_NAMES.DEX + " modifier" + (capped ? " (capped at " + worn.armour.dexCap + ")" : ""),
    value: dexAllowed
  });

  equippedShields(character).forEach(shield => {
    sources.push({ label: shield.name, value: shield.armour.base || 0 });
  });

  // flat bonuses from anything that isn't armour, e.g. a Cloak of Protection
  equippedEffectItems(character).forEach(item => {
    if (item.acBonus && !item.armour) sources.push({ label: item.name, value: item.acBonus });
  });
  effectsAffectingStat(character, "AC").forEach(e => sources.push({ label: effectSourceLabel(e), value: effectAmount(character, e) }));

  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources };
}

/* Death saves only exist at 0 hit points. Three successes stabilise you, three
   failures kill you, and any healing above 0 wipes both tracks -- so the state
   is derived from hit points rather than being a mode you enter and leave. */
function deathSaveState(character) {
  const saves = character.deathSaves || { successes: 0, failures: 0 };
  return {
    successes: saves.successes,
    failures: saves.failures,
    dying: character.hp.current <= 0 && saves.failures < 3 && saves.successes < 3,
    stable: character.hp.current <= 0 && saves.successes >= 3,
    dead: saves.failures >= 3
  };
}

function resetDeathSaves(character) {
  character.deathSaves = { successes: 0, failures: 0 };
}

function calculateMaxHP(character) {
  const sources = [{ label: "Base", value: character.baseMaxHP }];
  character.maxHpModifiers.forEach(m => sources.push(m));
  let total = sources.reduce((sum, s) => sum + s.value, 0);

  // exhaustion halves the maximum at level 4
  if (exhaustionLevel(character) >= 4) {
    const lost = Math.floor(total / 2);
    sources.push({ label: "Exhaustion 4", value: -lost });
    total -= lost;
  }

  return { total, sources };
}

function calculateInitiative(character) {
  const sources = [];
  sources.push({ label: ABILITY_FULL_NAMES.DEX + " modifier", value: abilityModifier(effectiveAbilityScore(character, "DEX")) });
  effectsAffectingStat(character, "Initiative").forEach(e => sources.push({ label: effectSourceLabel(e), value: effectAmount(character, e) }));
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources };
}

function calculateSpeed(character) {
  const sources = [{ label: "Base speed", value: character.baseSpeed }];
  if (hasCondition(character, "Restrained") || hasCondition(character, "Grappled")) {
    sources.push({ label: "Restrained/Grappled", value: -character.baseSpeed });
  }
  effectsAffectingStat(character, "Speed").forEach(e => sources.push({ label: effectSourceLabel(e), value: effectAmount(character, e) }));

  // exhaustion halves speed at 2 and removes it entirely at 5
  const exhaustion = exhaustionLevel(character);
  let running = sources.reduce((sum, s) => sum + s.value, 0);
  if (exhaustion >= 5) {
    sources.push({ label: "Exhaustion 5", value: -running });
    running = 0;
  } else if (exhaustion >= 2) {
    const lost = Math.floor(running / 2);
    sources.push({ label: "Exhaustion 2", value: -lost });
    running -= lost;
  }

  return { total: Math.max(0, running), sources };
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
    const amount = effectAmount(character, effect);
    runningScore += amount;
    sources.push({
      label: effectSourceLabel(effect) + " (" + formatModifier(amount) + " score)",
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
  effectsAffectingSavingThrow(character, ability).forEach(e => sources.push({ label: effectSourceLabel(e), value: effectAmount(character, e) }));
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

  effectsAffectingSkill(character, skillName).forEach(e => sources.push({ label: effectSourceLabel(e), value: effectAmount(character, e) }));
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources, overridden: false };
}

function calculatePassivePerception(character) {
  const perception = calculateSkill(character, "Perception");
  const sources = [{ label: "Base", value: 10 }].concat(perception.sources);
  const total = 10 + perception.total;
  return { total, sources };
}

/* ---------- stacks ----------

   Two piles of the same thing should be one pile, and after an item crosses
   from another phone they are not: three arrows and five arrows sit as two
   rows. Merging them is a drag, not something the app does behind the
   player's back, because splitting a stack deliberately is also a thing
   people do.

   What counts as "the same thing" is the whole item apart from the three
   fields that describe this particular pile of it. Name alone is not enough:
   a +1 longsword and a plain one are both called Longsword, and quietly
   folding one into the other would destroy the magic weapon. */
function stackSignature(item) {
  const skip = { id: true, qty: true, category: true, inside: true };
  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).sort().forEach(key => { out[key] = canonical(value[key]); });
      return out;
    }
    return value;
  };
  const bones = {};
  Object.keys(item).sort().forEach(key => { if (!skip[key]) bones[key] = canonical(item[key]); });
  return JSON.stringify(bones);
}

function canMergeStacks(a, b) {
  if (!a || !b || a === b) return false;
  // two packs are never "two of a pack": each holds different things, and
  // folding them into a stack of 2 would strand one lot of contents
  if (isContainerItem(a) || isContainerItem(b)) return false;
  return stackSignature(a) === stackSignature(b);
}

function mergeStacks(into, from) {
  into.qty = (into.qty || 1) + (from.qty || 1);
  return into;
}

/* ---------- containers ----------

   A pack is an item that other items are inside. The relationship is stored on
   the child (`inside` holds the container's id) rather than as a nested array
   on the parent, so the inventory stays one flat list. Everything that already
   walks `character.inventory` -- weight, attacks, effects, giving, persistence
   -- keeps working without knowing containers exist.

   A contained item's category is kept equal to its container's. That is what
   makes the rest of the app correct for free: a longsword inside a pack sitting
   in Carrying provides no attacks, because Carrying provides none, and it does
   so without a single rule about containers being written anywhere else. */
function isContainerItem(item) {
  return !!(item && item.isContainer);
}

function containerContents(character, container) {
  if (!container) return [];
  return (character.inventory || []).filter(item => sameId(item.inside, container.id));
}

function topLevelItems(character) {
  return (character.inventory || []).filter(item => item.inside == null);
}

/* A bag of holding does not get heavier. The rule lives on the container and
   is asked about the child, so nothing else in the app needs to know which
   bags are magic -- the weight sum just asks whether this item is inside one. */
function weightlessContainerFor(character, item) {
  if (!item || item.inside == null) return null;
  const holder = (character.inventory || []).find(row => sameId(row.id, item.inside));
  return holder && holder.ignoresContentWeight ? holder : null;
}

// what the pack row reports: itself, plus everything in it
function containerWeight(character, container) {
  const own = (container.weight || 0) * (container.qty || 1);
  if (container.ignoresContentWeight) return own;
  return containerContents(character, container)
    .reduce((sum, item) => sum + (item.weight || 0) * (item.qty || 1), own);
}

function putInContainer(character, item, container) {
  if (!item || !container || item === container) return false;
  if (isContainerItem(item)) return false;          // no packs inside packs
  item.inside = container.id;
  item.category = container.category;               // see the note above
  return true;
}

function takeOutOfContainer(item, category) {
  if (!item || item.inside == null) return false;
  delete item.inside;
  if (category) item.category = category;
  return true;
}

/* Tipping a pack out. The contents land in the pack's own category, which is
   where the pack itself is, so nothing moves anywhere surprising. */
function emptyContainer(character, container) {
  const spilled = containerContents(character, container);
  spilled.forEach(item => takeOutOfContainer(item, container.category));
  return spilled;
}

/* Removing a pack takes what is in it. Leaving the contents behind would
   scatter a pack's worth of loose items across the sheet with no explanation,
   and leaving them pointing at an id that no longer exists would hide them
   entirely. */
function removeItemAndContents(character, item) {
  const doomed = [item].concat(containerContents(character, item));
  character.inventory = character.inventory.filter(row => doomed.indexOf(row) === -1);
  return doomed;
}

/* A catalogue pack is a row plus a shopping list. Adding one creates the pack
   and everything in it, so a Dungeoneer's Pack arrives as a crowbar and ten
   torches you can actually find, spend and hand over. */
function expandContainerContents(character, container, source) {
  const list = (source && source.contents) || [];
  return list.map(entry => {
    const catalogue = typeof allInventoryItems === "function"
      ? allInventoryItems().find(row => row.name === entry.name) : null;
    const item = {
      id: makeId(character.inventory),
      name: entry.name,
      category: container.category,
      weight: entry.weight != null ? entry.weight : (catalogue ? catalogue.weight : 0),
      qty: entry.qty || 1,
      inside: container.id
    };
    if (catalogue && catalogue.description) item.description = catalogue.description;
    character.inventory.push(item);
    return item;
  });
}

/* ---------- money ----------

   Coin is its own thing, not an inventory item. Four denominations, two
   purses: what you carry and what you've stashed somewhere (a vault, the party
   fund, under a floorboard). The stash is opt-in -- most tables don't track
   it -- and only the carried purse can weigh anything.

   `purse` and `stash` are plain { gp, ep, sp, cp } objects rather than a single
   copper total, because a player looking at their sheet wants to see the coins
   they have, not a converted number. Conversion is a thing they do at a shop,
   so it stays a display concern (`moneyInGold`) rather than the storage shape.

   Amounts are allowed to be anything the player types, including more than any
   one denomination "should" hold -- 340 sp is a legitimate way to carry money.
   Same reasoning as resources being allowed to exceed their max. */
const COIN_TYPES = [
  { key: "pp", label: "PP", name: "Platinum", perGold: 0.1 },
  { key: "gp", label: "GP", name: "Gold", perGold: 1 },
  { key: "ep", label: "EP", name: "Electrum", perGold: 2 },
  { key: "sp", label: "SP", name: "Silver", perGold: 10 },
  { key: "cp", label: "CP", name: "Copper", perGold: 100 }
];

// 50 coins to the pound, regardless of denomination
const COINS_PER_POUND = 50;

function purseTotal(purse) {
  return COIN_TYPES.reduce((sum, coin) => sum + ((purse && purse[coin.key]) || 0), 0);
}

// "12 gp, 3 sp" -- only the denominations that are actually in there
function purseLabel(purse) {
  return COIN_TYPES
    .filter(coin => (purse && purse[coin.key]) > 0)
    .map(coin => purse[coin.key] + " " + coin.label.toLowerCase())
    .join(", ");
}

function canAffordPurse(purse, amount) {
  return COIN_TYPES.every(coin => ((purse && purse[coin.key]) || 0) >= ((amount && amount[coin.key]) || 0));
}

/* Coin moves denomination by denomination and is never converted on the way.
   340 silver is a legitimate way to carry money, and turning it into 34 gold
   because that is tidier would be the app overruling the player about what is
   in their own purse. */
function takeFromPurse(purse, amount) {
  COIN_TYPES.forEach(coin => { purse[coin.key] = (purse[coin.key] || 0) - ((amount && amount[coin.key]) || 0); });
  return purse;
}

function addToPurse(purse, amount) {
  COIN_TYPES.forEach(coin => { purse[coin.key] = (purse[coin.key] || 0) + ((amount && amount[coin.key]) || 0); });
  return purse;
}

function emptyPurse() {
  const purse = {};
  COIN_TYPES.forEach(coin => { purse[coin.key] = 0; });
  return purse;
}

// tolerates a missing or partial purse, because a character saved before money
// existed has neither, and a kit only ever grants one or two denominations
function coinCount(purse, key) {
  return (purse && Number(purse[key])) || 0;
}

function totalCoins(purse) {
  return COIN_TYPES.reduce((sum, coin) => sum + coinCount(purse, coin.key), 0);
}

function moneyInGold(purse) {
  return COIN_TYPES.reduce((sum, coin) => sum + coinCount(purse, coin.key) / coin.perGold, 0);
}

function addCoins(purse, coins) {
  const out = Object.assign(emptyPurse(), purse);
  Object.keys(coins || {}).forEach(key => { out[key] = coinCount(out, key) + Number(coins[key] || 0); });
  return out;
}

/* Only the carried purse, and only when the setting says coin has weight. The
   rule is real (50 to the pound) and almost every table ignores it, so it is
   off by default rather than absent -- the POC's job is to show the model can
   express it. */
function carriedCoinWeight(character) {
  if (typeof settings === "undefined" || !settings.moneyCountsWeight) return 0;
  return totalCoins(character.purse) / COINS_PER_POUND;
}

function calculateCarriedWeight(character) {
  const sources = [];
  character.inventory.forEach(item => {
    const rule = character.categoryRules[item.category];
    if (!rule || !rule.countsWeight) return;
    if (weightlessContainerFor(character, item)) return;    // inside a bag of holding
    sources.push({ label: item.name, value: item.weight * (item.qty || 1) });
  });
  const coins = carriedCoinWeight(character);
  if (coins) sources.push({ label: totalCoins(character.purse) + " coins", value: coins });
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources };
}

/* Carrying capacity is Strength x 15, and nothing in the app had it -- so
   "Carried weight: 46 lb" was 46 out of nothing. Encumbrance variants exist
   but the base rule is the one every table uses. */
function calculateCarryingCapacity(character) {
  const str = effectiveAbilityScore(character, "STR");
  return { total: str * 15, sources: [{ label: "Strength " + str + " x 15", value: str * 15 }] };
}

/* Spell slots and prepared counts, read off a class's `spellcasting`
   descriptor (srd-classes.js). Pure functions over the descriptor plus a
   class level, so building a character and levelling one up can share the
   same answer instead of each carrying its own table. Returns a plain
   { <spell level>: <slots> } map, empty for a class that isn't casting yet
   (a 1st-level Paladin) or doesn't cast at all. */
function spellSlotsAtLevel(spellcasting, classLevel) {
  const slots = {};
  if (!spellcasting || classLevel < (spellcasting.startLevel || 1)) return slots;

  if (spellcasting.progression === "pact") {
    const pact = PACT_MAGIC_SLOTS[Math.min(classLevel, PACT_MAGIC_SLOTS.length - 1)];
    if (pact) slots[pact.level] = pact.count;
    return slots;
  }

  const table = spellcasting.progression === "half" ? SPELL_SLOTS_HALF_CASTER : SPELL_SLOTS_FULL_CASTER;
  (table[Math.min(classLevel, table.length - 1)] || []).forEach((count, index) => { slots[index + 1] = count; });
  return slots;
}

// Pact Magic comes back on a short rest; every other caster's slots on a long
// one. Same vocabulary resources and hit dice use, so rests need no special case.
function spellSlotRecharge(spellcasting) {
  return { on: spellcasting && spellcasting.progression === "pact" ? "SR" : "LR", amount: "all" };
}

/* How many spells a class can have ready at once. A prepared caster works it
   out from its ability modifier and level; a known caster (Bard, Sorcerer,
   Warlock, Ranger) has a fixed list instead, and `known` is what it starts
   with -- the spells-known progression past that level isn't modelled, so
   levelling one of those is still the player's to adjust. */
function maxPreparedSpells(spellcasting, classLevel, abilityMod) {
  if (!spellcasting || classLevel < (spellcasting.startLevel || 1)) return 0;
  if (spellcasting.prepared === "ability+level") return Math.max(1, abilityMod + classLevel);
  if (spellcasting.prepared === "ability+halfLevel") return Math.max(1, abilityMod + Math.floor(classLevel / 2));
  return spellcasting.known || 0;
}

function calculateSpellAttack(character, ability) {
  const sources = [];
  sources.push({ label: "Proficiency Bonus", value: calculateProficiencyBonus(character).total });
  sources.push({ label: ABILITY_FULL_NAMES[ability] + " Modifier", value: abilityModifier(effectiveAbilityScore(character, ability)) });
  effectsAffectingStat(character, "Spell Attack").forEach(e => sources.push({ label: effectSourceLabel(e), value: effectAmount(character, e) }));
  const total = sources.reduce((sum, s) => sum + s.value, 0);
  return { total, sources };
}

function calculateSpellDC(character, ability) {
  const sources = [{ label: "Base", value: 8 }];
  sources.push({ label: "Proficiency Bonus", value: calculateProficiencyBonus(character).total });
  sources.push({ label: ABILITY_FULL_NAMES[ability] + " Modifier", value: abilityModifier(effectiveAbilityScore(character, ability)) });
  effectsAffectingStat(character, "Spell DC").forEach(e => sources.push({ label: effectSourceLabel(e), value: effectAmount(character, e) }));
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

  /* A proficiency entry may be a category ("Martial") or a specific weapon
     ("Dagger") -- SRD Wizards get named weapons rather than a whole category.
     So a weapon counts as proficient if the character holds either the
     category it requires or its own name. */
  const held = (character.weaponProficiencies || []).map(p => p.toLowerCase());
  const name = (weapon.name || "").toLowerCase();
  return {
    proficient: held.includes(required.toLowerCase()) || (!!name && held.includes(name)),
    overridden: false,
    required
  };
}

function calculateAttack(character, weapon) {
  const proficiency = weaponProficiency(character, weapon);

  // Finesse may override the weapon's stated ability, for both attack and any
  // damage part that was keyed to Strength or Dexterity.
  const finesse = finesseAbility(character, weapon);
  const usesFinesse = finesse && ["STR", "DEX"].includes(weapon.attackAbility);
  const attackAbility = usesFinesse ? finesse : weapon.attackAbility;

  const toHitSources = [];
  toHitSources.push({
    label: ABILITY_FULL_NAMES[attackAbility] + " modifier" + (usesFinesse ? " (Finesse)" : ""),
    value: abilityModifier(effectiveAbilityScore(character, attackAbility))
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
      toHitSources.push({ label: item.name, value: item.attackBonus });
    }
  });
  effectsAffectingStat(character, "Attack Rolls").forEach(e => toHitSources.push({ label: effectSourceLabel(e), value: effectAmount(character, e) }));

  const toHitTotal = toHitSources.reduce((sum, s) => sum + s.value, 0);

  /* A magic bonus and any blanket "Damage Rolls" effect apply once per attack,
     not once per damage type, so they land on the first part only. A part adds
     an ability modifier only if it names one -- rider dice like poison or sneak
     attack normally don't get it. */
  const onceOnly = [];
  if (weapon.magicBonus) onceOnly.push({ label: weapon.name + " (magic bonus)", value: weapon.magicBonus });
  // Dueling's bonus only counts on a weapon that actually qualifies for it --
  // everything else with a blanket "Damage Rolls" effect (homebrew, magic
  // items) still applies unconditionally.
  effectsAffectingStat(character, "Damage Rolls").forEach(e => {
    if (e.source === "Fighting Style: Dueling" && !qualifiesForDueling(character, weapon)) return;
    onceOnly.push({ label: effectSourceLabel(e), value: effectAmount(character, e) });
  });

  // Two-handing a versatile weapon swaps the base damage die for the larger one
  // written in the property. Only the weapon's own first damage part changes;
  // rider dice are unaffected.
  const versatile = versatileDie(weapon);
  const twoHanded = !!weapon.twoHanded && !!versatile;

  // RAW: an off-hand attack doesn't add your ability modifier to damage
  // unless you have Two-Weapon Fighting. Every other weapon on the sheet
  // keeps the modifier it's always had -- this only touches offHand: true.
  const suppressAbilityDamage = !!weapon.offHand && !hasFightingStyle(character, "Two-Weapon Fighting");

  const damage = (weapon.damage || []).map((part, index) => {
    const sources = [];
    const partAbility = (finesse && ["STR", "DEX"].includes(part.ability)) ? finesse : part.ability;
    if (partAbility && !suppressAbilityDamage) {
      sources.push({
        label: ABILITY_FULL_NAMES[partAbility] + " modifier" + (partAbility !== part.ability ? " (Finesse)" : ""),
        value: abilityModifier(effectiveAbilityScore(character, partAbility))
      });
    }
    if (index === 0) onceOnly.forEach(s => sources.push(s));
    const bonusTotal = sources.reduce((sum, s) => sum + s.value, 0);
    const dice = (index === 0 && twoHanded) ? versatile : part.dice;
    return {
      dice,
      type: part.type || "",
      bonusTotal,
      sources,
      notation: dice + (bonusTotal ? formatModifier(bonusTotal) : "")
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
    damageNotation: damage.map(d => d.notation).join(" + ") || "—",
    versatile, twoHanded,
    offHand: !!weapon.offHand,
    suppressedOffHandAbility: suppressAbilityDamage,
    finesse: usesFinesse ? finesse : null,
    ammunition: ammunitionResource(character, weapon)
  };
}