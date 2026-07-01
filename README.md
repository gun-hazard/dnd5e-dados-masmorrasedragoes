# D&D 5.5e - Sem Bônus apenas Dados Progressivos (Masmorras & Dragões)

Quer uma experiencia mais Caótica, alguns diriam Selvagem? 

Troque os valores Fixos dos Bônus por Dados. Existe essa regra variante aplicada 
para os bônus de proficiência, mas porque parar por aí? Aplique-a também nos
valores de atributos. Troque os bônus fixos também por dados e tenha uma experiência
de jogo mais explosiva e dinâmica.

---

## O que o módulo faz

Módulo para Foundry VTT (sistema `dnd5e`, testado contra a branch `6.0.x` /
versão `6.0.0`) que substitui bônus fixos por dados em progressão, mantendo
a curva de dificuldade dos testes de D&D praticamente igual.

**Não toca em nenhum arquivo de outros módulos.** Foi pensado para rodar ao
lado do `dnd-livro-jogador` (tradução PT-BR), mas não depende dele — funciona
com o sistema `dnd5e` em qualquer idioma.


### 1) Testes de D20 (TODOS: atributo, resistência, perícia, ferramenta, ataque)

Em vez de somar modificador de atributo + bônus de proficiência como números
fixos, a rolagem soma o **melhor resultado entre um dado de atributo e um
dado de proficiência** (quando há proficiência) — análogo à vantagem, mas
entre dois dados de tamanhos diferentes via sintaxe de "pool" do Foundry:
`{1d8,1d6}kh`.

| Atributo (mod) | Dado    | Proficiência (bônus "cheio") | Dado   |
|---|---|---|---|
| -1 a 0  | nenhum  | (sem proficiência) | nenhum |
| 1 a 2   | 1d4     | +2  | 1d4  |
| 3       | 1d6     | +3  | 1d6  |
| 4       | 1d8     | +4  | 1d8  |
| 5       | 1d10    | +5  | 1d10 |
| 6       | 1d12    | +6  | 1d12 |
| 7+      | 1d12+(mod-6) | — | — |

- **Especialização** (Expertise, multiplicador x2 de proficiência): sobe 1
  grau na tabela de proficiência (ex.: 1d8 → 1d10).
- **Meia proficiência** (Jack of All Trades, Half Proficiency, multiplicador
  0.5): desce 1 grau (ex.: 1d8 → 1d6). Em proficiência +2, meia proficiência
  vira "nenhum dado" — é uma extrapolação minha, ver seção de limitações.
- **Vantagem/Desvantagem continuam funcionando normalmente** — são
  aplicadas no dado de D20 em si (2d20kh1/kl1), independente desse cálculo.

METAJOGO: 
1. Mantém a curva de testes quase inalterada, talvez com leve "nerfada" 
em níveis altos. Uma vez que um o valor máximo alcançado nos testes será 32 
(20 no D20 e 12 no D12).

### 2) Dano

O modificador de atributo somado ao dano também vira dado, pela mesma
tabela. Proficiência nunca entra no dano (como no D&D normal), então aqui
não há "melhor dos dois" — é só troca direta de bônus fixo por dado.

METAJOGO: 
1. Aqui o negócio pode errar a mão um pouco, do mesmo jeito que os 
dados podem cair valores muito baixos também podem cair muito altos.
Se perceber que os combates estão acabando muito rápido considere utilizar os 
dados de Pontos de Vida CHEIOS em vez de "metade +1" incluindo monstros
2. Outra consideração é o Crítico não deixe dobrar os dados do Atributo no dano,
apenas o da arma. Uma sugestão bacana é considerar o dado Máximo da arma uma vez e
jogar apenas o segundo dado (Já tem regra variante para isso no Foundry), por
exemplo um Guerreiro com Força 17 (1d6) usando uma espada longa (1d8), tira um
acerto crítico ele rola 1d8+1d6+8 em vez de 2d8+1d6.

### 3) Inspiração Adiante

