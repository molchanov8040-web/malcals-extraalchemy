/* Ready potions and script compendia — Foundry VTT 13. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  const PACKS = {
    potions: "malcals-extraalchemy-potions",
    scripts: "malcals-extraalchemy-potion-scripts"
  };
  const potionFlag = "ready-potion";
  const macroFlag = "ready-potion-script";
  const packId = name => `world.${name}`;

  // Clean, single-slot version of the supplied lyrium script.
  // One point restores one first-level spell slot, if one is expended.
  const lyriumScript = `const actor = args?.[0]?.actor ?? this.actor ?? game.user.character ?? canvas.tokens.controlled[0]?.actor;
if (!actor) return ui.notifications.warn("Не удалось определить персонажа.");
const spell = actor.system.spells?.spell1;
if (!spell) return ui.notifications.warn("У персонажа нет ячеек заклинаний первого круга.");
const current = Number(spell.value ?? 0);
const maximum = Number(spell.max ?? 0);
if (current >= maximum) return ui.notifications.info("Ячейка первого круга уже восстановлена.");
await actor.update({ "system.spells.spell1.value": current + 1 });
ui.notifications.info(60${actor.name} восстановил одну ячейку заклинаний первого круга.0);`;

  const potionSeeds = () => [
    {
      id: "small-healing-poultice",
      name: "Малая целебная припарка",
      img: "icons/consumables/potions/potion-bottle-corked-red.webp",
      description: "<blockquote><p>Припарка для лечения незначительных порезов и ушибов.</p></blockquote><p>Восстанавливает <b>2d4 + 2 ПЗ</b>.</p><p>Применение: бонусное действие, к выпившему существу. Предмет расходуется.</p>",
      kind: "healing",
      healing: { number: 2, denomination: 4, bonus: "2", types: ["healing"], custom: { enabled: false, formula: "" }, scaling: { mode: "whole", number: null, formula: "" } }
    },
    {
      id: "minor-lyrium-potion",
      name: "Малое зелье лириума",
      img: "icons/consumables/potions/potion-bottle-corked-blue.webp",
      description: "<blockquote><p>Малое зелье лириума.</p></blockquote><p>Восстанавливает <b>одну ячейку заклинаний первого круга</b>, если она потрачена.</p><p>Приложенный скрипт хранится в компендиуме «Скрипты зелий».</p>",
      kind: "lyrium"
    }
  ];

  const createPack = async (name, label, type) => {
    let pack = game.packs.get(packId(name));
    if (!pack && game.user.isGM) {
      const Collection = globalThis.CompendiumCollection ?? foundry.documents.collections.CompendiumCollection;
      pack = await Collection.createCompendium({ type, name, label, package: "world" });
    }
    return pack ?? null;
  };

  const seedPotionPack = async () => {
    const pack = await createPack(PACKS.potions, "Готовые зелья", "Item");
    if (!pack) return;
    const docs = await pack.getDocuments();
    const existing = new Set(docs.map(d => d.getFlag(E.id, potionFlag)?.id).filter(Boolean));
    const missing = potionSeeds().filter(seed => !existing.has(seed.id)).map(seed => {
      const activity = seed.kind === "healing" ? {
        "ea-poultice-heal": {
          _id: "ea-poultice-heal", type: "heal",
          activation: { type: "bonus", value: 1, condition: "", override: false },
          consumption: { targets: [{ type: "itemUses", value: "1", target: "", scaling: {} }], scaling: { allowed: false, max: "" }, spellSlot: true },
          duration: { concentration: false, value: "", units: "inst", special: "", override: false },
          effects: [], range: { units: "any", special: "", override: false },
          target: { template: { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: "ft", stationary: false }, affects: { count: "1", type: "creature", choice: false, special: "" }, prompt: true, override: false },
          uses: { spent: 0, max: "", recovery: [] }, healing: seed.healing,
          sort: 0, name: "Лечение", img: null, flags: {},
          description: { chatFlavor: "Малая целебная припарка" },
          visibility: { level: {}, requireAttunement: false, requireIdentification: false, requireMagic: false },
          useConditionText: "", useConditionReason: "", effectConditionText: "", otherActivityId: null
        }
      } : {};
      return {
        name: seed.name, type: "consumable", img: seed.img,
        system: {
          description: { value: seed.description, chat: "" },
          source: { custom: "Malcal's ExtraAlchemy", revision: 1, rules: "2014", book: "" },
          identified: true, unidentified: { description: "" }, container: null,
          quantity: 1, weight: { value: 0.2, units: "lb" }, price: { value: 10, denomination: "gp" },
          rarity: "common", attunement: "", uses: { spent: 0, max: "1", autoDestroy: true, recovery: [] },
          damage: { base: { number: null, denomination: null, bonus: "", types: [], custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } }, replace: false },
          type: { value: "potion", subtype: "" }, properties: [], activities: activity,
          identifier: seed.id, attuned: false, equipped: false
        },
        flags: { [E.id]: { [potionFlag]: { id: seed.id, kind: seed.kind, scriptCompendium: seed.kind === "lyrium" ? packId(PACKS.scripts) : null } } }
      };
    });
    if (missing.length) await pack.documentClass.createDocuments(missing, { pack: pack.collection });
  };

  const seedScriptPack = async () => {
    const pack = await createPack(PACKS.scripts, "Скрипты зелий", "Macro");
    if (!pack) return;
    const docs = await pack.getDocuments();
    if (docs.some(d => d.getFlag(E.id, macroFlag)?.id === "minor-lyrium-restore-1")) return;
    await pack.documentClass.createDocuments([{
      name: "Малое зелье лириума — восстановить 1 ячейку",
      type: "script", img: "icons/svg/dice-target.svg", command: lyriumScript,
      scope: "global", ownership: { default: 0 },
      flags: { [E.id]: { [macroFlag]: { id: "minor-lyrium-restore-1", potionId: "minor-lyrium-potion", restoredSpellLevel: 1, restoredSlots: 1 } } }
    }], { pack: pack.collection });
  };

  E.ensurePotionLibraries = async () => {
    if (!game.user.isGM) return;
    await seedPotionPack();
    await seedScriptPack();
  };

  Hooks.once("ready", async () => {
    if (!game.user.isGM) return;
    try {
      await E.ensurePotionLibraries();
      console.info(`${E.id} | Ready-potion compendia initialized.`);
    } catch (error) {
      console.error(`${E.id} | Ready-potion compendium setup failed`, error);
    }
  });
})();
