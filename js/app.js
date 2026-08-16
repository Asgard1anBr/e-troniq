/* ==========================================================================
   E-TronIQ — assistente de eletrônica
   JavaScript puro, sem framework, sem build.
   ========================================================================== */

'use strict';

const VERSAO = '1.1.0';

const CHANGELOG = [
  {
    versao: '1.1.0',
    data: '2026-08-16',
    itens: [
      'Nova ferramenta “Quero X volts”: diga entrada, saída e corrente e o app indica diodo, regulador ou conversor.',
      'Nova ferramenta “Potência e calor”: quanto o componente esquenta e se precisa de dissipador.',
      'Cálculo dos resistores do LM317, já com as cores do resistor desenhadas.',
      'Histórico de versões nos Ajustes e número da versão embaixo do menu.'
    ]
  },
  {
    versao: '1.0.0',
    data: '2026-08-16',
    itens: [
      'Primeira versão: esqueleto do app, PWA instalável e navegação.',
      'Resistores: decodificar pelas cores (4, 5 e 6 faixas) com desenho interativo.',
      'Resistores: valor → cores, com o valor comercial (E24) mais próximo.',
      'Resistor para LED, com potência mínima e o que comprar.',
      'Divisor de tensão, com aviso de que não serve para alimentar carga.',
      'Lei de Ohm e potência.',
      'Ajustes com exportar/importar JSON.'
    ]
  }
];

/* ==========================================================================
   1. Utilidades
   ========================================================================== */

const $ = (sel, raiz) => (raiz || document).querySelector(sel);
const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));

/** Escapa texto que vai para dentro de HTML. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Aceita vírgula como separador decimal (é como o brasileiro digita). */
function num(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.').trim());
  return isFinite(n) ? n : NaN;
}

/** Arredonda para N algarismos significativos e formata sem zeros à toa. */
function sig(v, n) {
  if (!isFinite(v)) return '—';
  const x = Number(v.toPrecision(n || 3));
  return String(x).replace('.', ',');
}

/** 2200 -> "2,2 kΩ" */
function ohm(v) {
  if (!isFinite(v)) return '—';
  if (v >= 1e6) return sig(v / 1e6) + ' MΩ';
  if (v >= 1e3) return sig(v / 1e3) + ' kΩ';
  if (v >= 1) return sig(v) + ' Ω';
  return sig(v, 2) + ' Ω';
}

/** 2200 -> "2k2" (o código curto que aparece em esquemas e lojas) */
function codigoCurto(v) {
  let letra = 'R', div = 1;
  if (v >= 1e6) { letra = 'M'; div = 1e6; }
  else if (v >= 1e3) { letra = 'k'; div = 1e3; }
  const s = String(Number((v / div).toPrecision(3)));
  return s.indexOf('.') >= 0 ? s.replace('.', letra) : s + letra;
}

/** Volts, amperes, watts com prefixo automático. */
function unidade(v, u) {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e6) return sig(v / 1e6) + ' M' + u;
  if (a >= 1e3) return sig(v / 1e3) + ' k' + u;
  if (a >= 1) return sig(v) + ' ' + u;
  if (a >= 1e-3) return sig(v * 1e3) + ' m' + u;
  if (a >= 1e-6) return sig(v * 1e6) + ' µ' + u;
  return sig(v) + ' ' + u;
}

/** "2026-08-16" -> "16/08/2026" */
function dataBR(iso) {
  const p = String(iso || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || '');
}

function torrada(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('mostra');
  clearTimeout(torrada._t);
  torrada._t = setTimeout(() => t.classList.remove('mostra'), 2200);
}

function copiar(texto) {
  const ok = () => torrada('Copiado');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texto).then(ok, () => copiarFallback(texto, ok));
  } else copiarFallback(texto, ok);
}

function copiarFallback(texto, ok) {
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); ok(); } catch (e) { torrada('Não consegui copiar'); }
  document.body.removeChild(ta);
}

/* ---------- armazenamento (localStorage, por aparelho) -------------------- */

const PREFIXO = 'etroniq:';

const Store = {
  ler(chave, padrao) {
    try {
      const v = localStorage.getItem(PREFIXO + chave);
      return v == null ? padrao : JSON.parse(v);
    } catch (e) { return padrao; }
  },
  gravar(chave, valor) {
    try { localStorage.setItem(PREFIXO + chave, JSON.stringify(valor)); return true; }
    catch (e) { torrada('Sem espaço para salvar neste aparelho'); return false; }
  },
  apagar(chave) {
    try { localStorage.removeItem(PREFIXO + chave); } catch (e) { /* ignora */ }
  },
  tudo() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(PREFIXO) === 0) {
          try { out[k.slice(PREFIXO.length)] = JSON.parse(localStorage.getItem(k)); }
          catch (e) { /* ignora chave corrompida */ }
        }
      }
    } catch (e) { /* ignora */ }
    return out;
  },
  limpar() {
    Object.keys(this.tudo()).forEach((k) => this.apagar(k));
  }
};

/* ==========================================================================
   2. Ícones
   ========================================================================== */

const ICONES = {
  casa: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  resistor: '<path d="M2 12h3l2-5 3 10 3-10 3 10 2-5h4"/>',
  raio: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  bateria: '<rect x="2" y="7" width="16" height="10" rx="2.5"/><path d="M21 10v4"/><path d="M6 12h6"/><path d="M9 9v6"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  engrenagem: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  seta: '<path d="M15 18l-6-6 6-6"/>',
  led: '<path d="M12 2v3"/><path d="M7.5 9.5 12 5l4.5 4.5v4a4.5 4.5 0 0 1-9 0Z"/><path d="M9.5 21h5"/><path d="M10 18h4"/>',
  divisor: '<path d="M12 3v4"/><rect x="9" y="7" width="6" height="5" rx="1.5"/><path d="M12 12v2"/><rect x="9" y="14" width="6" height="5" rx="1.5"/><path d="M12 19v2"/><path d="M15 14h5"/>',
  paleta: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9.5" r="1.3"/><circle cx="15" cy="9.5" r="1.3"/><circle cx="8.5" cy="14.5" r="1.3"/><circle cx="14" cy="15" r="1.3"/>',
  regua: '<rect x="2.5" y="8" width="19" height="8" rx="2"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  conversor: '<path d="M4 8h11l-3-3"/><path d="M20 16H9l3 3"/>',
  pack: '<rect x="3" y="5" width="7" height="14" rx="2"/><rect x="14" y="5" width="7" height="14" rx="2"/><path d="M6.5 8v3M5 9.5h3M17.5 8v3"/>',
  escudo: '<path d="M12 3 4.5 6v6c0 4.4 3.1 8.2 7.5 9 4.4-.8 7.5-4.6 7.5-9V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  ferramenta: '<path d="M14.5 5.5a4.5 4.5 0 0 0 5.9 5.9L21 12l-8.5 8.5a2.1 2.1 0 0 1-3-3L18 9"/><path d="m3.5 3.5 4 4"/>',
  livro: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 18.5V21h16"/>',
  pasta: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18Z"/>',
  alerta: '<path d="M12 3.5 2.8 19.5h18.4L12 3.5Z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.4" r=".9" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="8" r=".9" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 3v12"/><path d="m7.5 11 4.5 4.5L16.5 11"/><path d="M4 20h16"/>',
  upload: '<path d="M12 20V8"/><path d="m7.5 12 4.5-4.5L16.5 12"/><path d="M4 4h16"/>'
};

function icone(nome, tam) {
  const d = ICONES[nome] || ICONES.info;
  const t = tam || 24;
  return '<svg viewBox="0 0 24 24" width="' + t + '" height="' + t + '" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
}

/* ==========================================================================
   3. Dados de eletrônica
   ========================================================================== */

/* Código de cores IEC 60062. tol = tolerância (%), tc = coef. de temperatura (ppm/°C) */
const CORES = [
  { id: 'preto',    nome: 'Preto',    hex: '#1c2028', digito: 0, mult: 1,    tc: 250 },
  { id: 'marrom',   nome: 'Marrom',   hex: '#7a4a2b', digito: 1, mult: 1e1,  tol: 1,    tc: 100 },
  { id: 'vermelho', nome: 'Vermelho', hex: '#e03131', digito: 2, mult: 1e2,  tol: 2,    tc: 50 },
  { id: 'laranja',  nome: 'Laranja',  hex: '#f2820c', digito: 3, mult: 1e3,             tc: 15 },
  { id: 'amarelo',  nome: 'Amarelo',  hex: '#f2c53d', digito: 4, mult: 1e4,             tc: 25 },
  { id: 'verde',    nome: 'Verde',    hex: '#2f9e44', digito: 5, mult: 1e5,  tol: 0.5,  tc: 20 },
  { id: 'azul',     nome: 'Azul',     hex: '#1c7ed6', digito: 6, mult: 1e6,  tol: 0.25, tc: 10 },
  { id: 'violeta',  nome: 'Violeta',  hex: '#8b5cf6', digito: 7, mult: 1e7,  tol: 0.1,  tc: 5 },
  { id: 'cinza',    nome: 'Cinza',    hex: '#9aa1ad', digito: 8, mult: 1e8,  tol: 0.05, tc: 1 },
  { id: 'branco',   nome: 'Branco',   hex: '#eef1f6', digito: 9, mult: 1e9 },
  { id: 'dourado',  nome: 'Dourado',  hex: '#c9a227',            mult: 0.1,  tol: 5 },
  { id: 'prata',    nome: 'Prata',    hex: '#b8bec9',            mult: 0.01, tol: 10 }
];

const corPorId = (id) => CORES.filter((c) => c.id === id)[0];

/* Série E24: os valores de resistor que realmente existem para comprar. */
const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];

/** Valor comercial E24 mais próximo (para cima e para baixo). */
function e24Proximos(v) {
  if (!isFinite(v) || v <= 0) return { abaixo: NaN, acima: NaN, perto: NaN };
  const lista = [];
  for (let e = -2; e <= 7; e++) {
    for (let i = 0; i < E24.length; i++) lista.push(E24[i] * Math.pow(10, e - 1));
  }
  lista.sort((a, b) => a - b);
  let abaixo = NaN, acima = NaN;
  for (let i = 0; i < lista.length; i++) {
    if (lista[i] <= v * 1.0001) abaixo = lista[i];
    if (lista[i] >= v * 0.9999 && !isFinite(acima)) acima = lista[i];
  }
  const perto = Math.abs(abaixo - v) <= Math.abs(acima - v) ? abaixo : acima;
  return { abaixo: abaixo, acima: acima, perto: perto };
}

/** Potência comercial de resistor imediatamente acima da dissipação calculada. */
const POTENCIAS = [
  { w: 0.125, nome: '1/8 W' }, { w: 0.25, nome: '1/4 W' }, { w: 0.5, nome: '1/2 W' },
  { w: 1, nome: '1 W' }, { w: 2, nome: '2 W' }, { w: 3, nome: '3 W' }, { w: 5, nome: '5 W' },
  { w: 10, nome: '10 W' }, { w: 20, nome: '20 W' }
];

/**
 * Escolhe a potência com folga de 2× (regra de bancada: nunca no limite).
 * Piso em 1/4 W porque é o resistor que de fato se compra em kit no Brasil —
 * indicar 1/8 W mandaria o usuário atrás de uma peça mais rara e mais cara.
 */
