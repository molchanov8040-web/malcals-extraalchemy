/* GM-authoritative checks for gathering, research and brewing. */
(() => {
  const E = globalThis.EA;
  if (!E) return;
  let queue = Promise.resolve();
  const requests = new Map();
  const isActiveGM = () => Boolean(game.user?.isGM && game.users?.activeGM?.id === game.user.id);
  const serial = task => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };
  const runOnce = (type, request, task) => {
    const id = request?.requestId;
    if (typeof id !== "string" || !id || id.length > 128) return serial(task);
    const key = JSON.stringify([request.userId, id]);
    const existing = requests.get(key);
    if (existing) {
      if (existing.type !== type) return Promise.reject(new Error("Идентификатор запроса уже использован."));
      return existing.promise;
    }
    const promise = serial(task);
    requests.set(key, { type, promise });
    promise.catch(() => requests.delete(key));
    promise.then(() => {
      const entry = requests.get(key);
      if (entry) entry.done = true;
      while (requests.size > 200) {
        const oldest = [...requests].find(([, value]) => value.done);
        if (!oldest) break;
        requests.delete(oldest[0]);
      }
    }, () => {});
    return promise;
  };
  const checkedActor = (request, state) => {
    if (!isActiveGM()) throw new Error("Операцию должен обработать активный ведущий.");
    const user = game.users.get(request?.userId);
    const actor = game.actors.get(request?.actorId);
    if (!user || !actor || !E.canActor(user, actor, state)) throw new Error("Нет доступа к персонажу.");
    return { user, actor };
  };
  const gmRoll = async (actor, type) => {
    const dnd = E.dnd5e;
    if (!dnd) throw new Error("Адаптер D&D 5e не загружен.");
    const gather = type === "gather";
    const mod = Number(gather ? dnd.survivalModifier(actor) : dnd.intelligenceModifier(actor));
    const tool = Number(gather ? dnd.herbalismBonus(actor) : dnd.alchemyBonus(actor));
    if (!Number.isFinite(mod) || !Number.isFinite(tool)) throw new Error("Не удалось определить бонус персонажа.");
    const RollClass = globalThis.Roll || globalThis.foundry?.dice?.Roll;
    if (typeof RollClass !== "function") throw new Error("API бросков Foundry недоступен.");
    const roll = new RollClass("1d20 + @mod + @tool", { mod, tool });
    await roll.evaluate({ async: true });
    const total = Number(roll.total);
    if (!Number.isFinite(total)) throw new Error("Не удалось вычислить результат броска.");
    if (typeof roll.toMessage !== "function") throw new Error("API сообщения броска Foundry недоступен.");
    await roll.toMessage({ speaker: dnd.speaker(actor), flavor: gather ? "Сбор трав: проверка ведущего" : "Изготовление алхимического состава: проверка ведущего" });
    return total;
  };
  const oldGather = E.resolveGather, oldResearch = E.resolveResearch, oldBrew = E.resolveBrew;
  if ([oldGather, oldResearch, oldBrew].some(fn => typeof fn !== "function")) {
    const unavailable = async () => { throw new Error("Защищённый обработчик алхимии не загружен."); };
    E.resolveGather = E.resolveResearch = E.resolveBrew = unavailable;
    console.error(`${E.id} | Authoritative workflow unavailable; actions disabled.`);
    return;
  }
  E.resolveGather = request => runOnce("gather", request, async () => {
    const state = E.getState();
    const { actor } = checkedActor(request, state);
    const allowed = new Set((E.goals || []).map(([key]) => key));
    if (!Array.isArray(request.goals) || !request.goals.length || request.goals.some(goal => !allowed.has(goal))) throw new Error("Выберите допустимые типы трав.");
    const total = await gmRoll(actor, "gather");
    return oldGather({ ...request, total });
  });
  E.resolveResearch = request => runOnce("research", request, async () => {
    if (!isActiveGM()) throw new Error("Операцию должен обработать активный ведущий.");
    return oldResearch(request);
  });
  E.resolveBrew = request => runOnce("brew", request, async () => {
    const state = E.getState();
    const { user, actor } = checkedActor(request, state);
    const recipe = state.recipes.find(item => item.id === request?.recipeId);
    if (!recipe || (!user.isGM && recipe.playersKnow === false)) throw new Error("Рецепт недоступен.");
    if (!Array.isArray(request.ingredients) || !request.ingredients.length || request.ingredients.length > 100) throw new Error("Выберите ингредиенты.");
    const quantities = new Map();
    for (const item of request.ingredients) {
      const amount = Number(item?.quantity);
      if (typeof item?.ingredientId !== "string" || !item.ingredientId || !Number.isSafeInteger(amount) || amount <= 0) throw new Error("Некорректное количество ингредиентов.");
      const total = (quantities.get(item.ingredientId) || 0) + amount;
      if (!Number.isSafeInteger(total)) throw new Error("Некорректное количество ингредиентов.");
      quantities.set(item.ingredientId, total);
    }
    const ingredients = [...quantities].map(([ingredientId, quantity]) => ({ ingredientId, quantity }));
    for (const item of ingredients) {
      if (Number(E.entry(state, item.ingredientId)?.quantity || 0) < item.quantity) throw new Error("На складе недостаточно растения.");
    }
    if (!E.matches(recipe, E.total(state, ingredients))) throw new Error("Недостаточно известных аспектов.");
    const total = await gmRoll(actor, "brew");
    return oldBrew({ ...request, ingredients, total });
  });
  const Base = E.PlayerApplicationV2;
  if (Base?.DEFAULT_OPTIONS?.actions) {
    const selectedActor = () => {
      const state = E.getState();
      const actors = E.actors(state).filter(actor => E.canActor(game.user, actor, state));
      let selected = "";
      try { selected = localStorage.getItem(`${E.id}.appv2-selected-actor.${game.user?.id ?? "unknown"}`) || ""; } catch {}
      return actors.find(actor => actor.id === selected) || actors[0];
    };
    Base.DEFAULT_OPTIONS.actions["gather-start"] = async function() {
      if (this.gathering) return;
      const goals = Array.from(this.element.querySelectorAll("input[name='ea-v2-gather-goal']:checked")).map(input => input.value);
      const actor = selectedActor();
      if (!actor) return ui.notifications.warn("Назначенный персонаж не найден или недоступен.");
      if (!goals.length) return ui.notifications.warn("Выберите хотя бы один тип трав.");
      this.gatherGoals = goals;
      this.gathering = true;
      this.gatherResult = "Ожидание проверки ведущего…";
      try {
        await this.render({ force: true });
        const result = await E.request({ type: "gather", actorId: actor.id, goals, requestId: foundry.utils.randomID() });
        this.gatherResult = result?.message || "Запрос не выполнен; подробности доступны в уведомлении.";
      } catch (error) {
        console.error(`${E.id} | Gather failed`, error);
        this.gatherResult = error?.message || "Не удалось выполнить сбор.";
        ui.notifications.error(this.gatherResult);
      } finally { this.gathering = false; await this.render({ force: true }); }
    };
    Base.DEFAULT_OPTIONS.actions["craft-brew"] = async function(event, target) {
      if (this._eaBrewPending) return;
      const actor = selectedActor();
      if (!actor) return ui.notifications.warn("Нет доступного персонажа для изготовления.");
      const recipeId = target?.dataset?.recipeId;
      if (!E.getState().recipes.some(recipe => recipe.id === recipeId)) return ui.notifications.error("Рецепт не найден.");
      this._eaBrewPending = true;
      if (target) target.disabled = true;
      try {
        await E.request({ type: "brew", actorId: actor.id, recipeId, ingredients: this.craftingIngredients || [], requestId: foundry.utils.randomID() });
        await this.render({ force: true });
      } catch (error) {
        console.error(`${E.id} | Crafting failed`, error);
        ui.notifications.error(error?.message || "Не удалось изготовить состав.");
      } finally { this._eaBrewPending = false; if (target) target.disabled = false; }
    };
    E.gather = () => {
      const app = E.openPlayerAppV2();
      if (app) { app.mode = "gather"; app.render({ force: true }); }
      return app;
    };
    E.compatible = (actorId, ingredients) => {
      const app = E.openPlayerAppV2();
      if (!app) return;
      try { localStorage.setItem(`${E.id}.appv2-selected-actor.${game.user?.id ?? "unknown"}`, actorId); } catch {}
      app.mode = "crafting";
      app.craftingIngredients = Array.isArray(ingredients) ? ingredients : [];
      app.craftingStage = "results";
      app.craftingPage = 0;
      app.render({ force: true });
      return app;
    };
  } else console.error(`${E.id} | Player actions unavailable; authoritative roll UI not installed.`);
  console.info(`${E.id} | GM-authoritative workflow registered.`);
})();