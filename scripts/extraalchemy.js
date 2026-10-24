/* Malcal's ExtraAlchemy — Foundry VTT 13.351 */
const EA = { id: "malcals-extraalchemy", version: "0.1.6" };
globalThis.EA = EA;

EA.esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
}[char]));
EA.state = () => game.settings.get(EA.id, "state");
EA.save = state => game.settings.set(EA.id, "state", state);
EA.actors = () => EA.state().actors.map(id => game.actors.get(id)).filter(Boolean);
EA.actor = (root, fallback) => game.actors.get(root.querySelector("#ea-actor")?.value) ?? fallback ?? game.user.character ?? EA.actors()[0] ?? null;
EA.selectActor = selected => `<label>Персонаж<select id="ea-actor">${EA.actors().map(actor => `<option value="${actor.id}"${actor.id === selected?.id ? " selected" : ""}>${EA.esc(actor.name)}</option>`).join("")}</select></label>`;

class Launcher extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, { id: "ea-launcher", title: "Инструменты алхимии", width: 380, height: "auto", closeOnSubmit: false });
  }
  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0] ?? html;
    root.innerHTML = `<section class="ea-panel"><p>Открыть панель алхимии:</p><div class="ea-actions"><button type="button" data-ea="config">Настройка</button><button type="button" data-ea="gather">Сбор</button><button type="button" data-ea="experiments">Эксперименты</button><button type="button" data-ea="recipes">Рецепты</button></div></section>`;
    root.querySelectorAll("[data-ea]").forEach(button => button.addEventListener("click", () => EA.open(button.dataset.ea)));
  }
  async _updateObject() {}
}

Hooks.once("init", () => {
  game.settings.register(EA.id, "state", {
    scope: "world", config: false, type: Object,
    default: {
      actors: [], territory: "Лес", goal: "", history: [], recipes: [
        { id: "minor-healing", name: "Малое лечебное зелье", need: { Vita: 2, Herba: 1 }, dc: 10, formula: "2d4 + 2" },
        { id: "antidote", name: "Простое противоядие", need: { Herba: 1, Aqua: 1 }, dc: 10, formula: "Преимущество против яда на 1 час" }
      ]
    }
  });
  game.settings.registerMenu(EA.id, "launcher", {
    name: "Инструменты алхимии", label: "Открыть панели", hint: "Открыть настройку, сбор, эксперименты и рецепты.",
    icon: "fas fa-flask", type: Launcher, restricted: false
  });
});

/* V13.351 passes scene controls as a record, for example controls.tokens.tools. */
Hooks.on("getSceneControlButtons", controls => {
  const control = controls.tokens ?? controls.token ?? Object.values(controls).find(entry => entry?.name === "token");
  if (!control) return;
  const tool = {
    name: "malcals-extraalchemy-tools", title: "Инструменты алхимии", icon: "fa-solid fa-flask",
    order: 999, button: true, visible: true, onChange: () => EA.hub()
  };
  if (Array.isArray(control.tools)) {
    if (!control.tools.some(entry => entry.name === tool.name)) control.tools.push(tool);
  } else {
    control.tools ??= {};
    control.tools[tool.name] ??= tool;
  }
});
Hooks.once("ready", () => console.info(`${EA.id} | ready; flask added to Token scene controls.`));

EA.hub = fallback => {
  const content = `<section class="ea-panel"><p>Алхимические инструменты кампании</p><div class="ea-actions"><button data-open="config">Настройка</button><button data-open="gather">Сбор</button><button data-open="experiments">Эксперименты</button><button data-open="recipes">Рецепты</button></div></section>`;
  new Dialog({ title: "Инструменты алхимии", content, buttons: { close: { label: "Закрыть" } }, render: html => {
    const root = html[0] ?? html;
    root.querySelectorAll("[data-open]").forEach(button => button.addEventListener("click", () => EA.open(button.dataset.open, fallback)));
  }}).render(true);
};
EA.open = (name, fallback) => ({ config: EA.config, gather: EA.gather, experiments: EA.experiments, recipes: EA.recipes }[name]?.(fallback));

EA.config = () => {
  if (!game.user.isGM) return ui.notifications.warn("Настройка доступна только мастеру.");
  const state = EA.state();
  const options = Array.from(game.actors).filter(actor => actor.type === "character").map(actor => `<option value="${actor.id}"${state.actors.includes(actor.id) ? " selected" : ""}>${EA.esc(actor.name)}</option>`).join("");
  const content = `<section class="ea-panel"><label>Персонажи игроков<select id="ea-actors" multiple size="7">${options}</select></label><label>Территория<input id="ea-territory" value="${EA.esc(state.territory)}"></label><label>Цель сбора<input id="ea-goal" value="${EA.esc(state.goal)}" placeholder="лечебные травы, ядовитые грибы"></label></section>`;
  new Dialog({ title: "Алхимия — настройка", content, buttons: {
    save: { label: "Сохранить", callback: async html => {
      const root = html[0] ?? html;
      state.actors = Array.from(root.querySelector("#ea-actors").selectedOptions).map(option => option.value);
      state.territory = root.querySelector("#ea-territory").value.trim() || "Не задана";
      state.goal = root.querySelector("#ea-goal").value.trim();
      await EA.save(state); ui.notifications.info("Настройки сохранены.");
    }}, cancel: { label: "Отмена" }
  }}).render(true);
};

