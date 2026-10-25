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
  const macroName = "Малое зелье лириума — восстановить 1 ячейку";
  const lyriumScript = `const actor = args?.[0]?.actor ?? this.actor ?? game.user.character ?? canvas.tokens.controlled[0]?.actor;
if (!actor) return ui.notifications.warn("Не удалось определить персонажа.");
const slot = actor.system.spells?.spell1;
if (!slot) return ui.notifications.warn("У персонажа нет ячеек заклинаний первого круга.");
const current = Number(slot.value ?? 0), maximum = Number(slot.max ?? 0);
if (current >= maximum) return ui.notifications.info("Ячейка первого круга уже восстановлена.");
await actor.update({ "system.spells.spell1.value": current + 1 });
ui.notifications.info(actor.name + " восстановил одну ячейку заклинаний первого круга.");`;

  const potionSeeds = () => [
    {
      id: "small-healing-poultice",
      name: "Малая целебная припарка",
      img: "modules/malcals-extraalchemy/assets/images/potions/small-healing-poultice.webp",
      description: "<blockquote><p>Припарка для лечения незначительных порезов и ушибов.</p></blockquote><p>Восстанавливает <b>2d4 + 2 ПЗ</b>.</p><p>Использование: бонусное действие, к выпившему существу. Предмет расходуется.</p>",
      kind: "healing"
    },
    {
      id: "minor-lyrium-potion",
      name: "Малое зелье лириума",
      img: "modules/malcals-extraalchemy/assets/images/potions/minor-lyrium-potion.webp",
      description: "<blockquote><p>Малое зелье лириума.</p></blockquote><p>Восстанавливает одну потраченную ячейку заклинаний первого круга.</p>",
      kind: "lyrium"
    }
  ];

  const makePack = async (name, label, type) => {
    let pack = game.packs.get(worldPackId(name));
    if (!pack && game.user.isGM) {
      const Collection = globalThis.CompendiumCollection ?? foundry.documents.collections.CompendiumCollection;
      pack = await Collection.createCompendium({ type, name, label, package: "world" });
    }
    return pack ?? null;
  };

  const itemDataFor = (seed, macro) => {
    const id = foundry.utils.randomID(16);
    const activities = seed.kind === "healing" ? {
      [id]: {
        _id: id,
        type: "heal",
        name: "Лечение",
        img: null,
        activation: { type: "bonus", value: 1, condition: "", override: false },
        consumption: {
          targets: [{ type: "itemUses", value: "1", target: "", scaling: {} }],
          scaling: { allowed: false, max: "" },
          spellSlot: true
        },
        description: { chatFlavor: "Малая целебная припарка" },
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
          number: 2,
          denomination: 4,
          bonus: "2",
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
            number: seed.kind === "healing" ? 2 : null,
            denomination: seed.kind === "healing" ? 4 : null,
            bonus: seed.kind === "healing" ? "2" : "",
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
        [E.id]: { [POTION_FLAG]: { id: seed.id, kind: seed.kind } },
        ...(seed.kind === "lyrium" && macro ? { "midi-qol": { onUseMacroName: `[postActiveEffects]${macro.uuid}` } } : {})
      }
    };
  };

  const seedMacroPack = async () => {
    const pack = await makePack(PACKS.scripts, "Скрипты зелий", "Macro");
    if (!pack) return null;
    const docs = await pack.getDocuments();
    let macro = docs.find(d => d.getFlag(E.id, MACRO_FLAG)?.id === "minor-lyrium-restore-1");
    if (!macro) {
      [macro] = await pack.documentClass.createDocuments([{
        name: macroName,
        type: "script",
        img: "icons/svg/dice-target.svg",
        command: lyriumScript,
        scope: "global",
        ownership: { default: 0 },
        flags: { [E.id]: { [MACRO_FLAG]: { id: "minor-lyrium-restore-1", potionId: "minor-lyrium-potion", restoredSpellLevel: 1, restoredSlots: 1 } } }
      }], { pack: pack.collection });
    } else if (macro.command !== lyriumScript) {
      await macro.update({ command: lyriumScript, name: macroName });
    }
    return macro;
  };

  const seedPotionPack = async macro => {
    const pack = await makePack(PACKS.potions, "Готовые зелья", "Item");
    if (!pack) return;
    const docs = await pack.getDocuments();
    for (const seed of potionSeeds()) {
      const existing = docs.find(d => d.getFlag(E.id, POTION_FLAG)?.id === seed.id) ?? docs.find(d => d.name === seed.name);
      const data = itemDataFor(seed, macro);
      if (existing) await existing.update(data);
      else await pack.documentClass.createDocuments([data], { pack: pack.collection });
    }
  };

  E.ensurePotionLibraries = async () => {
    if (!game.user.isGM) return;
    const macro = await seedMacroPack();
    await seedPotionPack(macro);
  };

  const normalizedName = name => String(name ?? "").trim().replace(/\\s+/g, " ").toLocaleLowerCase();
  const findNamedItems = async name => {
    const matches = [];
    for (const pack of game.packs) {
      if (pack.documentName !== "Item") continue;
      const index = await pack.getIndex({ fields: ["name"] });
      for (const entry of index) {
        if (normalizedName(entry.name) !== normalizedName(name)) continue;
        const document = await pack.getDocument(entry._id);
        if (document) matches.push({ pack, document });
      }
    }
    return matches;
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
        const list = candidates.map(({ pack, document }) => `<li><b>${E.esc(pack.metadata.label || pack.collection)}</b>: ${E.esc(document.name)} — <code>${E.esc(document.uuid)}</code></li>`).join("");
        await whisperGMs(`<h3>Неоднозначный предмет при изготовлении</h3><p>Для рецепта «${E.esc(recipe.name)}» найдено несколько предметов с именем «${E.esc(resultName)}». Ингредиенты не списаны; уточните источник предмета или устраните дубликаты.</p><ul>${list}</ul>`);
        throw new Error(`Найдено несколько предметов «${resultName}». ГМ получил список совпадений в чат; ингредиенты не списаны.`);
      }
      if (candidates.length === 1) source = candidates[0].document;
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
        itemData = source.toObject();
        for (const key of ["_id", "folder", "sort", "ownership", "_stats"]) delete itemData[key];
        itemData.system = foundry.utils.deepClone(itemData.system || {});
        itemData.system.quantity = quantity;
        itemData.flags = foundry.utils.deepClone(itemData.flags || {});
        foundry.utils.setProperty(itemData.flags, `${E.id}.craftedFrom`, { recipeId: recipe.id, recipeName: recipe.name });
        await actor.createEmbeddedDocuments("Item", [itemData]);
        message = `Успех: создан предмет «${source.name}» из компендиума «${source.pack?.metadata?.label || "установленного модуля"}» × ${quantity}.`;
      } else {
        const name = output.itemName || recipe.name;
        await actor.createEmbeddedDocuments("Item", [{
          name,
          type: "consumable",
          img: "icons/consumables/potions/bottle-round-corked-red.webp",
          system: { quantity, type: { value: "potion" }, description: { value: `<p>${E.esc(recipe.description || "Алхимический состав.")}</p>` } },
          flags: { [E.id]: { recipeId: recipe.id } }
        }]);
        message = `Успех: создано «${name}» × ${quantity}.`;
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
