/* Shared workflow services for Foundry VTT 13/14. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  const root = value => value?.[0] ?? value;
  const id = () => foundry.utils.randomID();
  const isGM = () => !!game.user?.isGM;
  const authoritativeGM = () => isGM() && game.users.activeGM?.id === game.user.id;
  const state = () => E.getState();

  E.herb = key => (E.herbSeeds?.() || []).find(herb => herb.ingredientId === key) || null;
  E.entry = (current, key) => (current.group.stock || []).find(item => item.ingredientId === key) || null;
  E.known = (current, key) => current.group.knownAspects?.[key] || {};
  E.actors = current => (current.configuration.actorIds || []).map(key => game.actors.get(key)).filter(Boolean);
  E.canActor = (user, actor, current) => Boolean(user?.isGM || (actor && current.configuration.actorIds.includes(actor.id) && actor.testUserPermission?.(user, "OWNER")));
  E.canAlchemy = (user, current) => Boolean(user?.isGM || E.actors(current).some(actor => actor.testUserPermission?.(user, "OWNER")));

  E.popup = (title, content, buttons = {}, render) => new Dialog({
    title,
    content,
    buttons,
    render: html => render?.(root(html))
  }).render(true);

  E.changed = () => {
    Hooks.callAll("eaStockChanged");
    if (authoritativeGM()) game.socket.emit(`module.${E.id}`, { type: "changed" });
  };
  E.commit = async current => {
    await E.saveState(current);
    E.changed();
  };

  E.add = (current, herb, quantity = 1) => {
    const ingredientId = herb?.ingredientId ?? herb?.seedId;
    const amount = Math.max(1, Math.floor(Number(quantity) || 1));
    if (!ingredientId) throw new Error("У растения нет идентификатора.");
    let item = E.entry(current, ingredientId);
    if (item) item.quantity = Number(item.quantity || 0) + amount;
    else {
      item = {
        ingredientId,
        quantity: amount,
        name: herb.name || ingredientId,
        img: herb.image ? E.herbImagePath?.(herb.image) || herb.image : "icons/svg/item-bag.svg"
      };
      current.group.stock.push(item);
    }
    return item;
  };
  E.take = (current, ingredientId, quantity = 1) => {
    const item = E.entry(current, ingredientId);
    const amount = Math.max(1, Math.floor(Number(quantity) || 1));
    if (!item || Number(item.quantity || 0) < amount) throw new Error("На складе недостаточно растения.");
    item.quantity -= amount;
    if (item.quantity <= 0) current.group.stock = current.group.stock.filter(entry => entry !== item);
  };
  E.total = (current, ingredients) => {
    const totals = {};
    for (const ingredient of ingredients || []) {
      const quantity = Math.max(1, Math.floor(Number(ingredient.quantity) || 1));
      for (const [aspect, value] of Object.entries(E.known(current, ingredient.ingredientId))) {
        totals[aspect] = (totals[aspect] || 0) + Number(value || 0) * quantity;
      }
    }
    return totals;
  };
  E.matches = (recipe, available) => Object.entries(recipe?.requirements || {}).every(([aspect, needed]) => Number(available?.[aspect] || 0) >= Number(needed || 0));
  E.pick = (current, goals) => {
    const allowed = current.configuration.allowedHerbIds || [];
    const selected = Array.isArray(goals) ? goals : [];
    const choices = (E.herbSeeds?.() || []).filter(herb => allowed.includes(herb.ingredientId) && (herb.regions || []).includes(current.configuration.activeTerritory) && (!selected.length || (herb.types || herb.goals || []).some(type => selected.includes(type))));
    return choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
  };

  E.resolveGather = async request => {
    const current = state();
    const user = game.users.get(request?.userId);
    const actor = game.actors.get(request?.actorId);
    if (!user || !actor || !E.canActor(user, actor, current)) throw new Error("Нет доступа к персонажу.");
    const total = Number(request.total) || 0;
    const success = total >= current.configuration.gatherDC;
    const result = { id: id(), timestamp: Date.now(), actorName: actor.name, territory: current.configuration.activeTerritory, goals: Array.isArray(request.goals) ? request.goals : [], total, success, result: "" };
    if (success) {
      const herb = E.pick(current, result.goals);
      result.result = herb ? `Успех: найдена трава «${herb.name}».` : "Успех, но подходящее растение не найдено.";
      if (herb) E.add(current, herb, 1);
    } else result.result = "Неудача: подходящее растение не найдено.";
    current.group.gatherHistory.unshift(result);
    await E.commit(current);
    return { message: result.result };
  };

  E.resolveResearch = async request => {
    const current = state();
    const user = game.users.get(request?.userId);
    const ingredientId = request?.ingredientId;
    if (!user || !E.canAlchemy(user, current)) throw new Error("Нет доступа к алхимии группы.");
    if (!E.entry(current, ingredientId)) throw new Error("Растение отсутствует на складе.");
    const herb = E.herb(ingredientId);
    if (!herb) throw new Error("Растение отсутствует в библиотеке.");
    const known = E.known(current, ingredientId);
    const unknown = Object.entries(herb.aspects || {}).filter(([aspect]) => !Object.hasOwn(known, aspect));
    if (!unknown.length) throw new Error("Все аспекты этого растения уже известны.");
    const [aspect, value] = unknown[Math.floor(Math.random() * unknown.length)];
    E.take(current, ingredientId, 1);
    current.group.knownAspects[ingredientId] = { ...known, [aspect]: value };
    await E.commit(current);
    return { research: true, aspect, value };
  };

  E.resolveBrew = async request => {
    const current = state();
    const user = game.users.get(request?.userId);
    const actor = game.actors.get(request?.actorId);
    const recipe = current.recipes.find(item => item.id === request?.recipeId);
    const ingredients = (request?.ingredients || []).map(item => ({ ingredientId: item.ingredientId, quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)) }));
    if (!user || !actor || !E.canActor(user, actor, current)) throw new Error("Нет доступа к персонажу.");
    if (!recipe) throw new Error("Рецепт не найден.");
    if (!user.isGM && recipe.playersKnow === false) throw new Error("Рецепт неизвестен игрокам.");
    if (!ingredients.length || !E.matches(recipe, E.total(current, ingredients))) throw new Error("Недостаточно известных аспектов.");
    for (const ingredient of ingredients) E.take(current, ingredient.ingredientId, ingredient.quantity);
    const total = Number(request.total) || 0;
    const success = total >= recipe.brewDC;
    let message = "Провал: ингредиенты израсходованы.";
    if (success) {
      const output = recipe.output || {};
      const quantity = Math.max(1, Number(total >= recipe.brewDC + 5 ? output.criticalQuantity : output.quantity) || 1);
      const name = output.itemName || recipe.name;
      await actor.createEmbeddedDocuments("Item", [{
        name,
        type: "consumable",
        img: output.img || "icons/consumables/potions/bottle-round-corked-red.webp",
        system: { quantity, description: { value: `<p>${E.esc(recipe.description || "Алхимический состав.")}</p>` } },
        flags: { [E.id]: { recipeId: recipe.id } }
      }]);
      message = `Успех: создано «${name}» × ${quantity}.`;
    }
    current.group.brewHistory.unshift({ id: id(), timestamp: Date.now(), actorName: actor.name, recipeId: recipe.id, recipeName: recipe.name, total, dc: recipe.brewDC, success, ingredients });
    await E.commit(current);
    return { message };
  };

  E.config = () => {
    if (!isGM()) return;
    const current = state();
    const herbs = E.herbSeeds?.() || [];
    const content = `<section class="ea-panel"><label>Персонажи<select id="ea-actors" multiple size="6">${Array.from(game.actors || []).filter(actor => actor.type === "character").map(actor => `<option value="${actor.id}"${current.configuration.actorIds.includes(actor.id) ? " selected" : ""}>${E.esc(actor.name)}</option>`).join("")}</select></label><label>Территория<select id="ea-territory">${current.configuration.territories.map(place => `<option${place === current.configuration.activeTerritory ? " selected" : ""}>${E.esc(place)}</option>`).join("")}</select></label><label>СЛ сбора<input id="ea-dc" type="number" min="1" value="${current.configuration.gatherDC}"></label><fieldset><legend>Разрешённые растения</legend>${herbs.map(herb => `<label class="ea-check"><input name="ea-herb" type="checkbox" value="${herb.ingredientId}"${current.configuration.allowedHerbIds.includes(herb.ingredientId) ? " checked" : ""}>${E.esc(herb.name)}</label>`).join("")}</fieldset></section>`;
    E.popup("Алхимия — настройка", content, { save: { label: "Сохранить", callback: async html => {
      const view = root(html);
      current.configuration.actorIds = Array.from(view.querySelector("#ea-actors").selectedOptions).map(option => option.value);
      current.configuration.activeTerritory = view.querySelector("#ea-territory").value;
      current.configuration.gatherDC = Math.max(1, Number(view.querySelector("#ea-dc").value) || 10);
      current.configuration.allowedHerbIds = Array.from(view.querySelectorAll("input[name='ea-herb']:checked")).map(input => input.value);
      await E.commit(current);
      ui.notifications.info("Настройки алхимии сохранены.");
    } }, close: { label: "Закрыть" } });
  };

  E.stock = () => E.openAdminStock?.();
  E.openPanel = name => {
    if (name === "crafting" || name === "experiments") {
      const app = E.openPlayerAppV2?.();
      if (!app) {
        ui.notifications?.error?.("Интерфейс ApplicationV2 недоступен.");
        return;
      }
      app.mode = "crafting";
      app.craftingStage = "ingredients";
      app.craftingIngredients = [];
      app.craftingPage = 0;
      app.render({ force: true });
      return app;
    }
    return ({ config: E.config, gather: E.gather, stock: E.stock, recipes: E.recipes, knownRecipes: E.knownRecipes, library: E.openLibrary, adminStock: E.openAdminStock }[name]?.());
  };
  E.hub = () => E.popup("Инструменты алхимии", `<section class="ea-panel"><button data-ea-panel="gather">Сбор</button><button data-ea-panel="stock">Склад</button><button data-ea-panel="crafting">Изготовление</button><button data-ea-panel="knownRecipes">Известные рецепты</button>${isGM() ? `<button data-ea-panel="config">Настройка</button><button data-ea-panel="recipes">Рецепты</button>` : ""}</section>`, { close: { label: "Закрыть" } }, view => view.querySelectorAll("[data-ea-panel]").forEach(button => button.onclick = () => E.openPanel(button.dataset.eaPanel)));

  console.info(`${E.id} | shared workflow services registered.`);
})();
