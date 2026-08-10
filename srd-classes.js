/* ============================================================
   SRD CLASSES

   Split out of srd-data.js for the same reason as srd-races.js (see its
   header). Loaded right after srd-races.js, before character-data.js.
   ============================================================ */

/* Sourced from https://www.5esrd.com/database/class/{name}/ -- all 12 SRD
   5.1 classes, full 1st-20th level progression, replacing the old
   hand-written placeholder (which only ever needed to be displayed, never
   granted, so it stopped at level 2-3 and skipped the `level` field
   entirely). Each class's subclass list is pruned to the single subclass
   WotC actually released as Open Game Content -- confirmed per-class the
   same way earlier steps confirmed official vs third-party (no third-party
   Source/Section-15 attribution on that one subclass's own page, versus
   every sibling option in that class's archetype listing, which does).
   That's a real change from the old placeholder data, which had two
   subclasses for Fighter, Wizard, Rogue and Cleric -- only one of each
   pair was ever real SRD content.

   No spell-slot tables and no spell lists, same boundary as every step
   before this one -- a caster gets one "Spellcasting" feature describing
   the mechanic (what ability governs it, ritual casting, prepared vs.
   known, Pact Magic's short-rest recharge for Warlock) with no numeric
   slot progression attached.

   `effects`/`resource` only appear where the rule is a clean, unconditional
   match for this app's categories (Ability Score Improvement, Fighting
   Style, Expertise, limited-use resources like Rage or Channel Divinity).
   Conditional, narrow, or subsystem-shaped features (Sneak Attack dice,
   Rage's melee damage bonus, Wild Shape, ki, maneuvers, Divine Smite,
   favored-enemy/terrain bonuses) stay description text only -- no category
   is narrow enough to express them correctly, matching FIGHTING_STYLES'
   Protection precedent from the very first step of this project.

   One real architectural wrinkle this data ran into: grantFeatures()
   (rests.js) dedupes a class's granted features by name, so a class whose
   real feature table repeats the same name across levels (Ability Score
   Improvement at 4/8/12/16/19, Expertise a second time for Rogue/Bard,
   Fighter's bonus ASIs at 6/14) would only ever grant the first one --
   levels 8, 12, 16 and 19 would silently do nothing. That dedup is
   intentional (see CLAUDE.md's multiclass-Spellcasting note), not
   something to change here, so every level past the first that's a real,
   separate grant is named distinctly instead ("Ability Score Improvement
   (Level 8)"). Where the repeat in the real text is pure number-scaling on
   an already-granted feature (Bardic Inspiration's die size, Destroy
   Undead's CR threshold, Metamagic's option count) rather than a new
   grantable event, the scaling is folded into the original feature's own
   desc text instead of creating a second entry that would just get
   silently dropped -- same reasoning, opposite fix. Purely generic
   "you gain a feature from your subclass" placeholders that the SRD table
   repeats at every subclass-feature level are dropped entirely, since the
   real content already lives in that subclass's own `features` list at
   the same level. */
