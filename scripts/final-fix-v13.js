/* Final authority and UI fixes for Foundry VTT 13.351. Loaded last. */
(() => {
  const E = globalThis.EA;
  if (!E) return;
  const CHANNEL = `module.${E.id}`;
  const originalState = E.state.bind(E);
  E.state = () => {
    const s = originalState() || {};
    s.groupStock = Array.isArray(s.groupStock) ? s.groupStock : [];
    s.groupKnowledge = s.groupKnowledge && typeof s.groupKnowledge === "object" && !Array.isArray(s.groupKnowledge) ? s.groupKnowledge : {};
    s.recipes = Array.isArray(s.recipes) ? s.recipes : [];
    s.history = Array.isArray(s.history) ? s.history : [];
    s.allowedHerbs = Array.isArray(s.allowedHerbs) ? s.allowedHerbs : [];
    s.actors = Array.isArray(s.actors) ? s.actors : [];
    s.goals = Array.isArray(s.goals) ? s.goals : [];
    s.gatherDC = Math.max(1, Number(s.gatherDC) || 10);
    return s;
  };
  E._finalSockets ??= true;
  if (E._finalSockets) {
    Hooks.once("ready", () => game.socket.on(CHANNEL, async data => {
      if (data.action === "ea-final-result" && data.userId === game.user.id) {
        if (data.error) ui.notifications.error(data.error);
        else if (data.kind === "gather") ui.notifications.info(data.success ? `Найдена трава: ${data.name}.` : "Сбор не удался. Попытка записана в историю.");
        else if (data.kind === "research") new Dialog({title:"Исследование",content:`<p>Открыт аспект: <b>${E.esc(E.aspectName(data.key))}: ${data.value}</b>.</p>`,buttons:{ok:{label:"Понятно"}}}).render(true);
        Hooks.callAll("eaStockChanged");
        return;
      }
      if (!game.user.isGM || !["ea-final-gather","ea-final-research"].includes(data.action)) return;
      try {
        const s = E.state();
        if (data.action === "ea-final-gather") {
          const actor = game.actors.get(data.actorId), user = game.users.get(data.userId);
          if (!actor || !user || !s.actors.includes(actor.id) || !actor.testUserPermission(user, "OWNER")) throw Error("У вас нет прав на этого персонажа.");
          const success = Number(data.total) >= s.gatherDC;
          s.history.unshift({id:foundry.utils.randomID(),date:new Date().toLocaleString(),actor:actor.name,area:s.territory,goals:data.goals || [],total:Number(data.total),success,result:success ? "Успех" : "Провал"});
          let name;
          if (success) {
            const herb = await E.randomLibraryHerb(s.territory, data.goals || []);
            if (!herb) throw Error("Нет разрешённой травы для выбранных условий.");
            await E._add(herb, 1); name = herb.name;
          } else await E.save(s);
          game.socket.emit(CHANNEL,{action:"ea-final-result",userId:data.userId,kind:"gather",success,name});
        } else {
          const item = s.groupStock.find(x => x.id === data.id), qty = Math.max(1, Number(data.qty) || 1);
          if (!item || item.quantity < qty) throw Error("На общем складе недостаточно травы.");
          const known = {...(s.groupKnowledge[item.seedId] || {}), ...(item.knownAspects || {})};
          const unknown = Object.entries(item.aspects || {}).filter(([k]) => !Object.hasOwn(known,k));
          if (!unknown.length) throw Error("Все аспекты этой травы уже известны.");
          const [key,value] = unknown[Math.floor(Math.random()*unknown.length)];
          known[key]=value; s.groupKnowledge[item.seedId]=known; item.knownAspects=known; item.quantity-=qty;
          if (item.quantity < 1) s.groupStock=s.groupStock.filter(x=>x.id!==item.id);
          await E.save(s);
          game.socket.emit(CHANNEL,{action:"ea-final-result",userId:data.userId,kind:"research",key,value});
        }
        game.socket.emit(CHANNEL,{action:"ea-final-result",userId:"*",kind:"changed"});
        Hooks.callAll("eaStockChanged");
      } catch (error) { game.socket.emit(CHANNEL,{action:"ea-final-result",userId:data.userId,error:error.message}); }
    }));
  }
  E.collect = async (root, fallback) => {
    const actor=E.actor(root,fallback); if(!actor)return ui.notifications.warn("Не выбран персонаж.");
    if(!game.user.isGM && (!E.state().actors.includes(actor.id) || !actor.testUserPermission(game.user,"OWNER"))) return ui.notifications.warn("У вас нет прав на этого персонажа.");
    const mod=Number(actor.system.skills?.sur?.mod ?? actor.system.abilities?.wis?.mod ?? 0), goals=E.goals(root);
    const roll=await new Roll("1d20 + @mod",{mod}).evaluate({async:true});
    await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:`Поиск алхимического сырья: ${E.goalText(goals)}`});
    const data={action:"ea-final-gather",userId:game.user.id,actorId:actor.id,goals,total:roll.total};
    if(game.user.isGM) {
      const s=E.state(),success=roll.total>=s.gatherDC;
      s.history.unshift({id:foundry.utils.randomID(),date:new Date().toLocaleString(),actor:actor.name,area:s.territory,goals,total:roll.total,success,result:success?"Успех":"Провал"});
      if(success){const herb=await E.randomLibraryHerb(s.territory,goals);if(!herb)return ui.notifications.warn("Нет разрешённой травы для выбранных условий.");await E._add(herb,1);ui.notifications.info(`Найдена трава: ${herb.name}.`);}else await E.save(s);
      Hooks.callAll("eaStockChanged"); return;
    }
    game.socket.emit(CHANNEL,data); ui.notifications.info("Результат сбора отправлен мастеру.");
  };
  E.experiments = () => new Dialog({title:"Алхимия — изготовление",content:`<section class="ea-panel"><p>Исследование тратит выбранное количество одной травы и открывает один неизвестный аспект.</p><div id="ea-final-items"></div><div class="ea-actions"><button data-final="research">Исследовать свойства</button><button data-final="compatible">Проверить совместимость</button></div></section>`,buttons:{close:{label:"Закрыть"}},render:html=>{
    const r=html[0]??html;
    const fill=()=>r.querySelector("#ea-final-items").innerHTML=E.state().groupStock.map(x=>`<label class="ea-check"><input name="ea-final-item" type="checkbox" value="${x.id}">${E.esc(x.name)} × ${x.quantity}<input data-final-qty="${x.id}" type="number" min="1" max="${x.quantity}" value="1"></label>`).join("")||"<p>Склад пуст.</p>";
    fill(); Hooks.on("eaStockChanged",fill);
    r.querySelectorAll("[data-final]").forEach(button=>button.onclick=async()=>{
      const chosen=Array.from(r.querySelectorAll("input[name=ea-final-item]:checked")).map(i=>({id:i.value,qty:Math.max(1,Number(r.querySelector(`[data-final-qty='${i.value}']`).value)||1)}));
      if(!chosen.length)return ui.notifications.warn("Выберите траву.");
      if(button.dataset.final==="research"){
        if(chosen.length!==1)return ui.notifications.warn("Для исследования выберите ровно одну траву.");
        if(game.user.isGM){const out=await E._reveal(chosen[0].id,chosen[0].qty);new Dialog({title:"Исследование",content:`<p>Открыт аспект: <b>${E.esc(E.aspectName(out.key))}: ${out.value}</b>.</p>`,buttons:{ok:{label:"Понятно"}}}).render(true);Hooks.callAll("eaStockChanged");}
        else game.socket.emit(CHANNEL,{action:"ea-final-research",userId:game.user.id,...chosen[0]});
        return;
      }
      const s=E.state(),total={};
      for(const choice of chosen){const item=s.groupStock.find(x=>x.id===choice.id);if(!item)continue;for(const [key,value] of Object.entries(s.groupKnowledge[item.seedId]||item.knownAspects||{}))total[key]=(total[key]||0)+Number(value)*choice.qty;}
      const recipes=s.recipes.filter(recipe=>game.user.isGM||recipe.playersKnow!==false).filter(recipe=>Object.entries(recipe.need||{}).every(([key,value])=>(total[key]||0)>=Number(value)));
      new Dialog({title:"Подходящие рецепты",content:`<p>Известные аспекты: <b>${E.esc(E.aspectText(total))}</b>.</p>${recipes.length?`<ul>${recipes.map(recipe=>`<li><b>${E.esc(recipe.name)}</b> — ${E.esc(E.aspectText(recipe.need))}</li>`).join("")}</ul>`:"<p>Подходящих рецептов нет.</p>"}`,buttons:{ok:{label:"Понятно"}}).render(true);
    });
  }}).render(true);
  E.recipes = () => {
    if(!game.user.isGM)return ui.notifications.warn("Рецепты доступны только мастеру.");
    const list=()=>E.state().recipes.map(recipe=>`<li data-recipe="${recipe.id}"><b>${E.esc(recipe.name)}</b> — ${E.esc(E.aspectText(recipe.need))}; СЛ ${recipe.dc}; ${E.esc(recipe.formula||"")}<label class="ea-check ea-recipe-known"><input class="ea-final-known" data-id="${recipe.id}" type="checkbox"${recipe.playersKnow!==false?" checked":""}> Известен игрокам</label><button class="ea-final-delete" data-id="${recipe.id}">Удалить</button></li>`).join("")||"<li>Рецептов пока нет.</li>";
    const dialog=new Dialog({title:"Алхимия — рецепты",content:`<section class="ea-panel"><ul>${list()}</ul><hr><label>Название<input id="ea-final-name"></label><div id="ea-final-req">${E.recipeRequirementRow("Vita",2)}${E.recipeRequirementRow("Herba",1)}</div><button id="ea-final-add-req" type="button">Добавить аспект</button><label>СЛ<input id="ea-final-dc" type="number" min="1" value="10"></label><label>Эффект<input id="ea-final-formula" value="2d4 + 2"></label><label class="ea-check"><input id="ea-final-known" type="checkbox" checked>Рецепт известен игрокам</label><button id="ea-final-add" type="button">Добавить рецепт</button></section>`,buttons:{close:{label:"Закрыть"}},render:html=>{
      const r=html[0]??html, bind=row=>row.querySelector(".ea-remove-req").onclick=()=>row.remove();r.querySelectorAll(".ea-requirement").forEach(bind);
      r.querySelector("#ea-final-add-req").onclick=()=>{r.querySelector("#ea-final-req").insertAdjacentHTML("beforeend",E.recipeRequirementRow());bind(r.querySelector("#ea-final-req").lastElementChild);};
      r.querySelectorAll(".ea-final-known").forEach(box=>box.onchange=async()=>{const s=E.state(),recipe=s.recipes.find(x=>x.id===box.dataset.id);if(recipe){recipe.playersKnow=box.checked;await E.save(s);}});
      r.querySelectorAll(".ea-final-delete").forEach(button=>button.onclick=async()=>{const s=E.state();s.recipes=s.recipes.filter(x=>x.id!==button.dataset.id);await E.save(s);dialog.close();E.recipes();});
      r.querySelector("#ea-final-add").onclick=async()=>{const need={};r.querySelectorAll(".ea-requirement").forEach(row=>{const key=row.querySelector(".ea-req-aspect").value,value=Math.max(1,Number(row.querySelector(".ea-req-amount").value)||1);need[key]=(need[key]||0)+value;});const s=E.state();s.recipes.push({id:foundry.utils.randomID(),name:r.querySelector("#ea-final-name").value.trim()||"Новый рецепт",need,dc:Math.max(1,Number(r.querySelector("#ea-final-dc").value)||10),formula:r.querySelector("#ea-final-formula").value.trim(),playersKnow:r.querySelector("#ea-final-known").checked});await E.save(s);dialog.close();E.recipes();};
    }});dialog.render(true);
  };
})();
