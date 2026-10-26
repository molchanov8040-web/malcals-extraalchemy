/* Socketlib transport and late-loaded workflow extensions for player-triggered GM actions. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  let socket = null;
  const completed = new Map();
  const LIMIT = 200;
  const remember = (key, value) => {
    completed.set(key, value);
    while (completed.size > LIMIT) completed.delete(completed.keys().next().value);
  };

  // Researching a fully identified herb is a normal game outcome, not a remote exception.
  const resolveResearch = E.resolveResearch;
  E.resolveResearch = async request => {
    const state = E.getState();
    const herb = E.herb(request?.ingredientId);
    const known = state.group.knownAspects[request?.ingredientId] || {};
    const unknown = Object.keys(herb?.aspects || {}).filter(aspect => !Object.hasOwn(known, aspect));
    if (herb && !unknown.length) return { research: false, message: `Все аспекты травы «${herb.name}» уже известны. Трава не потрачена.` };
    try { return await resolveResearch(request); }
    catch (error) {
      if (/Все аспекты этой травы уже известны/.test(error?.message || "")) return { research: false, message: "Все аспекты этой травы уже известны. Трава не потрачена." };
      throw error;
    }
  };

  // Socketlib 1.1.x supplies the invoking user's id as the handler `this.userId`.
  // Never authorize a request using a userId supplied by the calling client.
  const runAsGM = async (type, request, callerId) => {
    const user = callerId && game.users.get(callerId);
    if (!user || !request?.requestId) throw new Error("Не удалось подтвердить пользователя или запрос.");
    const key = `${callerId}:${request.requestId}`;
    const prior = completed.get(key);
    if (prior) return prior;
    const trustedRequest = { ...request, userId: callerId };
    let result;
    if (type === "gather") result = await E.resolveGather(trustedRequest);
    else if (type === "research") result = await E.resolveResearch(trustedRequest);
    else if (type === "brew") result = await E.resolveBrew(trustedRequest);
    else throw new Error("Неизвестная операция алхимии.");
    remember(key, result);
    return result;
  };

  const registerHandler = (name, type) => socket.register(name, function (request) {
    return runAsGM(type, request, this?.userId);
  });

  Hooks.once("socketlib.ready", () => {
    if (!game.modules.get("socketlib")?.active || !globalThis.socketlib) {
      console.error(`${E.id} | Socketlib is required but unavailable.`);
      return;
    }
    socket = globalThis.socketlib.registerModule(E.id);
    registerHandler("eaGather", "gather");
    registerHandler("eaResearch", "research");
    registerHandler("eaBrew", "brew");
    console.info(`${E.id} | Socketlib handlers registered.`);
  });

  const previousRequest = E.request;
  E.request = async request => {
    if (game.user.isGM) return previousRequest(request);
    if (!socket) {
      ui.notifications.error("Socketlib ещё не готов. Перезагрузите мир и повторите действие.");
      return;
    }
    const action = request?.type;
    if (!["gather", "research", "brew"].includes(action)) {
      ui.notifications.error("Эта операция пока не поддерживается через Socketlib.");
      return;
    }
    const packet = { ...request, requestId: foundry.utils.randomID() };
    try {
      const handler = action === "gather" ? "eaGather" : action === "research" ? "eaResearch" : "eaBrew";
      const result = await socket.executeAsGM(handler, packet);
      if (result?.research) E.popup("Исследование", `<p>Открыт аспект: <b>${E.esc(E.aspects[result.aspect] || result.aspect)}: ${result.value}</b>.</p>`, { ok: { label: "Понятно" } });
      else if (result?.message) ui.notifications.info(result.message);
      Hooks.callAll("eaStockChanged");
      return result;
    } catch (error) {
      console.error(`${E.id} | Socketlib ${action} failed`, error);
      ui.notifications.error(error?.message || "Не удалось выполнить запрос у ГМ.");
    }
  };

  const clientGoalsKey = `${E.id}.gather-types`;
  const savedGoals = () => {
    try { return JSON.parse(localStorage.getItem(clientGoalsKey) || "[]"); }
    catch { return []; }
  };
  const saveGoals = goals => localStorage.setItem(clientGoalsKey, JSON.stringify(goals));
  const toolHint = (bonus, name) => bonus > 0 ? `<p class="notes">Владение ${name}: +${bonus} к проверке.</p>` : `<p class="notes">Владение ${name} не обнаружено: бонус владения не добавляется.</p>`;

  // Replaces the old gather view so the survival/Wisdom roll includes herbalism-tool proficiency.
  E.gather = () => {
    const state = E.getState();
    const actors = E.actors(state).filter(actor => E.canActor(game.user, actor, state));
    if (!actors.length) return ui.notifications.warn("Мастер должен назначить вашего персонажа в настройках алхимии.");
    const remembered = savedGoals();
    const content = `<section class="ea-panel"><label>Персонаж<select id="ea-gather-actor">${actors.map(actor => `<option value="${actor.id}">${E.esc(actor.name)}</option>`).join("")}</select></label><p>Территория: <b>${E.esc(state.configuration.activeTerritory)}</b></p><div id="ea-herbalism-hint"></div>${E.goalChecks(remembered)}<p class="notes">СЛ сбора устанавливает только ГМ.</p></section>`;
    E.popup("Алхимия — сбор", content, {
      gather: { label: "Собрать", callback: async html => {
        const root = html?.[0] ?? html;
        const actor = game.actors.get(root.querySelector("#ea-gather-actor").value);
        if (!actor) return ui.notifications.error("Персонаж не найден.");
        const goals = E.selectedGoals(root);
        saveGoals(goals);
        const mod = Number(actor.system?.skills?.sur?.mod ?? actor.system?.abilities?.wis?.mod ?? 0);
        const tool = Number(E.herbalismBonus?.(actor) || 0);
        const roll = await new Roll("1d20 + @mod + @tool", { mod, tool }).evaluate();
        await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `Сбор трав: Выживание/Мудрость ${mod >= 0 ? "+" : ""}${mod}${tool ? `, инструменты травника +${tool}` : ""}` });
        await E.request({ type: "gather", actorId: actor.id, goals, total: roll.total });
      } },
      close: { label: "Закрыть" }
    }, html => {
      const root = html?.[0] ?? html;
      const updateHint = () => {
        const actor = game.actors.get(root.querySelector("#ea-gather-actor").value);
        root.querySelector("#ea-herbalism-hint").innerHTML = toolHint(Number(E.herbalismBonus?.(actor) || 0), "инструментами травника");
      };
      root.querySelector("#ea-gather-actor").onchange = updateHint;
      updateHint();
    });
  };

  // Replaces compatibility view so crafting rolls include alchemist-supplies proficiency.
  E.compatible = (actorId, list) => {
    const state = E.getState(), available = E.total(state, list);
    const recipes = state.recipes.filter(recipe => (game.user.isGM || recipe.playersKnow !== false) && E.matches(recipe, available));
    const actor = game.actors.get(actorId), tool = Number(E.alchemyBonus?.(actor) || 0);
    const content = `<section class="ea-panel"><p>Известные аспекты: ${E.esc(E.aspectText(available))}</p>${toolHint(tool, "алхимическим набором")}${recipes.length ? `<ul>${recipes.map(recipe => `<li><b>${E.esc(recipe.name)}</b> — ${E.esc(E.aspectText(recipe.requirements))}; СЛ ${recipe.brewDC} <button data-brew="${recipe.id}">Изготовить</button></li>`).join("")}</ul>` : "<p>Подходящих рецептов нет.</p>"}</section>`;
    E.popup("Возможные рецепты", content, { close: { label: "Закрыть" } }, root => {
      root.querySelectorAll("[data-brew]").forEach(button => button.onclick = async () => {
        const recipeActor = game.actors.get(actorId);
        if (!recipeActor) return ui.notifications.error("Алхимик не найден.");
        const mod = Number(recipeActor.system?.abilities?.int?.mod || 0);
        const proficiency = Number(E.alchemyBonus?.(recipeActor) || 0);
        const roll = await new Roll("1d20 + @mod + @tool", { mod, tool: proficiency }).evaluate();
        await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: recipeActor }), flavor: `Изготовление алхимического состава: Интеллект ${mod >= 0 ? "+" : ""}${mod}${proficiency ? `, алхимический набор +${proficiency}` : ""}` });
        await E.request({ type: "brew", actorId, recipeId: button.dataset.brew, ingredients: list, total: roll.total });
      });
    });
  };

  const requirementRows = (requirements = {}) => {
    const entries = Object.entries(requirements);
    return (entries.length ? entries : [["Vita", 1]]).map(([aspect, quantity]) => `<div class="ea-requirement"><select class="ea-ra">${E.aspectOptions(aspect)}</select><input class="ea-rq" type="number" min="1" value="${Math.max(1, Number(quantity) || 1)}"><button type="button" class="ea-delrow">Удалить строку</button></div>`).join("");
  };
  const bindRequirementRows = root => {
    const remove = row => row.remove();
    root.querySelectorAll(".ea-delrow").forEach(button => button.onclick = () => remove(button.closest(".ea-requirement")));
    root.querySelector("#ea-addrow").onclick = () => {
      const row = document.createElement("div");
      row.className = "ea-requirement";
      row.innerHTML = `<select class="ea-ra">${E.aspectOptions("")}</select><input class="ea-rq" type="number" min="1" value="1"><button type="button" class="ea-delrow">Удалить строку</button>`;
      root.querySelector("#ea-reqs").append(row);
      row.querySelector(".ea-delrow").onclick = () => remove(row);
    };
  };
  const readRecipe = (root, previous = {}) => {
    const requirements = {};
    root.querySelectorAll(".ea-requirement").forEach(row => {
      const aspect = row.querySelector(".ea-ra").value;
      const quantity = Math.max(1, Math.floor(Number(row.querySelector(".ea-rq").value) || 1));
      if (aspect) requirements[aspect] = (requirements[aspect] || 0) + quantity;
    });
    if (!Object.keys(requirements).length) throw new Error("Добавьте хотя бы один аспект.");
    const name = root.querySelector("#ea-rname").value.trim();
    if (!name) throw new Error("Укажите название рецепта.");
    return E.normalizeRecipe({ ...previous, name, requirements, brewDC: Math.max(1, Number(root.querySelector("#ea-rdc").value) || 10), description: root.querySelector("#ea-rdesc").value.trim(), playersKnow: root.querySelector("#ea-rknown").checked, output: { ...(previous.output || {}), itemName: root.querySelector("#ea-rout").value.trim() || name, quantity: previous.output?.quantity || 1, criticalQuantity: previous.output?.criticalQuantity || 2 } });
  };

  E.editRecipe = recipeId => {
    if (!game.user.isGM) return;
    const state = E.getState(), previous = recipeId ? state.recipes.find(recipe => recipe.id === recipeId) : null;
    const recipe = previous || E.normalizeRecipe({ id: foundry.utils.randomID(), name: "", requirements: { Vita: 1 }, brewDC: 10, playersKnow: true, description: "", output: { itemName: "", quantity: 1, criticalQuantity: 2 } });
    const content = `<section class="ea-panel"><label>Название<input id="ea-rname" value="${E.esc(recipe.name)}"></label><div id="ea-reqs">${requirementRows(recipe.requirements)}</div><button type="button" id="ea-addrow">Добавить аспект</button><label>СЛ изготовления<input id="ea-rdc" type="number" min="1" value="${recipe.brewDC}"></label><label>Описание<textarea id="ea-rdesc">${E.esc(recipe.description || "")}</textarea></label><label>Название готового предмета<input id="ea-rout" value="${E.esc(recipe.output?.itemName || recipe.name)}"></label><label><input id="ea-rknown" type="checkbox"${recipe.playersKnow !== false ? " checked" : ""}> Известен игрокам</label></section>`;
    E.popup(previous ? `Редактирование: ${recipe.name}` : "Новый рецепт", content, {
      save: { label: "Сохранить", callback: async html => {
        try {
          const root = html?.[0] ?? html, next = readRecipe(root, recipe), updated = E.getState();
          const index = updated.recipes.findIndex(item => item.id === next.id);
          if (index >= 0) updated.recipes[index] = next;
          else updated.recipes.push(next);
          await E.commit(updated);
          ui.notifications.info("Рецепт сохранён.");
          E.recipes();
        } catch (error) { ui.notifications.warn(error.message || String(error)); return false; }
      } }, close: { label: "Отмена" }
    }, bindRequirementRows);
  };

  E.recipes = () => {
    if (!game.user.isGM) return;
    const state = E.getState();
    const rows = state.recipes.map(recipe => `<li><b>${E.esc(recipe.name)}</b> — ${E.esc(E.aspectText(recipe.requirements))}; СЛ ${recipe.brewDC}<label><input class="ea-known" data-id="${recipe.id}" type="checkbox"${recipe.playersKnow !== false ? " checked" : ""}> Известен игрокам</label><button class="ea-edit" data-id="${recipe.id}">Редактировать</button><button class="ea-delete" data-id="${recipe.id}">Удалить</button></li>`).join("") || "<li>Нет рецептов.</li>";
    E.popup("Алхимия — рецепты", `<section class="ea-panel"><h3>Рецепты</h3><ul>${rows}</ul></section>`, { add: { label: "Добавить рецепт", callback: () => E.editRecipe() }, close: { label: "Закрыть" } }, root => {
      root.querySelectorAll(".ea-known").forEach(input => input.onchange = async () => {
        const next = E.getState(), recipe = next.recipes.find(item => item.id === input.dataset.id);
        if (recipe) { recipe.playersKnow = input.checked; await E.commit(next); }
      });
      root.querySelectorAll(".ea-edit").forEach(button => button.onclick = () => E.editRecipe(button.dataset.id));
      root.querySelectorAll(".ea-delete").forEach(button => button.onclick = async () => {
        const next = E.getState(); next.recipes = next.recipes.filter(item => item.id !== button.dataset.id);
        await E.commit(next); root.closest(".app")?.remove(); E.recipes();
      });
    });
  };
})();
