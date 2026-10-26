/* Inline player workspace actions for Foundry VTT 13. */
(()=>{
  const EA=globalThis.EA;
  if(!EA)return;
  const sections=[
    {id:"recipes",label:"Рецепты",icon:"✦"},
    {id:"gather",label:"Сбор",icon:"❖"},
    {id:"stock",label:"Склад",icon:"▤"},
    {id:"crafting",label:"Изготовление",icon:"⚗"}
  ];
  const esc=EA.esc;
  const signed=n=>`${n>=0?"+":""}${n}`;
  const selectedKey=()=>`${EA.id}.selected-actor.${game.user?.id??"unknown"}`;
  const getSelectedId=()=>{try{return localStorage.getItem(selectedKey())||""}catch{return ""}};
  const selectedActor=actors=>actors.find(a=>a.id===getSelectedId())||actors[0];
  const herbImage=herb=>herb?.image?EA.herbImagePath(herb.image):(herb?.img||"icons/svg/item-bag.svg");
  const recipeImage=recipe=>{
    const name=String(recipe?.output?.itemName||recipe?.name||"").trim().toLocaleLowerCase();
    for(const pack of game.packs||[]){
      const entry=pack.index?.find(x=>String(x.name).trim().toLocaleLowerCase()===name);
      if(entry?.img)return entry.img;
    }
    return "icons/consumables/potions/bottle-round-corked-red.webp";
  };
  const eligibleActors=()=>EA.actors(EA.getState()).filter(a=>EA.canActor(game.user,a,EA.getState()));
  const rosterCard=a=>`<button type="button" class="ea-player-card${a.id===getSelectedId()?" is-selected":""}" data-actor="${esc(a.id)}" aria-pressed="${a.id===getSelectedId()}"><img src="${esc(a.prototypeToken?.texture?.src||a.img||"icons/svg/mystery-man.svg")}" alt=""><span class="ea-player-info"><b>${esc(a.name)}</b><span>Выживание ${signed(Number(a.system?.skills?.sur?.mod??a.system?.abilities?.wis?.mod??0))}</span><span>Набор травника ${signed(EA.herbalismBonus?.(a)||0)}</span><span>Алхимик / отравитель ${signed(EA.alchemyBonus?.(a)||0)}</span></span></button>`;
  const visibleRecipes=()=>EA.getState().recipes.filter(r=>game.user.isGM||r.playersKnow!==false);
  const pageCount=items=>Math.max(1,Math.ceil(items.length/4));
  const pageInfo=(page,pages,total)=>`<div class="ea-page-info">${total?`${page*4+1}–${Math.min((page+1)*4,total)} из ${total}`:"Нет рецептов"} · страница ${Math.min(page+1,pages)} из ${pages}</div>`;
  const recipeCard=(r,interactive=false)=>`<article class="ea-recipe-card"><img class="ea-recipe-thumb" src="${esc(recipeImage(r))}" alt="" onerror="this.onerror=null;this.src='icons/consumables/potions/bottle-round-corked-red.webp'"><div class="ea-recipe-card-body"><h3>${esc(r.name)}</h3><p class="ea-recipe-requirements">${esc(EA.aspectText(r.requirements))}</p>${r.description?`<p class="ea-recipe-description">${esc(r.description)}</p>`:""}${game.user.isGM?`<small class="ea-recipe-dc">СЛ ${Number(r.brewDC)||10}</small>`:""}${interactive?`<button type="button" class="ea-recipe-brew" data-inline-brew="${esc(r.id)}">Изготовить</button>`:""}</div></article>`;
  const recipeGrid=(recipes,page=0,interactive=false)=>{
    const pages=pageCount(recipes),safe=Math.max(0,Math.min(page,pages-1)),cards=recipes.slice(safe*4,safe*4+4).map(r=>recipeCard(r,interactive)).join("");
    return `<div class="ea-recipe-grid-head"><span>${interactive?"Подходящие рецепты":"Известные рецепты"}</span>${pageInfo(safe,pages,recipes.length)}</div><div class="ea-recipe-grid">${cards||"<p class=\"ea-empty\">Подходящих рецептов нет.</p>"}</div><nav class="ea-recipe-pagination" aria-label="Навигация по рецептам"><button type="button" data-recipe-page="${safe-1}" ${safe<=0?"disabled":""}>◀ Назад</button><span>${safe+1} / ${pages}</span><button type="button" data-recipe-page="${safe+1}" ${safe>=pages-1?"disabled":""}>Вперёд ▶</button></nav>`;
  };
  const renderGather=()=>{
    const actor=selectedActor(eligibleActors()),s=EA.getState();
    return `<h2>Сбор</h2><p>Территория: <b>${esc(s.configuration.activeTerritory||"не выбрана")}</b></p>${actor?`<p>Персонаж: <b>${esc(actor.name)}</b> · Выживание ${signed(Number(actor.system?.skills?.sur?.mod??actor.system?.abilities?.wis?.mod??0))} · инструменты травника ${signed(EA.herbalismBonus?.(actor)||0)}</p>`:"<p>Нет доступного персонажа.</p>"}<div class="ea-inline-types">${EA.goalChecks([])}</div><button type="button" class="ea-section-action" id="ea-inline-gather" ${actor?"":"disabled"}>Начать сбор</button><p id="ea-inline-result" class="ea-inline-result" aria-live="polite"></p>`;
  };
  const renderStock=()=>{
    const s=EA.getState(),rows=s.group.stock.map(x=>{const herb=EA.herb(x.ingredientId),known=s.group.knownAspects[x.ingredientId]||{};return `<li><img class="ea-herb-thumb" src="${esc(herbImage(herb)||x.img)}" alt="" onerror="this.onerror=null;this.src='icons/svg/item-bag.svg'"><b>${esc(x.name||herb?.name||x.ingredientId)}</b><span>× ${Number(x.quantity)||0}</span><small>Известные аспекты: ${esc(EA.aspectText(known)||"не исследованы")}</small></li>`}).join("");
    return `<h2>Склад</h2><ul class="ea-summary-list ea-inline-stock">${rows||"<li>Склад пока пуст.</li>"}</ul>`;
  };
  const renderRecipes=view=>`<h2>Рецепты</h2>${recipeGrid(visibleRecipes(),view.recipePage,false)}`;
  const renderCrafting=()=>{
    const s=EA.getState(),actor=selectedActor(eligibleActors());
    const cards=s.group.stock.map(x=>{const herb=EA.herb(x.ingredientId),qty=Math.max(1,Number(x.quantity)||1);return `<label class="ea-craft-card"><img class="ea-herb-thumb" src="${esc(herbImage(herb)||x.img)}" alt="" onerror="this.onerror=null;this.src='icons/svg/item-bag.svg'"><span><input type="checkbox" name="ea-inline-ing" value="${esc(x.ingredientId)}">${esc(x.name||herb?.name||x.ingredientId)}<small>На складе: ${qty}</small></span><input type="number" min="1" max="${qty}" value="1" data-inline-q="${esc(x.ingredientId)}"></label>`}).join("");
    return `<h2>Изготовление</h2>${actor?`<p>Алхимик: <b>${esc(actor.name)}</b> · Интеллект ${signed(Number(actor.system?.abilities?.int?.mod||0))} · набор ${signed(EA.alchemyBonus?.(actor)||0)}</p>`:"<p>Нет доступного персонажа.</p>"}<p>Выберите ингредиенты и количество:</p><div class="ea-inline-ingredients">${cards||"<p>Склад пуст.</p>"}</div><div id="ea-inline-candidates" aria-live="polite"></div><button type="button" class="ea-section-action" id="ea-inline-check" ${actor&&s.group.stock.length?"":"disabled"}>Проверить возможные рецепты</button>`;
  };
  const renderSection=(id,view)=>id==="gather"?renderGather():id==="stock"?renderStock():id==="recipes"?renderRecipes(view):renderCrafting();
  const bindGather=mark=>{const start=mark.querySelector("#ea-inline-gather");if(!start)return;start.onclick=async()=>{start.disabled=true;const result=mark.querySelector("#ea-inline-result");try{const actor=selectedActor(eligibleActors());if(!actor)throw Error("Нет доступного персонажа.");const goals=EA.selectedGoals(mark),mod=Number(actor.system?.skills?.sur?.mod??actor.system?.abilities?.wis?.mod??0),tool=Number(EA.herbalismBonus?.(actor)||0),roll=await new Roll("1d20 + @mod + @tool",{mod,tool}).evaluate();await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:"Сбор алхимического сырья"});result.textContent="Бросок выполнен. Ожидаем результат…";const response=await EA.request({type:"gather",actorId:actor.id,goals,total:roll.total});if(response?.message)result.textContent=response.message;Hooks.callAll("eaStockChanged")}catch(error){result.textContent=error.message||String(error)}finally{start.disabled=false}}};
  const bindRecipePaging=(root,view,id)=>root.querySelectorAll("[data-recipe-page]").forEach(button=>button.onclick=()=>{view.recipePage=Math.max(0,Number(button.dataset.recipePage)||0);const mark=root.querySelector(".ea-center-mark");mark.innerHTML=renderSection(id,view);bindSection(mark,id,view,root)});
  const bindCandidatePaging=(out,root,view,recipes,list,actor)=>out.querySelectorAll("[data-recipe-page]").forEach(button=>button.onclick=()=>{view.candidatePage=Math.max(0,Number(button.dataset.recipePage)||0);mountCandidates(root,view,recipes,list,actor)});
  const mountCandidates=(root,view,recipes,list,actor)=>{const out=root.querySelector("#ea-inline-candidates");if(!out)return;out.innerHTML=recipeGrid(recipes,view.candidatePage,true);bindCandidatePaging(out,root,view,recipes,list,actor);out.querySelectorAll("[data-inline-brew]").forEach(button=>button.onclick=async()=>{button.disabled=true;try{const mod=Number(actor.system?.abilities?.int?.mod||0),tool=Number(EA.alchemyBonus?.(actor)||0),roll=await new Roll("1d20 + @mod + @tool",{mod,tool}).evaluate();await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:"Изготовление алхимического состава"});const response=await EA.request({type:"brew",actorId:actor.id,recipeId:button.dataset.inlineBrew,ingredients:list,total:roll.total});if(response?.message)ui.notifications.info(response.message);Hooks.callAll("eaStockChanged")}catch(error){ui.notifications.error(error.message||String(error))}finally{button.disabled=false}})};
  const bindCrafting=(mark,view,root)=>{const button=mark.querySelector("#ea-inline-check");if(!button)return;button.onclick=()=>{const list=Array.from(mark.querySelectorAll("[name='ea-inline-ing']:checked")).map(input=>({ingredientId:input.value,quantity:Math.max(1,Math.floor(Number(mark.querySelector(`[data-inline-q='${CSS.escape(input.value)}']`)?.value)||1))}));if(!list.length)return ui.notifications.warn("Выберите хотя бы одну траву.");const actor=selectedActor(eligibleActors());if(!actor)return ui.notifications.warn("Нет доступного персонажа.");const recipes=visibleRecipes().filter(r=>EA.matches(r,EA.total(EA.getState(),list)));view.candidatePage=0;mountCandidates(root,view,recipes,list,actor)};};
  const bindSection=(mark,id,view,root)=>{if(id==="gather")bindGather(mark);if(id==="crafting")bindCrafting(mark,view,root);if(id==="recipes")bindRecipePaging(root,view,id)};
  EA.hub=()=>{
    const s=EA.getState();
    const actors=(s.configuration.actorIds||[]).map(id=>game.actors.get(id)).filter(actor=>actor&&(game.user.isGM||actor.testUserPermission(game.user,"OWNER"))).slice(0,6);
    const roster=actors.length?actors.map(rosterCard).join(""):`<div class="ea-roster-empty">${game.user.isGM?"Назначьте персонажей в настройках алхимии":"Персонаж не назначен ГМ"}</div>`;
    const buttons=sections.map(x=>`<button type="button" class="ea-nav ea-nav-${x.id}" data-panel="${x.id}"><span class="ea-nav-icon">${x.icon}</span><span>${x.label}</span></button>`).join("");
    const html=`<main class="ea-main-ui"><header class="ea-roster">${roster}</header><p class="ea-roster-hint">Выберите персонажа и раздел.</p><section class="ea-workspace"><div class="ea-center-mark"><span>⚗</span><b>Алхимия</b><small>Выберите раздел</small></div>${buttons}</section></main>`;
    const view={recipePage:0,candidatePage:0};
    const dialog=new Dialog({title:"Алхимия",content:html,buttons:{close:{label:"Закрыть"}},render:jq=>{
      const root=jq[0]||jq;
      root.querySelectorAll(".ea-player-card").forEach(button=>button.onclick=()=>{try{localStorage.setItem(selectedKey(),button.dataset.actor)}catch{}root.querySelectorAll(".ea-player-card").forEach(card=>{card.classList.toggle("is-selected",card===button);card.setAttribute("aria-pressed",String(card===button))})});
      root.querySelectorAll(".ea-nav").forEach(button=>button.onclick=()=>{const id=button.dataset.panel;root.querySelectorAll(".ea-nav").forEach(nav=>nav.classList.toggle("is-active",nav===button));const mark=root.querySelector(".ea-center-mark");view.recipePage=0;view.candidatePage=0;mark.innerHTML=renderSection(id,view);mark.classList.add("ea-center-active");bindSection(mark,id,view,root)});
      root.querySelectorAll(".ea-player-card img").forEach(img=>img.onerror=()=>{img.src="icons/svg/mystery-man.svg"});
    }});
    dialog.options.width=1200;dialog.options.height="auto";dialog.render(true);
  };
})();
