/**
 * d20-hooks.mjs
 * ---------------------------------------------------------------------------
 * Intercepta TODAS as rolagens de D20 do sistema dnd5e (testes de atributo,
 * resistências, perícias, ferramentas e ataques) e substitui os bônus fixos
 * de modificador de atributo e de proficiência pelas fórmulas de dado
 * definidas em dice-math.mjs, mantendo o "melhor resultado entre os dois"
 * quando o personagem tem proficiência.
 *
 * COMO FUNCIONA POR BAIXO DOS PANOS (resumo para quem for dar manutenção):
 *
 * O sistema dnd5e monta cada rolagem de D20 com hookNames que sempre incluem
 * "d20Test" (testes de atributo, resistências, perícias, ferramentas E
 * ataques). Isso dispara o hook `dnd5e.preRollD20Test` em todos esses casos.
 *
 * Só que o MOMENTO em que os "parts"/"data" (ex.: "@mod", "@prof") ficam
 * disponíveis varia:
 *   - Testes de atributo e resistências: já vêm prontos quando o hook dispara.
 *   - Perícias, ferramentas e ataques: só são montados depois, dentro de uma
 *     função "buildConfig" (chamada pelo diálogo de rolagem ou no atalho que
 *     pula o diálogo). Por isso, para esses casos, "embrulhamos" essa função
 *     para rodar nossa transformação assim que ela terminar o trabalho dela.
 *
 * Depois, no hook `dnd5e.postD20TestRollConfiguration` (que dispara depois
 * que a Roll já foi construída, mas ANTES de ser avaliada/rolada), aplicamos
 * a "Inspiração Adiante" pendente, se houver, forçando vantagem nessa rolagem.
 */

import { abilityModToFormula, proficiencyToFormula, buildBestOfFormula } from "./dice-math.mjs";
import { MODULE_ID } from "./constants.mjs";
import { consumeForwardInspiration } from "./inspiration.mjs";

/* -------------------------------------------- */
/*  Identificação do tipo de rolagem             */
/* -------------------------------------------- */

/**
 * Descobre que tipo de teste de D20 está sendo rolado a partir dos hookNames.
 *
 * Atenção ao casing: o sistema usa "AbilityCheck"/"SavingThrow" com
 * maiúsculas nos testes diretos, mas "initiativeDialog"/"abilityCheck"
 * (minúsculos) no caminho de diálogo de iniciativa.
 *
 * @param {string[]} hookNames
 * @returns {"check"|"save"|"skill"|"tool"|"attack"|"initiative"|null}
 */
function getRollKind(hookNames = []) {
  if (hookNames.includes("attack")) return "attack";
  if (hookNames.includes("skill")) return "skill";
  if (hookNames.includes("tool")) return "tool";
  if (hookNames.includes("initiativeDialog")) return "initiative"; // antes de abilityCheck (minúsculo)
  if (hookNames.includes("AbilityCheck")) return "check";
  if (hookNames.includes("SavingThrow")) return "save";
  return null;
}

/* -------------------------------------------- */
/*  Resolução do ator e da proficiência          */
/* -------------------------------------------- */

/**
 * Resolve o ator relevante para a rolagem, independente do tipo.
 * @param {"check"|"save"|"skill"|"tool"|"attack"|"initiative"} kind
 * @param {object} process  Configuração de processo (config) recebida no hook.
 * @returns {Actor5e|null}
 */
function resolveActor(kind, process) {
  if (kind === "attack") return process.subject?.actor ?? null;
  return process.subject ?? null;
}

/**
 * Resolve o objeto Proficiency "cru" (com multiplier e _baseProficiency)
 * relevante para essa rolagem específica.
 * @param {"check"|"save"|"skill"|"tool"|"attack"|"initiative"} kind
 * @param {object} process           Configuração de processo (config) recebida no hook.
 * @param {object} rollLevelConfig   Configuração específica dessa rolagem (config.rolls[i]).
 * @returns {object|null}
 */
