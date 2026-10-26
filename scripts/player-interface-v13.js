/* Responsive player-facing launcher for Foundry VTT 13. */
(()=>{
const EA=globalThis.EA;if(!EA)return;
const esc=EA.esc;
const skillMod=a=>Number(a?.system?.skills?.sur?.mod??a?.system?.abilities?.wis?.mod??0);
const proficiency=a=>Number(a?.system?.attributes?.prof)||0;
const actorImage=a=>a?.prototypeToken?.texture?.src||a?.img||"icons/svg/mystery-man.svg";
const card=(a,i)=>{const herb=EA.herbalismBonus?.(a)||0,alchemy=EA.alchemyBonus?.(a)||0;return `<article class="ea-player-card" title="${esc(a.name)}"><img src="${esc(actorImage(a))}" alt=""><div class="ea-player-info"><b>${esc(a.name)}</b><span>Выживание ${skillMod(a)>=0?"+":""}${skillMod(a)}</span><span>Инструменты +${Math.max(herb,alchemy,proficiency(a))}</span></div></article>`};
const sections=[{id:"recipes",label:"Рецепты",icon:"✦"},{id:"gather",label:"Сбор",icon:"❖"},{id:"stock",label:"Склад",icon:"▤"},{id:"crafting",label:"Изготовление",icon:"⚗"}];
EA.hub=()=>{
 const state=EA.getState();
 const actors=(state.configuration.actorIds||[]).map(id=>game.actors.get(id)).filter(a=>a&&(game.user.isGM||a.testUserPermission(game.user,"OWNER")));
 const visible=game.user.isGM?[...actors]:actors;
 const roster=visible.length?visible.slice(0,6).map(card).join(""):`<div class="ea-roster-empty">${game.user.isGM?"Назначьте персонажей в настройках алхимии":"Персонаж не назначен ГМ"}</div>`;
 const buttons=sections.map((s,i)=>`<button class="ea-nav ea-nav-${s.id}" data-panel="${s.id}" aria-label="${s.label}"><span class="ea-nav-icon">${s.icon}</span><span>${s.label}</span></button>`).join("");
 const html=`<main class="ea-main-ui"><header class="ea-roster">${roster}</header><section class="ea-workspace"><div class="ea-center-mark"><span>⚗</span><b>Алхимия</b><small>Выберите раздел</small></div>${buttons}</section></main>`;
 const dlg=new Dialog({title:"Алхимия",content:html,buttons:{close:{label:"Закрыть"}},render:jq=>{const root=jq[0]||jq;root.querySelectorAll("[data-panel]").forEach(btn=>btn.addEventListener("click",()=>{const panel=btn.dataset.panel;dlg.close();if(panel==="recipes")EA.knownRecipes?.();else EA.openPanel?.(panel)}));root.querySelectorAll(".ea-player-card img").forEach(img=>img.addEventListener("error",()=>{img.src="icons/svg/mystery-man.svg"},{once:true}))}});
 dlg.options.width=760;dlg.options.height="auto";dlg.render(true);
};
})();