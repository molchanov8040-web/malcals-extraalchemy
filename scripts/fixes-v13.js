/* Compatibility repairs for Malcal's ExtraAlchemy on Foundry VTT 13.351. */
(() => {
  if (!globalThis.EA) return;
  const { EA } = globalThis;

  EA.aspectList = [
    ["Vita", "Жизнь"], ["Herba", "Растение"], ["Aqua", "Вода"],
    ["Ignis", "Огонь"], ["Terra", "Земля"], ["Motus", "Движение"],
    ["Sensus", "Чувства"], ["Venenum", "Яд"], ["Mortuus", "Смерть"],
    ["Praecantatio", "Магия"]
  ];
  EA.aspectName = id => EA.aspectList.find(([key]) => key === id)?.[1] ?? id;
  EA.aspectText = aspects => Object.entries(aspects ?? {})
    .filter(([, value]) => Number(value) > 0)
    .map(([id, value]) => `${EA.aspectName(id)}: ${Number(value)}`)
    .join(", ") || "нет известных аспектов";
  EA.aspectOptions = selected => EA.aspectList
    .map(([id, name]) => `<option value="${id}"${id === selected ? " selected" : ""}>${EA.esc(name)}</option>`)
    .join("");
  EA.knowledgeKey = (actor, name) => `${actor?.id ?? "unknown"}:${name ?? "unknown"}`;

  const baseNormalize = EA.normalize;
  EA.normalize = raw => {
    const state = baseNormalize(raw);
    if (!state.knowledge || typeof state.knowledge !== "object" || Array.isArray(state.knowledge)) state.knowledge = {};
    if (!Number.isFinite(Number(state.gatherDC))) state.gatherDC = 10;
    return state;
  };

  EA.knownAspects = (actor, item) => {
    const fromItem = item?.getFlag(EA.id, "knownAspects");
    if (fromItem && typeof fromItem === "object") return foundry.utils.deepClone(fromItem);
    const saved = EA.state().knowledge?.[EA.knowledgeKey(actor, item?.name)];
    return saved && typeof saved === "object" ? foundry.utils.deepClone(saved) : {};
  };
  EA.visibleAspects = (actor, item) => EA.knownAspects(actor, item);
  EA.setKnownAspects = async (actor, item, aspects) => {
    if (!actor || !item) return;
    const known = foundry.utils.deepClone(aspects ?? {});
    const state = EA.state();
    state.knowledge[EA.knowledgeKey(actor, item.name)] = known;
    await item.update({ [`flags.${EA.id}.knownAspects`]: known });
    await EA.save(state);
  };

  const previousAddIngredient = EA.addIngredient;
  EA.addIngredient = async (actor, name, quantity, aspects, options = {}) => {
    const result = await previousAddIngredient(actor, name, quantity, aspects);
    if (!result || !options || (!options.img && !options.description)) return result;
    const item = result?.id ? result : actor.items.find(entry => entry.getFlag(EA.id, "kind") === "ingredient" && entry.name === name);
    if (!item) return result;
    const update = {};
    if (options.img) update.img = options.img;
    if (options.description) update["system.description.value"] = options.description;
    if (Object.keys(update).length) await item.update(update);
    return item;
  };

  const previousStock = EA.stock;
  EA.stock = async actor => {
    if (actor) return previousStock(actor);
    const allowed = EA.actors();
    if (!allowed.length) return ui.notifications.warn("В настройке алхимии выберите хотя бы одного персонажа.");
    if (!game.user.isGM) {
      const owned = allowed.find(entry => entry.testUserPermission(game.user, "OWNER"));
      return owned ? previousStock(owned) : ui.notifications.warn("Мастер не назнчил вам персонажа для алхимии.");
    }
    const options = allowed.map(entry => `<option value="${entry.id}">${EA.esc(entry.name)}</option>`).join("");
    return new Dialog({
      title: "Склад — выбрать персонажа",
      content: `<section class="ea-panel"><label>Персонаж<select id="ea-stock-actor">${options}</select></label></section>`,
      buttons: {
        open: { label: "Открыть склад", callback: html => previousStock(game.actors.get((html[0] ?? html).querySelector("#ea-stock-actor").value)) },
        cancel: { label: "Отмена" }
      }
    }).render(true);
  };

  EA.resetAllData = async () => {
    if (!game.user.isGM) return;
    const confirmed = await Dialog.confirm({
      title: "Сбросить данные алхимии",
      content: "<p>Будут удалены настройки, история, знания аспектов, пользовательские рецепты и <b>все травы со складов персонажей</b>, созданные модулем.</p><p><b>Это действие нельзя отменить.</b></p>",
      defaultYes: false
    });
    if (!confirmed) return;
    const deletions = [];
    for (const actor of game.actors) {
      const ids = actor.items.filter(item => item.getFlag(EA.id, "kind") === "ingredient").map(item => item.id);
      if (ids.length) deletions.push(actor.deleteEmbeddedDocuments("Item", ids));
    }
    await Promise.all(deletions);
    await game.settings.set(EA.id, "state", EA.defaults());
    ui.notifications.info("Все данные Malcal's ExtraAlchemy и травы на складах удалены.");
  };
})();
