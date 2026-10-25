/* Ready potions, script compendium and compendium-based crafting for Foundry VTT 13. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  const PACKS = {
    potions: "malcals-extraalchemy-potions",
    scripts: "malcals-extraalchemy-potion-scripts"
  };
  const POTION_FLAG = "ready-potion";
  const MACRO_FLAG = "ready-potion-script";
  const worldPackId = name => `world.${name}`;

  const normalizeName = name => String(name ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const esc = value => E.esc ? E.esc(value) : String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));

  const potionSeeds = () => [
    {
      id: "small-healing-poultice",
      name: "Малая целебная припарка",
      img: "modules/malcals-extraalchemy/assets/images/potions/small-healing-poultice.webp",
      description: "<blockquote><p>Припарка для лечения незначительных порезов и ушибов.</p></blockquote><p>Восстанавливает <b>2d4 + 2 ПЗ</b>.</p><p>Использование: бонусное действие. Предмет расходуется после применения.</p>",
      kind: "healing",
      healing: { number: 2, denomination: 4, bonus: "2" }
    },
    {
      id: "healing-poultice",
      name: "Целебная припарка",
      img: "modules/malcals-extraalchemy/assets/images/potions/healing-poultice.webp",
      description: "<blockquote><p>Целебная припарка для серьёзных ран.</p></blockquote><p>Восстанавливает <b>4d4 + 4 ПЗ</b>.</p><p>Использование: бонусное действие. Предмет расходуется после применения.</p>",
      kind: "healing",
      healing: { number: 4, denomination: 4, bonus: "4" }
    },
    {
      id: "large-healing-poultice",
      name: "Большая целебная припарка",
      img: "modules/malcals-extraalchemy/assets/images/potions/large-healing-poultice.webp",
      description: "<blockquote><p>Большая припарка, пропитанная концентрированным лечебным составом.</p></blockquote><p>Восстанавливает <b>8d4 + 8 ПЗ</b>.</p><p>Использование: бонусное действие. Предмет расходуется после применения.</p>",
      kind: "healing",
      healing: { number: 8, denomination: 4, bonus: "8" }
    },
    {
      id: "strong-healing-poultice",
      name: "Сильная целебная припарка",
      img: "modules/malcals-extraalchemy/assets/images/potions/strong-healing-poultice.webp",
      description: "<blockquote><p>Сильная целебная припарка для тяжёлых ранений.</p></blockquote><p>Восстанавливает <b>10d4 + 20 ПЗ</b>.</p><p>Использование: бонусное действие. Предмет расходуется после применения.</p>",
      kind: "healing",
      healing: { number: 10, denomination: 4, bonus: "20" }
    },
    {
      id: "minor-lyrium-potion",
      name: "Малое Зелье лириума",
      img: "modules/malcals-extraalchemy/assets/images/potions/minor-lyrium-potion.webp",
      description: "<blockquote><p>Малое зелье лириума.</p></blockquote><p>Восстанавливает <b>1 круг заклинаний</b>.</p>",
      kind: "lyrium",
      restoredSlots: 1
    },
    {
      id: "ordinary-lyrium-potion",
      name: "Обычное Зелье лириума",
      img: "modules/malcals-extraalchemy/assets/images/potions/ordinary-lyrium-potion.webp",
      description: "<blockquote><p>Обычное зелье лириума.</p></blockquote><p>Восстанавливает <b>2 круга заклинаний</b>.</p>",
      kind: "lyrium",
      restoredSlots: 2
    },
    {
      id: "large-lyrium-potion",
      name: "Большое Зелье лириума",
      img: "modules/malcals-extraalchemy/assets/images/potions/large-lyrium-potion.webp",
      description: "<blockquote><p>Большое зелье лириума.</p></blockquote><p>Восстанавливает <b>3 круга заклинаний</b>.</p>",
      kind: "lyrium",
      restoredSlots: 3
    },
    {
      id: "potent-lyrium-potion",
      name: "Сильнодействующее Зелье лириума",
      img: "modules/malcals-extraalchemy/assets/images/potions/potent-lyrium-potion.webp",
      description: "<blockquote><p>Сильнодействующее зелье лириума.</p></blockquote><p>Восстанавливает <b>5 кругов заклинаний</b>.</p>",
      kind: "lyrium",
      restoredSlots: 5
    }
  ];

  const lyriumScript = restoredSlots => `const workflow = typeof args !== "undefined" ? (Array.isArray(args) ? args[0] : args) : null;
const actor = workflow?.actor ?? this?.actor ?? game.user.character ?? canvas.tokens.controlled[0]?.actor;
const amount = ${Number(restoredSlots) || 1};
if (!actor) return ui.notifications.warn("Не удалось определить персонажа.");
const spells = actor.system.spells;
if (!spells) return ui.notifications.warn("У персонажа нет данных о ячейках заклинаний.");

const updates = {};
let remaining = amount;
const restored = [];
for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  if (remaining <= 0) break;
  const key = \`spell\${level}\`;
  const slot = spells[key];
  if (!slot) continue;
  const current = Number(slot.value ?? 0);
  const maximum = Number(slot.max ?? 0);
  if (current >= maximum) continue;
  updates[\`system.spells.\${key}.value\`] = current + 1;
  restored.push(\`\${level}-го круга\`);
  remaining -= 1;
}
if (!restored.length) return ui.notifications.info("Все ячейки заклинаний уже восстановлены.");
await actor.update(updates);
ui.notifications.info(\`\${actor.name}: восстановлены ячейки \${restored.join(", ")}.\`);`;

  const makePack = async (name, label, type) => {
    let pack = game.packs.get(worldPackId(name));
    if (!pack && game.user.isGM) {
      const Collection = globalThis.CompendiumCollection ?? foundry.documents.collections.CompendiumCollection;
      pack = await Collection.createCompendium({ type, name, label, package: "world" });
    }
    return pack ?? null;
  };

  const itemDataFor = (seed, macro) => {
    const activityId = foundry.utils.randomID(16);
    const healing = seed.healing;
    const activities = seed.kind === "healing" ? {
      [activityId]: {
        _id: activityId,
        type: "heal",
        name: "Лечение",
        img: null,
        activation: { type: "bonus", value: 1, condition: "", override: false },
        consumption: {
          targets: [{ type: "itemUses", value: "1", target: "", scaling: {} }],
          scaling: { allowed: false, max: "" },
          spellSlot: true
        },
        description: { chatFlavor: seed.name },
        duration: { concentration: false, value: "", units: "inst", special: "", override: false },
        effects: [],
        range: { units: "any", special: "", override: false },
        target: {
          template: { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: "ft", stationary: false },
          affects: { count: "1", type: "creature", choice: false, special: "" },
          prompt: true,
          override: false
        },
        uses: { spent: 0, max: "", recovery: [] },
        healing: {
          number: healing.number,
          denomination: healing.denomination,
          bonus: healing.bonus,
          types: ["healing"],
          custom: { enabled: false, formula: "" },
          scaling: { mode: "whole", number: null, formula: "" }
        },
        sort: 0,
        flags: {},
        visibility: { level: {}, requireAttunement: false, requireIdentification: false, requireMagic: false },
        useConditionText: "",
        useConditionReason: "",
        effectConditionText: "",
        otherActivityId: null,
        macroData: { name: "", command: "" },
        midiProperties: {
          ignoreTraits: [], triggeredActivityId: "none", triggeredActivityConditionText: "",
          triggeredActivityTargets: "targets", triggeredActivityRollAs: "self", triggeredActivityConsume: true,
          triggeredActivityConfigure: true, autoConsume: false, forceConsumeDialog: "default",
          forceRollDialog: "default", forceDamageDialog: "default", confirmTargets: "default",
          autoTargetType: "any", autoTargetAction: "default", automationOnly: false,
          otherActivityCompatible: true, otherActivityAsParentType: true, identifier: "",
          displayActivityName: false, rollMode: "default", chooseEffects: false, toggleEffect: false,
          ignoreFullCover: false, removeChatButtons: "default", magicEffect: false, magicDamage: false,
          noConcentrationCheck: false, skipConcentrationCheck: false, autoCEEffects: "default"
        }
      }
    } : {};

    const macroName = macro?.name ?? "";
    return {
      name: seed.name,
      type: "consumable",
      img: seed.img,
      system: {
        description: { value: seed.description, chat: "" },
        source: { custom: "Malcal's ExtraAlchemy", revision: 1, rules: "2014", book: "" },
        identified: true,
        unidentified: { description: "" },
        container: null,
        quantity: 1,
        weight: { value: 0.2, units: "lb" },
        price: { value: 10, denomination: "gp" },
        rarity: "common",
        attunement: "",
        uses: { spent: 0, max: "1", autoDestroy: true, recovery: [] },
        damage: {
          base: {
            number: seed.kind === "healing" ? healing.number : null,
            denomination: seed.kind === "healing" ? healing.denomination : null,
            bonus: seed.kind === "healing" ? healing.bonus : "",
            types: seed.kind === "healing" ? ["healing"] : [],
            custom: { enabled: false, formula: "" },
            scaling: { mode: "", number: null, formula: "" }
          },
          replace: false
        },
        type: { value: "potion", subtype: "" },
        properties: [],
        activities,
        identifier: seed.id,
        attuned: false,
        equipped: false
      },
      flags: {
        [E.id]: { [POTION_FLAG]: { id: seed.id, kind: seed.kind, restoredSlots: seed.restoredSlots ?? 0 } },
        ...(seed.kind === "lyrium" && macro ? { "midi-qol": { onUseMacroName: `[postActiveEffects]${macroName}[${macro.uuid}]` } } : {})
      }
    };
  };

  const seedMacroPack = async () => {
    const pack = await makePack(PACKS.scripts, "Скрипты зелий", "Macro");
    if (!pack) return new Map();
    const docs = await pack.getDocuments();
    const result = new Map();
    for (const seed of potionSeeds().filter(entry => entry.kind === "lyrium")) {
      const macroId = `${seed.id}-restore`;
      const name = `${seed.name} — восстановить ${seed.restoredSlots} круг${seed.restoredSlots === 1 ? "" : seed.restoredSlots < 5 ? "а" : "ов"}`;
      const command = lyriumScript(seed.restoredSlots);
      let macro = docs.find(d => d.getFlag(E.id, MACRO_FLAG)?.id === macroId);
      if (!macro) {
        [macro] = await pack.documentClass.createDocuments([{
          name,
          type: "script",
          img: "icons/svg/dice-target.svg",
          command,
          scope: "global",
          ownership: { default: 0 },
          flags: { [E.id]: { [MACRO_FLAG]: { id: macroId, potionId: seed.id, restoredSlots: seed.restoredSlots } } }
        }], { pack: pack.collection });
      } else if (macro.command !== command || macro.name !== name) {
        await macro.update({ command, name });
      }
      result.set(seed.id, macro);
    }
    return result;
  };

  const seedPotionPack = async macros => {
    const pack = await makePack(PACKS.potions, "Готовые зелья", "Item");
    if (!pack) return;
    const docs = await pack.getDocuments();
    for (const seed of potionSeeds()) {
      const existing = docs.find(d => d.getFlag(E.id, POTION_FLAG)?.id === seed.id) ?? docs.find(d => normalizeName(d.name) === normalizeName(seed.name));
      const data = itemDataFor(seed, macros.get(seed.id));
      if (existing) await existing.update(data);
      else await pack.documentClass.createDocuments([data], { pack: pack.collection });
    }
  };

  E.ensurePotionLibraries = async () => {
    if (!game.user.isGM) return;
    const macros = await seedMacroPack();
    await seedPotionPack(macros);
  };

  const findNamedItems = async name => {
    const matches = [];
    for (const pack of game.packs) {
      if (pack.documentName !== "Item") continue;
      const index = await pack.getIndex({ fields: ["name"] });
      for (const entry of index) {
        if (normalizeName(entry.name) !== normalizeName(name)) continue;
        const document = await pack.getDocument(entry._id);
        if (document) matches.push({ pack, document });
      }
    }
    return matches;
  };

  const sourceInfo = pack => {
    const metadata = pack?.metadata ?? {};
    const packageId = metadata.packageName ?? metadata.packageId ?? metadata.package;
    const module = packageId && packageId !== "world" ? game.modules.get(packageId) : null;
    const moduleName = module?.title || (packageId && packageId !== "world" ? packageId : null);
    const packName = metadata.label || metadata.name || pack?.collection || "неизвестный компендиум";
    return { moduleName, packName };
  };

  const whisperGMs = async content => {
    const recipients = game.users.filter(user => user.isGM).map(user => user.id);
    await ChatMessage.create({ speaker: { alias: "Алхимия" }, content, whisper: recipients });
  };

  const baseResolveBrew = E.resolveBrew;
  E.resolveBrew = async request => {
    const state = E.getState();
    const user = game.users.get(request?.userId);
    const actor = game.actors.get(request?.actorId);
    const recipe = state.recipes.find(entry => entry.id === request?.recipeId);
    const ingredients = (request?.ingredients || []).map(entry => ({
      ingredientId: entry.ingredientId,
      quantity: Math.max(1, Math.floor(Number(entry.quantity) || 1))
    }));
    if (!user || !actor || !E.canActor(user, actor, state)) throw new Error("Нет доступа к персонажу.");
    if (!recipe) throw new Error("Рецепт не найден.");
    if (!user.isGM && !recipe.playersKnow) throw new Error("Рецепт неизвестен игрокам.");
    if (!ingredients.length || !E.matches(recipe, E.total(state, ingredients))) throw new Error("Недостаточно известных аспектов.");

    const success = Number(request.total) >= Number(recipe.brewDC);
    const output = recipe.output || {};
    const resultName = String(output.itemName || recipe.name).trim();
    let source = null;
    if (success) {
      const candidates = await findNamedItems(resultName);
      if (candidates.length > 1) {
        const list = candidates.map(({ pack, document }) => `<li><b>${esc(pack.metadata.label || pack.collection)}</b>: ${esc(document.name)} — <code>${esc(document.uuid)}</code></li>`).join("");
        await whisperGMs(`<h3>Неоднозначный предмет при изготовлении</h3><p>Для рецепта «${esc(recipe.name)}» найдено несколько предметов с именем «${esc(resultName)}». Ингредиенты не списаны; уточните источник предмета или устраните дубликаты.</p><ul>${list}</ul>`);
        throw new Error(`Найдено несколько предметов «${resultName}». ГМ получил список совпадений в чат; ингредиенты не списаны.`);
      }
      if (candidates.length === 1) source = candidates[0];
      else if (output.requireCompendiumPotion) {
        throw new Error(`Предмет «${resultName}» не найден в доступных компендиумах. Ингредиенты не списаны.`);
      }
    }

    for (const ingredient of ingredients) E.take(state, ingredient.ingredientId, ingredient.quantity);
    let message = "Провал: ингредиенты израсходованы, предмет не создан.";
    if (success) {
      const quantity = Math.max(1, Number(Number(request.total) >= Number(recipe.brewDC) + 5 ? output.criticalQuantity : output.quantity) || 1);
      let itemData;
      if (source) {
        itemData = source.document.toObject();
        for (const key of ["_id", "folder", "sort", "ownership", "_stats"]) delete itemData[key];
        itemData.system = foundry.utils.deepClone(itemData.system || {});
        itemData.system.quantity = quantity;
        itemData.flags = foundry.utils.deepClone(itemData.flags || {});
        foundry.utils.setProperty(itemData.flags, `${E.id}.craftedFrom`, { recipeId: recipe.id, recipeName: recipe.name });
        await actor.createEmbeddedDocuments("Item", [itemData]);
        const origin = sourceInfo(source.pack);
        message = origin.moduleName
          ? `Успех: создан предмет «${source.document.name}» из модуля «${esc(origin.moduleName)}» — компендиум «${esc(origin.packName)}» × ${quantity}.`
          : `Успех: создан предмет «${source.document.name}» из компендиума «${esc(origin.packName)}» × ${quantity}.`;
      } else {
        const name = output.itemName || recipe.name;
        await actor.createEmbeddedDocuments("Item", [{
          name,
          type: "consumable",
          img: "icons/consumables/potions/bottle-round-corked-red.webp",
          system: { quantity, type: { value: "potion" }, description: { value: `<p>${esc(recipe.description || "Алхимический состав.")}</p>` } },
          flags: { [E.id]: { recipeId: recipe.id } }
        }]);
        message = `Успех: создано «${esc(name)}» × ${quantity}.`;
      }
    }
    state.group.brewHistory.unshift({ id: foundry.utils.randomID(), timestamp: Date.now(), actorName: actor.name, recipeId: recipe.id, recipeName: recipe.name, total: Number(request.total) || 0, dc: recipe.brewDC, success, ingredients });
    await E.commit(state);
    return { message };
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
