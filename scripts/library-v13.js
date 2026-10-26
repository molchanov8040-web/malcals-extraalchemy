/* Herb library, structured herb data, and GM-only editor for Foundry VTT 13. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  const PACK_NAME = "malcals-extraalchemy-herbs";
  const PACK_LABEL = "Библиотека трав";
  const FOLDER_NAME = "Malcal's ExtraAlchemy";
  const FLAG = "library-herb";
  const worldPackId = `world.${PACK_NAME}`;

  const seeds = [
    { ingredientId: "elfroot", name: "Эльфийский корень", image: "elfroot.webp", rarity: "common", types: ["healing"], regions: ["Лес", "Равнины", "Поселение"], aspects: { Vita: 2, Herba: 1 }, description: "Распространённый корень, используемый в целебных составах." },
    { ingredientId: "deep-mushroom", name: "Глубинный гриб", image: "deep-mushroom.webp", rarity: "uncommon", types: ["poisonous", "rare_magic"], regions: ["Подземелье", "Руины"], aspects: { Mortuus: 1, Venenum: 2, Herba: 1 }, description: "Бледный гриб, растущий в сырых подземных местах." },
    { ingredientId: "deathroot", name: "Корень смерти", image: "deathroot.webp", rarity: "rare", types: ["poisonous"], regions: ["Болото", "Руины"], aspects: { Mortuus: 2, Venenum: 3 }, description: "Опасный корень, пригодный для сильных ядов." },
    { ingredientId: "emberbloom", name: "Углецвет", image: "emberbloom.webp", rarity: "uncommon", types: ["elemental"], regions: ["Горы", "Руины"], aspects: { Ignis: 2, Herba: 1 }, description: "Теплолюбивое растение с яркими лепестками." },
    { ingredientId: "mist-lily", name: "Туманная лилия", image: "mist-lily.webp", rarity: "uncommon", types: ["healing", "elemental"], regions: ["Болото", "Побережье"], aspects: { Aqua: 2, Vita: 1 }, description: "Влаголюбивая лилия с прохладным соком." },
    { ingredientId: "storm-thistle", name: "Грозовой чертополох", image: "storm-thistle.webp", rarity: "rare", types: ["elemental", "rare_magic"], regions: ["Горы", "Побережье"], aspects: { Motus: 2, Ignis: 1, Terra: 1 }, description: "Колючее растение, накапливающее энергию гроз." },
    { ingredientId: "blood-lotus", name: "Кровавый лотос", image: "blood-lotus.webp", rarity: "rare", types: ["healing", "poisonous"], regions: ["Болото", "Руины"], aspects: { Vita: 2, Venenum: 1, Herba: 2 }, description: "Редкий болотный цветок с мощными, но опасными свойствами." },
    { ingredientId: "lyrium", name: "Лириум", image: "lyrium.webp", rarity: "rare", types: ["rare_magic"], regions: ["Подземелье", "Руины", "Горы"], aspects: { Praecantatio: 3, Terra: 1, Sensus: 1 }, description: "Магически насыщенный минерал, применяемый в сложных составах." }
  ];

  const esc = value => E.esc(value);
  const validTypes = () => new Set((E.goals || []).map(([id]) => id));
  const imagePath = image => image ? `modules/${E.id}/assets/images/herbs/${image}` : "icons/svg/item-bag.svg";
  E.herbImagePath = imagePath;
  E.libraryPackId = worldPackId;
  E.herbFlag = document => document?.getFlag?.(E.id, FLAG) ?? document?.flags?.[E.id]?.[FLAG] ?? null;

  Hooks.once("init", () => game.settings.register(E.id, "herbOverrides", {
    scope: "world", config: false, type: Object, default: {}
  }));

  E.herbSeeds = () => {
    let overrides = {};
    try { overrides = game.settings.get(E.id, "herbOverrides") || {}; } catch { /* before settings initialization */ }
    const allowed = validTypes();
    return seeds.map(seed => {
      const override = overrides[seed.ingredientId] || {};
      const types = (Array.isArray(override.types) ? override.types : seed.types).filter(type => allowed.has(type));
      const regions = Array.isArray(override.regions) ? override.regions.filter(Boolean) : [...seed.regions];
      const aspects = { ...seed.aspects, ...(override.aspects || {}) };
      return { ...seed, ...override, aspects, regions, types, goals: types };
    });
  };
  E.herb = key => E.herbSeeds().find(seed => seed.ingredientId === key) || null;

  const herbDescription = herb => `<p>${esc(herb.description || "")}</p><p><b>Типы:</b> ${herb.types.map(type => E.goals.find(entry => entry[0] === type)?.[1] || type).map(esc).join(", ")}</p><p><b>Местности:</b> ${herb.regions.map(esc).join(", ")}</p><p><b>Аспекты:</b> ${Object.entries(herb.aspects).map(([aspect, value]) => `${esc(E.aspects[aspect] || aspect)}: ${value}`).join(", ")}</p>`;
  const herbData = herb => ({
    name: herb.name,
    type: "loot",
    img: imagePath(herb.image),
    system: { description: { value: herbDescription(herb) }, quantity: 1, weight: { value: 0, units: "lb" }, price: { value: 0, denomination: "gp" }, rarity: herb.rarity || "common" },
    flags: { [E.id]: { [FLAG]: { ingredientId: herb.ingredientId, aspects: herb.aspects, regions: herb.regions, types: herb.types, description: herb.description || "" } } }
  });

  const ensureFolder = async () => {
    let folder = game.folders.find(entry => entry.type === "Compendium" && entry.name === FOLDER_NAME);
    if (!folder) [folder] = await Folder.createDocuments([{ name: FOLDER_NAME, type: "Compendium", sorting: "a" }]);
    return folder;
  };
  E.ensureHerbLibrary = async () => {
    if (!game.user.isGM) return game.packs.get(worldPackId) || null;
    const folder = await ensureFolder();
    let pack = game.packs.get(worldPackId);
    if (!pack) {
      const Collection = globalThis.CompendiumCollection ?? foundry.documents.collections.CompendiumCollection;
      pack = await Collection.createCompendium({ type: "Item", name: PACK_NAME, label: PACK_LABEL, package: "world" });
    }
    if (folder && pack.folder?.id !== folder.id) await pack.setFolder(folder.id);
    const existing = await pack.getDocuments();
    for (const herb of E.herbSeeds()) {
      const match = existing.find(document => E.herbFlag(document)?.ingredientId === herb.ingredientId);
      if (!match) await pack.documentClass.createDocuments([herbData(herb)], { pack: pack.collection });
    }
    return pack;
  };

  E.openLibrary = () => {
    if (!game.user.isGM) return ui.notifications.warn("Библиотека доступна только мастеру.");
    const draw = () => {
      const herbs = E.herbSeeds();
      const rows = herbs.map(herb => `<details class="ea-herb-edit"><summary>${esc(herb.name)}</summary><div class="ea-herb-edit-fields"><label>Аспекты (код:значение, через запятую)<input data-aspects="${esc(herb.ingredientId)}" value="${esc(Object.entries(herb.aspects).map(([key, value]) => `${key}:${value}`).join(", "))}"></label><label>Местности, через запятую<input data-regions="${esc(herb.ingredientId)}" value="${esc(herb.regions.join(", "))}"></label><fieldset><legend>Типы</legend>${E.goals.map(([type, label]) => `<label class="ea-check"><input type="checkbox" data-type="${esc(herb.ingredientId)}" value="${type}"${herb.types.includes(type) ? " checked" : ""}>${esc(label)}</label>`).join("")}</fieldset><button type="button" data-save-herb="${esc(herb.ingredientId)}">Сохранить</button></div></details>`).join("");
      new Dialog({ title: "Библиотека трав — редактирование", content: `<section class="ea-panel"><p>Изменения сохраняются в данных мира и отражаются в компендиуме.</p>${rows}</section>`, buttons: { close: { label: "Закрыть" } }, render: html => {
        const root = html?.[0] ?? html;
        root.querySelectorAll("[data-save-herb]").forEach(button => button.onclick = async () => {
          const id = button.dataset.saveHerb;
          const aspectInput = root.querySelector(`[data-aspects="${CSS.escape(id)}"]`);
          const regionInput = root.querySelector(`[data-regions="${CSS.escape(id)}"]`);
          const aspects = {};
          for (const part of aspectInput.value.split(",")) {
            const [name, value] = part.trim().split(":").map(text => text.trim());
            const number = Number(value);
            if (!name) continue;
            if (!Object.hasOwn(E.aspects, name) || !Number.isFinite(number) || number <= 0) return ui.notifications.warn(`Некорректный аспект: ${part}`);
            aspects[name] = number;
          }
          const regions = regionInput.value.split(",").map(text => text.trim()).filter(Boolean);
          const types = [...root.querySelectorAll(`[data-type="${CSS.escape(id)}"]:checked`)].map(input => input.value);
          if (!Object.keys(aspects).length || !regions.length || !types.length) return ui.notifications.warn("Укажите аспекты, местности и хотя бы один тип.");
          const overrides = game.settings.get(E.id, "herbOverrides") || {};
          overrides[id] = { ...(overrides[id] || {}), aspects, regions, types };
          await game.settings.set(E.id, "herbOverrides", overrides);
          const pack = await E.ensureHerbLibrary();
          const document = (await pack?.getDocuments() || []).find(entry => E.herbFlag(entry)?.ingredientId === id);
          if (document) {
            const herb = E.herb(id);
            await pack.configure({ locked: false });
            await document.update(herbData(herb));
            await pack.configure({ locked: true });
          }
          ui.notifications.info(`${E.herb(id)?.name || id}: данные сохранены.`);
          draw();
        });
      } }).render(true);
    };
    draw();
  };

  Hooks.once("ready", async () => {
    if (!game.user.isGM) return;
    try { await E.ensureHerbLibrary(); console.info(`${E.id} | Herb library initialized.`); }
    catch (error) { console.error(`${E.id} | Herb library setup failed`, error); }
  });
})();
