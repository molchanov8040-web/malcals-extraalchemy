/* ApplicationV2 player interface for Foundry VTT 13. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  const api = foundry?.applications?.api;
  if (!api?.ApplicationV2 || !api?.HandlebarsApplicationMixin) {
    console.error(`${EA.id} | ApplicationV2 API недоступен.`);
    return;
  }

  const modes = [
    { id: "recipes", label: "Рецепты", icon: "✦" },
    { id: "gather", label: "Сбор", icon: "❖" },
    { id: "stock", label: "Склад", icon: "▤" },
    { id: "crafting", label: "Изготовление", icon: "⚗" }
  ];
  const RECIPE_PAGE_SIZE = 4;
  const recipeImageCache = new Map();

  const signed = (value) => {
    const number = Number(value) || 0;
    return `${number >= 0 ? "+" : ""}${number}`;
  };

  const selectedKey = () => `${EA.id}.appv2-selected-actor.${game.user?.id ?? "unknown"}`;
  const selectedId = () => {
    try {
      return localStorage.getItem(selectedKey()) || "";
    } catch {
      return "";
    }
  };

  const toolBonus = (actor, keys, labels) => {
    const tools = actor?.system?.tools;
    if (!tools || typeof tools !== "object") return 0;
    const aliases = [...keys, ...labels].map((value) => String(value).toLocaleLowerCase());
    for (const [key, tool] of Object.entries(tools)) {
      const text = [key, tool?.label, tool?.name, tool?.custom, tool?.identifier].filter(Boolean).join(" ").toLocaleLowerCase();
      if (!aliases.some((alias) => text.includes(alias))) continue;
      const proficient = tool?.prof ?? tool?.proficient ?? tool?.value;
      if (proficient === true || Number(proficient) > 0) return Math.max(0, Number(actor.system?.attributes?.prof) || 0);
    }
    return 0;
  };

  const getActors = () => {
    const actorIds = EA.getState()?.configuration?.actorIds || [];
    return actorIds.map((id) => game.actors?.get(id)).filter((actor) => actor && (game.user.isGM || actor.testUserPermission?.(game.user, "OWNER"))).slice(0, 6);
  };

  const actorContext = (actor) => ({
    id: actor.id,
    name: actor.name,
    img: actor.prototypeToken?.texture?.src || actor.img || "icons/svg/mystery-man.svg",
    survival: signed(actor.system?.skills?.sur?.mod ?? actor.system?.abilities?.wis?.mod ?? 0),
    herb: signed(toolBonus(actor, ["herb", "herbalism", "herbalist"], ["травник", "травнич"])),
    alchemy: signed(toolBonus(actor, ["alchemist", "poisoner", "poison"], ["алхим", "отравитель"])),
    selected: actor.id === selectedId()
  });

  const stockImage = (item) => {
    const herb = item?.ingredientId && EA.herb?.(item.ingredientId);
    const source = item?.img || item?.image || herb?.image;
    if (!source) return "icons/svg/item-bag.svg";
    if (/^(https?:|data:|icons\/|modules\/|worlds\/|systems\/)/i.test(source)) return source;
    return EA.herbImagePath?.(source) || `modules/${EA.id}/assets/images/herbs/${source}`;
  };

  const stockAspects = (state, item) => {
    const raw = state?.group?.knownAspects?.[item?.ingredientId];
    if (!raw) return "свойства ещё не изучены";
    if (typeof raw === "string") return raw;
    return EA.aspectText?.(raw?.aspects ?? raw) || "свойства ещё не изучены";
  };

  const stockCard = (state, item) => {
    const name = EA.esc(item?.name || EA.herb?.(item?.ingredientId)?.name || "Неизвестное растение");
    const image = EA.esc(stockImage(item));
    const quantity = Math.max(0, Number(item?.quantity) || 0);
    const aspects = EA.esc(stockAspects(state, item));
    return `<article class="ea-v2-stock-card" data-stock-id="${EA.esc(item?.ingredientId || "")}"><div class="ea-v2-stock-image-wrap"><img class="ea-v2-stock-image" src="${image}" alt="" loading="lazy" onerror="this.onerror=null;this.src='icons/svg/item-bag.svg';"></div><div class="ea-v2-stock-body"><h3>${name}</h3><strong class="ea-v2-stock-quantity">×${quantity}</strong><p>${aspects}</p></div></article>`;
  };

  const normalizeName = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const validImage = (value) => {
    const image = String(value ?? "").trim();
    return /^(https?:|data:|icons\/|modules\/|worlds\/|systems\/)/i.test(image) ? image : "";
  };

  const resolveRecipeImage = async (recipe) => {
    const key = recipe?.id || normalizeName(recipe?.name);
    if (recipeImageCache.has(key)) return recipeImageCache.get(key);
    const direct = validImage(recipe?.img || recipe?.image || recipe?.output?.img || recipe?.output?.image);
    if (direct) {
      recipeImageCache.set(key, direct);
      return direct;
    }
    const itemName = recipe?.output?.itemName || recipe?.name;
    const wanted = normalizeName(itemName);
    try {
      const worldItem = game.items?.find((item) => normalizeName(item.name) === wanted);
      if (worldItem?.img) {
        recipeImageCache.set(key, worldItem.img);
        return worldItem.img;
      }
      for (const pack of game.packs ?? []) {
        if (pack.documentName !== "Item") continue;
        const index = await pack.getIndex({ fields: ["name", "img"] });
        const entry = index.find((item) => normalizeName(item.name) === wanted && validImage(item.img));
        if (entry?.img) {
          recipeImageCache.set(key, entry.img);
          return entry.img;
        }
      }
    } catch (error) {
      console.warn(`${EA.id} | Не удалось найти изображение рецепта`, recipe?.name, error);
    }
    const fallback = "icons/svg/potion.svg";
    recipeImageCache.set(key, fallback);
    return fallback;
  };

  const recipeCard = async (recipe) => {
    const image = EA.esc(await resolveRecipeImage(recipe));
    const name = EA.esc(recipe?.name || "Безымянный рецепт");
    const requirements = EA.esc(EA.aspectText?.(recipe?.requirements || {}) || "Требования не указаны");
    const description = EA.esc(String(recipe?.description || "Описание отсутствует").replace(/<[^>]*>/g, ""));
    const dc = game.user.isGM ? `<span class="ea-v2-recipe-dc">СЛ ${Number(recipe?.brewDC) || 10}</span>` : "";
    return `<article class="ea-v2-recipe-card"><div class="ea-v2-recipe-image-wrap"><img class="ea-v2-recipe-image" src="${image}" alt="" loading="lazy" onerror="this.onerror=null;this.src='icons/svg/potion.svg';"></div><div class="ea-v2-recipe-body"><h3 title="${name}">${name}</h3><p class="ea-v2-recipe-requirements">${requirements}</p><p class="ea-v2-recipe-description">${description}</p><div class="ea-v2-recipe-footer">${dc}<button type="button" class="ea-v2-inline-action" data-action="recipe-details" data-recipe-id="${EA.esc(recipe.id)}">Подробнее</button></div></div></article>`;
  };

  const recipeDetails = async (recipe) => {
    const image = EA.esc(await resolveRecipeImage(recipe));
    const name = EA.esc(recipe?.name || "Безымянный рецепт");
    const requirements = EA.esc(EA.aspectText?.(recipe?.requirements || {}) || "Требования не указаны");
    const description = EA.esc(String(recipe?.description || "Описание отсутствует").replace(/<[^>]*>/g, ""));
    const dc = game.user.isGM ? `<p class="ea-v2-detail-dc">Сложность: ${Number(recipe?.brewDC) || 10}</p>` : "";
    return `<section class="ea-v2-recipe-details"><button type="button" class="ea-v2-back-action" data-action="recipe-back">← К рецептам</button><div class="ea-v2-recipe-detail-body"><img class="ea-v2-recipe-detail-image" src="${image}" alt=""><div><h2>${name}</h2><p><b>Требования:</b> ${requirements}</p>${dc}<p class="ea-v2-detail-description">${description}</p></div></div></section>`;
  };

  const renderRecipes = async (state, app) => {
    const recipes = (state?.recipes || []).filter((recipe) => game.user.isGM || recipe.playersKnow !== false);
    if (app.recipeDetailsId) {
      const recipe = recipes.find((entry) => entry.id === app.recipeDetailsId);
      if (recipe) return await recipeDetails(recipe);
      app.recipeDetailsId = null;
    }
    const pageCount = Math.max(1, Math.ceil(recipes.length / RECIPE_PAGE_SIZE));
    app.recipePage = Math.min(Math.max(0, app.recipePage), pageCount - 1);
    const start = app.recipePage * RECIPE_PAGE_SIZE;
    const visible = recipes.slice(start, start + RECIPE_PAGE_SIZE);
    const cards = visible.length ? (await Promise.all(visible.map(recipeCard))).join("") : `<p class="ea-v2-empty">Известных рецептов пока нет.</p>`;
    const from = recipes.length ? start + 1 : 0;
    const to = Math.min(start + RECIPE_PAGE_SIZE, recipes.length);
    return `<section class="ea-v2-panel ea-v2-recipes-panel"><div class="ea-v2-panel-heading"><div><h2>Рецепты</h2><p class="ea-v2-muted">Известно рецептов: <b>${recipes.length}</b></p></div><span class="ea-v2-panel-count">${from}–${to} из ${recipes.length}</span></div><div class="ea-v2-recipe-grid">${cards}</div><footer class="ea-v2-pagination"><button type="button" data-action="recipe-prev" ${app.recipePage <= 0 ? "disabled" : ""}>← Назад</button><span>${app.recipePage + 1} / ${pageCount}</span><button type="button" data-action="recipe-next" ${app.recipePage >= pageCount - 1 ? "disabled" : ""}>Вперёд →</button></footer></section>`;
  };

  const renderPanel = async (mode, state, app) => {
    const stock = state?.group?.stock || [];
    if (mode === "recipes") return await renderRecipes(state, app);
    if (mode === "gather") return `<section class="ea-v2-panel"><h2>Сбор</h2><p>Территория: <b>${EA.esc(state?.configuration?.activeTerritory || "не выбрана")}</b></p><p>Выберите персонажа сверху, затем настройте типы трав и начните сбор.</p><button type="button" class="ea-v2-action" disabled>Начать сбор</button></section>`;
    if (mode === "stock") {
      const cards = stock.length ? stock.map((item) => stockCard(state, item)).join("") : `<p class="ea-v2-empty">Склад пока пуст.</p>`;
      const total = stock.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      return `<section class="ea-v2-panel ea-v2-stock-panel"><div class="ea-v2-panel-heading"><div><h2>Склад</h2><p class="ea-v2-muted">Видов растений: <b>${stock.length}</b></p></div><span class="ea-v2-panel-count">${total} ед.</span></div><div class="ea-v2-stock-grid">${cards}</div></section>`;
    }
    const total = stock.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    return `<section class="ea-v2-panel"><h2>Изготовление</h2><p class="ea-v2-muted">Ингредиентов на складе: <b>${total}</b></p><p>Выбор ингредиентов и результаты проверки будут перенесены в ApplicationV2 следующим этапом.</p><button type="button" class="ea-v2-action" disabled>Проверить возможные рецепты</button></section>`;
  };

  class EAPlayerApplicationV2 extends api.HandlebarsApplicationMixin(api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "malcals-extraalchemy-player-v2",
      classes: ["ea-v2-window"],
      tag: "main",
      position: { width: 1100, height: 700 },
      window: { title: "Алхимия", frame: true, positioned: true, resizable: true, contentClasses: ["ea-v2-content"] },
      actions: {
        "select-mode": function selectMode(event, target) { this.mode = target.dataset.mode || "recipes"; this.recipeDetailsId = null; this.recipePage = 0; this.render({ force: true }); },
        "select-actor": function selectActor(event, target) { try { localStorage.setItem(selectedKey(), target.dataset.actor || ""); } catch {} this.render({ force: true }); },
        "recipe-prev": function recipePrev() { this.recipePage = Math.max(0, (this.recipePage || 0) - 1); this.render({ force: true }); },
        "recipe-next": function recipeNext() { this.recipePage = (this.recipePage || 0) + 1; this.render({ force: true }); },
        "recipe-details": function recipeDetailsAction(event, target) { this.recipeDetailsId = target.dataset.recipeId || null; this.render({ force: true }); },
        "recipe-back": function recipeBack() { this.recipeDetailsId = null; this.render({ force: true }); }
      }
    };

    static PARTS = { main: { template: "modules/malcals-extraalchemy/templates/appv2/player-window.hbs" } };

    constructor(options = {}) { super(options); this.mode = "recipes"; this.recipePage = 0; this.recipeDetailsId = null; }

    async _prepareContext() {
      const state = EA.getState();
      const roster = getActors().map(actorContext);
      if (roster.length && !roster.some((actor) => actor.selected)) {
        roster[0].selected = true;
        try { localStorage.setItem(selectedKey(), roster[0].id); } catch {}
      }
      return {
        title: "Алхимия",
        roster,
        leftModes: modes.filter((mode) => mode.id === "recipes" || mode.id === "stock").map((mode) => ({ ...mode, active: mode.id === this.mode })),
        rightModes: modes.filter((mode) => mode.id === "gather" || mode.id === "crafting").map((mode) => ({ ...mode, active: mode.id === this.mode })),
        panel: await renderPanel(this.mode, state, this)
      };
    }
  }

  EA.PlayerApplicationV2 = EAPlayerApplicationV2;
  EA.openPlayerAppV2 = () => {
    if (!EA._playerAppV2) EA._playerAppV2 = new EAPlayerApplicationV2();
    EA._playerAppV2.render({ force: true });
    return EA._playerAppV2;
  };

  Hooks.on("getSceneControlButtons", (controls) => {
    const group = controls.tokens ?? controls.token ?? Object.values(controls).find((value) => value?.name === "token");
    if (!group) return;
    const open = () => EA.openPlayerAppV2?.() || EA.hub?.();
    if (Array.isArray(group.tools)) {
      const tool = group.tools.find((entry) => entry.name === "malcals-extraalchemy-tools");
      if (tool) tool.onChange = open;
    } else {
      const tool = group.tools?.["malcals-extraalchemy-tools"];
      if (tool) tool.onChange = open;
    }
  });

  console.info(`${EA.id} | ApplicationV2 player scaffold registered.`);
})();
