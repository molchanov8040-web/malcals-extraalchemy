/* Final ApplicationV2 hardening for the Foundry 13/14 test build. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  const notify = (level, message) => {
    const fn = globalThis.ui?.notifications?.[level];
    if (typeof fn === "function") fn.call(globalThis.ui.notifications, message);
  };
  const selectedActor = () => {
    const state = E.getState?.();
    const actors = (state?.configuration?.actorIds || [])
      .map(id => game.actors?.get(id))
      .filter(actor => actor && (game.user?.isGM || actor.testUserPermission?.(game.user, "OWNER")));
    let selected = "";
    try { selected = localStorage.getItem(`${E.id}.appv2-selected-actor.${game.user?.id ?? "unknown"}`) || ""; } catch {}
    return actors.find(actor => actor.id === selected) || actors[0] || null;
  };
  const selectedGoals = root => Array.from(root?.querySelectorAll?.("input[name='ea-v2-gather-goal']:checked") || []).map(input => input.value);

  const Base = E.PlayerApplicationV2;
  if (Base?.DEFAULT_OPTIONS?.actions) {
    const actions = Base.DEFAULT_OPTIONS.actions;
    actions["gather-start"] = async function() {
      if (this.gathering) return;
      const actor = selectedActor();
      const goals = selectedGoals(this.element);
      if (!actor) return notify("warn", "Назначенный персонаж не найден или недоступен.");
      if (!goals.length) return notify("warn", "Выберите хотя бы один тип трав.");
      this.gatherGoals = goals;
      this.gathering = true;
      this.gatherResult = "Ожидание проверки ведущего…";
      try {
        await this.render({ force: true });
        const result = await E.request({ type: "gather", actorId: actor.id, goals });
        this.gatherResult = result?.message || "Запрос обработан ведущим.";
      } catch (error) {
        console.error(`${E.id} | Hardened gather failed`, error);
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
        await E.request({
          type: "brew",
          actorId: actor.id,
          recipeId,
          ingredients: Array.isArray(this.craftingIngredients) ? this.craftingIngredients : []
        });
        Hooks.callAll("eaStockChanged");
        await this.render({ force: true });
      } catch (error) {
        console.error(`${E.id} | Hardened crafting failed`, error);
        notify("error", error?.message || "Не удалось изготовить состав.");
      } finally {
        this._eaBrewPending = false;
        if (target) target.disabled = false;
      }
    };
  } else {
    console.error(`${E.id} | ApplicationV2 actions unavailable during hardening.`);
  }

  Hooks.once("ready", () => {
    const foundryMajor = Number.parseInt(String(game.version || "").split(".")[0], 10);
    const dndMajor = Number.parseInt(String(game.system?.version || "").split(".")[0], 10);
    const socketActive = !!game.modules?.get("socketlib")?.active;
    if (![13, 14].includes(foundryMajor)) console.warn(`${E.id} | Unsupported Foundry major version: ${game.version}`);
    if (![5, 6].includes(dndMajor)) console.warn(`${E.id} | Unsupported dnd5e major version: ${game.system?.version}`);
    if (!socketActive) console.error(`${E.id} | Socketlib is not active; player requests cannot be routed to the GM.`);
    console.info(`${E.id} | ApplicationV2 actions hardened: GM-authoritative rolls only.`);
  });
})();
