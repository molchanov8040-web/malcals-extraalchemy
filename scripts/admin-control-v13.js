/* GM-only shortcut and shared stock manager for Foundry VTT 13. */
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
      const checks = Object.entries(aspects).map(([key, value]) => `<tr><td>${esc(EA.aspects[key] || key)}: ${esc(value)}</td><td><input type="checkbox" class="ea-stock-aspect" value="${esc(key)}"${Object.hasOwn(known, key) ? " checked" : ""} aria-label="Доступен игрокам и при изготовлении: ${esc(EA.aspects[key] || key)}"></td></tr>`).join("");
      const editor = orphan ? `<p>Растение отсутствует в библиотеке; его можно убрать со склада.</p>` : `<table><thead><tr><th>Аспект</th><th>Показывать игрокам и разрешить при изготовлении</th></tr></thead><tbody>${checks || '<tr><td colspan="2">Аспектов нет.</td></tr>'}</tbody></table><p>Одна настройка управляет и отображением аспекта игрокам, и его использованием при проверке рецептов и изготовлении. Неотмеченные аспекты недоступны игрокам и не учитываются при изготовлении.</p><button type="button" data-stock-action="aspects">Сохранить доступность аспектов</button>`;
      return `<details class="ea-herb-edit" data-stock-herb="${esc(id)}"><summary>${esc(name)} — на складе: <span class="ea-stock-count">${count}</span></summary><label>Количество <input class="ea-stock-quantity" type="number" min="1" step="1" value="1"></label>${orphan ? "" : '<button type="button" data-stock-action="add">Добавить на склад</button>'}<button type="button" data-stock-action="remove">Убрать количество</button><button type="button" data-stock-action="remove-all">Убрать всё</button>${editor}</details>`;
    };
    const rows = herbs.map(herb => renderRow(herb.ingredientId, herb.name, herb.aspects || {})).join("");
    const orphans = state.group.stock.filter(item => !ids.has(item.ingredientId)).map(item => renderRow(item.ingredientId, item.name || item.ingredientId, {}, true)).join("");
    const content = `<section class="ea-panel ea-admin-stock"><p>Выберите растение. Отмеченные аспекты доступны игрокам и учитываются при изготовлении. Неотмеченные аспекты скрыты от игроков и не используются в расчёте подходящих рецептов. Склад и аспекты сохраняются в игровых данных.</p>${rows}${orphans}</section>`;
    let busy = false;
    EA.popup("Алхимия — склад и растения", content, { close: { label: "Закрыть" } }, root => {
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
            if (action === "add" || action === "remove" || action === "remove-all") {
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
              row.querySelectorAll(".ea-stock-aspect:checked").forEach(input => {
                if (Object.hasOwn(herb.aspects || {}, input.value)) next[input.value] = herb.aspects[input.value];
              });
              fresh.group.knownAspects[id] = next;
              await EA.commit(fresh);
              ui.notifications.info("Доступность аспектов для игроков и изготовления сохранена.");
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
  Hooks.on("getSceneControlButtons", controls => {
    if (!isGM()) return;
    const tokenControls = controls.tokens ?? controls.token ?? Object.values(controls).find(group => group?.name === "token");
    if (!tokenControls) return;
    const tool = { name: "malcals-extraalchemy-admin", title: "Алхимия — панель ведущего", icon: "fa-solid fa-flask-vial", order: 1000, button: true, visible: true, onChange: openAdmin };
    if (Array.isArray(tokenControls.tools)) {
      if (!tokenControls.tools.some(existing => existing.name === tool.name)) tokenControls.tools.push(tool);
    } else {
      tokenControls.tools ??= {};
      tokenControls.tools[tool.name] ??= tool;
    }
  });
})();
