# E-TronIQ — app web (PWA, JS puro)

Assistente de eletrônica para quem **não** é da área: resistores, alimentação,
baterias 18650/BMS, recuperação de aparelhos antigos e Arduino. Linguagem fácil,
sempre visual, sempre com o "porquê".

Contexto permanente do projeto. Lido automaticamente toda sessão.

## Como trabalhar comigo neste projeto (regras)

1. **App web, PWA em JavaScript puro. SEM framework, SEM build, SEM npm.**
   Arquivos estáticos servidos direto. Nada de bundler/transpiler.
2. **Deploy é por git.** Eu (Claude) faço `git add/commit/push`. O usuário NÃO cola
   código em editor nenhum e NÃO precisa buildar. O GitHub Pages publica sozinho.
   Não prometa "testei no ar" — no máximo valido layout/JS isolado.
3. **Sem autenticação.** Dados em `localStorage` (por aparelho). Há Exportar/Importar
   JSON para backup e para transferir dados entre aparelhos.
4. **Versionamento — 5 pontos, sempre juntos a cada release:**
   `VERSAO` (app.js), `CHANGELOG` (app.js), número no `index.html`,
   e `CACHE` no `sw.js` + query strings `?v=` dos imports no `index.html`.
   Bump proporcional: ajuste pequeno = patch; feature = minor.
5. **Sempre prever breakpoints mobile** ao mexer no HTML/CSS.
6. **Responder em português, direto:** quando tiver info pra agir, aja; recomende uma
   opção em vez de listar todas.

## Regras de conteúdo (específicas deste app)

- **O usuário é iniciante em eletrônica.** Toda tela explica o *porquê* em uma frase,
  sem jargão solto. Jargão só depois de traduzido uma vez.
- **Resistor não baixa tensão de carga.** Resistor limita corrente. Onde o usuário
  quiser "converter tensão", recomendar diodo / LDO / conversor buck conforme a
  corrente — nunca divisor resistivo para alimentar carga. Divisor só para sinal,
  sempre com aviso.
- **Segurança de lítio não é negociável** e sai da doutrina do assistente
  "Eng. Marcos Aurélio" do usuário: sem BMS não se monta pack; não soldar direto na
  célula; não misturar células de capacidades/idades diferentes em paralelo; carga
  supervisionada; nunca desabilitar proteção. Avisos discretos, mas presentes.
- **Sempre mostrar a conta feita** (fórmula, valores substituídos, unidade).
- **Toda recomendação traz "O que comprar":** termo de busca que funciona no Mercado
  Livre / Shopee, faixa de preço típica e alerta de falsificação quando couber
  (TP4056 clone, 18650 "9800mAh" que não existe). **Sem links diretos** — link de
  anúncio morre, termo de busca dura.

## Ponte de IA (sem chave de API, sem custo)

O app **não** chama IA. Ele gera um **prompt** para o usuário colar no assistente dele
e depois colar a resposta de volta.

- O prompt gerado pelo app **anexa um contrato de saída** ao pedido: lista das peças
  que o app sabe desenhar + esquema JSON exato esperado.
- O assistente responde a análise em prosa **e** um bloco ```json ao final.
- O app cola tudo no campo "Colar resposta", **extrai só o JSON** e desenha; a prosa
  fica salva e exibida ao lado (é onde estão a explicação e os avisos).
- Sempre validar o JSON recebido e falhar com mensagem clara, nunca quebrar a tela.

## Arquitetura / arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Casca do app + imports (com `?v=` de cache-bust) |
| `css/styles.css` | Estilos (tema escuro, responsivo) |
| `js/app.js` | Toda a lógica (estado, telas, render, store localStorage) |
| `sw.js` | Service Worker (network-first + cache offline) |
| `manifest.webmanifest` | Metadados PWA |
| `icons/` | Ícones gerados a partir de `logo.png` |
| `logo.png` | Logo original enviado pelo usuário (fonte dos ícones) |

Padrão: registro `TOOLS` (cada ferramenta tem `render()` e `mount()`), `GRUPOS` para
a navegação, roteamento por `location.hash` e um `render()` central que injeta HTML
em `#app`. Sem roteador externo.

## Identidade visual

- Fundo `--bg #0B0E14`, cartões `--card #141922`, borda sutil, cantos ~18px.
- Gradiente da marca: ciano `#22D3EE` → violeta `#A855F7`. Âmbar `#F5A524` = aviso.
- Números gigantes em fonte monoespaçada; rótulo pequeno e cinza acima.
- Anéis de progresso com gradiente (estado de carga, tensão, corrente).
- Os três **pads** do logo são elemento de linguagem: ponto de conexão nos diagramas,
  terminal no pack de bateria, bullet nas listas.
- Sidebar só de ícones no PC; menu inferior no celular.

## Roadmap (13 ferramentas na v1, em 4 entregas)

1. **Entrega 1** — esqueleto, PWA, navegação, Resistores (decodificar, valor→cores,
   resistor de LED, divisor), Lei de Ohm, Ajustes com export/import. ✅
2. **Entrega 2** — Quero X volts (diodo/LDO/buck), potência e dissipação. ✅
3. **Entrega 3** — Pack 18650 S/P, BMS e carregador (TP4056 R_prog), autonomia,
   Assistente de recuperação de aparelho. ✅
4. **Entrega 4** — Protoboard Arduino (biblioteca + ponte de IA), consulta rápida
   (pinagem, capacitores, SMD, AWG), Meus projetos. ✅

## Armadilhas conhecidas (NÃO repetir)

- **Cache preso:** esquecer de bumpar o `CACHE` do SW e/ou as query strings `?v=`
  faz o app não atualizar. Sempre os dois.
- **Chave `}` sobrando em `<script>` inline quebra o script inteiro SEM erro visível.**
  Validar com `node --check`.
- **localStorage é por aparelho.** Exportar JSON num, Importar no outro.
- **PWA precisa de HTTPS** para instalar — o GitHub Pages já fornece.
- `.nojekyll` na raiz: sem ele o Pages ignora arquivos/pastas começando com `_`.

## Deploy (GitHub Pages)

- Repositório `e-troniq` (público), branch `main`, `index.html` na raiz.
- Settings → Pages → Deploy from a branch → `main` / `/root`.
- URL pública: `https://asgard1anbr.github.io/e-troniq/`
- Publicar = `git commit` + `git push`. Atualiza em ~1 min.
- `gh` CLI **não** está instalado na máquina do usuário.

## Versão atual

- Versão: 1.3.0
- Cache SW: `etroniq-v4`
- O histórico de versões vive no array `CHANGELOG` (app.js) e é renderizado em Ajustes.
  A versão também aparece embaixo do menu lateral (`.rail-versao`), linkando para Ajustes.
