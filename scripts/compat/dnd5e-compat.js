/* D&D 5e data access compatibility helpers for system 5.x and 6.x. */
(() => {
  const EA = globalThis.EA;
  if (!EA) return;

  const systemVersion = () => String(globalThis.game?.system?.version ?? "");
  const major = () => Number.parseInt(systemVersion().split(".")[0], 10) || 0;
  const numeric = value => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value && typeof value === "object") {
      for (const key of ["total", "mod", "modifier", "bonus", "value"]) {
        if (value[key] != null) {
          const result = Number(value[key]);
          if (Number.isFinite(result)) return result;
        }
      }
    }
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  };
  const strictNumber = value => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string" || !/^[+-]?\d+(?:\.\d+)?$/.test(value.trim())) return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  };
  const abilityModifier = (actor, ability) => numeric(
    actor?.system?.abilities?.[ability]?.mod
      ?? actor?.system?.abilities?.[ability]?.modifier
      ?? actor?.system?.abilities?.[ability]?.value
  );
  const skillModifier = (actor, skill) => numeric(
    actor?.system?.skills?.[skill]?.mod
      ?? actor?.system?.skills?.[skill]?.total
      ?? actor?.system?.skills?.[skill]?.value
  );
  const proficiencyBonus = actor => numeric(
    actor?.system?.attributes?.prof
      ?? actor?.system?.attributes?.proficiency
      ?? actor?.system?.bonuses?.prof
  );
  const aliasesOf = aliases => (Array.isArray(aliases) ? aliases : [aliases])
    .map(value => String(value ?? "").trim().toLocaleLowerCase())
    .filter(Boolean);
  const normalizeAbility = value => {
    const raw = typeof value === "object" ? value?.key ?? value?.id ?? value?.ability : value;
    const key = String(raw ?? "").trim().toLocaleLowerCase();
    const names = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
    return names[key] || key.slice(0, 3);
  };
  const aliasesFor = kind => {
    if (Array.isArray(kind)) return kind;
    const value = String(kind ?? "").toLocaleLowerCase();
    if (value.includes("herb") || value.includes("gather")) return ["herbalism kit", "herbalism", "herbalist", "herb kit", "herb", "травник", "травнич"];
    if (value.includes("poison") || value.includes("отрав")) return ["poisoner's kit", "poisoners kit", "poisoner", "poison", "набор отравителя", "отравитель", "отравителей"];
    return ["alchemist's supplies", "alchemists supplies", "alchemist supplies", "alchemist", "alchem", "алхим"];
  };
  const matchingLabel = (key, tool) => [key, tool?.label, tool?.name, tool?.custom, tool?.identifier, tool?.toolType]
    .filter(Boolean).join(" ").toLocaleLowerCase();
  const findTool = (actor, aliases) => {
    const wanted = aliasesOf(aliases);
    const tools = actor?.system?.tools;
    if (tools && typeof tools === "object") {
      const candidates = Object.entries(tools).filter(([key, tool]) => {
        const label = matchingLabel(key, tool);
        return wanted.some(alias => label === alias || label.includes(alias));
      });
      if (candidates.length) return { entry: candidates[0][1] || {}, id: candidates[0][0], source: "actor.system.tools" };
    }
    for (const item of actor?.items ?? []) {
      if (item.type !== "tool") continue;
      const label = matchingLabel(item.name, { identifier: item.system?.identifier, toolType: item.system?.toolType });
      const explicit = item.system?.proficient ?? item.system?.proficiency;
      if (wanted.some(alias => label === alias || label.includes(alias)) && (explicit === true || numeric(explicit) > 0)) {
        return { entry: item.system || {}, id: item.id, source: "actor.items" };
      }
    }
    return null;
  };
  const proficiencyFromTool = (actor, tool) => {
    const direct = [tool?.profBonus, tool?.proficiencyBonus]
      .map(strictNumber).find(value => value != null);
    if (direct != null) return Math.max(0, direct);
    const raw = tool?.value ?? tool?.proficient ?? tool?.proficiency ?? tool?.prof;
    if (raw === true || String(raw ?? "").toLocaleLowerCase() === "proficient") return Math.max(0, proficiencyBonus(actor));
    const level = strictNumber(raw);
    if (level == null || level <= 0) return 0;
    if (level > 2 && tool?.prof != null) return Math.max(0, level);
    return Math.max(0, proficiencyBonus(actor) * Math.min(level, 2));
  };
  const directTotal = tool => [tool?.total, tool?.totalBonus, tool?.checkTotal]
    .map(strictNumber).find(value => value != null);
  const checkBonus = tool => [tool?.bonuses?.check, tool?.bonus]
    .map(strictNumber).find(value => value != null) ?? 0;
  const toolCheck = (actor, kind) => {
    const aliases = aliasesFor(kind);
    const found = findTool(actor, aliases);
    const entry = found?.entry || {};
    const ability = normalizeAbility(entry.ability ?? entry.abilityId ?? entry.abilityKey) || "int";
    const abilityMod = abilityModifier(actor, ability);
    const proficiency = proficiencyFromTool(actor, entry);
    const bonus = checkBonus(entry);
    const savedTotal = directTotal(entry);
    const total = savedTotal != null ? savedTotal : abilityMod + proficiency + bonus;
    return {
      total: Number.isFinite(total) ? total : 0,
      ability,
      abilityModifier: abilityMod,
      proficiency,
      bonus,
      proficient: proficiency > 0,
      toolId: found?.id || null,
      source: found?.source || "fallback",
      name: entry.label || entry.name || found?.id || (String(kind).includes("poison") ? "Набор отравителя" : "Алхимический набор")
    };
  };
  const herbalismAliases = aliasesFor("herbalism");
  const alchemyAliases = aliasesFor("alchemy");
  const poisonerAliases = aliasesFor("poisoner");

  EA.dnd5e = {
    systemVersion,
    major,
    isV5: () => major() === 5,
    isV6: () => major() === 6,
    abilityModifier,
    skillModifier,
    proficiencyBonus,
    toolProficiency: (actor, aliases = []) => toolCheck(actor, aliases).proficiency,
    toolCheck,
    resolveToolCheck: toolCheck,
    survivalModifier: actor => skillModifier(actor, "sur"),
    intelligenceModifier: actor => abilityModifier(actor, "int"),
    herbalismBonus: actor => toolCheck(actor, herbalismAliases).proficiency,
    alchemyBonus: actor => toolCheck(actor, alchemyAliases).total,
    poisonerBonus: actor => toolCheck(actor, poisonerAliases).total,
    actorImage: actor => actor?.img || actor?.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg",
    speaker: actor => globalThis.ChatMessage?.getSpeaker?.({ actor }) ?? { actor: actor?.id },
    rollContext: actor => ({ actorId: actor?.id, actor })
  };

  EA.toolCheck = (actor, kind = "alchemy") => toolCheck(actor, kind);
  EA.resolveToolCheck = EA.toolCheck;
  EA.toolProficiency = (actor, aliases = []) => toolCheck(actor, aliases).proficiency;
  EA.herbalismBonus = actor => toolCheck(actor, herbalismAliases).proficiency;
  EA.alchemyBonus = actor => toolCheck(actor, alchemyAliases).total;
  EA.poisonerBonus = actor => toolCheck(actor, poisonerAliases).total;
  EA.survivalModifier = actor => skillModifier(actor, "sur");
  EA.intelligenceModifier = actor => abilityModifier(actor, "int");

  Hooks.once("ready", () => {
    console.info(`${EA.id} | D&D 5e compatibility adapter active (${systemVersion() || "unknown version"}, major ${major() || "unknown"}).`);
  });
  console.info(`${EA.id} | D&D 5e compatibility adapter registered (${systemVersion() || "unknown version"}).`);
})();