/* GM recipe editor with explicit output Item UUID and visual aspect requirements. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;
  const esc = value => EA.esc(value);
  const getState = () => EA.getState?.() || EA.state?.();
  const saveState = state => (EA.saveState || EA.commit || EA.save)?.(state);
  const outputOf = recipe => recipe.output || (recipe.output = {});
  const itemFromUuid = async uuid => {
    if (!uuid) return null;
    if (typeof fromUuid === "function") return fromUuid(uuid);
    if (globalThis.foundry?.utils?.fromUuid) return foundry.utils.fromUuid(uuid);
    throw new Error("UUID-загрузка недоступна в этой версии Foundry.");
  };
  const requirementRows = requirements => Object.entries(EA.aspects || {}).map(([key, name]) => {
    const value = Number(requirements?.[key]);
    const amount = Number.isFinite(value) && value > 0 ? value : "";
    return `<label class="ea-recipe-aspect-row"><span class="ea-recipe-aspect-name">${esc(name)} <small>(${esc(key)})</small></span><input type="number" min="0" step="any" inputmode="decimal" data-requirement-aspect="${esc(key)}" value="${esc(amount)}" placeholder="0" aria-label="Требуемое значение аспекта: ${esc(name)}"></label>`;
  }).join("");
  const readRequirements = form => {
    const requirements = {};
    form.querySelectorAll("[data-requirement-aspect]").forEach(input => {
      const value = Number(input.value);
      if (Number.isFinite(value) && value > 0) requirements[input.dataset.requirementAspect] = value;
    });
    return requirements;
  };
  const updateRequirementSummary = form => {
    const count = Object.keys(readRequirements(form)).length;
    const summary = form.querySelector("[data-requirement-summary]");
    if (summary) summary.textContent = count ? `Выбрано аспектов: ${count}` : "Аспекты не заданы — рецепт не будет найден по составу.";
  };
  const formContent = recipe => {
    const output = recipe?.output || {};
    return `<form class="ea-recipe-editor" autocomplete="off">
      <div class="form-group"><label>Название рецепта</label><input name="name" type="text" value="${esc(recipe?.name || "")}" required></div>
      <div class="form-group"><label>UUID готового предмета</label><div style="display:flex;gap:.4rem"><input name="outputUuid" type="text" value="${esc(output.uuid || "")}" placeholder="Compendium.pack-name.Item.id" style="flex:1"><button type="button" data-load-output>Загрузить</button></div><p class="hint">Вставьте UUID предмета из мира или компендиума. Название и изображение результата будут автоматически привязаны к предмету.</p></div>
      <div class="form-group"><label>Название готового предмета</label><input name="outputName" type="text" value="${esc(output.itemName || "")}" readonly></div>
      <div class="form-group"><label>Изображение результата</label><div style="display:flex;align-items:center;gap:.6rem"><img data-output-preview src="${esc(output.img || "icons/svg/potion.svg")}" alt="" style="width:48px;height:48px;object-fit:contain"><input name="outputImg" type="text" value="${esc(output.img || "")}" readonly style="flex:1"></div></div>
      <fieldset class="ea-recipe-aspects"><legend>Необходимые аспекты</legend><p class="hint">Укажите минимальное значение каждого аспекта. JSON вручную вводить не требуется: пустое поле означает, что аспект не нужен.</p><div class="ea-recipe-aspect-grid">${requirementRows(recipe?.requirements || {})}</div><div style="display:flex;align-items:center;gap:.6rem;margin-top:.5rem"><button type="button" data-clear-requirements>Очистить аспекты</button><span class="hint" data-requirement-summary></span></div></fieldset>
      <div class="form-group"><label>Сложность изготовления</label><input name="brewDC" type="number" min="1" step="1" value="${Math.max(1, Number(recipe?.brewDC) || 10)}"></div>
      <div class="form-group"><label>Описание / формула</label><textarea name="description" rows="3">${esc(recipe?.description || "")}</textarea></div>
      <label><input name="playersKnow" type="checkbox"${recipe?.playersKnow !== false ? " checked" : ""}> Рецепт известен игрокам</label>
      <p class="hint" data-output-status></p>
    </form>`;
  };
  const editRecipe = async recipeId => {
    if (!game.user?.isGM) return ui.notifications.warn("Редактировать рецепты может только ведущий.");
    const existing = recipeId ? getState()?.recipes?.find(r => r.id === recipeId) : null;
    const draft = EA.clone(existing || { id: foundry.utils.randomID(), name: "", requirements: {}, brewDC: 10, playersKnow: true, description: "", output: { kind: "item", quantity: 1, criticalQuantity: 1, uuid: null, itemName: "", img: "" } });
    const dialog = new Dialog({
      title: existing ? "Редактировать рецепт" : "Добавить рецепт",
      content: formContent(draft),
      buttons: {
        save: { label: "Сохранить", callback: async html => {
          const root = html[0] || html;
          const form = root.querySelector("form");
          const values = new FormData(form);
          const requirements = readRequirements(form);
          const uuid = String(values.get("outputUuid") || "").trim() || null;
          let output = { ...draft.output };
          if (uuid) {
            if (uuid !== output.uuid || !output.itemName || !output.img) {
              try {
                const item = await itemFromUuid(uuid);
                if (!item || (item.documentName && item.documentName !== "Item")) throw new Error("UUID должен указывать на документ Item.");
                output = { ...output, uuid, itemName: item.name, img: item.img || "icons/svg/item.svg", kind: "item" };
              } catch (error) { ui.notifications.error(`Не удалось загрузить предмет по UUID: ${error.message}`); return; }
            }
          } else {
            output.uuid = null;
            output.itemName = String(values.get("outputName") || "").trim();
            output.img = String(values.get("outputImg") || "").trim();
          }
          const recipe = {
            ...draft,
            id: draft.id || foundry.utils.randomID(),
            name: String(values.get("name") || "").trim() || output.itemName || "Новый рецепт",
            requirements,
            brewDC: Math.max(1, Number(values.get("brewDC")) || 10),
            description: String(values.get("description") || "").trim(),
            playersKnow: form.querySelector('[name="playersKnow"]').checked,
            output: { ...output, quantity: Math.max(1, Number(output.quantity) || 1), criticalQuantity: Math.max(1, Number(output.criticalQuantity) || 1) }
          };
          const state = getState();
          state.recipes = Array.isArray(state.recipes) ? state.recipes : [];
          const index = state.recipes.findIndex(r => r.id === recipe.id);
          if (index < 0) state.recipes.push(recipe); else state.recipes[index] = recipe;
          try { await saveState(state); ui.notifications.info(existing ? "Рецепт обновлён." : "Рецепт добавлен."); }
          catch (error) { console.error(`${EA.id} | Recipe save failed`, error); ui.notifications.error(error?.message || "Не удалось сохранить рецепт."); }
        } },
        cancel: { label: "Отмена" }
      },
      default: "save",
      render: html => {
        const root = html[0] || html;
        const form = root.querySelector("form");
        updateRequirementSummary(form);
        root.querySelector("[data-clear-requirements]")?.addEventListener("click", () => {
          root.querySelectorAll("[data-requirement-aspect]").forEach(input => { input.value = ""; });
          updateRequirementSummary(form);
        });
        root.querySelectorAll("[data-requirement-aspect]").forEach(input => input.addEventListener("input", () => updateRequirementSummary(form)));
        root.querySelector("[data-load-output]")?.addEventListener("click", async event => {
          const form = event.currentTarget.closest("form");
          const status = form.querySelector("[data-output-status]");
          const uuid = form.querySelector('[name="outputUuid"]').value.trim();
          if (!uuid) return ui.notifications.warn("Введите UUID предмета.");
          event.currentTarget.disabled = true;
          try {
            const item = await itemFromUuid(uuid);
            if (!item || (item.documentName && item.documentName !== "Item")) throw new Error("UUID должен указывать на документ Item.");
            form.querySelector('[name="outputName"]').value = item.name || "";
            form.querySelector('[name="outputImg"]').value = item.img || "icons/svg/item.svg";
            form.querySelector("[data-output-preview]").src = item.img || "icons/svg/item.svg";
            status.textContent = `Загружено: ${item.name}`;
            status.style.color = "green";
          } catch (error) {
            status.textContent = error?.message || "Не удалось загрузить UUID.";
            status.style.color = "var(--color-level-error, #b00)";
          } finally { event.currentTarget.disabled = false; }
        });
        root.querySelector('[name="outputUuid"]')?.addEventListener("input", event => {
          const form = event.currentTarget.closest("form");
          form.querySelector('[name="outputName"]').value = "";
          form.querySelector('[name="outputImg"]').value = "";
          form.querySelector("[data-output-preview]").src = "icons/svg/potion.svg";
          form.querySelector("[data-output-status]").textContent = "UUID изменён — нажмите «Загрузить», чтобы получить данные предмета.";
        });
      }
    });
    dialog.render(true);
  };
  EA.editRecipe = editRecipe;
  EA.recipes = () => {
    if (!game.user?.isGM) return ui.notifications.warn("Редактировать рецепты может только ведущий.");
    const rows = (getState()?.recipes || []).map(recipe => `<li><b>${esc(recipe.name)}</b> — ${esc(EA.aspectText?.(recipe.requirements || {}) || "аспекты не заданы")}; СЛ ${Number(recipe.brewDC) || 10}; ${esc(recipe.output?.itemName || "Предмет не привязан")} <button type="button" data-edit-recipe="${esc(recipe.id)}">Изменить</button> <button type="button" data-delete-recipe="${esc(recipe.id)}">Удалить</button></li>`).join("") || "<li>Рецептов пока нет.</li>";
    new Dialog({ title: "Алхимия — рецепты", content: `<section class="ea-panel"><ul>${rows}</ul><button type="button" data-add-recipe>Добавить рецепт</button></section>`, buttons: { close: { label: "Закрыть" } }, render: html => {
      const root = html[0] || html;
      root.querySelector("[data-add-recipe]")?.addEventListener("click", () => editRecipe());
      root.querySelectorAll("[data-edit-recipe]").forEach(button => button.addEventListener("click", () => editRecipe(button.dataset.editRecipe)));
      root.querySelectorAll("[data-delete-recipe]").forEach(button => button.addEventListener("click", async () => {
        if (!game.user?.isGM) return ui.notifications.warn("Удалять рецепты может только ведущий.");
        const id = button.dataset.deleteRecipe;
        const recipe = getState()?.recipes?.find(entry => entry.id === id);
        if (!recipe) return ui.notifications.warn("Рецепт уже удалён или не найден.");
        const confirmed = await Dialog.confirm({ title: "Удалить рецепт", content: `<p>Удалить рецепт «${esc(recipe.name)}»? Это действие нельзя отменить.</p>` });
        if (!confirmed) return;
        try {
          const state = getState();
          state.recipes = (state.recipes || []).filter(entry => entry.id !== id);
          await saveState(state);
          ui.notifications.info(`Рецепт «${recipe.name}" удалён.`);
          EA.recipes();
        } catch (error) {
          console.error(`${EA.id} | Recipe delete failed`, error);
          ui.notifications.error(error?.message || "Не удалось удалить рецепт.");
        }
      }));
    }}).render(true);
  };
})();
