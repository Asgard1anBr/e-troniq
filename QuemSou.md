# QuemSou.md — apresentação do E-TronIQ

> Documento de contexto para **outros assistentes**. Se você é um agente de eletrônica
> trabalhando com o Davi, leia isto para saber o que ele já tem à disposição, o que o
> app resolve sozinho, e como propor coisas novas que encaixem.

---

## 1. O que é

**E-TronIQ** é um app web (PWA) de eletrônica, feito para o **Davi**, que é iniciante
na área. Roda no navegador, instala como aplicativo no celular, funciona offline e é
público:

**https://asgard1anbr.github.io/e-troniq/**

Não é um livro nem uma calculadora genérica. É um **assistente de bancada**: o usuário
diz o que tem e o que quer, e o app devolve a peça certa, a conta feita, o desenho e o
termo de busca para comprar no Mercado Livre ou na Shopee.

### Para quem é

Uma pessoa que **não é da área** e quer:

- recuperar aparelhos antigos de bateria (aspirador, parafusadeira, lanterna);
- montar packs 18650 em série e paralelo, com BMS e carregador;
- entender resistores, LEDs e alimentação sem decorar fórmula;
- brincar de Arduino sem depender de tutorial de vídeo.

### Como ele fala

- Português direto; jargão só depois de traduzido uma vez.
- **Toda tela explica o porquê** em uma frase.
- **Toda conta aparece**: fórmula, valores substituídos, unidade.
- **Toda recomendação traz "O que comprar"**: termo de busca que funciona, faixa de
  preço e alerta de falsificação quando couber. Sem links diretos — link de anúncio
  morre em semanas, termo de busca dura.

---

## 2. As 17 ferramentas que já existem

Antes de sugerir algo novo, confira se não está aqui. Cada ferramenta tem tela própria,
endereçada por `#/t/<id>`.

### Resistores (cor ciano)

| id | Nome | O que faz |
|---|---|---|
| `decodificar` | Decodificar resistor | Resistor grande em SVG; o usuário toca na listra e escolhe a cor. 4, 5 ou 6 faixas. Devolve valor, código curto (`2k2`), tolerância e a faixa real mín–máx. |
| `valorCores` | Valor → cores | O caminho inverso. Aponta o valor comercial E24 mais próximo quando o pedido não existe para comprar, e ensina série/paralelo para compor valores. |
| `led` | Resistor para LED | Cor do LED (Vf de tabela), fonte, corrente, quantidade, série ou paralelo. Devolve o resistor comercial arredondado **para cima**, a potência com folga de 2× e as cores desenhadas. Avisa que LED em paralelo exige um resistor por LED. |
| `divisor` | Divisor de tensão | Dois modos: calcular a saída, ou projetar o par a partir da saída desejada. Aviso vermelho no topo de que **não alimenta carga**. |

### Energia (cor âmbar)

| id | Nome | O que faz |
|---|---|---|
| `ohm` | Lei de Ohm e potência | Preenche dois campos quaisquer entre V, I, R e P; resolve os outros dois. |
| `quantosVolts` | Quero X volts | Entrada, saída, corrente e se a fonte é bateria. Decide entre **diodo, regulador linear, buck, boost ou buck-boost**, mostra a conta do calor e do rendimento, e explica por que descartou as outras. Calcula os resistores do LM317 quando cai nele. |
| `dissipacao` | Potência e calor | Duas abas. **Vai esquentar?** — V × I mais resistência térmica da montagem: temperatura estimada e qual dissipador resolveria. **Medi, está normal?** — a conta ao contrário, para quem usou termômetro infravermelho: veredito por faixa, com faixas mais apertadas para célula de lítio, e as duas armadilhas do termômetro IR. |
| `chaveDC` | Essa chave aguenta DC? | O rating impresso na chave é em AC. Distingue os dois regimes: abaixo de 15 V o arco não se sustenta e o limite é térmico; acima, o arco se sustenta porque em DC não há passagem por zero, e a capacidade despenca. Devolve SERVE / MARGINAL / NÃO SERVE, exigindo o dobro da corrente contínua. |
| `motorDC` | Meu motor não gira | Wizard por sintoma (parado, tranco, fraco, esquenta). Entrega o teste da pilha AA, a resistência girando o eixo, a medição no terminal do motor e a armadilha da fonte ATX. Mais a limpeza de motor com vazamento alcalino. |

