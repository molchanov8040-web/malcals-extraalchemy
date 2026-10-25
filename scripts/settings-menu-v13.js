/* Foundry VTT 13 settings launcher for Malcal's ExtraAlchemy. */
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
      await EA.resetAllData();
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