function potenciaRecomendada(dissipacao) {
  const alvo = dissipacao * 2;
  for (let i = 0; i < POTENCIAS.length; i++) {
    if (POTENCIAS[i].w >= alvo && POTENCIAS[i].w >= 0.25) return POTENCIAS[i];
  }
  return POTENCIAS[POTENCIAS.length - 1];
}

/* Tensão direta típica de LED por cor (Vf). Valores de catálogo comum de 5 mm. */
const LEDS = [
  { id: 'vermelho', nome: 'Vermelho', vf: 2.0, hex: '#e03131' },
  { id: 'laranja',  nome: 'Laranja',  vf: 2.0, hex: '#f2820c' },
  { id: 'amarelo',  nome: 'Amarelo',  vf: 2.1, hex: '#f2c53d' },
  { id: 'verde',    nome: 'Verde',    vf: 2.2, hex: '#2f9e44' },
  { id: 'azul',     nome: 'Azul',     vf: 3.2, hex: '#1c7ed6' },
  { id: 'branco',   nome: 'Branco',   vf: 3.2, hex: '#eef1f6' },
  { id: 'uv',       nome: 'Ultravioleta', vf: 3.4, hex: '#8b5cf6' },
  { id: 'ir',       nome: 'Infravermelho', vf: 1.4, hex: '#6b7688' }
];

/* Fontes comuns, para o usuário não precisar lembrar de cabeça. */
const FONTES = [
  { v: 3.3, nome: '3,3 V — ESP32 / lógica 3,3 V' },
  { v: 3.7, nome: '3,7 V — 1 célula 18650 (nominal)' },
  { v: 5,   nome: '5 V — USB / Arduino Uno' },
  { v: 9,   nome: '9 V — bateria 9 V' },
  { v: 12,  nome: '12 V — fonte / bateria de carro' }
];

/* ==========================================================================
   4. Desenho do resistor (SVG)
   ========================================================================== */

/* Posição horizontal de cada faixa conforme a quantidade de faixas. */
const LAYOUT_FAIXAS = {
  4: [98, 136, 174, 288],
  5: [98, 136, 174, 212, 288],
  6: [98, 136, 174, 212, 258, 296]
};

/**
 * Desenha o resistor.
 * @param {string[]} cores  ids de cor por faixa (ou null para faixa vazia)
 * @param {object} opc      { selecionada, interativo }
 */
function svgResistor(cores, opc) {
  const o = opc || {};
  const n = cores.length;
  const xs = LAYOUT_FAIXAS[n] || LAYOUT_FAIXAS[4];
  const uid = 'r' + Math.random().toString(36).slice(2, 8);

  let faixas = '';
  for (let i = 0; i < n; i++) {
    const c = cores[i] ? corPorId(cores[i]) : null;
    const x = xs[i];
    const sel = o.selecionada === i ? ' faixa-sel' : '';
    const clique = o.interativo ? ' data-faixa="' + i + '"' : '';
    const preenche = c
      ? '<rect x="' + (x - 11) + '" y="26" width="22" height="88" fill="' + c.hex + '"/>' +
        (c.id === 'dourado' || c.id === 'prata'
          ? '<rect x="' + (x - 11) + '" y="26" width="22" height="88" fill="url(#brilho' + uid + ')"/>'
          : '')
      : '<rect x="' + (x - 11) + '" y="26" width="22" height="88" fill="#8a7a5c" opacity=".35"/>' +
        '<rect x="' + (x - 11) + '" y="26" width="22" height="88" fill="none" stroke="#5a5140" ' +
        'stroke-width="2" stroke-dasharray="5 5"/>';

    faixas +=
      '<g class="faixa-alvo' + sel + '"' + clique + '>' +
        '<g clip-path="url(#corpo' + uid + ')">' + preenche + '</g>' +
        '<rect class="faixa-halo" x="' + (x - 14) + '" y="18" width="28" height="104" rx="7" ' +
          'fill="none" stroke="#22d3ee" stroke-width="2.5"/>' +
        (o.interativo
          ? '<rect x="' + (x - 16) + '" y="16" width="32" height="108" fill="transparent"/>'
          : '') +
      '</g>';
  }

  return '' +
  '<svg class="resistor-palco" viewBox="0 0 400 150" role="img" aria-label="Resistor com ' + n + ' faixas">' +
    '<defs>' +
      '<clipPath id="corpo' + uid + '"><rect x="70" y="26" width="260" height="88" rx="30"/></clipPath>' +
      '<linearGradient id="bege' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#e8d8ae"/><stop offset=".45" stop-color="#cdb98d"/>' +
        '<stop offset="1" stop-color="#a8946b"/></linearGradient>' +
      '<linearGradient id="fio' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#e2e8f2"/><stop offset="1" stop-color="#8d97a8"/></linearGradient>' +
      '<linearGradient id="brilho' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#ffffff" stop-opacity=".55"/>' +
        '<stop offset=".5" stop-color="#ffffff" stop-opacity="0"/>' +
        '<stop offset="1" stop-color="#000000" stop-opacity=".25"/></linearGradient>' +
    '</defs>' +
    // terminais, com os "pads" do logo nas pontas
    '<path d="M4 70h70M326 70h70" stroke="url(#fio' + uid + ')" stroke-width="7" stroke-linecap="round"/>' +
    '<circle cx="10" cy="70" r="9" fill="none" stroke="#22d3ee" stroke-width="4" opacity=".85"/>' +
    '<circle cx="390" cy="70" r="9" fill="none" stroke="#a855f7" stroke-width="4" opacity=".85"/>' +
    // corpo
    '<rect x="70" y="26" width="260" height="88" rx="30" fill="url(#bege' + uid + ')"/>' +
    faixas +
    '<rect x="70" y="26" width="260" height="88" rx="30" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2"/>' +
    '<rect x="70" y="26" width="260" height="34" rx="17" fill="#fff" opacity=".13"/>' +
  '</svg>';
}

/* ==========================================================================
   5. Cálculo do resistor
   ========================================================================== */

/**
 * Converte as faixas em valor.
 * n=4: 2 dígitos + multiplicador + tolerância
 * n=5: 3 dígitos + multiplicador + tolerância
 * n=6: 3 dígitos + multiplicador + tolerância + coef. de temperatura
 */
function lerFaixas(cores) {
  const n = cores.length;
  const nd = n === 4 ? 2 : 3;
  for (let i = 0; i < n; i++) if (!cores[i]) return { erro: 'faltando' };

  let digitos = 0;
  for (let i = 0; i < nd; i++) {
    const c = corPorId(cores[i]);
    if (c.digito == null) return { erro: 'A faixa ' + (i + 1) + ' não pode ser ' + c.nome.toLowerCase() + ' (não vale como dígito).' };
    digitos = digitos * 10 + c.digito;
  }

  const cm = corPorId(cores[nd]);
  if (cm.mult == null) return { erro: 'A faixa do multiplicador não pode ser ' + cm.nome.toLowerCase() + '.' };

  const ct = corPorId(cores[nd + 1]);
  if (ct.tol == null) return { erro: 'A faixa de tolerância não pode ser ' + ct.nome.toLowerCase() + '.' };

  let tc = null;
  if (n === 6) {
    const cc = corPorId(cores[5]);
    if (cc.tc == null) return { erro: 'A 6ª faixa não pode ser ' + cc.nome.toLowerCase() + '.' };
    tc = cc.tc;
  }

  const valor = digitos * cm.mult;
  return { valor: valor, tol: ct.tol, tc: tc, digitos: digitos, mult: cm.mult, nd: nd };
}

/** Converte um valor em faixas de cor. */
function valorParaFaixas(valor, tolPct, nFaixas) {
  if (!isFinite(valor) || valor <= 0) return { erro: 'Digite um valor maior que zero.' };
  const nd = nFaixas === 4 ? 2 : 3;

  let expo = Math.floor(Math.log10(valor)) - (nd - 1);
  let mant = Math.round(valor / Math.pow(10, expo));
  if (mant >= Math.pow(10, nd)) { mant = Math.round(mant / 10); expo += 1; }
  if (mant < Math.pow(10, nd - 1)) { mant = Math.round(mant * 10); expo -= 1; }

  const mult = Math.pow(10, expo);
  const cm = CORES.filter((c) => c.mult != null && Math.abs(c.mult - mult) < mult * 1e-9)[0];
  if (!cm) return { erro: 'Esse valor está fora da faixa que o código de cores cobre (0,01 Ω a 99 GΩ).' };

  const cores = [];
  const txt = String(mant);
  for (let i = 0; i < nd; i++) {
    const d = Number(txt.charAt(i));
    cores.push(CORES.filter((c) => c.digito === d)[0].id);
  }
  cores.push(cm.id);

  const ct = CORES.filter((c) => c.tol === tolPct)[0];
  if (!ct) return { erro: 'Tolerância sem cor definida.' };
  cores.push(ct.id);

  if (nFaixas === 6) cores.push('marrom'); // 100 ppm/°C, o caso comum

  return { cores: cores, valorExato: mant * mult };
}

/* ==========================================================================
   6. Blocos de interface reaproveitáveis
   ========================================================================== */

function nota(tipo, texto, ic) {
  const icones = { aviso: 'alerta', perigo: 'alerta', dica: 'info', '': 'info' };
  return '<div class="nota ' + tipo + '"><span class="ic">' + icone(ic || icones[tipo] || 'info', 20) +
    '</span><div>' + texto + '</div></div>';
}

function conta(linhas) {
  return '<div class="conta">' + linhas.join('<br>') + '</div>';
}

function compra(nome, termo, preco, alerta) {
  return '<div class="compra">' +
    '<span class="pad"></span>' +
    '<span class="txt"><b>' + esc(nome) + '</b>' +
      '<span>Busque por: “' + esc(termo) + '”' + (preco ? ' · ' + esc(preco) : '') + '</span>' +
      (alerta ? '<span style="color:var(--ambar)">⚠ ' + esc(alerta) + '</span>' : '') +
    '</span>' +
    '<button class="copiar" data-copiar="' + esc(termo) + '">Copiar</button>' +
  '</div>';
}

function resultadoGrande(rotulo, valor, pastilhas) {
  return '<div class="resultado">' +
    '<div class="rotulo">' + esc(rotulo) + '</div>' +
    '<div class="numerao">' + valor + '</div>' +
    (pastilhas && pastilhas.length
      ? '<div class="linha-dados">' + pastilhas.map((p) => '<span class="pastilha">' + p + '</span>').join('') + '</div>'
      : '') +
  '</div>';
}

function paletaCores(lista, selecionado, attr) {
  return '<div class="paleta">' + lista.map((c) =>
    '<button class="cor-btn' + (c.id === selecionado ? ' ativo' : '') + '" ' + attr + '="' + c.id + '">' +
      '<span class="cor-bolha" style="background:' + c.hex + '"></span>' + esc(c.nome) +
    '</button>').join('') + '</div>';
}

/* ==========================================================================
   7. Ferramentas
   ========================================================================== */

const TOOLS = {};

/* -------- 7.1 Decodificar resistor pelas cores --------------------------- */

