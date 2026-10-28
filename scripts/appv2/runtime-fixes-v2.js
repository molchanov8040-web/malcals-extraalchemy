/* Runtime fixes for the 0.8.9 cross-version test build. */
(() => {
  const E = globalThis.EA;
  if (!E) return;
  if (E.compat?.diagnose && !E.compat.diagnose.__eaNormalizedSocketVersion) {
    const diagnose = E.compat.diagnose;
    const normalized = value => String(value ?? "").trim().replace(/^v/i, "");
    const wrapped = () => {
      const report = diagnose();
      report.socketVersion = normalized(report.socketVersion);
      report.issues = (report.issues || []).filter(issue => !/Expected tested Socketlib 1\\.1\\.4; detected v?1\\.1\\.4/i.test(issue));
      return report;
    };
    wrapped.__eaNormalizedSocketVersion = true;
    E.compat.diagnose = wrapped;
  }
  if (typeof E.commit !== "function" && typeof E.saveState === "function") E.commit = state => E.saveState(E.normalizeState(state));
  const syncGatherButton = root => { const button = root?.querySelector?.('[data-action="gather-start"]'); if (!button || button.dataset.gathering === "true") return; button.disabled = false; button.removeAttribute("disabled"); button.removeAttribute("aria-disabled"); button.style.pointerEvents = "auto"; };
  const observe = app => { if (!app?.element || app.__eaRuntimeGatherObserver) return; app.__eaRuntimeGatherObserver = new MutationObserver(() => syncGatherButton(app.element)); app.__eaRuntimeGatherObserver.observe(app.element,{childList:true,subtree:true,attributes:true,attributeFilter:["disabled","aria-disabled"]}); syncGatherButton(app.element); };
  if (typeof E.openPlayerAppV2 === "function" && !E.openPlayerAppV2.__eaRuntimeFixes) { const open=E.openPlayerAppV2; const wrappedOpen=(...args)=>{const app=open(...args);observe(app);return app};wrappedOpen.__eaRuntimeFixes=true;E.openPlayerAppV2=wrappedOpen; }
  const normalize = value => String(value ?? "").trim().replace(/<[^>]*>/g, "").replace(/\s+/g, " ").toLocaleLowerCase();
  const validImage = value => /^(https?:|data:|icons\/|modules\/|worlds\/|systems\/)/i.test(String(value ?? "").trim());
  const directOutput = recipe => recipe?.output?.uuid || recipe?.output?.itemUuid || recipe?.output?.sourceUuid;
  const outputName = recipe => normalize(recipe?.output?.itemName || recipe?.name);
  const externalImage = async recipe => {
    const direct = directOutput(recipe);
    if (direct && typeof fromUuid === "function") { try { const document = await fromUuid(direct); if (validImage(document?.img)) return document.img; } catch {} }
    const name = outputName(recipe);
    if (!name) return "";
    const worldItem = game.items?.find(item => normalize(item.name) === name && validImage(item.img));
    if (worldItem?.img) return worldItem.img;
    for (const pack of game.packs || []) { if (pack.documentName !== "Item") continue; const index = await pack.getIndex({fields:["name","img"]}); const entry=index.find(item=>normalize(item.name)===name&&validImage(item.img)); if(entry?.img)return entry.img; }
    return "";
  };
  const oldImageResolver = E.resolveApplicationV2RecipeImage;
  if (typeof oldImageResolver === "function" && !oldImageResolver.__eaExternalFirst) { const resolver=async recipe=>{const external=await externalImage(recipe);if(external)return external;return oldImageResolver(recipe)};resolver.__eaExternalFirst=true;E.resolveApplicationV2RecipeImage=resolver; }
  if (typeof E.resolveBrew === "function" && !E.resolveBrew.__eaRequestDedup) { const resolveBrew=E.resolveBrew,pending=new Map();const guarded=request=>{const id=String(request?.requestId||"");if(!id)return resolveBrew(request);const key=`${request?.userId||""}:${id}`;if(pending.has(key))return pending.get(key);const promise=Promise.resolve().then(()=>resolveBrew(request));pending.set(key,promise);promise.then(()=>setTimeout(()=>pending.delete(key),1000),()=>setTimeout(()=>pending.delete(key),1000));return promise};guarded.__eaRequestDedup=true;E.resolveBrew=guarded; }
  console.info(`${E.id} | Runtime compatibility fixes registered.`);
})();
