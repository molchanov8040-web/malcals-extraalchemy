/* GM-only shortcut and shared stock manager for Foundry VTT 13. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;
  const setting = "herbPlayerVisibleAspects";
  const isGM = () => !!game.user?.isGM;
  const esc = value => EA.esc(value);

  EA.openAdminStock = () => {
    if (!isGM()) return ui.notifications.warn("Доступно только ведущему.");
    const state = EA.getState();
    const herbs = EA.herbSeeds?.() || [];
    const ids = new Set(herbs.map(herb => herb.ingredientId));
    const visibility = game.settings.get(EA.id, setting) || {};
    const renderRow = (id, name, aspects, orphan = false) => {
      const known = state.group.knownAspects[id] || {};
      const visible = Array.isArray(visibility[id]) ? visibility[id] : [];
      const count = Number(state.group.stock.find(item => item.ingredientId === id)?.quantity || 0);
      const checks = Object.entries(aspects).map(([key, value]) => `<tr><td>${esc(EA.aspects[key] || key)}: ${esc(value)}</td><td><input type="checkbox" class="ea-stock-known" value="${esc(key)}"${Object.hasOwn(known, key) ? " checked" : ""} aria-label="Известен группе: ${esc(EA.aspects[key] || key)}"></td><td><input type="checkbox" class="ea-stock-visible" value="${esc(key)}"${visible.includes(key) ? " checked" : ""} aria-label="Виден игрокам: ${esc(EA.aspects[key] || key)}"></td></tr>`).join("");
      const editor = orphan ? `<p>Растение отсутствует в библиотеке; его можно убрать со склада.</p>` : `<table><thead><tr><th>Аспект</th><th>Известен группе</th><th>Виден игрокам</th></tr></thead><tbody>${checks || '<tr><td colspan="3">Аспектов нет.</td></tr>'}</tbody></table><p>Известные группе аспекты используются при изготовлении. Видимость управляет только показом: игрок видит лишь известные и разрешённые аспекты.</p><button type="button" data-stock-action="known">Сохранить известные аспекты</button><button type="button" data-stock-action="visible">Сохранить видимость</button>`;
      return `<details class="ea-herb-edit" data-stock-herb="${esc(id)}"><summary>${esc(name)} — на складе: <span class="ea-stock-count">${count}</span></summary><label>Количество <input class="ea-stock-quantity" type="number" min="1" step="1" value="1"></label>${orphan ? "" : '<button type="button" data-stock-action="add">Добавить на склад</button>'}<button type="button" data-stock-action="remove">Убрать количество</button><button type="button" data-stock-action="remove-all">Убрать всё</button>${editor}</details>`;
    };
    const rows = herbs.map(herb => renderRow(herb.ingredientId, herb.name, herb.aspects || {})).join("");
    const orphans = state.group.stock.filter(item => !ids.has(item.ingredientId)).map(item => renderRow(item.ingredientId, item.name || item.ingredientId, {}, true)).join("");
    const content = `<section class="ea-panel ea-admin-stock"><p>Выберите растение. Если видимость не настроена, его аспекты скрыты от игроков. Склад, знания и видимость сохраняются отдельно.</p>${rows}${orphans}</section>`;
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
            } else if (action === "known") {
              if (!herb) throw new Error("Растение отсутствует в библиотеке.");
              const next = {};
              row.querySelectorAll(".ea-stock-known:checked").forEach(input => {
                if (Object.hasOwn(herb.aspects || {}, input.value)) next[input.value] = herb.aspects[input.value];
              });
              fresh.group.knownAspects[id] = next;
              await EA.commit(fresh);
              ui.notifications.info("Известные группе аспекты сохранены.");
            } else if (action === "visible") {
              if (!herb) throw new Error("Растение отсутствует в библиотеке.");
              const next = foundry.utils.deepClone(game.settings.get(EA.id, setting) || {});
              next[id] = Array.from(row.querySelectorAll(".ea-stock-visible:checked"), input => input.value).filter(key => Object.hasOwn(herb.aspects || {}, key));
              await game.settings.set(EA.id, setting, next);
              EA.changed?.();
              ui.notifications.info("Видимость аспектов для игроков сохранена.");
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
