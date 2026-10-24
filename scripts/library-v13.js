/* ExtraAlchemy v0.1.9 additions for Foundry VTT 13 */
Hooks.once("init", () => {
  const menu = game.settings.menus.get(`${EA.id}.launcher`);
  if (menu) menu.restricted = true;
});

EA.libraryPackName = "malcals-extraalchemy-herbs";
EA.libraryPackId = `world.${EA.libraryPackName}`;
EA.herbFlag = item => item?.getFlag(EA.id, "library-herb") ?? null;
EA.herbSeeds = () => [
  {
    name: "Трава 1", type: "loot", img: "icons/consumables/plants/leaf-lobed-green.webp",
    system: { quantity: 1, weight: 0.1, price: { value: 0, denomination: "gp" }, description: { value: "Базовая лечебная трава библиотеки ExtraAlchemy." } },
    flags: { [EA.id]: { "library-herb": { seedId: "herb-1", regions: ["*"], goals: ["*"], aspects: { Vita: 1, Herba: 1 } } } }
  },
  {
    name: "Трава 2", type: "loot", img: "icons/consumables/plants/leaf-veins-glowing-green.webp",
    system: { quantity: 1, weight: 0.1, price: { value: 0, denomination: "gp" }, description: { value: "Базовая водная трава библиотеки ExtraAlchemy." } },
    flags: { [EA.id]: { "library-herb": { seedId: "herb-2", regions: ["*"], goals: ["*"], aspects: { Aqua: 1, Sensus: 1 } } } }
  }
];

EA.ensureHerbLibrary = async () => {
  let pack = game.packs.get(EA.libraryPackId);
  if (!pack) {
    if (!game.user.isGM) return null;
    try {
      const CompendiumClass = globalThis.CompendiumCollection ?? foundry.documents.collections.CompendiumCollection;
      pack = await CompendiumClass.createCompendium({
        type: "Item", name: EA.libraryPackName, label: "Malcal's ExtraAlchemy — Библиотека трав", package: "world",
        ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE }
      });
      ui.compendium?.render(true);
    } catch (error) {
      console.error(`${EA.id} | Herb library creation failed`, error);
      ui.notifications.error("Не удалось создать компендиум библиотеки трав. Подробности — в консоли.");
      return null;
    }
  }
  if (game.user.isGM) {
    try {
      const existing = await pack.getDocuments();
      const seeds = new Set(existing.map(EA.herbFlag).filter(Boolean).map(data => data.seedId));
      const missing = EA.herbSeeds().filter(data => !seeds.has(data.flags[EA.id]["library-herb"].seedId));
      if (missing.length) await pack.documentClass.createDocuments(missing, { pack: pack.collection });
    } catch (error) {
      console.error(`${EA.id} | Herb library seed failed`, error);
    }
  }
  return pack;
};

EA.randomLibraryHerb = async (territory, goals) => {
  const pack = await EA.ensureHerbLibrary();
  if (!pack) return null;
  const herbs = (await pack.getDocuments()).filter(item => {
    const data = EA.herbFlag(item);
    if (!data) return false;
    const regions = data.regions ?? [];
    const itemGoals = data.goals ?? ["*"];
    return (regions.includes("*") || regions.includes(territory)) && (itemGoals.includes("*") || !goals.length || goals.some(goal => itemGoals.includes(goal)));
  });
  return herbs.length ? herbs[Math.floor(Math.random() * herbs.length)] : null;
};

EA.find = async actor => {
  const pending = EA.pendingGather ?? { territory: EA.state().territory, goals: [] };
  const herb = await EA.randomLibraryHerb(pending.territory, pending.goals);
  if (!herb) return ui.notifications.warn("В библиотеке трав нет подходящих записей.");
  const data = EA.herbFlag(herb);
  await EA.addIngredient(actor, herb.name, 1, data.aspects ?? {});
  const state = EA.state();
  const entry = state.history.find(row => row.actor === actor.name && row.area === pending.territory);
  if (entry && !entry.result.includes("найдена:")) entry.result = `${entry.result}; найдена: ${herb.name}`;
  await EA.save(state);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><b>${EA.esc(actor.name)}</b> находит: <b>${EA.esc(herb.name)}</b>.</p>` });
  ui.notifications.info(`На склад добавлено: ${herb.name}.`);
};

const oldCollect = EA.collect;
EA.collect = async (root, fallback) => {
  const actor = EA.actor(root, fallback);
  const territory = EA.state().territory;
  const goals = EA.goals(root);
  const oldFind = EA.find;
  EA.find = async foundActor => {
    EA.pendingGather = { territory, goals };
    return oldFind(foundActor);
  };
  try { return await oldCollect(root, fallback); }
  finally { EA.find = oldFind; }
};

EA.gather = fallback => {
  const state = EA.state();
  const actor = fallback ?? game.user.character;
  if (!game.user.isGM && (!actor || !state.actors.includes(actor.id))) return ui.notifications.warn("Мастер не добавил вашего персонажа в настройки алхимии.");
  new Dialog({
    title: "Алхимия — сбор",
    content: `<section class="ea-panel">${EA.actorSelect(actor)}<div><span class="ea-field-title">Территория</span><p class="ea-value">${EA.esc(state.territory)}</p></div>${EA.checks(state.goals)}<label>СЛ поиска<input id="ea-dc" type="number" value="10" min="1"></label><div class="ea-actions"><button data-action="collect">Собрать (1 час)</button><button data-action="stock">Склад</button><button data-action="history">История</button></div></section>`,
    buttons: { close: { label: "Закрыть" } },
    render: html => {
      const root = html[0] ?? html;
      root.querySelector("[data-action='collect']").onclick = () => EA.collect(root, fallback);
      root.querySelector("[data-action='stock']").onclick = () => EA.stock(EA.actor(root, fallback));
      root.querySelector("[data-action='history']").onclick = EA.history;
    }
  }).render(true);
};

EA.library = async () => {
  if (!game.user.isGM) return ui.notifications.warn("Библиотека трав доступна только мастеру.");
  const pack = await EA.ensureHerbLibrary();
  if (!pack) return ui.notifications.error("Не удалось открыть библиотеку трав.");
  return pack.render(true);
};

EA.hub = fallback => {
  const buttons = `${game.user.isGM ? `<button data-open="config">Настройка</button>` : ""}<button data-open="gather">Сбор</button><button data-open="experiments">Эксперименты</button><button data-open="recipes">Рецепты</button>${game.user.isGM ? `<button data-open="library">Библиотека трав</button>` : ""}`;
  new Dialog({ title: "Инструменты алхимии", content: `<section class="ea-panel"><p>Алхимические инструменты кампании</p><div class="ea-actions">${buttons}</div></section>`, buttons: { close: { label: "Закрыть" } }, render: html => (html[0] ?? html).querySelectorAll("[data-open]").forEach(button => button.onclick = () => EA.open(button.dataset.open, fallback)) }).render(true);
};

Hooks.once("ready", async () => {
  if (game.user.isGM) await EA.ensureHerbLibrary();
});
