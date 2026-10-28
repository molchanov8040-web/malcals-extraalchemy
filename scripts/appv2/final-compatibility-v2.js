/* Final runtime hardening for the Foundry 13/14 test build. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  // Serialize state writes made by this client. This prevents two local UI
  // actions from overwriting one another; server-side validation remains the
  // authority for player requests.
  if (typeof E.commit === "function" && !E.commit._eaSerialized) {
    const commit = E.commit;
    let queue = Promise.resolve();
    const serialized = current => {
      const snapshot = E.clone?.(current) ?? current;
      const task = queue.then(() => commit(snapshot));
      queue = task.catch(() => {});
      return task;
    };
    serialized._eaSerialized = true;
    E.commit = serialized;
  }

  const Base = E.PlayerApplicationV2;
  const actions = Base?.DEFAULT_OPTIONS?.actions;
  if (!actions) {
    console.error(`${E.id} | Final ApplicationV2 actions could not be installed.`);
    return;
  }

  const notify = (level, message) => {
    const fn = globalThis.ui?.notifications?.[level];
    if (typeof fn === "function") fn.call(globalThis.ui.notifications, message);
  };
  const selectedActor = () => {
    const state = E.getState?.();
    const ids = state?.configuration?.actorIds || [];
    let selected = "";
    try { selected = localStorage.getItem(`${E.id}.appv2-selected-actor.${game.user?.id ?? "unknown"}`) || ""; } catch {}
    const actors = ids.map(id => game.actors?.get(id)).filter(actor => actor && (game.user?.isGM || actor.testUserPermission?.(game.user, "OWNER")));
    return actors.find(actor => actor.id === selected) || actors[0] || null;
  };
  const requestId = () => globalThis.foundry?.utils?.randomID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Keep the ApplicationV2 path free of client-side rolls. The active GM
  // resolver performs the only roll and validates the complete request.
  actions["gather-start"] = async function() {
    if (this.gathering) return;
    const root = this.element;
    const actor = selectedActor();
    const goals = Array.from(root?.querySelectorAll?.("input[name='ea-v2-gather-goal']:checked") || []).map(input => input.value);
    if (!actor) return notify("warn", "Назначенный персонаж не найден или недоступен.");
    if (!goals.length) return notify("warn", "Выберите хотя бы один тип трав.");
    this.gatherGoals = goals;
    this.gathering = true;
    this.gatherResult = "Ожидание проверки ведущего…";
    try {
      await this.render({ force: true });
      const result = await E.request({ type: "gather", actorId: actor.id, goals, requestId: requestId() });
      this.gatherResult = result?.message || "Запрос обработан ведущим.";
    } catch (error) {
      console.error(`${E.id} | Final gather action failed`, error);
      this.gatherResult = error?.message || "Не удалось выполнить сбор.";
      notify("error", this.gatherResult);
    } finally {
      this.gathering = false;
      await this.render({ force: true });
    }
  };

  actions["craft-brew"] = async function(event, target) {
    if (this._eaBrewPending) return;
    const actor = selectedActor();
    const recipeId = target?.dataset?.recipeId;
    if (!actor) return notify("warn", "Нет доступного персонажа для изготовления.");
    if (!recipeId) return notify("error", "Рецепт не выбран.");
    this._eaBrewPending = true;
    if (target) target.disabled = true;
    try {
      const result = await E.request({
        type: "brew",
        actorId: actor.id,
        recipeId,
        ingredients: Array.isArray(this.craftingIngredients) ? this.craftingIngredients : [],
        requestId: requestId()
      });
      if (result?.message) notify("info", result.message);
      await this.render({ force: true });
    } catch (error) {
      console.error(`${E.id} | Final crafting action failed`, error);
      notify("error", error?.message || "Не удалось изготовить состав.");
    } finally {
      this._eaBrewPending = false;
      if (target) target.disabled = false;
    }
  };

  console.info(`${E.id} | Final cross-version runtime hardening registered.`);
})();
