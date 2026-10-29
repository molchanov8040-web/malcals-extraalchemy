/* Security boundary for the 0.8.9 test build. Client-supplied roll totals are never trusted. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  const stripClientTotal = (request, next) => {
    const safe = { ...(request || {}) };
    delete safe.total;
    return next(safe);
  };

  if (typeof E.resolveGather === "function" && !E.resolveGather.__eaClientRollGuard) {
    const next = E.resolveGather;
    const guarded = request => stripClientTotal(request, next);
    guarded.__eaClientRollGuard = true;
    E.resolveGather = guarded;
  }
  if (typeof E.resolveBrew === "function" && !E.resolveBrew.__eaClientRollGuard) {
    const next = E.resolveBrew;
    const guarded = request => stripClientTotal(request, next);
    guarded.__eaClientRollGuard = true;
    E.resolveBrew = guarded;
  }

  console.info(`${E.id} | Client roll totals rejected at workflow boundary.`);
})();