### Baterias (cor verde)

| id | Nome | O que faz |
|---|---|---|
| `pack` | Montador de pack 18650 | nSmP desenhado célula por célula. Devolve V nominal/cheio/vazio, mAh, Wh e a corrente máxima real das células. Li-ion e LiFePO4. |
| `bmsTeste` | Testar a BMS | Checklist executável dos quatro testes de proteção — sobredescarga, recuperação, sobrecorrente e curto — com critérios calculados pela química e pelo S. Marca passou/falhou, guarda no aparelho e salva o laudo em Meus projetos. Sugere PTC como segunda barreira. |
| `bms` | BMS e carregador | Dimensiona a BMS com 30% de folga, escolhe o carregador pela quantidade de células em série e calcula o **R_prog do TP4056** (`I = 1200 ÷ R`), com as cores do resistor desenhadas. Avisa quando a corrente pedida excede o que as células entregam. |
| `autonomia` | Autonomia | Desconta profundidade de descarga e rendimento do conversor. Anel de progresso e tabela de cenários. |
| `recuperar` | Recuperar aparelho | O wizard. Da tensão da bateria velha e da corrente do aparelho até o arranjo, a BMS, o carregador, a ordem de montagem em 8 passos e a lista de compras. **Gera um prompt pronto** para o usuário levar o projeto a um assistente de IA. |

### Arduino (cor violeta)

| id | Nome | O que faz |
|---|---|---|
| `protoboard` | Protoboard Arduino | Protoboard de 30 colunas desenhada em SVG, com furos endereçáveis. Oito montagens prontas com sketch completo. Mais a **ponte de IA** (seção 4). |
| `consulta` | Consulta rápida | Pinagem do Uno/Nano com os limites de corrente, decodificador de capacitor (`104` = 100 nF), decodificador de SMD (`103`, `1002`, `4R7`) e tabela AWG. |

### Dados (cor azul-acinzentada)

| id | Nome | O que faz |
|---|---|---|
| `projetos` | Meus projetos | Salva circuitos no aparelho, abre e apaga. |
| `ajustes` | Ajustes | Exportar/importar JSON, histórico de versões, instruções de instalação. Tela de sistema, não conta como ferramenta. |

---

## 3. Doutrina de conteúdo — respeite ao sugerir

Estas regras estão no `CLAUDE.md` e valem para qualquer módulo novo.

### Resistor não baixa tensão de carga

Resistor **limita corrente**. Onde o usuário quiser "converter tensão", a resposta é
diodo, LDO ou conversor buck conforme a corrente — **nunca** divisor resistivo para
alimentar carga. Divisor só para sinal, sempre com aviso.

Os dois lugares em que o resistor **é** a resposta certa, e o app trata assim: limitar
corrente de LED, e programar a corrente de carga do TP4056.

### Segurança de lítio não é negociável

Sai da doutrina do assistente "Eng. Marcos Aurélio" do próprio Davi:

- sem BMS não se monta pack;
- não soldar ferro direto na célula (solda ponto ou suporte com mola);
- não misturar células de capacidades, marcas ou idades diferentes em paralelo;
- carga supervisionada, longe de coisa inflamável;
- nunca desabilitar proteção;
- célula inchada, quente ou com cheiro se descarta, não se recupera.

Avisos discretos, mas presentes. Nunca omitidos para encurtar a tela.

### Rede elétrica

O app não guia ninguém em trabalho com 127/220 V. Onde o assunto encosta nisso (módulo
relé, por exemplo), ele diz claramente que é serviço de eletricista habilitado.

### Rendimento importa quando é bateria

Um regulador linear com 41% de rendimento não "só esquenta" — ele encurta a autonomia
na mesma proporção. Por isso o critério do app é mais duro quando a entrada é bateria.

---

## 4. A ponte de IA — é aqui que você entra

O E-TronIQ **não chama IA nenhuma**. Sem chave de API, sem custo, funciona offline. No
lugar disso ele usa uma ponte manual, em quatro passos:

