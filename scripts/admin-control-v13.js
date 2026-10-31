/* GM-only shortcut and shared stock manager for Foundry VTT 13/14. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;
  const isGM = () => !!game.user?.isGM;
  const esc = value => EA.esc(value);

  EA.openAdminStock = () => {
    if (!isGM()) return ui.notifications.warn("Доступно только ведущему.");
    const state = EA.getState();
    const herbs = EA.herbSeeds?.() || [];
    const ids = new Set(herbs.map(herb => herb.ingredientId));
    const renderRow = (id, name, aspects, orphan = false) => {
      const known = state.group.knownAspects[id] || {};
      const count = Number(state.group.stock.find(item => item.ingredientId === id)?.quantity || 0);
      const controls = Object.entries(aspects).map(([key, baseValue]) => {
        const isKnown = Object.hasOwn(known, key);
        const amount = Number(isKnown ? known[key] : baseValue);
        const safeAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;
        return `<label class="ea-stock-aspect-row" style="display:grid;grid-template-columns:auto 1fr minmax(5rem,7rem);align-items:center;gap:.5rem;margin:.25rem 0"><input type="checkbox" class="ea-stock-aspect-enabled" value="${esc(key)}"${isKnown ? " checked" : ""} aria-label="Включить аспект ${esc(EA.aspects[key] || key)}"><span>${esc(EA.aspects[key] || key)} <small>(${esc(key)})</small></span><input type="number" class="ea-stock-aspect-quantity" data-aspect="${esc(key)}" min="0" step="any" value="${esc(safeAmount)}" aria-label="Количество аспекта ${esc(EA.aspects[key] || key)}"${isKnown ? "" : " disabled"}></label>`;
      }).join("");
      const editor = orphan ? `<p>Растение отсутствует в библиотеке; его можно убрать со склада.</p>` : `<fieldset><legend>Известные игрокам аспекты и количество</legend><p>Отметьте аспект, чтобы открыть его игрокам и учитывать при изготовлении. Для каждого отмеченного аспекта задайте количество.</p>${controls || "<p>Аспектов нет.</p>"}<button type="button" data-stock-action="aspects">Сохранить аспекты</button></fieldset>`;
      return `<details class="ea-herb-edit" data-stock-herb="${esc(id)}"><summary>${esc(name)} — на складе: <span class="ea-stock-count">${count}</span></summary><label>Количество травы <input class="ea-stock-quantity" type="number" min="1" step="1" value="1"></label>${orphan ? "" : '<button type="button" data-stock-action="add">Добавить на склад</button>'}<button type="button" data-stock-action="remove">Убрать количество</button><button type="button" data-stock-action="remove-all">Убрать всё</button>${editor}</details>`;
    };
    const rows = herbs.map(herb => renderRow(herb.ingredientId, herb.name, herb.aspects || {})).join("");
    const orphans = state.group.stock.filter(item => !ids.has(item.ingredientId)).map(item => renderRow(item.ingredientId, item.name || item.ingredientId, {}, true)).join("");
    const content = `<section class="ea-panel ea-admin-stock"><p>Настройки сохраняются отдельно для каждого растения. Отмеченные аспекты доступны игрокам и учитываются при изготовлении; количество задаётся числовым полем.</p>${rows}${orphans}</section>`;
    let busy = false;
    EA.popup("Алхимия — склад и растения", content, { close: { label: "Закрыть" } }, root => {
      root.querySelectorAll("[data-stock-herb]").forEach(row => row.querySelectorAll(".ea-stock-aspect-enabled").forEach(checkbox => {
        checkbox.addEventListener("change", () => {
          const quantity = row.querySelector(`.ea-stock-aspect-quantity[data-aspect="${CSS.escape(checkbox.value)}"]`);
          if (quantity) quantity.disabled = !checkbox.checked;
        });
      }));
      root.querySelectorAll("[data-stock-action]").forEach(button => {
        button.addEventListener("click", async () => {
          if (!isGM()) return ui.notifications.warn("Доступно только ведущему.");
          const row = button.closest("[data-stock-herb]");
          const id = row?.dataset.stockHerb;
          const action = button.dataset.stockAction;
          if (!id || !row || busy) return;
          busy = true;
          button.disabled = true;
          try {
            const fresh = EA.getState();
            const herb = EA.herb?.(id);
            if (["add", "remove", "remove-all"].includes(action)) {
              const raw = row.querySelector(".ea-stock-quantity").value;
              const count = Number(raw);
              if (action !== "remove-all" && (!raw.trim() || !Number.isSafeInteger(count) || count <= 0)) throw new Error("Укажите положительное целое количество.");
              if (action === "add") {
                if (!herb) throw new Error("Растение отсутствует в библиотеке.");
                EA.add(fresh, herb, count);
              } else {
                const entry = EA.entry(fresh, id);
                if (!entry) throw new Error("Растение отсутствует на складе.");
                EA.take(fresh, id, action === "remove-all" ? entry.quantity : count);
              }
              await EA.commit(fresh);
              row.querySelector(".ea-stock-count").textContent = String(EA.entry(EA.getState(), id)?.quantity || 0);
              ui.notifications.info("Склад обновлён.");
            } else if (action === "aspects") {
              if (!herb) throw new Error("Растение отсутствует в библиотеке.");
              const next = {};
              for (const checkbox of row.querySelectorAll(".ea-stock-aspect-enabled:checked")) {
                const quantity = row.querySelector(`.ea-stock-aspect-quantity[data-aspect="${CSS.escape(checkbox.value)}"]`);
                const raw = quantity?.value ?? "";
                const amount = Number(raw);
                if (!raw.trim() || !Number.isFinite(amount) || amount < 0) throw new Error(`Укажите корректное количество аспекта «${EA.aspects[checkbox.value] || checkbox.value}».`);
                next[checkbox.value] = amount;
              }
              fresh.group.knownAspects[id] = next;
              await EA.commit(fresh);
              ui.notifications.info("Аспекты и их количества сохранены.");
            }
          } catch (error) {
            console.error(`${EA.id} | Управление складом:`, error);
            ui.notifications.error(error?.message || "Не удалось сохранить изменения.");
          } finally { busy = false; button.disabled = false; }
        });
      });
    });
  };

  const openAdmin = () => {
    if (!isGM()) return;
    EA.popup("Алхимия — панель ведущего", `<section class="ea-panel ea-admin-actions"><button type="button" data-admin="config">Настройка алхимии</button><button type="button" data-admin="stock">Склад и растения</button><button type="button" data-admin="recipes">Редактор рецептов</button><button type="button" data-admin="library">Библиотека трав</button></section>`, { close: { label: "Закрыть" } }, root => root.querySelectorAll("[data-admin]").forEach(button => button.onclick = () => {
      if (!isGM()) return ui.notifications.warn("Доступно только ведущему.");
      const action = button.dataset.admin;
      if (action === "config") EA.config?.();
      else if (action === "stock") EA.openAdminStock();
      else if (action === "recipes") EA.recipes?.();
      else if (action === "library") EA.openLibrary?.();
    }));
  };

  EA.openAdmin = openAdmin;
  EA.openAdminPanel = openAdmin;
  Hooks.on("getSceneControlButtons", controls => {
    if (!isGM()) return;
    const tool = { name: "malcals-extraalchemy-admin", title: "Алхимия — панель ведущего", icon: "fa-solid fa-flask-vial", order: 1000, button: true, visible: true, onChange: openAdmin };
    EA.compat?.registerSceneTool?.(controls, tool);
  });
})();
