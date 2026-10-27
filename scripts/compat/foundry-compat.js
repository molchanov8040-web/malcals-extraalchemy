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
    getSceneControlGroup: (controls) => {
      if (!controls) return null;
      return controls.tokens ?? controls.token ?? Object.values(controls).find((group) => group?.name === "token") ?? null;
    },
    registerSceneTool: (controls, tool) => {
      const group = EA.compat.getSceneControlGroup(controls);
      if (!group || !tool?.name) return false;
      if (Array.isArray(group.tools)) {
        const existing = group.tools.find((entry) => entry.name === tool.name);
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
    documentImage: (document, fallback = "icons/svg/mystery-man.svg") => document?.texture?.src || document?.img || fallback
  };

  console.info(`${EA.id} | Foundry compatibility layer registered (${version() || "unknown version"}).`);
})();