Em qualquer teste de D20 (incluindo as duas rolagens de
vantagem/desvantagem), se dois dos dados rolados saírem com o mesmo valor —
com sucesso ou fracasso — o personagem ganha **Inspiração Adiante**. Ela é
**obrigatoriamente** gasta como vantagem forçada na próxima rolagem de d20
desse personagem (e some depois de usada).

Por enquanto isso é só uma flag no ator + mensagens no chat (concessão e
consumo). Não tem indicador visual na ficha/token ainda — ver Roadmap.

METAJOGO: 
1. O Inspiração Adiante serve para "equilibrar" as marés de azar. Como
existe a possibilidade de sempre cairem dados baixos em TODOS os testes
não existindo uma margem segura dos bônus fixos para garantir sempre um
resultado próximo de 10 como acontecia. A possibilidade de rolar outra
alternativa com vantagem, sempre que valores iguais (que sempre serão
abaixo de 12) cairem garante um fio de esperança mediante um resultado
baixo.
"Errei esta tentativa, mas a próxima será implacável"

### Bônus: ficha exibe proficiência como dado

O módulo ativa a configuração nativa do sistema dnd5e que mostra a
proficiência como dado na ficha (`+2` → `1d4` etc.) — isso é **só visual**.
A fórmula real da rolagem é sempre recalculada pelo módulo, independente
dessa configuração.

### Configurações (Configurar Mundo > Módulos > este módulo)

Três toggles, todos ligados por padrão, para isolar cada parte durante os
testes:
- Dados em testes de D20
- Dados em dano
- Inspiração Adiante

---

## Estrutura dos arquivos

```
dnd5e-dados-masmorrasedragoes/
  module.json
  lang/
    pt-BR.json
    en.json
  scripts/
    main.mjs           - registra tudo no init/ready
    constants.mjs       - ID do módulo e nomes de flags
    settings.mjs         - configurações + ajuste cosmético da ficha
    dice-math.mjs         - as tabelas puras (sem depender do Foundry)
    d20-hooks.mjs          - intercepta testes de atributo/resistência/perícia/
                             ferramenta/ataque e aplica a lógica do melhor dado
    damage-hooks.mjs        - intercepta dano e converte @mod em dado
    inspiration.mjs           - detecção de empate + concessão + consumo
                                 forçado de vantagem
```

## Por que `dice-math.mjs` é separado e "puro"

Esse arquivo não importa nada do Foundry — só matemática. Por isso ele pode
ser testado fora do Foundry, com Node puro:

```bash
node --input-type=module -e "
import { abilityModToFormula, proficiencyToFormula, buildBestOfFormula } from './scripts/dice-math.mjs';
console.log(abilityModToFormula(4));
console.log(proficiencyToFormula({multiplier:1, _baseProficiency:4}));
"
```

Se algum dia quiser ajustar a tabela (por exemplo, mudar o que acontece
acima de mod 6, ou mudar a regra de meia-proficiência), é só editar esse
arquivo — o resto do módulo não precisa mudar.

---

## Como instalar para testar

1. Copie a pasta `dnd5e-dados-masmorrasedragoes` para
   `{UserData}/Data/modules/` da sua instalação do Foundry (a pasta tem que
   se chamar exatamente `dnd5e-dados-masmorrasedragoes`, igual ao `id` no
   `module.json`).
2. Abra o mundo, vá em **Gerenciar Módulos** e ative:
   - `D&D 5.5e - Dados Progressivos (Masmorras & Dragões)`
   - (opcional, mas recomendado) `Livro do Jogador` (dnd-livro-jogador)
3. Recarregue o mundo.

## Como testar (roteiro sugerido)

