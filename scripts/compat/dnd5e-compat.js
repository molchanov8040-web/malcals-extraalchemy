/* D&D 5e data access compatibility helpers for system 5.x and 6.x. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  const systemVersion = () => String(globalThis.game?.system?.version ?? "");
  const major = () => Number.parseInt(systemVersion().split(".")[0], 10) || 0;
  const signed = value => Number(value) || 0;

  const abilityModifier = (actor, ability) => {
    const data = actor?.system;
    const value = data?.abilities?.[ability]?.mod ?? data?.abilities?.[ability]?.modifier;
    return signed(value);
  };

  const skillModifier = (actor, skill) => {
    const data = actor?.system;
    const value = data?.skills?.[skill]?.mod ?? data?.skills?.[skill]?.total;
    return value == null ? abilityModifier(actor, "wis") : signed(value);
  };

  const toolProficiency = (actor, aliases = []) => {
    const tools = actor?.system?.tools;
    if (!tools || typeof tools !== "object") return 0;
    const wanted = aliases.map(value => String(value).toLocaleLowerCase());
    for (const [key, tool] of Object.entries(tools)) {
      const label = [key, tool?.label, tool?.name, tool?.custom, tool?.identifier]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      if (!wanted.some(alias => label.includes(alias))) continue;
      const proficiency = tool?.prof ?? tool?.proficient ?? tool?.value;
      if (proficiency === true || Number(proficiency) > 0) {
        return Math.max(0, Number(actor.system?.attributes?.prof ?? actor.system?.attributes?.proficiency) || 0);
      }
    }
    return 0;
  };

  EA.dnd5e = {
    systemVersion,
    major,
    isV5: () => major() === 5,
    isV6: () => major() === 6,
    abilityModifier,
    skillModifier,
    toolProficiency,
    actorImage: actor => actor?.prototypeToken?.texture?.src || actor?.img || "icons/svg/mystery-man.svg",
    speaker: actor => globalThis.ChatMessage?.getSpeaker?.({ actor }) ?? { actor: actor?.id }
  };

  console.info(`${EA.id} | D&D 5e compatibility adapter registered (${systemVersion() || "unknown version"}).`);
})();
