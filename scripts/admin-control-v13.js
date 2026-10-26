/* GM-only shortcut beside the player launcher in Foundry VTT 13 controls. */
(()=>{
const EA=globalThis.EA;if(!EA)return;
const openAdmin=()=>{
 if(!game.user?.isGM)return;
 EA.popup("Алхимия — панель ведущего",`<section class="ea-panel ea-admin-actions"><button type="button" data-admin="config">Настройка алхимии</button><button type="button" data-admin="recipes">Редактор рецептов</button><button type="button" data-admin="library">Библиотека трав</button></section>`,{close:{label:"Закрыть"}},root=>root.querySelectorAll("[data-admin]").forEach(button=>button.onclick=()=>{const action=button.dataset.admin;if(action==="config")EA.config?.();else if(action==="recipes")EA.recipes?.();else if(action==="library")EA.openLibrary?.()}));
};
Hooks.on("getSceneControlButtons",controls=>{
 if(!game.user?.isGM)return;
 const tokenControls=controls.tokens??controls.token??Object.values(controls).find(group=>group?.name==="token");
 if(!tokenControls)return;
 const tool={name:"malcals-extraalchemy-admin",title:"Алхимия — панель ведущего",icon:"fa-solid fa-flask-vial",order:1000,button:true,visible:true,onChange:openAdmin};
 if(Array.isArray(tokenControls.tools)){
  if(!tokenControls.tools.some(existing=>existing.name===tool.name))tokenControls.tools.push(tool);
 }else{
  tokenControls.tools??={};
  tokenControls.tools[tool.name]??=tool;
 }
});
})();
