/* Runtime fixes for the 0.8.9 cross-version test build. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  // Foundry 13 reports the installed package as v1.1.4 while the manifest
  // contains 1.1.4. Compare normalized values, without changing the package.
  if (E.compat?.diagnose && !E.compat.diagnose.__eaNormalizedSocketVersion) {
    const diagnose = E.compat.diagnose;
    const normalized = value => String(value ?? "").trim().replace(/^v/i, "");
    const wrapped = () => {
      const report = diagnose();
      report.socketVersion = normalized(report.socketVersion);
      report.issues = (report.issues || []).filter(issue => !/Expected tested Socketlib 1\.1\.4; detected v?1\.1\.4/i.test(issue));
      return report;
    };
    wrapped.__eaNormalizedSocketVersion = true;
    E.compat.diagnose = wrapped;
  }

  // Older workflow files expect EA.commit; keep it as one canonical state
  // writer and always normalize the state before persisting it.
  if (typeof E.commit !== "function" && typeof E.saveState === "function") E.commit = state => E.saveState(E.normalizeState(state));

  // Make the gather control actionable after ApplicationV2 replaces its panel.
  // Validation remains in the action handler; this only removes stale DOM state.
  const syncGatherButton = root => {
    const button = root?.querySelector?.('[data-action="gather-start"]');
    if (!button || button.dataset.gathering === "true") return;
    button.disabled = false;
    button.removeAttribute("disabled");
    button.removeAttribute("aria-disabled");
    button.style.pointerEvents = "auto";
  };
  const observe = app => {
    if (!app?.element || app.__eaRuntimeGatherObserver) return;
    app.__eaRuntimeGatherObserver = new MutationObserver(() => syncGatherButton(app.element));
    app.__eaRuntimeGatherObserver.observe(app.element, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "aria-disabled"] });
    syncGatherButton(app.element);
  };
  if (typeof E.openPlayerAppV2 === "function" && !E.openPlayerAppV2.__eaRuntimeFixes) {
    const open = E.openPlayerAppV2;
    const wrappedOpen = (...args) => {
      const app = open(...args);
      observe(app);
      return app;
    };
    wrappedOpen.__eaRuntimeFixes = true;
    E.openPlayerAppV2 = wrappedOpen;
  }

  // Resolve an output item from the world or module compendia before falling
  // back to the module's stock potion artwork. This is important for recipes
  // whose output belongs to another module.
  const normalize = value => String(value ?? "").trim().replace(/<[^>]*>/g, "").replace(/\s+/g, " ").toLocaleLowerCase();
  const validImage = value => /^(https?:|data:|icons\/|modules\/|worlds\/|systems\/)/i.test(String(value ?? "").trim());
  const directOutput = recipe => recipe?.output?.uuid || recipe?.output?.itemUuid || recipe?.output?.sourceUuid || recipe?.output?.img || recipe?.output?.image || recipe?.img || recipe?.image;
  const outputName = recipe => normalize(recipe?.output?.itemName || recipe?.name);
  const externalImage = async recipe => {
    const direct = directOutput(recipe);
    if (typeof direct === "string" && direct.includes("." ) && validImage(direct)) return direct;
    const name = outputName(recipe);
    if (!name) return "";
    const worldItem = game.items?.find(item => normalize(item.name) === name && validImage(item.img));
    if (worldItem?.img) return worldItem.img;
    for (const pack of game.packs || []) {
      if (pack.documentName !== "Item") continue;
      const index = await pack.getIndex({ fields: ["name", "img"] });
      const entry = index.find(item => normalize(item.name) === name && validImage(item.img));
      if (entry?.img) return entry.img;
    }
    return "";
  };
  const oldImageResolver = E.resolveApplicationV2RecipeImage;
  if (typeof oldImageResolver === "function" && !oldImageResolver.__eaExternalFirst) {
    const resolver = async recipe => {
      const external = await externalImage(recipe);
      if (external) return external;
      return oldImageResolver(recipe);
    };
    resolver.__eaExternalFirst = true;
    E.resolveApplicationV2RecipeImage = resolver;
  }

  // Prevent one request from creating the output twice when an older action
  // binding and the final ApplicationV2 binding both fire the same request.
  if (typeof E.resolveBrew === "function" && !E.resolveBrew.__eaRequestDedup) {
    const resolveBrew = E.resolveBrew;
    const pending = new Map();
    const guarded = request => {
      const id = String(request?.requestId || "");
      if (!id) return resolveBrew(request);
      const key = `${request?.userId || ""}:${id}`;
      if (pending.has(key)) return pending.get(key);
      const promise = Promise.resolve().then(() => resolveBrew(request));
      pending.set(key, promise);
      promise.finally(() => setTimeout(() => pending.delete(key), 1000));
      return promise;
    };
    guarded.__eaRequestDedup = true;
    E.resolveBrew = guarded;
  }

  console.info(`${E.id} | Runtime compatibility fixes registered.`);
})();
