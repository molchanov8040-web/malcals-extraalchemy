/* Final UI repair layer for Foundry VTT 13.351. Loaded after legacy files. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  const baseState = E.state.bind(E);
  E.state = () => {
    const s = baseState() || {};
    s.actors = Array.isArray(s.actors) ? s.actors : [];
    s.territories = Array.isArray(s.territories) && s.territories.length ? s.territories : ["Лес"];
    s.territory = s.territories.includes(s.territory) ? s.territory : s.territories[0];
    s.allowedHerbs = Array.isArray(s.allowedHerbs) ? s.allowedHerbs : [];
    s.groupStock = Array.isArray(s.groupStock) ? s.groupStock : [];
    s.groupKnowledge = s.groupKnowledge && typeof s.groupKnowledge === "object" ? s.groupKnowledge : {};
    s.recipes = Array.isArray(s.recipes) ? s.recipes : [];
    s.history = Array.isArray(s.history) ? s.history : [];
    s.goals = Array.isArray(s.goals) ? s.goals : [];
    s.gatherDC = Math.max(1, Number(s.gatherDC) || 10);
    return s;
  };

  E.aspectText ??= aspects => Object.entries(aspects || {}).map(([key, value]) => `${E.aspectName(key)}: ${value}`).join(", ") || "нет";
  E.visibleAspects ??= (_actor, item) => item?.knownAspects || item?.getFlag?.(E.id, "knownAspects") || {};

  E.config = async () => {
    if (!game.user.isGM) return ui.notifications.warn("Настройка доступна только мастеру.");
    const s = E.state();
    const pack = await E.ensureHerbLibrary();
    const herbs = pack ? await pack.getDocuments() : [];
    const actors = Array.from(game.actors).filter(a => a.type === "character");
    const herbChecks = herbs.map(h => {
      const d = E.herbFlag(h) || {};
      const checked = !s.allowedHerbs.length || s.allowedHerbs.includes(d.seedId);
      return `<label class="ea-check"><input name="ea-herb" type="checkbox" value="${E.esc(d.seedId || "")}"${checked ? " checked" : ""}>${E.esc(h.name)}</label>`;
    }).join("") || "<p>Библиотека трав пуста.</p>";
    new Dialog({
      title: "Алхимия — настройка",
      content: `<section class="ea-panel"><label>Персонажи игроков<select id="ea-actors" multiple size="6">${actors.map(a => `<option value="${a.id}"${s.actors.includes(a.id) ? " selected" : ""}>${E.esc(a.name)}</option>`).join("")}</select></label><label>Территория<select id="ea-territory">${s.territories.map(t => `<option value="${E.esc(t)}"${t === s.territory ? " selected" : ""}>${E.esc(t)}</option>`).join("")}</select></label><div class="ea-add-location"><input id="ea-new-territory" placeholder="Новая локация"><button id="ea-add-territory" type="button">Добавить локацию</button><button id="ea-delete-territory" type="button">Удалить выбранную</button></div><label>СЛ поиска<input id="ea-gather-dc" type="number" min="1" value="${s.gatherDC}"></label><fieldset class="ea-goals"><legend>Травы, доступные для сбора</legend>${herbChecks}</fieldset></section>`,
      buttons: {
        save: {label: "Сохранить", callback: async html => {
          const r = html[0] ?? html;
          s.actors = Array.from(r.querySelector("#ea-actors")?.selectedOptions || []).map(o => o.value);
          s.territories = Array.from(r.querySelector("#ea-territory")?.options || []).map(o => o.value);
          s.territory = r.querySelector("#ea-territory")?.value || s.territories[0];
          s.gatherDC = Math.max(1, Number(r.querySelector("#ea-gather-dc")?.value) || 10);
          s.allowedHerbs = Array.from(r.querySelectorAll("input[name=ea-herb]:checked")).map(i => i.value);
          await E.save(s); ui.notifications.info("Настройки алхимии сохранены.");
        }}, cancel: {label: "Отмена"}
      },
      render: html => {
        const r = html[0] ?? html, select = r.querySelector("#ea-territory");
        r.querySelector("#ea-add-territory").onclick = () => {
          const input = r.querySelector("#ea-new-territory"), name = input.value.trim();
          if (!name) return ui.notifications.warn("Введите название локации.");
          if (Array.from(select.options).some(o => o.value.toLowerCase() === name.toLowerCase())) return ui.notifications.warn("Такая локация уже существует.");
          select.add(new Option(name, name, true, true)); input.value = "";
        };
        r.querySelector("#ea-delete-territory").onclick = () => {
          if (select.options.length < 2) return ui.notifications.warn("Нельзя удалить последнюю территорию.");
          select.remove(select.selectedIndex);
        };
      }
    }).render(true);
  };

  E.hub = () => new Dialog({
    title: "Инструменты алхимии",
    content: `<section class="ea-panel"><div class="ea-actions">${game.user.isGM ? `<button data-ea="config"><i class="fas fa-cog"></i> Настройка</button>` : ""}<button data-ea="gather"><i class="fas fa-seedling"></i> Сбор</button><button data-ea="stock"><i class="fas fa-box"></i> Склад</button><button data-ea="experiments"><i class="fas fa-flask"></i> Изготовление</button>${game.user.isGM ? `<button data-ea="recipes"><i class="fas fa-book"></i> Рецепты</button><button data-ea="library"><i class="fas fa-leaf"></i> Библиотека трав</button>` : ""}</div></section>`,
    buttons: {close:{label:"Закрыть"}},
    render: html => (html[0] ?? html).querySelectorAll("[data-ea]").forEach(b => b.onclick = () => {
      if (b.dataset.ea === "stock") return E.stock();
      if (b.dataset.ea === "library") return E.library();
      return E.open(b.dataset.ea);
    })
  }).render(true);
})();
