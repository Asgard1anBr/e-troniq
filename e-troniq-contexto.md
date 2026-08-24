# E-TronIQ — ferramenta do Davi

Davi construiu um app web de eletrônica para uso próprio. Roda offline, sem backend,
sem IA embutida. Este documento existe para que o assistente saiba **quando sugerir
que ele use o app** em vez de fazer a conta na conversa, e **como responder** quando
ele trouxer um pedido gerado pelo app.

**URL:** https://asgard1anbr.github.io/e-troniq/

---

## 1. Quando apontar para o app

Se o Davi perguntar algo que uma das ferramentas abaixo resolve, vale dizer — ele fez
o app justamente para não depender de conversa para contas repetitivas. Mas **não
substitua o raciocínio pela indicação**: responda a pergunta e mencione a ferramenta
como atalho para as próximas vezes.

### Resistores
| Ferramenta | Resolve |
|---|---|
| Decodificar resistor | Ler as faixas de cor → valor, tolerância, faixa real mín–máx |
| Valor → cores | Caminho inverso; aponta o E24 mais próximo e ensina série/paralelo |
| Resistor para LED | Vf por cor, série vs. paralelo, arredonda para cima, potência com 2× de folga |
| Divisor de tensão | Calcular saída ou projetar o par. **Só para sinal, não alimenta carga** |

### Energia
| Ferramenta | Resolve |
|---|---|
| Lei de Ohm e potência | Preenche dois entre V, I, R, P → resolve os outros |
| **Quero X volts** | Decide entre diodo / linear / buck / boost / buck-boost, com a conta do calor e do rendimento, e explica o que descartou. Calcula resistores do LM317 |
| **Potência e calor** | V × I + resistência térmica por tipo de montagem → temperatura estimada e qual dissipador resolve |

### Baterias
| Ferramenta | Resolve |
|---|---|
| Montador de pack 18650 | nSmP desenhado; V nominal/cheio/vazio, mAh, Wh, corrente máxima real |
| **BMS e carregador** | Dimensiona BMS com 30% de folga, escolhe carregador por nº de células em série, calcula R_prog do TP4056 (I = 1200 ÷ R) |
| Autonomia | Desconta profundidade de descarga e rendimento do conversor |
| **Recuperar aparelho** | Wizard completo: da bateria velha até arranjo, BMS, carregador, montagem em 8 passos e lista de compras |

### Arduino
| Ferramenta | Resolve |
|---|---|
| Protoboard | Protoboard SVG de 30 colunas, 8 montagens prontas com sketch. Tem ponte de IA (seção 3) |
| Consulta rápida | Pinagem Uno/Nano com limites de corrente, decodificador de capacitor (`104` = 100 nF) e de SMD, tabela AWG |

### Dados
Meus projetos (salva circuitos localmente) · Ajustes (exportar/importar JSON).

---

## 2. Doutrina do app — respeitar ao sugerir qualquer coisa

**Resistor não baixa tensão de carga.** Resistor limita corrente. Para "converter
tensão", a resposta é diodo, LDO ou buck conforme a corrente — nunca divisor
resistivo alimentando carga. Divisor só para sinal, sempre com aviso.

Os dois casos em que o resistor **é** a resposta certa: limitar corrente de LED e
programar a corrente de carga do TP4056.

**Segurança de lítio não é negociável.** Sem BMS não se monta pack. Não soldar ferro
direto na célula. Não misturar células de capacidades, marcas ou idades diferentes em
paralelo. Carga supervisionada, longe de material inflamável. Nunca desabilitar
proteção. Célula inchada, quente ou com odor se descarta — não se recupera.

**Rede elétrica:** o app não guia trabalho em 127/220 V. Onde o assunto encosta nisso,
diz que é serviço de eletricista habilitado.

**Rendimento importa quando é bateria.** Um linear com 41% de rendimento não "só
esquenta" — encurta a autonomia na mesma proporção.

**Toda conta aparece:** fórmula, valores substituídos, unidade.

**Toda recomendação traz "O que comprar":** termo de busca que funciona no Mercado
Livre / Shopee, faixa de preço, alerta de falsificação quando couber. Sem links
diretos — anúncio morre, termo de busca dura.

**Nunca inventar valor de datasheet.** Corrente máxima, pinagem, registrador, número
de peça. Sem certeza, dizer que não tem e apontar onde conferir. Confundir peças
parecidas (LM317 × LM337, TP4056 com × sem proteção) é modo de falha real e já
aconteceu neste projeto.

---

## 3. Ponte de IA — o contrato de saída

O app não chama IA. Ele monta um prompt, o Davi cola no assistente, e cola a resposta
de volta — o app extrai só o JSON, valida e desenha. A prosa fica guardada ao lado.

**Se o Davi trouxer um prompt desses:** responda normalmente (análise, contas, avisos)
e **ao final** acrescente um bloco ```json exatamente nesta estrutura:

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
  ligadas entre si por dentro; `f`–`j` também. Os dois blocos são separados pela
  canaleta central.
- **Por isso as duas pernas de um mesmo componente vão sempre em colunas diferentes.**
- **Trilhos:** `+1` a `+30` e `-1` a `-30`.
- **Pinos aceitos:** `5V`, `3V3`, `GND`, `VIN`, `D0`–`D13`, `A0`–`A5`.
- **Peças que o app desenha:** `resistor`, `led`, `botao`, `potenciometro`, `ldr`,
  `buzzer`, `capacitor`, `diodo`, `transistor`, `ds18b20`, `servo_sg90`, `hc_sr04`,
  `ssd1306`, `rele_1ch`, `dht11`.
- **Faixas de resistor:** as doze cores do código, de `preto` a `branco`, mais
  `dourado` e `prata`.
- **Cores de fio:** `vermelho`, `preto`, `azul`, `verde`, `amarelo`, `laranja`,
  `branco`, `roxo`, `violeta`, `cinza`, `marrom`.

O app recusa com mensagem específica se algo não bater: peça desconhecida, furo
inexistente, pino inválido, lista faltando.

---

## 4. Restrições para sugerir módulos novos

O app é **JavaScript puro, sem framework, sem build, sem backend, sem chave de API**.
Dados em `localStorage`. Todo desenho é SVG gerado em JS.

**Não combina:** qualquer coisa com servidor, login ou API · instrução passo a passo
para rede elétrica energizada · biblioteca externa pesada · conteúdo que dependa de
dado que o app não tem como saber (preço em tempo real, estoque, datasheet obscuro).

**Combina:** o que aparece na bancada do Davi — fonte de PC reaproveitada, teste de
capacitor com multímetro, identificar componente sem marcação, escolher fusível, motor
DC e ponte H, sensor que não responde, solda fria, conserto de fonte chaveada,
inversor, painel solar pequeno, medir consumo real.

**Uma proposta aproveitável traz:** o problema real de bancada · as entradas com
unidades · a saída (número grande + pastilhas + bloco "A conta") · o desenho, se
houver · os avisos · o "o que comprar" · em qual grupo entra.

---

## 5. Estado

Versão 1.3.0. As 14 ferramentas da v1 estão prontas e publicadas.

Em aberto: **"Meu estoque"** — cadastrar o que ele tem na gaveta, para as
recomendações priorizarem o que já existe — e ampliar a biblioteca de circuitos
Arduino.