TOOLS.decodificar = {
  nome: 'Decodificar resistor',
  desc: 'Escolha as cores das listras e descubra quantos ohms é.',
  grupo: 'resistores',
  icone: 'resistor',
  pronto: true,
  st: null,

  init() {
    if (this.st) return;
    const salvo = Store.ler('decodificar', null);
    this.st = salvo && salvo.cores && salvo.cores.length
      ? salvo
      : { n: 4, cores: ['vermelho', 'vermelho', 'vermelho', 'dourado'], sel: 0 };
  },

  render() {
    this.init();
    const st = this.st;
    const r = lerFaixas(st.cores);

    const papeis = st.n === 4
      ? ['1º dígito', '2º dígito', 'Multiplicador', 'Tolerância']
      : st.n === 5
        ? ['1º dígito', '2º dígito', '3º dígito', 'Multiplicador', 'Tolerância']
        : ['1º dígito', '2º dígito', '3º dígito', 'Multiplicador', 'Tolerância', 'Temperatura'];

    const nd = st.n === 4 ? 2 : 3;
    let lista;
    if (st.sel < nd) lista = CORES.filter((c) => c.digito != null);
    else if (st.sel === nd) lista = CORES.filter((c) => c.mult != null);
    else if (st.sel === nd + 1) lista = CORES.filter((c) => c.tol != null);
    else lista = CORES.filter((c) => c.tc != null);

    let bloco;
    if (r.erro) {
      bloco = nota('aviso', '<b>Combinação inválida.</b> ' + esc(r.erro));
    } else {
      const min = r.valor * (1 - r.tol / 100);
      const max = r.valor * (1 + r.tol / 100);
      const past = ['Código: <b>' + codigoCurto(r.valor) + '</b>', 'Tolerância: <b>±' + sig(r.tol, 3) + '%</b>'];
      if (r.tc) past.push('Estabilidade: <b>' + r.tc + ' ppm/°C</b>');
      bloco = resultadoGrande('Este resistor vale', ohm(r.valor), past) +
        '<div class="card card-sec">' +
          '<h3>Como cheguei nesse número</h3>' +
          conta([
            '<span class="cmt">// os dígitos formam o número, o multiplicador dá a escala</span>',
            'dígitos = <b>' + r.digitos + '</b>',
            'multiplicador = <b>×' + (r.mult >= 1 ? r.mult.toLocaleString('pt-BR') : r.mult) + '</b>',
            'valor = ' + r.digitos + ' × ' + r.mult + ' = <b>' + ohm(r.valor) + '</b>'
          ]) +
          '<div class="card-sec">' + nota('dica',
            'Tolerância de <b>±' + sig(r.tol, 3) + '%</b> quer dizer que o resistor real está entre ' +
            '<b>' + ohm(min) + '</b> e <b>' + ohm(max) + '</b>. Isso é normal e quase nunca atrapalha — ' +
            'se o seu circuito depender de precisão melhor que isso, ele está mal projetado.') +
          '</div>' +
        '</div>';
    }

    return '' +
    cabecalho('Decodificar resistor', 'Toque numa listra do desenho e escolha a cor que você está vendo.') +
    '<div class="card">' +
      '<div style="display:flex;justify-content:center;margin-bottom:14px">' +
        '<div class="seg" role="tablist">' +
          [4, 5, 6].map((k) =>
            '<button class="' + (st.n === k ? 'ativo' : '') + '" data-n="' + k + '">' + k + ' faixas</button>'
          ).join('') +
        '</div>' +
      '</div>' +
      svgResistor(st.cores, { selecionada: st.sel, interativo: true }) +
      '<div class="abas-faixa">' +
        st.cores.map((c, i) => {
          const cor = c ? corPorId(c) : null;
          return '<button class="aba-faixa' + (st.sel === i ? ' ativo' : '') + '" data-faixa="' + i + '">' +
            '<span class="cor-bolha" style="background:' + (cor ? cor.hex : 'transparent') + '"></span>' +
            esc(papeis[i]) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="card-sec">' +
        '<div class="rotulo" style="margin-bottom:8px">Cor da faixa “' + esc(papeis[st.sel]) + '”</div>' +
        paletaCores(lista, st.cores[st.sel], 'data-cor') +
      '</div>' +
    '</div>' +
    '<div class="card-sec">' + bloco + '</div>' +
    '<div class="card card-sec">' +
      '<h3>Por onde começa a leitura?</h3>' +
      '<p class="card-desc">A faixa de tolerância (normalmente <b>dourada</b> ou <b>prateada</b>) fica ' +
      'sozinha, mais afastada das outras, e é a <b>última</b>. Vire o resistor com ela à direita e leia da ' +
      'esquerda para a direita. Se não houver dourado nem prata, procure o lado onde as faixas estão mais ' +
      'perto da ponta — esse é o começo.</p>' +
    '</div>';
  },

  mount(raiz) {
    const self = this;
    raiz.addEventListener('click', (ev) => {
      const bn = ev.target.closest('[data-n]');
      if (bn) {
        const n = Number(bn.getAttribute('data-n'));
        const atual = self.st.cores.slice();
        const novo = [];
        const nd = n === 4 ? 2 : 3;
        for (let i = 0; i < nd; i++) novo.push(atual[i] && corPorId(atual[i]).digito != null ? atual[i] : 'preto');
        novo.push('vermelho');
        novo.push('dourado');
        if (n === 6) novo.push('marrom');
        self.st.n = n;
        self.st.cores = novo;
        self.st.sel = Math.min(self.st.sel, n - 1);
        self.salvar();
        return;
      }
      const bf = ev.target.closest('[data-faixa]');
      if (bf) { self.st.sel = Number(bf.getAttribute('data-faixa')); self.salvar(); return; }
      const bc = ev.target.closest('[data-cor]');
      if (bc) {
        self.st.cores[self.st.sel] = bc.getAttribute('data-cor');
        if (self.st.sel < self.st.n - 1) self.st.sel += 1;
        self.salvar();
      }
    });
  },

  salvar() {
    Store.gravar('decodificar', this.st);
    rerender();
  }
};

/* -------- 7.2 Valor -> cores --------------------------------------------- */

TOOLS.valorCores = {
  nome: 'Valor → cores',
  desc: 'Digite os ohms e veja como o resistor tem que estar pintado.',
  grupo: 'resistores',
  icone: 'paleta',
  pronto: true,
  st: { valor: 220, unidade: 1, tol: 5, n: 4 },

  render() {
    const st = this.st;
    const valor = st.valor * st.unidade;
    const f = valorParaFaixas(valor, st.tol, st.n);
    const prox = e24Proximos(valor);

    let bloco;
    if (f.erro) {
      bloco = nota('aviso', esc(f.erro));
    } else {
      const exato = Math.abs(f.valorExato - valor) < valor * 1e-6;
      const existeE24 = isFinite(prox.perto) && Math.abs(prox.perto - valor) < valor * 1e-6;
      bloco =
        '<div class="card">' + svgResistor(f.cores, {}) +
          '<div class="linha-dados" style="margin-top:6px">' +
            f.cores.map((c) => {
              const cor = corPorId(c);
              return '<span class="pastilha"><span class="cor-bolha" style="display:inline-block;' +
                'vertical-align:-4px;margin-right:6px;background:' + cor.hex + '"></span>' + esc(cor.nome) + '</span>';
            }).join('') +
          '</div>' +
        '</div>' +
        (!exato ? '<div class="card-sec">' + nota('aviso',
          'Com ' + st.n + ' faixas o mais perto que dá é <b>' + ohm(f.valorExato) + '</b>. ' +
          'Para representar exatamente ' + ohm(valor) + ' você precisaria de mais faixas.') + '</div>' : '') +
        (!existeE24 ? '<div class="card-sec">' + nota('dica',
          '<b>Esse valor existe pra comprar?</b> Resistores são vendidos em valores padronizados (série E24). ' +
          'Os mais próximos são <b>' + ohm(prox.abaixo) + '</b> e <b>' + ohm(prox.acima) + '</b>. ' +
          'Na prática, escolha <b>' + ohm(prox.perto) + '</b> — ou some/combine dois resistores.') + '</div>' : '') +
        '<div class="card card-sec">' +
          '<h3>Combinando resistores</h3>' +
          conta([
            '<span class="cmt">// em série os valores somam</span>',
            'R total = R1 + R2',
            '<span class="cmt">// em paralelo o total fica MENOR que o menor deles</span>',
            'R total = (R1 × R2) ÷ (R1 + R2)'
          ]) +
          '<p class="card-desc">Dois resistores iguais em paralelo dão metade do valor. É o truque mais ' +
          'usado quando falta o valor certo na gaveta.</p>' +
        '</div>';
    }

    return '' +
    cabecalho('Valor → cores', 'Você sabe quantos ohms quer; eu mostro como o resistor deve estar pintado.') +
    '<div class="card">' +
      '<div class="campos">' +
        '<div class="campo"><label for="v">Valor da resistência</label>' +
          '<div class="dupla">' +
            '<input type="number" id="v" step="any" min="0" value="' + st.valor + '">' +
            '<select id="u">' +
              '<option value="1"' + (st.unidade === 1 ? ' selected' : '') + '>Ω</option>' +
              '<option value="1000"' + (st.unidade === 1000 ? ' selected' : '') + '>kΩ</option>' +
              '<option value="1000000"' + (st.unidade === 1000000 ? ' selected' : '') + '>MΩ</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="campo"><label for="t">Tolerância</label>' +
          '<select id="t">' +
            CORES.filter((c) => c.tol != null).map((c) =>
              '<option value="' + c.tol + '"' + (st.tol === c.tol ? ' selected' : '') + '>±' + sig(c.tol, 3) +
              '% (' + esc(c.nome.toLowerCase()) + ')</option>').join('') +
          '</select>' +
          '<span class="ajuda">O comum é ±5% (dourado).</span>' +
        '</div>' +
        '<div class="campo"><label for="n">Quantidade de faixas</label>' +
          '<select id="n">' +
            [4, 5, 6].map((k) => '<option value="' + k + '"' + (st.n === k ? ' selected' : '') + '>' + k + ' faixas</option>').join('') +
          '</select>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card-sec">' + bloco + '</div>';
  },

  mount(raiz) {
    const self = this;
    const atualiza = () => {
      const v = num($('#v', raiz).value);
      self.st.valor = isFinite(v) ? v : 0;
      self.st.unidade = Number($('#u', raiz).value);
      self.st.tol = Number($('#t', raiz).value);
      self.st.n = Number($('#n', raiz).value);
      if (self.st.n === 4 && self.st.tol < 2) self.st.tol = 5;
      rerender();
    };
    ['#v', '#u', '#t', '#n'].forEach((s) => {
      const el = $(s, raiz);
      if (el) el.addEventListener('change', atualiza);
    });
  }
};

/* -------- 7.3 Resistor para LED ------------------------------------------ */

TOOLS.led = {
  nome: 'Resistor para LED',
  desc: 'O resistor certo para o LED acender bonito sem queimar.',
  grupo: 'resistores',
  icone: 'led',
  pronto: true,
  st: { vs: 5, cor: 'vermelho', ma: 20, qtd: 1, arranjo: 'serie' },

  render() {
    const st = this.st;
    const led = LEDS.filter((l) => l.id === st.cor)[0];
    const i = st.ma / 1000;
    const qtd = Math.max(1, Math.floor(st.qtd));
    const emSerie = st.arranjo === 'serie';
    const vfTotal = emSerie ? led.vf * qtd : led.vf;
    const iTotal = emSerie ? i : i * qtd;
    const sobra = st.vs - vfTotal;

    let bloco;
    if (sobra <= 0.15) {
      bloco = nota('perigo',
        '<b>Não dá com essa fonte.</b> ' +
        (emSerie && qtd > 1 ? qtd + ' LEDs em série pedem ' : 'O LED pede ') +
        '<b>' + sig(vfTotal) + ' V</b> e você só tem <b>' + sig(st.vs) + ' V</b>. ' +
        'Reduza a quantidade de LEDs em série, use LEDs de tensão menor, ou aumente a tensão da fonte.');
    } else {
      const r = sobra / iTotal;
      const prox = e24Proximos(r);
      const rEscolhido = prox.acima; // para cima = corrente menor = LED seguro
      const iReal = sobra / rEscolhido;
      const pot = sobra * iReal;
      const potRec = potenciaRecomendada(pot);
      const faixas = valorParaFaixas(rEscolhido, 5, 4);

      bloco =
        resultadoGrande('Use um resistor de', ohm(rEscolhido), [
          'Código: <b>' + codigoCurto(rEscolhido) + '</b>',
          'Potência: <b>' + potRec.nome + '</b>',
          'Corrente real: <b>' + unidade(iReal, 'A') + '</b>'
        ]) +
        (faixas.cores ? '<div class="card card-sec">' + svgResistor(faixas.cores, {}) +
          '<div class="linha-dados">' + faixas.cores.map((c) => {
            const cor = corPorId(c);
            return '<span class="pastilha"><span class="cor-bolha" style="display:inline-block;' +
              'vertical-align:-4px;margin-right:6px;background:' + cor.hex + '"></span>' + esc(cor.nome) + '</span>';
          }).join('') + '</div></div>' : '') +
        '<div class="card card-sec">' +
          '<h3>A conta</h3>' +
          conta([
            '<span class="cmt">// o LED "segura" a tensão dele; o resistor fica com o resto</span>',
            'sobra = V fonte − V do LED = ' + sig(st.vs) + ' − ' + sig(vfTotal) + ' = <b>' + sig(sobra) + ' V</b>',
            '<span class="cmt">// Lei de Ohm: R = tensão ÷ corrente</span>',
            'R = ' + sig(sobra) + ' V ÷ ' + sig(iTotal) + ' A = <b>' + ohm(r) + '</b>',
            '<span class="cmt">// arredondo para cima, para o valor comercial mais próximo</span>',
            'R comercial = <b>' + ohm(rEscolhido) + '</b> → corrente real ' + unidade(iReal, 'A'),
            '<span class="cmt">// calor que o resistor precisa aguentar (com folga de 2×)</span>',
            'P = ' + sig(sobra) + ' V × ' + sig(iReal) + ' A = ' + unidade(pot, 'W') + ' → use <b>' + potRec.nome + '</b>'
          ]) +
        '</div>' +
        '<div class="card card-sec">' +
          '<h3>O que comprar</h3>' +
          compra('Resistor ' + codigoCurto(rEscolhido) + ' ' + potRec.nome,
                 'resistor ' + ohm(rEscolhido).replace(',', '.') + ' ' + potRec.nome.replace(' ', ''),
                 'kit com 100 sai por R$ 10–20') +
          compra('Kit de resistores sortidos',
                 'kit resistores 1/4w 600 pecas valores',
                 'R$ 25–45',
                 'Compre o kit: sai mais barato que comprar valor a valor, e você nunca fica na mão.') +
        '</div>' +
        (!emSerie && qtd > 1
          ? '<div class="card-sec">' + nota('aviso',
              '<b>Um resistor por LED, sempre.</b> Você escolheu ' + qtd + ' LEDs em paralelo: use ' + qtd +
              ' resistores de ' + ohm(rEscolhido) + ', um para cada LED. Um resistor só, compartilhado, faz ' +
              'o LED mais "guloso" roubar corrente dos outros — eles acendem com brilhos diferentes e o ' +
              'guloso morre antes.') + '</div>'
          : '');
    }

    return '' +
    cabecalho('Resistor para LED', 'Aqui o resistor é a solução certa: ele limita a corrente que passa pelo LED.') +
    '<div class="card">' +
      '<div class="campos">' +
        '<div class="campo"><label for="vs">Tensão da fonte</label>' +
          '<div class="dupla">' +
            '<input type="number" id="vs" step="any" min="0" value="' + st.vs + '">' +
            '<select id="fp"><option value="">volts</option>' +
              FONTES.map((f) => '<option value="' + f.v + '">' + esc(f.nome) + '</option>').join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="campo"><label for="cor">Cor do LED</label>' +
          '<select id="cor">' + LEDS.map((l) =>
            '<option value="' + l.id + '"' + (st.cor === l.id ? ' selected' : '') + '>' +
            esc(l.nome) + ' (' + sig(l.vf) + ' V)</option>').join('') + '</select>' +
          '<span class="ajuda">Cada cor "segura" uma tensão diferente.</span>' +
        '</div>' +
        '<div class="campo"><label for="ma">Corrente por LED</label>' +
          '<div class="dupla">' +
            '<input type="number" id="ma" step="any" min="0.1" value="' + st.ma + '">' +
            '<select disabled><option>mA</option></select>' +
          '</div>' +
          '<span class="ajuda">20 mA é o padrão do LED de 5 mm. Menos = mais fraco e mais durável.</span>' +
        '</div>' +
        '<div class="campo"><label for="qtd">Quantos LEDs</label>' +
          '<input type="number" id="qtd" step="1" min="1" max="20" value="' + qtd + '">' +
        '</div>' +
        '<div class="campo"><label for="arr">Ligados em</label>' +
          '<select id="arr">' +
            '<option value="serie"' + (emSerie ? ' selected' : '') + '>Série (um depois do outro)</option>' +
            '<option value="paralelo"' + (!emSerie ? ' selected' : '') + '>Paralelo (lado a lado)</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card-sec">' + bloco + '</div>' +
    '<div class="card card-sec">' +
      '<h3>Por que o LED precisa de resistor</h3>' +
      '<p class="card-desc">O LED não tem "resistência" própria que segure a corrente. Ligado direto na ' +
      'fonte, ele puxa corrente até se destruir — às vezes em menos de um segundo. O resistor é quem ' +
      'controla o quanto passa. É por isso que <b>neste caso</b> o resistor funciona: a corrente é pequena ' +
      'e constante. Para alimentar um motor ou uma placa, resistor não serve — aí é conversor.</p>' +
    '</div>';
  },

  mount(raiz) {
    const self = this;
    const pega = () => {
      self.st.vs = num($('#vs', raiz).value) || 0;
      self.st.cor = $('#cor', raiz).value;
      self.st.ma = num($('#ma', raiz).value) || 20;
      self.st.qtd = Math.max(1, Math.floor(num($('#qtd', raiz).value) || 1));
      self.st.arranjo = $('#arr', raiz).value;
      rerender();
    };
    ['#vs', '#cor', '#ma', '#qtd', '#arr'].forEach((s) => {
      const el = $(s, raiz);
      if (el) el.addEventListener('change', pega);
    });
    const fp = $('#fp', raiz);
    if (fp) fp.addEventListener('change', () => {
      if (!fp.value) return;
      $('#vs', raiz).value = fp.value;
      pega();
    });
  }
};

/* -------- 7.4 Divisor de tensão ------------------------------------------ */

TOOLS.divisor = {
  nome: 'Divisor de tensão',
  desc: 'Dois resistores para reduzir um sinal — nunca para alimentar carga.',
  grupo: 'resistores',
  icone: 'divisor',
  pronto: true,
  st: { modo: 'calcular', vin: 12, r1: 10000, r2: 10000, vout: 3.3 },

  render() {
    const st = this.st;
    let bloco;

    if (st.modo === 'calcular') {
      const total = st.r1 + st.r2;
      const vout = total > 0 ? st.vin * (st.r2 / total) : NaN;
      const i = total > 0 ? st.vin / total : NaN;
      const p1 = i * i * st.r1, p2 = i * i * st.r2;
      bloco = resultadoGrande('Tensão de saída', unidade(vout, 'V'), [
        'Corrente: <b>' + unidade(i, 'A') + '</b>',
        'Gasto em R1: <b>' + unidade(p1, 'W') + '</b>',
        'Gasto em R2: <b>' + unidade(p2, 'W') + '</b>'
      ]) +
      '<div class="card card-sec"><h3>A conta</h3>' +
        conta([
          'V saída = V entrada × R2 ÷ (R1 + R2)',
          'V saída = ' + sig(st.vin) + ' × ' + ohm(st.r2) + ' ÷ ' + ohm(total) + ' = <b>' + unidade(vout, 'V') + '</b>',
          '<span class="cmt">// corrente que circula o tempo todo, mesmo sem nada ligado</span>',
          'I = ' + sig(st.vin) + ' V ÷ ' + ohm(total) + ' = <b>' + unidade(i, 'A') + '</b>'
        ]) +
      '</div>';
    } else {
      const alvo = st.vout, vin = st.vin;
      if (!(alvo > 0) || !(vin > alvo)) {
        bloco = nota('aviso', 'A tensão de saída precisa ser maior que zero e <b>menor</b> que a de entrada. ' +
          'Divisor só reduz — para aumentar tensão é preciso um conversor <i>boost</i>.');
      } else {
        const r1base = 10000;
        const r2ideal = r1base * alvo / (vin - alvo);
        const p = e24Proximos(r2ideal);
        const r2 = p.perto;
        const voutReal = vin * r2 / (r1base + r2);
        const f1 = valorParaFaixas(r1base, 5, 4);
        const f2 = valorParaFaixas(r2, 5, 4);
        bloco = resultadoGrande('Par de resistores', ohm(r1base) + ' + ' + ohm(r2), [
          'Saída real: <b>' + unidade(voutReal, 'V') + '</b>',
          'Erro: <b>' + sig(Math.abs(voutReal - alvo) / alvo * 100, 2) + '%</b>'
        ]) +
        '<div class="card card-sec"><h3>R1 — vai da entrada até o meio</h3>' + svgResistor(f1.cores || [], {}) + '</div>' +
        '<div class="card card-sec"><h3>R2 — vai do meio até o negativo</h3>' + svgResistor(f2.cores || [], {}) +
          '<p class="card-desc">A saída é o ponto <b>entre</b> os dois resistores.</p>' +
        '</div>' +
        '<div class="card card-sec"><h3>A conta</h3>' +
          conta([
            '<span class="cmt">// fixei R1 em 10 kΩ e calculei R2</span>',
            'R2 = R1 × Vsaída ÷ (Ventrada − Vsaída)',
            'R2 = 10k × ' + sig(alvo) + ' ÷ (' + sig(vin) + ' − ' + sig(alvo) + ') = ' + ohm(r2ideal),
            'valor comercial mais próximo = <b>' + ohm(r2) + '</b>'
          ]) +
        '</div>';
      }
    }

    return '' +
    cabecalho('Divisor de tensão', 'Dois resistores em série: a saída sai do meio deles.') +
    nota('perigo',
      '<b>Isto NÃO alimenta nada.</b> Divisor de tensão só serve para <b>ler</b> um sinal — por exemplo, ' +
      'medir uma bateria de 12 V com um Arduino que só aceita 5 V. Se você ligar um motor, um módulo ou ' +
      'qualquer coisa que consuma corrente, a tensão desaba e o resistor esquenta. Para <b>alimentar</b> ' +
      'algo com menos volts, use um conversor <i>step-down</i> (buck) ou um regulador.') +
    '<div class="card card-sec">' +
      '<div style="display:flex;justify-content:center;margin-bottom:14px">' +
        '<div class="seg">' +
          '<button class="' + (st.modo === 'calcular' ? 'ativo' : '') + '" data-modo="calcular">Tenho os resistores</button>' +
          '<button class="' + (st.modo === 'projetar' ? 'ativo' : '') + '" data-modo="projetar">Quero uma saída</button>' +
        '</div>' +
      '</div>' +
      '<div class="campos">' +
        '<div class="campo"><label for="vin">Tensão de entrada (V)</label>' +
          '<input type="number" id="vin" step="any" min="0" value="' + st.vin + '"></div>' +
        (st.modo === 'calcular'
          ? '<div class="campo"><label for="r1">R1 — de cima (Ω)</label>' +
              '<input type="number" id="r1" step="any" min="1" value="' + st.r1 + '"></div>' +
            '<div class="campo"><label for="r2">R2 — de baixo (Ω)</label>' +
              '<input type="number" id="r2" step="any" min="1" value="' + st.r2 + '"></div>'
          : '<div class="campo"><label for="vo">Tensão de saída desejada (V)</label>' +
              '<input type="number" id="vo" step="any" min="0" value="' + st.vout + '"></div>') +
      '</div>' +
    '</div>' +
    '<div class="card-sec">' + bloco + '</div>' +
    '<div class="card card-sec">' +
      '<h3>O uso legítimo mais comum</h3>' +
      '<p class="card-desc">Medir a tensão de uma bateria com o Arduino. A entrada analógica aguenta no ' +
      'máximo 5 V (ou 3,3 V no ESP32); um pack de 12 V queimaria o pino. O divisor reduz a tensão ' +
      'proporcionalmente e o Arduino faz a conta de volta no código. Como a entrada analógica quase não ' +
      'puxa corrente, o divisor funciona direitinho aí.</p>' +
    '</div>';
  },

  mount(raiz) {
    const self = this;
    raiz.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-modo]');
      if (b) { self.st.modo = b.getAttribute('data-modo'); rerender(); }
    });
    const pega = () => {
      const g = (s, d) => { const el = $(s, raiz); const v = el ? num(el.value) : NaN; return isFinite(v) ? v : d; };
      self.st.vin = g('#vin', self.st.vin);
      self.st.r1 = g('#r1', self.st.r1);
      self.st.r2 = g('#r2', self.st.r2);
      self.st.vout = g('#vo', self.st.vout);
      rerender();
    };
    ['#vin', '#r1', '#r2', '#vo'].forEach((s) => {
      const el = $(s, raiz);
      if (el) el.addEventListener('change', pega);
    });
  }
};

