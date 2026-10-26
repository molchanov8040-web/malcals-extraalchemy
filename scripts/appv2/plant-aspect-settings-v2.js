/* GM configuration of player-visible aspects per individual herb. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;
  const esc = value => EA.esc(value);
  const read = () => { try { return game.settings.get(EA.id, "herbOverrides") || {}; } catch { return {}; } };
  EA.openPlantAspectSettings = () => {
    if (!game.user?.isGM) return;
    const herbs = EA.herbSeeds?.() || [];
    const overrides = read();
    const rows = herbs.map(herb => {
      const explicit = overrides[herb.ingredientId]?.playerVisibleAspects;
      const visible = new Set(Array.isArray(explicit) ? explicit : Object.keys(herb.aspects || {}));
      const checks = Object.entries(herb.aspects || {}).map(([key, value]) => `<label class="ea-check"><input type="checkbox" data-herb="${esc(herb.ingredientId)}" data-aspect="${esc(key)}"${visible.has(key) ? " checked" : ""}> ${esc(EA.aspects?.[key] || key)} (${Number(value)})</label>`).join("");
      return `<details class="ea-herb-aspect-row"><summary><img src="${esc(EA.herbImagePath?.(herb.image) || "icons/svg/item-bag.svg")}" alt="">${esc(herb.name)}</summary><fieldset><legend>Аспекты, видимые игрокам</legend>${checks || "<small>У растения нет настроенных аспектов.</small>"}</fieldset></details>`;
    }).join("");
    EA.popup("Алхимия — аспекты растений, доступные игрокам", `<section class="ea-panel"><p>Настройка применяется отдельно к каждому растению. Снятый аспект остаётся у ведущего, но скрывается у игроков.</p>${rows}</section>`, { save: { label: "Сохранить", callback: async root => {
      const next = read();
      for (const herb of herbs) next[herb.ingredientId] = { ...(next[herb.ingredientId] || {}), playerVisibleAspects: Array.from(root.querySelectorAll(`[data-herb="${CSS.escape(herb.ingredientId)}"]:checked`)).map(input => input.dataset.aspect) };
      await game.settings.set(EA.id, "herbOverrides", next);
      ui.notifications.info("Видимость аспектов сохранена отдельно для каждого растения.");
    } }, close: { label: "Закрыть" } });
  };
  console.info(`${EA.id} | Per-herb aspect settings registered.`);
})();
