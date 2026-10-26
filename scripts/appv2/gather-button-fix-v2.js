/* Fix the disabled ApplicationV2 gather action after selecting goals. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  const syncButton = (root) => {
    const panel = root?.querySelector?.('.ea-v2-gather-panel');
    const button = panel?.querySelector('[data-action="gather-start"]');
    if (!button || button.dataset.gatherFix === 'bound') return;
    button.dataset.gatherFix = 'bound';
    const sync = () => {
      if (!button.isConnected || button.disabled === false) return;
      const hasGoals = panel.querySelectorAll('input[name="ea-v2-gather-goal"]:checked').length > 0;
      if (hasGoals) button.removeAttribute('disabled');
    };
    panel.addEventListener('change', (event) => {
      if (event.target?.matches?.('input[name="ea-v2-gather-goal"]')) sync();
    });
    sync();
  };

  const observeApp = (app) => {
    if (!app || app._gatherButtonFixObserver) return;
    app._gatherButtonFixObserver = new MutationObserver(() => syncButton(app.element));
    const observe = () => {
      if (!app.element) return false;
      app._gatherButtonFixObserver.observe(app.element, { childList: true, subtree: true });
      syncButton(app.element);
      return true;
    };
    if (!observe()) {
      const timer = setInterval(() => {
        if (observe()) clearInterval(timer);
      }, 25);
      setTimeout(() => clearInterval(timer), 5000);
    }
  };

  const previousOpen = EA.openPlayerAppV2;
  if (typeof previousOpen !== 'function') {
    console.warn(`${EA.id} | Gather button fix loaded before ApplicationV2 opener.`);
    return;
  }

  EA.openPlayerAppV2 = (...args) => {
    const app = previousOpen(...args);
    observeApp(app);
    return app;
  };

  console.info(`${EA.id} | ApplicationV2 gather button fix registered.`);
})();
