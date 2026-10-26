/* Responsive player-facing launcher for Foundry VTT 13. */
(()=>{
const EA=globalThis.EA;if(!EA)return;
const esc=EA.esc;
const selectedKey=`${EA.id}.selected-actor.${game.user.id}`;
const selectedId=()=>{try{return localStorage.getItem(selectedKey)||""}catch{return ""}};
const setSelected=id=>{try{localStorage.setItem(selectedKey,id)}catch{}}
const baseActors=EA.actors;
// Keep the last selected character first in legacy action dialogs, which use the first actor as default.
EA.actors=state=>{const list=baseActors(state);const id=selectedId();return id?[...list.filter(a=>a.id===id),...list.filter(a=>a.id!==id)]:list};
const skillMod=a=>Number(a?.system?.skills?.sur?.mod??a?.system?.abilities?.wis?.mod??0);
const actorImage=a=>a?.prototypeToken?.texture?.src||a?.img||"icons/svg/mystery-man.svg";
const signed=n=>`${n>=0?"+":""}${n}`;
const card=a=>{const herb=EA.herbalismBonus?.(a)||0,alchemy=EA.alchemyBonus?.(a)||0,selected=a.id===selectedId();return `<button type="button" class="ea-player-card${selected?" is-selected":""}" data-actor="${esc(a.id)}" aria-pressed="${selected}" title="Выбрать ${esc(a.name)}"><img src="${esc(actorImage(a))}" alt=""><span class="ea-player-info"><b>${esc(a.name)}</b><span>Выживание ${signed(skillMod(a))}</span><span>Травник ${signed(herb)}</span><span>Алхимия/отравитель ${signed(alchemy)}</span></span></button>`};
const sections=[{id:"recipes",label:"Рецепты",icon:"✦"},{id:"gather",label:"Сбор",icon:"❖"},{id:"stock",label:"Склад",icon:"▤"},{id:"crafting",label:"Изготовление",icon:"⚗"}];

EA.knownRecipes=()=>{
 const state=EA.getState();
 const recipes=state.recipes.filter(recipe=>game.user.isGM||recipe.playersKnow!==false);
 const rows=recipes.map(recipe=>`<article class="ea-known-recipe"><h3>${esc(recipe.name)}</h3><p>${esc(recipe.description||"Рецепт без описания.")}</p><p class="notes">Требования: ${esc(EA.aspectText(recipe.requirements))}; СЛ изготовления: ${recipe.brewDC}</p>${game.user.isGM?`<small class="notes">${recipe.playersKnow!==false?"Доступен игрокам":"Скрыт от игроков"}</small>`:""}</article>`).join("");
 EA.popup("Алхимия — известные рецепты",`<section class="ea-panel ea-known-recipes">${rows||"<p>Известных рецептов пока нет.</p>"}</section>`,{close:{label:"Закрыть"}});
};

EA.hub=()=>{
 const state=EA.getState();
 const actors=(state.configuration.actorIds||[]).map(id=>game.actors.get(id)).filter(a=>a&&(game.user.isGM||a.testUserPermission(game.user,"OWNER"))).slice(0,6);
 const roster=actors.length?actors.map(card).join(""):`<div class="ea-roster-empty">${game.user.isGM?"Назначьте персонажей в настройках алхимии":"Персонаж не назначен ГМ"}</div>`;
 const buttons=sections.map(s=>`<button class="ea-nav ea-nav-${s.id}" data-panel="${s.id}" aria-label="${s.label}"><span class="ea-nav-icon">${s.icon}</span><span>${s.label}</span></button>`).join("");
 const html=`<main class="ea-main-ui"><header class="ea-roster" aria-label="Персонажи группы">${roster}</header><p class="ea-roster-hint">Выберите персонажа: он будет выбран по умолчанию в окнах сбора и изготовления.</p><section class="ea-workspace"><div class="ea-center-mark"><span>⚗</span><b>Алхимия</b><small>Выберите раздел</small></div>${buttons}</section></main>`;
 const dlg=new Dialog({title:"Алхимия",content:html,buttons:{close:{label:"Закрыть"}},render:jq=>{const root=jq[0]||jq;root.querySelectorAll(".ea-player-card").forEach(button=>button.addEventListener("click",()=>{setSelected(button.dataset.actor);root.querySelectorAll(".ea-player-card").forEach(card=>{const active=card===button;card.classList.toggle("is-selected",active);card.setAttribute("aria-pressed",String(active))})}));root.querySelectorAll("[data-panel]").forEach(btn=>btn.addEventListener("click",()=>{const panel=btn.dataset.panel;dlg.close();if(panel==="recipes")EA.knownRecipes?.();else EA.openPanel?.(panel)}));root.querySelectorAll(".ea-player-card img").forEach(img=>img.addEventListener("error",()=>{img.src="icons/svg/mystery-man.svg"},{once:true}))}});
 dlg.options.width=760;dlg.options.height="auto";dlg.render(true);
};
})();