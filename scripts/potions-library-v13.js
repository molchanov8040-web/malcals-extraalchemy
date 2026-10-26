/* Ready potions, script compendium and compendium-based crafting for Foundry VTT 13. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  const PACKS = { potions: "malcals-extraalchemy-potions", scripts: "malcals-extraalchemy-potion-scripts" };
  const POTION_FLAG = "ready-potion";
  const MACRO_FLAG = "ready-potion-script";
  const FOLDER_NAME = "Malcal's ExtraAlchemy";
  const worldPackId = name => `world.${name}`;
  const normalizeName = name => String(name ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const esc = value => E.esc ? E.esc(value) : String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));

  const potionSeeds = () => [
    { id: "small-healing-poultice", name: "Малая целебная припарка", img: "modules/malcals-extraalchemy/assets/images/potions/small-healing-poultice.webp", description: "<blockquote><p>Припарка для лечения незначительных порезов и ушибов.</p></blockquote><p>Восстанавливает <b>2d4 + 2 ПЗ</b>.</p><p>Использование: бонусное действие. Предмет расходуется после применения.</p>", kind: "healing", healing: { number: 2, denomination: 4, bonus: "2" } },
    { id: "healing-poultice", name: "Целебная припарка", img: "modules/malcals-extraalchemy/assets/images/potions/healing-poultice.webp", description: "<blockquote><p>Целебная припарка для серьёзных ран.</p></blockquote><p>Восстанавливает <b>4d4 + 4 ПЗ</b>.</p><p>Использование: бонусное действие. Предмет расходуется после применения.</p>", kind: "healing", healing: { number: 4, denomination: 4, bonus: "4" } },
    { id: "large-healing-poultice", name: "Большая целебная припарка", img: "modules/malcals-extraalchemy/assets/images/potions/large-healing-poultice.webp", description: "<blockquote><p>Большая припарка, пропитанная концентрированным лечебным составом.</p></blockquote><p>Восстанавливает <b>8d4 + 8 ПЗ</b>.</p><p>Использование: бонусное действие. Предмет расходуется после применения.</p>", kind: "healing", healing: { number: 8, denomination: 4, bonus: "8" } },
    { id: "strong-healing-poultice", name: "Сильная целебная припарка", img: "modules/malcals-extraalchemy/assets/images/potions/strong-healing-poultice.webp", description: "<blockquote><p>Сильная целебная припарка для тяжёлых ранений.</p></blockquote><p>Восстанавливает <b>10d4 + 20 ПЗ</b>.</p><p>Использование: бонусное действие. Предмет расходуется после применения.</p>", kind: "healing", healing: { number: 10, denomination: 4, bonus: "20" } },
    { id: "minor-lyrium-potion", name: "Малое Зелье лириума", img: "modules/malcals-extraalchemy/assets/images/potions/minor-lyrium-potion.webp", description: "<blockquote><p>Малое зелье лириума.</p></blockquote><p>Восстанавливает запас в <b>1 круг</b> для восстановления ячеек заклинаний.</p>", kind: "lyrium", restoredSlots: 1 },
    { id: "ordinary-lyrium-potion", name: "Обычное Зелье лириума", img: "modules/malcals-extraalchemy/assets/images/potions/ordinary-lyrium-potion.webp", description: "<blockquote><p>Обычное зелье лириума.</p></blockquote><p>Восстанавливает запас в <b>2 круга</b> для восстановления ячеек заклинаний.</p>", kind: "lyrium", restoredSlots: 2 },
    { id: "large-lyrium-potion", name: "Большое Зелье лириума", img: "modules/malcals-extraalchemy/assets/images/potions/large-lyrium-potion.webp", description: "<blockquote><p>Большое зелье лириума.</p></blockquote><p>Восстанавливает запас в <b>3 круга</b> для восстановления ячеек заклинаний.</p>", kind: "lyrium", restoredSlots: 3 },
    { id: "potent-lyrium-potion", name: "Сильнодействующее Зелье лириума", img: "modules/malcals-extraalchemy/assets/images/potions/potent-lyrium-potion.webp", description: "<blockquote><p>Сильнодействующее зелье лириума.</p></blockquote><p>Восстанавливает запас в <b>5 кругов</b> для восстановления ячеек заклинаний.</p>", kind: "lyrium", restoredSlots: 5 }
  ];

  const lyriumScript = restoredSlots => `const workflow = typeof args !== "undefined" ? (Array.isArray(args) ? args[0] : args) : null;
const actor = workflow?.actor ?? this?.actor ?? game.user.character ?? canvas.tokens.controlled[0]?.actor;
let pointsLeft = ${Number(restoredSlots) || 1};
if (!actor) return ui.notifications.warn("Не удалось определить персонажа.");
const spells = actor.system.spells;
if (!spells) return ui.notifications.warn("У персонажа нет данных о ячейках заклинаний.");
const updates = {};
const restored = [];
for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  if (pointsLeft <= 0) break;
  const key = "spell" + level;
  const slot = spells[key];
  if (!slot) continue;
  const current = Number(slot.value ?? 0), maximum = Number(slot.max ?? 0);
  if (current >= maximum) continue;
  const canRestore = Math.min(maximum - current, Math.floor(pointsLeft / level));
  if (canRestore < 1) continue;
  updates["system.spells." + key + ".value"] = current + canRestore;
  restored.push(canRestore + " ячеек " + level + " круга");
  pointsLeft -= canRestore * level;
}
if (!restored.length) return ui.notifications.info("Нет потраченных ячеек, которые можно восстановить за имеющееся число кругов.");
await actor.update(updates);
ui.notifications.info(actor.name + ": восстановлено " + restored.join(", ") + ". Осталось кругов: " + pointsLeft);`;

  const ensureFolder = async () => {
    let folder = game.folders?.find(f => f.type === "Compendium" && f.name === FOLDER_NAME);
    if (!folder) [folder] = await Folder.createDocuments([{ name: FOLDER_NAME, type: "Compendium", sorting: "a" }]);
    return folder;
  };
  const makePack = async (name, label, type, folder) => {
    let pack = game.packs.get(worldPackId(name));
    if (!pack && game.user.isGM) {
      const Collection = globalThis.CompendiumCollection ?? foundry.documents.collections.CompendiumCollection;
      pack = await Collection.createCompendium({ type, name, label, package: "world" });
    }
    if (pack && folder && pack.folder?.id !== folder.id) await pack.setFolder(folder.id);
    return pack ?? null;
  };

  const itemDataFor = (seed, macro) => {
    const activityId = foundry.utils.randomID(16), h = seed.healing;
    const activities = seed.kind === "healing" ? { [activityId]: {
      _id: activityId, type: "heal", name: "Лечение", img: null,
      activation: { type: "bonus", value: 1, condition: "", override: false },
      consumption: { targets: [{ type: "itemUses", value: "1", target: "", scaling: {} }], scaling: { allowed: false, max: "" }, spellSlot: true },
      description: { chatFlavor: seed.name }, duration: { concentration: false, value: "", units: "inst", special: "", override: false }, effects: [],
      range: { units: "any", special: "", override: false },
      target: { template: { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: "ft", stationary: false }, affects: { count: "1", type: "creature", choice: false, special: "" }, prompt: true, override: false },
      uses: { spent: 0, max: "", recovery: [] },
      healing: { number: h.number, denomination: h.denomination, bonus: h.bonus, types: ["healing"], custom: { enabled: false, formula: "" }, scaling: { mode: "whole", number: null, formula: "" } },
      sort: 0, flags: {}, visibility: { level: {}, requireAttunement: false, requireIdentification: false, requireMagic: false },
      useConditionText: "", useConditionReason: "", effectConditionText: "", otherActivityId: null, macroData: { name: "", command: "" },
      midiProperties: { ignoreTraits: [], triggeredActivityId: "none", triggeredActivityConditionText: "", triggeredActivityTargets: "targets", triggeredActivityRollAs: "self", triggeredActivityConsume: true, triggeredActivityConfigure: true, autoConsume: false, forceConsumeDialog: "default", forceRollDialog: "default", forceDamageDialog: "default", confirmTargets: "default", autoTargetType: "any", autoTargetAction: "default", automationOnly: false, otherActivityCompatible: true, otherActivityAsParentType: true, identifier: "", displayActivityName: false, rollMode: "default", chooseEffects: false, toggleEffect: false, ignoreFullCover: false, removeChatButtons: "default", magicEffect: false, magicDamage: false, noConcentrationCheck: false, skipConcentrationCheck: false, autoCEEffects: "default" }
    } } : {};
    return {
      name: seed.name, type: "consumable", img: seed.img,
      system: {
        description: { value: seed.description, chat: "" }, source: { custom: "Malcal's ExtraAlchemy", revision: 1, rules: "2014", book: "" },
        identified: true, unidentified: { description: "" }, container: null, quantity: 1, weight: { value: 0.2, units: "lb" }, price: { value: 10, denomination: "gp" }, rarity: "common", attunement: "",
        uses: { spent: 0, max: "1", autoDestroy: true, recovery: [] },
        damage: { base: { number: seed.kind === "healing" ? h.number : null, denomination: seed.kind === "healing" ? h.denomination : null, bonus: seed.kind === "healing" ? h.bonus : "", types: seed.kind === "healing" ? ["healing"] : [], custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } }, replace: false },
        type: { value: "potion", subtype: "" }, properties: [], activities, identifier: seed.id, attuned: false, equipped: false
      },
      flags: {
        [E.id]: { [POTION_FLAG]: { id: seed.id, kind: seed.kind, restoredSlots: seed.restoredSlots ?? 0 } },
        ...(seed.kind === "lyrium" && macro ? { "midi-qol": { onUseMacroName: `[postActiveEffects]${macro.name}[${macro.uuid}]` } } : {})
      }
    };
  };

  const seedMacroPack = async folder => {
    const pack = await makePack(PACKS.scripts, "Скрипты зелий", "Macro", folder);
    if (!pack) return new Map();
    const docs = await pack.getDocuments(), result = new Map();
    for (const seed of potionSeeds().filter(x => x.kind === "lyrium")) {
      const macroId = `${seed.id}-restore`;
      const name = `${seed.name} — восстановить ${seed.restoredSlots} круг(а/ов)`;
      const command = lyriumScript(seed.restoredSlots);
      let macro = docs.find(d => d.getFlag(E.id, MACRO_FLAG)?.id === macroId);
      if (!macro) [macro] = await pack.documentClass.createDocuments([{ name, type: "script", img: "icons/svg/dice-target.svg", command, scope: "global", ownership: { default: 0 }, flags: { [E.id]: { [MACRO_FLAG]: { id: macroId, potionId: seed.id, restoredSlots: seed.restoredSlots } } } }], { pack: pack.collection });
      else if (macro.command !== command || macro.name !== name) await macro.update({ command, name });
      result.set(seed.id, macro);
    }
    return result;
  };

  const seedPotionPack = async (macros, folder) => {
    const pack = await makePack(PACKS.potions, "Готовые зелья", "Item", folder);
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
    const folder = await ensureFolder();
    const macros = await seedMacroPack(folder);
    await seedPotionPack(macros, folder);
  };

  const findNamedItems = async name => {
    const matches = [];
    for (const pack of game.packs) {
      if (pack.documentName !== "Item") continue;
      const index = await pack.getIndex({ fields: ["name"] });
      for (const entry of index) if (normalizeName(entry.name) === normalizeName(name)) {
        const document = await pack.getDocument(entry._id);
        if (document) matches.push({ pack, document });
      }
    }
    return matches;
  };
  const sourceInfo = pack => {
    const m = pack?.metadata ?? {}, packageId = m.packageName ?? m.packageId ?? m.package;
    const module = packageId && packageId !== "world" ? game.modules.get(packageId) : null;
    return { moduleName: module?.title || (packageId && packageId !== "world" ? packageId : null), packName: m.label || m.name || pack?.collection || "неизвестный компендиум" };
  };
  const whisperGMs = async content => ChatMessage.create({ speaker: { alias: "Алхимия" }, content, whisper: game.users.filter(u => u.isGM).map(u => u.id) });

  E.resolveBrew = async request => {
    const state = E.getState(), user = game.users.get(request?.userId), actor = game.actors.get(request?.actorId), recipe = state.recipes.find(x => x.id === request?.recipeId);
    const ingredients = (request?.ingredients || []).map(x => ({ ingredientId: x.ingredientId, quantity: Math.max(1, Math.floor(Number(x.quantity) || 1)) }));
    if (!user || !actor || !E.canActor(user, actor, state)) throw new Error("Нет доступа к персонажу.");
    if (!recipe) throw new Error("Рецепт не найден.");
    if (!user.isGM && !recipe.playersKnow) throw new Error("Рецепт неизвестен игрокам.");
    if (!ingredients.length || !E.matches(recipe, E.total(state, ingredients))) throw new Error("Недостаточно известных аспектов.");
    const success = Number(request.total) >= Number(recipe.brewDC), output = recipe.output || {}, resultName = String(output.itemName || recipe.name).trim();
    let source = null;
    if (success) {
      const candidates = await findNamedItems(resultName);
      if (candidates.length > 1) {
        const list = candidates.map(({ pack, document }) => `<li><b>${esc(pack.metadata.label || pack.collection)}</b>: ${esc(document.name)} — <code>${esc(document.uuid)}</code></li>`).join("");
        await whisperGMs(`<h3>Неоднозначный предмет при изготовлении</h3><p>Для рецепта «${esc(recipe.name)}» найдено несколько предметов «${esc(resultName)}». Ингредиенты не списаны.</p><ul>${list}</ul>`);
        throw new Error(`Найдено несколько предметов «${resultName}». ГМ получил список совпадений; ингредиенты не списаны.`);
      }
      if (candidates.length === 1) source = candidates[0];
      else if (output.requireCompendiumPotion) throw new Error(`Предмет «${resultName}» не найден. Ингредиенты не списаны.`);
    }
    for (const ingredient of ingredients) E.take(state, ingredient.ingredientId, ingredient.quantity);
    let message = "Провал: ингредиенты израсходованы, предмет не создан.";
    if (success) {
      const quantity = Math.max(1, Number(Number(request.total) >= Number(recipe.brewDC) + 5 ? output.criticalQuantity : output.quantity) || 1);
      if (source) {
        const itemData = source.document.toObject();
        for (const key of ["_id", "folder", "sort", "ownership", "_stats"]) delete itemData[key];
        itemData.system = foundry.utils.deepClone(itemData.system || {}); itemData.system.quantity = quantity;
        itemData.flags = foundry.utils.deepClone(itemData.flags || {});
        foundry.utils.setProperty(itemData.flags, `${E.id}.craftedFrom`, { recipeId: recipe.id, recipeName: recipe.name });
        await actor.createEmbeddedDocuments("Item", [itemData]);
        const origin = sourceInfo(source.pack);
        message = origin.moduleName ? `Успех: создан предмет «${source.document.name}» из модуля «${esc(origin.moduleName)}» — компендиум «${esc(origin.packName)}» × ${quantity}.` : `Успех: создан предмет «${source.document.name}» из компендиума «${esc(origin.packName)}» × ${quantity}.`;
      } else {
        const name = output.itemName || recipe.name;
        await actor.createEmbeddedDocuments("Item", [{ name, type: "consumable", img: "icons/consumables/potions/bottle-round-corked-red.webp", system: { quantity, type: { value: "potion" }, description: { value: `<p>${esc(recipe.description || "Алхимический состав.")}</p>` } }, flags: { [E.id]: { recipeId: recipe.id } } }]);
        message = `Успех: создано «${esc(name)}» × ${quantity}.`;
      }
    }
    state.group.brewHistory.unshift({ id: foundry.utils.randomID(), timestamp: Date.now(), actorName: actor.name, recipeId: recipe.id, recipeName: recipe.name, total: Number(request.total) || 0, dc: recipe.brewDC, success, ingredients });
    await E.commit(state);
    return { message };
  };

  Hooks.once("ready", async () => {
    if (!game.user.isGM) return;
    try { await E.ensurePotionLibraries(); console.info(`${E.id} | Ready-potion compendia initialized.`); }
    catch (error) { console.error(`${E.id} | Ready-potion compendium setup failed`, error); }
  });
})();
