/* Mask Foundry's deprecated global CompendiumCollection shim with its namespaced API. */
(() => {
  const Collection = globalThis.foundry?.documents?.collections?.CompendiumCollection;
  if (typeof Collection !== "function") return;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "CompendiumCollection");
  if (!descriptor || descriptor.configurable) {
    Object.defineProperty(globalThis, "CompendiumCollection", {
      configurable: true,
      enumerable: descriptor?.enumerable ?? false,
      writable: true,
      value: Collection
    });
  }
})();