/* -------- 7.5 Lei de Ohm -------------------------------------------------- */

TOOLS.ohm = {
  nome: 'Lei de Ohm e potência',
  desc: 'Sabendo dois valores, descubra os outros dois.',
  grupo: 'energia',
  icone: 'raio',
  pronto: true,
  st: { v: 5, i: '', r: 220, p: '' },

  render() {
    const st = this.st;
    const V = num(st.v), I = num(st.i), R = num(st.r), P = num(st.p);
    const tem = (x) => isFinite(x) && x !== 0;
    let v = NaN, i = NaN, r = NaN, p = NaN, usados = '';

    if (tem(V) && tem(I)) { v = V; i = I; r = V / I; p = V * I; usados = 'tensão e corrente'; }
    else if (tem(V) && tem(R)) { v = V; r = R; i = V / R; p = V * i; usados = 'tensão e resistência'; }
    else if (tem(I) && tem(R)) { i = I; r = R; v = I * R; p = v * I; usados = 'corrente e resistência'; }
    else if (tem(V) && tem(P)) { v = V; p = P; i = P / V; r = V / i; usados = 'tensão e potência'; }
    else if (tem(I) && tem(P)) { i = I; p = P; v = P / I; r = v / I; usados = 'corrente e potência'; }
    else if (tem(R) && tem(P)) { r = R; p = P; i = Math.sqrt(P / R); v = i * R; usados = 'resistência e potência'; }

    const ok = isFinite(v) && isFinite(i);
    const bloco = ok
      ? resultadoGrande('Com ' + usados, unidade(v, 'V') + ' · ' + unidade(i, 'A'), [
          'Resistência: <b>' + ohm(r) + '</b>',
          'Potência: <b>' + unidade(p, 'W') + '</b>',
          'Resistor sugerido: <b>' + potenciaRecomendada(p).nome + '</b>'
        ]) +
        '<div class="card card-sec"><h3>As fórmulas usadas</h3>' +
          conta([
            'V = I × R   →   ' + unidade(v, 'V'),
            'I = V ÷ R   →   ' + unidade(i, 'A'),
            'R = V ÷ I   →   ' + ohm(r),
            'P = V × I   →   ' + unidade(p, 'W')
          ]) +
        '</div>'
      : nota('dica', 'Preencha <b>dois</b> campos quaisquer e eu calculo os outros dois. Deixe os demais em branco.');

    return '' +
    cabecalho('Lei de Ohm e potência', 'A relação entre tensão, corrente, resistência e calor.') +
    '<div class="card">' +
      '<div class="campos">' +
        '<div class="campo"><label for="ov">Tensão (V)</label>' +
          '<input type="number" id="ov" step="any" value="' + esc(st.v) + '">' +
          '<span class="ajuda">A "força" que empurra.</span></div>' +
        '<div class="campo"><label for="oi">Corrente (A)</label>' +
          '<input type="number" id="oi" step="any" value="' + esc(st.i) + '">' +
          '<span class="ajuda">O quanto flui. 500 mA = 0,5 A.</span></div>' +
        '<div class="campo"><label for="or">Resistência (Ω)</label>' +
          '<input type="number" id="or" step="any" value="' + esc(st.r) + '">' +
          '<span class="ajuda">O quanto atrapalha a passagem.</span></div>' +
        '<div class="campo"><label for="op">Potência (W)</label>' +
          '<input type="number" id="op" step="any" value="' + esc(st.p) + '">' +
          '<span class="ajuda">O calor gerado.</span></div>' +
      '</div>' +
      '<div class="btn-linha"><button class="btn" id="limpar">Limpar tudo</button></div>' +
    '</div>' +
    '<div class="card-sec">' + bloco + '</div>' +
    '<div class="card card-sec">' +
      '<h3>Entendendo por analogia</h3>' +
      '<p class="card-desc">Pense num cano de água: a <b>tensão</b> é a pressão, a <b>corrente</b> é a ' +
      'quantidade de água que passa, e a <b>resistência</b> é o quanto o cano é estreito. Aperte o cano ' +
      '(mais resistência) e passa menos água. Aumente a pressão (mais tensão) e passa mais água. ' +
      'A <b>potência</b> é o calor que sobra quando a água briga com o estreitamento.</p>' +
    '</div>';
  },

  mount(raiz) {
    const self = this;
    const map = { '#ov': 'v', '#oi': 'i', '#or': 'r', '#op': 'p' };
    Object.keys(map).forEach((s) => {
      const el = $(s, raiz);
      if (!el) return;
      el.addEventListener('change', () => {
        self.st[map[s]] = el.value;
        rerender();
      });
    });
    const lb = $('#limpar', raiz);
    if (lb) lb.addEventListener('click', () => {
      self.st = { v: '', i: '', r: '', p: '' };
      rerender();
    });
  }
};

