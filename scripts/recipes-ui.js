/* Recipe visibility controls for ExtraAlchemy */
EA.recipeRow = recipe => {
  const visibility = game.user.isGM
    ? `<label class="ea-check ea-recipe-known"><input class="ea-known-toggle" data-id="${recipe.id}" type="checkbox"${recipe.playersKnow !== false ? " checked" : ""}> Известен игрокам</label>`
    : "";
  const remove = game.user.isGM ? ` <button class="ea-delete" data-id="${recipe.id}" type="button" title="Удалить рецепт"><i class="fas fa-trash"></i></button>` : "";
  return `<li data-recipe="${recipe.id}"><b>${EA.esc(recipe.name)}</b> — ${EA.esc(JSON.stringify(recipe.need))}; СЛ ${recipe.dc}; ${EA.esc(recipe.formula)}${visibility}${remove}</li>`;
};

EA.recipes = () => {
  const state = EA.state();
  const recipes = state.recipes.filter(recipe => game.user.isGM || recipe.playersKnow !== false);
  const editor = game.user.isGM ? `<hr><h3>Добавить рецепт</h3><label>Название<input id="ea-rname"></label><label>Аспекты JSON<input id="ea-rneed" value='{"Vita":2,"Herba":1}'></label><label>СЛ<input id="ea-rdc" type="number" value="10"></label><label>Эффект<input id="ea-rformula" value="2d4 + 2"></label><label class="ea-check"><input id="ea-rknown" type="checkbox" checked>Рецепт известен игрокам</label><button id="ea-add" type="button">Добавить рецепт</button>` : "";
  new Dialog({
    title: "Алхимия — рецепты",
    content: `<section class="ea-panel"><h3>Известные рецепты</h3><ul id="ea-recipes">${recipes.map(EA.recipeRow).join("") || "<li>Рецептов пока нет.</li>"}</ul>${editor}</section>`,
    buttons: { close: { label: "Закрыть" } },
    render: html => {
      const root = html[0] ?? html;
      const bindRow = row => {
        row.querySelector(".ea-known-toggle")?.addEventListener("change", async event => {
          const current = EA.state();
          const recipe = current.recipes.find(entry => entry.id === event.currentTarget.dataset.id);
          if (!recipe) return;
          recipe.playersKnow = event.currentTarget.checked;
          await EA.save(current);
          ui.notifications.info(recipe.playersKnow ? "Рецепт доступен игрокам." : "Рецепт скрыт от игроков.");
        });
        row.querySelector(".ea-delete")?.addEventListener("click", async event => {
          const id = event.currentTarget.dataset.id;
          const current = EA.state();
          const recipe = current.recipes.find(entry => entry.id === id);
          if (!recipe || !await Dialog.confirm({ title: "Удалить рецепт", content: `<p>Удалить рецепт «${EA.esc(recipe.name)}»?</p>` })) return;
          current.recipes = current.recipes.filter(entry => entry.id !== id);
          await EA.save(current);
          root.querySelector(`[data-recipe='${id}']`)?.remove();
          ui.notifications.info("Рецепт удалён.");
        });
      };
      root.querySelectorAll("[data-recipe]").forEach(bindRow);
      root.querySelector("#ea-add")?.addEventListener("click", async () => {
        let need;
        try { need = JSON.parse(root.querySelector("#ea-rneed").value); }
        catch { return ui.notifications.error("Аспекты должны быть JSON."); }
        const current = EA.state();
        const recipe = { id: foundry.utils.randomID(), name: root.querySelector("#ea-rname").value.trim() || "Новый рецепт", need, dc: Math.max(1, Number(root.querySelector("#ea-rdc").value) || 10), formula: root.querySelector("#ea-rformula").value.trim(), playersKnow: root.querySelector("#ea-rknown").checked };
        current.recipes.push(recipe);
        await EA.save(current);
        const list = root.querySelector("#ea-recipes");
        if (list.querySelector("li")?.textContent === "Рецептов пока нет.") list.innerHTML = "";
        list.insertAdjacentHTML("beforeend", EA.recipeRow(recipe));
        bindRow(list.querySelector(`[data-recipe='${recipe.id}']`));
        ui.notifications.info("Рецепт добавлен.");
      });
    }
  }).render(true);
};
