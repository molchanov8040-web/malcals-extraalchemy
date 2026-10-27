/* D&D 5e data access compatibility helpers for system 5.x and 6.x. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  const systemVersion = () => String(globalThis.game?.system?.version ?? "");
  const major = () => Number.parseInt(systemVersion().split(".")[0], 10) || 0;
  const numeric = value => Number(value) || 0;

  const abilityModifier = (actor, ability) => {
    const data = actor?.system;
    const value = data?.abilities?.[ability]?.mod ?? data?.abilities?.[ability]?.modifier;
    return numeric(value);
  };

  const skillModifier = (actor, skill) => {
    const value = actor?.system?.skills?.[skill]?.mod ?? actor?.system?.skills?.[skill]?.total;
    return value == null ? abilityModifier(actor, "wis") : numeric(value);
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
        return Math.max(0, numeric(actor.system?.attributes?.prof ?? actor.system?.attributes?.proficiency));
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

  // Core and Socketlib helpers are defined by later module scripts; wire the
  // adapter after initialization so both Foundry 13/dnd5e 5 and 14/dnd5e 6
  // use the same normalized accessors.
  Hooks.once("ready", () => {
    EA.toolProficiency = (actor, aliases = []) => toolProficiency(actor, aliases);
    EA.herbalismBonus = actor => toolProficiency(actor, ["herb", "herbalism", "herbalist", "herb kit", "травник", "травнич"]);
    EA.alchemyBonus = actor => toolProficiency(actor, ["alchemist", "alchem", "alchemist's supplies", "poison", "poisoner", "poisoner's kit", "poisoners kit", "алхим", "отравитель", "отравителей"]);
    console.info(`${EA.id} | D&D 5e compatibility adapter active (${systemVersion() || "unknown version"}).`);
  });

  console.info(`${EA.id} | D&D 5e compatibility adapter registered (${systemVersion() || "unknown version"}).`);
})();
