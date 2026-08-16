/* ==========================================================================
   E-TronIQ — assistente de eletrônica
   JavaScript puro, sem framework, sem build.
   ========================================================================== */

'use strict';

const VERSAO = '1.3.0';

const CHANGELOG = [
  {
    versao: '1.3.0',
    data: '2026-08-16',
    itens: [
      'Protoboard Arduino: 8 montagens prontas, desenhadas furo a furo, com código para copiar.',
      'Ponte de IA: o app monta o pedido, você cola no seu assistente e traz a resposta de volta — ele desenha.',
      'Consulta rápida: pinagem do Uno/Nano, código de capacitor, resistor SMD e bitola de fio.',
      'Meus projetos: salve os circuitos neste aparelho.',
      'Com isso, as 14 ferramentas da versão 1 estão prontas.'
    ]
  },
  {
    versao: '1.2.0',
    data: '2026-08-16',
    itens: [
      'Montador de pack 18650: série e paralelo com o pack desenhado célula por célula.',
      'BMS e carregador: qual proteção usar e o resistor que programa a corrente do TP4056.',
      'Autonomia: quanto tempo a bateria aguenta, com anel de carga útil.',
      'Assistente de recuperação: transforma um aparelho antigo em projeto, com lista de compras.',
      'Cada grupo de ferramentas ganhou sua própria cor nos ícones.'
    ]
  },
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

/* Cor de identidade de cada grupo — discreta, só nos ícones e nos títulos de seção. */
const CORES_GRUPO = {
  resistores: { c: '#22d3ee', f: 'rgba(34,211,238,.15)',  b: 'rgba(34,211,238,.22)' },
  energia:    { c: '#f5a524', f: 'rgba(245,165,36,.15)',  b: 'rgba(245,165,36,.24)' },
  baterias:   { c: '#2fd07a', f: 'rgba(47,208,122,.15)',  b: 'rgba(47,208,122,.24)' },
  arduino:    { c: '#a855f7', f: 'rgba(168,85,247,.15)',  b: 'rgba(168,85,247,.24)' },
  ajustes:    { c: '#8fa0bd', f: 'rgba(143,160,189,.13)', b: 'rgba(143,160,189,.22)' },
  inicio:     { c: '#22d3ee', f: 'rgba(34,211,238,.15)',  b: 'rgba(34,211,238,.22)' }
};

/** Variáveis CSS de cor para aplicar num elemento do grupo. */
function corGrupo(id) {
  const g = CORES_GRUPO[id] || CORES_GRUPO.inicio;
  return '--acc:' + g.c + ';--acc-fraca:' + g.f + ';--acc-borda:' + g.b;
}

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

/* ---------- baterias ------------------------------------------------------ */

/* Tensões por química, em volts por célula. */
const QUIMICAS = {
  liion:   { nome: 'Li-ion (18650 / 21700)', nom: 3.6, cheio: 4.2,  vazio: 3.0, corte: 2.5 },
  lifepo4: { nome: 'LiFePO4',                nom: 3.2, cheio: 3.65, vazio: 2.5, corte: 2.0 }
};

/* Células comuns no mercado brasileiro. imax = descarga contínua segura, em A. */
const CELULAS = [
  { id: 'generica',  nome: '18650 comum (sem marca)',            mah: 2200, imax: 4,  quim: 'liion' },
  { id: 'reciclada', nome: '18650 recuperada de notebook',       mah: 1800, imax: 3,  quim: 'liion' },
  { id: 'samsung30q',nome: '18650 Samsung 30Q / LG HG2',         mah: 3000, imax: 15, quim: 'liion' },
  { id: 'samsung35e',nome: '18650 Samsung 35E / LG MJ1',         mah: 3400, imax: 8,  quim: 'liion' },
  { id: 'p21700',    nome: '21700 4000 mAh',                     mah: 4000, imax: 15, quim: 'liion' },
  { id: 'lifepo4',   nome: 'LiFePO4 32700 6000 mAh',             mah: 6000, imax: 12, quim: 'lifepo4' }
];

const celulaPorId = (id) => CELULAS.filter((c) => c.id === id)[0] || CELULAS[0];

/** Calcula tudo de um pack nSmP. */
function calcularPack(cel, s, p) {
  const q = QUIMICAS[cel.quim];
  const ah = (cel.mah * p) / 1000;
  return {
    quim: q,
    celulas: s * p,
    vNom: q.nom * s,
    vCheio: q.cheio * s,
    vVazio: q.vazio * s,
    mah: cel.mah * p,
    ah: ah,
    wh: q.nom * s * ah,
    iMax: cel.imax * p,
    s: s, p: p, cel: cel
  };
}

/* ==========================================================================
   4. Desenhos (SVG)
   ========================================================================== */

/**
 * Desenha o pack: cada coluna é um grupo em paralelo, as colunas ficam em série.
 * @param {number} s colunas (série)  @param {number} p células por coluna (paralelo)
 */
function svgPack(s, p, cor) {
  const S = Math.min(s, 10), P = Math.min(p, 6);
  const cw = 30, ch = 64, gx = 22, gy = 12;
  const larg = S * cw + (S - 1) * gx + 70;
  const alt = P * ch + (P - 1) * gy + 56;
  const x0 = 36, y0 = 26;
  const acc = cor || '#2fd07a';
  let cels = '', barras = '', ligacoes = '';

  for (let i = 0; i < S; i++) {
    const x = x0 + i * (cw + gx);
    // barramentos do grupo em paralelo (positivo em cima, negativo embaixo)
    if (P > 1) {
      barras += '<rect x="' + (x - 4) + '" y="' + (y0 - 7) + '" width="' + (cw + 8) + '" height="5" rx="2.5" fill="' + acc + '" opacity=".55"/>' +
                '<rect x="' + (x - 4) + '" y="' + (y0 + P * ch + (P - 1) * gy + 2) + '" width="' + (cw + 8) + '" height="5" rx="2.5" fill="#8fa0bd" opacity=".45"/>';
    }
    for (let j = 0; j < P; j++) {
      const y = y0 + j * (ch + gy);
      cels +=
        '<g>' +
          '<rect x="' + x + '" y="' + y + '" width="' + cw + '" height="' + ch + '" rx="7" ' +
            'fill="#1a2029" stroke="' + acc + '" stroke-opacity=".45"/>' +
          '<rect x="' + (x + 3) + '" y="' + (y + 4) + '" width="' + (cw - 6) + '" height="' + (ch * 0.42) + '" rx="4" ' +
            'fill="' + acc + '" opacity=".22"/>' +
          '<rect x="' + (x + cw / 2 - 5) + '" y="' + (y - 4) + '" width="10" height="5" rx="2" fill="#c9d2e0"/>' +
          '<text x="' + (x + cw / 2) + '" y="' + (y + ch - 9) + '" text-anchor="middle" ' +
            'font-size="11" fill="#8fa0bd" font-family="monospace">' + (i + 1) + '</text>' +
        '</g>';
      // ligação em série: negativo de uma coluna no positivo da seguinte
      if (i < S - 1 && j === 0) {
        ligacoes += '<path d="M' + (x + cw + 2) + ' ' + (y0 - 5) + ' h' + (gx - 4) + '" ' +
          'stroke="' + acc + '" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>';
      }
    }
  }

  const yMeio = y0 + (P * ch + (P - 1) * gy) / 2;
  const xFim = x0 + (S - 1) * (cw + gx) + cw;
  const terminais =
    '<circle cx="16" cy="' + yMeio + '" r="8" fill="none" stroke="#f4526b" stroke-width="4"/>' +
    '<text x="16" y="' + (yMeio + 24) + '" text-anchor="middle" font-size="12" fill="#f4526b" font-family="monospace">+</text>' +
    '<path d="M24 ' + yMeio + ' H' + (x0 - 6) + '" stroke="#f4526b" stroke-width="2.5" opacity=".6"/>' +
    '<circle cx="' + (larg - 16) + '" cy="' + yMeio + '" r="8" fill="none" stroke="#8fa0bd" stroke-width="4"/>' +
    '<text x="' + (larg - 16) + '" y="' + (yMeio + 24) + '" text-anchor="middle" font-size="12" fill="#8fa0bd" font-family="monospace">−</text>' +
    '<path d="M' + (xFim + 6) + ' ' + yMeio + ' H' + (larg - 24) + '" stroke="#8fa0bd" stroke-width="2.5" opacity=".6"/>';

  const corte = (s > S || p > P)
    ? '<text x="' + (larg / 2) + '" y="' + (alt - 6) + '" text-anchor="middle" font-size="12" fill="#8fa0bd">' +
      'mostrando ' + S + 'S' + P + 'P de ' + s + 'S' + p + 'P</text>'
    : '';

  return '<div class="rolagem"><svg class="palco-pack" viewBox="0 0 ' + larg + ' ' + alt + '" ' +
    'width="' + larg + '" role="img" aria-label="Pack ' + s + 'S' + p + 'P">' +
    barras + ligacoes + cels + terminais + corte + '</svg></div>';
}

/* ---------- protoboard ---------------------------------------------------- */

/* Geometria da protoboard desenhada. 30 colunas é o suficiente e cabe na tela. */
const PB = {
  colunas: 30, passo: 22, x0: 46,
  railMais: 30, railMenos: 52,
  linhas: { j: 92, i: 114, h: 136, g: 158, f: 180, e: 216, d: 238, c: 260, b: 282, a: 304 },
  railMaisB: 344, railMenosB: 366,
  alturaPlaca: 150, folgaPlaca: 40
};

PB.largura = PB.x0 + PB.colunas * PB.passo + 30;
PB.altura = PB.railMenosB + 30;

/** Converte uma referência ("e5", "+12", "-3") em coordenadas na protoboard. */
function pontoProtoboard(ref) {
  const r = String(ref || '').trim().toLowerCase();
  const m = r.match(/^([a-j+-])\s*(\d{1,2})$/);
  if (!m) return null;
  const linha = m[1], col = parseInt(m[2], 10);
  if (col < 1 || col > PB.colunas) return null;
  const x = PB.x0 + (col - 1) * PB.passo;
  let y;
  if (linha === '+') y = PB.railMais;
  else if (linha === '-') y = PB.railMenos;
  else y = PB.linhas[linha];
  if (y == null) return null;
  return { x: x, y: y + PB.alturaPlaca + PB.folgaPlaca, col: col, linha: linha };
}

/* Pinos do Arduino que o app reconhece. */
const PINOS_ARDUINO = ['5V', '3V3', 'GND', 'VIN',
  'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13',
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];

const ehPinoArduino = (n) => PINOS_ARDUINO.indexOf(String(n || '').trim().toUpperCase()) >= 0;

/* Peças que o app sabe desenhar. */
const PECAS = {
  resistor:      { pinos: 2, rotulo: 'Resistor' },
  led:           { pinos: 2, rotulo: 'LED' },
  botao:         { pinos: 2, rotulo: 'Botão' },
  potenciometro: { pinos: 3, rotulo: 'Potenciômetro' },
  ldr:           { pinos: 2, rotulo: 'LDR' },
  buzzer:        { pinos: 2, rotulo: 'Buzzer' },
  capacitor:     { pinos: 2, rotulo: 'Capacitor' },
  diodo:         { pinos: 2, rotulo: 'Diodo' },
  transistor:    { pinos: 3, rotulo: 'Transistor' },
  ds18b20:       { pinos: 3, rotulo: 'DS18B20' },
  servo_sg90:    { pinos: 3, rotulo: 'Servo SG90' },
  hc_sr04:       { pinos: 4, rotulo: 'HC-SR04' },
  ssd1306:       { pinos: 4, rotulo: 'Display OLED' },
  rele_1ch:      { pinos: 3, rotulo: 'Módulo relé' },
  dht11:         { pinos: 3, rotulo: 'DHT11' }
};

const CORES_FIO = {
  vermelho: '#e03131', preto: '#2b3038', preta: '#2b3038',
  azul: '#1c7ed6', verde: '#2f9e44', amarelo: '#f2c53d', laranja: '#f2820c',
  branco: '#e8ecf3', roxo: '#8b5cf6', violeta: '#8b5cf6', cinza: '#9aa1ad', marrom: '#7a4a2b'
};

const corFio = (n) => CORES_FIO[String(n || '').toLowerCase()] || '#9aa1ad';

/** Desenha um componente entre seus pinos. */
function desenharPeca(c) {
  const pts = (c.pinos || []).map(pontoProtoboard).filter(Boolean);
  if (!pts.length) return '';
  const tipo = c.tipo;
  const rot = c.rotulo || (PECAS[tipo] ? PECAS[tipo].rotulo : tipo);

  // pernas até os furos
  let pernas = pts.map((p) =>
    '<circle cx="' + p.x + '" cy="' + p.y + '" r="3.5" fill="#cbd3e0"/>').join('');

  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

  if (tipo === 'resistor' && pts.length === 2) {
    const a = pts[0], b = pts[1];
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    const comp = Math.hypot(b.x - a.x, b.y - a.y);
    const corpo = Math.max(26, comp - 16);
    let faixas = '';
    const cores = (c.faixas && c.faixas.length ? c.faixas : ['marrom', 'preto', 'vermelho', 'dourado']);
    cores.slice(0, 4).forEach((cc, i) => {
      const co = corPorId(cc);
      faixas += '<rect x="' + (-corpo / 2 + 5 + i * 6) + '" y="-8" width="3.5" height="16" ' +
        'fill="' + (co ? co.hex : '#555') + '"/>';
    });
    return '<g>' +
      '<path d="M' + a.x + ' ' + a.y + ' L' + b.x + ' ' + b.y + '" stroke="#cbd3e0" stroke-width="2.5"/>' +
      '<g transform="translate(' + cx + ',' + cy + ') rotate(' + ang + ')">' +
        '<rect x="' + (-corpo / 2) + '" y="-9" width="' + corpo + '" height="18" rx="7" fill="#cdb98d" stroke="#8a7a5c"/>' +
        faixas +
      '</g>' + pernas + '</g>';
  }

  if (tipo === 'led' && pts.length === 2) {
    const cor = corPorId(c.cor || 'vermelho');
    const hex = cor ? cor.hex : '#e03131';
    return '<g>' +
      '<path d="M' + pts[0].x + ' ' + pts[0].y + ' L' + cx + ' ' + cy + ' L' + pts[1].x + ' ' + pts[1].y + '" ' +
        'stroke="#cbd3e0" stroke-width="2.5" fill="none"/>' +
      '<circle cx="' + cx + '" cy="' + (cy - 12) + '" r="11" fill="' + hex + '" fill-opacity=".85" stroke="' + hex + '"/>' +
      '<circle cx="' + (cx - 3) + '" cy="' + (cy - 15) + '" r="3" fill="#fff" opacity=".5"/>' +
      pernas + '</g>';
  }

  if (tipo === 'botao') {
    return '<g>' +
      '<rect x="' + (cx - 17) + '" y="' + (cy - 17) + '" width="34" height="34" rx="4" fill="#2a313d" stroke="#4a5464"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="#c9d2e0"/>' + pernas + '</g>';
  }

  if (tipo === 'potenciometro') {
    return '<g>' +
      '<rect x="' + (cx - 20) + '" y="' + (cy - 26) + '" width="40" height="30" rx="5" fill="#1c7ed6" fill-opacity=".35" stroke="#1c7ed6"/>' +
      '<circle cx="' + cx + '" cy="' + (cy - 11) + '" r="10" fill="#2a313d" stroke="#c9d2e0"/>' +
      '<path d="M' + cx + ' ' + (cy - 19) + ' v6" stroke="#c9d2e0" stroke-width="2.5"/>' +
      pernas + '</g>';
  }

  // qualquer módulo: caixa rotulada com os pinos embaixo
  const larg = Math.max(78, (pts.length - 1) * PB.passo + 40);
  return '<g>' +
    '<rect x="' + (cx - larg / 2) + '" y="' + (cy - 46) + '" width="' + larg + '" height="40" rx="6" ' +
      'fill="#141922" stroke="#22d3ee" stroke-opacity=".55"/>' +
    '<text x="' + cx + '" y="' + (cy - 21) + '" text-anchor="middle" font-size="12" fill="#e8ecf3">' +
      esc(rot) + '</text>' +
    pts.map((p) => '<path d="M' + p.x + ' ' + (cy - 6) + ' V' + p.y + '" stroke="#cbd3e0" stroke-width="2"/>').join('') +
    pernas + '</g>';
}

/** Desenha o Arduino, a protoboard e os fios entre eles. */
function svgProtoboard(circ) {
  const comps = circ.componentes || [];
  const ligs = circ.ligacoes || [];

  // pinos do Arduino realmente usados, distribuídos na borda de baixo da placa
  const usados = [];
  ligs.forEach((l) => {
    [l.de, l.para].forEach((n) => {
      const up = String(n || '').trim().toUpperCase();
      if (ehPinoArduino(up) && usados.indexOf(up) < 0) usados.push(up);
    });
  });
  const ordem = PINOS_ARDUINO.filter((p) => usados.indexOf(p) >= 0);
  const px0 = 90, pxFim = PB.largura - 90;
  const passoP = ordem.length > 1 ? (pxFim - px0) / (ordem.length - 1) : 0;
  const yPino = PB.alturaPlaca - 6;
  const posPino = {};
  ordem.forEach((p, i) => { posPino[p] = ordem.length > 1 ? px0 + i * passoP : (px0 + pxFim) / 2; });

  const ponto = (nome) => {
    const up = String(nome || '').trim().toUpperCase();
    if (posPino[up] != null) return { x: posPino[up], y: yPino, placa: true };
    return pontoProtoboard(nome);
  };

  // --- placa Arduino
  let placa =
    '<g>' +
      '<rect x="60" y="18" width="' + (PB.largura - 120) + '" height="' + (PB.alturaPlaca - 30) + '" rx="12" ' +
        'fill="#0f3b3a" stroke="#22d3ee" stroke-opacity=".4"/>' +
      '<text x="' + (PB.largura / 2) + '" y="62" text-anchor="middle" font-size="17" font-weight="700" ' +
        'fill="#7de3ef" font-family="monospace">' + esc(circ.placa === 'arduino_nano' ? 'ARDUINO NANO' : 'ARDUINO UNO') + '</text>' +
      '<text x="' + (PB.largura / 2) + '" y="84" text-anchor="middle" font-size="12" fill="#5fa8ae">' +
        esc(circ.titulo || 'circuito') + '</text>' +
      ordem.map((p) =>
        '<g>' +
          '<rect x="' + (posPino[p] - 15) + '" y="' + (yPino - 22) + '" width="30" height="20" rx="4" ' +
            'fill="#0b1a1c" stroke="#22d3ee" stroke-opacity=".5"/>' +
          '<text x="' + posPino[p] + '" y="' + (yPino - 8) + '" text-anchor="middle" font-size="11" ' +
            'fill="#9fe8f0" font-family="monospace">' + esc(p) + '</text>' +
          '<circle cx="' + posPino[p] + '" cy="' + yPino + '" r="3.5" fill="#c9d2e0"/>' +
        '</g>').join('') +
    '</g>';

  // --- protoboard
  const dy = PB.alturaPlaca + PB.folgaPlaca;
  let furos = '', trilhos = '';
  const larguraPB = PB.largura;

  trilhos +=
    '<rect x="20" y="' + (dy + 10) + '" width="' + (larguraPB - 40) + '" height="' + (PB.railMenosB + 12 - 10) + '" ' +
      'rx="10" fill="#e9ecf2" fill-opacity=".93"/>' +
    '<path d="M30 ' + (dy + PB.railMais - 12) + ' H' + (larguraPB - 30) + '" stroke="#e03131" stroke-width="2"/>' +
    '<path d="M30 ' + (dy + PB.railMenos + 12) + ' H' + (larguraPB - 30) + '" stroke="#2b3038" stroke-width="2"/>' +
    '<path d="M30 ' + (dy + PB.railMaisB - 12) + ' H' + (larguraPB - 30) + '" stroke="#e03131" stroke-width="2"/>' +
    '<path d="M30 ' + (dy + PB.railMenosB + 12) + ' H' + (larguraPB - 30) + '" stroke="#2b3038" stroke-width="2"/>' +
    // canaleta central
    '<rect x="26" y="' + (dy + 190) + '" width="' + (larguraPB - 52) + '" height="14" rx="3" fill="#c9cfda"/>';

  const linhasTodas = ['+', '-'].map((l) => ({ l: l, y: l === '+' ? PB.railMais : PB.railMenos }))
    .concat(Object.keys(PB.linhas).map((l) => ({ l: l, y: PB.linhas[l] })))
    .concat([{ l: '+', y: PB.railMaisB }, { l: '-', y: PB.railMenosB }]);

  linhasTodas.forEach((row) => {
    for (let c = 0; c < PB.colunas; c++) {
      const x = PB.x0 + c * PB.passo;
      furos += '<rect x="' + (x - 3.5) + '" y="' + (dy + row.y - 3.5) + '" width="7" height="7" rx="1.5" ' +
        'fill="#9aa3b2" fill-opacity=".85"/>';
    }
  });

  // letras e números de referência
  let refs = '';
  ['j', 'f', 'e', 'a'].forEach((l) => {
    refs += '<text x="30" y="' + (dy + PB.linhas[l] + 4) + '" font-size="11" fill="#5d6675" ' +
      'font-family="monospace" text-anchor="middle">' + l + '</text>';
  });
  for (let c = 0; c < PB.colunas; c += 5) {
    refs += '<text x="' + (PB.x0 + c * PB.passo) + '" y="' + (dy + PB.linhas.f - 14) + '" font-size="10" ' +
      'fill="#5d6675" font-family="monospace" text-anchor="middle">' + (c + 1) + '</text>';
  }

  // --- fios
  let fios = '';
  ligs.forEach((l) => {
    const a = ponto(l.de), b = ponto(l.para);
    if (!a || !b) return;
    const cor = corFio(l.cor);
    const dist = Math.abs(b.y - a.y);
    const cvA = a.placa ? a.y + Math.min(60, dist / 2) : a.y - Math.min(50, dist / 2);
    const cvB = b.placa ? b.y + Math.min(60, dist / 2) : b.y - Math.min(50, dist / 2);
    fios += '<path d="M' + a.x + ' ' + a.y + ' C' + a.x + ' ' + cvA + ', ' + b.x + ' ' + cvB + ', ' + b.x + ' ' + b.y + '" ' +
      'stroke="' + cor + '" stroke-width="3" fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<circle cx="' + a.x + '" cy="' + a.y + '" r="3" fill="' + cor + '"/>' +
      '<circle cx="' + b.x + '" cy="' + b.y + '" r="3" fill="' + cor + '"/>';
  });

  const pecas = comps.map(desenharPeca).join('');

  return '<div class="rolagem"><svg class="palco-pb" viewBox="0 0 ' + larguraPB + ' ' + (dy + PB.altura) + '" ' +
    'width="' + larguraPB + '" role="img" aria-label="Montagem na protoboard">' +
    trilhos + furos + refs + placa + fios + pecas + '</svg></div>';
}

/** Anel de progresso com gradiente da marca. */
function svgAnel(pct, valor, rotulo) {
  const p = Math.max(0, Math.min(100, pct));
  const r = 62, c = 2 * Math.PI * r;
  const uid = 'a' + Math.random().toString(36).slice(2, 8);
  return '<svg class="anel" viewBox="0 0 160 160" role="img" aria-label="' + esc(rotulo) + ': ' + Math.round(p) + '%">' +
    '<defs><linearGradient id="g' + uid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>' +
    '<circle cx="80" cy="80" r="' + r + '" fill="none" stroke="#232b38" stroke-width="13"/>' +
    '<circle cx="80" cy="80" r="' + r + '" fill="none" stroke="url(#g' + uid + ')" stroke-width="13" ' +
      'stroke-linecap="round" stroke-dasharray="' + (c * p / 100) + ' ' + c + '" ' +
      'transform="rotate(-90 80 80)"/>' +
    '<text x="80" y="76" text-anchor="middle" font-size="30" font-weight="700" fill="#e8ecf3" ' +
      'font-family="monospace">' + esc(valor) + '</text>' +
    '<text x="80" y="98" text-anchor="middle" font-size="12" fill="#9aa5b8">' + esc(rotulo) + '</text>' +
  '</svg>';
}

/* ---------- resistor ------------------------------------------------------ */

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

/* -------- 7.9 Baterias ---------------------------------------------------- */

/** Bloco de segurança de lítio. Aparece em toda tela que monta pack. */
function avisoLitio(extra) {
  return nota('perigo',
    '<b>Regras que não se negociam com lítio.</b> ' +
    'Nunca monte um pack sem BMS. Nunca solde ferro direto na célula — o calor estraga a célula por ' +
    'dentro e ela falha semanas depois; use solda ponto ou suporte com mola. Nunca misture células de ' +
    'capacidades, marcas ou idades diferentes no mesmo grupo em paralelo. Carregue sempre supervisionado ' +
    'e longe de coisa que pega fogo. Célula inchada, quente ou com cheiro se descarta, não se recupera.' +
    (extra ? ' ' + extra : ''));
}

TOOLS.pack = {
  nome: 'Montador de pack 18650',
  desc: 'Série e paralelo: quantos volts, quantos mAh, quanta corrente.',
  grupo: 'baterias',
  icone: 'pack',
  pronto: true,
  st: { cel: 'generica', s: 4, p: 2 },

  render() {
    const st = this.st;
    const cel = celulaPorId(st.cel);
    const s = Math.max(1, Math.min(20, Math.floor(st.s)));
    const p = Math.max(1, Math.min(12, Math.floor(st.p)));
    const k = calcularPack(cel, s, p);
    const acc = CORES_GRUPO.baterias.c;

    return '' +
    cabecalho('Montador de pack 18650', 'Escolha a célula e o arranjo; eu mostro o que esse pack vira.') +
    '<div class="card">' +
      '<div class="campos">' +
        '<div class="campo"><label for="pc">Célula</label>' +
          '<select id="pc">' + CELULAS.map((c) =>
            '<option value="' + c.id + '"' + (st.cel === c.id ? ' selected' : '') + '>' +
            esc(c.nome) + ' · ' + c.mah + ' mAh</option>').join('') + '</select></div>' +
        '<div class="campo"><label for="ps">Em série (S) — soma volts</label>' +
          '<input type="number" id="ps" min="1" max="20" step="1" value="' + s + '"></div>' +
        '<div class="campo"><label for="pp">Em paralelo (P) — soma capacidade</label>' +
          '<input type="number" id="pp" min="1" max="12" step="1" value="' + p + '"></div>' +
      '</div>' +
    '</div>' +
    '<div class="card-sec">' +
      resultadoGrande('Pack ' + s + 'S' + p + 'P', sig(k.vNom) + ' V · ' + k.mah + ' mAh', [
        'Energia: <b>' + sig(k.wh) + ' Wh</b>',
        'Células: <b>' + k.celulas + '</b>',
        'Corrente máx: <b>' + sig(k.iMax) + ' A</b>'
      ]) +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>Como fica ligado</h3>' +
      '<p class="card-desc">Cada coluna é um grupo em <b>paralelo</b> (as células trabalham juntas como ' +
      'se fossem uma só, maior). As colunas se ligam em <b>série</b>, uma empurrando a outra, e é isso ' +
      'que soma a tensão.</p>' +
      svgPack(s, p, acc) +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>As três tensões que importam</h3>' +
      '<div class="rolagem"><table class="tabela">' +
        '<tr><th>Situação</th><th>Tensão</th><th>O que significa</th></tr>' +
        '<tr><td>Cheio</td><td class="num">' + sig(k.vCheio) + ' V</td>' +
          '<td>Fim da carga. Passar disso estraga a célula.</td></tr>' +
        '<tr><td>Nominal</td><td class="num">' + sig(k.vNom) + ' V</td>' +
          '<td>É o número que se usa para chamar o pack. Fica aqui a maior parte do tempo.</td></tr>' +
        '<tr><td>Vazio</td><td class="num">' + sig(k.vVazio) + ' V</td>' +
          '<td>Hora de parar. Descarregar além disso mata a célula.</td></tr>' +
      '</table></div>' +
      '<p class="card-desc">Repare que a tensão <b>não</b> é fixa: esse pack entrega de ' +
      sig(k.vCheio) + ' V a ' + sig(k.vVazio) + ' V conforme descarrega. Se o seu aparelho precisa de ' +
      'tensão firme, é aí que entra um conversor.</p>' +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>A conta</h3>' +
      conta([
        '<span class="cmt">// série soma tensão</span>',
        'V = ' + s + ' × ' + sig(k.quim.nom) + ' V = <b>' + sig(k.vNom) + ' V</b>',
        '<span class="cmt">// paralelo soma capacidade e corrente</span>',
        'capacidade = ' + p + ' × ' + cel.mah + ' mAh = <b>' + k.mah + ' mAh</b>',
        'corrente máx = ' + p + ' × ' + sig(cel.imax) + ' A = <b>' + sig(k.iMax) + ' A</b>',
        '<span class="cmt">// energia total, que é o que define a autonomia de verdade</span>',
        'Wh = ' + sig(k.vNom) + ' V × ' + sig(k.ah) + ' Ah = <b>' + sig(k.wh) + ' Wh</b>'
      ]) +
    '</div>' +
    '<div class="card-sec">' + avisoLitio(
      p > 1 ? 'No seu caso, com ' + p + ' células em paralelo, o casamento é ainda mais importante: ' +
      'meça a capacidade de cada uma antes e agrupe só as parecidas.' : '') + '</div>' +
    '<div class="card card-sec">' +
      '<h3>O que comprar</h3>' +
      compra('Suporte para ' + k.celulas + ' células 18650 (' + s + 'x' + p + ')',
             'suporte 18650 ' + k.celulas + ' celulas holder', 'R$ 10–30') +
      compra('Fita de níquel para solda ponto', 'fita niquel 0.15 x 8mm 18650', 'R$ 20–50 o rolo',
             'Fita de aço não serve: esquenta e cria resistência.') +
      compra('BMS ' + s + 'S', 'bms ' + s + 's ' + Math.ceil(k.iMax / 10) * 10 + 'a balanceamento', 'R$ 15–60') +
      (st.cel === 'reciclada'
        ? compra('Testador de capacidade de célula', 'testador capacidade 18650 opus liitokala', 'R$ 120–350',
                 'Célula de notebook usada só presta depois de medida uma a uma. Muitas estão em metade da capacidade.')
        : compra('Células novas', esc(cel.nome).toLowerCase() + ' original', 'R$ 15–45 cada',
                 'Desconfie de 18650 anunciada com mais de 3600 mAh — não existe. É célula falsificada.')) +
    '</div>';
  },

  mount(raiz) {
    const self = this;
    const pega = () => {
      self.st.cel = $('#pc', raiz).value;
      self.st.s = Math.max(1, Math.min(20, Math.floor(num($('#ps', raiz).value) || 1)));
      self.st.p = Math.max(1, Math.min(12, Math.floor(num($('#pp', raiz).value) || 1)));
      rerender();
    };
    ['#pc', '#ps', '#pp'].forEach((s) => {
      const el = $(s, raiz);
      if (el) el.addEventListener('change', pega);
    });
  }
};

/* -------- 7.10 BMS e carregador ------------------------------------------ */

const BMS_CORRENTES = [8, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];

/** Escolhe o carregador conforme a quantidade de células em série. */
function escolherCarregador(s, quim, ah, iCarga) {
  const vFim = sig(QUIMICAS[quim].cheio * s) + ' V';
  if (s === 1 && quim === 'liion') {
    return {
      nome: 'TP4056 (módulo USB)', tensao: '4,2 V',
      termo: 'modulo tp4056 com protecao 18650 tipo c', preco: 'R$ 5–12',
      alerta: 'Compre a versão COM proteção (a que tem dois chips). A sem proteção não desliga em ' +
              'curto nem em descarga profunda.',
      prog: true
    };
  }
  if (s === 2) {
    return { nome: 'TP5100 ou carregador 8,4 V', tensao: vFim,
      termo: 'modulo tp5100 carregador 2s 8.4v', preco: 'R$ 15–30',
      alerta: 'O TP5100 vem configurado de fábrica para 1S: é preciso mover um jumper de solda para 2S.' };
  }
  return { nome: 'Carregador de bancada ' + vFim, tensao: vFim,
    termo: 'carregador ' + vFim.replace(',', '.').replace(' ', '') + ' ' + s + 's litio 2a', preco: 'R$ 35–90',
    alerta: 'De 3S para cima não existe módulo simples que faça tudo: use um carregador fechado na ' +
            'tensão certa e deixe o balanceamento por conta da BMS.' };
}

TOOLS.bms = {
  nome: 'BMS e carregador',
  desc: 'Qual proteção usar e qual carregador — inclui o resistor do TP4056.',
  grupo: 'baterias',
  icone: 'escudo',
  pronto: true,
  st: { cel: 'generica', s: 1, p: 2, iDescarga: 3, iCarga: 1 },

  render() {
    const st = this.st;
    const cel = celulaPorId(st.cel);
    const s = Math.max(1, Math.min(20, Math.floor(st.s)));
    const p = Math.max(1, Math.min(12, Math.floor(st.p)));
    const k = calcularPack(cel, s, p);
    const iDesc = st.iDescarga;
    const iCarga = st.iCarga;

    // BMS com 30% de folga sobre a corrente de trabalho
    const alvoBms = iDesc * 1.3;
    let bms = BMS_CORRENTES.filter((x) => x >= alvoBms)[0] || BMS_CORRENTES[BMS_CORRENTES.length - 1];
    const excedeCelulas = iDesc > k.iMax;

    const carreg = escolherCarregador(s, cel.quim, k.ah, iCarga);
    const cRate = iCarga / k.ah;
    const tempo = (k.ah / iCarga) * 1.2;
    const horas = Math.floor(tempo);
    const minutos = Math.round((tempo - horas) * 60);

    // TP4056: a corrente de carga é definida por um resistor (R_prog)
    let blocoProg = '';
    if (carreg.prog) {
      const iReal = Math.min(iCarga, 1);
      const rProg = 1200 / iReal;
      const prox = e24Proximos(rProg);
      const rEscolhido = prox.perto;
      const iFinal = 1200 / rEscolhido;
      const f = valorParaFaixas(rEscolhido, 5, 4);
      blocoProg =
        '<div class="card card-sec">' +
          '<h3>O resistor que programa a corrente de carga</h3>' +
          '<p class="card-desc">Aqui está um dos poucos lugares em que a resposta <b>é</b> um resistor. ' +
          'No TP4056 existe um resistor marcado <b>R3</b> (ou Rprog) que diz ao chip quanta corrente ' +
          'entregar. De fábrica ele vem de 1,2 kΩ, que dá 1 A. Trocando esse resistor, você muda a ' +
          'corrente de carga.</p>' +
          conta([
            '<span class="cmt">// fórmula do fabricante</span>',
            'I carga = 1200 ÷ R',
            'R = 1200 ÷ ' + sig(iReal) + ' A = ' + ohm(rProg),
            'valor comercial = <b>' + ohm(rEscolhido) + '</b> → carga de <b>' + unidade(iFinal, 'A') + '</b>'
          ]) +
          (f.cores ? svgResistor(f.cores, {}) : '') +
          (iCarga > 1 ? nota('aviso', 'O TP4056 vai só até <b>1 A</b>. Você pediu ' +
            unidade(iCarga, 'A') + ' — para mais que isso, precisa de outro carregador.') : '') +
        '</div>';
    }

    let vereditoC, classeC;
    if (cRate > 1) { vereditoC = 'Carga rápida demais. Acima de 1C a célula esquenta e envelhece rápido.'; classeC = 'perigo'; }
    else if (cRate > 0.5) { vereditoC = 'Carga rápida. Funciona, mas encurta a vida da célula.'; classeC = 'aviso'; }
    else if (cRate < 0.15) { vereditoC = 'Carga lenta e muito segura — só demora.'; classeC = 'dica'; }
    else { vereditoC = 'Ritmo de carga ideal: rápido o suficiente e sem maltratar a célula.'; classeC = 'dica'; }

    return '' +
    cabecalho('BMS e carregador', 'A proteção e a carga do pack — a parte que não pode dar errado.') +
    '<div class="card">' +
      '<div class="campos">' +
        '<div class="campo"><label for="bc">Célula</label>' +
          '<select id="bc">' + CELULAS.map((c) =>
            '<option value="' + c.id + '"' + (st.cel === c.id ? ' selected' : '') + '>' +
            esc(c.nome) + '</option>').join('') + '</select></div>' +
        '<div class="campo"><label for="bs">Série (S)</label>' +
          '<input type="number" id="bs" min="1" max="20" step="1" value="' + s + '"></div>' +
        '<div class="campo"><label for="bp">Paralelo (P)</label>' +
          '<input type="number" id="bp" min="1" max="12" step="1" value="' + p + '"></div>' +
        '<div class="campo"><label for="bd">Corrente que o aparelho puxa (A)</label>' +
          '<input type="number" id="bd" step="any" min="0" value="' + iDesc + '"></div>' +
        '<div class="campo"><label for="bg">Corrente de carga desejada (A)</label>' +
          '<input type="number" id="bg" step="any" min="0" value="' + iCarga + '">' +
          '<span class="ajuda">Um bom padrão é metade da capacidade: ' + sig(k.ah / 2) + ' A aqui.</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="card-sec">' +
      resultadoGrande('Use uma BMS', s + 'S · ' + bms + ' A', [
        'Pack: <b>' + sig(k.vNom) + ' V ' + k.mah + ' mAh</b>',
        'Corte por célula: <b>' + sig(k.quim.corte) + ' V</b>',
        'Fim de carga: <b>' + sig(k.vCheio) + ' V</b>'
      ]) +
    '</div>' +
    (excedeCelulas
      ? '<div class="card-sec">' + nota('perigo',
          '<b>As células não aguentam essa corrente.</b> Você pediu ' + sig(iDesc) + ' A, mas ' + p +
          ' célula(s) ' + esc(cel.nome) + ' entregam com segurança apenas ' + sig(k.iMax) + ' A. ' +
          'Aumente o paralelo para ' + Math.ceil(iDesc / cel.imax) + 'P, ou use célula de descarga alta. ' +
          'Uma BMS maior não resolve isso: quem esquenta é a célula.') + '</div>'
      : '') +
    '<div class="card card-sec">' +
      '<h3>Por que a BMS não é opcional</h3>' +
      '<p class="card-desc">A BMS faz quatro coisas que você não consegue vigiar: corta se alguma célula ' +
      'passar de ' + sig(k.quim.cheio) + ' V na carga, corta se alguma cair abaixo de ' + sig(k.quim.corte) +
      ' V na descarga, corta em curto-circuito, e — em pack com mais de uma em série — <b>equilibra</b> as ' +
      'células, que nunca envelhecem igual. Sem ela, uma célula fraca é levada ao extremo pelas outras ' +
      'e é assim que pack pega fogo.</p>' +
      (s > 1
        ? nota('dica', 'Com ' + s + ' em série, escolha uma BMS <b>com balanceamento</b> ' +
            '(“balance” ou “com equalização” no anúncio) e ligue os fios de balanceamento na ordem: ' +
            'B− no negativo do pack, B1 na junção do 1º com o 2º grupo, e assim por diante. Errar essa ' +
            'ordem queima a BMS na hora.')
        : nota('dica', 'Com 1S, o módulo TP4056 “com proteção” já traz a BMS embutida — são os dois ' +
            'chipzinhos pretos ao lado do conector. Não precisa de placa separada.')) +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>Carregador</h3>' +
      resultadoGrande('Carregue em', carreg.tensao, [
        'Corrente: <b>' + sig(iCarga) + ' A</b>',
        'Ritmo: <b>' + sig(cRate, 2) + 'C</b>',
        'Tempo: <b>' + horas + ' h ' + minutos + ' min</b>'
      ]) +
      '<div class="card-sec">' + nota(classeC, '<b>' + esc(vereditoC) + '</b>') + '</div>' +
      '<div class="card-sec">' + conta([
        '<span class="cmt">// tensão final = 4,2 V (ou 3,65 no LiFePO4) por célula em série</span>',
        'V carga = ' + s + ' × ' + sig(k.quim.cheio) + ' = <b>' + sig(k.vCheio) + ' V</b>',
        '<span class="cmt">// "C" é a capacidade: 1C carrega em 1 hora, 0,5C em 2 horas</span>',
        'ritmo = ' + sig(iCarga) + ' A ÷ ' + sig(k.ah) + ' Ah = <b>' + sig(cRate, 2) + 'C</b>',
        'tempo ≈ (' + sig(k.ah) + ' ÷ ' + sig(iCarga) + ') × 1,2 = <b>' + horas + ' h ' + minutos + ' min</b>'
      ]) + '</div>' +
    '</div>' +
    blocoProg +
    '<div class="card-sec">' + avisoLitio() + '</div>' +
    '<div class="card card-sec">' +
      '<h3>O que comprar</h3>' +
      compra('BMS ' + s + 'S ' + bms + ' A' + (s > 1 ? ' com balanceamento' : ''),
             'bms ' + s + 's ' + bms + 'a' + (s > 1 ? ' balanceamento' : ''), 'R$ 15–70') +
      compra(carreg.nome, carreg.termo, carreg.preco, carreg.alerta) +
      compra('Multímetro (para conferir cada célula)', 'multimetro digital', 'R$ 40–150',
             'Não monte pack sem medir. É o instrumento mais importante da bancada.') +
    '</div>';
  },

  mount(raiz) {
    const self = this;
    const pega = () => {
      self.st.cel = $('#bc', raiz).value;
      self.st.s = Math.max(1, Math.floor(num($('#bs', raiz).value) || 1));
      self.st.p = Math.max(1, Math.floor(num($('#bp', raiz).value) || 1));
      self.st.iDescarga = num($('#bd', raiz).value) || 0;
      self.st.iCarga = num($('#bg', raiz).value) || 0.1;
      rerender();
    };
    ['#bc', '#bs', '#bp', '#bd', '#bg'].forEach((s) => {
      const el = $(s, raiz);
      if (el) el.addEventListener('change', pega);
    });
  }
};

/* -------- 7.11 Autonomia -------------------------------------------------- */

TOOLS.autonomia = {
  nome: 'Autonomia',
  desc: 'Quanto tempo a bateria aguenta com o consumo do seu aparelho.',
  grupo: 'baterias',
  icone: 'relogio',
  pronto: true,
  st: { mah: 5200, v: 3.7, consumo: 800, modo: 'ma', conversor: false, dod: 80 },

  render() {
    const st = this.st;
    const ah = st.mah / 1000;
    const wh = ah * st.v;
    const util = st.dod / 100;
    // Um conversor não é de graça: ele mesmo consome uns 12%.
    const rend = st.conversor ? 0.88 : 1;
    const consumoA = st.modo === 'ma' ? st.consumo / 1000 : (st.consumo / st.v);
    const consumoW = st.modo === 'ma' ? (st.consumo / 1000) * st.v : st.consumo;
    const horas = consumoA > 0 ? (ah * util * rend) / consumoA : 0;
    const h = Math.floor(horas);
    const min = Math.round((horas - h) * 60);

    const cenarios = [
      { nome: 'Consumo pela metade', f: 0.5 },
      { nome: 'O consumo que você informou', f: 1 },
      { nome: 'Consumo dobrado', f: 2 }
    ];

    return '' +
    cabecalho('Autonomia', 'Capacidade dividida por consumo — com os descontos que ninguém conta.') +
    '<div class="card">' +
      '<div class="campos">' +
        '<div class="campo"><label for="am">Capacidade do pack (mAh)</label>' +
          '<input type="number" id="am" step="any" min="0" value="' + st.mah + '"></div>' +
        '<div class="campo"><label for="av">Tensão do pack (V)</label>' +
          '<input type="number" id="av" step="any" min="0" value="' + st.v + '"></div>' +
        '<div class="campo"><label for="ac">Consumo do aparelho</label>' +
          '<div class="dupla">' +
            '<input type="number" id="ac" step="any" min="0" value="' + st.consumo + '">' +
            '<select id="au">' +
              '<option value="ma"' + (st.modo === 'ma' ? ' selected' : '') + '>mA</option>' +
              '<option value="w"' + (st.modo === 'w' ? ' selected' : '') + '>W</option>' +
            '</select>' +
          '</div></div>' +
        '<div class="campo"><label for="ad">Quanto da bateria você usa (%)</label>' +
          '<input type="number" id="ad" step="1" min="10" max="100" value="' + st.dod + '">' +
          '<span class="ajuda">80% é o normal: a BMS corta antes do fim para proteger.</span></div>' +
        '<div class="campo"><label for="acv">Tem conversor no meio?</label>' +
          '<select id="acv">' +
            '<option value="0"' + (!st.conversor ? ' selected' : '') + '>Não, ligado direto</option>' +
            '<option value="1"' + (st.conversor ? ' selected' : '') + '>Sim, buck ou boost</option>' +
          '</select></div>' +
      '</div>' +
    '</div>' +
    '<div class="card card-sec" style="display:flex;gap:22px;align-items:center;flex-wrap:wrap;justify-content:center">' +
      svgAnel(st.dod, st.dod + '%', 'aproveitável') +
      '<div style="flex:1;min-width:200px;text-align:center">' +
        '<div class="rotulo">O aparelho vai durar</div>' +
        '<div class="numerao">' + (h > 0 ? h + ' h ' : '') + min + ' min</div>' +
        '<div class="linha-dados">' +
          '<span class="pastilha">Energia: <b>' + sig(wh) + ' Wh</b></span>' +
          '<span class="pastilha">Puxando: <b>' + unidade(consumoA, 'A') + '</b></span>' +
          '<span class="pastilha">Potência: <b>' + unidade(consumoW, 'W') + '</b></span>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>A conta</h3>' +
      conta([
        '<span class="cmt">// nem toda a capacidade é utilizável: a BMS corta antes do fim</span>',
        'capacidade útil = ' + sig(ah) + ' Ah × ' + st.dod + '% = <b>' + sig(ah * util) + ' Ah</b>',
        (st.conversor ? '<span class="cmt">// o conversor come uns 12% no caminho</span>\nútil = ' +
          sig(ah * util) + ' × 0,88 = <b>' + sig(ah * util * rend) + ' Ah</b>' : ''),
        '<span class="cmt">// tempo = capacidade ÷ consumo</span>',
        'tempo = ' + sig(ah * util * rend) + ' Ah ÷ ' + sig(consumoA) + ' A = <b>' + sig(horas) + ' h</b>'
      ].filter(Boolean)) +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>E se o consumo for outro</h3>' +
      '<div class="rolagem"><table class="tabela">' +
        '<tr><th>Cenário</th><th>Consumo</th><th>Duração</th></tr>' +
        cenarios.map((c) => {
          const t = consumoA > 0 ? (ah * util * rend) / (consumoA * c.f) : 0;
          return '<tr><td>' + esc(c.nome) + '</td><td class="num">' + unidade(consumoA * c.f, 'A') +
            '</td><td class="num">' + Math.floor(t) + ' h ' + Math.round((t - Math.floor(t)) * 60) + ' min</td></tr>';
        }).join('') +
      '</table></div>' +
    '</div>' +
    nota('aviso', '<b>Na prática dá menos.</b> Esta conta é o teto teórico. Bateria velha entrega menos, ' +
      'frio derruba a capacidade, e quase todo aparelho puxa picos de corrente bem acima da média — e é ' +
      'a média que você informou aqui. Conte com 10 a 25% a menos do que esse número.');
  },

  mount(raiz) {
    const self = this;
    const pega = () => {
      self.st.mah = num($('#am', raiz).value) || 0;
      self.st.v = num($('#av', raiz).value) || 3.7;
      self.st.consumo = num($('#ac', raiz).value) || 0;
      self.st.modo = $('#au', raiz).value;
      self.st.dod = Math.max(10, Math.min(100, num($('#ad', raiz).value) || 80));
      self.st.conversor = $('#acv', raiz).value === '1';
      rerender();
    };
    ['#am', '#av', '#ac', '#au', '#ad', '#acv'].forEach((s) => {
      const el = $(s, raiz);
      if (el) el.addEventListener('change', pega);
    });
  }
};

/* -------- 7.12 Assistente de recuperação --------------------------------- */

TOOLS.recuperar = {
  nome: 'Recuperar aparelho',
  desc: 'Passo a passo para dar vida nova a um aparelho antigo de bateria.',
  grupo: 'baterias',
  icone: 'ferramenta',
  pronto: true,
  st: { aparelho: 'Aspirador de mão', vAntiga: 7.2, corrente: 4, horas: 0.5, cel: 'samsung30q' },

  /** Traduz o aparelho antigo num projeto de pack novo. */
  projetar() {
    const st = this.st;
    const cel = celulaPorId(st.cel);
    const q = QUIMICAS[cel.quim];
    // Quantas células em série chegam mais perto da tensão original.
    const sIdeal = st.vAntiga / q.nom;
    const s = Math.max(1, Math.round(sIdeal));
    const k1 = calcularPack(cel, s, 1);
    const erro = ((k1.vNom - st.vAntiga) / st.vAntiga) * 100;
    // Paralelo: o maior entre o que a corrente exige e o que a autonomia exige.
    const pPorCorrente = Math.ceil(st.corrente / cel.imax);
    const ahNecessario = st.corrente * st.horas / 0.8; // 80% aproveitável
    const pPorAutonomia = Math.ceil(ahNecessario / (cel.mah / 1000));
    const p = Math.max(1, pPorCorrente, pPorAutonomia);
    const k = calcularPack(cel, s, p);
    const bms = BMS_CORRENTES.filter((x) => x >= st.corrente * 1.3)[0] || 100;
    const carreg = escolherCarregador(s, cel.quim, k.ah, k.ah / 2);
    return { s: s, p: p, k: k, cel: cel, erro: erro, bms: bms, carreg: carreg,
             pPorCorrente: pPorCorrente, pPorAutonomia: pPorAutonomia, ahNecessario: ahNecessario };
  },

  /** Monta o prompt para o usuário colar no assistente de IA dele. */
  gerarPrompt(r) {
    const st = this.st;
    return 'Quero recuperar um aparelho antigo movido a bateria e preciso da sua revisão técnica.\n\n' +
      'APARELHO: ' + st.aparelho + '\n' +
      'Bateria original: ' + sig(st.vAntiga) + ' V\n' +
      'Corrente que o aparelho puxa: ' + sig(st.corrente) + ' A\n' +
      'Autonomia desejada: ' + sig(st.horas) + ' h\n\n' +
      'PLANO QUE EU MONTEI (feito pelo app E-TronIQ):\n' +
      '- Célula: ' + r.cel.nome + ' (' + r.cel.mah + ' mAh, ' + sig(r.cel.imax) + ' A contínuos)\n' +
      '- Arranjo: ' + r.s + 'S' + r.p + 'P = ' + r.k.celulas + ' células\n' +
      '- Tensão: ' + sig(r.k.vNom) + ' V nominal (' + sig(r.k.vCheio) + ' V cheio, ' + sig(r.k.vVazio) + ' V vazio)\n' +
      '- Capacidade: ' + r.k.mah + ' mAh (' + sig(r.k.wh) + ' Wh)\n' +
      '- Corrente máxima do pack: ' + sig(r.k.iMax) + ' A\n' +
      '- BMS: ' + r.s + 'S ' + r.bms + ' A' + (r.s > 1 ? ' com balanceamento' : '') + '\n' +
      '- Carregador: ' + r.carreg.nome + ' (' + r.carreg.tensao + ')\n\n' +
      'O QUE EU PRECISO DE VOCÊ:\n' +
      '1. Confira se a tensão nova (' + sig(r.k.vNom) + ' V, chegando a ' + sig(r.k.vCheio) + ' V na carga) ' +
      'é segura para um aparelho projetado para ' + sig(st.vAntiga) + ' V. O motor vai girar mais rápido? ' +
      'A eletrônica interna aguenta?\n' +
      '2. Aponte erros no arranjo, no dimensionamento da BMS e na escolha do carregador.\n' +
      '3. Descreva a ordem de montagem e a sequência de energização, incluindo como testar cada ' +
      'proteção da BMS antes de fechar o aparelho.\n' +
      '4. Liste os riscos específicos desse projeto.\n\n' +
      'Sou iniciante em eletrônica. Explique em português simples, mostre as contas, e seja direto ' +
      'sobre qualquer coisa que possa pegar fogo ou me machucar.';
  },

  render() {
    const st = this.st;
    const r = this.projetar();
    const acc = CORES_GRUPO.baterias.c;
    const sobretensao = r.erro > 8;

    return '' +
    cabecalho('Recuperar aparelho', 'Aquele aparelho velho com bateria morta vira um projeto aqui.') +
    '<div class="card">' +
      '<div class="campos">' +
        '<div class="campo"><label for="rap">Que aparelho é</label>' +
          '<input type="text" id="rap" value="' + esc(st.aparelho) + '"></div>' +
        '<div class="campo"><label for="rv">Tensão da bateria original (V)</label>' +
          '<input type="number" id="rv" step="any" min="0" value="' + st.vAntiga + '">' +
          '<span class="ajuda">Está na etiqueta da bateria velha ou do carregador.</span></div>' +
        '<div class="campo"><label for="ri">Corrente que ele puxa (A)</label>' +
          '<input type="number" id="ri" step="any" min="0" value="' + st.corrente + '">' +
          '<span class="ajuda">Se só souber a potência: watts ÷ volts.</span></div>' +
        '<div class="campo"><label for="rh">Autonomia desejada (horas)</label>' +
          '<input type="number" id="rh" step="any" min="0.1" value="' + st.horas + '"></div>' +
        '<div class="campo"><label for="rc">Célula que pretende usar</label>' +
          '<select id="rc">' + CELULAS.map((c) =>
            '<option value="' + c.id + '"' + (st.cel === c.id ? ' selected' : '') + '>' +
            esc(c.nome) + '</option>').join('') + '</select></div>' +
      '</div>' +
    '</div>' +
    '<div class="card-sec">' +
      resultadoGrande('Monte um pack', r.s + 'S' + r.p + 'P', [
        '<b>' + r.k.celulas + '</b> células',
        '<b>' + sig(r.k.vNom) + ' V</b> · <b>' + r.k.mah + ' mAh</b>',
        'Entrega até <b>' + sig(r.k.iMax) + ' A</b>'
      ]) +
    '</div>' +
    (sobretensao
      ? '<div class="card-sec">' + nota('aviso',
          '<b>Atenção à tensão.</b> O pack novo fica em ' + sig(r.k.vNom) + ' V nominais e chega a ' +
          sig(r.k.vCheio) + ' V recém-carregado, contra ' + sig(st.vAntiga) + ' V do original — ' +
          sig(r.erro, 2) + '% a mais. Em aparelho só com motor, isso costuma significar apenas mais força ' +
          'e mais rotação. Em aparelho com placa eletrônica, pode queimar. Se houver placa, o certo é ' +
          'usar ' + (r.s - 1) + 'S e aceitar um pouco menos de força, ou pôr um conversor.') + '</div>'
      : '') +
    '<div class="card card-sec">' +
      '<h3>Como cheguei nesse arranjo</h3>' +
      conta([
        '<span class="cmt">// 1. a série sai da tensão original</span>',
        's = ' + sig(st.vAntiga) + ' V ÷ ' + sig(r.k.quim.nom) + ' V por célula = ' + sig(st.vAntiga / r.k.quim.nom, 2) +
          ' → arredondando: <b>' + r.s + 'S</b> (' + sig(r.k.vNom) + ' V)',
        '<span class="cmt">// 2. o paralelo precisa aguentar a corrente...</span>',
        'p mínimo = ' + sig(st.corrente) + ' A ÷ ' + sig(r.cel.imax) + ' A por célula = <b>' + r.pPorCorrente + 'P</b>',
        '<span class="cmt">// ...e também dar a autonomia pedida</span>',
        'capacidade = (' + sig(st.corrente) + ' A × ' + sig(st.horas) + ' h) ÷ 0,8 = ' + sig(r.ahNecessario) + ' Ah',
        'p mínimo = ' + sig(r.ahNecessario) + ' Ah ÷ ' + sig(r.cel.mah / 1000) + ' Ah = <b>' + r.pPorAutonomia + 'P</b>',
        '<span class="cmt">// vale o maior dos dois</span>',
        'arranjo final = <b>' + r.s + 'S' + r.p + 'P</b>'
      ]) +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>O pack montado</h3>' + svgPack(r.s, r.p, acc) +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>Ordem de montagem</h3>' +
      '<ol style="color:var(--txt-2);font-size:14px;line-height:1.7;padding-left:18px;margin:8px 0 0">' +
        '<li><b>Meça cada célula</b> antes de tudo. Descarte as que estiverem abaixo de 2,5 V ou que não ' +
          'segurem carga — célula ruim contamina o grupo inteiro.</li>' +
        '<li><b>Monte os grupos em paralelo primeiro</b>, juntando só células de capacidade parecida. ' +
          'Iguale a tensão delas antes de unir, senão uma despeja corrente na outra.</li>' +
        '<li><b>Ligue os ' + r.s + ' grupos em série</b>: positivo de um no negativo do seguinte.</li>' +
        '<li><b>Instale a BMS</b> — o fio preto (B−) no negativo do pack, depois os fios de balanceamento ' +
          'na ordem, do primeiro ao último. Errar a ordem queima a placa.</li>' +
        '<li><b>Confira com o multímetro</b>: ' + sig(r.k.vNom) + ' V (mais ou menos) na saída P+ / P−, e ' +
          'cada grupo com a mesma tensão dos outros.</li>' +
        '<li><b>Teste a proteção antes de fechar:</b> dê um curto rapidíssimo na saída — a BMS deve ' +
          'desligar e voltar sozinha ao ligar o carregador.</li>' +
        '<li><b>Isole tudo</b> com anel de isolamento no positivo de cada célula, fita Kapton e termo-retrátil. ' +
          'Só então feche o aparelho.</li>' +
        '<li><b>Primeira carga supervisionada</b>, em cima de superfície que não pega fogo, com você por perto.</li>' +
      '</ol>' +
    '</div>' +
    '<div class="card card-sec">' +
      '<h3>Quer a revisão de um engenheiro?</h3>' +
      '<p class="card-desc">O E-TronIQ não conversa com IA nenhuma (por isso é de graça e funciona ' +
      'offline). Mas ele monta o pedido pronto: copie o texto abaixo e cole no seu assistente. ' +
      'Ele volta com a revisão do projeto, os riscos e a ordem de energização.</p>' +
      '<textarea id="prompt" readonly rows="8">' + esc(this.gerarPrompt(r)) + '</textarea>' +
      '<div class="btn-linha"><button class="btn primario" id="copiarPrompt">Copiar pedido</button></div>' +
    '</div>' +
    '<div class="card-sec">' + avisoLitio() + '</div>' +
    '<div class="card card-sec">' +
      '<h3>Lista de compras deste projeto</h3>' +
      compra(r.k.celulas + '× ' + r.cel.nome, esc(r.cel.nome).toLowerCase() + ' original',
             'R$ ' + (15 * r.k.celulas) + '–' + (45 * r.k.celulas) + ' no total',
             'Desconfie de 18650 com mais de 3600 mAh anunciados. Não existe.') +
      compra('BMS ' + r.s + 'S ' + r.bms + ' A' + (r.s > 1 ? ' com balanceamento' : ''),
             'bms ' + r.s + 's ' + r.bms + 'a' + (r.s > 1 ? ' balanceamento' : ''), 'R$ 15–70') +
      compra(r.carreg.nome, r.carreg.termo, r.carreg.preco, r.carreg.alerta) +
      compra('Suporte para ' + r.k.celulas + ' células', 'suporte 18650 ' + r.k.celulas + ' celulas', 'R$ 10–30') +
      compra('Fita de níquel + anéis isolantes', 'fita niquel 18650 anel isolante kit', 'R$ 25–60') +
      compra('Termo-retrátil e fita Kapton', 'termo retratil bateria kapton fita', 'R$ 15–40') +
    '</div>';
  },

  mount(raiz) {
    const self = this;
    const pega = () => {
      self.st.aparelho = $('#rap', raiz).value || 'Aparelho';
      self.st.vAntiga = num($('#rv', raiz).value) || 3.7;
      self.st.corrente = num($('#ri', raiz).value) || 0.1;
      self.st.horas = num($('#rh', raiz).value) || 0.5;
      self.st.cel = $('#rc', raiz).value;
      rerender();
    };
    ['#rap', '#rv', '#ri', '#rh', '#rc'].forEach((s) => {
      const el = $(s, raiz);
      if (el) el.addEventListener('change', pega);
    });
    const bp = $('#copiarPrompt', raiz);
    if (bp) bp.addEventListener('click', () => copiar($('#prompt', raiz).value));
  }
};

/* -------- 7.13 Protoboard Arduino ---------------------------------------- */

/* Biblioteca de montagens prontas. Cada coluna da protoboard (1 a 30) liga entre si
   as linhas a–e e, separadamente, as linhas f–j. Por isso duas pernas de um mesmo
   componente ficam sempre em colunas diferentes. */
const BIBLIOTECA = [
  {
    id: 'blink', titulo: 'LED piscando', placa: 'arduino_uno',
    resumo: 'O "olá mundo" do Arduino: um LED acende e apaga sozinho.',
    componentes: [
      { id: 'led1', tipo: 'led', cor: 'vermelho', pinos: ['e10', 'e12'] },
      { id: 'r1', tipo: 'resistor', rotulo: '220 Ω', faixas: ['vermelho', 'vermelho', 'marrom', 'dourado'], pinos: ['a12', 'a15'] }
    ],
    ligacoes: [
      { de: 'D13', para: 'b10', cor: 'vermelho' },
      { de: 'b15', para: 'GND', cor: 'preto' }
    ],
    avisos: ['O lado chato do LED (perna curta) é o negativo, e é ele que vai para o resistor.'],
    codigo: [
      'const int LED = 13;',
      '',
      'void setup() {',
      '  pinMode(LED, OUTPUT);',
      '}',
      '',
      'void loop() {',
      '  digitalWrite(LED, HIGH);',
      '  delay(500);',
      '  digitalWrite(LED, LOW);',
      '  delay(500);',
      '}'
    ].join('\n')
  },
  {
    id: 'botao', titulo: 'Botão acende LED', placa: 'arduino_uno',
    resumo: 'Lê um botão e acende o LED enquanto ele estiver apertado.',
    componentes: [
      { id: 'sw1', tipo: 'botao', pinos: ['e5', 'e8'] },
      { id: 'r1', tipo: 'resistor', rotulo: '10 kΩ', faixas: ['marrom', 'preto', 'laranja', 'dourado'], pinos: ['a8', 'a11'] },
      { id: 'led1', tipo: 'led', cor: 'verde', pinos: ['e20', 'e22'] },
      { id: 'r2', tipo: 'resistor', rotulo: '220 Ω', faixas: ['vermelho', 'vermelho', 'marrom', 'dourado'], pinos: ['a22', 'a25'] }
    ],
    ligacoes: [
      { de: '5V', para: 'b5', cor: 'vermelho' },
      { de: 'D2', para: 'c8', cor: 'amarelo' },
      { de: 'b11', para: 'GND', cor: 'preto' },
      { de: 'D13', para: 'b20', cor: 'verde' },
      { de: 'b25', para: 'GND', cor: 'preto' }
    ],
    avisos: ['O resistor de 10 kΩ é o "pull-down": sem ele o pino fica solto no ar e lê lixo, ' +
             'acendendo o LED sozinho.'],
    codigo: [
      'const int BOTAO = 2;',
      'const int LED = 13;',
      '',
      'void setup() {',
      '  pinMode(BOTAO, INPUT);',
      '  pinMode(LED, OUTPUT);',
      '}',
      '',
      'void loop() {',
      '  if (digitalRead(BOTAO) == HIGH) {',
      '    digitalWrite(LED, HIGH);',
      '  } else {',
      '    digitalWrite(LED, LOW);',
      '  }',
      '}'
    ].join('\n')
  },
  {
    id: 'pot', titulo: 'Potenciômetro controla o brilho', placa: 'arduino_uno',
    resumo: 'Girar o botão muda a intensidade do LED. Mostra leitura analógica e PWM.',
    componentes: [
      { id: 'p1', tipo: 'potenciometro', rotulo: '10 kΩ', pinos: ['e5', 'e6', 'e7'] },
      { id: 'led1', tipo: 'led', cor: 'azul', pinos: ['e15', 'e17'] },
      { id: 'r1', tipo: 'resistor', rotulo: '220 Ω', faixas: ['vermelho', 'vermelho', 'marrom', 'dourado'], pinos: ['a17', 'a20'] }
    ],
    ligacoes: [
      { de: '5V', para: 'a5', cor: 'vermelho' },
      { de: 'A0', para: 'a6', cor: 'amarelo' },
      { de: 'GND', para: 'a7', cor: 'preto' },
      { de: 'D9', para: 'b15', cor: 'azul' },
      { de: 'b20', para: 'GND', cor: 'preto' }
    ],
    avisos: ['O pino do meio do potenciômetro é o que varia; os das pontas vão em 5 V e GND.',
             'Só os pinos 3, 5, 6, 9, 10 e 11 do Uno fazem PWM (têm o símbolo ~).'],
    codigo: [
      'const int POT = A0;',
      'const int LED = 9;   // precisa ser um pino com ~ (PWM)',
      '',
      'void setup() {',
      '  pinMode(LED, OUTPUT);',
      '  Serial.begin(9600);',
      '}',
      '',
      'void loop() {',
      '  int leitura = analogRead(POT);        // 0 a 1023',
      '  int brilho  = map(leitura, 0, 1023, 0, 255);',
      '  analogWrite(LED, brilho);',
      '  Serial.println(leitura);',
      '  delay(50);',
      '}'
    ].join('\n')
  },
  {
    id: 'ldr', titulo: 'Sensor de luz (LDR)', placa: 'arduino_uno',
    resumo: 'Acende o LED quando escurece. Usa divisor de tensão — aqui ele é legítimo.',
    componentes: [
      { id: 'ldr1', tipo: 'ldr', rotulo: 'LDR', pinos: ['e5', 'e8'] },
      { id: 'r1', tipo: 'resistor', rotulo: '10 kΩ', faixas: ['marrom', 'preto', 'laranja', 'dourado'], pinos: ['a8', 'a11'] },
      { id: 'led1', tipo: 'led', cor: 'branco', pinos: ['e20', 'e22'] },
      { id: 'r2', tipo: 'resistor', rotulo: '220 Ω', faixas: ['vermelho', 'vermelho', 'marrom', 'dourado'], pinos: ['a22', 'a25'] }
    ],
    ligacoes: [
      { de: '5V', para: 'b5', cor: 'vermelho' },
      { de: 'A0', para: 'c8', cor: 'amarelo' },
      { de: 'b11', para: 'GND', cor: 'preto' },
      { de: 'D13', para: 'b20', cor: 'branco' },
      { de: 'b25', para: 'GND', cor: 'preto' }
    ],
    avisos: ['Este é o uso correto do divisor de tensão: a entrada analógica quase não puxa corrente.',
             'Ajuste o valor 500 no código conforme a luz do seu ambiente — use o Monitor Serial para ver.'],
    codigo: [
      'const int LDR = A0;',
      'const int LED = 13;',
      'const int LIMITE = 500;  // ajuste olhando o Monitor Serial',
      '',
      'void setup() {',
      '  pinMode(LED, OUTPUT);',
      '  Serial.begin(9600);',
      '}',
      '',
      'void loop() {',
      '  int luz = analogRead(LDR);',
      '  Serial.println(luz);',
      '  digitalWrite(LED, luz < LIMITE ? HIGH : LOW);',
      '  delay(100);',
      '}'
    ].join('\n')
  },
  {
    id: 'ds18b20', titulo: 'Termômetro DS18B20', placa: 'arduino_uno',
    resumo: 'Mede temperatura com precisão e mostra no Monitor Serial.',
    componentes: [
      { id: 't1', tipo: 'ds18b20', pinos: ['e5', 'e6', 'e7'] },
      { id: 'r1', tipo: 'resistor', rotulo: '4,7 kΩ', faixas: ['amarelo', 'violeta', 'vermelho', 'dourado'], pinos: ['a6', 'a10'] }
    ],
    ligacoes: [
      { de: 'GND', para: 'b5', cor: 'preto' },
      { de: 'D2', para: 'c6', cor: 'amarelo' },
      { de: '5V', para: 'b7', cor: 'vermelho' },
      { de: 'b10', para: '5V', cor: 'vermelho' }
    ],
    avisos: ['O resistor de 4,7 kΩ entre o pino de dados e o 5 V é obrigatório — sem ele o sensor ' +
             'simplesmente não responde.',
             'Olhando o lado chato do sensor, com os pinos para baixo: GND, dados, 5 V.'],
    codigo: [
      '#include <OneWire.h>          // biblioteca OneWire 2.3.7',
      '#include <DallasTemperature.h> // biblioteca DallasTemperature 3.9.0',
      '',
      'OneWire barramento(2);',
      'DallasTemperature sensor(&barramento);',
      '',
      'void setup() {',
      '  Serial.begin(9600);',
      '  sensor.begin();',
      '}',
      '',
      'void loop() {',
      '  sensor.requestTemperatures();',
      '  Serial.print("Temperatura: ");',
      '  Serial.print(sensor.getTempCByIndex(0));',
      '  Serial.println(" C");',
      '  delay(1000);',
      '}'
    ].join('\n')
  },
  {
    id: 'servo', titulo: 'Servo SG90', placa: 'arduino_uno',
    resumo: 'Faz o servo varrer de 0 a 180 graus.',
    componentes: [
      { id: 's1', tipo: 'servo_sg90', pinos: ['e5', 'e6', 'e7'] }
    ],
    ligacoes: [
      { de: 'GND', para: 'b5', cor: 'marrom' },
      { de: '5V', para: 'b6', cor: 'vermelho' },
      { de: 'D9', para: 'b7', cor: 'laranja' }
    ],
    avisos: ['Um servo só pode sair do 5 V do Arduino se for pequeno e sem carga. Com esforço ele ' +
             'puxa picos que derrubam a placa e reiniciam o programa — aí use fonte separada de 5 V, ' +
             'com o GND ligado junto ao do Arduino.',
             'Os fios do SG90: marrom = GND, vermelho = 5 V, laranja = sinal.'],
    codigo: [
      '#include <Servo.h>   // biblioteca que já vem com a IDE',
      '',
      'Servo motor;',
      '',
      'void setup() {',
      '  motor.attach(9);',
      '}',
      '',
      'void loop() {',
      '  for (int a = 0; a <= 180; a++) {',
      '    motor.write(a);',
      '    delay(15);',
      '  }',
      '  for (int a = 180; a >= 0; a--) {',
      '    motor.write(a);',
      '    delay(15);',
      '  }',
      '}'
    ].join('\n')
  },
  {
    id: 'hcsr04', titulo: 'Sensor de distância HC-SR04', placa: 'arduino_uno',
    resumo: 'Mede distância por ultrassom, de 2 cm a 4 metros.',
    componentes: [
      { id: 'u1', tipo: 'hc_sr04', pinos: ['e5', 'e6', 'e7', 'e8'] }
    ],
    ligacoes: [
      { de: '5V', para: 'a5', cor: 'vermelho' },
      { de: 'D9', para: 'a6', cor: 'amarelo' },
      { de: 'D10', para: 'a7', cor: 'verde' },
      { de: 'GND', para: 'a8', cor: 'preto' }
    ],
    avisos: ['A ordem dos pinos no módulo é VCC, Trig, Echo, GND — está escrito na plaquinha.'],
    codigo: [
      'const int TRIG = 9;',
      'const int ECHO = 10;',
      '',
      'void setup() {',
      '  pinMode(TRIG, OUTPUT);',
      '  pinMode(ECHO, INPUT);',
      '  Serial.begin(9600);',
      '}',
      '',
      'void loop() {',
      '  digitalWrite(TRIG, LOW);',
      '  delayMicroseconds(2);',
      '  digitalWrite(TRIG, HIGH);',
      '  delayMicroseconds(10);',
      '  digitalWrite(TRIG, LOW);',
      '',
      '  long tempo = pulseIn(ECHO, HIGH);',
      '  float cm = tempo * 0.0343 / 2;  // som: 343 m/s, ida e volta',
      '',
      '  Serial.print(cm);',
      '  Serial.println(" cm");',
      '  delay(200);',
      '}'
    ].join('\n')
  },
  {
    id: 'rele', titulo: 'Módulo relé', placa: 'arduino_uno',
    resumo: 'Liga e desliga um aparelho de verdade a partir do Arduino.',
    componentes: [
      { id: 'k1', tipo: 'rele_1ch', pinos: ['e5', 'e6', 'e7'] }
    ],
    ligacoes: [
      { de: '5V', para: 'b5', cor: 'vermelho' },
      { de: 'D7', para: 'b6', cor: 'amarelo' },
      { de: 'GND', para: 'b7', cor: 'preto' }
    ],
    avisos: ['A maioria dos módulos relé é acionada em nível BAIXO: LOW liga, HIGH desliga. ' +
             'Se o seu funcionar ao contrário, inverta no código.',
             'O lado do relé que chaveia a tomada é rede elétrica: 127 ou 220 V mata. Se você não ' +
             'tem prática com isso, use o relé só em 12 V ou chame um eletricista.'],
    codigo: [
      'const int RELE = 7;',
      '',
      'void setup() {',
      '  pinMode(RELE, OUTPUT);',
      '  digitalWrite(RELE, HIGH);  // começa desligado (módulos comuns são invertidos)',
      '}',
      '',
      'void loop() {',
      '  digitalWrite(RELE, LOW);   // liga',
      '  delay(3000);',
      '  digitalWrite(RELE, HIGH);  // desliga',
      '  delay(3000);',
      '}'
    ].join('\n')
  }
];

/** Extrai o primeiro objeto JSON de um texto que pode vir cheio de prosa em volta. */
function extrairJSON(texto) {
  const t = String(texto || '');
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidatos = [];
  if (cerca) candidatos.push(cerca[1]);
  // varredura por chaves balanceadas, do primeiro "{" em diante
  const ini = t.indexOf('{');
  if (ini >= 0) {
    let nivel = 0, dentroTexto = false, escapado = false;
    for (let i = ini; i < t.length; i++) {
      const ch = t[i];
      if (dentroTexto) {
        if (escapado) escapado = false;
        else if (ch === '\\') escapado = true;
        else if (ch === '"') dentroTexto = false;
        continue;
      }
      if (ch === '"') dentroTexto = true;
      else if (ch === '{') nivel++;
      else if (ch === '}') {
        nivel--;
        if (nivel === 0) { candidatos.push(t.slice(ini, i + 1)); break; }
      }
    }
  }
  for (let i = 0; i < candidatos.length; i++) {
    try { return { ok: true, dados: JSON.parse(candidatos[i]) }; } catch (e) { /* tenta o próximo */ }
  }
  return { ok: false, erro: 'Não achei um bloco JSON válido na resposta. ' +
    'Confira se você copiou a resposta inteira, incluindo o trecho entre ```json e ```.' };
}

/** Confere se o circuito recebido é desenhável, com mensagem clara quando não é. */
function validarCircuito(c) {
  if (!c || typeof c !== 'object') return 'O JSON não é um objeto.';
  if (!Array.isArray(c.componentes)) return 'Faltou a lista "componentes".';
  if (!Array.isArray(c.ligacoes)) return 'Faltou a lista "ligacoes".';
  const desconhecidas = [];
  for (let i = 0; i < c.componentes.length; i++) {
    const p = c.componentes[i];
    if (!p || !p.tipo) return 'O componente ' + (i + 1) + ' está sem "tipo".';
    if (!PECAS[p.tipo] && desconhecidas.indexOf(p.tipo) < 0) desconhecidas.push(p.tipo);
    if (!Array.isArray(p.pinos) || !p.pinos.length) return 'O componente "' + p.tipo + '" está sem "pinos".';
    for (let j = 0; j < p.pinos.length; j++) {
      if (!pontoProtoboard(p.pinos[j])) {
        return 'O componente "' + p.tipo + '" tem o furo "' + p.pinos[j] + '", que não existe. ' +
          'Os furos vão de a1 a j30, mais os trilhos +1 a +30 e -1 a -30.';
      }
    }
  }
  if (desconhecidas.length) {
    return 'Não sei desenhar: ' + desconhecidas.join(', ') + '. ' +
      'Peça ao assistente para usar só as peças da lista do prompt.';
  }
  for (let i = 0; i < c.ligacoes.length; i++) {
    const l = c.ligacoes[i];
    if (!l || !l.de || !l.para) return 'A ligação ' + (i + 1) + ' está sem "de" ou "para".';
    [l.de, l.para].forEach(function () { /* validação abaixo */ });
    const okDe = ehPinoArduino(l.de) || pontoProtoboard(l.de);
    const okPara = ehPinoArduino(l.para) || pontoProtoboard(l.para);
    if (!okDe) return 'A ligação ' + (i + 1) + ' sai de "' + l.de + '", que não é pino do Arduino nem furo da protoboard.';
    if (!okPara) return 'A ligação ' + (i + 1) + ' vai para "' + l.para + '", que não é pino do Arduino nem furo da protoboard.';
  }
  return null;
}

TOOLS.protoboard = {
  nome: 'Protoboard Arduino',
  desc: 'Circuitos montados e desenhados, com o código pronto para copiar.',
  grupo: 'arduino',
  icone: 'chip',
  pronto: true,
  st: { aba: 'biblioteca', circuito: null, pedido: '', resposta: '', erro: '', prosa: '' },

  /** O contrato de saída que vai junto do pedido do usuário. */
  montarPrompt(pedido) {
    return (pedido || '[descreva aqui o que você quer montar]') + '\n\n' +
      '--- CONTRATO DE SAÍDA (não altere) ---\n' +
      'Isto vai ser desenhado por um app chamado E-TronIQ. Responda normalmente, com a sua análise ' +
      'técnica e os avisos de segurança, e ao FINAL acrescente um bloco ```json exatamente neste formato:\n\n' +
      '```json\n' +
      '{\n' +
      '  "titulo": "nome curto do circuito",\n' +
      '  "placa": "arduino_uno",\n' +
      '  "componentes": [\n' +
      '    {"id":"led1","tipo":"led","cor":"vermelho","pinos":["e10","e12"]},\n' +
      '    {"id":"r1","tipo":"resistor","rotulo":"220 Ω",\n' +
      '     "faixas":["vermelho","vermelho","marrom","dourado"],"pinos":["a12","a15"]}\n' +
      '  ],\n' +
      '  "ligacoes": [\n' +
      '    {"de":"D13","para":"b10","cor":"vermelho"},\n' +
      '    {"de":"b15","para":"GND","cor":"preto"}\n' +
      '  ],\n' +
      '  "codigo": "// sketch completo, compilável, com comentários",\n' +
      '  "bibliotecas": ["Nome 1.2.3"],\n' +
      '  "avisos": ["frases curtas de alerta"]\n' +
      '}\n' +
      '```\n\n' +
      'REGRAS DA PROTOBOARD:\n' +
      '- Furos: letra + coluna, de a1 a j30. As linhas a–e de uma mesma coluna são ligadas entre si; ' +
      'as linhas f–j também, e os dois blocos são separados pela canaleta central.\n' +
      '- Por isso, as duas pernas de um mesmo componente devem ficar em COLUNAS DIFERENTES.\n' +
      '- Trilhos de alimentação: "+1" a "+30" e "-1" a "-30".\n' +
      '- Pinos do Arduino aceitos: ' + PINOS_ARDUINO.join(', ') + '.\n' +
      '- Tipos de peça que sei desenhar: ' + Object.keys(PECAS).join(', ') + '.\n' +
      '- Em "faixas" do resistor use as cores: ' + CORES.map((c) => c.id).join(', ') + '.\n' +
      '- Cores de fio: ' + Object.keys(CORES_FIO).filter((k) => k !== 'preta').join(', ') + '.\n' +
      '- Use no máximo 30 colunas e deixe espaço entre os componentes.\n\n' +
      'Sou iniciante em eletrônica: explique em português simples e avise sobre qualquer risco.';
  },

  render() {
    const st = this.st;
    const circ = st.circuito;

    const abas = '<div style="display:flex;justify-content:center;margin-bottom:16px">' +
      '<div class="seg">' +
        '<button class="' + (st.aba === 'biblioteca' ? 'ativo' : '') + '" data-aba="biblioteca">Montagens prontas</button>' +
        '<button class="' + (st.aba === 'ia' ? 'ativo' : '') + '" data-aba="ia">Pedir para a IA</button>' +
      '</div></div>';

    let corpo;
    if (st.aba === 'biblioteca') {
      corpo = '<div class="grade">' + BIBLIOTECA.map((b) =>
        '<button class="card" data-circ="' + b.id + '" style="' + corGrupo('arduino') + '">' +
          '<div class="card-icone">' + icone('chip') + '</div>' +
          '<h3>' + esc(b.titulo) + '</h3>' +
          '<div class="card-desc">' + esc(b.resumo) + '</div>' +
        '</button>').join('') + '</div>';
    } else {
      corpo =
        '<div class="card">' +
          '<h3>1. Descreva o que você quer</h3>' +
          '<p class="card-desc">Escreva com suas palavras, como falaria com um amigo. ' +
          'Exemplo: “quero um sensor de temperatura que acenda um LED vermelho se passar de 30 graus”.</p>' +
          '<textarea id="pedido" rows="3" placeholder="quero montar...">' + esc(st.pedido) + '</textarea>' +
          '<div class="btn-linha">' +
            '<button class="btn primario" id="copiarPrompt">Copiar pedido pronto</button>' +
          '</div>' +
          '<p class="card-desc">O app monta um pedido técnico completo — com a lista de peças que ele ' +
          'sabe desenhar e o formato exato da resposta. Cole no seu assistente de IA.</p>' +
        '</div>' +
        '<div class="card card-sec">' +
          '<h3>2. Cole a resposta aqui</h3>' +
          '<p class="card-desc">Pode colar a resposta inteira, com a explicação e tudo. ' +
          'O app pesca só o bloco JSON e desenha; a explicação fica guardada logo abaixo.</p>' +
          '<textarea id="resposta" rows="5" placeholder="cole aqui a resposta do assistente...">' + esc(st.resposta) + '</textarea>' +
          '<div class="btn-linha">' +
            '<button class="btn primario" id="desenhar">Desenhar circuito</button>' +
            '<button class="btn" id="limparIA">Limpar</button>' +
          '</div>' +
        '</div>' +
        (st.erro ? '<div class="card-sec">' + nota('aviso', '<b>Não consegui desenhar.</b> ' + esc(st.erro)) + '</div>' : '');
    }

    let resultado = '';
    if (circ) {
      resultado =
        '<div class="card card-sec">' +
          '<h3>' + esc(circ.titulo || 'Circuito') + '</h3>' +
          svgProtoboard(circ) +
          '<p class="card-desc">Os fios saem dos pinos do Arduino e vão até os furos da protoboard. ' +
          'Furos da mesma coluna, no mesmo bloco de linhas, já estão ligados por dentro.</p>' +
        '</div>' +
        (circ.avisos && circ.avisos.length
          ? '<div class="card-sec">' + nota('aviso', circ.avisos.map(esc).join('<br><br>')) + '</div>'
          : '') +
        '<div class="card card-sec">' +
          '<h3>Lista de ligações</h3>' +
          '<div class="rolagem"><table class="tabela">' +
            '<tr><th>De</th><th>Para</th><th>Cor do fio</th></tr>' +
            (circ.ligacoes || []).map((l) =>
              '<tr><td class="num">' + esc(l.de) + '</td><td class="num">' + esc(l.para) + '</td>' +
              '<td><span class="cor-bolha" style="display:inline-block;vertical-align:-4px;margin-right:7px;' +
              'background:' + corFio(l.cor) + '"></span>' + esc(l.cor || 'qualquer') + '</td></tr>').join('') +
          '</table></div>' +
        '</div>' +
        (circ.codigo
          ? '<div class="card card-sec">' +
              '<h3>Código para o Arduino</h3>' +
              (circ.bibliotecas && circ.bibliotecas.length
                ? '<p class="card-desc">Instale antes, no menu <b>Sketch → Incluir Biblioteca → Gerenciar ' +
                  'Bibliotecas</b>: ' + circ.bibliotecas.map(esc).join(', ') + '.</p>'
                : '') +
              '<pre class="codigo">' + esc(circ.codigo) + '</pre>' +
              '<div class="btn-linha">' +
                '<button class="btn" data-copiar="' + esc(circ.codigo) + '">Copiar código</button>' +
                '<button class="btn" id="salvarProjeto">Salvar em Meus projetos</button>' +
              '</div>' +
            '</div>'
          : '') +
        (st.prosa
          ? '<div class="card card-sec"><h3>O que o assistente explicou</h3>' +
            '<div class="prosa">' + esc(st.prosa) + '</div></div>'
          : '');
    }

    return '' +
    cabecalho('Protoboard Arduino', 'Montagens desenhadas, com o código pronto.') +
    abas + corpo + resultado;
  },

  mount(raiz) {
    const self = this;
    raiz.addEventListener('click', (ev) => {
      const ba = ev.target.closest('[data-aba]');
      if (ba) { self.st.aba = ba.getAttribute('data-aba'); self.st.erro = ''; rerender(); return; }

      const bc = ev.target.closest('[data-circ]');
      if (bc) {
        const b = BIBLIOTECA.filter((x) => x.id === bc.getAttribute('data-circ'))[0];
        if (b) { self.st.circuito = b; self.st.prosa = ''; rerender(); }
        return;
      }

      if (ev.target.closest('#copiarPrompt')) {
        const p = $('#pedido', raiz);
        self.st.pedido = p ? p.value : '';
        copiar(self.montarPrompt(self.st.pedido));
        return;
      }

      if (ev.target.closest('#desenhar')) {
        const r = $('#resposta', raiz);
        self.st.resposta = r ? r.value : '';
        const ex = extrairJSON(self.st.resposta);
        if (!ex.ok) { self.st.erro = ex.erro; self.st.circuito = null; rerender(); return; }
        const problema = validarCircuito(ex.dados);
        if (problema) { self.st.erro = problema; self.st.circuito = null; rerender(); return; }
        self.st.circuito = ex.dados;
        self.st.erro = '';
        // guarda a prosa: tudo que veio antes do bloco JSON
        const corte = self.st.resposta.search(/```/);
        self.st.prosa = corte > 0 ? self.st.resposta.slice(0, corte).trim() : '';
        rerender();
        return;
      }

      if (ev.target.closest('#limparIA')) {
        self.st.resposta = ''; self.st.erro = ''; self.st.circuito = null; self.st.prosa = '';
        rerender();
        return;
      }

      if (ev.target.closest('#salvarProjeto')) {
        TOOLS.projetos.salvar({
          tipo: 'circuito',
          nome: (self.st.circuito && self.st.circuito.titulo) || 'Circuito',
          circuito: self.st.circuito,
          prosa: self.st.prosa
        });
        return;
      }
    });
  }
};

/* -------- 7.14 Consulta rápida -------------------------------------------- */

const PINAGEM_UNO = [
  ['D0 / RX', 'Recebe dados do USB. Evite usar — atrapalha o upload.'],
  ['D1 / TX', 'Envia dados pelo USB. Mesma coisa: evite.'],
  ['D2, D3', 'Digitais. Os únicos que aceitam interrupção (attachInterrupt).'],
  ['D3, D5, D6', 'Digitais com PWM (símbolo ~) — servem para controlar brilho e velocidade.'],
  ['D4, D7, D8', 'Digitais simples: liga e desliga.'],
  ['D9, D10, D11', 'Digitais com PWM. D10 a D13 também formam o barramento SPI.'],
  ['D12, D13', 'Digitais. O D13 já tem um LED soldado na placa.'],
  ['A0 a A3', 'Entradas analógicas: leem de 0 a 1023. Também servem como digitais.'],
  ['A4 / SDA', 'Dados do barramento I²C (display OLED, RTC, muitos sensores).'],
  ['A5 / SCL', 'Relógio do barramento I²C.'],
  ['5V', 'Saída de 5 V. Até uns 400 mA se estiver no USB.'],
  ['3V3', 'Saída de 3,3 V. Só 50 mA — não serve para alimentar módulo faminto.'],
  ['GND', 'Negativo. Há três deles e são todos o mesmo ponto.'],
  ['VIN', 'Entrada de 7 a 12 V para alimentar a placa sem USB.']
];

const CAPACITORES = [
  ['101', '100 pF', '0,1 nF'], ['102', '1 nF', '0,001 µF'], ['103', '10 nF', '0,01 µF'],
  ['104', '100 nF', '0,1 µF'], ['105', '1 µF', '1000 nF'], ['106', '10 µF', '—'],
  ['223', '22 nF', '0,022 µF'], ['473', '47 nF', '0,047 µF'], ['224', '220 nF', '0,22 µF']
];

const AWG = [
  ['10', '5,26', '15 A'], ['12', '3,31', '9,3 A'], ['14', '2,08', '5,9 A'],
  ['16', '1,31', '3,7 A'], ['18', '0,82', '2,3 A'], ['20', '0,52', '1,5 A'],
  ['22', '0,33', '0,92 A'], ['24', '0,20', '0,58 A'], ['26', '0,13', '0,36 A'],
  ['28', '0,08', '0,23 A']
];

TOOLS.consulta = {
  nome: 'Consulta rápida',
  desc: 'Pinagem, capacitores, código SMD e bitola de fio.',
  grupo: 'arduino',
  icone: 'livro',
  pronto: true,
  st: { aba: 'pinos', codCap: '104', codSmd: '103' },

  /** 104 -> 100 nF */
  lerCapacitor(cod) {
    const c = String(cod || '').trim().toUpperCase().replace(/[^0-9RN.]/g, '');
    if (/^\d{3}$/.test(c)) {
      const pf = parseInt(c.slice(0, 2), 10) * Math.pow(10, parseInt(c[2], 10));
      return { pf: pf, ok: true };
    }
    return { ok: false };
  },

  /** 103 -> 10 kΩ ; 1002 -> 10 kΩ ; 4R7 -> 4,7 Ω */
  lerSmd(cod) {
    const c = String(cod || '').trim().toUpperCase();
    if (/^\d+R\d+$/.test(c) || /^R\d+$/.test(c)) return { ohms: num(c.replace('R', c.startsWith('R') ? '0.' : '.')), ok: true };
    if (/^\d{3}$/.test(c)) return { ohms: parseInt(c.slice(0, 2), 10) * Math.pow(10, parseInt(c[2], 10)), ok: true };
    if (/^\d{4}$/.test(c)) return { ohms: parseInt(c.slice(0, 3), 10) * Math.pow(10, parseInt(c[3], 10)), ok: true };
    return { ok: false };
  },

  render() {
    const st = this.st;
    const cap = this.lerCapacitor(st.codCap);
    const smd = this.lerSmd(st.codSmd);

    const abas = ['pinos', 'capacitores', 'smd', 'fios'];
    const nomes = { pinos: 'Pinagem', capacitores: 'Capacitores', smd: 'SMD', fios: 'Fios' };

    let corpo = '';
    if (st.aba === 'pinos') {
      corpo = '<div class="card"><h3>Arduino Uno / Nano</h3>' +
        '<div class="rolagem"><table class="tabela"><tr><th>Pino</th><th>Para que serve</th></tr>' +
        PINAGEM_UNO.map((p) => '<tr><td class="num">' + esc(p[0]) + '</td><td>' + esc(p[1]) + '</td></tr>').join('') +
        '</table></div></div>' +
        '<div class="card-sec">' + nota('perigo',
          '<b>Os limites de corrente que queimam Arduino.</b> Cada pino aguenta <b>20 mA</b> ' +
          '(40 mA é o limite absoluto, e já é abuso). Somando todos os pinos: <b>200 mA</b>. ' +
          'Motor, servo com carga, fita de LED e relé de bobina passam disso — precisam de fonte ' +
          'própria, com o GND ligado junto ao do Arduino.') + '</div>';
    } else if (st.aba === 'capacitores') {
      corpo = '<div class="card"><h3>Decodificar código de capacitor</h3>' +
        '<div class="campos"><div class="campo"><label for="cc">Número impresso (3 dígitos)</label>' +
        '<input type="text" id="cc" value="' + esc(st.codCap) + '" maxlength="4"></div></div>' +
        (cap.ok
          ? '<div class="card-sec">' + resultadoGrande('Esse capacitor é de',
              cap.pf >= 1e6 ? sig(cap.pf / 1e6) + ' µF' : cap.pf >= 1000 ? sig(cap.pf / 1000) + ' nF' : sig(cap.pf) + ' pF',
              ['<b>' + sig(cap.pf) + '</b> pF', '<b>' + sig(cap.pf / 1000) + '</b> nF',
               '<b>' + sig(cap.pf / 1e6) + '</b> µF']) + '</div>'
          : '<div class="card-sec">' + nota('aviso', 'Digite os três números impressos no capacitor, tipo <b>104</b>.') + '</div>') +
        '<div class="card-sec">' + conta([
          '<span class="cmt">// os dois primeiros dígitos, seguidos de tantos zeros quanto o terceiro</span>',
          '104 → 10 seguido de 4 zeros = 100000 pF = <b>100 nF = 0,1 µF</b>'
        ]) + '</div>' +
        '<div class="rolagem card-sec"><table class="tabela"><tr><th>Código</th><th>Valor</th><th>Também escrito</th></tr>' +
        CAPACITORES.map((c) => '<tr><td class="num">' + c[0] + '</td><td class="num">' + c[1] + '</td><td class="num">' + c[2] + '</td></tr>').join('') +
        '</table></div>' +
        '<p class="card-desc">A letra depois do número é a tolerância: <b>J</b> = ±5%, <b>K</b> = ±10%, ' +
        '<b>M</b> = ±20%. Capacitor eletrolítico (o cilíndrico) já vem com o valor escrito por extenso ' +
        'e <b>tem polaridade</b>: a tarja clara marca o negativo, e ligar ao contrário faz ele estourar.</p>' +
        '</div>';
    } else if (st.aba === 'smd') {
      corpo = '<div class="card"><h3>Decodificar resistor SMD</h3>' +
        '<p class="card-desc">Aquele resistor pequenininho de superfície, que não tem cores — tem ' +
        'números impressos em cima.</p>' +
        '<div class="campos"><div class="campo"><label for="cs">Número impresso</label>' +
        '<input type="text" id="cs" value="' + esc(st.codSmd) + '" maxlength="5"></div></div>' +
        (smd.ok
          ? '<div class="card-sec">' + resultadoGrande('Esse resistor é de', ohm(smd.ohms),
              ['Código curto: <b>' + codigoCurto(smd.ohms) + '</b>']) + '</div>'
          : '<div class="card-sec">' + nota('aviso', 'Tente <b>103</b>, <b>1002</b> ou <b>4R7</b>.') + '</div>') +
        '<div class="card-sec">' + conta([
          '<span class="cmt">// 3 dígitos: os dois primeiros + zeros</span>',
          '103 → 10 com 3 zeros = <b>10 kΩ</b>',
          '<span class="cmt">// 4 dígitos (mais preciso): os três primeiros + zeros</span>',
          '1002 → 100 com 2 zeros = <b>10 kΩ</b>',
          '<span class="cmt">// a letra R marca a vírgula</span>',
          '4R7 = <b>4,7 Ω</b>   ·   R22 = <b>0,22 Ω</b>',
          '<span class="cmt">// e o zero sozinho</span>',
          '000 ou 0 = <b>fio</b>, resistência zero (serve de ponte)'
        ]) + '</div></div>';
    } else {
      corpo = '<div class="card"><h3>Bitola de fio por corrente</h3>' +
        '<div class="rolagem"><table class="tabela">' +
        '<tr><th>AWG</th><th>Diâmetro (mm)</th><th>Corrente máxima</th></tr>' +
        AWG.map((a) => '<tr><td class="num">' + a[0] + '</td><td class="num">' + a[1] + '</td><td class="num">' + a[2] + '</td></tr>').join('') +
        '</table></div>' +
        '<p class="card-desc">Números conservadores, para fio em chicote ou dentro de caixa fechada. ' +
        'Fio solto no ar aguenta mais. Repare que o número <b>diminui</b> conforme o fio engrossa.</p>' +
        '</div>' +
        '<div class="card-sec">' + nota('dica',
          '<b>Regra prática para bateria:</b> use a corrente máxima que a BMS permite, não a corrente ' +
          'normal de uso. É no curto-circuito que o fio fino vira resistência de chuveiro.') + '</div>' +
        '<div class="card card-sec"><h3>Cores de fio (convenção)</h3>' +
        '<div class="rolagem"><table class="tabela">' +
          '<tr><td><span class="cor-bolha" style="display:inline-block;vertical-align:-4px;margin-right:8px;background:#e03131"></span>Vermelho</td><td>Positivo, alimentação</td></tr>' +
          '<tr><td><span class="cor-bolha" style="display:inline-block;vertical-align:-4px;margin-right:8px;background:#2b3038"></span>Preto</td><td>Negativo, GND</td></tr>' +
          '<tr><td><span class="cor-bolha" style="display:inline-block;vertical-align:-4px;margin-right:8px;background:#f2c53d"></span>Amarelo</td><td>Sinal, dados</td></tr>' +
          '<tr><td><span class="cor-bolha" style="display:inline-block;vertical-align:-4px;margin-right:8px;background:#1c7ed6"></span>Azul / verde</td><td>Sinais diversos</td></tr>' +
        '</table></div>' +
        '<p class="card-desc">Não é lei, é costume — mas seguir salva você de inverter polaridade às ' +
        'duas da manhã.</p></div>';
    }

    return '' +
    cabecalho('Consulta rápida', 'As tabelas que a gente sempre esquece.') +
    '<div style="display:flex;justify-content:center;margin-bottom:16px"><div class="seg">' +
      abas.map((a) => '<button class="' + (st.aba === a ? 'ativo' : '') + '" data-aba="' + a + '">' +
        nomes[a] + '</button>').join('') +
    '</div></div>' + corpo;
  },

  mount(raiz) {
    const self = this;
    raiz.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-aba]');
      if (b) { self.st.aba = b.getAttribute('data-aba'); rerender(); }
    });
    const cc = $('#cc', raiz);
    if (cc) cc.addEventListener('input', () => { self.st.codCap = cc.value; rerender(); });
    const cs = $('#cs', raiz);
    if (cs) cs.addEventListener('input', () => { self.st.codSmd = cs.value; rerender(); });
  }
};

/* -------- 7.15 Meus projetos ---------------------------------------------- */

TOOLS.projetos = {
  nome: 'Meus projetos',
  desc: 'Salve seus circuitos e cálculos neste aparelho.',
  grupo: 'ajustes',
  icone: 'pasta',
  pronto: true,
  st: { abrindo: null },

  lista() { return Store.ler('projetos', []); },

  salvar(item) {
    const l = this.lista();
    l.unshift({
      id: 'p' + Date.now().toString(36),
      data: new Date().toISOString(),
      tipo: item.tipo || 'nota',
      nome: item.nome || 'Sem nome',
      circuito: item.circuito || null,
      prosa: item.prosa || ''
    });
    Store.gravar('projetos', l.slice(0, 60));
    torrada('Salvo em Meus projetos');
    rerender();
  },

  apagar(id) {
    Store.gravar('projetos', this.lista().filter((p) => p.id !== id));
    torrada('Projeto apagado');
    rerender();
  },

  render() {
    const l = this.lista();
    const aberto = this.st.abrindo ? l.filter((p) => p.id === this.st.abrindo)[0] : null;

    if (aberto) {
      return cabecalho(aberto.nome, dataBR(aberto.data.slice(0, 10))) +
        '<div class="btn-linha" style="margin-top:0"><button class="btn" id="voltarLista">Voltar à lista</button></div>' +
        (aberto.circuito
          ? '<div class="card card-sec">' + svgProtoboard(aberto.circuito) + '</div>' +
            (aberto.circuito.codigo
              ? '<div class="card card-sec"><h3>Código</h3><pre class="codigo">' + esc(aberto.circuito.codigo) + '</pre>' +
                '<div class="btn-linha"><button class="btn" data-copiar="' + esc(aberto.circuito.codigo) + '">Copiar código</button></div></div>'
              : '')
          : '') +
        (aberto.prosa ? '<div class="card card-sec"><h3>Anotações</h3><div class="prosa">' + esc(aberto.prosa) + '</div></div>' : '') +
        '<div class="btn-linha"><button class="btn" data-apagar="' + esc(aberto.id) + '" ' +
          'style="border-color:rgba(244,82,107,.4);color:var(--vermelho)">Apagar projeto</button></div>';
    }

    return cabecalho('Meus projetos', l.length + (l.length === 1 ? ' projeto salvo' : ' projetos salvos')) +
      (l.length
        ? '<div class="grade">' + l.map((p) =>
            '<button class="card" data-abrir="' + esc(p.id) + '" style="' + corGrupo('ajustes') + '">' +
              '<div class="card-icone">' + icone(p.tipo === 'circuito' ? 'chip' : 'pasta') + '</div>' +
              '<h3>' + esc(p.nome) + '</h3>' +
              '<div class="card-desc">' + esc(dataBR(p.data.slice(0, 10))) + '</div>' +
            '</button>').join('') + '</div>'
        : '<div class="card" style="text-align:center;padding:40px 20px">' +
            '<div class="card-icone" style="margin:0 auto 16px">' + icone('pasta') + '</div>' +
            '<h3>Nada salvo ainda</h3>' +
            '<p class="card-desc" style="max-width:420px;margin:8px auto 0">Monte um circuito na ' +
            '<b>Protoboard Arduino</b> e toque em “Salvar em Meus projetos”. Ele fica guardado aqui ' +
            'neste aparelho.</p>' +
            '<div class="btn-linha" style="justify-content:center">' +
              '<a class="btn primario" href="#/t/protoboard">Ir para a protoboard</a></div>' +
          '</div>') +
      '<div class="card-sec">' + nota('dica',
        'Isto fica salvo só neste aparelho. Para levar ao celular, use <b>Exportar</b> em Ajustes ' +
        'e <b>Importar</b> no outro.') + '</div>';
  },

  mount(raiz) {
    const self = this;
    raiz.addEventListener('click', (ev) => {
      const a = ev.target.closest('[data-abrir]');
      if (a) { self.st.abrindo = a.getAttribute('data-abrir'); rerender(); return; }
      if (ev.target.closest('#voltarLista')) { self.st.abrindo = null; rerender(); return; }
      const d = ev.target.closest('[data-apagar]');
      if (d) {
        if (!confirm('Apagar este projeto?')) return;
        self.st.abrindo = null;
        self.apagar(d.getAttribute('data-apagar'));
      }
    });
  }
};

/* -------- 7.16 Ferramentas que ainda vão chegar -------------------------- */

const EM_BREVE = [];

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
  return '<a class="card' + (t.pronto ? '' : ' embreve') + '" href="#/t/' + id + '" ' +
    'style="' + corGrupo(t.grupo) + '">' +
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
  // "Ajustes" é tela de sistema, não conta como ferramenta.
  const ferramentas = Object.keys(TOOLS).filter((k) => k !== 'ajustes');
  const prontas = ferramentas.filter((k) => TOOLS[k].pronto);
  const total = ferramentas.length;
  const tudoPronto = prontas.length === total;

  let secoes = '';
  GRUPOS.filter((g) => g.id !== 'inicio').forEach((g) => {
    const lista = toolsDoGrupo(g.id);
    if (!lista.length) return;
    secoes += '<div class="secao-titulo" style="' + corGrupo(g.id) + '">' +
      '<span class="secao-pad"></span>' + esc(g.nome) + '</div>' +
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
      '<h3>' + (tudoPronto ? 'As ' + total + ' ferramentas estão prontas'
                           : prontas.length + ' de ' + total + ' ferramentas prontas') + '</h3>' +
      '<div class="card-desc">' + (tudoPronto
        ? 'Versão 1 completa. O app se atualiza sozinho quando você abre com internet.'
        : 'O resto chega nas próximas entregas. O app se atualiza sozinho.') + '</div>' +
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