function resolveProficiency(kind, process, rollLevelConfig) {
  const actor = resolveActor(kind, process);
  if (!actor) return null;

  try {
    switch (kind) {
      case "check":
        return actor.system?.abilities?.[process.ability]?.checkProf ?? null;
      case "save":
        return actor.system?.abilities?.[process.ability]?.saveProf ?? null;
      case "skill":
      case "tool": {
        const abilityId = rollLevelConfig?.data?.abilityId ?? process.ability;
        const calc = dnd5e.dataModels?.actor?.CommonTemplate?.calculateSkillToolProficiency;
        return calc ? calc(actor, abilityId, process) : null;
      }
      case "attack":
        return process.subject?.item?.system?.prof ?? null;
      case "initiative":
        // O objeto Proficiency da iniciativa já está derivado no ator.
        return resolveActor(kind, process)?.system?.attributes?.init?.prof ?? null;
      default:
        return null;
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | Não foi possível resolver a proficiência para um teste de d20.`, err);
    return null;
  }
}

/* -------------------------------------------- */
/*  Transformação de parts/data                  */
/* -------------------------------------------- */

/**
 * Remove "@mod" e "@prof" de parts/data e injeta a fórmula combinada
 * (atributo, proficiência, ou o melhor dos dois) no lugar deles.
 * @param {"check"|"save"|"skill"|"tool"|"attack"|"initiative"} kind
 * @param {object} process
 * @param {object} rollLevelConfig  config.rolls[i] — é mutado diretamente.
 */
export function applyDiceVariant(kind, process, rollLevelConfig) {
  if (!rollLevelConfig) return;
  if (rollLevelConfig.options?.varianteDadosApplied) return; // evita aplicar duas vezes na mesma config.

  const parts = rollLevelConfig.parts ?? [];
  const data = rollLevelConfig.data ?? {};

  const hadMod = parts.includes("@mod");
  const hadProf = parts.includes("@prof");
  if (!hadMod && !hadProf) return; // nada pra fazer aqui (ex.: ataque com bônus "flat" configurado manualmente).

  const modValue = hadMod ? Number(data.mod ?? 0) : null;
  const proficiency = hadProf ? resolveProficiency(kind, process, rollLevelConfig) : null;

  const abilityFormula = modValue !== null ? abilityModToFormula(modValue) : null;
  const profFormula = hadProf ? proficiencyToFormula(proficiency) : null;

  const combined = buildBestOfFormula(abilityFormula ?? "0", profFormula);

  rollLevelConfig.parts = parts.filter(p => p !== "@mod" && p !== "@prof");
  delete data.mod;
  delete data.prof;

  if (combined && combined !== "0") rollLevelConfig.parts.push(combined);

  rollLevelConfig.data = data;
  rollLevelConfig.options ??= {};
  rollLevelConfig.options.varianteDadosApplied = true;
  rollLevelConfig.options.varianteDados = { abilityFormula, profFormula, combined };
}

/* -------------------------------------------- */
/*  Registro dos hooks                           */
/* -------------------------------------------- */

export function registerD20Hooks() {

  // 1) Transformação de @mod/@prof em dados, para qualquer teste de D20.
  Hooks.on("dnd5e.preRollD20Test", (config, dialog, message) => {
    const kind = getRollKind(config.hookNames);
    if (!kind) return;
    if (!game.settings.get(MODULE_ID, "enableD20Variant")) return;

    for (const rollLevelConfig of config.rolls ?? []) {
      // Testes de atributo/resistência já chegam com parts/data prontos aqui.
      if ((rollLevelConfig.parts ?? []).includes("@mod") || (rollLevelConfig.parts ?? []).includes("@prof")) {
        applyDiceVariant(kind, config, rollLevelConfig);
      }
    }

    // Perícias, ferramentas e ataques só montam parts/data dentro de buildConfig.
    // Embrulhamos a função original para rodar nossa transformação na sequência.
    const originalBuildConfig = dialog?.options?.buildConfig;
    if (originalBuildConfig && !originalBuildConfig.__varianteDadosWrapped) {
      const wrapped = function (process, rollLevelConfig, formData, index) {
        const result = originalBuildConfig.call(this, process, rollLevelConfig, formData, index);
        applyDiceVariant(kind, process, rollLevelConfig);
        return result;
      };
      wrapped.__varianteDadosWrapped = true;
      dialog.options.buildConfig = wrapped;
    }
  });

  // 2) Consumo forçado da "Inspiração Adiante", em qualquer teste de D20,
  //    depois que a Roll já foi construída (parts resolvidos), mas antes de
  //    ser avaliada. Funciona independente de diálogo ou atalho de rolagem.
  Hooks.on("dnd5e.postD20TestRollConfiguration", (rolls, config) => {
    const kind = getRollKind(config.hookNames);
    if (!kind) return;
    if (!game.settings.get(MODULE_ID, "enableForwardInspiration")) return;
    const actor = resolveActor(kind, config);
    if (!actor) return;
    consumeForwardInspiration(actor, rolls);
  });
}