/* -------- 7.6 Ajustes ----------------------------------------------------- */

TOOLS.ajustes = {
  nome: 'Ajustes',
  desc: 'Backup dos seus dados, versão e informações do app.',
  grupo: 'ajustes',
  icone: 'engrenagem',
  pronto: true,

  render() {
    const dados = Store.tudo();
    const qtd = Object.keys(dados).length;
    return '' +
    cabecalho('Ajustes', 'Seus dados ficam só neste aparelho. Nada é enviado para lugar nenhum.') +
    '<div class="card">' +
      '<h3>Backup e transferência</h3>' +
      '<p class="card-desc">O E-TronIQ não tem login: tudo fica salvo no navegador <b>deste</b> aparelho. ' +
      'Para levar seus dados para o celular (ou não perder tudo se limpar o navegador), exporte um arquivo ' +
      'JSON aqui e importe no outro aparelho.</p>' +
      '<div class="btn-linha">' +
        '<button class="btn primario" id="exportar">' + icone('download', 18) + ' Exportar (' + qtd + ' itens)</button>' +
        '<button class="btn" id="importar">' + icone('upload', 18) + ' Importar</button>' +
        '<input type="file" id="arquivo" accept="application/json,.json" hidden>' +
      '</div>' +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>Instalar no celular</h3>' +
      '<p class="card-desc">No Android (Chrome), abra o menu ⋮ e toque em <b>Instalar app</b> ou ' +
      '<b>Adicionar à tela inicial</b>. No iPhone (Safari), use o botão de compartilhar e ' +
      '<b>Adicionar à Tela de Início</b>. Depois disso o E-TronIQ abre como aplicativo e funciona ' +
      'mesmo sem internet.</p>' +
    '</div>' +
    '<div class="card card-sec">' +
      '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">' +
        '<h3>Histórico de versões</h3>' +
        '<span class="pastilha">agora em <b>v' + esc(VERSAO) + '</b></span>' +
      '</div>' +
      '<p class="card-desc">O app se atualiza sozinho quando você abre com internet. Se achar que ' +
      'ficou parado numa versão antiga, feche e abra de novo.</p>' +
      '<div class="linha-tempo">' +
        CHANGELOG.map((c, idx) =>
          '<div class="versao-item' + (idx === 0 ? ' atual' : '') + '">' +
            '<div class="versao-cabeca">' +
              '<b>v' + esc(c.versao) + '</b>' +
              '<span class="versao-data">' + esc(dataBR(c.data)) + '</span>' +
              (idx === 0 ? '<span class="versao-selo">atual</span>' : '') +
            '</div>' +
            '<ul>' + c.itens.map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul>' +
          '</div>').join('') +
      '</div>' +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>Apagar dados</h3>' +
      '<p class="card-desc">Remove tudo o que o app salvou neste aparelho. Não tem como desfazer — ' +
      'exporte antes.</p>' +
      '<div class="btn-linha"><button class="btn" id="zerar" style="border-color:rgba(244,82,107,.4);color:var(--vermelho)">Apagar tudo</button></div>' +
    '</div>' +
    nota('', '<b>Aviso.</b> O E-TronIQ ajuda a entender e a calcular, mas não substitui um profissional. ' +
      'Trabalho em rede elétrica (127/220 V) é para eletricista habilitado. Baterias de lítio, mesmo em ' +
      'baixa tensão, pegam fogo quando maltratadas — nunca monte um pack sem BMS e nunca carregue sem ' +
      'supervisão.');
  },

  mount(raiz) {
    const bx = $('#exportar', raiz);
    if (bx) bx.addEventListener('click', () => {
      const pacote = { app: 'E-TronIQ', versao: VERSAO, exportadoEm: new Date().toISOString(), dados: Store.tudo() };
      const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'etroniq-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      torrada('Arquivo gerado');
    });

    const bi = $('#importar', raiz), arq = $('#arquivo', raiz);
    if (bi && arq) {
      bi.addEventListener('click', () => arq.click());
      arq.addEventListener('change', () => {
        const f = arq.files && arq.files[0];
        if (!f) return;
        const fr = new FileReader();
        fr.onload = () => {
          try {
            const pacote = JSON.parse(String(fr.result));
            const dados = pacote && pacote.dados ? pacote.dados : pacote;
            if (!dados || typeof dados !== 'object') throw new Error('formato');
            let n = 0;
            Object.keys(dados).forEach((k) => { Store.gravar(k, dados[k]); n++; });
            torrada(n + ' itens importados');
            TOOLS.decodificar.st = null;
            rerender();
          } catch (e) {
            torrada('Arquivo inválido — não parece um backup do E-TronIQ');
          }
        };
        fr.readAsText(f);
      });
    }

    const bz = $('#zerar', raiz);
    if (bz) bz.addEventListener('click', () => {
      if (!confirm('Apagar todos os dados do E-TronIQ neste aparelho?')) return;
      Store.limpar();
      TOOLS.decodificar.st = null;
      torrada('Dados apagados');
      rerender();
    });
  }
};

