/* Malcal's ExtraAlchemy | Foundry VTT 13.351 user-interface bridge */

/**
 * Foundry V13 renders the Sidebar through ApplicationV2. The old renderSidebar
 * hook used by pre-V13 modules is not emitted here, so this file installs the
 * launcher from the public renderApplicationV2 hook instead.
 */
(() => {
  const MODULE_ID = "malcals-extraalchemy";
  const EA = globalThis.EA;

  if (!EA) {
    console.error(`${MODULE_ID} | Core module object was not initialized.`);
    return;
  }

  class ExtraAlchemySettingsLauncher extends FormApplication {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "malcals-extraalchemy-settings-launcher",
        title: "Инструменты алхимии",
        template: `modules/${MODULE_ID}/templates/settings-launcher.hbs`,
        width: 380,
        height: "auto",
        closeOnSubmit: false,
        submitOnChange: false
      });
    }

    getData() {
      return {};
    }

    activateListeners(html) {
      super.activateListeners(html);
      const root = html?.[0] ?? html;
      root?.querySelectorAll("[data-ea-open]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          EA.openSection(button.dataset.eaOpen);
        });
      });
    }

    async _updateObject() {
      // This menu has launch buttons only; there is no form data to save.
    }
  }

  // The settings menu is registered during the init hook in extraalchemy.js.
  // Scripts are evaluated before init, so replacing the class here gives the
  // registered menu a valid FormApplication with an actual template.
  EA.SettingsLauncher = ExtraAlchemySettingsLauncher;

  EA.installSidebarLauncher = (source) => {
    const root = source instanceof HTMLElement ? source : (source?.[0] ?? source);
    if (!root?.querySelector) return false;
    if (root.querySelector("[data-ea-sidebar-launcher]")) return true;

    const tabs = root.querySelector("nav.tabs, nav[data-group='primary'], #sidebar-tabs, .sidebar-tabs")
      ?? document.querySelector("#sidebar nav.tabs, #ui-right nav.tabs, #sidebar-tabs");
    if (!tabs) return false;
    if (tabs.querySelector("[data-ea-sidebar-launcher]")) return true;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ea-sidebar-launcher";
    button.dataset.eaSidebarLauncher = "true";
    button.title = "Инструменты алхимии";
    button.setAttribute("aria-label", "Инструменты алхимии");
    button.innerHTML = '<i class="fas fa-flask" aria-hidden="true"></i><span>Алхимия</span>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      EA.hub();
    });
    tabs.append(button);
    return true;
  };

  const isSidebar = (app) => {
    const SidebarClass = foundry?.applications?.sidebar?.Sidebar;
    return (SidebarClass && app instanceof SidebarClass) || app?.constructor?.name === "Sidebar";
  };

  // This is the reliable entry point in the left Scene Controls panel. The
  // public hook is part of the V13 UI API and does not patch core internals.
  Hooks.on("getSceneControlButtons", (controls) => {
    const target = controls.find((control) => control.name === "token") ?? controls[0];
    if (!target || target.tools.some((tool) => tool.name === `${MODULE_ID}-tools`)) return;
    target.tools.push({
      name: `${MODULE_ID}-tools`,
      title: "Инструменты алхимии",
      icon: "fas fa-flask",
      button: true,
      visible: true,
      onChange: () => EA.hub()
    });
  });

  Hooks.on("renderApplicationV2", (app) => {
    if (!isSidebar(app)) return;
    // ApplicationV2 inserts its element during render; defer one task so the
    // tabs part is present regardless of the render-hook timing.
    setTimeout(() => EA.installSidebarLauncher(app.element), 0);
  });

  Hooks.once("ready", () => {
    setTimeout(() => {
      EA.installSidebarLauncher(ui.sidebar?.element);
      EA.installSidebarLauncher(document.querySelector("#sidebar"));
    }, 0);
  });

  console.info(`${MODULE_ID} | Foundry V13 interface bridge loaded.`);
})();