const SRD_CLASSES = [
  {
    name: "Barbarian", mainAbility: "Strength", hitDie: "d12",
    saves: ["Strength", "Constitution"],
    armorProf: "Light armor, medium armor, shields", weaponProf: "Simple weapons, martial weapons",
    description: "A fierce warrior who can enter a battle rage, fueled by primal fury.",
    features: [
      { level: 1, name: "Rage", desc: "As a bonus action, enter a rage: advantage on Strength checks and saves, resistance to bludgeoning, piercing, and slashing damage, and a bonus to melee damage with Strength attacks. Lasts 1 minute and ends early if you go a turn without attacking a hostile creature or taking damage. Uses per long rest rise with level: 2 at 1st, 3 at 3rd, 4 at 6th, 5 at 12th, 6 at 17th, unlimited at 20th.",
        resource: { max: 2, recharge: { on: "LR", amount: "all" } } },
      { level: 1, name: "Unarmored Defense", desc: "While wearing no armor, your AC equals 10 + your Dexterity modifier + your Constitution modifier. You can still use a shield." },
      { level: 2, name: "Reckless Attack", desc: "On your first attack of a turn, you can attack recklessly, gaining advantage on melee Strength attack rolls this turn, but attack rolls against you have advantage until your next turn." },
      { level: 2, name: "Danger Sense", desc: "You have advantage on Dexterity saving throws against effects you can see, such as traps and spells, as long as you aren't blinded, deafened, or incapacitated." },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 5, name: "Extra Attack", desc: "You can attack twice, instead of once, whenever you take the Attack action on your turn." },
      { level: 5, name: "Fast Movement", desc: "Your speed increases by 10 feet while you aren't wearing heavy armor." },
      { level: 7, name: "Feral Instinct", desc: "You have advantage on initiative rolls. If surprised at the start of combat and not incapacitated, you can act normally on your first turn if you enter your rage before doing anything else." },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 9, name: "Brutal Critical", desc: "Roll one additional weapon damage die when determining the extra damage for a critical hit with a melee attack. This increases to two additional dice at 13th level and three additional dice at 17th." },
      { level: 11, name: "Relentless Rage", desc: "If you drop to 0 hit points while raging and don't die outright, you can make a DC 10 Constitution save to drop to 1 hit point instead. The DC increases by 5 each time you use this after the first, resetting to 10 after a short or long rest." },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 15, name: "Persistent Rage", desc: "Your rage ends early only if you fall unconscious or choose to end it." },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 18, name: "Indomitable Might", desc: "If your total for a Strength check is less than your Strength score, you can use that score in place of the total." },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 20, name: "Primal Champion", desc: "Your Strength and Constitution scores increase by 4, and their maximum increases to 24." }
    ],
    skillChoices: { count: 2, options: ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"] },
    subclasses: [
      { name: "Path of the Berserker", features: [
        { level: 3, name: "Frenzy", desc: "When you rage, you can go into a frenzy, letting you make one bonus-action melee weapon attack on each of your turns for the rage's duration. When the rage ends, you suffer one level of exhaustion." },
        { level: 6, name: "Mindless Rage", desc: "You can't be charmed or frightened while raging; an existing charmed or frightened effect on you is suspended for the duration of your rage." },
        { level: 10, name: "Intimidating Presence", desc: "As an action, frighten one creature you can see within 30 feet; it must succeed on a Wisdom save (DC 8 + proficiency bonus + Charisma modifier) or be frightened of you until the end of your next turn, extendable each turn. If it succeeds, you can't use this on it again for 24 hours." },
        { level: 14, name: "Retaliation", desc: "When you take damage from a creature within 5 feet of you, you can use your reaction to make a melee weapon attack against that creature." }
      ] }
    ]
  },
  {
    name: "Bard", mainAbility: "Charisma", hitDie: "d8",
    saves: ["Dexterity", "Charisma"],
    armorProf: "Light armor", weaponProf: "Simple weapons, hand crossbows, longswords, rapiers, shortswords",
    toolProf: "Three musical instruments of your choice",
    description: "An inspiring magician whose power echoes the music of creation.",
    features: [
      { level: 1, name: "Spellcasting", desc: "Charisma is your spellcasting ability for bard spells, and you can use a musical instrument as a spellcasting focus. You can cast any bard spell you know as a ritual if it has the ritual tag." },
      { level: 1, name: "Bardic Inspiration", desc: "As a bonus action, give one creature within 60 feet a Bardic Inspiration die it can add to one ability check, attack roll, or saving throw within the next 10 minutes. Usable a number of times equal to your Charisma modifier (minimum 1), regaining uses on a long rest (or any rest at 5th level and up). The die is a d6, rising to d8 at 5th level, d10 at 10th, and d12 at 15th.",
        resource: { max: 1, recharge: { on: "LR", amount: "all" } } },
      { level: 2, name: "Jack of All Trades", desc: "Add half your proficiency bonus, rounded down, to any ability check you make that doesn't already include your proficiency bonus." },
      { level: 2, name: "Song of Rest", desc: "During a short rest, you and friendly creatures who hear your performance regain an extra 1d6 hit points if they spend Hit Dice to heal. The extra healing rises to 1d8 at 9th level, 1d10 at 13th, and 1d12 at 17th." },
      { level: 3, name: "Expertise", desc: "Choose two of your skill proficiencies; your proficiency bonus is doubled for ability checks using either.",
        choice: { kind: "skill", count: 2, prompt: "Choose two skills to gain Expertise in" } },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 5, name: "Font of Inspiration", desc: "You regain all expended uses of Bardic Inspiration when you finish a short or long rest, instead of only a long rest." },
      { level: 6, name: "Countercharm", desc: "As an action, start a performance lasting until the end of your next turn; you and friendly creatures within 30 feet who can hear you have advantage on saves against being frightened or charmed. Ends early if you're incapacitated, silenced, or end it voluntarily." },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 10, name: "Expertise (Level 10)", desc: "Choose two more of your skill proficiencies to double your proficiency bonus for, as with your 3rd-level Expertise.",
        choice: { kind: "skill", count: 2, prompt: "Choose two more skills to gain Expertise in" } },
      { level: 10, name: "Magical Secrets", desc: "Choose two spells from any class, of a level you can cast (or a cantrip); they count as bard spells for you and count toward your total spells known. You learn two more at 14th level and two more at 18th level." },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 20, name: "Superior Inspiration", desc: "When you roll initiative and have no uses of Bardic Inspiration left, you regain one use." }
    ],
    skillChoices: { count: 3, options: ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"] },
    subclasses: [
      { name: "College of Lore", features: [
        { level: 3, name: "Bonus Proficiencies", desc: "Gain proficiency with three skills of your choice.",
          choice: { kind: "skill", count: 3, prompt: "Choose three skills to gain proficiency in" } },
        { level: 3, name: "Cutting Words", desc: "As a reaction, when a creature you can see within 60 feet makes an attack roll, ability check, or damage roll, expend a use of Bardic Inspiration and subtract the roll from that creature's result. The creature must be able to hear you and not be immune to being charmed." },
        { level: 6, name: "Additional Magical Secrets", desc: "Learn two spells of your choice from any class, of a level you can cast or a cantrip; they count as bard spells for you but don't count against your number of bard spells known." },
        { level: 14, name: "Peerless Skill", desc: "When you make an ability check, you can expend a use of Bardic Inspiration and add the roll to your check, choosing to do so after rolling but before the outcome is revealed." }
      ] }
    ]
  },
  {
    name: "Cleric", mainAbility: "Wisdom", hitDie: "d8",
    saves: ["Wisdom", "Charisma"],
    armorProf: "Light armor, medium armor, shields", weaponProf: "Simple weapons",
    description: "A priestly champion who wields divine magic in service of a higher power.",
    features: [
      { level: 1, name: "Spellcasting", desc: "Wisdom is your spellcasting ability for cleric spells, and you use a holy symbol as your spellcasting focus. You prepare a number of spells each day equal to your Wisdom modifier plus your cleric level (minimum one) and can cast any prepared cleric spell as a ritual if it has the ritual tag." },
      { level: 2, name: "Channel Divinity", desc: "Channel divine energy to fuel magical effects, starting with Turn Undead and an effect from your domain. Requires a short or long rest to use again. Usable twice between rests at 6th level and three times at 18th level.",
        resource: { max: 1, recharge: { on: "SR", amount: "all" } } },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 5, name: "Destroy Undead", desc: "When an undead fails its save against your Turn Undead effect, it is destroyed instantly if its challenge rating is 1/2 or lower. This threshold rises with level: CR 1 at 8th, CR 2 at 11th, CR 3 at 14th, CR 4 at 17th." },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 10, name: "Divine Intervention", desc: "As an action, describe the aid you seek from your deity and roll percentile dice; on a result at or below your cleric level, your deity intervenes (GM's choice of effect). If successful, you can't use this feature again for 7 days; otherwise you can try again after a long rest. At 20th level the intervention succeeds automatically, with no roll required." },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } }
    ],
    skillChoices: { count: 2, options: ["History", "Insight", "Medicine", "Persuasion", "Religion"] },
    subclasses: [
      { name: "Life Domain", features: [
        { level: 1, name: "Bonus Proficiency", desc: "You gain proficiency with heavy armor." },
        { level: 1, name: "Disciple of Life", desc: "Whenever you use a spell of 1st level or higher to restore hit points to a creature, that creature regains additional hit points equal to 2 plus the spell's level." },
        { level: 2, name: "Channel Divinity: Preserve Life", desc: "As an action, present your holy symbol to restore a number of hit points equal to five times your cleric level, divided among creatures within 30 feet as you choose. This can't restore a creature above half its hit point maximum and can't affect undead or constructs." },
        { level: 6, name: "Blessed Healer", desc: "When you cast a spell of 1st level or higher that restores hit points to a creature other than yourself, you also regain hit points equal to 2 plus the spell's level." },
        { level: 8, name: "Divine Strike", desc: "Once on each of your turns when you hit with a weapon attack, you can deal an extra 1d8 radiant damage. The extra damage increases to 2d8 at 14th level." },
        { level: 17, name: "Supreme Healing", desc: "When you would roll dice to restore hit points with a spell, instead use the highest possible number for each die." }
      ] }
    ]
  },
  {
    name: "Druid", mainAbility: "Wisdom", hitDie: "d8",
    saves: ["Intelligence", "Wisdom"],
    armorProf: "Light armor, medium armor, shields (nonmetal only)",
    weaponProf: "Clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, sickles, slings, spears",
    toolProf: "Herbalism kit",
    description: "A priest of the Old Faith, wielding the power of nature and able to take on animal forms.",
    features: [
      { level: 1, name: "Druidic", desc: "You know Druidic, the secret language of druids, and can speak it and use it to leave hidden messages that other Druidic speakers automatically spot; others need a DC 15 Wisdom (Perception) check and still can't decipher it without magic." },
      { level: 1, name: "Spellcasting", desc: "Wisdom is your spellcasting ability for druid spells. You prepare a list of druid spells drawn from the druid spell list, and you can cast a prepared spell with the ritual tag as a ritual." },
      { level: 2, name: "Wild Shape", desc: "You can use your action to magically assume the shape of a beast you have seen before, for a number of hours equal to half your druid level, reverting early as a bonus action or automatically at 0 hit points, unconsciousness, or death. At 2nd level you're limited to beasts of CR 1/4 or lower with no flying or swimming speed; this eases with level, to CR 1/2 (still no flying speed) at 4th and CR 1 at 8th (e.g. a giant eagle).",
        resource: { max: 2, recharge: { on: "SR", amount: "all" } } },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 18, name: "Timeless Body", desc: "The primal magic you wield causes you to age more slowly: for every 10 years that pass, your body ages only 1 year." },
      { level: 18, name: "Beast Spells", desc: "You can cast many of your druid spells in any shape you assume using Wild Shape, performing verbal and somatic components, though you can't provide material components." },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 20, name: "Archdruid", desc: "You can use Wild Shape an unlimited number of times, and you can ignore the verbal and somatic components of your druid spells, as well as material components that lack a cost and aren't consumed by a spell, in either your normal or beast shape." }
    ],
    skillChoices: { count: 2, options: ["Arcana", "Animal Handling", "Insight", "Medicine", "Nature", "Perception", "Religion", "Survival"] },
    subclasses: [
      { name: "Circle of the Land", features: [
        { level: 2, name: "Bonus Cantrip", desc: "When you choose this circle at 2nd level, you learn one additional druid cantrip of your choice.",
          choice: { kind: "cantrip", count: 1, prompt: "Choose an additional druid cantrip" } },
        { level: 2, name: "Natural Recovery", desc: "During a short rest, once per long rest, you can recover expended spell slots with a combined level up to half your druid level (rounded up), none 6th level or higher." },
        { level: 3, name: "Circle Spells", desc: "At 3rd, 5th, 7th, and 9th level you gain access to additional druid spells tied to the terrain you chose when you joined the circle (arctic, coastal, desert, forest, grassland, mountain, or swamp). These spells are always prepared and don't count against your prepared total." },
        { level: 6, name: "Land's Stride", desc: "Moving through nonmagical difficult terrain costs no extra movement, and you can pass through nonmagical plants with thorns or similar hazards without being slowed or damaged by them. You have advantage on saves against magically manipulated plants, such as those created by entangle." },
        { level: 10, name: "Nature's Ward", desc: "You can't be charmed or frightened by elementals or fey, and you are immune to poison and disease." },
        { level: 14, name: "Nature's Sanctuary", desc: "When a beast or plant creature attacks you, it must succeed on a Wisdom save against your druid spell save DC or choose a different target (or the attack automatically misses); success grants it immunity to this effect for 24 hours." }
      ] }
    ]
  },
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
      { level: 2, name: "Action Surge", desc: "You can take one additional action on your turn, once per short rest. Starting at 17th level you can use it twice before a rest, but only once on the same turn.",
        resource: { max: 1, recharge: { on: "SR", amount: "all" } } },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 5, name: "Extra Attack", desc: "You can attack twice, instead of once, whenever you take the Attack action on your turn." },
      { level: 6, name: "Ability Score Improvement (Level 6)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 9, name: "Indomitable", desc: "You can reroll a saving throw that you fail, using the new roll; usable once per long rest, increasing to two uses at 13th level and three uses at 17th level.",
        resource: { max: 1, recharge: { on: "LR", amount: "all" } } },
      { level: 11, name: "Extra Attack (2)", desc: "Your number of attacks with the Attack action increases to three." },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 14, name: "Ability Score Improvement (Level 14)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 20, name: "Extra Attack (3)", desc: "Your number of attacks with the Attack action increases to four." }
    ],
    skillChoices: { count: 2, options: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"] },
    subclasses: [
      { name: "Champion", features: [
        { level: 3, name: "Improved Critical", desc: "Your weapon attacks score a critical hit on a roll of 19 or 20." },
        { level: 7, name: "Remarkable Athlete", desc: "You add half your proficiency bonus (round up) to any Strength, Dexterity, or Constitution check that doesn't already use your proficiency bonus, and your running long jump distance increases by your Strength modifier." },
        { level: 10, name: "Additional Fighting Style", desc: "You can choose a second option from the Fighting Style class feature.",
          choice: { kind: "fightingStyle", count: 1, prompt: "Choose a second fighting style" } },
        { level: 15, name: "Superior Critical", desc: "Your weapon attacks score a critical hit on a roll of 18-20." },
        { level: 18, name: "Survivor", desc: "At the start of each of your turns you regain hit points equal to 5 + your Constitution modifier if you have no more than half your hit points left (not if at 0 hit points)." }
      ] }
    ]
  },
  {
    name: "Monk", mainAbility: "Dexterity", hitDie: "d8",
    saves: ["Strength", "Dexterity"],
    armorProf: "None", weaponProf: "Simple weapons, shortswords",
    toolProf: "One type of artisan's tools or one musical instrument of your choice",
    description: "A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection.",
    features: [
      { level: 1, name: "Unarmored Defense", desc: "While you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier." },
      { level: 1, name: "Martial Arts", desc: "You gain mastery of combat styles using unarmed strikes and monk weapons (shortswords and simple melee weapons without the two-handed or heavy property): use Dexterity for their attack and damage rolls, roll a martial arts die (1d4 at 1st level, 1d6 at 5th, 1d8 at 11th, 1d10 at 17th) in place of normal damage, and make one unarmed strike as a bonus action after taking the Attack action with an unarmed strike or monk weapon." },
      { level: 2, name: "Ki", desc: "You gain a pool of ki points (2 at 2nd level, rising to equal your monk level thereafter) that fuel ki features. You start knowing three: Flurry of Blows (spend 1 ki after the Attack action to make two unarmed strikes as a bonus action), Patient Defense (spend 1 ki to Dodge as a bonus action), and Step of the Wind (spend 1 ki to Disengage or Dash as a bonus action, with jump distance doubled). Spent points return on a short or long rest." },
      { level: 2, name: "Unarmored Movement", desc: "Your speed increases by 10 feet while you are not wearing armor or wielding a shield, rising to +15 ft. at 6th level, +20 ft. at 10th, +25 ft. at 14th, and +30 ft. at 18th. At 9th level you can move along vertical surfaces and across liquids on your turn without falling." },
      { level: 3, name: "Deflect Missiles", desc: "You can use your reaction to reduce damage from a ranged weapon attack that hits you by 1d10 + your Dexterity modifier + your monk level. If you reduce the damage to 0 and the missile is small enough, you can catch it and, by spending 1 ki point, make a ranged attack with it as part of the same reaction." },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 4, name: "Slow Fall", desc: "You can use your reaction when you fall to reduce any falling damage you take by an amount equal to five times your monk level." },
      { level: 5, name: "Extra Attack", desc: "You can attack twice, instead of once, whenever you take the Attack action on your turn." },
      { level: 5, name: "Stunning Strike", desc: "When you hit a creature with a melee weapon attack, you can spend 1 ki point to force a Constitution saving throw; on a failure the target is stunned until the end of your next turn." },
      { level: 6, name: "Ki-Empowered Strikes", desc: "Your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage." },
      { level: 7, name: "Evasion", desc: "When you are subjected to an effect that allows a Dexterity saving throw for half damage, you instead take no damage on a success and only half damage on a failure." },
      { level: 7, name: "Stillness of Mind", desc: "You can use your action to end one effect on yourself that is causing you to be charmed or frightened." },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 9, name: "Unarmored Movement Improvement", desc: "You gain the ability to move along vertical surfaces and across liquids on your turn without falling during the move." },
      { level: 10, name: "Purity of Body", desc: "You become immune to disease and poison." },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 13, name: "Tongue of the Sun and Moon", desc: "You understand all spoken languages, and any creature that can understand a language understands what you say." },
      { level: 14, name: "Diamond Soul", desc: "You gain proficiency in all saving throws. Additionally, when you fail a saving throw you can spend 1 ki point to reroll it and take the second result." },
      { level: 15, name: "Timeless Body", desc: "Your ki sustains you so that you suffer none of the frailty of old age (though you can still die of old age), and you no longer need food or water." },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 18, name: "Empty Body", desc: "You can spend 4 ki points to become invisible for 1 minute, gaining resistance to all damage but force damage during that time. You can spend 8 ki points to cast astral projection without material components, but can't take other creatures with you." },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 20, name: "Perfect Self", desc: "When you roll for initiative and have no ki points remaining, you regain 4 ki points." }
    ],
    skillChoices: { count: 2, options: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"] },
    subclasses: [
      { name: "Way of the Open Hand", features: [
        { level: 3, name: "Open Hand Technique", desc: "Whenever you hit a creature with an attack granted by Flurry of Blows, you can force a Dexterity saving throw to knock it prone, a Strength saving throw to push it up to 15 feet away, or prevent it from taking reactions until the end of your next turn." },
        { level: 6, name: "Wholeness of Body", desc: "As an action you can regain hit points equal to three times your monk level.",
          resource: { max: 1, recharge: { on: "LR", amount: "all" } } },
        { level: 11, name: "Tranquility", desc: "At the end of a long rest you gain the effect of a sanctuary spell (DC = 8 + your Wisdom modifier + proficiency bonus) that lasts until the start of your next long rest." },
        { level: 17, name: "Quivering Palm", desc: "When you hit a creature with an unarmed strike, you can spend 3 ki points to set up lethal vibrations lasting a number of days equal to your monk level. Using your action, you can end them: the target makes a Constitution saving throw, taking 10d10 necrotic damage on a success or being reduced to 0 hit points on a failure. Only one creature can be affected at a time." }
      ] }
    ]
  },
  {
    name: "Paladin", mainAbility: "Strength", hitDie: "d10",
    saves: ["Wisdom", "Charisma"],
    armorProf: "All armor, shields", weaponProf: "Simple weapons, martial weapons",
    description: "A holy warrior bound by a sacred oath to fight evil and protect the innocent, blending martial prowess with divine magic.",
    features: [
      { level: 1, name: "Divine Sense", desc: "As an action, open your awareness to detect celestials, fiends, and undead within 60 feet (not behind total cover) and sense consecrated or desecrated ground. Usable 1 + Charisma modifier times (minimum 1); all uses return on a long rest.",
        resource: { max: 1, recharge: { on: "LR", amount: "all" } } },
      { level: 1, name: "Lay on Hands", desc: "A pool of healing power equal to your paladin level x 5 (5 at 1st level). As an action, touch a creature to restore hit points from the pool, or expend 5 points to cure one disease or neutralize one poison. Has no effect on undead or constructs.",
        resource: { max: 5, recharge: { on: "LR", amount: "all" } } },
      { level: 2, name: "Fighting Style", desc: "Adopt a style of fighting as your specialty. You can't take the same Fighting Style option more than once.",
        choice: { kind: "fightingStyle", count: 1, prompt: "Choose a fighting style" } },
      { level: 2, name: "Spellcasting", desc: "You draw on divine magic through prayer and meditation, preparing spells from the paladin spell list. Charisma is your spellcasting ability, and you can use a holy symbol as a spellcasting focus." },
      { level: 2, name: "Divine Smite", desc: "When you hit with a melee weapon attack, you can expend a spell slot to deal extra radiant damage (2d8 for a 1st-level slot, +1d8 per slot level above 1st, max 5d8; +1d8 more against undead or fiends)." },
      { level: 3, name: "Divine Health", desc: "The divine magic flowing through you makes you immune to disease." },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 5, name: "Extra Attack", desc: "You can attack twice, instead of once, whenever you take the Attack action on your turn." },
      { level: 6, name: "Aura of Protection", desc: "You and friendly creatures within 10 feet of you gain a bonus to saving throws equal to your Charisma modifier (minimum +1). You must be conscious. Range increases to 30 feet at 18th level." },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 10, name: "Aura of Courage", desc: "You and friendly creatures within 10 feet of you can't be frightened while you are conscious. Range increases to 30 feet at 18th level." },
      { level: 11, name: "Improved Divine Smite", desc: "All your melee weapon strikes carry divine power: whenever you hit with a melee weapon, the target takes an extra 1d8 radiant damage, which stacks with Divine Smite if also used." },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 14, name: "Cleansing Touch", desc: "As an action, end one spell affecting you or a willing creature you touch. Usable a number of times equal to your Charisma modifier (minimum once); uses return on a long rest.",
        resource: { max: 1, recharge: { on: "LR", amount: "all" } } },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 18, name: "Aura Improvements", desc: "The range of your Aura of Protection and Aura of Courage increases to 30 feet." },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } }
    ],
    skillChoices: { count: 2, options: ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"] },
    subclasses: [
      { name: "Oath of Devotion", features: [
        { level: 3, name: "Channel Divinity: Sacred Weapon and Turn the Unholy", desc: "Sacred Weapon: as an action, imbue a weapon you hold with positive energy for 1 minute, adding your Charisma modifier (min +1) to its attack rolls and making it magical and light-emitting. Turn the Unholy: as an action, force fiends and undead within 30 feet to make a Wisdom save or be turned for 1 minute. Regain use on finishing a short or long rest.",
          resource: { max: 1, recharge: { on: "SR", amount: "all" } } },
        { level: 7, name: "Aura of Devotion", desc: "You and friendly creatures within 10 feet of you can't be charmed while you are conscious. Range increases to 30 feet at 18th level." },
        { level: 15, name: "Purity of Spirit", desc: "You are always under the effect of a protection from evil and good spell." },
        { level: 20, name: "Holy Nimbus", desc: "As an action, emanate bright light in a 30-foot radius (dim light 30 feet beyond) for 1 minute. Enemies starting their turn in the bright light take 10 radiant damage, and you have advantage on saving throws against spells cast by fiends or undead for the duration." }
      ] }
    ]
  },
  {
    name: "Ranger", mainAbility: "Dexterity", hitDie: "d10",
    saves: ["Strength", "Dexterity"],
    armorProf: "Light armor, medium armor, shields", weaponProf: "Simple weapons, martial weapons",
    description: "A warrior of the wilds who combines martial prowess with primal magic, skilled at tracking, surviving, and hunting down enemies.",
    features: [
      { level: 1, name: "Favored Enemy", desc: "Choose a type of favored enemy (or two humanoid races). You have advantage on Wisdom (Survival) checks to track them and Intelligence checks to recall information about them, and you learn one language they speak. You choose an additional favored enemy and language at 6th and 14th level." },
      { level: 1, name: "Natural Explorer", desc: "Choose a favored terrain type. Your proficiency bonus is doubled for related Intelligence or Wisdom checks, and while traveling for an hour or more there you ignore difficult terrain, can't get lost except by magic, stay alert while multitasking, move stealthily at normal pace when alone, forage double food, and learn extra tracking detail. You choose additional favored terrain at 6th and 10th level." },
      { level: 2, name: "Fighting Style", desc: "Adopt a style of fighting as your specialty. You can't take the same Fighting Style option more than once.",
        choice: { kind: "fightingStyle", count: 1, prompt: "Choose a fighting style" } },
      { level: 2, name: "Spellcasting", desc: "You draw on the magic of nature to cast spells, learning a fixed number of spells known from the ranger spell list rather than preparing them. Wisdom is your spellcasting ability." },
      { level: 3, name: "Primeval Awareness", desc: "As an action, expend a ranger spell slot to sense whether aberrations, celestials, dragons, elementals, fey, fiends, and undead are present within 1 mile (6 miles in favored terrain) for 1 minute per spell level expended. Doesn't reveal location or number." },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 5, name: "Extra Attack", desc: "You can attack twice, instead of once, whenever you take the Attack action on your turn." },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 8, name: "Land's Stride", desc: "Moving through nonmagical difficult terrain costs no extra movement, and you pass through nonmagical plants without being slowed or damaged by hazards like thorns. You have advantage on saves against magically manipulated impeding plants." },
      { level: 10, name: "Hide in Plain Sight", desc: "Spend 1 minute creating camouflage from natural materials; while pressed against a matching surface without moving or acting, you gain a +10 bonus to Dexterity (Stealth) checks." },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 14, name: "Vanish", desc: "You can use the Hide action as a bonus action on your turn, and you can't be tracked by nonmagical means unless you choose to leave a trail." },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 18, name: "Feral Senses", desc: "Attacking a creature you can't see no longer imposes disadvantage on your attack rolls against it, and you're aware of the location of any invisible creature within 30 feet of you (unless it's hidden from you or you're blinded/deafened)." },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 20, name: "Foe Slayer", desc: "Once on each of your turns, add your Wisdom modifier to the attack or damage roll of an attack you make against one of your favored enemies. You can decide to use this before or after the roll." }
    ],
    skillChoices: { count: 3, options: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"] },
    subclasses: [
      { name: "Hunter", features: [
        { level: 3, name: "Hunter's Prey", desc: "Gain one Hunter's Prey option: Colossus Slayer (extra 1d8 damage once per turn to a foe below its hit point maximum), Giant Killer (reaction attack against a Large or larger creature that hits or misses you), or Horde Breaker (once per turn, an additional weapon attack against a different nearby foe).",
          choice: { kind: "custom", count: 1, prompt: "Choose a Hunter's Prey option",
            options: [
              { label: "Colossus Slayer" },
              { label: "Giant Killer" },
              { label: "Horde Breaker" }
            ] } },
        { level: 7, name: "Defensive Tactics", desc: "Gain one Defensive Tactics option: Escape the Horde (opportunity attacks against you have disadvantage), Multiattack Defense (+4 AC against subsequent attacks from a creature that just hit you this turn), or Steel Will (advantage on saves against being frightened).",
          choice: { kind: "custom", count: 1, prompt: "Choose a Defensive Tactics option",
            options: [
              { label: "Escape the Horde" },
              { label: "Multiattack Defense" },
              { label: "Steel Will" }
            ] } },
        { level: 11, name: "Multiattack", desc: "Gain one Multiattack option: Volley (ranged attack against any number of creatures within 10 feet of a point in range, separate attack roll each) or Whirlwind Attack (melee attack against any number of creatures within 5 feet of you, separate attack roll each).",
          choice: { kind: "custom", count: 1, prompt: "Choose a Multiattack option",
            options: [
              { label: "Volley" },
              { label: "Whirlwind Attack" }
            ] } },
        { level: 15, name: "Superior Hunter's Defense", desc: "Gain one Superior Hunter's Defense option: Evasion (no damage on a successful Dex save against a half-damage effect, half on failure), Stand Against the Tide (redirect a missed melee attack against you onto another creature), or Uncanny Dodge (reaction to halve an attack's damage against you).",
          choice: { kind: "custom", count: 1, prompt: "Choose a Superior Hunter's Defense option",
            options: [
              { label: "Evasion" },
              { label: "Stand Against the Tide" },
              { label: "Uncanny Dodge" }
            ] } }
      ] }
    ]
  },
  {
    name: "Rogue", mainAbility: "Dexterity", hitDie: "d8",
    saves: ["Dexterity", "Intelligence"],
    armorProf: "Light armor", weaponProf: "Simple weapons, hand crossbows, longswords, rapiers, shortswords",
    toolProf: "Thieves' tools",
    description: "A scoundrel who uses stealth, cunning, and a wide array of skills to overcome obstacles and outmaneuver enemies.",
    features: [
      { level: 1, name: "Expertise", desc: "Choose two of your skill proficiencies, or one skill proficiency and your thieves' tools proficiency. Your proficiency bonus is doubled for ability checks using either.",
        choice: { kind: "skill", count: 2, prompt: "Choose two proficiencies (skills or thieves' tools) to gain Expertise in" } },
      { level: 1, name: "Sneak Attack", desc: "Once per turn, deal an extra 1d6 damage (scaling up to 10d6 by 20th level per the class table) to one creature you hit with a finesse or ranged weapon attack, if you have advantage on the roll, or if another enemy of the target is within 5 feet of it and you don't have disadvantage." },
      { level: 1, name: "Thieves' Cant", desc: "You know thieves' cant, a secret mix of dialect, jargon, and code for hiding messages in normal conversation, plus a set of secret signs and symbols." },
      { level: 2, name: "Cunning Action", desc: "You can take a bonus action on each of your turns in combat to Dash, Disengage, or Hide." },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 5, name: "Uncanny Dodge", desc: "When an attacker you can see hits you with an attack, you can use your reaction to halve the attack's damage against you." },
      { level: 6, name: "Expertise (Level 6)", desc: "Choose two more of your proficiencies (skills or thieves' tools) to gain Expertise in, doubling your proficiency bonus for ability checks using them.",
        choice: { kind: "skill", count: 2, prompt: "Choose two more proficiencies (skills or thieves' tools) to gain Expertise in" } },
      { level: 7, name: "Evasion", desc: "When subjected to an effect that allows a Dexterity save to take only half damage, you take no damage on a success and only half damage on a failure." },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 10, name: "Ability Score Improvement (Level 10)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 11, name: "Reliable Talent", desc: "Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10." },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 14, name: "Blindsense", desc: "If you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you." },
      { level: 15, name: "Slippery Mind", desc: "You gain proficiency in Wisdom saving throws." },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 18, name: "Elusive", desc: "No attack roll has advantage against you while you aren't incapacitated." },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 20, name: "Stroke of Luck", desc: "If your attack misses a target within range, you can turn the miss into a hit. Alternatively, if you fail an ability check, you can treat the d20 roll as a 20. Once used, you can't use it again until a short or long rest.",
        resource: { max: 1, recharge: { on: "SR", amount: "all" } } }
    ],
    skillChoices: { count: 4, options: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Performance", "Persuasion", "Sleight of Hand", "Stealth"] },
    subclasses: [
      { name: "Thief", features: [
        { level: 3, name: "Fast Hands", desc: "You can use the bonus action granted by Cunning Action to make a Dexterity (Sleight of Hand) check, use thieves' tools to disarm a trap or open a lock, or take the Use an Object action." },
        { level: 3, name: "Second-Story Work", desc: "Climbing no longer costs extra movement, and when you make a running jump, the distance you cover increases by your Dexterity modifier." },
        { level: 9, name: "Supreme Sneak", desc: "You have advantage on a Dexterity (Stealth) check if you move no more than half your speed on the same turn." },
        { level: 13, name: "Use Magic Device", desc: "You ignore all class, race, and level requirements on the use of magic items." },
        { level: 17, name: "Thief's Reflexes", desc: "You can take two turns during the first round of any combat: your first turn at normal initiative, your second at initiative minus 10. You can't use this feature while surprised." }
      ] }
    ]
  },
  {
    name: "Sorcerer", mainAbility: "Charisma", hitDie: "d6",
    saves: ["Constitution", "Charisma"],
    armorProf: "None", weaponProf: "Daggers, darts, slings, quarterstaffs, light crossbows",
    description: "Scions of innately magical bloodlines, sorcerers draw arcane power from within rather than from study or pact.",
    features: [
      { level: 1, name: "Spellcasting", desc: "Charisma is your spellcasting ability. You know a small number of sorcerer spells and cantrips, chosen from the sorcerer spell list, without a spellbook." },
      { level: 2, name: "Font of Magic", desc: "You gain sorcery points, which you can convert into spell slots (as a bonus action, up to 5th level) or convert spell slots into sorcery points.",
        resource: { max: 2, recharge: { on: "LR", amount: "all" } } },
      { level: 3, name: "Metamagic", desc: "You gain two Metamagic options of your choice (Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle, or Twinned Spell), spent using sorcery points to twist how your spells function. You gain another option at 10th and 17th level." },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 20, name: "Sorcerous Restoration", desc: "You regain 4 expended sorcery points whenever you finish a short rest.",
        resource: { max: 4, recharge: { on: "SR", amount: "all" } } }
    ],
    skillChoices: { count: 2, options: ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"] },
    subclasses: [
      { name: "Draconic Bloodline", features: [
        { level: 1, name: "Dragon Ancestor", desc: "Choose one type of dragon as your ancestor, which fixes the damage type used by later features. You can speak, read, and write Draconic, and your proficiency bonus is doubled on Charisma checks with dragons." },
        { level: 1, name: "Draconic Resilience", desc: "Your hit point maximum increases by 1, and by 1 again whenever you gain a level in this class. While not wearing armor, your AC equals 13 + your Dexterity modifier." },
        { level: 6, name: "Elemental Affinity", desc: "When you cast a spell dealing damage of your draconic ancestry's type, add your Charisma modifier to one damage roll; you can also spend 1 sorcery point to gain resistance to that damage type for 1 hour." },
        { level: 14, name: "Dragon Wings", desc: "As a bonus action, sprout dragon wings granting a flying speed equal to your current speed until you dismiss them as a bonus action. You can't manifest them while wearing armor not made to accommodate them." },
        { level: 18, name: "Draconic Presence", desc: "As an action, spend 5 sorcery points to exude a 60-foot aura of awe or fear for 1 minute; hostile creatures starting their turn in it must succeed on a Wisdom save or be charmed (awe) or frightened (fear) until the aura ends." }
      ] }
    ]
  },
  {
    name: "Warlock", mainAbility: "Charisma", hitDie: "d8",
    saves: ["Wisdom", "Charisma"],
    armorProf: "Light armor", weaponProf: "Simple weapons",
    description: "A wielder of magic derived from a bargain with an extraplanar entity, the warlock's power comes from pact rather than study or bloodline.",
    features: [
      { level: 1, name: "Spellcasting", desc: "Charisma is your spellcasting ability for Pact Magic. Unlike other casters, your spell slots are few, are all the same level, and recharge on a short rest rather than a long rest, and you always cast at that fixed slot level." },
      { level: 2, name: "Eldritch Invocations", desc: "You gain eldritch invocations, fragments of forbidden knowledge granting magical abilities, choosing from a growing list as you level. You gain two at 2nd level and more at higher levels; you can swap one out whenever you gain a warlock level." },
      { level: 3, name: "Pact Boon", desc: "Your patron bestows a gift: Pact of the Chain (an enhanced familiar), Pact of the Blade (a summonable magic weapon), or Pact of the Tome (a Book of Shadows granting extra ritual-cast cantrips)." },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 11, name: "Mystic Arcanum (6th level)", desc: "Choose one 6th-level warlock spell as an arcanum. You can cast it once without expending a spell slot; you must finish a long rest before doing so again." },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 13, name: "Mystic Arcanum (7th level)", desc: "You gain a 7th-level arcanum, usable once per long rest without expending a spell slot." },
      { level: 15, name: "Mystic Arcanum (8th level)", desc: "You gain an 8th-level arcanum, usable once per long rest without expending a spell slot." },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 17, name: "Mystic Arcanum (9th level)", desc: "You gain a 9th-level arcanum, usable once per long rest without expending a spell slot." },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 20, name: "Eldritch Master", desc: "Spend 1 minute entreating your patron to regain all expended Pact Magic spell slots. You must finish a long rest before doing so again.",
        resource: { max: 1, recharge: { on: "LR", amount: "all" } } }
    ],
    skillChoices: { count: 2, options: ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"] },
    subclasses: [
      { name: "The Fiend", features: [
        { level: 1, name: "Dark One's Blessing", desc: "When you reduce a hostile creature to 0 hit points, you gain temporary hit points equal to your Charisma modifier + your warlock level (minimum 1)." },
        { level: 6, name: "Dark One's Own Luck", desc: "You can add a d10 to an ability check or saving throw after seeing the roll but before its effects occur. Usable once per short or long rest.",
          resource: { max: 1, recharge: { on: "SR", amount: "all" } } },
        { level: 10, name: "Fiendish Resilience", desc: "When you finish a short or long rest, choose a damage type; you gain resistance to it until you choose a different type with this feature. Magical and silver weapons ignore this resistance." },
        { level: 14, name: "Hurl Through Hell", desc: "When you hit a creature with an attack, you can instantly transport it through the lower planes; it returns at the end of your next turn, taking 10d10 psychic damage if it is not a fiend. Usable once per long rest.",
          resource: { max: 1, recharge: { on: "LR", amount: "all" } } }
      ] }
    ]
  },
  {
    name: "Wizard", mainAbility: "Intelligence", hitDie: "d6",
    saves: ["Intelligence", "Wisdom"],
    armorProf: "None", weaponProf: "Daggers, darts, slings, quarterstaffs, light crossbows",
    description: "A scholarly magic-user capable of manipulating the structures of reality, wizards learn their spells through rigorous study recorded in a spellbook.",
    features: [
      { level: 1, name: "Spellcasting", desc: "Intelligence is your spellcasting ability. You keep spells in a spellbook and prepare a number of them each day; several wizard spells can be cast as rituals straight from the spellbook without expending a slot." },
      { level: 1, name: "Arcane Recovery", desc: "Once per day when you finish a short rest, you can recover expended spell slots with a combined level up to half your wizard level (rounded up), none 6th level or higher.",
        resource: { max: 1, recharge: { on: "LR", amount: "all" } } },
      { level: 4, name: "Ability Score Improvement", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 8, name: "Ability Score Improvement (Level 8)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 12, name: "Ability Score Improvement (Level 12)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 16, name: "Ability Score Improvement (Level 16)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 18, name: "Spell Mastery", desc: "Choose a 1st-level and a 2nd-level wizard spell in your spellbook. You can cast them at their lowest level at will without expending a spell slot when prepared; 8 hours of study lets you swap either choice." },
      { level: 19, name: "Ability Score Improvement (Level 19)", desc: "Increase one ability score by 2, or two ability scores by 1 each (use the manual choice option in-app for a +1/+1 split). Can't exceed 20.",
        choice: { kind: "custom", count: 1, prompt: "Choose an ability score to increase by 2 (or use 'Or manage it yourself' below for a +1/+1 split)",
          options: [
            { label: "Strength +2", effects: [{ category: "Ability Score", value: { ability: "STR", amount: 2 } }] },
            { label: "Dexterity +2", effects: [{ category: "Ability Score", value: { ability: "DEX", amount: 2 } }] },
            { label: "Constitution +2", effects: [{ category: "Ability Score", value: { ability: "CON", amount: 2 } }] },
            { label: "Intelligence +2", effects: [{ category: "Ability Score", value: { ability: "INT", amount: 2 } }] },
            { label: "Wisdom +2", effects: [{ category: "Ability Score", value: { ability: "WIS", amount: 2 } }] },
            { label: "Charisma +2", effects: [{ category: "Ability Score", value: { ability: "CHA", amount: 2 } }] }
          ] } },
      { level: 20, name: "Signature Spells", desc: "Choose two 3rd-level wizard spells in your spellbook as signature spells. You always have them prepared, and can cast each once at 3rd level without expending a slot, regaining the use on a short or long rest.",
        resource: { max: 1, recharge: { on: "SR", amount: "all" } } }
    ],
    skillChoices: { count: 2, options: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"] },
    subclasses: [
      { name: "School of Evocation", features: [
        { level: 2, name: "Evocation Savant", desc: "The gold and time you must spend to copy an evocation spell into your spellbook is halved." },
        { level: 2, name: "Sculpt Spells", desc: "When you cast an evocation spell affecting other creatures you can see, you can choose a number of them equal to 1 + the spell's level; they automatically succeed on their saving throws and take no damage if they would normally take half damage." },
        { level: 6, name: "Potent Cantrip", desc: "When a creature succeeds on a saving throw against your damaging cantrip, it still takes half the cantrip's damage but suffers no additional effect." },
        { level: 10, name: "Empowered Evocation", desc: "You can add your Intelligence modifier to one damage roll of any wizard evocation spell you cast." },
        { level: 14, name: "Overchannel", desc: "When you cast a wizard spell of 1st through 5th level that deals damage, you can deal maximum damage. The first use each long rest is free; further uses before a long rest deal you increasing necrotic damage (2d12 per spell level, +1d12 each subsequent use), ignoring resistance and immunity." }
      ] }
    ]
  }
];
