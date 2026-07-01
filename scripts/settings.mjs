/**
 * settings.mjs
 * ---------------------------------------------------------------------------
 * Configurações do módulo. Três toggles para o mestre poder isolar cada
 * parte da variante durante os testes (ex.: desligar só o dano, sem desligar
 * o resto), e um ajuste automático da configuração nativa de "Proficiência
 * em Dado" do próprio sistema dnd5e — puramente estético, só pra ficha do
 * personagem mostrar "1d4" em vez de "+2" no rótulo de proficiência. A
 * fórmula real usada na rolagem NÃO depende dessa configuração nativa; ela é
 * recalculada do zero por este módulo (ver dice-math.mjs).
 *
 * TIMING DA SETTING DE PROFICIÊNCIA (leia antes de mexer aqui):
 *   O dnd5e prepara os dados dos atores logo após o hook `setup`. Se a gente
 *   só mudar a setting em `ready` (como estava antes), os atores já derivaram
 *   com o modo "bonus" e a ficha mostra "+2" em vez de "1d4" até o próximo
 *   reload. Dividimos em duas funções:
 *     alignNativeProficiencyDisplayEarly  → chamada em `setup`, muda a setting
 *     notifyProficiencyDisplayAligned     → chamada em `ready`, mostra aviso
 */

import { MODULE_ID } from "./constants.mjs";

export function registerSettings() {
  game.settings.register(MODULE_ID, "enableD20Variant", {
    name: "DND5EDM.Settings.EnableD20Variant.Name",
    hint: "DND5EDM.Settings.EnableD20Variant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "enableDamageVariant", {
    name: "DND5EDM.Settings.EnableDamageVariant.Name",
    hint: "DND5EDM.Settings.EnableDamageVariant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "enableForwardInspiration", {
    name: "DND5EDM.Settings.EnableForwardInspiration.Name",
    hint: "DND5EDM.Settings.EnableForwardInspiration.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

/**
 * Flag de módulo: indica que a setting foi mudada nesta sessão e a
 * notificação ainda precisa ser exibida no ready.
 * @type {boolean}
 */
let _proficiencySettingChangedThisSession = false;

/**
 * Chamada no hook `setup` (antes dos atores derivarem dados).
 * Garante que proficiencyModifier já é "dice" quando os atores carregam,
 * evitando a necessidade de reload para a ficha mostrar os dados corretos.
 *
 * Nota: game.settings.set() é assíncrono (persiste no BD), mas a atualização
 * em memória é síncrona, então a leitura posterior via dnd5e.settings já
 * retorna "dice" imediatamente — sem necessidade de await aqui.
 */
export function alignNativeProficiencyDisplayEarly() {
  if (!game.user?.isGM) return;
  try {
    if (game.settings.get("dnd5e", "proficiencyModifier") !== "dice") {
      game.settings.set("dnd5e", "proficiencyModifier", "dice"); // sem await intencional
      _proficiencySettingChangedThisSession = true;
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | Não foi possível ajustar a configuração nativa de proficiência em dado.`, err);
  }
}

/**
 * Chamada no hook `ready` para exibir a notificação ao GM.
 * ui.notifications não existe antes do ready, por isso a notificação
 * fica separada da mudança de setting.
 */
export function notifyProficiencyDisplayAligned() {
  if (!game.user?.isGM || !_proficiencySettingChangedThisSession) return;
  ui.notifications.info(game.i18n.localize("DND5EDM.Notifications.ProficiencyDisplayAligned"));
}
