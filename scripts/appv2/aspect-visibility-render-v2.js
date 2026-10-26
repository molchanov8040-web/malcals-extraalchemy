/* Apply GM-configured aspect visibility to player-facing ApplicationV2 markup. */
(() => {
  const EA = globalThis.EA;
  const Base = EA?.PlayerApplicationV2;
  if (!EA || !Base || Base.prototype.__eaAspectVisibilityPatch) return;

  const filterText = (text, allowed) => {
    const labels = EA.aspects || {};
    const parts = String(text).split(/\s*[·,]\s*/);
    const kept = parts.filter(part => {
      const match = part.match(/^\s*([^:]+):/);
      if (!match) return true;
      const label = match[1].trim().toLocaleLowerCase();
      const key = Object.keys(labels).find(k => String(labels[k]).toLocaleLowerCase() === label);
      return !key || allowed.has(key);
    });
    return kept.join(" · ") || "свойства ещё не изучены";
  };

  const original = Base.prototype._prepareContext;
  Base.prototype._prepareContext = async function() {
    const context = await original.call(this);
    if (game.user?.isGM || !context?.panel || typeof document === "undefined") return context;
    const state = EA.getState();
    const allowed = new Set(Array.isArray(state?.configuration?.playerAspectKeys)
      ? state.configuration.playerAspectKeys
      : Object.keys(EA.aspects || {}));
    const template = document.createElement("template");
    template.innerHTML = String(context.panel);
    const selectors = [".ea-v2-stock-body p", ".ea-v2-recipe-requirements", ".ea-v2-craft-recipe-body p"];
    for (const selector of selectors) {
      for (const element of template.content.querySelectorAll(selector)) {
        element.textContent = filterText(element.textContent, allowed);
      }
    }
    context.panel = template.innerHTML;
    return context;
  };
  Base.prototype.__eaAspectVisibilityPatch = true;
  console.info(`${EA.id} | ApplicationV2 player aspect visibility registered.`);
})();
