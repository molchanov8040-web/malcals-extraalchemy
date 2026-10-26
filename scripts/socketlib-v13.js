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

  // Researching a fully identified herb is a normal game outcome, not a remote exception.
  const resolveResearch = E.resolveResearch;
  E.resolveResearch = async request => {
    const state = E.getState();
    const herb = E.herb(request?.ingredientId);
    const known = state.group.knownAspects[request?.ingredientId] || {};
    const unknown = Object.keys(herb?.aspects || {}).filter(aspect => !Object.hasOwn(known, aspect));
    if (herb && !unknown.length) {
      return { research: false, message: `Все аспекты травы «${herb.name}» уже известны. Трава не потрачена.` };
    }
    try {
      return await resolveResearch(request);
    } catch (error) {
      if (/Все аспекты этой травы уже известны/.test(error?.message || "")) {
        return { research: false, message: "Все аспекты этой травы уже известны. Трава не потрачена." };
      }
      throw error;
    }
  };

  // Socketlib 1.1.x supplies the invoking user's id as the handler `this.userId`.
  // Never authorize a request using a userId supplied by the calling client.
  const runAsGM = async (type, request, callerId) => {
    const user = callerId && game.users.get(callerId);
    if (!user || !request?.requestId) throw new Error("Не удалось подтвердить пользователя или запрос.");
    const key = `${callerId}:${request.requestId}`;
    const prior = completed.get(key);
    if (prior) return prior;
    const trustedRequest = { ...request, userId: callerId };
    let result;
    if (type === "gather") result = await E.resolveGather(trustedRequest);
    else if (type === "research") result = await E.resolveResearch(trustedRequest);
    else if (type === "brew") result = await E.resolveBrew(trustedRequest);
    else throw new Error("Неизвестная операция алхимии.");
    remember(key, result);
    return result;
  };

  const registerHandler = (name, type) => socket.register(name, function (request) {
    return runAsGM(type, request, this?.userId);
  });

  Hooks.once("socketlib.ready", () => {
    if (!game.modules.get("socketlib")?.active || !globalThis.socketlib) {
      console.error(`${E.id} | Socketlib is required but unavailable.`);
      return;
    }
    socket = globalThis.socketlib.registerModule(E.id);
    registerHandler("eaGather", "gather");
    registerHandler("eaResearch", "research");
    registerHandler("eaBrew", "brew");
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
    if (!["gather", "research", "brew"].includes(action)) {
      ui.notifications.error("Эта операция пока не поддерживается через Socketlib.");
      return;
    }
    const packet = {
      ...request,
      requestId: foundry.utils.randomID()
    };
    try {
      const handler = action === "gather" ? "eaGather" : action === "research" ? "eaResearch" : "eaBrew";
      const result = await socket.executeAsGM(handler, packet);
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
