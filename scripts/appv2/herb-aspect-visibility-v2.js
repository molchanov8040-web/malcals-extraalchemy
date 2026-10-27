/* Compatibility filter for player-visible herb aspects. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  const visibleAspects = (herbId, aspects) => {
    if (game.user?.isGM) return aspects || {};
    const state = EA.getState?.();
    const known = state?.group?.knownAspects?.[herbId];
    const allowed = known?.aspects ?? known;
    if (!allowed || typeof allowed !== "object") return {};
    return Object.fromEntries(Object.entries(aspects || {}).filter(([key]) => Object.hasOwn(allowed, key)));
  };

  EA.playerVisibleHerbAspects = visibleAspects;

  const Base = EA.PlayerApplicationV2;
  if (Base && !Base.prototype.__eaUnifiedHerbAspectsPatch) {
    const original = Base.prototype._prepareContext;
    Base.prototype._prepareContext = async function() {
      const context = await original.call(this);
      if (game.user?.isGM || !context?.panel || typeof document === "undefined") return context;
      const parsed = document.createElement("template");
      parsed.innerHTML = String(context.panel);
      const state = EA.getState?.();
      for (const card of parsed.content.querySelectorAll(".ea-v2-stock-card[data-stock-id]")) {
        const id = card.dataset.stockId;
        const source = state?.group?.knownAspects?.[id];
        const aspects = source?.aspects ?? source ?? {};
        const filtered = visibleAspects(id, aspects);
        const paragraph = card.querySelector(".ea-v2-stock-body p");
        if (paragraph) paragraph.textContent = EA.aspectText?.(filtered) || "свойства ещё не изучены";
      }
      context.panel = parsed.innerHTML;
      return context;
    };
    Base.prototype.__eaUnifiedHerbAspectsPatch = true;
  }

  console.info(`${EA.id} | Unified herb aspects registered.`);
})();
