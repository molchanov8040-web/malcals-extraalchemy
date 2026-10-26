/* ApplicationV2 recipe images and GM aspect visibility settings. */
(() => {
  const EA = globalThis.EA;
  const Base = EA?.PlayerApplicationV2;
  if (!EA || !Base) {
    console.warn(`${EA?.id || "malcals-extraalchemy"} | Recipe image patch loaded before player app.`);
    return;
  }
  if (Base.prototype.__eaRecipeImagePatch) return;
  const potionRoot = `modules/${EA.id}/assets/images/potions/`;
  const fallback = `${potionRoot}healing-poultice.webp`;
  const imageCache = new Map();
  const indexCache = new Map();
  const normalize = value => String(value ?? "").trim().replace(/<[^>]*>/g, "").replace(/\s+/g, " ").toLocaleLowerCase();
  const valid = value => /^(https?:|data:|icons\/|modules\/|worlds\/|systems\/)/i.test(String(value ?? "").trim());
  const explicit = {
    "малое лечебное зелье": "small-healing-poultice.webp",
    "малая лечебная припарка": "healing-poultice.webp",
    "большая лечебная припарка": "large-healing-poultice.webp",
    "сильная лечебная припарка": "strong-healing-poultice.webp",
    "малое зелье лириума": "minor-lyrium-potion.webp",
    "обычное зелье лириума": "ordinary-lyrium-potion.webp",
    "большое зелье лириума": "large-lyrium-potion.webp",
    "мощное зелье лириума": "potent-lyrium-potion.webp"
  };
  const assetFor = recipe => {
    const name = normalize(recipe?.output?.itemName || recipe?.name);
    if (explicit[name]) return `${potionRoot}${explicit[name]}`;
    if (name.includes("лириум") || name.includes("lyrium")) {
      if (name.includes("мощ") || name.includes("potent")) return `${potionRoot}potent-lyrium-potion.webp`;
      if (name.includes("больш") || name.includes("large")) return `${potionRoot}large-lyrium-potion.webp`;
      if (name.includes("мал") || name.includes("minor")) return `${potionRoot}minor-lyrium-potion.webp`;
      return `${potionRoot}ordinary-lyrium-potion.webp`;
    }
    if (name.includes("больш") || name.includes("large")) return `${potionRoot}large-healing-poultice.webp`;
    if (name.includes("сильн") || name.includes("strong")) return `${potionRoot}strong-healing-poultice.webp`;
    if (name.includes("леч") || name.includes("healing") || name.includes("припарк")) return `${potionRoot}healing-poultice.webp`;
    return "";
  };
  const fromCompendia = async recipe => {
    const wanted = normalize(recipe?.output?.itemName || recipe?.name);
    if (!wanted) return "";
    if (indexCache.has(wanted)) return indexCache.get(wanted);
    try {
      const world = game.items?.find(item => normalize(item.name) === wanted && valid(item.img));
      if (world?.img) { indexCache.set(wanted, world.img); return world.img; }
      for (const pack of game.packs ?? []) {
        if (pack.documentName !== "Item") continue;
        const index = await pack.getIndex({ fields: ["name", "img"] });
        const entry = index.find(item => normalize(item.name) === wanted && valid(item.img));
        if (entry?.img) { indexCache.set(wanted, entry.img); return entry.img; }
      }
    } catch (error) {
      console.warn(`${EA.id} | Не удалоь найти изображение результата рецепта`, recipe?.name, error);
    }
    indexCache.set(wanted, "");
    return "";
  };
  const resolve = async recipe => {
    const key = recipe?.id || normalize(recipe?.output?.itemName || recipe?.name);
    if (imageCache.has(key)) return imageCache.get(key);
    const direct = recipe?.img || recipe?.image || recipe?.output?.img || recipe?.output?.image;
    const image = valid(direct) ? direct : (assetFor(recipe) || await fromCompendia(recipe) || fallback);
    imageCache.set(key, image);
    return image;
  };
  const applyImage = (image, element) => {
    if (!element) return;
    element.setAttribute("src", image);
    element.setAttribute("onerror", `this.onerror=null;this.src='${fallback}';`);
  };
  const recipeMap = () => new Map((EA.getState()?.recipes || []).map(recipe => [String(recipe.id), recipe]));
  const patchImages = async function(context) {
    if (!context?.panel || typeof document === "undefined") return context;
    const template = document.createElement("template");
    template.innerHTML = String(context.panel);
    const recipes = recipeMap();
    for (const button of template.content.querySelectorAll("[data-recipe-id]")) {
      const recipe = recipes.get(String(button.dataset.recipeId));
      const card = button.closest("article, section");
      const image = card?.querySelector("img.ea-v2-recipe-image, img.ea-v2-craft-recipe-image, img.ea-v2-craft-recipe-card-image, img");
      if (recipe && image) applyImage(await resolve(recipe), image);
    }
    const detail = this.recipeDetailsId ? recipes.get(String(this.recipeDetailsId)) : null;
    const detailImage = template.content.querySelector(".ea-v2-recipe-detail-image");
    if (detail && detailImage) applyImage(await resolve(detail), detailImage);
    context.panel = template.innerHTML;
    return context;
  };
  const originalPrepare = Base.prototype._prepareContext;
  Base.prototype._prepareContext = async function() {
    const context = await originalPrepare.call(this);
    return patchImages.call(this, context);
  };
  Base.prototype.__eaRecipeImagePatch = true;
  EA.resolveApplicationV2RecipeImage = resolve;
  console.info(`${EA.id} | ApplicationV2 recipe image patch registered.`);
})();