/* -------- 7.7 Quero X volts ---------------------------------------------- */

/* Resistência térmica aproximada, em °C por watt dissipado.
   São ordens de grandeza de bancada, não números de datasheet. */
const MONTAGENS = [
  { id: 'sem',     nome: 'Sem dissipador (TO-220 solto no ar)', rth: 62 },
  { id: 'clipe',   nome: 'Dissipador pequeno de clipe',          rth: 25 },
  { id: 'medio',   nome: 'Dissipador médio (aletado, ~30 mm)',   rth: 12 },
  { id: 'grande',  nome: 'Dissipador grande com ventilação',     rth: 5 },
  { id: 'ventoinha', nome: 'Dissipador com ventoinha',           rth: 2.5 }
];

TOOLS.quantosVolts = {
  nome: 'Quero X volts',
  desc: 'Diga entrada, saída e corrente; eu indico diodo, regulador ou conversor.',
  grupo: 'energia',
  icone: 'conversor',
  pronto: true,
  st: { vin: 3.7, vout: 1.5, ma: 300, bateria: true },

  /** Escolhe a solução certa e explica por que as outras foram descartadas. */
  analisar() {
    const st = this.st;
    const vin = st.vin, vout = st.vout, i = st.ma / 1000;
    if (!(vin > 0) || !(vout > 0) || !(i > 0)) return { erro: 'Preencha entrada, saída e corrente com valores maiores que zero.' };
    if (vout >= vin) {
      return {
        tipo: vout > vin ? 'boost' : 'igual',
        vin: vin, vout: vout, i: i
      };
    }
    const queda = vin - vout;
    const perdaLinear = queda * i;
    // Uma bateria de lítio cai de ~4,2 V a ~3,0 V conforme descarrega.
    const vinMin = st.bateria ? vin * 0.81 : vin;
    const morreNoFim = st.bateria && vinMin < vout + 0.3;
    const rendLinear = vout / vin;
    // Alimentado por bateria, o critério é mais duro: um linear com rendimento baixo
    // não "só esquenta", ele encurta a autonomia na mesma proporção.
    const limiteCalor = st.bateria ? 0.35 : 1;
    let tipo = 'buck';
    if (perdaLinear <= limiteCalor && !morreNoFim && (!st.bateria || rendLinear >= 0.6)) tipo = 'linear';
    return {
      tipo: morreNoFim ? 'buckboost' : tipo,
      vin: vin, vout: vout, i: i, queda: queda, perdaLinear: perdaLinear,
      vinMin: vinMin, morreNoFim: morreNoFim,
      diodos: Math.round(queda / 0.7),
      rendLinear: rendLinear
    };
  },

  render() {
    const st = this.st;
    const a = this.analisar();
    let bloco;

    if (a.erro) {
      bloco = nota('aviso', esc(a.erro));

    } else if (a.tipo === 'igual') {
      bloco = nota('dica', 'Entrada e saída iguais: você não precisa converter nada. ' +
        'Se a intenção é só proteger o circuito, o que serve é um <b>diodo em série</b> contra ' +
        'inversão de polaridade — e ele custa a você 0,3 a 0,7 V.');

    } else if (a.tipo === 'boost') {
      bloco = resultadoGrande('Use um conversor', 'BOOST', [
        'De <b>' + sig(a.vin) + ' V</b> para <b>' + sig(a.vout) + ' V</b>',
        'Corrente: <b>' + unidade(a.i, 'A') + '</b>'
      ]) +
      '<div class="card card-sec">' +
        '<h3>Por quê</h3>' +
        '<p class="card-desc">Você quer <b>mais</b> tensão do que tem. Nenhum resistor, diodo ou ' +
        'regulador consegue isso — todos eles só derrubam tensão. Quem sobe tensão é o conversor ' +
        '<i>boost</i> (step-up), que faz isso trocando corrente por tensão.</p>' +
        conta([
          '<span class="cmt">// a conta que importa: a entrada puxa MAIS corrente que a saída</span>',
          'I entrada ≈ (' + sig(a.vout) + ' V × ' + sig(a.i) + ' A) ÷ (' + sig(a.vin) + ' V × 0,85)',
          'I entrada ≈ <b>' + unidade(a.vout * a.i / (a.vin * 0.85), 'A') + '</b>',
          '<span class="cmt">// confira se sua fonte/bateria aguenta essa corrente</span>'
        ]) +
      '</div>' +
      '<div class="card card-sec"><h3>O que comprar</h3>' +
        compra('Módulo step-up MT3608', 'modulo step up mt3608 ajustavel', 'R$ 8–15',
               'Ajuste a saída no trimpot ANTES de ligar a carga — ele sai de fábrica em qualquer valor.') +
        compra('Módulo step-up XL6009 (mais corrente)', 'modulo step up xl6009 4a', 'R$ 15–25') +
      '</div>';

    } else {
      const solucoes = [];

      // --- opção conversor buck
      solucoes.push({
        id: 'buck', nome: 'Conversor buck (step-down)',
        bom: 'Rendimento de 85 a 92%: quase nada vira calor. Aguenta o aparelho puxar corrente variável.',
        ruim: 'É um módulo (não um componente solto) e precisa de ajuste no trimpot antes de usar.',
        recomendado: a.tipo === 'buck'
      });

      // --- opção regulador linear
      solucoes.push({
        id: 'linear', nome: 'Regulador linear (LDO / LM317)',
        bom: 'Barato, simples, sem ruído elétrico. Ótimo para circuitos pequenos e sensíveis.',
        ruim: 'Queima a diferença em calor: aqui seriam ' + unidade(a.perdaLinear, 'W') +
              ', com rendimento de só ' + Math.round(a.rendLinear * 100) + '%.',
        recomendado: a.tipo === 'linear'
      });

      // --- opção diodos
      const quedaDiodos = a.diodos * 0.7;
      const viavelDiodo = a.diodos >= 1 && a.diodos <= 4 && Math.abs(quedaDiodos - a.queda) < 0.35 && a.i <= 1;
      solucoes.push({
        id: 'diodo', nome: 'Diodos em série',
        bom: viavelDiodo
          ? a.diodos + ' diodo(s) 1N4007 derrubam cerca de ' + sig(quedaDiodos) + ' V. Custa centavos.'
          : 'Só serve quando a diferença é múltipla de ~0,7 V e a corrente é baixa.',
        ruim: 'A queda muda com a corrente e com a temperatura — não é uma tensão estável. ' +
              'Serve para gambiarra, não para projeto.',
        recomendado: false, inviavel: !viavelDiodo
      });

      const escolhida = a.tipo === 'buckboost' ? 'buckboost' : a.tipo;

      const cabeca = a.tipo === 'buckboost'
        ? resultadoGrande('Use um conversor', 'BUCK-BOOST', [
            'Entrada cai até <b>' + sig(a.vinMin) + ' V</b>',
            'Saída fixa em <b>' + sig(a.vout) + ' V</b>'
          ])
        : resultadoGrande('A melhor solução aqui é', escolhida === 'buck' ? 'CONVERSOR BUCK' : 'REGULADOR LINEAR', [
            'Perda em calor: <b>' + unidade(escolhida === 'buck' ? a.vout * a.i * 0.15 : a.perdaLinear, 'W') + '</b>',
            'Rendimento: <b>' + (escolhida === 'buck' ? '~88' : Math.round(a.rendLinear * 100)) + '%</b>'
          ]);

      // LM317: dois resistores definem a saída
      let blocoLM = '';
      if (escolhida === 'linear' && a.vout >= 1.25) {
        const r1 = 240;
        const r2ideal = (a.vout / 1.25 - 1) * r1;
        const r2 = e24Proximos(r2ideal).perto;
        const voutReal = 1.25 * (1 + r2 / r1);
        const f2 = valorParaFaixas(r2, 5, 4);
        blocoLM =
          '<div class="card card-sec">' +
            '<h3>Se usar o LM317 (ajustável)</h3>' +
            '<p class="card-desc">O LM317 não tem tensão fixa: quem define a saída são dois ' +
            'resistores. Deixe R1 em 240 Ω (o valor de catálogo) e calcule R2.</p>' +
            conta([
              'V saída = 1,25 × (1 + R2 ÷ R1)',
              'R2 = (' + sig(a.vout) + ' ÷ 1,25 − 1) × 240 = ' + ohm(r2ideal),
              'valor comercial = <b>' + ohm(r2) + '</b> → saída real <b>' + sig(voutReal) + ' V</b>'
            ]) +
            (f2.cores ? '<div class="card-sec">' + svgResistor(f2.cores, {}) +
              '<div class="rotulo" style="text-align:center">R2 = ' + ohm(r2) + '</div></div>' : '') +
          '</div>';
      }

      bloco = cabeca +
        (a.tipo === 'buckboost'
          ? '<div class="card-sec">' + nota('aviso',
              '<b>Atenção ao fim da carga.</b> Uma célula de lítio começa em 4,2 V e termina perto de ' +
              '3,0 V. Para manter ' + sig(a.vout) + ' V até o fim, um conversor comum não serve: quando a ' +
              'bateria cai abaixo da saída, ele desiste. O <i>buck-boost</i> abaixa quando a bateria está ' +
              'cheia e levanta quando ela está fraca — a saída fica firme o tempo todo.') +
            (a.queda < 0.8 && a.perdaLinear < 0.3
              ? nota('dica',
                  '<b>Tem um atalho mais simples aqui.</b> A diferença é de só ' + sig(a.queda) + ' V. ' +
                  'Um regulador LDO de baixa queda (o <b>HT7333</b>, por exemplo, perde apenas 0,1 V) ' +
                  'segura os ' + sig(a.vout) + ' V até a bateria chegar perto de ' + sig(a.vout + 0.1) + ' V, ' +
                  'e depois acompanha a bateria descendo. Se o seu circuito tolerar essa queda no fim ' +
                  '(ESP32 e a maioria dos sensores toleram), o LDO custa um terço do preço e não faz ruído.')
              : '') +
            '</div>'
          : '') +
        '<div class="card card-sec">' +
          '<h3>A conta</h3>' +
          conta([
            'diferença = ' + sig(a.vin) + ' V − ' + sig(a.vout) + ' V = <b>' + sig(a.queda) + ' V</b>',
            '<span class="cmt">// num regulador linear, essa diferença toda vira calor</span>',
            'P calor = ' + sig(a.queda) + ' V × ' + sig(a.i) + ' A = <b>' + unidade(a.perdaLinear, 'W') + '</b>',
            '<span class="cmt">// num conversor buck, a energia é "empacotada", não queimada</span>',
            'I entrada ≈ (' + sig(a.vout) + ' × ' + sig(a.i) + ') ÷ (' + sig(a.vin) + ' × 0,88) = ' +
              unidade(a.vout * a.i / (a.vin * 0.88), 'A')
          ]) +
          (a.perdaLinear > 1
            ? '<div class="card-sec">' + nota('aviso',
                '<b>' + unidade(a.perdaLinear, 'W') + ' de calor é muita coisa.</b> Isso é o que um ' +
                'regulador linear teria que dissipar aqui — pense num ferro de solda pequeno encostado no ' +
                'componente. Por isso a resposta é conversor, não regulador.') + '</div>'
            : '') +
        '</div>' +
        blocoLM +
        '<div class="card card-sec">' +
          '<h3>As três saídas possíveis</h3>' +
          solucoes.map((s) =>
            '<div class="card-sec" style="border-left:3px solid ' +
              (s.recomendado || (a.tipo === 'buckboost' && s.id === 'buck') ? 'var(--ciano)' : 'var(--linha)') +
              ';padding-left:12px">' +
              '<b>' + esc(s.nome) + (s.recomendado ? ' — recomendado' : (s.inviavel ? ' — não serve aqui' : '')) + '</b>' +
              '<div class="card-desc">✓ ' + esc(s.bom) + '</div>' +
              '<div class="card-desc">✗ ' + esc(s.ruim) + '</div>' +
            '</div>').join('') +
        '</div>' +
        '<div class="card card-sec"><h3>O que comprar</h3>' +
          (a.tipo === 'buckboost'
            ? compra('Módulo buck-boost automático', 'modulo conversor buck boost automatico step up down', 'R$ 20–35')
            : '') +
          (escolhida === 'buck' || a.tipo === 'buckboost'
            ? compra('Módulo step-down MP1584EN (miniatura)', 'modulo step down mp1584en mini', 'R$ 8–14',
                     'Ajuste a saída com o multímetro no trimpot antes de ligar a carga.') +
              compra('Módulo step-down LM2596 (com display)', 'modulo lm2596 step down ajustavel', 'R$ 12–25')
            : '') +
          (escolhida === 'linear'
            ? (Math.abs(a.vout - 3.3) < 0.05
                ? compra('Regulador HT7333 (3,3 V, ideal para bateria)', 'ht7333 regulador 3.3v to-92', 'R$ 3–8 cada')
                : '') +
              (Math.abs(a.vout - 5) < 0.05
                ? compra('Regulador AMS1117-5.0', 'ams1117 5v modulo regulador', 'R$ 5–12')
                : '') +
              compra('LM317 (ajustável) + resistores', 'lm317 to-220 regulador ajustavel', 'R$ 3–8 cada')
            : '') +
          (viavelDiodo ? compra(a.diodos + '× diodo 1N4007', 'diodo 1n4007 100 pecas', 'R$ 10–18 o pacote') : '') +
        '</div>';
    }

    return '' +
    cabecalho('Quero X volts', 'Diga o que você tem e o que precisa; eu digo qual peça resolve.') +
    nota('dica', '<b>Resistor não entra aqui.</b> Resistor limita corrente, não define tensão. ' +
      'Para alimentar alguma coisa com menos volts, a resposta é sempre diodo, regulador ou conversor — ' +
      'nunca dois resistores.') +
    '<div class="card card-sec">' +
      '<div class="campos">' +
        '<div class="campo"><label for="qvin">Tensão que eu tenho (V)</label>' +
          '<div class="dupla">' +
            '<input type="number" id="qvin" step="any" min="0" value="' + st.vin + '">' +
            '<select id="qfp"><option value="">exemplos</option>' +
              FONTES.map((f) => '<option value="' + f.v + '">' + esc(f.nome) + '</option>').join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="campo"><label for="qvout">Tensão que eu quero (V)</label>' +
          '<input type="number" id="qvout" step="any" min="0" value="' + st.vout + '"></div>' +
        '<div class="campo"><label for="qma">Corrente da carga (mA)</label>' +
          '<input type="number" id="qma" step="any" min="0" value="' + st.ma + '">' +
          '<span class="ajuda">Está na etiqueta do aparelho. Na dúvida, chute alto.</span></div>' +
        '<div class="campo"><label for="qbat">A entrada é bateria?</label>' +
          '<select id="qbat">' +
            '<option value="1"' + (st.bateria ? ' selected' : '') + '>Sim — a tensão cai ao descarregar</option>' +
            '<option value="0"' + (!st.bateria ? ' selected' : '') + '>Não — é fonte de tomada</option>' +
          '</select></div>' +
      '</div>' +
    '</div>' +
    '<div class="card-sec">' + bloco + '</div>';
  },

  mount(raiz) {
    const self = this;
    const pega = () => {
      self.st.vin = num($('#qvin', raiz).value) || 0;
      self.st.vout = num($('#qvout', raiz).value) || 0;
      self.st.ma = num($('#qma', raiz).value) || 0;
      self.st.bateria = $('#qbat', raiz).value === '1';
      rerender();
    };
    ['#qvin', '#qvout', '#qma', '#qbat'].forEach((s) => {
      const el = $(s, raiz);
      if (el) el.addEventListener('change', pega);
    });
    const fp = $('#qfp', raiz);
    if (fp) fp.addEventListener('change', () => {
      if (!fp.value) return;
      $('#qvin', raiz).value = fp.value;
      pega();
    });
  }
};

