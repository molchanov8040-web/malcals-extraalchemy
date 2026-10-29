/* Unified player-facing aspect filter: one GM checkbox controls visibility and crafting availability. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  const sourceAspects = (state, herbId) => {
    const source = state?.group?.knownAspects?.[herbId];
    const values = source?.aspects ?? source;
    return values && typeof values === "object" ? values : {};
  };

  const playerAllowed = state => {
    const allowed = new Set();
    for (const herbId of Object.keys(state?.group?.knownAspects || {})) {
      for (const key of Object.keys(sourceAspects(state, herbId))) allowed.add(key);
    }
    return allowed;
  };

  const filterText = (text, allowed) => {
    const labels = EA.aspects || {};
    const parts = String(text || "").split(/\s*[·,]\s*/);
    const kept = parts.filter(part => {
      const match = part.match(/^\s*([^:]+):/);
      if (!match) return true;
      const label = match[1].trim().toLocaleLowerCase();
      const key = Object.keys(labels).find(candidate => String(labels[candidate]).toLocaleLowerCase() === label);
      return !key || allowed.has(key);
    });
    return kept.join(" · ") || "свойства ещё не изучены";
  };

  EA.playerAllowedAspectKeys = state => playerAllowed(state);

  const Base = EA.PlayerApplicationV2;
  if (!Base || Base.prototype.__eaUnifiedAspectFilter) return;
  const original = Base.prototype._prepareContext;
  Base.prototype._prepareContext = async function() {
    const context = await original.call(this);
    if (game.user?.isGM || !context?.panel || typeof document === "undefined") return context;
    const state = EA.getState?.();
    const allowed = playerAllowed(state);
    const template = document.createElement("template");
    template.innerHTML = String(context.panel);

    for (const card of template.content.querySelectorAll(".ea-v2-stock-card[data-stock-id]")) {
      const aspects = sourceAspects(state, card.dataset.stockId);
      const paragraph = card.querySelector(".ea-v2-stock-body p");
      if (paragraph) paragraph.textContent = EA.aspectText?.(aspects) || "свойства ещё не изучены";
    }
    for (const element of template.content.querySelectorAll(".ea-v2-recipe-requirements, .ea-v2-craft-recipe-body p")) {
      element.textContent = filterText(element.textContent, allowed);
    }
    context.panel = template.innerHTML;
    return context;
  };
  Base.prototype.__eaUnifiedAspectFilter = true;
  console.info(`${EA.id} | Unified player aspect filter registered.`);
})();