1. **Teste de atributo simples** (sem proficiência): a fórmula deve mostrar
   só o dado de atributo (ex.: personagem com FOR 16 → mod +3 → "1d20 +
   1d6").
2. **Perícia com proficiência**: deve aparecer o pool `{dadoAtributo,
   dadoProficiência}kh` — confira no chat que o resultado usado foi mesmo o
   maior dos dois.
3. **Perícia com Especialização** (ex.: Roubar de Ladino): confirme que o
   dado de proficiência subiu 1 grau em relação ao normal daquele nível.
4. **Jack of All Trades / Half Proficiency** numa perícia sem proficiência
   completa: confirme que o dado de proficiência desceu 1 grau (ou
   desapareceu, se já estava em 1d4).
5. **Ataque com arma**: confirme que a rolagem de ataque também usa a
   lógica do melhor dado (não só os testes do personagem).
6. **Vantagem/Desvantagem**: confirme que ainda funcionam normalmente (2d20)
   junto com a lógica de melhor dado.
7. **Dano**: ataque que acerta e confirme que o dano usa dado em vez de
   bônus fixo de atributo.
8. **Inspiração Adiante**: force (ou tente repetidamente até sair) um
   empate entre dois dados de um teste — confirme a mensagem de concessão
   no chat, e que a PRÓXIMA rolagem de d20 desse personagem sai com
   vantagem automaticamente (e a mensagem de consumo aparece).
9. Teste com cada configuração desligada individualmente, pra confirmar que
   cada toggle isola a parte certa.

---

## Limitações conhecidas / decisões que talvez você queira revisar

- **Meia proficiência em proficiência +2** (nível 1-4) vira "nenhum dado".
  É uma extrapolação direta da regra "desce 1 grau", mas pode parecer
  punitivo demais nesses níveis. Se preferir outra coisa (ex.: sempre pelo
  menos 1d4), é só ajustar `proficiencyToFormula` em `dice-math.mjs`.
- **Progressão acima de Especialização no nível 20** (prof +6 → 1d12 →
  Especialização → "1d12+1"): não existe regra oficial equivalente pra eu
  copiar, então extrapolei a mesma lógica da tabela de atributo (cada grau
  extra soma +1 fixo). Mesmo lugar pra ajustar se quiser outra curva.
- **Vantagem forçada da Inspiração Adiante** sempre vence, mesmo se a
  rolagem já tivesse desvantagem por outro motivo (não segui a regra de
  "vantagem e desvantagem se cancelam" especificamente pra essa inspiração).
  Ajustável em `consumeForwardInspiration` (`inspiration.mjs`).
- **Atores transformados/polimorfados** com perícias mescladas (ex.:
  Forma Selvagem com a opção de manter perícias) podem não calcular a
  proficiência "mesclada" com 100% de fidelidade ao que o sistema faria
  nativamente — é um caso de borda que não testei a fundo.
- **Sorte Halfling** (re-rolar 1s) na detecção de empate da Inspiração
  Adiante: o código ignora o valor "velho" de um dado rerolado, mas não foi
  testado a fundo com esse traço ativo.
- **Sem indicador visual** de Inspiração Adiante pendente na ficha/token —
  só mensagens de chat e a flag do ator (`actor.getFlag("dnd5e-dados-masmorrasedragoes",
  "inspiracaoAdiante")`, visível no console de desenvolvedor F12).
- **Diálogo interativo de rolagem** (quando você NÃO usa o atalho que pula
  o diálogo) para perícia/ferramenta/ataque é o caminho menos testado dessa
  implementação, porque a parte interna do Foundry que constrói a fórmula
  nesse caso ("buildConfig") é "embrulhada" por este módulo em vez de
  reescrita do zero — funciona pela lógica do código, mas meu acesso pra
  testar dentro do Foundry de verdade é limitado, entao essa é a primeira
  parte a observar com atenção nos seus próprios testes.

## Roadmap (não implementado ainda, mas dá pra pedir depois)

- Indicador visual de Inspiração Adiante na ficha do personagem / HUD do
  token, em vez de só flag + chat.
- Card de chat customizado mostrando os dois dados (atributo x
  proficiência) lado a lado, com o vencedor destacado, em vez do card
  padrão do sistema.
- Tela de configuração própria pra editar a tabela de progressão sem
  precisar editar `dice-math.mjs` na mão.
- Compatibilidade explícita com os Talentos de Maestria de Arma do sistema
  (Weapon Mastery) e outras fontes de bônus condicional que ainda não
  testei.
