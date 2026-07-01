/**
 * constants.mjs
 * ---------------------------------------------------------------------------
 * Constantes compartilhadas entre todos os arquivos do módulo. Centralizar
 * aqui evita digitar a string do id errado em algum arquivo e settings/flags
 * "sumirem" silenciosamente (erro clássico e chato de depurar no Foundry).
 */

/** Precisa ser exatamente igual ao "id" em module.json e ao nome da pasta. */
export const MODULE_ID = "dnd5e-dados-masmorrasedragoes";

/** Nome da flag de ator usada para controlar a Inspiração Adiante pendente. */
export const FLAG_FORWARD_INSPIRATION = "inspiracaoAdiante";