/* -------- 7.8 Potência e calor ------------------------------------------- */

TOOLS.dissipacao = {
  nome: 'Potência e calor',
  desc: 'Quanto o componente esquenta e se ele precisa de dissipador.',
  grupo: 'energia',
  icone: 'regua',
  pronto: true,
  st: { v: 6.7, i: 300, montagem: 'sem', ambiente: 30 },

  render() {
    const st = this.st;
    const p = st.v * (st.i / 1000);
    const m = MONTAGENS.filter((x) => x.id === st.montagem)[0] || MONTAGENS[0];
    const subida = p * m.rth;
    const temp = st.ambiente + subida;

    let veredito, classe;
    if (temp <= 60) { veredito = 'Frio. Nem esquenta direito — pode encostar o dedo.'; classe = ''; }
    else if (temp <= 85) { veredito = 'Morno. Normal e seguro, mas quente ao toque.'; classe = ''; }
    else if (temp <= 110) { veredito = 'Quente demais para o conforto. Funciona, mas envelhece rápido e queima o dedo.'; classe = 'aviso'; }
    else if (temp <= 150) { veredito = 'No limite. A maioria dos componentes desliga sozinha por proteção térmica aqui.'; classe = 'aviso'; }
    else { veredito = 'Vai queimar. Nenhum semicondutor comum sobrevive a essa temperatura.'; classe = 'perigo'; }

    const precisaMelhor = temp > 85;
    const melhor = MONTAGENS.filter((x) => st.ambiente + p * x.rth <= 85)[0];

    return '' +
    cabecalho('Potência e calor', 'Todo watt que não vira trabalho vira calor. Aqui você vê quanto.') +
    '<div class="card">' +
      '<div class="campos">' +
        '<div class="campo"><label for="dv">Tensão em cima do componente (V)</label>' +
          '<input type="number" id="dv" step="any" min="0" value="' + st.v + '">' +
          '<span class="ajuda">Num regulador: entrada menos saída.</span></div>' +
        '<div class="campo"><label for="di">Corrente que passa (mA)</label>' +
          '<input type="number" id="di" step="any" min="0" value="' + st.i + '"></div>' +
        '<div class="campo"><label for="dm">Como está montado</label>' +
          '<select id="dm">' + MONTAGENS.map((x) =>
            '<option value="' + x.id + '"' + (st.montagem === x.id ? ' selected' : '') + '>' +
            esc(x.nome) + '</option>').join('') + '</select></div>' +
        '<div class="campo"><label for="da">Temperatura ambiente (°C)</label>' +
          '<input type="number" id="da" step="any" value="' + st.ambiente + '">' +
          '<span class="ajuda">Dentro de uma caixa fechada, some uns 15 °C.</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="card-sec">' +
      resultadoGrande('O componente vai chegar a', sig(temp, 3) + ' °C', [
        'Calor gerado: <b>' + unidade(p, 'W') + '</b>',
        'Subida: <b>+' + sig(subida, 3) + ' °C</b>',
        'Ambiente: <b>' + sig(st.ambiente, 3) + ' °C</b>'
      ]) +
    '</div>' +
    '<div class="card-sec">' + nota(classe, '<b>' + esc(veredito) + '</b>') + '</div>' +
    (precisaMelhor
      ? '<div class="card-sec">' + nota('dica', melhor
          ? 'Com <b>' + esc(melhor.nome.toLowerCase()) + '</b> a temperatura cairia para cerca de <b>' +
            sig(st.ambiente + p * melhor.rth, 3) + ' °C</b>, que é seguro.'
          : 'Nem com ventoinha isso fica seguro. ' + unidade(p, 'W') + ' é calor demais para dissipar ' +
            'desse jeito — troque a solução: um conversor <i>buck</i> no lugar do regulador linear ' +
            'geraria menos de um décimo desse calor.') + '</div>'
      : '') +
    '<div class="card card-sec">' +
      '<h3>A conta</h3>' +
      conta([
        '<span class="cmt">// calor gerado</span>',
        'P = V × I = ' + sig(st.v) + ' V × ' + sig(st.i / 1000) + ' A = <b>' + unidade(p, 'W') + '</b>',
        '<span class="cmt">// cada montagem esquenta X graus por watt (resistência térmica)</span>',
        'subida = P × ' + m.rth + ' °C/W = <b>' + sig(subida, 3) + ' °C</b>',
        'temperatura = ambiente + subida = ' + sig(st.ambiente, 3) + ' + ' + sig(subida, 3) +
          ' = <b>' + sig(temp, 3) + ' °C</b>'
      ]) +
      '<p class="card-desc">Os valores de °C/W aqui são ordens de grandeza de bancada, boas para decidir ' +
      '“precisa ou não precisa de dissipador”. Para um projeto sério, pegue o número exato no datasheet ' +
      'do componente e do dissipador.</p>' +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>O que comprar</h3>' +
      compra('Dissipador de alumínio para TO-220', 'dissipador aluminio to-220 kit', 'R$ 15–30 o kit') +
      compra('Pasta térmica', 'pasta termica seringa', 'R$ 8–20',
             'Sem pasta, metade do dissipador não serve para nada — o ar entre as peças isola.') +
    '</div>' +
    nota('aviso', '<b>Um detalhe que pega muita gente:</b> na maioria dos reguladores TO-220 a aba ' +
      'metálica é <b>ligada eletricamente</b> a um dos pinos. Se você parafusar dois deles no mesmo ' +
      'dissipador sem isolador de mica, criou um curto.');
  },

  mount(raiz) {
    const self = this;
    const pega = () => {
      self.st.v = num($('#dv', raiz).value) || 0;
      self.st.i = num($('#di', raiz).value) || 0;
      self.st.montagem = $('#dm', raiz).value;
      self.st.ambiente = num($('#da', raiz).value) || 0;
      rerender();
    };
    ['#dv', '#di', '#dm', '#da'].forEach((s) => {
      const el = $(s, raiz);
      if (el) el.addEventListener('change', pega);
    });
  }
};

