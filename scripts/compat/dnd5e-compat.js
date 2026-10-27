/* D&D 5e data access compatibility helpers for system 5.x and 6.x. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  const systemVersion = () => String(globalThis.game?.system?.version ?? "");
  const major = () => Number.parseInt(systemVersion().split(".")[0], 10) || 0;
  const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  const abilityModifier = (actor, ability) => {
    const value = actor?.system?.abilities?.[ability]?.mod
      ?? actor?.system?.abilities?.[ability]?.modifier
      ?? actor?.system?.abilities?.[ability]?.value;
    return numeric(value);
  };

  const skillModifier = (actor, skill) => {
    const value = actor?.system?.skills?.[skill]?.mod
      ?? actor?.system?.skills?.[skill]?.total;
    return value == null ? 0 : numeric(value);
  };

  const proficiencyBonus = actor => numeric(
    actor?.system?.attributes?.prof
      ?? actor?.system?.attributes?.proficiency
      ?? actor?.system?.bonuses?.prof
  );

  const toolProficiency = (actor, aliases = []) => {
    const tools = actor?.system?.tools;
    if (!tools || typeof tools !== "object") return 0;
    const wanted = (Array.isArray(aliases) ? aliases : [aliases])
      .map(value => String(value).trim().toLocaleLowerCase())
      .filter(Boolean);
    for (const [key, tool] of Object.entries(tools)) {
      const label = [key, tool?.label, tool?.name, tool?.custom, tool?.identifier]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      if (!wanted.some(alias => label.includes(alias))) continue;
      const proficiency = tool?.prof ?? tool?.proficient ?? tool?.value ?? tool?.proficiency;
      if (proficiency === true || Number(proficiency) > 0) return Math.max(0, proficiencyBonus(actor));
    }
    return 0;
  };

  const herbalismAliases = ["herb", "herbalism", "herbalist", "herb kit", "травник", "травнич"];
  const alchemyAliases = ["alchemist", "alchem", "alchemist's supplies", "poison", "poisoner", "poisoner's kit", "poisoners kit", "алхим", "отравитель", "отравителей"];

  EA.dnd5e = {
    systemVersion,
    major,
    isV5: () => major() === 5,
    isV6: () => major() === 6,
    abilityModifier,
    skillModifier,
    proficiencyBonus,
    toolProficiency,
    survivalModifier: actor => skillModifier(actor, "sur"),
    intelligenceModifier: actor => abilityModifier(actor, "int"),
    herbalismBonus: actor => toolProficiency(actor, herbalismAliases),
    alchemyBonus: actor => toolProficiency(actor, alchemyAliases),
    actorImage: actor => actor?.prototypeToken?.texture?.src || actor?.img || "icons/svg/mystery-man.svg",
    speaker: actor => globalThis.ChatMessage?.getSpeaker?.({ actor }) ?? { actor: actor?.id }
  };

  // Keep the legacy service names available, but make them use the normalized adapter.
  EA.toolProficiency = (actor, aliases = []) => toolProficiency(actor, aliases);
  EA.herbalismBonus = actor => toolProficiency(actor, herbalismAliases);
  EA.alchemyBonus = actor => toolProficiency(actor, alchemyAliases);

  Hooks.once("ready", () => {
    console.info(`${EA.id} | D&D 5e compatibility adapter active (${systemVersion() || "unknown version"}, major ${major() || "unknown"}).`);
  });

  console.info(`${EA.id} | D&D 5e compatibility adapter registered (${systemVersion() || "unknown version"}).`);
})();
