/* Safe legacy aliases for Foundry 13/14 namespaced document APIs. */
(() => {
  const collection = globalThis.foundry?.documents?.collections?.CompendiumCollection;
  if (!collection) return;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "CompendiumCollection");
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(globalThis, "CompendiumCollection", {
        value: collection,
        writable: true,
        configurable: true
      });
    }
  } catch (error) {
    console.warn("malcals-extraalchemy | Could not install CompendiumCollection compatibility alias", error);
  }
})();