1. O usuário descreve o que quer, em português comum.
2. O app monta um **prompt com contrato de saída** e o usuário copia.
3. Ele cola no assistente dele — provavelmente **você**.
4. Cola a resposta inteira de volta no app, que **extrai só o JSON**, valida e desenha.
   A prosa fica guardada e exibida ao lado do desenho.

### Se você receber um pedido desses, responda assim

Responda normalmente — análise técnica, contas, avisos de segurança — e **ao final**
acrescente um bloco de código marcado como `json`, exatamente nesta estrutura:

    {
      "titulo": "nome curto do circuito",
      "placa": "arduino_uno",
      "componentes": [
        {"id":"led1","tipo":"led","cor":"vermelho","pinos":["e10","e12"]},
        {"id":"r1","tipo":"resistor","rotulo":"220 Ω",
         "faixas":["vermelho","vermelho","marrom","dourado"],"pinos":["a12","a15"]}
      ],
      "ligacoes": [
        {"de":"D13","para":"b10","cor":"vermelho"},
        {"de":"b15","para":"GND","cor":"preto"}
      ],
      "codigo": "// sketch completo, compilável, comentado",
      "bibliotecas": ["OneWire 2.3.7"],
      "avisos": ["frases curtas de alerta"]
    }

### Regras do endereçamento

- **Furos:** letra + coluna, de `a1` a `j30`. As linhas `a`–`e` de uma mesma coluna são
  ligadas entre si por dentro; as linhas `f`–`j` também, e os dois blocos são separados
  pela canaleta central.
- **Por isso as duas pernas de um mesmo componente vão sempre em colunas diferentes.**
- **Trilhos de alimentação:** `+1` a `+30` e `-1` a `-30`.
- **Pinos do Arduino aceitos:** `5V`, `3V3`, `GND`, `VIN`, `D0`–`D13`, `A0`–`A5`.
- **Peças que o app sabe desenhar:** `resistor`, `led`, `botao`, `potenciometro`, `ldr`,
  `buzzer`, `capacitor`, `diodo`, `transistor`, `ds18b20`, `servo_sg90`, `hc_sr04`,
  `ssd1306`, `rele_1ch`, `dht11`.
- **Cores de faixa de resistor:** as doze do código de cores, de `preto` a `branco`,
  mais `dourado` e `prata`.
- **Cores de fio:** `vermelho`, `preto`, `azul`, `verde`, `amarelo`, `laranja`, `branco`,
  `roxo`, `violeta`, `cinza`, `marrom`.

O app recusa com mensagem específica quando algo não bate: peça desconhecida, furo
inexistente, pino inválido, lista faltando. Ele aceita o JSON com ou sem as cercas de
código.

---

## 5. Como o app é feito

Isto importa porque limita o que dá para sugerir.

| Restrição | Consequência prática |
|---|---|
| **JavaScript puro, sem framework** | Nada de React, Vue, npm ou bundler. |
| **Sem passo de build** | Arquivos estáticos servidos direto: o que está no repositório é o que roda. |
| **Sem backend e sem autenticação** | Nenhuma chamada de API, nenhuma chave, nenhum servidor. Tudo acontece no navegador. |
| **Dados em `localStorage`** | Por aparelho. Exportar/Importar JSON é o único jeito de transferir. |
| **Deploy por `git push`** | O GitHub Pages publica sozinho em cerca de um minuto. |

### Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Casca do app e imports, com `?v=` de cache-bust |
| `css/styles.css` | Tema escuro, responsivo |
| `js/app.js` | Toda a lógica, cerca de 3.000 linhas |
| `sw.js` | Service Worker, network-first |
| `manifest.webmanifest` | Metadados do PWA |
| `icons/` | Ícones gerados a partir de `logo.png` |
| `CLAUDE.md` | Regras permanentes do projeto |
| `QuemSou.md` | Este arquivo |

### Padrão de código

Cada ferramenta é um objeto no registro `TOOLS`:

    TOOLS.minhaFerramenta = {
      nome: 'Nome curto',
      desc: 'Uma frase, que aparece no cartão da home.',
      grupo: 'baterias',   // resistores | energia | baterias | arduino | ajustes
      icone: 'pack',       // chave do objeto ICONES
      pronto: true,
      st: { /* estado da tela */ },
      render() { return '...html...'; },
      mount(raiz) { /* liga os eventos dentro de raiz */ }
    };

