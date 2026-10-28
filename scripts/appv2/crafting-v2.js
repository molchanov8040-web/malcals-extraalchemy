/* ApplicationV2 crafting workflow for Foundry VTT 13/14. */
(() => {
  const EA = globalThis.EA;
  const Base = EA?.PlayerApplicationV2;
  if (!EA || !Base) {
    console.warn(`${EA?.id || "malcals-extraalchemy"} | Crafting ApplicationV2 patch loaded before player app.`);
    return;
  }
  const esc = value => EA.esc(value);
  const dnd = () => EA.dnd5e || {};
  const signed = value => `${Number(value) >= 0 ? "+" : ""}${Number(value) || 0}`;
  const selectedActor = () => {
    const ids = EA.getState()?.configuration?.actorIds || [];
    const actors = ids.map(id => game.actors?.get(id)).filter(actor => actor && (game.user.isGM || actor.testUserPermission?.(game.user, "OWNER")));
    let id = "";
    try { id = localStorage.getItem(`${EA.id}.appv2-selected-actor.${game.user?.id ?? "unknown"}`) || ""; } catch {}
    return actors.find(actor => actor.id === id) || actors[0] || null;
  };
  const herbImage = item => {
    const herb = EA.herb?.(item?.ingredientId);
    const source = item?.img || item?.image || herb?.image;
    if (!source) return "icons/svg/item-bag.svg";
    if (/^(https?:|data:|icons\/|modules\/|worlds\/|systems\/)/i.test(source)) return source;
    return EA.herbImagePath?.(source) || `modules/${EA.id}/assets/images/herbs/${source}`;
  };
  const recipeFallback = `modules/${EA.id}/assets/images/potions/healing-poultice.webp`;
  const recipeImage = async recipe => {
    if (typeof EA.resolveApplicationV2RecipeImage === "function") {
      try { return await EA.resolveApplicationV2RecipeImage(recipe); } catch (error) {
        console.warn(`${EA.id} | Не удалось разрешить изображение результата`, recipe?.name, error);
      }
    }
    const direct = recipe?.img || recipe?.image || recipe?.output?.img || recipe?.output?.image;
    return /^(https?:|data:|icons\/|modules\/|worlds\/|systems\/)/i.test(String(direct || "")) ? direct : recipeFallback;
  };
  const totalsFor = ingredients => {
    const totals = {};
    for (const entry of ingredients || []) {
      const aspects = EA.getState()?.group?.knownAspects?.[entry.ingredientId] || {};
      const quantity = Math.max(0, Number(entry.quantity) || 0);
      for (const [aspect, value] of Object.entries(aspects)) totals[aspect] = (totals[aspect] || 0) + Number(value || 0) * quantity;
    }
    return totals;
  };
  const compatible = (recipe, ingredients) => Object.entries(recipe?.requirements || recipe?.need || {}).every(([aspect, required]) => Number(totalsFor(ingredients)[aspect] || 0) >= Number(required || 0));
  const actorCanCraft = actor => Boolean(actor && (game.user.isGM || actor.testUserPermission?.(game.user, "OWNER")));
  const stockCard = (item, selected) => {
    const herb = EA.herb?.(item?.ingredientId), id = String(item?.ingredientId || "");
    const max = Math.max(0, Number(item?.quantity) || 0), quantity = Math.min(max, Math.max(1, Number(selected?.quantity) || 1));
    const name = item?.name || herb?.name || id || "Неизвестное растение";
    return `<label class="ea-v2-craft-card"><div class="ea-v2-craft-card-top"><img src="${esc(herbImage(item))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='icons/svg/item-bag.svg';"><span class="ea-v2-craft-check"><input type="checkbox" name="ea-v2-craft-ingredient" value="${esc(id)}"${selected ? " checked" : ""}> <b>${esc(name)}</b></span></div><small>На складе: ${max}</small><input class="ea-v2-craft-quantity" type="number" min="1" max="${max}" value="${quantity}" data-craft-quantity="${esc(id)}" aria-label="Количество: ${esc(name)}" ${max < 1 ? "disabled" : ""}></label>`;
  };
  const recipeCard = async recipe => {
    const image = esc(await recipeImage(recipe));
    return `<article class="ea-v2-craft-recipe-card"><img class="ea-v2-craft-recipe-card-image" src="${image}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${recipeFallback}';"><div class="ea-v2-craft-recipe-body"><h3>${esc(recipe?.name || "Безымянный рецепт")}</h3><p>${esc(EA.aspectText?.(recipe?.requirements || {}) || "Требования не указаны")}</p>${game.user.isGM ? `<small>СЛ ${Number(recipe?.brewDC) || 10}</small>` : ""}<button type="button" class="ea-v2-inline-action" data-action="craft-brew" data-recipe-id="${esc(recipe?.id || "")}">Изготовить</button></div></article>`;
  };
  const renderCrafting = async (app, state) => {
    const actor = selectedActor();
    if (app.craftingStage === "results") {
      const ingredients = app.craftingIngredients || [];
      const recipes = (state?.recipes || []).filter(recipe => game.user.isGM || recipe.playersKnow !== false).filter(recipe => compatible(recipe, ingredients));
      const pages = Math.max(1, Math.ceil(recipes.length / 4)), page = Math.min(Math.max(0, Number(app.craftingPage) || 0), pages - 1);
      app.craftingPage = page;
      const summary = ingredients.map(entry => `${EA.herb?.(entry.ingredientId)?.name || entry.ingredientId} ×${entry.quantity}`).join(" · ");
      const cards = (await Promise.all(recipes.slice(page * 4, page * 4 + 4).map(recipeCard))).join("");
      return `<section class="ea-v2-panel ea-v2-crafting-panel"><div class="ea-v2-panel-heading"><div><h2>Подходящие рецепты</h2><p class="ea-v2-muted">Ингредиенты: <b>${esc(summary || "не выбраны")}</b></p></div><span class="ea-v2-panel-count">${recipes.length} найдено</span></div><div class="ea-v2-craft-results">${cards || `<p class="ea-v2-empty">Подходящих рецептов нет.</p>`}</div><footer class="ea-v2-crafting-footer"><button type="button" class="ea-v2-inline-action" data-action="craft-back">← Изменить ингредиенты</button><span class="ea-v2-crafting-page">${recipes.length ? `${page * 4 + 1}–${Math.min(page * 4 + 4, recipes.length)} из ${recipes.length} · ` : ""}${page + 1} / ${pages}</span><button type="button" class="ea-v2-inline-action" data-action="craft-next" ${page >= pages - 1 ? "disabled" : ""}>Вперёд ▶</button></footer></section>`;
    }
    const stock = state?.group?.stock || [], selected = new Map((app.craftingIngredients || []).map(entry => [entry.ingredientId, entry]));
    const cards = stock.map(item => stockCard(item, selected.get(item.ingredientId))).join("");
    const intelligence = actor ? dnd().intelligenceModifier?.(actor) ?? 0 : 0;
    const alchemy = actor ? EA.alchemyBonus?.(actor) || 0 : 0;
    return `<section class="ea-v2-panel ea-v2-crafting-panel"><div class="ea-v2-panel-heading"><div><h2>Изготовление</h2><p class="ea-v2-muted">${actor ? `Алхимик: <b>${esc(actor.name)}</b> · Интеллект ${signed(intelligence)} · набор ${signed(alchemy)}` : "Нет доступного персонажа."}</p></div></div><div class="ea-v2-craft-grid">${cards || `<p class="ea-v2-empty">Склад пуст.</p>`}</div><footer class="ea-v2-crafting-footer"><button type="button" class="ea-v2-action" data-action="craft-check" ${actor && stock.length ? "" : "disabled"}>Проверить возможные рецепты</button></footer></section>`;
  };
  const basePrepare = Base.prototype._prepareContext;
  Base.prototype._prepareContext = async function() {
    const context = await basePrepare.call(this);
    if (this.mode === "crafting") context.panel = await renderCrafting(this, EA.getState());
    return context;
  };
  const previousActions = Base.DEFAULT_OPTIONS.actions || {};
  Base.DEFAULT_OPTIONS = {
    ...Base.DEFAULT_OPTIONS,
    actions: {
      ...previousActions,
      "craft-check": function() {
        const root = this.element;
        const ingredients = Array.from(root.querySelectorAll("input[name='ea-v2-craft-ingredient']:checked")).map(input => ({
          ingredientId: input.value,
          quantity: Math.max(1, Math.floor(Number(root.querySelector(`[data-craft-quantity="${CSS.escape(input.value)}"]`)?.value) || 1))
        }));
        if (!ingredients.length) return ui.notifications.warn("Выберите хотя бы одну траву.");
        this.craftingIngredients = ingredients;
        this.craftingStage = "results";
        this.craftingPage = 0;
        this.render({ force: true });
      },
      "craft-back": function() { this.craftingStage = "ingredients"; this.craftingPage = 0; this.render({ force: true }); },
      "craft-next": function() { this.craftingPage = (this.craftingPage || 0) + 1; this.render({ force: true }); },
      "craft-brew": async function(event, target) {
        const actor = selectedActor();
        if (!actorCanCraft(actor)) return ui.notifications.warn("Нет доступного персонажа для изготовления.");
        const recipeId = target.dataset.recipeId, recipe = (EA.getState()?.recipes || []).find(entry => entry.id === recipeId);
        if (!recipe) return ui.notifications.error("Рецепт не найден.");
        target.disabled = true;
        try {
          // The GM-authoritative workflow performs the only roll. The client sends
          // the selected actor, recipe and ingredients but never a roll total.
          const response = await EA.request({ type: "brew", actorId: actor.id, recipeId, ingredients: this.craftingIngredients || [] });
          if (response?.message) ui.notifications.info(response.message);
          Hooks.callAll("eaStockChanged");
          this.render({ force: true });
        } catch (error) {
          console.error(`${EA.id} | ApplicationV2 crafting failed`, error);
          ui.notifications.error(error?.message || "Не удалось изготовить состав.");
        } finally { target.disabled = false; }
      }
    }
  };
  const originalOpen = EA.openPlayerAppV2;
  EA.openPlayerAppV2 = (...args) => {
    const app = originalOpen(...args);
    if (app && app.craftingStage === undefined) { app.craftingStage = "ingredients"; app.craftingIngredients = []; app.craftingPage = 0; }
    return app;
  };
  console.info(`${EA.id} | ApplicationV2 crafting registered.`);
})();