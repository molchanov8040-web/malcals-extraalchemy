/* GM editor for structured herb data. Overrides are world data, separate from display HTML. */
EA.baseHerbSeeds = EA.herbSeeds;

// Normalize older catalog entries to the current four-type model.
EA.herbSeeds = () => {
  const base = EA.baseHerbSeeds();
  let overrides = {};
  try { overrides = game.settings.get(EA.id, "herbOverrides") || {}; } catch { /* setting not registered yet */ }
  const validTypes = new Set((EA.goals || []).map(([id]) => id));
  return base.map(seed => {
    const override = overrides[seed.ingredientId] || {};
    const legacy = Array.isArray(seed.types) ? seed.types : (Array.isArray(seed.goals) ? seed.goals : []);
    const types = (Array.isArray(override.types) ? override.types : legacy).filter(type => validTypes.has(type));
    const regions = Array.isArray(override.regions) ? override.regions : (Array.isArray(seed.regions) ? seed.regions : []);
    const aspects = { ...(seed.aspects || {}), ...(override.aspects || {}) };
    return { ...seed, ...override, aspects, regions, types, goals: types };
  });
};

Hooks.once("init", () => game.settings.register(EA.id, "herbOverrides", {
  scope: "world", config: false, type: Object, default: {}
}));

EA.openLibrary = () => {
  if (!game.user.isGM) return ui.notifications.warn("Библиотека доступна только мастеру.");
  const draw = () => {
    const seeds = EA.herbSeeds();
    const types = EA.goals || [];
    const rows = seeds.map(herb => `<details class="ea-herb-edit"><summary>${EA.esc(herb.name)}</summary><div class="ea-herb-edit-fields"><label>Аспекты (код:значение, через запятую)<input data-aspects="${EA.esc(herb.ingredientId)}" value="${EA.esc(Object.entries(herb.aspects).map(([key, value]) => `${key}:${value}`).join(", "))}"></label><label>Местности, через запятую<input data-regions="${EA.esc(herb.ingredientId)}" value="${EA.esc(herb.regions.join(", "))}"></label><fieldset><legend>Типы</legend>${types.map(([id, label]) => `<label class="ea-check"><input type="checkbox" data-type="${EA.esc(herb.ingredientId)}" value="${id}"${herb.types.includes(id) ? " checked" : ""}>${EA.esc(label)}</label>`).join("")}</fieldset><button type="button" data-save-herb="${EA.esc(herb.ingredientId)}">Сохранить</button></div></details>`).join("");
    new Dialog({
      title: "Библиотека трав — редактирование",
      content: `<section class="ea-panel"><p>Аспекты и местности сохраняются в данных мира и используются логикой сбора и исследования.</p>${rows}</section>`,
      buttons: { close: { label: "Закрыть" } },
      render: html => {
        const root = html[0] ?? html;
        root.querySelectorAll("[data-save-herb]").forEach(button => button.onclick = async () => {
          const key = button.dataset.saveHerb;
          const aspectInput = root.querySelector(`[data-aspects="${CSS.escape(key)}"]`);
          const regionInput = root.querySelector(`[data-regions="${CSS.escape(key)}"]`);
          const aspects = {};
          for (const part of aspectInput.value.split(",")) {
            const [name, value] = part.trim().split(":").map(x => x.trim());
            if (!name) continue;
            const number = Number(value);
            if (!Object.hasOwn(EA.aspects, name) || !Number.isFinite(number) || number <= 0) {
              ui.notifications.warn(`Некорректный аспект: ${part}`);
              return;
            }
            aspects[name] = number;
          }
          const regions = regionInput.value.split(",").map(x => x.trim()).filter(Boolean);
          if (!Object.keys(aspects).length || !regions.length) {
            ui.notifications.warn("Укажите хотя бы один аспект и одну местность.");
            return;
          }
          const selected = [...root.querySelectorAll(`[data-type="${CSS.escape(key)}"]:checked`)].map(x => x.value);
          if (!selected.length) {
            ui.notifications.warn("Выберите хотя бы один тип травы.");
            return;
          }
          const all = game.settings.get(EA.id, "herbOverrides") || {};
          all[key] = { ...(all[key] || {}), aspects, regions, types: selected };
          await game.settings.set(EA.id, "herbOverrides", all);
          try {
            const pack = game.packs.get(EA.libraryPackId);
            const doc = pack && (await pack.getDocuments()).find(x => (EA.herbFlag(x)?.ingredientId ?? EA.herbFlag(x)?.seedId) === key);
            if (doc) {
              await pack.configure({ locked: false });
              const description = doc.flags?.[EA.id]?.["library-herb"]?.description || "";
              await doc.update({
                [`flags.${EA.id}.library-herb.aspects`]: aspects,
                [`flags.${EA.id}.library-herb.regions`]: regions,
                [`flags.${EA.id}.library-herb.types`]: selected,
                "system.description.value": `<p>${EA.esc(description)}</p><p><b>Типы:</b> ${selected.map(type => types.find(x => x[0] === type)?.[1] || type).map(EA.esc).join(", ")}</p><p><b>Местности:</b> ${regions.map(EA.esc).join(", ")}</p><p><b>Аспекты:</b> ${Object.entries(aspects).map(([aspect, value]) => `${EA.esc(EA.aspects[aspect] || aspect)}: ${value}`).join(", ")}</p>`
              });
              await pack.configure({ locked: true });
            }
          } catch (error) {
            console.warn(`${EA.id} | Could not mirror herb edits to compendium`, error);
          }
          ui.notifications.info(`${EA.herbSeeds().find(x => x.ingredientId === key)?.name || key}: данные сохранены.`);
          draw();
        });
      }
    }).render(true);
  };
  draw();
};
