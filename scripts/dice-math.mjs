/**
 * dice-math.mjs
 * ---------------------------------------------------------------------------
 * Tabelas e funções puras que convertem bônus fixos (modificador de atributo
 * e bônus de proficiência) em fórmulas de dado, seguindo a variante de mesa
 * descrita pelo usuário. Nenhuma função aqui depende do Foundry — só de
 * matemática simples — então pode (e deve) ser testada fora do Foundry.
 *
 * TABELA DE ATRIBUTO (mod -> dado):
 *   mod <= 0        -> "0"        (sem dado, sem bônus)
 *   mod 1 ou 2       -> "1d4"
 *   mod 3            -> "1d6"
 *   mod 4            -> "1d8"
 *   mod 5            -> "1d10"
 *   mod 6            -> "1d12"
 *   mod 7            -> "1d12 + 1"
 *   mod 8            -> "1d12 + 2"
 *   ...cada ponto de mod acima de 6 soma +1 fixo ao d12.
 *
 * TABELA DE PROFICIÊNCIA (bônus de proficiência "cheio" do nível -> dado):
 *   +0 (sem proficiência) -> nenhum dado
 *   +2  -> "1d4"   (step 1)
 *   +3  -> "1d6"   (step 2)
 *   +4  -> "1d8"   (step 3)
 *   +5  -> "1d10"  (step 4)
 *   +6  -> "1d12"  (step 5)
 *
 * "Especialização" (multiplicador 2, ex.: Expertise) sobe 1 grau nessa mesma
 * progressão (ex.: +4 → 1d8 vira 1d10). "Meia proficiência" (multiplicador
 * 0.5, ex.: Jack of All Trades, Half Proficiency) desce 1 grau (ex.: +4 →
 * 1d8 vira 1d6). Isso é uma extrapolação livre pedida pelo usuário, não é
 * regra oficial de D&D nem comportamento nativo do sistema dnd5e.
 *
 * Acima de "1d12" (grau 5) a progressão continua somando +1 fixo por grau
 * extra, do mesmo jeito que a tabela de atributo faz acima de mod 6. Isso é
 * uma extrapolação minha para cobrir Expertise no nível 20 (prof +6 -> grau 5
 * -> Expertise sobe pra grau 6 = "1d12 + 1"). Ajuste aqui se quiser outra regra.
 */

/** Dado de cada "grau" da progressão de proficiência/atributo, grau 0 = nada. */
const STEP_DICE = ["0", "1d4", "1d6", "1d8", "1d10", "1d12"];

/**
 * Converte um número de grau (0 = nada, 1 = d4, ..., 5 = d12, 6+ = d12+N) em fórmula.
 * @param {number} step
 * @returns {string}
 */
export function stepToFormula(step) {
  if (!Number.isFinite(step) || step <= 0) return "0";
  if (step < STEP_DICE.length) return STEP_DICE[step];
  const extra = step - (STEP_DICE.length - 1);
  return `1d12+${extra}`;
}

/**
 * Converte o modificador de atributo (número, pode ser negativo) na fórmula de dado.
 * @param {number} mod
 * @returns {string}
 */
export function abilityModToFormula(mod) {
  mod = Number(mod) || 0;
  if (mod <= 0) return "0";
  if (mod <= 2) return "1d4";
  if (mod === 3) return "1d6";
  if (mod === 4) return "1d8";
  if (mod === 5) return "1d10";
  if (mod === 6) return "1d12";
  return `1d12+${mod - 6}`;
}

/** Mapa do bônus de proficiência "cheio" (2 a 6) para o grau na tabela. */
const BASE_PROFICIENCY_TO_STEP = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };

/**
 * Calcula a fórmula de dado de proficiência a partir dos valores "crus" de
 * um objeto Proficiency do dnd5e (ou de qualquer objeto com a mesma forma).
 * @param {{multiplier: number, _baseProficiency: number}|null|undefined} proficiency
 * @returns {string|null} Fórmula de dado, ou null se o personagem não tem proficiência alguma.
 */
export function proficiencyToFormula(proficiency) {
  if (!proficiency) return null;
  const multiplier = Number(proficiency.multiplier ?? 0);
  const base = Number(proficiency._baseProficiency ?? 0);
  if (multiplier <= 0 || base <= 0) return null;

  let step = BASE_PROFICIENCY_TO_STEP[base];
  // Caso o nível/CR gere um bônus fora da faixa usual (2-6), aproxima pelo mais próximo.
  if (step === undefined) {
    if (base < 2) step = 0;
    else step = 5 + (base - 6);
  }

  if (multiplier >= 2) step += 1;       // Especialização: sobe 1 grau.
  else if (multiplier > 0 && multiplier < 1) step -= 1; // Meia proficiência: desce 1 grau.

  step = Math.max(step, 0);
  if (step === 0) return null;
  return stepToFormula(step);
}

/**
 * Monta a fórmula final de um teste de D20 a partir das fórmulas de atributo
 * e proficiência, aplicando a regra de "fica com o melhor resultado entre o
 * atributo e a proficiência" quando ambos existem.
 * @param {string} abilityFormula   Resultado de abilityModToFormula (pode ser "0").
 * @param {string|null} profFormula Resultado de proficiencyToFormula (null = sem proficiência).
 * @returns {string|null} Parte de fórmula a ser somada ao d20, ou null se não há nada a somar.
 */
export function buildBestOfFormula(abilityFormula, profFormula) {
  const hasAbility = abilityFormula && abilityFormula !== "0";
  const hasProf = !!profFormula;

  if (!hasAbility && !hasProf) return null;
  if (hasAbility && !hasProf) return abilityFormula;
  if (!hasAbility && hasProf) return profFormula;

  // Ambos existem: agrupamento {a,b}kh fica com o maior resultado entre os dois.
  return `{${abilityFormula},${profFormula}}kh`;
}

export default {
  stepToFormula,
  abilityModToFormula,
  proficiencyToFormula,
  buildBestOfFormula
};
