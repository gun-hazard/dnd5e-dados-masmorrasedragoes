/**
 * main.mjs
 * ---------------------------------------------------------------------------
 * Ponto de entrada do módulo.
 *
 * Ordem dos hooks:
 *   init   → registra settings e hooks de rolagem (antes de qualquer dado carregar)
 *   setup  → ajusta proficiencyModifier antes dos atores derivarem dados
 *   ready  → notifica o GM se a setting foi mudada nesta sessão
 */

import { registerSettings, alignNativeProficiencyDisplayEarly, notifyProficiencyDisplayAligned } from "./settings.mjs";
import { registerD20Hooks } from "./d20-hooks.mjs";
import { registerDamageHooks } from "./damage-hooks.mjs";
import { registerInspirationGrantHooks } from "./inspiration.mjs";
import { registerInitiativeHooks } from "./initiative-hooks.mjs";

Hooks.once("init", () => {
  console.log("dnd5e-dados-masmorrasedragoes | Inicializando.");
  registerSettings();
  registerD20Hooks();
  registerDamageHooks();
  registerInspirationGrantHooks();
  registerInitiativeHooks();
});

Hooks.once("setup", () => {
  alignNativeProficiencyDisplayEarly();
});

Hooks.once("ready", () => {
  notifyProficiencyDisplayAligned();
});