Roteamento por `location.hash`, e um `render()` central que injeta HTML num contêiner
novo a cada desenho — os listeners morrem junto com ele. Isso foi um bug real: quando
os eventos eram registrados no elemento fixo, um clique chegou a disparar 528
renderizações.

### Identidade visual

- Fundo `#0B0E14`, cartões `#141922`, cantos de cerca de 18 px, brilho ambiente ao fundo.
- Gradiente da marca: ciano `#22D3EE` para violeta `#A855F7`. Âmbar `#F5A524` é aviso.
- Números gigantes em fonte monoespaçada, com rótulo pequeno e cinza acima.
- Anéis de progresso com gradiente.
- Os três **pads** do logo viram linguagem visual: ponto de conexão nos diagramas,
  terminal no pack de bateria, bullet nas listas, marcador de seção.
- Barra lateral só de ícones no PC, menu inferior no celular.

### Versionamento — cinco pontos, sempre juntos

`VERSAO` em app.js · `CHANGELOG` em app.js · número no `index.html` · `CACHE` no
`sw.js` · query strings `?v=` dos imports. Esquecer os dois últimos faz o app não
atualizar no aparelho de ninguém.

---

## 6. Como sugerir um módulo novo

Sugestões são bem-vindas. Para uma proposta ser aproveitável, ela precisa trazer:

1. **O problema real** — que dúvida de bancada isso resolve para alguém que não é da área.
2. **Entradas** — o que o usuário digita ou escolhe, com unidades.
3. **Saída** — o número grande, as pastilhas de apoio e o que vai no bloco "A conta".
4. **O desenho, se houver** — lembrando que tudo é SVG gerado em JavaScript puro.
5. **Os avisos** — o que pode dar errado, queimar ou pegar fogo.
6. **O que comprar** — termo de busca, faixa de preço, alerta de falsificação.
7. **Em qual grupo entra** — ou se precisa de um grupo novo.

### O que combina com o app

Coisas que aparecem na bancada do Davi: fonte de PC reaproveitada, teste de capacitor
com multímetro, identificar componente sem marcação, escolher fusível, motor DC e ponte
H, sensor que não responde, solda fria, conserto de fonte chaveada, inversor, painel
solar pequeno, medir consumo real de um aparelho.

### O que não combina

- Qualquer coisa que exija servidor, login ou chave de API.
- Instrução passo a passo para trabalho com rede elétrica energizada.
- Módulos que dependam de biblioteca externa pesada.
- Conteúdo que precise de dado que o app não tem como saber: preço em tempo real,
  estoque de loja, datasheet de peça obscura.

### Sobre regra prática e datasheet

Parte do conteúdo do app é **regra prática de engenharia**, não valor de folha de dados:
os limiares de arco em corrente contínua (15 e 30 V), as resistências térmicas por tipo
de montagem, as faixas de temperatura aceitável e a folga de 2× para chaves. Onde isso
acontece, a tela **diz que é estimativa** e manda conferir a especificação do fabricante.
Mantenha essa honestidade em qualquer módulo novo.

### Sobre datasheets

Nunca invente valor de datasheet — corrente máxima, pinagem, registrador, número de
peça. Se não tiver certeza, diga que não tem e aponte onde conferir. Confundir peças
parecidas (LM317 com LM337, TP4056 com e sem proteção) é modo de falha real e já
apareceu neste projeto.

---

## 7. Estado atual

- **Versão 1.4.0**, cache `etroniq-v5`.
- 17 ferramentas prontas e publicadas.
- A v1.4.0 nasceu de um projeto real de bancada: restauração de uma micro retífica com
  conversão de Ni-Cd para lítio. Cada um dos três módulos novos resolve uma dúvida que
  apareceu de verdade ali.
- Em aberto para as próximas versões: "Meu estoque" — cadastrar o que ele tem na
  gaveta, para as recomendações priorizarem o que já existe — e ampliar a biblioteca
  de circuitos do Arduino.
