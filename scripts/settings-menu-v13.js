/* Foundry VTT 13 settings-menu repair for Malcal's ExtraAlchemy. */
class EASettingsLauncher extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "ea-settings-launcher",
      title: "Инструменты алхимии",
      template: `modules/${EA.id}/templates/launcher.hbs`,
      width: 420,
      height: "auto",
      closeOnSubmit: false,
      submitOnChange: false
    });
  }

  get template() {
    return `modules/${EA.id}/templates/launcher.hbs`;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0] ?? html;
    root.querySelectorAll("[data-ea-open]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const panel = event.currentTarget.dataset.eaOpen;
        if (panel === "stock") return EA.stock(game.user.character ?? EA.actors()[0] ?? null);
        if (panel === "library") return EA.library();
        return EA.open(panel, game.user.character ?? EA.actors()[0] ?? null);
      });
    });
    root.querySelector("[data-ea-reset]")?.addEventListener("click", async event => {
      event.preventDefault();
      const confirmed = await Dialog.confirm({
        title: "Сбросить данные алхимии",
        content: "<p>Будут удалены настройки алхимии этого мира: выбранные персонажи, территории, цели, история сбора и все добавленные пользователем рецепты. Базовые рецепты будут восстановлены. Ингредиенты в инвентарях персонажей и записи библиотеки трав не удаляются.</p><p><b>Это действие нельзя отменить.</b></p>",
        yes: () => true,
        no: () => false,
        defaultYes: false
      });
      if (!confirmed) return;
      await game.settings.set(EA.id, "state", EA.defaults());
      ui.notifications.info("Данные Malcal's ExtraAlchemy сброшены к значениям по умолчанию.");
      this.render(true);
    });
  }

  async _updateObject() {}
}

Hooks.once("init", () => {
  const key = `${EA.id}.launcher`;
  game.settings.menus.delete(key);
  game.settings.registerMenu(EA.id, "launcher", {
    name: "Инструменты алхимии",
    label: "Открыть панели",
    hint: "Открыть панели и сбросить данные Malcal's ExtraAlchemy.",
    icon: "fas fa-flask",
    type: EASettingsLauncher,
    restricted: true
  });
});
