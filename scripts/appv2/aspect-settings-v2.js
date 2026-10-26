/* GM settings for aspects visible to players. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  const getState = () => EA.getState();
  const aspectEntries = () => Object.entries(EA.aspects || {});
  const visibleKeys = state => {
    const configured = state?.configuration?.playerAspectKeys;
    return Array.isArray(configured) ? configured : aspectEntries().map(([key]) => key);
  };

  EA.openAspectSettings = () => {
    if (!game.user?.isGM) return;
    const state = getState();
    const visible = new Set(visibleKeys(state));
    const rows = aspectEntries().map(([key, label]) => `<label class="ea-check"><input type="checkbox" name="ea-player-aspect" value="${EA.esc(key)}"${visible.has(key) ? " checked" : ""}> ${EA.esc(label)}</label>`).join("");
    EA.popup("Алхимия — аспекты, доступные игрокам", `<section class="ea-panel ea-aspect-settings"><p>Выберите аспекты, которые игроки могут видеть в свойствах растений и рецептов.</p><fieldset><legend>Доступные аспекты</legend>${rows}</fieldset><p class="notes">Снятые аспекты скрываются только у игроков. Полные данные остаются доступны ведущему.</p></section>`, { save: { label: "Сохранить", callback: async root => {
      const selected = Array.from(root.querySelectorAll("input[name='ea-player-aspect']:checked")).map(input => input.value);
      const next = EA.getState();
      next.configuration.playerAspectKeys = selected;
      await EA.commit(next);
      ui.notifications.info("Настройки доступных игрокам аспектов сохранены.");
    } }, close: { label: "Закрыть" } });
  };

  console.info(`${EA.id} | Player aspect settings registered.`);
})();
