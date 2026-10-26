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

  const renderPanel = (mode, state) => {
    const stock = state?.group?.stock || [];
    const recipes = (state?.recipes || []).filter((recipe) => game.user.isGM || recipe.playersKnow !== false);
    if (mode === "recipes") return `<section class="ea-v2-panel"><h2>Рецепты</h2><p class="ea-v2-muted">Известно рецептов: <b>${recipes.length}</b></p><p>Каталог рецептов будет перенесён в это окно следующим этапом.</p></section>`;
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
        "select-mode": function selectMode(event, target) { this.mode = target.dataset.mode || "recipes"; this.render({ force: true }); },
        "select-actor": function selectActor(event, target) { try { localStorage.setItem(selectedKey(), target.dataset.actor || ""); } catch {} this.render({ force: true }); }
      }
    };

    static PARTS = { main: { template: "modules/malcals-extraalchemy/templates/appv2/player-window.hbs" } };

    constructor(options = {}) { super(options); this.mode = "recipes"; }

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
        panel: renderPanel(this.mode, state)
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
