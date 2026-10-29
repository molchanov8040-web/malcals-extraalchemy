/* Runtime diagnostics for the planned Foundry 13/14 test matrix. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  Hooks.once("ready", () => {
    const foundryVersion = String(game.version ?? "unknown");
    const systemId = String(game.system?.id ?? "unknown");
    const systemVersion = String(game.system?.version ?? "unknown");
    const socketlib = game.modules?.get("socketlib");
    const socketVersion = String(socketlib?.version ?? "not installed");
    const supportedCore = EA.compat?.isV13?.() || EA.compat?.isV14?.();
    const supportedSystem = systemId === "dnd5e" && [5, 6].includes(EA.dnd5e?.major?.());

    const report = {
      foundry: foundryVersion,
      dnd5e: `${systemId} ${systemVersion}`,
      socketlib: socketVersion,
      foundryAdapter: Boolean(EA.compat),
      dnd5eAdapter: Boolean(EA.dnd5e),
      supportedCore,
      supportedSystem
    };
    console.info(`${EA.id} | Compatibility diagnostics`, report);

    if (!supportedCore) {
      console.warn(`${EA.id} | Untested Foundry major version: ${foundryVersion}`);
    }
    if (!supportedSystem) {
      console.warn(`${EA.id} | Expected dnd5e 5.x or 6.x; found ${systemId} ${systemVersion}`);
    }
    if (!socketlib?.active) {
      console.error(`${EA.id} | Required Socketlib is inactive or unavailable.`);
    }
  });
})();
