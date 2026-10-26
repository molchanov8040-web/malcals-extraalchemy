/* ApplicationV2 player interface scaffold for Foundry VTT 13. */
(()=>{
  const EA=globalThis.EA;
  if(!EA) return;
  const api=foundry?.applications?.api;
  if(!api?.ApplicationV2||!api?.HandlebarsApplicationMixin){
    console.error(`${EA.id} | ApplicationV2 API недоступен.`);
    return;
  }
  const esc=EA.esc||((v)=>String(v??""));
  const modes=[{id:"recipes",label:"Рецепты",icon:"✦"},{id:"gather",label:"Сбор",icon:"❖"},{id:"stock",label:"Склад",icon:"▤"},{id:"crafting",label:"Изготовление",icon:"⚗"}];
  const signed=n=>`${Number(n)>=0?"+":""}${Number(n)||0}`;
  const selectedKey=()=>`${EA.id}.appv2-selected-actor.${game.user?.id??"unknown"}`;
  const selectedId=()=>{try{return localStorage.getItem(selectedKey())||""}catch{return ""}};
  const toolBonus=(actor,keys,labels)=>{const tools=actor?.system?.tools;if(!tools||typeof tools!=="object")return 0;for(const [key,tool]of Object.entries(tools)){const text=[key,tool?.label,tool?.name,tool?.custom,tool?.identifier].filter(Boolean).join(" ").toLocaleLowerCase();if(!keys.some(x=>text.includes(x))&&!labels.some(x=>text.includes(x)))continue;const proficient=tool?.prof??tool?.proficient??tool?.value;if(proficient===true||Number(proficient)>0)return Math.max(0,Number(actor.system?.attributes?.prof)||0)}return 0};
  const actors=()=>{const ids=EA.getState()?.configuration?.actorIds||[];return ids.map(id=>game.actors?.get(id)).filter(a=>a&&(game.user.isGM||a.testUserPermission?.(game.user,"OWNER"))).slice(0,6)};
  const actorContext=a=>({id:a.id,name:a.name,img:a.prototypeToken?.texture?.src||a.img||"icons/svg/mystery-man.svg",survival:signed(a.system?.skills?.sur?.mod??a.system?.abilities?.wis?.mod??0),herb:signed(toolBonus(a,["herb","herbalism","herbalist"],["травник","травнич"])),alchemy:signed(toolBonus(a,["alchemist","poisoner","poison"],["алхим","отравитель"])),selected:a.id===selectedId()});
  const panel=(mode,state)=>{const stock=state.group?.stock||[],recipes=(state.recipes||[]).filter(r=>game.user.isGM||r.playersKnow!==false);if(mode==="recipes")return `<section class="ea-v2-panel"><h2>Рецепты</h2><p class="ea-v2-muted">Известно рецептов: <b>${recipes.length}</b></p><p>Каталог рецептов будет перенесён в это окно следующим этапом.</p></section>`;if(mode==="gather")return `<section class="ea-v2-panel"><h2>Сбор</h2><p>Территория: <b>${esc(state.configuration?.activeTerritory||"не выбрана")}</b></p><p>Выберите персонажа сверху, затем настройте типы трав и начните сбор.</p><button type="button" class="ea-v2-action" disabled>Начать сбор</button></section>`;if(mode==="stock")return `<section class="ea-v2-panel"><h2>Склад</h2><p class="ea-v2-muted">Видов растений: <b>${stock.length}</b></p><p>Сетка склада будет перенесена в ApplicationV2 следующим этапом.</p></section>`;return `<section class="ea-v2-panel"><h2>Изготовление</h2><p class="ea-v2-muted">Ингредиентов на складе: <b>${stock.reduce((n,x)=>n+(Number(x.quantity)||0),0)}</b></p><p>Выбор ингредиентов и результаты проверки будут перенесены в ApplicationV2 следующим этапом.</p><button type="button" class="ea-v2-action" disabled>Проверить возможные рецепты</button></section>`};
  class EAPlayerApplicationV2 extends api.HandlebarsApplicationMixin(api.ApplicationV2){
    static DEFAULT_OPTIONS={id:"malcals-extraalchemy-player-v2",classes:["ea-v2-window"],tag:"main",position:{width:1100,height:700},window:{title:"Алхимия",resizable:true,contentClasses:["ea-v2-content"]},actions:{"select-mode":function(event,target){this.mode=target.dataset.mode||"recipes";this.render({force:true})},"select-actor":function(event,target){try{localStorage.setItem(selectedKey(),target.dataset.actor||"")}catch{}this.render({force:true})}};
    static PARTS={main:{template:"modules/malcals-extraalchemy/templates/appv2/player-window.hbs"}};
    constructor(options={}){super(options);this.mode="recipes";}
    async _prepareContext(){const state=EA.getState(),roster=actors().map(actorContext);if(roster.length&&!roster.some(a=>a.selected)){roster[0].selected=true;try{localStorage.setItem(selectedKey(),roster[0].id)}catch{}}const normalized=roster.length&&roster[0].selected?roster:roster.map(a=>({...a,selected:a.id===selectedId()}));return {title:"Алхимия",roster:normalized,leftModes:modes.filter(m=>m.id==="recipes"||m.id==="stock").map(m=>({...m,active:m.id===this.mode})),rightModes:modes.filter(m=>m.id==="gather"||m.id==="crafting").map(m=>({...m,active:m.id===this.mode})),panel:panel(this.mode,state)};}
  }
  EA.PlayerApplicationV2=EAPlayerApplicationV2;
  EA.openPlayerAppV2=()=>{if(!EA._playerAppV2)EA._playerAppV2=new EAPlayerApplicationV2();EA._playerAppV2.render({force:true});return EA._playerAppV2};
  Hooks.on("getSceneControlButtons",controls=>{const group=controls.tokens??controls.token??Object.values(controls).find(v=>v?.name==="token");if(!group)return;const tool=Array.isArray(group.tools)?group.tools.find(t=>t.name==="malcals-extraalchemy-tools"):group.tools?.["malcals-extraalchemy-tools"];if(tool)tool.onChange=()=>EA.openPlayerAppV2?.()||EA.hub?.();});
  console.info(`${EA.id} | ApplicationV2 player scaffold registered.`);
})();
