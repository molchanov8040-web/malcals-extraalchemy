

/* GM editor for structured herb data. Overrides are world data, separate from display HTML. */
EA.baseHerbSeeds=EA.herbSeeds;
EA.herbSeeds=()=>{
  const base=EA.baseHerbSeeds();
  let overrides={};
  try{overrides=game.settings.get(EA.id,"herbOverrides")||{}}catch{}
  return base.map(seed=>({...seed,...(overrides[seed.ingredientId]||{}),aspects:{...seed.aspects,...(overrides[seed.ingredientId]?.aspects||{})},regions:Array.isArray(overrides[seed.ingredientId]?.regions)?overrides[seed.ingredientId].regions:seed.regions,types:Array.isArray(overrides[seed.ingredientId]?.types)?overrides[seed.ingredientId].types:seed.types,goals:Array.isArray(overrides[seed.ingredientId]?.types)?overrides[seed.ingredientId].types:seed.types}));
};
Hooks.once("init",()=>game.settings.register(EA.id,"herbOverrides",{scope:"world",config:false,type:Object,default:{}}));
EA.openLibrary=()=>{
  if(!game.user.isGM)return ui.notifications.warn("Библиотека доступна только мастеру.");
  const draw=()=>{
    const seeds=EA.herbSeeds(),types=EA.goals;
    const rows=seeds.map(h=>`<details class="ea-herb-edit"><summary>${EA.esc(h.name)}</summary><div class="ea-herb-edit-fields"><label>Аспекты (код:значение, через запятую)<input data-aspects="${EA.esc(h.ingredientId)}" value="${EA.esc(Object.entries(h.aspects).map(([k,v])=>`${k}:${v}`).join(", "))}"></label><label>Местности, через запятую<input data-regions="${EA.esc(h.ingredientId)}" value="${EA.esc(h.regions.join(", "))}"></label><fieldset><legend>Типы</legend>${types.map(([id,label])=>`<label class="ea-check"><input type="checkbox" data-type="${EA.esc(h.ingredientId)}" value="${id}"${h.types.includes(id)?" checked":""}>${EA.esc(label)}</label>`).join("")}</fieldset><button type="button" data-save-herb="${EA.esc(h.ingredientId)}">Сохранить</button></div></details>`).join("");
    new Dialog({title:"Библиотека трав — редактирование",content:`<section class="ea-panel"><p>Аспекты и местности сохраняются в данных мира и используются логикой сбора и исследования.</p>${rows}</section>`,buttons:{close:{label:"Закрыть"}},render:html=>{const root=html[0]??html;root.querySelectorAll("[data-save-herb]").forEach(button=>button.onclick=async()=>{
      const key=button.dataset.saveHerb,aspectInput=root.querySelector(`[data-aspects="${CSS.escape(key)}"]`),regionInput=root.querySelector(`[data-regions="${CSS.escape(key)}"]`),aspects={};
      for(const part of aspectInput.value.split(",")){const [name,value]=part.trim().split(":").map(x=>x.trim());if(!name)continue;const n=Number(value);if(!Object.hasOwn(EA.aspects,name)||!Number.isFinite(n)||n<=0){ui.notifications.warn(`Некорректный аспект: ${part}`);return}aspects[name]=n}
      const regions=regionInput.value.split(",").map(x=>x.trim()).filter(Boolean);if(!Object.keys(aspects).length||!regions.length){ui.notifications.warn("Укажите хотя бы один аспект и одну местность.");return}
      const selected=[...root.querySelectorAll(`[data-type="${CSS.escape(key)}"]:checked`)].map(x=>x.value);if(!selected.length){ui.notifications.warn("Выберите хотя бы один тип травы.");return}
      const all=game.settings.get(EA.id,"herbOverrides")||{};all[key]={aspects,regions,types:selected};await game.settings.set(EA.id,"herbOverrides",all);
      try{const pack=game.packs.get(EA.libraryPackId),doc=pack&&(await pack.getDocuments()).find(x=>(EA.herbFlag(x)?.ingredientId??EA.herbFlag(x)?.seedId)===key);if(doc){await pack.configure({locked:false});await doc.update({"flags.malcals-extraalchemy.library-herb.aspects":aspects,"flags.malcals-extraalchemy.library-herb.regions":regions,"flags.malcals-extraalchemy.library-herb.types":selected,"system.description.value":`<p>${EA.esc(doc.flags[EA.id]["library-herb"].description)}</p><p><b>Типы:</b> ${selected.map(id=>EA.goals.find(x=>x[0]===id)?.[1]||id).map(EA.esc).join(", ")}</p><p><b>Местности:</b> ${regions.map(EA.esc).join(", ")}</p><p><b>Аспекты:</b> ${Object.entries(aspects).map(([a,v])=>`${EA.esc(EA.aspects[a]||a)}: ${v}`).join(", ")}</p>`});await pack.configure({locked:true})}}catch(error){console.warn(`${EA.id} | Could not mirror herb edits to compendium`,error)}
      ui.notifications.info(`${EA.herb(key)?.name||key}: данные сохранены.`);draw();
    })}}).render(true);
  };draw();
};
