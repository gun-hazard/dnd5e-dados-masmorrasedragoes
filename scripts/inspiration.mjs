/**
 * inspiration.mjs
 * ---------------------------------------------------------------------------
 * "Inspiração Adiante": sempre que, em QUALQUER teste de D20 (incluindo as
 * duas rolagens de vantagem/desvantagem), dois dos dados rolados mostrarem o
 * mesmo valor — independente de sucesso ou falha — o personagem ganha uma
 * Inspiração Adiante. Ela é obrigatoriamente gasta como vantagem forçada na
 * próxima rolagem de D20 desse personagem.
 *
 * Duas fases, em dois momentos diferentes do ciclo de uma rolagem:
 *
 *   1) CONCESSÃO  - depois que uma rolagem já foi resolvida (dados já
 *      rolados), olhamos os resultados e procuramos empates.
 *      -> checkForTiesAndGrant()
 *
 *   2) CONSUMO    - antes de uma NOVA rolagem ser avaliada, se o personagem
 *      tiver uma Inspiração Adiante pendente, forçamos vantagem nela e
 *      limpamos a flag.
 *      -> consumeForwardInspiration()
 *
 * LIMITAÇÕES CONHECIDAS (deixo registrado pra quem for testar/ajustar):
 *  - Dados "rerolados" (ex.: sortudo halfling, que re-rola 1s uma vez) usam
 *    a flag `result.rerolled` do Foundry para marcar o valor antigo; nós
 *    ignoramos esses valores antigos e olhamos só o resultado final de cada
 *    dado. Não testado a fundo com Sorte Halfling ativada — vale revisar.
 *  - Não temos UI própria (ainda) pra mostrar a Inspiração Adiante pendente
 *    no token/ficha; por enquanto ela só aparece via mensagem no chat e via
 *    a flag do ator (visível no console com `actor.getFlag(...)`).
 *  - A vantagem forçada SEMPRE vence, mesmo se a rolagem já tivesse
 *    desvantagem por algum outro motivo (não seguimos a regra de "vantagem e
 *    desvantagem se cancelam" pra essa inspiração específica). Se preferir
 *    que elas se cancelem normalmente, é só ajustar consumeForwardInspiration.
 */

import { MODULE_ID, FLAG_FORWARD_INSPIRATION } from "./constants.mjs";

/* -------------------------------------------- */
/*  Concessão (detectar empates)                 */
/* -------------------------------------------- */

/**
 * Coleta o resultado final (já resolvido) de cada dado "de teste" presente
 * numa Roll: o(s) d20, e qualquer dado de atributo/proficiência, incluindo
 * os que estão dentro de um pool {a,b}kh.
 * @param {Roll} roll
 * @returns {number[]}
 */
function collectCheckDieResults(roll) {
  const results = [];
  const DieClass = foundry.dice.terms.Die;
  const PoolClass = foundry.dice.terms.PoolTerm;

  const collectFromDie = die => {
    for (const r of die.results ?? []) {
      if (r.rerolled) continue; // ignora o valor "velho" de uma rerolagem (ex.: Sorte Halfling).
      results.push(r.result);
    }
  };

  for (const term of roll.terms ?? []) {
    if (term instanceof PoolClass) {
      for (const subRoll of term.rolls ?? []) {
        for (const subTerm of subRoll.terms ?? []) {
          if (subTerm instanceof DieClass) collectFromDie(subTerm);
        }
      }
    } else if (term instanceof DieClass) {
      collectFromDie(term);
    }
  }

  return results;
}

/**
 * Existe algum par de dados com o mesmo valor nessa rolagem?
 * @param {Roll} roll
 * @returns {boolean}
 */
function rollHasTie(roll) {
  const values = collectCheckDieResults(roll);
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) return true;
    seen.add(value);
  }
  return false;
}

/**
 * Verifica se alguma das rolagens fornecidas tem empate entre dados, e se
 * sim, concede a Inspiração Adiante ao ator (caso ele já não tenha uma
 * pendente).
 * @param {Roll[]} rolls
 * @param {Actor5e|null} actor
 */
export async function checkForTiesAndGrant(rolls, actor) {
  if (!actor) return;
  if (!game.settings.get(MODULE_ID, "enableForwardInspiration")) return;
  const tied = (rolls ?? []).some(roll => rollHasTie(roll));
  if (!tied) return;

  if (actor.getFlag(MODULE_ID, FLAG_FORWARD_INSPIRATION)) return; // já tinha uma pendente.

  await actor.setFlag(MODULE_ID, FLAG_FORWARD_INSPIRATION, true);

  ChatMessage.create({
    content: `<p>🎲 <strong>${actor.name}</strong> tirou dois dados iguais nesse teste e ganhou `
      + `<strong>Inspiração Adiante</strong>! A próxima rolagem de d20 recebe vantagem automaticamente.</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/* -------------------------------------------- */
/*  Consumo (vantagem forçada)                   */
/* -------------------------------------------- */

/**
 * Se o ator tiver uma Inspiração Adiante pendente, força vantagem na
 * primeira rolagem da lista (ainda não avaliada) e limpa a flag.
 * @param {Actor5e|null} actor
 * @param {D20Roll[]} rolls  Rolls já construídas, mas ainda não avaliadas.
 */
export function consumeForwardInspiration(actor, rolls) {
  if (!actor?.getFlag(MODULE_ID, FLAG_FORWARD_INSPIRATION)) return;

  const roll = rolls?.[0];
  if (!roll?.options) return;

  const ADV_MODE = roll.constructor?.ADV_MODE ?? { ADVANTAGE: 1 };
  roll.options.advantageMode = ADV_MODE.ADVANTAGE;
  if (typeof roll.configureModifiers === "function") roll.configureModifiers();

  actor.unsetFlag(MODULE_ID, FLAG_FORWARD_INSPIRATION);

  ChatMessage.create({
    content: `<p>✨ <strong>${actor.name}</strong> gastou a <strong>Inspiração Adiante</strong>: `
      + `esta rolagem recebe vantagem automaticamente.</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/* -------------------------------------------- */
/*  Registro dos hooks de concessão              */
/* -------------------------------------------- */

/**
 * Registra os hooks que disparam DEPOIS que uma rolagem de d20 já foi
 * avaliada, para checar empates e conceder a Inspiração Adiante. O consumo
 * (vantagem forçada) é registrado separadamente em d20-hooks.mjs, porque
 * precisa rodar ANTES da avaliação da próxima rolagem.
 */
export function registerInspirationGrantHooks() {
  const postEvaluationHooks = [
    "dnd5e.rollAbilityCheck",
    "dnd5e.rollSavingThrow",
    "dnd5e.rollSkill",
    "dnd5e.rollToolCheck",
    "dnd5e.rollAttack"
  ];

  for (const hookName of postEvaluationHooks) {
    Hooks.on(hookName, (rolls, data) => {
      const actor = data?.subject?.actor ?? data?.subject ?? null;
      checkForTiesAndGrant(rolls, actor);
    });
  }
}
