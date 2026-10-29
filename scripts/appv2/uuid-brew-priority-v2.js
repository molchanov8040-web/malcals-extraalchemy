/* Prefer an explicitly linked recipe output UUID during crafting. */
(() => {
  const E = globalThis.EA;
  if (!E || E.__uuidBrewPriorityV2) return;
  E.__uuidBrewPriorityV2 = true;

  const normalizeName = value => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const esc = value => E.esc ? E.esc(value) : String(value ?? "");

  const resolveItem = async uuid => {
    if (!uuid || typeof globalThis.fromUuid !== "function") return null;
    try {
      const document = await globalThis.fromUuid(uuid);
      return document?.documentName === "Item" || document?.type ? document : null;
    } catch (error) {
      console.warn(`${E.id} | Could not resolve recipe output UUID`, uuid, error);
      return null;
    }
  };

  const findByName = async name => {
    const matches = [];
    for (const pack of game.packs ?? []) {
      if (pack.documentName !== "Item") continue;
      const index = await pack.getIndex({ fields: ["name"] });
      for (const entry of index) {
        if (normalizeName(entry.name) !== normalizeName(name)) continue;
        const document = await pack.getDocument(entry._id);
        if (document) matches.push({ pack, document });
      }
    }
    return matches;
  };

  const packInfo = document => {
    const pack = document?.pack ? game.packs.get(document.pack) : null;
    const metadata = pack?.metadata ?? {};
    const packageId = metadata.packageName ?? metadata.packageId ?? metadata.package;
    const module = packageId && packageId !== "world" ? game.modules.get(packageId) : null;
    return {
      moduleName: module?.title || (packageId && packageId !== "world" ? packageId : null),
      packName: metadata.label || metadata.name || document?.pack || "неизвестный компендиум"
    };
  };

  E.resolveBrew = async request => {
    const state = E.getState();
    const user = game.users.get(request?.userId);
    const actor = game.actors.get(request?.actorId);
    const recipe = state.recipes.find(item => item.id === request?.recipeId);
    const ingredients = (request?.ingredients || []).map(item => ({
      ingredientId: item.ingredientId,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
    }));
    if (!user || !actor || !E.canActor(user, actor, state)) throw new Error("Нет доступа к персонажу.");
    if (!recipe) throw new Error("Рецепт не найден.");
    if (!user.isGM && !recipe.playersKnow) throw new Error("Рецепт неизвестен игрокам.");
    if (!ingredients.length || !E.matches(recipe, E.total(state, ingredients))) throw new Error("Недостаточно известных аспектов.");

    const output = recipe.output || {};
    const success = Number(request?.total) >= Number(recipe.brewDC);
    let source = null;
    let resultName = String(output.itemName || recipe.name).trim();

    if (success) {
      const linked = await resolveItem(output.uuid);
      if (linked) {
        source = { pack: linked.pack ? game.packs.get(linked.pack) : null, document: linked };
        resultName = linked.name;
      } else {
        const candidates = await findByName(resultName);
        if (candidates.length > 1) {
          const list = candidates.map(({ pack, document }) => `<li><b>${esc(pack?.metadata?.label || pack?.collection || "Компендиум")}</b>: ${esc(document.name)} — <code>${esc(document.uuid)}</code></li>`).join("");
          await ChatMessage.create({ speaker: { alias: "Алхимия" }, content: `<h3>Неоднозначный предмет при изготовлении</h3><p>Для рецепта «${esc(recipe.name)}» найдено несколько предметов «${esc(resultName)}». Ингредиенты не списаны.</p><ul>${list}</ul>`, whisper: game.users.filter(item => item.isGM).map(item => item.id) });
          throw new Error(`Найдено несколько предметов «${resultName}». ГМ получил список совпадений; ингредиенты не списаны.`);
        }
        if (candidates.length === 1) source = candidates[0];
        else if (output.requireCompendiumPotion) throw new Error(`Предмет «${resultName}» не найден. Ингредиенты не списаны.`);
      }
    }

    for (const ingredient of ingredients) E.take(state, ingredient.ingredientId, ingredient.quantity);
    let message = "Провал: ингредиенты израсходованы, предмет не создан.";
    if (success) {
      const quantity = Math.max(1, Number(Number(request?.total) >= Number(recipe.brewDC) + 5 ? output.criticalQuantity : output.quantity) || 1);
      if (source?.document) {
        const itemData = source.document.toObject();
        for (const key of ["_id", "folder", "sort", "ownership", "_stats"]) delete itemData[key];
        itemData.system = foundry.utils.deepClone(itemData.system || {});
        itemData.system.quantity = quantity;
        itemData.flags = foundry.utils.deepClone(itemData.flags || {});
        foundry.utils.setProperty(itemData.flags, `${E.id}.craftedFrom`, { recipeId: recipe.id, recipeName: recipe.name, uuid: source.document.uuid });
        await actor.createEmbeddedDocuments("Item", [itemData]);
        const origin = packInfo(source.document);
        message = origin.moduleName
          ? `Успех: создан предмет «${esc(source.document.name)}» из модуля «${esc(origin.moduleName)}» — компендиум «${esc(origin.packName)}» × ${quantity}.`
          : `Успех: создан предмет «${esc(source.document.name)}» из компендиума «${esc(origin.packName)}» × ${quantity}.`;
      } else {
        const name = output.itemName || recipe.name;
        await actor.createEmbeddedDocuments("Item", [{ name, type: "consumable", img: output.img || "icons/consumables/potions/bottle-round-corked-red.webp", system: { quantity, type: { value: "potion" }, description: { value: `<p>${esc(recipe.description || "Алхимический состав.")}</p>` } }, flags: { [E.id]: { recipeId: recipe.id } } }]);
        message = `Успех: создано «${esc(name)}» × ${quantity}.`;
      }
    }

    state.group.brewHistory.unshift({ id: foundry.utils.randomID(), timestamp: Date.now(), actorName: actor.name, recipeId: recipe.id, recipeName: recipe.name, total: Number(request?.total) || 0, dc: recipe.brewDC, success, ingredients });
    await E.commit(state);
    return { message };
  };
})();
