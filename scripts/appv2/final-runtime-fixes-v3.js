/* Final runtime fixes for the 0.8.9.4 cross-version test build. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  // Keep the reset/settings entry point available even when a legacy file is loaded in a different order.
  if (typeof E.commit !== "function" && typeof E.saveState === "function") {
    E.commit = state => E.saveState(E.normalizeState(state));
  }

  // The GM and Socketlib paths can deliver the same successful result to two UI callbacks.
  // Suppress only an immediately repeated crafting notice; other notifications are untouched.
  const notifications = globalThis.ui?.notifications;
  if (notifications && typeof notifications.info === "function" && !notifications.info.__eaCraftDedup) {
    const originalInfo = notifications.info.bind(notifications);
    let lastCraftNotice = "";
    let lastCraftNoticeAt = 0;
    const info = function(message, ...args) {
      const text = String(message ?? "");
      const now = Date.now();
      if (/^Успех:\s*(?:создан|создано)\b/i.test(text)) {
        if (text === lastCraftNotice && now - lastCraftNoticeAt < 1500) return;
        lastCraftNotice = text;
        lastCraftNoticeAt = now;
      }
      return originalInfo(message, ...args);
    };
    info.__eaCraftDedup = true;
    notifications.info = info;
  }

  const normalize = value => String(value ?? "").trim().replace(/<[^>]*>/g, "").replace(/\s+/g, " ").toLocaleLowerCase();
  const validImage = value => /^(https?:|data:|icons\/|modules\/|worlds\/|systems\/)/i.test(String(value ?? "").trim());
  const externalImage = async recipe => {
    const output = recipe?.output ?? {};
    const uuid = output.uuid || output.itemUuid || output.sourceUuid || recipe?.outputUuid;
    if (uuid && typeof globalThis.fromUuid === "function") {
      try {
        const item = await fromUuid(uuid);
        if (validImage(item?.img)) return item.img;
      } catch (error) { console.debug(`${E.id} | Result item UUID lookup failed`, uuid, error); }
    }
    const name = normalize(output.itemName || recipe?.name);
    if (!name) return "";
    const worldItem = globalThis.game?.items?.find(item => normalize(item.name) === name && validImage(item.img));
    if (worldItem?.img) return worldItem.img;
    for (const pack of globalThis.game?.packs ?? []) {
      if (pack.documentName !== "Item") continue;
      try {
        const index = await pack.getIndex({ fields: ["name", "img"] });
        const entry = index.find(item => normalize(item.name) === name && validImage(item.img));
        if (entry?.img) return entry.img;
      } catch (error) { console.debug(`${E.id} | Result item index lookup failed`, pack.collection, error); }
    }
    return "";
  };

  const Base = E.PlayerApplicationV2;
  if (Base?.prototype && !Base.prototype.__eaFinalExternalRecipeImages) {
    const originalPrepare = Base.prototype._prepareContext;
    if (typeof originalPrepare === "function") {
      Base.prototype._prepareContext = async function(...args) {
        const context = await originalPrepare.apply(this, args);
        if (!context?.panel || typeof document === "undefined") return context;
        const template = document.createElement("template");
        template.innerHTML = String(context.panel);
        const recipes = new Map((E.getState?.()?.recipes || []).map(recipe => [String(recipe.id), recipe]));
        for (const control of template.content.querySelectorAll("[data-recipe-id]")) {
          const recipe = recipes.get(String(control.dataset.recipeId));
          if (!recipe) continue;
          const image = control.closest("article, section, li, div")?.querySelector("img.ea-v2-recipe-image, img.ea-v2-craft-recipe-image, img.ea-v2-craft-recipe-card-image, img");
          const external = await externalImage(recipe);
          if (image && external) image.setAttribute("src", external);
        }
        const detail = this.recipeDetailsId ? recipes.get(String(this.recipeDetailsId)) : null;
        if (detail) {
          const image = template.content.querySelector(".ea-v2-recipe-detail-image");
          const external = await externalImage(detail);
          if (image && external) image.setAttribute("src", external);
        }
        context.panel = template.innerHTML;
        return context;
      };
    }
    Base.prototype.__eaFinalExternalRecipeImages = true;
  }

  console.info(`${E.id} | Final runtime fixes v3 registered.`);
})();
