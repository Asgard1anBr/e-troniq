# E-TronIQ

Assistente de eletrônica para quem não é da área. Resistores, alimentação, baterias
18650/BMS, recuperação de aparelhos antigos e Arduino — sempre visual, sempre
explicando o porquê.

**App:** https://asgard1anbr.github.io/e-troniq/

## O que é

Um app web (PWA) em JavaScript puro: sem framework, sem build, sem npm, sem login.
Abre no navegador, instala como aplicativo no celular e funciona offline.
Os dados ficam no `localStorage` do próprio aparelho — há exportar/importar JSON
para backup e para levar os dados de um aparelho a outro.

## Ferramentas

| Grupo | Ferramenta | Status |
|---|---|---|
| Resistores | Decodificar pelas cores (4/5/6 faixas) | ✅ |
| Resistores | Valor → cores, com o valor comercial E24 | ✅ |
| Resistores | Resistor para LED | ✅ |
| Resistores | Divisor de tensão | ✅ |
| Energia | Lei de Ohm e potência | ✅ |
| Energia | Quero X volts (diodo / LDO / buck) | ✅ |
| Energia | Potência e calor (calcular ou avaliar temperatura medida) | ✅ |
| Energia | Essa chave aguenta DC? | ✅ |
| Energia | Meu motor não gira (diagnóstico) | ✅ |
| Baterias | Montador de pack 18650 (série/paralelo) | ✅ |
| Baterias | BMS e carregador (TP4056, R_prog) | ✅ |
| Baterias | Testar a BMS (quatro proteções) | ✅ |
| Baterias | Autonomia | ✅ |
| Baterias | Recuperar aparelho antigo | ✅ |
| Arduino | Protoboard com ponte de IA | ✅ |
| Arduino | Consulta rápida (pinagem, capacitores, SMD, AWG) | ✅ |
| Dados | Meus projetos | ✅ |

## Rodar localmente

```bash
python -m http.server 8123
```

Depois abra `http://localhost:8123`. Não há passo de build.

## Estrutura

```
index.html              casca do app e imports
css/styles.css          tema escuro, responsivo
js/app.js               toda a lógica
sw.js                   Service Worker (network-first + cache offline)
manifest.webmanifest    metadados do PWA
icons/                  ícones gerados a partir de logo.png
```

## Aviso

O E-TronIQ ajuda a entender e a calcular, mas não substitui um profissional.
Trabalho em rede elétrica é para eletricista habilitado. Baterias de lítio pegam
fogo quando maltratadas: não monte um pack sem BMS, não solde direto na célula,
não misture células de idades ou capacidades diferentes, e não carregue sem
supervisão.
