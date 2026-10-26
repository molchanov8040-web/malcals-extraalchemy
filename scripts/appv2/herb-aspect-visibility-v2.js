/* GM settings for player-visible aspects per herb in ApplicationV2. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;
  const setting = "herbPlayerVisibleAspects";
  const allKeys = () => Object.keys(EA.aspects || {});
  const visibleKeys = (herbId) => {
    if (game.user?.isGM) return allKeys();
    let config = {};
    try { config = game.settings.get(EA.id, setting) || {}; } catch { /* not initialized */ }
    return Array.isArray(config[herbId]) ? config[herbId] : allKeys();
  };
  EA.playerVisibleHerbAspects = (herbId, aspects) => {
    const allowed = new Set(visibleKeys(herbId));
    return Object.fromEntries(Object.entries(aspects || {}).filter(([key]) => allowed.has(key)));
  };
  Hooks.once("init", () => game.settings.register(EA.id, setting, { scope: "world", config: false, type: Object, default: {} }));

  EA.openHerbAspectVisibility = () => {
    if (!game.user?.isGM) return ui.notifications.warn("Настройка доступна только ведущему.");
    const draw = () => {
      const herbs = EA.herbSeeds?.() || [];
      let config = {};
      try { config = game.settings.get(EA.id, setting) || {}; } catch {}
      const rows = herbs.map(herb => {
        const enabled = new Set(Array.isArray(config[herb.ingredientId]) ? config[herb.ingredientId] : Object.keys(herb.aspects || {}));
        const checks = Object.keys(herb.aspects || {}).map(key => `<label class="ea-check"><input type="checkbox" data-herb-aspect="${EA.esc(herb.ingredientId)}" value="${EA.esc(key)}"${enabled.has(key) ? " checked" : ""}> ${EA.esc(EA.aspects[key] || key)} (${Number(herb.aspects[key])})</label>`).join("");
        return `<details class="ea-herb-edit"><summary>${EA.esc(herb.name)}</summary><fieldset><legend>Аспекты, видимые игрокам</legend>${checks || "<p>У растения нет аспектов.</p>"}</fieldset></details>`;
      }).join("");
      new Dialog({ title: "Аспекты растений, доступные игрокам", content: `<section class="ea-panel"><p>Настройка применяется отдельно к каждому растению. Снятые аспекты остаются в данных мира, но не отображаются игрокам на карточке растения.</p>${rows}</section>`, buttons: { save: { label: "Сохранить", callback: async html => {
        const root = html?.[0] || html;
        const next = {};
        for (const herb of herbs) next[herb.ingredientId] = Array.from(root.querySelectorAll(`[data-herb-aspect="${CSS.escape(herb.ingredientId)}"]:checked`)).map(input => input.value);
        await game.settings.set(EA.id, setting, next);
        ui.notifications.info("Видимость аспектов по растениям сохранена.");
      } }, close: { label: "Закрыть" } } }).render(true);
    };
    draw();
  };

  const Base = EA.PlayerApplicationV2;
  if (Base && !Base.prototype.__eaHerbAspectVisibilityPatch) {
    const original = Base.prototype._prepareContext;
    Base.prototype._prepareContext = async function() {
      const context = await original.call(this);
      if (game.user?.isGM || !context?.panel || typeof document === "undefined") return context;
      const parsed = document.createElement("template");
      parsed.innerHTML = String(context.panel);
      const state = EA.getState();
      for (const card of parsed.content.querySelectorAll(".ea-v2-stock-card[data-stock-id]")) {
        const id = card.dataset.stockId;
        const known = state?.group?.knownAspects?.[id];
        const source = known?.aspects ?? known;
        const filtered = EA.playerVisibleHerbAspects(id, source || {});
        const text = EA.aspectText?.(filtered) || "свойства ещё не изучены";
        const paragraph = card.querySelector(".ea-v2-stock-body p");
        if (paragraph) paragraph.textContent = text;
      }
      context.panel = parsed.innerHTML;
      return context;
    };
    Base.prototype.__eaHerbAspectVisibilityPatch = true;
  }
  console.info(`${EA.id} | Per-herb player aspect visibility registered.`);
})();
