/**
 * damage-hooks.mjs
 * ---------------------------------------------------------------------------
 * Substitui o "@mod" (modificador de atributo) usado nas fórmulas de dano
 * pela fórmula de dado equivalente (mesma tabela usada nos testes de D20).
 *
 * Diferente dos testes de D20, aqui NÃO existe a lógica de "melhor entre
 * atributo e proficiência" — dano nunca soma proficiência (a não ser que uma
 * feature específica faça isso por fora, o que não é o caso padrão do
 * sistema), então é só uma troca direta de bônus fixo por dado.
 *
 * Funciona porque o Foundry substitui "@mod" pelo texto do valor de
 * `data.mod` ANTES de interpretar a fórmula como dados — ou seja, se
 * `data.mod` for a string "1d6" em vez do número 4, a fórmula "1d8 + @mod"
 * se torna "1d8 + 1d6" e é interpretada normalmente como dois dados. É o
 * mesmo truque que o próprio sistema dnd5e já usa para a proficiência em
 * dado (`Proficiency.term`).
 */

import { abilityModToFormula } from "./dice-math.mjs";
import { MODULE_ID } from "./constants.mjs";

export function registerDamageHooks() {
  Hooks.on("dnd5e.preRollDamage", (config) => {
    if (!game.settings.get(MODULE_ID, "enableDamageVariant")) return;
    for (const rollLevelConfig of config.rolls ?? []) {
      const data = rollLevelConfig.data;
      if (!data || data.mod === undefined || data.mod === null) continue;
      if (data.mod === "0" || data.mod === 0) continue; // nada a converter, evita "+ 0" feio na fórmula.

      const modValue = Number(data.mod);
      if (!Number.isFinite(modValue)) continue; // já foi convertido antes, ou não é numérico.

      data.mod = abilityModToFormula(modValue);
    }
  });
}