/* -------- 7.9 Ferramentas que ainda vão chegar --------------------------- */

const EM_BREVE = [
  { id: 'pack', nome: 'Montador de pack 18650', grupo: 'baterias', icone: 'pack', entrega: 3,
    desc: 'Série e paralelo: quantos volts, quantos mAh, quanta corrente.' },
  { id: 'bms', nome: 'BMS e carregador', grupo: 'baterias', icone: 'escudo', entrega: 3,
    desc: 'Qual BMS usar e qual carregador — inclui o resistor do TP4056.' },
  { id: 'autonomia', nome: 'Autonomia', grupo: 'baterias', icone: 'relogio', entrega: 3,
    desc: 'Quanto tempo a bateria aguenta com o consumo do seu aparelho.' },
  { id: 'recuperar', nome: 'Recuperar aparelho', grupo: 'baterias', icone: 'ferramenta', entrega: 3,
    desc: 'Passo a passo para dar vida nova a um aparelho antigo de bateria.' },
  { id: 'protoboard', nome: 'Protoboard Arduino', grupo: 'arduino', icone: 'chip', entrega: 4,
    desc: 'Circuitos montados e desenhados, com o código pronto para copiar.' },
  { id: 'consulta', nome: 'Consulta rápida', grupo: 'arduino', icone: 'livro', entrega: 4,
    desc: 'Pinagem, capacitores, código SMD e bitola de fio.' },
  { id: 'projetos', nome: 'Meus projetos', grupo: 'ajustes', icone: 'pasta', entrega: 4,
    desc: 'Salve seus cálculos e monte listas de compras.' }
];

EM_BREVE.forEach((t) => {
  TOOLS[t.id] = {
    nome: t.nome, desc: t.desc, grupo: t.grupo, icone: t.icone, pronto: false, entrega: t.entrega,
    render() {
      return cabecalho(this.nome, this.desc) +
        '<div class="card" style="text-align:center;padding:40px 20px">' +
          '<div class="card-icone" style="margin:0 auto 16px">' + icone(this.icone) + '</div>' +
          '<h3>Ainda estou construindo</h3>' +
          '<p class="card-desc" style="max-width:440px;margin:8px auto 0">' + esc(this.desc) +
          '<br><br>Chega na <b>entrega ' + this.entrega + '</b>. Quando eu publicar, é só abrir o app de ' +
          'novo — ele se atualiza sozinho.</p>' +
        '</div>';
    },
    mount() {}
  };
});

/* ==========================================================================
   8. Navegação
   ========================================================================== */

const GRUPOS = [
  { id: 'inicio',     nome: 'Início',     icone: 'casa',        tabbar: true },
  { id: 'resistores', nome: 'Resistores', icone: 'resistor',    tabbar: true },
  { id: 'energia',    nome: 'Energia',    icone: 'raio',        tabbar: true },
  { id: 'baterias',   nome: 'Baterias',   icone: 'bateria',     tabbar: true },
  { id: 'arduino',    nome: 'Arduino',    icone: 'chip',        tabbar: true },
  { id: 'ajustes',    nome: 'Ajustes',    icone: 'engrenagem',  tabbar: false }
];

const grupoPorId = (id) => GRUPOS.filter((g) => g.id === id)[0];
const toolsDoGrupo = (g) => Object.keys(TOOLS).filter((k) => TOOLS[k].grupo === g).map((k) => ({ id: k, t: TOOLS[k] }));

function cabecalho(titulo, sub) {
  return '<div class="topo">' +
    '<button class="voltar" id="btnVoltar" aria-label="Voltar">' + icone('seta', 18) + '</button>' +
    '<div><h1>' + esc(titulo) + '</h1>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>' +
  '</div>';
}

function cardFerramenta(id, t) {
  return '<a class="card' + (t.pronto ? '' : ' embreve') + '" href="#/t/' + id + '">' +
    (t.pronto ? '' : '<span class="selo">Em breve</span>') +
    '<div class="card-icone">' + icone(t.icone) + '</div>' +
    '<h3>' + esc(t.nome) + '</h3>' +
    '<div class="card-desc">' + esc(t.desc) + '</div>' +
  '</a>';
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function telaInicio() {
  const prontas = Object.keys(TOOLS).filter((k) => TOOLS[k].pronto && TOOLS[k].grupo !== 'ajustes');
  const total = Object.keys(TOOLS).length;

  let secoes = '';
  GRUPOS.filter((g) => g.id !== 'inicio').forEach((g) => {
    const lista = toolsDoGrupo(g.id);
    if (!lista.length) return;
    secoes += '<div class="secao-titulo">' + esc(g.nome) + '</div>' +
      '<div class="grade">' + lista.map((x) => cardFerramenta(x.id, x.t)).join('') + '</div>';
  });

  return '' +
  '<div style="margin-bottom:20px">' +
    '<div class="saudacao">' + esc(saudacao()) + '</div>' +
    '<div class="marca-titulo">E-<b>TronIQ</b></div>' +
    '<div class="sub" style="color:var(--txt-2);font-size:14px;margin-top:4px">' +
      'Eletrônica explicada de um jeito que dá pra usar.</div>' +
  '</div>' +
  '<div class="card" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' +
    '<img src="icons/logo-mark.png" alt="" width="56" height="56" style="filter:drop-shadow(0 0 14px rgba(34,211,238,.35))">' +
    '<div style="flex:1;min-width:180px">' +
      '<h3>' + prontas.length + ' de ' + (total - 1) + ' ferramentas prontas</h3>' +
      '<div class="card-desc">O resto chega nas próximas entregas. O app se atualiza sozinho.</div>' +
    '</div>' +
  '</div>' +
  secoes +
  '<div class="rodape">' +
    '<span>E-TronIQ v' + esc(VERSAO) + '</span>' +
    '<span>Dados salvos só neste aparelho</span>' +
    '<a href="#/t/ajustes">Ajustes e backup</a>' +
  '</div>';
}

function telaGrupo(id) {
  const g = grupoPorId(id);
  if (!g) return telaInicio();
  const lista = toolsDoGrupo(id);
  return cabecalho(g.nome, lista.length + (lista.length === 1 ? ' ferramenta' : ' ferramentas')) +
    '<div class="grade">' + lista.map((x) => cardFerramenta(x.id, x.t)).join('') + '</div>';
}

/* ---------- roteador ------------------------------------------------------ */

let rotaAtual = { tipo: 'inicio', id: null };

function lerRota() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  if (!h) return { tipo: 'inicio', id: null };
  const p = h.split('/');
  if (p[0] === 't' && p[1] && TOOLS[p[1]]) return { tipo: 'tool', id: p[1] };
  if (p[0] === 'g' && p[1] && grupoPorId(p[1])) return { tipo: 'grupo', id: p[1] };
  return { tipo: 'inicio', id: null };
}

function grupoAtivo() {
  if (rotaAtual.tipo === 'inicio') return 'inicio';
  if (rotaAtual.tipo === 'grupo') return rotaAtual.id;
  return TOOLS[rotaAtual.id] ? TOOLS[rotaAtual.id].grupo : 'inicio';
}

function desenharNav() {
  const ativo = grupoAtivo();

  $('#rail').innerHTML =
    '<img class="rail-logo" src="icons/logo-mark.png" alt="E-TronIQ">' +
    GRUPOS.map((g, idx) =>
      (idx === GRUPOS.length - 1 ? '<div class="rail-espaco"></div>' : '') +
      '<button class="rail-btn' + (ativo === g.id ? ' ativo' : '') + '" data-grupo="' + g.id + '" ' +
        'aria-label="' + esc(g.nome) + '">' + icone(g.icone) +
        '<span class="rail-dica">' + esc(g.nome) + '</span></button>'
    ).join('') +
    '<a class="rail-versao" href="#/t/ajustes" title="Histórico de versões">v' + esc(VERSAO) + '</a>';

  $('#tabbar').innerHTML = GRUPOS.filter((g) => g.tabbar).map((g) =>
    '<button class="' + (ativo === g.id ? 'ativo' : '') + '" data-grupo="' + g.id + '">' +
      icone(g.icone) + '<span>' + esc(g.nome) + '</span></button>').join('');
}

function irPara(grupo) {
  location.hash = grupo === 'inicio' ? '#/' : '#/g/' + grupo;
}

function render() {
  rotaAtual = lerRota();
  const app = $('#app');
  let html, tool = null;

  if (rotaAtual.tipo === 'tool') {
    tool = TOOLS[rotaAtual.id];
    html = tool.render();
  } else if (rotaAtual.tipo === 'grupo') {
    html = rotaAtual.id === 'inicio' ? telaInicio() : telaGrupo(rotaAtual.id);
  } else {
    html = telaInicio();
  }

  // Um contêiner novo a cada render: os listeners que as ferramentas registram
  // morrem junto com ele. Registrar direto em #app faria os handlers se acumularem
  // a cada redesenho (mesmo clique disparando várias vezes).
  const raiz = document.createElement('div');
  raiz.innerHTML = html;
  app.innerHTML = '';
  app.appendChild(raiz);
  desenharNav();

  const bv = $('#btnVoltar', raiz);
  if (bv) bv.addEventListener('click', () => {
    if (rotaAtual.tipo === 'tool' && tool) irPara(tool.grupo);
    else location.hash = '#/';
  });

  if (tool && tool.mount) tool.mount(raiz);

  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/** Redesenha a tela atual mantendo o estado das ferramentas. */
function rerender() { render(); }

/* ==========================================================================
   9. Inicialização
   ========================================================================== */

document.addEventListener('click', (ev) => {
  const g = ev.target.closest('[data-grupo]');
  if (g) { irPara(g.getAttribute('data-grupo')); return; }
  const c = ev.target.closest('[data-copiar]');
  if (c) { copiar(c.getAttribute('data-copiar')); }
});

window.addEventListener('hashchange', render);

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline continua funcionando pelo cache */ });
  });
}