EA.gather = fallback => {
  const state = EA.state();
  const actor = fallback ?? game.user.character;
  if (!game.user.isGM && (!actor || !state.actors.includes(actor.id))) return ui.notifications.warn("Мастер не добавил вашего персонажа в настройки алхимии.");
  const content = `<section class="ea-panel">${EA.selectActor(actor)}<label>Территория<input id="ea-area" value="${EA.esc(state.territory)}"${game.user.isGM ? "" : " readonly"}></label><label>Ищем<input id="ea-goal" value="${EA.esc(state.goal)}"></label><label>СЛ поиска<input id="ea-dc" type="number" value="10" min="1"></label><div class="ea-actions"><button data-action="collect">Собрать (1 час)</button><button data-action="stock">Склад</button><button data-action="history">История</button></div></section>`;
  new Dialog({ title: "Алхимия — сбор", content, buttons: { close: { label: "Закрыть" } }, render: html => {
    const root = html[0] ?? html;
    root.querySelector("[data-action='collect']").onclick = () => EA.collect(root, fallback);
    root.querySelector("[data-action='stock']").onclick = () => EA.stock(EA.actor(root, fallback));
    root.querySelector("[data-action='history']").onclick = () => EA.history();
  }}).render(true);
};

EA.collect = async (root, fallback) => {
  const actor = EA.actor(root, fallback);
  if (!actor) return ui.notifications.warn("Не выбран персонаж.");
  const area = root.querySelector("#ea-area").value.trim() || "Неизвестная местность";
  const goal = root.querySelector("#ea-goal").value.trim() || "алхимическое сырьё";
  const dc = Number(root.querySelector("#ea-dc").value) || 10;
  let total;
  if (actor.rollSkill && actor.system.skills?.sur) total = (await actor.rollSkill("sur", { chatMessage: true })).total;
  else { const roll = await (new Roll("1d20 + @abilities.wis.mod", actor.getRollData())).evaluate(); await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Поиск алхимического сырья" }); total = roll.total; }
  const state = EA.state();
  state.history.unshift({ date: new Date().toLocaleString(), actor: actor.name, area, goal, result: total >= dc ? `Успех (${total}/${dc})` : `Провал (${total}/${dc})` });
  await EA.save(state);
  if (total < dc) return ui.notifications.info(`Сбор не удался: ${total} против СЛ ${dc}.`);
  if (!game.user.isGM) { await ChatMessage.create({ content: `<p><b>${EA.esc(actor.name)}</b> успешно ищет «${EA.esc(goal)}» в местности «${EA.esc(area)}». Мастер определяет находку.</p>`, whisper: ChatMessage.getWhisperRecipients("GM") }); return ui.notifications.info("Успех отправлен мастеру."); }
  EA.find(actor);
};

EA.find = actor => new Dialog({ title: "Добавить находку", content: `<section class="ea-panel"><label>Название<input id="ea-name" value="Трава"></label><label>Меры<input id="ea-qty" type="number" value="1" min="1"></label><label>Аспекты JSON<input id="ea-aspects" value="{}" placeholder='{"Vita":1}'></label></section>`, buttons: {
  add: { label: "Добавить", callback: async html => { const root = html[0] ?? html; let aspects; try { aspects = JSON.parse(root.querySelector("#ea-aspects").value || "{}"); } catch { return ui.notifications.error("Аспекты должны быть JSON."); } await EA.addIngredient(actor, root.querySelector("#ea-name").value.trim() || "Трава", Math.max(1, Number(root.querySelector("#ea-qty").value) || 1), aspects); ui.notifications.info("Находка добавлена на склад."); } }, cancel: { label: "Отмена" }
}}).render(true);
EA.addIngredient = async (actor, name, qty, aspects) => {
  const item = actor.items.find(entry => entry.getFlag(EA.id, "kind") === "ingredient" && entry.name === name);
  if (item) { const merged = foundry.utils.deepClone(item.getFlag(EA.id, "aspects") ?? {}); for (const [key, value] of Object.entries(aspects)) merged[key] = (Number(merged[key]) || 0) + (Number(value) || 0); return item.update({ "system.quantity": (Number(item.system.quantity) || 1) + qty, [`flags.${EA.id}.aspects`]: merged }); }
  return actor.createEmbeddedDocuments("Item", [{ name, type: "loot", img: "icons/consumables/herbs/herb-leaf-green.webp", system: { quantity: qty, weight: 0.1, price: { value: 0, denomination: "gp" }, description: { value: "Алхимический ингредиент." } }, flags: { [EA.id]: { kind: "ingredient", aspects } } }]);
};
EA.stock = actor => { if (!actor) return ui.notifications.warn("Выберите персонажа."); const rows = actor.items.filter(item => item.getFlag(EA.id, "kind") === "ingredient").map(item => `<li><b>${EA.esc(item.name)}</b> × ${item.system.quantity || 1} — ${EA.esc(JSON.stringify(item.getFlag(EA.id, "aspects") ?? {}))}</li>`).join("") || "<li>Склад пуст.</li>"; new Dialog({ title: `Склад: ${EA.esc(actor.name)}`, content: `<ul>${rows}</ul>`, buttons: { close: { label: "Закрыть" } } }).render(true); };
EA.history = () => { const rows = EA.state().history.map(entry => `<tr><td>${EA.esc(entry.date)}</td><td>${EA.esc(entry.actor)}</td><td>${EA.esc(entry.area)}</td><td>${EA.esc(entry.goal)}</td><td>${EA.esc(entry.result)}</td></tr>`).join("") || `<tr><td colspan="5">Записей пока нет.</td></tr>`; new Dialog({ title: "История сбора", content: `<table class="ea-table"><thead><tr><th>Дата</th><th>Персонаж</th><th>Местность</th><th>Цель</th><th>Результат</th></tr></thead><tbody>${rows}</tbody></table>`, buttons: { close: { label: "Закрыть" } } }).render(true); };

EA.experiments = fallback => { const content = `<section class="ea-panel">${EA.selectActor(fallback)}<p>Выберите ингредиент, чтобы увидеть известные свойства.</p><label>Ингредиент<select id="ea-item"></select></label><label>Гипотеза<input id="ea-hypothesis" placeholder="лечение, сон, яд"></label><button type="button" id="ea-test">Провести эксперимент</button></section>`; new Dialog({ title: "Алхимия — эксперименты", content, buttons: { close: { label: "Закрыть" } }, render: html => { const root = html[0] ?? html; const fill = () => { const actor = EA.actor(root, fallback); root.querySelector("#ea-item").innerHTML = (actor?.items.filter(item => item.getFlag(EA.id, "kind") === "ingredient") ?? []).map(item => `<option value="${item.id}">${EA.esc(item.name)} × ${item.system.quantity || 1}</option>`).join(""); }; fill(); root.querySelector("#ea-actor")?.addEventListener("change", fill); root.querySelector("#ea-test").onclick = () => { const actor = EA.actor(root, fallback), item = actor?.items.get(root.querySelector("#ea-item").value); if (!item) return ui.notifications.warn("Выберите ингредиент."); new Dialog({ title: "Результат эксперимента", content: `<p><b>${EA.esc(item.name)}</b></p><p>Гипотеза: ${EA.esc(root.querySelector("#ea-hypothesis").value || "не указана")}</p><p>Известные аспекты: ${EA.esc(JSON.stringify(item.getFlag(EA.id, "aspects") ?? {}))}</p>`, buttons: { ok: { label: "Понятно" } } }).render(true); }; } }).render(true); };
EA.recipes = () => { const state = EA.state(); const rows = state.recipes.map(recipe => `<li><b>${EA.esc(recipe.name)}</b> — ${EA.esc(JSON.stringify(recipe.need))}; СЛ ${recipe.dc}; ${EA.esc(recipe.formula)}</li>`).join("") || "<li>Рецептов пока нет.</li>"; const editor = game.user.isGM ? `<hr><h3>Добавить рецепт</h3><label>Название<input id="ea-rname"></label><label>Аспекты JSON<input id="ea-rneed" value='{"Vita":2,"Herba":1}'></label><label>СЛ<input id="ea-rdc" type="number" value="10"></label><label>Эффект<input id="ea-rformula" value="2d4 + 2"></label><button type="button" id="ea-add">Добавить рецепт</button>` : ""; new Dialog({ title: "Алхимия — рецепты", content: `<section class="ea-panel"><h3>Известные рецепты</h3><ul id="ea-recipes">${rows}</ul>${editor}</section>`, buttons: { close: { label: "Закрыть" } }, render: html => { const root = html[0] ?? html, button = root.querySelector("#ea-add"); if (!button) return; button.onclick = async () => { let need; try { need = JSON.parse(root.querySelector("#ea-rneed").value); } catch { return ui.notifications.error("Аспекты должны быть JSON."); } const recipe = { id: foundry.utils.randomID(), name: root.querySelector("#ea-rname").value.trim() || "Новый рецепт", need, dc: Math.max(1, Number(root.querySelector("#ea-rdc").value) || 10), formula: root.querySelector("#ea-rformula").value.trim() }; state.recipes.push(recipe); await EA.save(state); root.querySelector("#ea-recipes").insertAdjacentHTML("beforeend", `<li><b>${EA.esc(recipe.name)}</b> — ${EA.esc(JSON.stringify(recipe.need))}; СЛ ${recipe.dc}; ${EA.esc(recipe.formula)}</li>`); ui.notifications.info("Рецепт добавлен."); }; } }).render(true); };