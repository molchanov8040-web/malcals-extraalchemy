/* GM-only shortcut beside the player launcher in Foundry VTT 13 controls. */
(()=>{
const EA=globalThis.EA;if(!EA)return;
Hooks.on("getSceneControlButtons",controls=>{
 if(!game.user?.isGM)return;
 const tokenControls=controls.tokens??controls.token??Object.values(controls).find(group=>group?.name==="token");
 if(!tokenControls)return;
 const tool={name:"malcals-extraalchemy-admin",title:"Алхимия — панель ведущего",icon:"fa-solid fa-flask-vial",order:1000,button:true,visible:true,onChange:()=>EA.adminHub?.()};
 if(Array.isArray(tokenControls.tools)){
  if(!tokenControls.tools.some(existing=>existing.name===tool.name))tokenControls.tools.push(tool);
 }else{
  tokenControls.tools??={};
  tokenControls.tools[tool.name]??=tool;
 }
});
})();
