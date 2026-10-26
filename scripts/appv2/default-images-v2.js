/* Ensure recipe cards always use a real local potion image as fallback. */
(() => {
  const EA = globalThis.EA;
  const Base = EA?.PlayerApplicationV2;
  if (!EA || !Base || Base.prototype.__eaDefaultPotionFallback) return;
  const fallback = `modules/${EA.id}/assets/images/potions/healing-poultice.webp`;
  const previous = Base.prototype._prepareContext;
  Base.prototype._prepareContext = async function() {
    const context = await previous.call(this);
    if (typeof context?.panel === "string") {
      context.panel = context.panel.replaceAll("icons/svg/potion.svg", fallback);
    }
    return context;
  };
  Base.prototype.__eaDefaultPotionFallback = true;
  console.info(`${EA.id} | ApplicationV2 local potion fallback registered.`);
})();
