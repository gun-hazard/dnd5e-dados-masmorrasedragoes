/**
 * initiative-hooks.mjs
 * ---------------------------------------------------------------------------
 * Cobre os dois caminhos de rolagem de iniciativa no dnd5e 6.0.x:
 *
 *  CAMINHO A — sem diálogo (clique direto no tracker de combate):
 *    getInitiativeRollConfig → preConfigureInitiative → getInitiativeRoll
 *    → _cachedInitiativeRoll → preRollInitiative → super.rollInitiative
 *    → rollInitiative
 *
 *    Esse caminho NUNCA passa por preRollD20Test. Por isso precisamos de
 *    hooks próprios aqui.
 *
 *    preConfigureInitiative : transforma @mod/@prof em dados.
 *    preRollInitiative      : consome Inspiração Adiante (força vantagem)
 *                             + guarda referência ao roll para checar empates.
 *    rollInitiative (post)  : verifica empates no roll já avaliado e concede
 *                             Inspiração Adiante se necessário.
 *
 *  CAMINHO B — com diálogo (shift+clique, ou botão específico de iniciativa):
 *    getInitiativeRollConfig → preConfigureInitiative → D20Roll.build
 *    → preRollD20Test (hookNames: ["initiativeDialog","abilityCheck","d20Test"])
 *    → postD20TestRollConfiguration → avaliação → rollAbilityCheck (post)
 *
 *    Esse caminho SIM passa por preRollD20Test, mas como os hookNames usam
 *    "initiativeDialog" (minúsculo) e "abilityCheck" (minúsculo), o
 *    getRollKind original retornava null e ignorava a rolagem.
 *    Corrigido em d20-hooks.mjs (adicionamos "initiativeDialog" → "initiative").
 *
 *    Como preConfigureInitiative dispara para AMBOS os caminhos, e
 *    applyDiceVariant tem o guard varianteDadosApplied, a transformação
 *    só acontece uma vez, mesmo que preRollD20Test também dispare depois.
 */

import { applyDiceVariant } from "./d20-hooks.mjs";
import { consumeForwardInspiration, checkForTiesAndGrant } from "./inspiration.mjs";
import { MODULE_ID } from "./constants.mjs";

/**
 * Armazena o par {actor, roll} entre preRollInitiative e rollInitiative
 * para poder checar empates depois da avaliação.
 * Variável de módulo simples — funciona porque o Foundry é single-threaded.
 * @type {{actor: Actor5e, roll: D20Roll}|null}
 */
let _pendingInitiativeRoll = null;

export function registerInitiativeHooks() {

  // ── Caminho A e B ──────────────────────────────────────────────────────────
  // preConfigureInitiative dispara para os dois caminhos, antes do roll ser
  // construído. rollConfig.parts/data já têm @mod e @prof prontos aqui.
  Hooks.on("dnd5e.preConfigureInitiative", (actor, rollConfig) => {
    if (!game.settings.get(MODULE_ID, "enableD20Variant")) return;
    // "initiative" é o kind especial: resolveProficiency vai buscar init.prof.
    applyDiceVariant("initiative", { subject: actor }, rollConfig);
  });

  // ── Caminho A (sem diálogo) apenas ─────────────────────────────────────────
  // preRollInitiative: roll já construído, ainda não avaliado.
  Hooks.on("dnd5e.preRollInitiative", (actor, roll) => {
    // Consumo de Inspiração Adiante.
    if (game.settings.get(MODULE_ID, "enableForwardInspiration")) {
      consumeForwardInspiration(actor, [roll]);
    }
    // Guarda referência para checar empates após a avaliação.
    _pendingInitiativeRoll = { actor, roll };
  });

  // Após a avaliação: verifica empates e concede Inspiração Adiante.
  Hooks.on("dnd5e.rollInitiative", (actor) => {
    if (_pendingInitiativeRoll?.actor !== actor) return;
    checkForTiesAndGrant([_pendingInitiativeRoll.roll], actor);
    _pendingInitiativeRoll = null;
  });
}
