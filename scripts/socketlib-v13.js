/* Socketlib transport for player-triggered GM-authoritative actions. */
(() => {
  const E = globalThis.EA;
  if (!E) return;

  let socket = null;
  const completed = new Map();
  const LIMIT = 200;

  const remember = (key, value) => {
    completed.set(key, value);
    while (completed.size > LIMIT) completed.delete(completed.keys().next().value);
  };

  const runAsGM = async (type, request) => {
    const user = game.users.get(request?.userId);
    if (!user || !request?.requestId) throw new Error("Некорректный запрос алхимии.");
    const prior = completed.get(request.requestId);
    if (prior) return prior;
    let result;
    if (type === "gather") result = await E.resolveGather(request);
    else if (type === "research") result = await E.resolveResearch(request);
    else throw new Error("Неизвестная операция алхимии.");
    remember(request.requestId, result);
    return result;
  };

  Hooks.once("socketlib.ready", () => {
    if (!game.modules.get("socketlib")?.active || !globalThis.socketlib) {
      console.error(`${E.id} | Socketlib is required but unavailable.`);
      return;
    }
    socket = globalThis.socketlib.registerModule(E.id);
    socket.register("eaGather", request => runAsGM("gather", request));
    socket.register("eaResearch", request => runAsGM("research", request));
    console.info(`${E.id} | Socketlib handlers registered.`);
  });

  const previousRequest = E.request;
  E.request = async request => {
    if (game.user.isGM) return previousRequest(request);
    if (!socket) {
      ui.notifications.error("Socketlib ещё не готов. Перезагрузите мир и повторите действие.");
      return;
    }
    const action = request?.type;
    if (!["gather", "research"].includes(action)) {
      ui.notifications.error("Эта операция пока не поддерживается через Socketlib.");
      return;
    }
    const packet = {
      ...request,
      userId: game.user.id,
      requestId: foundry.utils.randomID()
    };
    try {
      const result = await socket.executeAsGM(action === "gather" ? "eaGather" : "eaResearch", packet);
      if (result?.research) {
        E.popup("Исследование", `<p>Открыт аспект: <b>${E.esc(E.aspects[result.aspect] || result.aspect)}: ${result.value}</b>.</p>`, { ok: { label: "Понятно" } });
      } else if (result?.message) {
        ui.notifications.info(result.message);
      }
      Hooks.callAll("eaStockChanged");
      return result;
    } catch (error) {
      console.error(`${E.id} | Socketlib ${action} failed`, error);
      ui.notifications.error(error?.message || "Не удалось выполнить запрос у ГМ.");
    }
  };
})();
