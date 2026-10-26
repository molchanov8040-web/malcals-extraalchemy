/* Keep the ApplicationV2 gather action clickable after the user selects goals. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  const enableGatherButton = (app) => {
    const button = app?.element?.querySelector?.('[data-action="gather-start"]');
    if (!button || app.gathering) return;
    const hasActor = app.element.querySelector('.ea-v2-gather-panel .ea-v2-gather-meta');
    if (hasActor) button.removeAttribute('disabled');
  };

  const originalOpen = EA.openPlayerAppV2;
  if (typeof originalOpen !== 'function') {
    console.warn(`${EA.id} | Gather button fix loaded before ApplicationV2 opener.`);
    return;
  }

  EA.openPlayerAppV2 = (...args) => {
    const app = originalOpen(...args);
    if (!app._gatherButtonObserver && app.element) {
      app._gatherButtonObserver = new MutationObserver(() => enableGatherButton(app));
      app._gatherButtonObserver.observe(app.element, { childList: true, subtree: true });
    }
    queueMicrotask(() => enableGatherButton(app));
    return app;
  };

  console.info(`${EA.id} | ApplicationV2 gather button fix registered.`);
})();
