/* Foundry VTT compatibility helpers for v13 and v14. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  const version = () => String(globalThis.game?.version ?? "");
  const major = () => Number.parseInt(version().split(".")[0], 10) || 0;

  EA.compat = {
    version,
    major,
    isV13: () => major() === 13,
    isV14: () => major() === 14,
    getApplicationAPI: () => globalThis.foundry?.applications?.api ?? null,
    getSceneControlGroup: controls => {
      if (!controls) return null;
      return controls.tokens ?? controls.token ?? Object.values(controls).find(group => group?.name === "token") ?? null;
    },
    registerSceneTool: (controls, tool) => {
      const group = EA.compat.getSceneControlGroup(controls);
      if (!group || !tool?.name) return false;
      if (Array.isArray(group.tools)) {
        const existing = group.tools.find(entry => entry.name === tool.name);
        if (existing) Object.assign(existing, tool);
        else group.tools.push(tool);
        return true;
      }
      group.tools ??= {};
      group.tools[tool.name] = { ...(group.tools[tool.name] ?? {}), ...tool };
      return true;
    },
    notify: (level, message) => {
      const notifications = globalThis.ui?.notifications;
      if (typeof notifications?.[level] === "function") notifications[level](message);
      else console[level === "error" ? "error" : "warn"](`${EA.id} | ${message}`);
    },
    documentImage: (document, fallback = "icons/svg/mystery-man.svg") => document?.texture?.src || document?.img || fallback,
    diagnose: () => {
      const foundryMajor = major();
      const systemId = String(globalThis.game?.system?.id ?? "");
      const systemVersion = String(globalThis.game?.system?.version ?? "");
      const systemMajor = Number.parseInt(systemVersion.split(".")[0], 10) || 0;
      const socketModule = globalThis.game?.modules?.get?.("socketlib");
      const socketVersion = String(socketModule?.version ?? "unknown");
      const normalizedSocketVersion = socketVersion.trim().replace(/^v/i, "");
      const appV2 = Boolean(EA.compat.getApplicationAPI()?.ApplicationV2);
      const expectedSystemMajor = foundryMajor === 13 ? 5 : foundryMajor === 14 ? 6 : 0;
      const issues = [];
      if (![13, 14].includes(foundryMajor)) issues.push(`Foundry ${foundryMajor || "unknown"} is outside the target matrix (13/14).`);
      if (systemId !== "dnd5e") issues.push(`Expected dnd5e, got ${systemId || "unknown system"}.`);
      else if (expectedSystemMajor && systemMajor !== expectedSystemMajor) issues.push(`Target profile expects dnd5e ${expectedSystemMajor}.x on Foundry ${foundryMajor}; detected ${systemVersion || "unknown"}.`);
      if (!appV2) issues.push("ApplicationV2 API is unavailable.");
      if (!socketModule?.active) issues.push("Socketlib is not active.");
      else if (normalizedSocketVersion !== "1.1.4") issues.push(`Target Socketlib version is 1.1.4; detected ${socketVersion}.`);
      return { foundryVersion: version(), foundryMajor, systemId, systemVersion, socketVersion, appV2, issues };
    }
  };

  Hooks.once("ready", () => {
    const report = EA.compat.diagnose();
    console.info(`${EA.id} | Runtime compatibility profile`, report);
    for (const issue of report.issues) console.warn(`${EA.id} | Compatibility check: ${issue}`);
  });

  console.info(`${EA.id} | Foundry compatibility layer registered (${version() || "unknown version"}).`);
})();
