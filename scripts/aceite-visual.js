/*
 * scripts/aceite-visual.js — o checklist da seção 11 de
 * docs/souza-os-fundamentos.md como função injetável no navegador.
 *
 * Uso (numa página já carregada e rolada até o fim):
 *   <conteúdo deste arquivo>
 *   window.aceiteVisual({ perfil: 'admin' })            // todos os itens
 *   window.aceiteVisual({ perfil: 'corretor', itens: [1, 5, 25] })
 *
 * Devolve { rota, largura, tema, perfil, violacoes, contagem, naoMedidos }.
 * violacoes: [{ item, regra, seletor, texto, medida, esperado }] (amostra por
 * item, até opcoes.amostra, padrão 30; contagem[item] traz o total real).
 * naoMedidos: [{ item, motivo }] — o que exige ação externa (rede, emulação,
 * teclado, clique, rolagem com espera) ou erro de medição.
 *
 * Só mede. Não clica, não digita, não grava. Exceção única e inofensiva: no
 * item 48 (/despesas) troca window.confirm por uma armadilha que registra a
 * chamada e devolve false (cancela), como o item manda.
 * JavaScript puro, sem import. Tolerância 0,5px salvo indicação do item.
 */
;(function () {
  'use strict'

  var TOL = 0.5
  var REGUA = [0, 1, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
  var RAIOS = [0, 6, 8, 14, 20, 9999]
  var TAM_VALOR = [34, 28, 22, 17, 15, 14]
  var CLASSES_MORTAS = ['gold-edge', 'gold-glow', 'grad-brand-glow', 'surface-premium', 'card-surface',
    'list-surface', 'modal-surface', 'nav-bg-blur', 'aurora', 'barra-atencao', 'atencao-pulse', 'shimmer',
    'stagger-children', 'animate-fade-in', 'animate-recibo', 'cifra', 'assinatura', 'texture-grain']
  var KEYFRAMES_MORTOS = /^(aurora.*|barraAtencao|atencaoPulse|shimmer|slideUp)$/
  var ENTRADAS = ['sobe', 'esmaeceEntra', 'painelEntra', 'folhaEntra', 'modalEntra', 'toastEntra', 'avanca', 'recua', 'numeroTroca']

  /* ---------- utilidades gerais ---------- */

  function px(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n }
  function r1(n) { return Math.round(n * 10) / 10 }
  function cs(el, pseudo) { return getComputedStyle(el, pseudo || null) }
  function todos(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)) }
  function textoDe(el) {
    if (!el) return ''
    var t = (el.nodeType === 3 ? el.nodeValue : (el.getAttribute && el.getAttribute('aria-label')) || el.textContent) || ''
    return t.replace(/\s+/g, ' ').trim().slice(0, 80)
  }

  function visivel(el) {
    if (!el || el.nodeType !== 1) return false
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: false, visibilityProperty: true })) return false
    var r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) return false
    var s = cs(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    // sr-only e recortes
    if (s.position === 'absolute' && s.clip && s.clip !== 'auto' && r.width <= 1) return false
    return true
  }

  function seletorDe(el) {
    if (!el || el.nodeType !== 1) return ''
    var partes = []
    var no = el
    for (var i = 0; no && no.nodeType === 1 && i < 4; i++) {
      var p = no.tagName.toLowerCase()
      if (no.id) { partes.unshift(p + '#' + no.id); break }
      ;['data-caixa', 'data-heroi', 'data-previsto', 'data-linha', 'data-parcela', 'data-celulas', 'data-valor',
        'data-acao', 'data-clicavel', 'data-goteira', 'data-rolagem', 'data-marca', 'data-painel-marca', 'role']
        .forEach(function (a) {
          if (no.hasAttribute(a)) p += '[' + a + (a === 'role' ? '=' + no.getAttribute(a) : '') + ']'
        })
      var cls = (typeof no.className === 'string' ? no.className : (no.getAttribute('class') || ''))
        .split(/\s+/).filter(function (c) { return c && !/[:[\]/.]/.test(c) }).slice(0, 2)
      if (cls.length) p += '.' + cls.join('.')
      var pai = no.parentElement
      if (pai) {
        var mesmos = Array.prototype.filter.call(pai.children, function (c) { return c.tagName === no.tagName })
        if (mesmos.length > 1) p += ':nth-of-type(' + (mesmos.indexOf(no) + 1) + ')'
      }
      partes.unshift(p)
      no = pai
    }
    return partes.join(' > ')
  }

  /** Nós de texto visíveis dentro de raiz, com o elemento pai e o retângulo. */
  function textosVisiveis(raiz) {
    var out = []
    var w = document.createTreeWalker(raiz || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT
        var p = n.parentElement
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })
    var n
    var range = document.createRange()
    while ((n = w.nextNode())) {
      var p = n.parentElement
      if (!visivel(p)) continue
      range.selectNodeContents(n)
      var rects = Array.prototype.filter.call(range.getClientRects(), function (r) { return r.width > 0.5 && r.height > 0.5 })
      if (!rects.length) continue
      var u = uniao(rects)
      out.push({ no: n, el: p, rect: u, rects: rects })
    }
    return out
  }

  function uniao(rects) {
    var l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
    for (var i = 0; i < rects.length; i++) {
      l = Math.min(l, rects[i].left); t = Math.min(t, rects[i].top)
      r = Math.max(r, rects[i].right); b = Math.max(b, rects[i].bottom)
    }
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t }
  }

  function intersecao(a, b) {
    var w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
    var h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
    return w > 0 && h > 0 ? w * h : 0
  }

  function contem(a, b) { return b.left >= a.left - TOL && b.right <= a.right + TOL && b.top >= a.top - TOL && b.bottom <= a.bottom + TOL }
  function perto(a, b, tol) { return Math.abs(a - b) <= (tol == null ? TOL : tol) }
  function naRegua(v) { for (var i = 0; i < REGUA.length; i++) if (Math.abs(v - REGUA[i]) <= 0.05) return true; return false }
  function textoCompleto(el) { return (el && el.textContent || '').replace(/\s+/g, ' ').trim() }
  function ancestral(el, sel) { return el && el.parentElement ? el.parentElement.closest(sel) : null }

  /* ---------- cores ---------- */

  var canvasCor = null
  /** Converte qualquer cor CSS computada em {r,g,b,a} (0–255, a 0–1). */
  function cor(str) {
    if (!str || str === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
    var m = str.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/)
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : +m[4]) }
    m = str.match(/^color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/)
    if (m) return { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255, a: m[4] == null ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : +m[4]) }
    // outros espaços de cor: o canvas converte
    if (!canvasCor) { canvasCor = document.createElement('canvas'); canvasCor.width = canvasCor.height = 1 }
    var ctx = canvasCor.getContext('2d', { willReadFrequently: true })
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = str; ctx.fillRect(0, 0, 1, 1)
    var d = ctx.getImageData(0, 0, 1, 1).data
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
  }
  function corTxt(c) { return c ? 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',' + r1(c.a * 100) / 100 + ')' : '' }
  function mesmaCor(a, b, tol) {
    tol = tol == null ? 3 : tol
    if (!a || !b) return false
    if (a.a < 0.01 && b.a < 0.01) return true
    return Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol && Math.abs(a.a - b.a) <= 0.03
  }
  /** a sobre b (b opaco ou não). */
  function sobre(a, b) {
    var ao = a.a + b.a * (1 - a.a)
    if (ao <= 0) return { r: 0, g: 0, b: 0, a: 0 }
    return {
      r: (a.r * a.a + b.r * b.a * (1 - a.a)) / ao,
      g: (a.g * a.a + b.g * b.a * (1 - a.a)) / ao,
      b: (a.b * a.a + b.b * b.a * (1 - a.a)) / ao,
      a: ao,
    }
  }
  function lum(c) {
    function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  function contraste(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

  var CLARO = document.documentElement.classList.contains('light')
  /* Derivados da seção 5.1, usados só se o token ainda não existir no CSS (Fase 2). */
  var DERIVADOS = CLARO ? {
    '--fio-caixa': 'var(--line-strong)', '--fio-linha': 'var(--line)',
    '--fio-controle': 'color-mix(in srgb, var(--t1) 55%, var(--surface))', '--borda-ouro': 'var(--brand)',
    '--t-meta': 'var(--t4)', '--success-ink': 'color-mix(in srgb, var(--success) 75%, var(--t1))',
    '--warning-ink': 'color-mix(in srgb, var(--warning) 65%, var(--t1))', '--error-ink': 'color-mix(in srgb, var(--error) 85%, var(--t1))',
    '--info-ink': 'var(--info)', '--veu-painel': 'color-mix(in srgb, var(--t1) 28%, transparent)',
    '--veu-modal': 'color-mix(in srgb, var(--t1) 45%, transparent)',
  } : {
    '--fio-caixa': 'var(--line-strong)', '--fio-linha': 'var(--line)',
    '--fio-controle': 'color-mix(in srgb, var(--t1) 38%, var(--surface))', '--borda-ouro': 'color-mix(in srgb, var(--brand) 60%, var(--surface))',
    '--t-meta': 'var(--t3)', '--success-ink': 'var(--success)', '--warning-ink': 'var(--warning)',
    '--error-ink': 'color-mix(in srgb, var(--error) 85%, var(--t1))', '--info-ink': 'var(--info)',
    '--veu-painel': 'color-mix(in srgb, var(--page-bg) 55%, transparent)', '--veu-modal': 'color-mix(in srgb, var(--page-bg) 75%, transparent)',
  }
  var cacheToken = {}
  var tokensAusentes = []
  /** Cor computada de um token (resolve var() e color-mix no próprio navegador). */
  function token(nome) {
    if (cacheToken[nome]) return cacheToken[nome]
    var cru = getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
    if (!cru && DERIVADOS[nome]) tokensAusentes.push(nome)
    var sonda = document.createElement('i')
    sonda.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;'
    sonda.style.color = cru ? 'var(' + nome + ')' : (DERIVADOS[nome] || 'transparent')
    document.body.appendChild(sonda)
    var c = cor(getComputedStyle(sonda).color)
    sonda.remove()
    return (cacheToken[nome] = c)
  }
  function varPx(nome, padrao) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(nome))
    return isNaN(v) ? padrao : v
  }

  /** Fundo efetivo atrás de el: composição dos background-color dos ancestrais sobre a página. */
  function fundoEfetivo(el) {
    var pilha = []
    var temImagem = false
    for (var no = el; no && no.nodeType === 1; no = no.parentElement) {
      var s = cs(no)
      if (s.backgroundImage && s.backgroundImage !== 'none') temImagem = true
      var c = cor(s.backgroundColor)
      if (c.a > 0) pilha.push(c)
      if (c.a >= 1) break
    }
    var base = token('--page-bg')
    if (!base || base.a < 1) base = CLARO ? { r: 255, g: 255, b: 255, a: 1 } : { r: 0, g: 0, b: 0, a: 1 }
    var fundo = base
    for (var i = pilha.length - 1; i >= 0; i--) fundo = sobre(pilha[i], fundo)
    fundo.temImagem = temImagem
    return fundo
  }
  /** Opacidade acumulada de el e ancestrais. */
  function opacidadeAcumulada(el) {
    var o = 1
    for (var no = el; no && no.nodeType === 1; no = no.parentElement) o *= parseFloat(cs(no).opacity)
    return o
  }

  /* ---------- contexto e registro ---------- */

  var ITENS = {}
  var CTX = null
  function item(n, fn) { ITENS[n] = fn }

  function W() { return window.innerWidth }
  function recuoLateral() { var w = W(); return w < 640 ? 16 : w < 1024 ? 20 : 24 }
  function visiveis(sel, raiz) { return todos(sel, raiz).filter(visivel) }
  function main() { return document.querySelector('main') }
  function cabecalho() { return document.querySelector('header.cabecalho') }
  function dentroDeRolagemOculto(el) {
    var rol = el.closest && el.closest('[data-rolagem]')
    if (!rol) return false
    return !contem(rol.getBoundingClientRect(), el.getBoundingClientRect())
  }
  function textoVisivelEm(raiz, re) {
    return textosVisiveis(raiz).some(function (t) { return re.test(t.no.nodeValue) })
  }
  function botoesVisiveis(raiz) { return visiveis('button, [role=button]', raiz) }
  function rotuloBotao(b) { return ((b.getAttribute('aria-label') || '') + ' ' + b.textContent).replace(/\s+/g, ' ').trim() }
  function ehMenuMais(b) { return /⋯|…|mais (ações|opções)|^mais$|ações|opções/i.test(rotuloBotao(b)) }
  function camadaDe(el) { return el.closest('[role=dialog], [role=alertdialog]') || null }
  function brandText() { return token('--brand-text') }
  function corDe(el, prop) { return cor(cs(el)[prop || 'color']) }
  function rota() { return location.pathname.replace(/\/+$/, '') || '/' }
  function ehVendaDetalhe() { return /^\/vendas\/[^/]+$/.test(rota()) }

  /* ---------- Espaço (1 a 7) ---------- */

  item(1, function (v) {
    var lat = recuoLateral()
    visiveis('[data-caixa]').forEach(function (caixa) {
      var cr = caixa.getBoundingClientRect()
      var heroiGrande = caixa.hasAttribute('data-heroi') && W() >= 1024
      var minL = heroiGrande ? 32 : lat, minV = heroiGrande ? 32 : 16
      var alvos = []
      textosVisiveis(caixa).forEach(function (t) { alvos.push({ el: t.el, r: t.rect, txt: t.no.nodeValue }) })
      visiveis('svg, [data-valor], button, input, select, textarea, [data-selo], [data-goteira] > *', caixa).forEach(function (el) {
        if (el.matches('[data-linha], [data-parcela]') || el.querySelector('[data-linha], [data-parcela]')) return
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return
        alvos.push({ el: el, r: el.getBoundingClientRect(), txt: textoDe(el) })
      })
      alvos.forEach(function (a) {
        if (dentroDeRolagemOculto(a.el)) return
        if (a.el.closest('[data-rolagem]') && a.el.closest('[data-rolagem]') !== caixa && caixa.contains(a.el.closest('[data-rolagem]'))) return // 3.6: dentro de [data-rolagem] pode passar da caixa
        if (cs(a.el).textOverflow === 'ellipsis' || (a.el.parentElement && cs(a.el.parentElement).textOverflow === 'ellipsis')) return // truncate: o texto cortado passa do retângulo
        if (a.el.closest('[data-caixa]') !== caixa) return
        var d = { esq: a.r.left - cr.left, dir: cr.right - a.r.right, cima: a.r.top - cr.top, baixo: cr.bottom - a.r.bottom }
        var falhas = []
        if (d.esq < minL - TOL) falhas.push('esquerda ' + r1(d.esq))
        if (d.dir < minL - TOL) falhas.push('direita ' + r1(d.dir))
        if (d.cima < minV - TOL) falhas.push('cima ' + r1(d.cima))
        if (d.baixo < minV - TOL) falhas.push('baixo ' + r1(d.baixo))
        if (falhas.length) v('1', 'recuo dentro de [data-caixa]', a.el, falhas.join(', ') + 'px', '≥ ' + minL + 'px laterais, ≥ ' + minV + 'px vertical', a.txt)
      })
    })
    // 1b: painel lateral e folha
    visiveis('[role=dialog]').forEach(function (dlg) {
      var dr = dlg.getBoundingClientRect()
      var min = W() < 640 ? 16 : 24
      var alvos = textosVisiveis(dlg).map(function (t) { return { el: t.el, r: t.rect, txt: t.no.nodeValue } })
      visiveis('svg, [data-valor], button, input, select, textarea', dlg).forEach(function (el) {
        if (el.matches('[data-linha], [data-parcela]') || el.querySelector('[data-linha], [data-parcela]')) return
        alvos.push({ el: el, r: el.getBoundingClientRect(), txt: textoDe(el) })
      })
      alvos.forEach(function (a) {
        if (dentroDeRolagemOculto(a.el)) return
        var e = a.r.left - dr.left, d = dr.right - a.r.right
        if (e < min - TOL || d < min - TOL) v('1b', 'recuo lateral no painel', a.el, 'esq ' + r1(e) + ', dir ' + r1(d) + 'px', '≥ ' + min + 'px', a.txt)
      })
      var botoes = botoesVisiveis(dlg)
      if (botoes.length) {
        var baixo = botoes.reduce(function (m, b) { return b.getBoundingClientRect().bottom > m.getBoundingClientRect().bottom ? b : m })
        var folga = window.innerHeight - baixo.getBoundingClientRect().bottom
        if (folga < 16 - TOL) v('1b', 'botão mais baixo do rodapé acima da base da tela', baixo, r1(folga) + 'px', '≥ 16px (+ área segura)')
      }
    })
  })

  item(2, function (v) {
    visiveis('[data-caixa]').forEach(function (caixa) {
      var cr = caixa.getBoundingClientRect()
      visiveis('*', caixa).forEach(function (el) {
        if (el.closest('[data-rolagem]') && el.closest('[data-rolagem]') !== caixa) return
        var s = cs(el)
        if (s.position === 'fixed') return
        var r = el.getBoundingClientRect()
        if (r.left < cr.left - TOL || r.right > cr.right + TOL)
          v('2', 'descendente vaza da caixa', el, 'left ' + r1(r.left - cr.left) + ', right ' + r1(cr.right - r.right) + 'px', 'dentro da caixa (≥ 0)')
      })
    })
  })

  item(3, function (v) {
    visiveis('[data-linha], [data-parcela]').forEach(function (el) {
      var lst = el.closest('.lista')
      var ctxAttr = el.getAttribute('data-contexto') || el.getAttribute('contexto') || (lst && lst.getAttribute('data-contexto'))
      var caixa = el.closest('[data-caixa]')
      if (ctxAttr ? ctxAttr !== 'cartao' : !caixa) return
      var s = cs(el)
      var recuo = px(s.getPropertyValue('--recuo')) || varPx('--recuo', recuoLateral())
      var pl = px(s.paddingLeft), pr = px(s.paddingRight)
      if (!perto(pl, recuo) || !perto(pr, recuo))
        v('3', 'padding lateral da linha = --recuo', el, 'pl ' + pl + ', pr ' + pr, '--recuo = ' + recuo + 'px')
      if (!caixa) return
      var filhos = Array.prototype.filter.call(el.children, visivel)
      if (!filhos.length) return
      var ult = filhos.reduce(function (m, f) { return f.getBoundingClientRect().right > m.getBoundingClientRect().right ? f : m })
      // mede da borda de dentro: o fio de 1px da caixa não é recuo
      var dist = caixa.getBoundingClientRect().right - px(cs(caixa).borderRightWidth) - ult.getBoundingClientRect().right
      if (!perto(dist, recuo)) v('3', 'último filho termina a --recuo da borda direita do cartão', ult, r1(dist) + 'px', recuo + 'px')
    })
  })


  item(4, function (v) {
    var minItem = W() < 640 ? 16 : 12
    visiveis('[data-linha], [data-parcela]').forEach(function (el) {
      var botoes = botoesVisiveis(el)
      if (!botoes.length) return
      var baixo = Math.max.apply(null, botoes.map(function (b) { return b.getBoundingClientRect().bottom }))
      var dist = el.getBoundingClientRect().bottom - baixo
      if (dist < minItem - TOL) v('4', 'botão mais baixo acima da base do item', el, r1(dist) + 'px', '≥ ' + minItem + 'px')
      var caixa = el.closest('[data-caixa]')
      if (caixa) {
        var linhas = visiveis('[data-linha], [data-parcela]', caixa)
        if (linhas[linhas.length - 1] === el) {
          var dc = caixa.getBoundingClientRect().bottom - baixo
          if (dc < 16 - TOL) v('4', 'botão da última linha acima da base do cartão', el, r1(dc) + 'px', '≥ 16px')
        }
      }
    })
  })

  function irmaosDeBloco(pai) {
    return Array.prototype.filter.call(pai.children, function (c) {
      if (!visivel(c)) return false
      var s = cs(c)
      return s.position !== 'absolute' && s.position !== 'fixed' && !/^inline/.test(s.display) && s.display !== 'contents'
    })
  }

  item(5, function (v) {
    var m = main()
    if (!m) return
    var esperado = W() < 1024 ? 24 : 32
    var filhos = irmaosDeBloco(m)
    // o <main> pode ter um único invólucro (.conteudo): mede os filhos dele
    while (filhos.length === 1 && filhos[0].children.length > 1 && !filhos[0].hasAttribute('data-caixa')) filhos = irmaosDeBloco(filhos[0])
    for (var i = 1; i < filhos.length; i++) {
      var a = filhos[i - 1].getBoundingClientRect(), b = filhos[i].getBoundingClientRect()
      if (b.top < a.bottom - 1 && b.left >= a.right - 1) continue
      var d = b.top - a.bottom
      if (Math.abs(d - esperado) > 1) v('5', 'ritmo entre blocos do <main>', filhos[i], r1(d) + 'px', esperado + 'px ±1')
    }
    var vaoGrade = W() < 1024 ? 16 : 24
    todos('*', m).forEach(function (g) {
      var s = cs(g)
      if (!/grid|flex/.test(s.display)) return
      var vis = Array.prototype.filter.call(g.children, visivel)
      var cards = vis.filter(function (c) { return c.hasAttribute('data-caixa') })
      if (cards.length < 2) return
      for (var i = 1; i < vis.length; i++) {
        // só cartões VIZINHOS: um bloco que não é caixa entre os dois quebra a comparação
        if (!vis[i].hasAttribute('data-caixa') || !vis[i - 1].hasAttribute('data-caixa')) continue
        var a = vis[i - 1].getBoundingClientRect(), b = vis[i].getBoundingClientRect()
        var d = b.top >= a.bottom - 1 ? b.top - a.bottom : b.left - a.right
        if (Math.abs(d - vaoGrade) > 1) v('5', 'vão entre cartões da grade', cards[i], r1(d) + 'px', vaoGrade + 'px ±1')
      }
    })
    // 5b: nada colado
    todos('*', document.body).forEach(function (pai) {
      if (pai.children.length < 2 || pai.tagName === 'DL' || pai.tagName === 'SVG' || !visivel(pai)) return
      var irm = irmaosDeBloco(pai)
      for (var i = 1; i < irm.length; i++) {
        var x = irm[i - 1], y = irm[i]
        if (x.matches('[data-linha], [data-parcela], tr, [role=row]') || y.matches('[data-linha], [data-parcela], tr, [role=row]')) continue
        // cabeçalho grudado: o respiro é o padding-top do <main> (pt-topo), não vão entre irmãos
        if (x.matches('header, .cabecalho')) continue
        if (/^(THEAD|TBODY|TFOOT)$/.test(y.tagName) || pai.matches('[data-coluna=texto]')) continue
        // separados por fio (border-top) com padding próprio: é divisão de linha, não bloco colado
        if (px(cs(y).borderTopWidth) > 0 && px(cs(y).paddingTop) >= 8) continue
        var a = x.getBoundingClientRect(), b = y.getBoundingClientRect()
        if (a.height <= 24 || b.height <= 24) continue // linha de texto (título/meta 7.2), não bloco
        if (b.left >= a.right - 1 || a.left >= b.right - 1) continue
        if (b.top < a.top + 1) continue
        // o respiro pode morar no padding das faces que se encaram (slots do Cartao, 3.3)
        var d = b.top - a.bottom + px(cs(x).paddingBottom) + px(cs(y).paddingTop)
        if (d < 8 - TOL) v('5b', 'irmãos de bloco colados', y, r1(d) + 'px', '≥ 8px', textoDe(y))
      }
    })
  })

  item(6, function (v) {
    todos('*', document.body).forEach(function (el) {
      var s = cs(el)
      // .sr-only (margin -1px + clip) é técnica de acessibilidade, não sangria
      if (s.position === 'absolute' && el.getBoundingClientRect().width <= 1) return
      ;['marginTop', 'marginRight', 'marginBottom', 'marginLeft'].forEach(function (p) {
        if (px(s[p]) < 0) v('6', 'margem negativa', el, p + ' ' + s[p], '≥ 0')
      })
    })
  })

  item(7, function (v) {
    var m = main()
    todos('*', document.body).forEach(function (el) {
      if (!visivel(el) || el.closest('svg')) return
      if (el.closest('[data-valor]') && !el.hasAttribute('data-valor')) return
      var s = cs(el)
      var props = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']
      var ml = px(s.marginLeft), mr = px(s.marginRight)
      // margin auto vira px usado: centralização simétrica é tratada como auto
      if (!(ml > 0 && perto(ml, mr, 1))) props.push('marginLeft', 'marginRight')
      props.forEach(function (p) {
        var cru = s[p]
        if (!cru || cru === 'normal' || cru === 'auto') return
        if (p === 'paddingBottom' && (el === m || el.classList.contains('pb-seguro') || el.classList.contains('pb-barra-inferior'))) return
        if (p === 'paddingTop' && el.classList.contains('pt-seguro')) return
        // LinhaGrupo: o par termina na borda da coluna de valor (calc do --depois-valor); ms-auto empurra
        if (p === 'paddingRight' && el.hasAttribute('data-grupo')) return
        if (p === 'marginLeft' && el.classList.contains('ms-auto')) return
        var n = Math.abs(px(cru))
        if (!naRegua(n)) v('7', 'espaço fora da régua', el, p + ' ' + cru, '{' + REGUA.join(', ') + '}')
      })
    })
  })

  /* ---------- Grade e casca (8 a 15) ---------- */

  item(8, function (v) {
    var h = cabecalho()
    var esp = W() < 1024 ? 56 : 64
    if (!h) { if (rota() !== '/login' && !/kit\.html$/.test(location.pathname)) v('8', 'header.cabecalho existe', document.body, 'ausente', 'presente'); return }
    var alt = h.getBoundingClientRect().height
    if (!perto(alt, esp)) v('8', 'altura do cabeçalho fixo', h, r1(alt) + 'px', esp + 'px')
  })

  function primeiroDoCabecalho(h) {
    var c = visiveis('button, a, [data-icone-tom], svg, h1', h)
    return c.length ? c[0] : null
  }

  item(9, function (v) {
    var h = cabecalho(), m = main()
    if (h && m) {
      var p = primeiroDoCabecalho(h), cx = visiveis('[data-caixa]', m)[0]
      if (p && cx) {
        var d = p.getBoundingClientRect().left - cx.getBoundingClientRect().left
        if (!perto(d, 0)) v('9', 'left do cabeçalho = left do primeiro [data-caixa]', p, r1(d) + 'px', '0px')
      }
    }
    visiveis('[data-caixa]').forEach(function (caixa) {
      var h2 = caixa.querySelector('h2')
      var linha = visiveis('[data-linha], [data-parcela]', caixa)[0]
      if (!h2 || !visivel(h2) || !linha) return
      var cab = h2.parentElement
      var primeiro = visiveis('svg, [data-icone-tom], h2', cab)[0] || h2
      var filho = Array.prototype.filter.call(linha.children, function (f) { return visivel(f) || cs(f).display === 'contents' })[0]
      if (filho && cs(filho).display === 'contents') filho = Array.prototype.filter.call(filho.children, visivel)[0]
      if (!filho) return
      var alvo = textosVisiveis(filho)[0]
      var lf = Math.min(filho.getBoundingClientRect().left + px(cs(filho).paddingLeft), alvo ? alvo.rect.left : Infinity)
      var d = primeiro.getBoundingClientRect().left - lf
      if (!perto(d, 0)) v('9', 'cabeçalho do cartão alinhado ao primeiro filho da linha', primeiro, r1(d) + 'px', '0px', textoDe(h2))
    })
  })

  item(10, function (v, nm) {
    var h = cabecalho()
    if (h && window.scrollY === 0) {
      var o = parseFloat(cs(h, '::after').opacity)
      if (cs(h, '::after').content !== 'none' && o !== 0) v('10', 'fio do cabeçalho com scrollY=0', h, 'opacity ' + o, 'opacity 0')
    }
    nm('10', 'Fio ao rolar: window.scrollTo(0,200), esperar 150ms, getComputedStyle(header.cabecalho, "::after").opacity deve ser 1; voltar a 0 e conferir 0.')
    if (/[?&]parcela=/.test(location.search) && h) {
      var p = document.querySelector('[data-parcela][aria-current="true"]')
      if (!p) v('10', 'parcela do ?parcela= com aria-current="true"', document.body, 'ausente', 'presente')
      else {
        var d = p.getBoundingClientRect().top - h.getBoundingClientRect().bottom
        if (d < 12 - TOL || d > 20 + TOL) v('10', 'topo da parcela abaixo do cabeçalho', p, r1(d) + 'px', '12 a 20px')
      }
    }
  })

  function temSeletorMes() {
    return visiveis('[data-seletor-mes], [aria-label*="mês" i], [aria-label*="mes anterior" i]').length > 0
  }

  item(11, function (v, nm) {
    var r = rota()
    if (CTX.perfil === 'corretor') { nm('11', 'Corretor: conferir à mão se a rota declara o seletor de mês e se ele aparece só nela.'); return }
    var com = ['/', '/receber', '/pagar', '/despesas', '/relatorios']
    var sem = ['/vendas', '/corretores', '/config']
    var tem = temSeletorMes()
    if (com.indexOf(r) >= 0 && !tem) v('11', 'seletor de mês presente', cabecalho() || document.body, 'ausente', 'presente')
    if ((sem.indexOf(r) >= 0 || ehVendaDetalhe()) && tem) v('11', 'seletor de mês ausente', cabecalho() || document.body, 'presente', 'ausente')
  })

  item(12, function (v) {
    if (W() < 1024 || CTX.perfil !== 'admin' || /kit\.html$/.test(location.pathname)) return // o kit não tem casca
    var trilho = visiveis('aside')[0]
    if (!trilho) { if (cabecalho()) v('12', 'trilho lateral existe', document.body, 'ausente', 'presente'); return }
    var tr = trilho.getBoundingClientRect()
    if (tr.width <= 68 + TOL) {
      visiveis('*', trilho).forEach(function (el) {
        var r = el.getBoundingClientRect()
        if (r.right > 68 + TOL) v('12', 'recolhido: nada além de 68px', el, 'right ' + r1(r.right), '≤ 68')
      })
    }
    var topo = Array.prototype.filter.call(trilho.children, visivel)[0]
    if (topo) {
      var th = topo.getBoundingClientRect().height
      if (!perto(th, 64)) v('12', 'topo do trilho com a altura do cabeçalho', topo, r1(th) + 'px', '64px')
      var marca = topo.querySelector('a')
      visiveis('button, a', topo).forEach(function (b) { if (b !== marca) v('12', 'nenhum botão no topo além da marca', b, 'presente', 'ausente', rotuloBotao(b)) })
      if (!marca) v('12', 'link da marca no topo', topo, 'ausente', 'presente')
      else {
        var nome = (marca.getAttribute('aria-label') || marca.textContent || '').replace(/\s+/g, ' ').trim()
        if (nome !== 'Souza Imobiliária, início') v('12', 'nome acessível do link da marca', marca, nome, 'Souza Imobiliária, início')
      }
      var rotulo = visiveis('.text-rotulo', trilho)[0]
      if (rotulo) {
        var d = rotulo.getBoundingClientRect().top - topo.getBoundingClientRect().bottom
        if (Math.abs(d - 24) > 1) v('12', 'primeiro rótulo de grupo abaixo do topo', rotulo, r1(d) + 'px', '24px ±1', textoDe(rotulo))
      }
    }
    var botoes = visiveis('button, a', trilho)
    botoes.forEach(function (b, i) {
      var r = b.getBoundingClientRect()
      if (r.width < 32 - TOL || r.height < 32 - TOL) v('12', 'botão do trilho ≥ 32×32', b, r1(r.width) + '×' + r1(r.height), '≥ 32×32', rotuloBotao(b))
      for (var j = i + 1; j < botoes.length; j++) {
        if (b.contains(botoes[j]) || botoes[j].contains(b)) continue
        if (intersecao(r, botoes[j].getBoundingClientRect()) > 1) v('12', 'botões do trilho sem sobreposição', botoes[j], 'sobrepõe ' + rotuloBotao(b), 'sem sobreposição')
      }
    })
  })

  item(13, function (v) {
    var m = main()
    if (m) {
      var cont = m.querySelector('.conteudo') || m
      var cr = cont.getBoundingClientRect(), mr = m.getBoundingClientRect()
      var larg = cr.width - px(cs(cont).paddingLeft) - px(cs(cont).paddingRight)
      if (larg > 1216 + TOL) v('13', 'conteúdo do <main> ≤ 1216px', cont, r1(larg) + 'px', '≤ 1216px')
      if (W() >= 1710) {
        var d = Math.abs((cr.left - mr.left) - (mr.right - cr.right))
        if (d > 1) v('13', 'conteúdo centrado', cont, '|esq − dir| ' + r1(d), '≤ 1')
      }
    }
    var sw = document.documentElement.scrollWidth
    if (sw > W()) v('13', 'sem rolagem horizontal do documento', document.documentElement, 'scrollWidth ' + sw, '≤ ' + W())
    if (W() < 1024) {
      visiveis('*').forEach(function (el) {
        if (el === document.documentElement || el === document.body || el.closest('svg')) return
        var s = cs(el)
        if (!/(auto|scroll)/.test(s.overflowX)) return
        if (el.scrollWidth <= el.clientWidth + 1) return
        if (el.hasAttribute('data-rolagem')) {
          if (s.scrollbarWidth !== 'none') v('13', '[data-rolagem] sem barra visível', el, 'scrollbar-width ' + s.scrollbarWidth, 'none')
          return
        }
        v('13', 'contêiner com rolagem horizontal fora de [data-rolagem]', el, el.scrollWidth + ' > ' + el.clientWidth, 'scrollWidth ≤ clientWidth')
      })
    }
  })

  function barraInferior() {
    return visiveis('nav, [data-barra-inferior]').filter(function (n) {
      var s = cs(n), r = n.getBoundingClientRect()
      return s.position === 'fixed' && perto(r.bottom, window.innerHeight, 2) && r.width >= W() * 0.9
    })[0] || null
  }
  function noFim() { return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2 }

  item(14, function (v, nm) {
    if (W() >= 1024 || /kit\.html$/.test(location.pathname)) return // o kit não tem casca
    var nav = barraInferior()
    if (!nav) { if (cabecalho()) v('14', 'barra inferior existe (<1024)', document.body, 'ausente', 'presente'); return }
    var nr = nav.getBoundingClientRect()
    if (nr.height < 64 - TOL || nr.height > 64 + 34 + TOL) v('14', 'altura da barra inferior = 64 + área segura', nav, r1(nr.height) + 'px', '64px + env(safe-area-inset-bottom)')
    visiveis('a, button', nav).forEach(function (it) {
      var svg = it.querySelector('svg')
      var badge = visiveis('*', it).filter(function (e) { return e.children.length === 0 && /^\s*\d+\+?\s*$/.test(e.textContent) })[0]
      if (!badge || !svg) return
      var br = badge.getBoundingClientRect(), sr = svg.getBoundingClientRect()
      var txt = badge.textContent.trim()
      if (txt.length > 3) v('14', 'badge com até 3 caracteres', badge, txt, '≤ 3 ("9+")')
      var pilula = svg.parentElement.contains(badge) ? svg.parentElement : svg.parentElement
      var pr = pilula.getBoundingClientRect()
      if (pr.bottom - br.bottom < 8 - TOL) v('14', 'base do badge acima da base da pílula', badge, r1(pr.bottom - br.bottom) + 'px', '≥ 8px')
      var rotulo = textosVisiveis(it).filter(function (t) { return !badge.contains(t.el) })[0]
      if (rotulo && rotulo.rect.top - br.bottom < 12 - TOL) v('14', 'base do badge acima do topo do rótulo', badge, r1(rotulo.rect.top - br.bottom) + 'px', '≥ 12px')
      var cobre = Math.max(0, Math.min(br.right, sr.right) - Math.max(br.left, sr.left))
      if (cobre > 6 + TOL) v('14', 'badge cobre ≤ 6px do ícone', badge, r1(cobre) + 'px', '≤ 6px')
    })
    var m = main()
    if (!m) return
    if (!noFim()) { nm('14', 'Último bloco do <main> ≥ 24px acima da barra: rolar até o fim e rodar de novo o item 14.'); return }
    var blocos = irmaosDeBloco(m)
    while (blocos.length === 1 && blocos[0].children.length) blocos = irmaosDeBloco(blocos[0])
    var ult = blocos[blocos.length - 1]
    if (ult) {
      var d = nr.top - ult.getBoundingClientRect().bottom
      if (d < 24 - TOL) v('14', 'último bloco do <main> acima da barra inferior', ult, r1(d) + 'px', '≥ 24px')
    }
  })

  item(15, function (v, nm) {
    nm('15', 'Painel e rolagem: anotar left do <main>, texto do h1 e altura do cabeçalho; abrir um SidePanel (gatilho sem gravar), conferir os três iguais; Escape; conferir document.activeElement === gatilho e left do <main> igual (0px).')
    if (visiveis('[role=dialog]').length) {
      var h = cabecalho()
      if (h) {
        var esp = W() < 1024 ? 56 : 64
        if (!perto(h.getBoundingClientRect().height, esp)) v('15', 'altura do cabeçalho com painel aberto', h, r1(h.getBoundingClientRect().height) + 'px', esp + 'px')
      }
    }
  })

  /* ---------- Superfície e cor (16 a 22) ---------- */

  function bordas4(s) {
    return ['Top', 'Right', 'Bottom', 'Left'].every(function (l) { return px(s['border' + l + 'Width']) > 0 && s['border' + l + 'Style'] !== 'none' })
  }

  item(16, function (v) {
    var fio = token('--fio-caixa'), ouro = token('--borda-ouro')
    visiveis('[data-caixa]').forEach(function (cx) {
      var s = cs(cx)
      ;['Top', 'Right', 'Bottom', 'Left'].forEach(function (l) {
        if (!perto(px(s['border' + l + 'Width']), 1, 0.05) || s['border' + l + 'Style'] === 'none')
          v('16', 'borda de 1px nos 4 lados', cx, l + ' ' + s['border' + l + 'Width'] + ' ' + s['border' + l + 'Style'], '1px solid')
      })
      var ehOuro = cx.hasAttribute('data-heroi') && !cx.hasAttribute('data-previsto')
      var esp = ehOuro ? ouro : fio
      var c = cor(s.borderTopColor)
      if (!mesmaCor(c, esp, 4)) v('16', 'cor da borda da caixa', cx, corTxt(c), (ehOuro ? '--borda-ouro ' : '--fio-caixa ') + corTxt(esp))
      if (CLARO && s.boxShadow === 'none') v('16', 'caixa com sombra no claro', cx, 'none', '≠ none')
      if (ancestral(cx, '[data-caixa]')) v('16', '[data-caixa] dentro de [data-caixa]', cx, 'aninhada', 'sem caixa dentro de caixa')
      if (cx.closest('[role=dialog]')) v('16', '[data-caixa] dentro de [role=dialog]', cx, 'dentro do painel', 'nenhuma')
    })
    visiveis('.lista').forEach(function (l) {
      if (ancestral(l, '[data-linha]') || ancestral(l, '.lista')) v('16', '.lista dentro de [data-linha] ou .lista', l, 'aninhada', 'nenhuma')
    })
    visiveis('button, input, select, [role=tab]').forEach(function (b) {
      if (b === document.activeElement || b.hasAttribute('data-caixa')) return
      var sh = cs(b).boxShadow
      if (sh !== 'none') v('16', 'controle sem box-shadow fora do foco', b, sh.slice(0, 60), 'none', rotuloBotao(b))
    })
    // 16b
    visiveis('*').forEach(function (el) {
      if (el.hasAttribute('data-caixa') || el.closest('svg')) return
      if (el.matches('[role=alertdialog], [role=alertdialog] *, [role=status], [role=tooltip], [data-toast], [data-popover], [data-dica], input, select, textarea, button')) return
      var s = cs(el)
      if (!bordas4(s) || px(s.borderTopLeftRadius) < 12) return
      var pai = el.parentElement
      if (!pai) return
      if (mesmaCor(fundoEfetivo(el), fundoEfetivo(pai), 2)) return
      v('16b', 'caixa não declarada (borda 4 lados, raio ≥ 12, fundo próprio)', el, 'raio ' + s.borderTopLeftRadius, 'usar [data-caixa] ou separar sem caixa', textoDe(el))
    })
  })

  var ROTAS_UM_HEROI = ['/', '/vendas', '/receber', '/pagar', '/despesas', '/corretores', '/relatorios']
  var ROTAS_SEM_HEROI = ['/config', '/recebimentos', '/minhas-vendas', '/login']

  item(17, function (v) {
    var r = rota()
    var herois = visiveis('[data-heroi]')
    var um = CTX.perfil === 'corretor' ? r === '/' : (ROTAS_UM_HEROI.indexOf(r) >= 0 || ehVendaDetalhe())
    var zero = ROTAS_SEM_HEROI.indexOf(r) >= 0
    if (um && herois.length !== 1) v('17', 'exatamente 1 [data-heroi] na rota', document.body, herois.length + '', '1')
    if (zero && herois.length) v('17', 'nenhum [data-heroi] na rota', herois[0], herois.length + '', '0')
    var fill = token('--brand-fill')
    var camadas = new Map()
    visiveis('*').forEach(function (el) {
      if (!mesmaCor(cor(cs(el).backgroundColor), fill, 3) || fill.a === 0) return
      if (el.closest('[data-amostra], [data-barra]')) return // mostruário do kit; preenchimento de Barra não é ação
      var cam = camadaDe(el) || document
      camadas.set(cam, (camadas.get(cam) || []).concat([el]))
      if (el.matches('[role=tab], [role=radio], [aria-pressed], [data-chip], [data-filtro]') || el.closest('[role=tablist], [role=radiogroup]'))
        v('17', 'aba/filtro/chip ativo com --brand-fill', el, 'brand-fill', 'sem brand-fill', textoDe(el))
    })
    camadas.forEach(function (els) {
      if (els.length > 1) v('17', '≤ 1 elemento com --brand-fill por camada', els[1], els.length + '', '≤ 1', textoDe(els[1]))
    })
    herois.forEach(function (h) {
      var botoes = visiveis('button', h).filter(function (b) { return !b.closest('[data-valor]') && !b.querySelector('[data-valor]') })
      if (botoes.length > 1) v('17', '≤ 1 button no herói fora de [data-valor]', botoes[1], botoes.length + '', '≤ 1', rotuloBotao(botoes[1]))
      var valores = visiveis('[data-valor]', h).filter(function (x) { return !x.closest('dl') })
      if (valores.length > 4) v('17', '≤ 4 [data-valor] no herói fora do Demonstrativo', h, valores.length + '', '≤ 4')
    })
    var erro = token('--error'), erroBg = token('--error-bg')
    visiveis('button').forEach(function (b) {
      var bg = cor(cs(b).backgroundColor)
      if (bg.a === 0) return
      var ehErro = mesmaCor(bg, erro, 3) || mesmaCor(bg, erroBg, 3)
      if (!ehErro) return
      if (b.closest('[data-heroi]')) v('17', 'botão de erro dentro do herói', b, corTxt(bg), 'sem cor de erro', rotuloBotao(b))
      else if (!b.closest('[role=dialog], [role=alertdialog]')) v('17', 'botão com fundo de erro fora de diálogo', b, corTxt(bg), 'só em [role=dialog]', rotuloBotao(b))
    })
    visiveis('[data-heroi] *').forEach(function (el) {
      var bg = cor(cs(el).backgroundColor), c = cor(cs(el).color)
      if (el.tagName === 'BUTTON' && (mesmaCor(c, erro, 3) || mesmaCor(c, token('--error-ink'), 3))) v('17', 'botão com cor de erro no herói', el, corTxt(c), 'sem cor de erro', rotuloBotao(el))
      void bg
    })
    var veus = visiveis('[data-veu], [data-veu-painel], [data-veu-modal]')
    veus.forEach(function (el) {
      var esp = el.closest('[role=alertdialog]') || el.hasAttribute('data-veu-modal') ? token('--veu-modal') : token('--veu-painel')
      var c = cor(cs(el).backgroundColor)
      if (!mesmaCor(c, esp, 4) && !mesmaCor(c, token('--veu-modal'), 4)) v('17', 'véu com --veu-painel/--veu-modal', el, corTxt(c), corTxt(esp))
    })
  })

  function temCorBrandText(el) { var bt = brandText(); return bt.a > 0 && mesmaCor(cor(cs(el).color), bt, 3) }

  item('17b', function (v) {
    var fio = token('--fio-caixa'), ouro = token('--borda-ouro')
    visiveis('[data-heroi][data-previsto]').forEach(function (h) {
      var c = cor(cs(h).borderTopColor)
      if (!mesmaCor(c, fio, 4)) v('17b', 'herói previsto com borda --fio-caixa', h, corTxt(c), corTxt(fio))
      visiveis('*', h).forEach(function (el) { if (temCorBrandText(el)) v('17b', 'herói previsto sem brand-text', el, 'brand-text', 't1/t2', textoDe(el)) })
      if (!/previst/i.test(textoCompleto(h))) v('17b', 'rótulo do herói previsto casa /previst/i', h, textoDe(h), '/previst/i')
    })
    var r = rota()
    if (CTX.perfil === 'admin' && (r === '/vendas' || r === '/receber')) {
      visiveis('[data-heroi]').forEach(function (h) { if (!h.hasAttribute('data-previsto')) v('17b', 'herói desta rota é data-previsto', h, 'sem data-previsto', 'data-previsto') })
      visiveis('*').forEach(function (el) {
        if (temCorBrandText(el) && el.childNodes.length && textoCompleto(el)) v('17b', 'rota sem cor brand-text', el, 'brand-text', 'nenhum', textoDe(el))
        var s = cs(el)
        if (bordas4(s) && mesmaCor(cor(s.borderTopColor), ouro, 3)) v('17b', 'rota sem borda --borda-ouro', el, 'borda-ouro', 'nenhuma')
      })
    }
  })

  item(18, function (v) {
    var mortas = new RegExp('(^|\\s)(' + CLASSES_MORTAS.join('|') + ')(\\s|$)')
    todos('*').forEach(function (el) {
      var s = cs(el)
      if (/gradient/.test(s.backgroundImage) && !el.closest('[data-painel-marca]'))
        v('18', 'background-image com gradient', el, s.backgroundImage.slice(0, 60), 'sem degradê fora de [data-painel-marca]')
      ;['::before', '::after'].forEach(function (ps) {
        var p = cs(el, ps)
        if (!p.content || p.content === 'none' || p.display === 'none') return
        var w = px(p.width), h = px(p.height)
        var bg = cor(p.backgroundColor)
        if (w > 0 && w <= 4 && h >= 12 && bg.a > 0 && (!p.backgroundImage || p.backgroundImage === 'none'))
          v('18', 'barra em pseudo-elemento (≤ 4px × ≥ 12px)', el, ps + ' ' + r1(w) + '×' + r1(h), 'nenhuma')
        if (/gradient/.test(p.backgroundImage) && !el.closest('[data-painel-marca]')) v('18', 'gradient em pseudo-elemento', el, ps, 'sem degradê')
      })
      var bl = px(s.borderLeftWidth), br = px(s.borderRightWidth), bt = px(s.borderTopWidth), bb = px(s.borderBottomWidth)
      if ((bl >= 2 && (bl !== bt || bl !== bb)) || (br >= 2 && (br !== bt || br !== bb)))
        v('18', 'filete lateral (border-left/right ≥ 2px)', el, 'l ' + bl + ', r ' + br + ', t ' + bt + ', b ' + bb, 'lados iguais')
      var cls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '')
      var mm = cls.match(mortas)
      if (mm) v('18', 'classe morta', el, mm[2], 'removida')
    })
    Array.prototype.forEach.call(document.styleSheets, function (sh) {
      var regras
      try { regras = sh.cssRules } catch (e) { return }
      ;(function varre(lista) {
        Array.prototype.forEach.call(lista || [], function (rg) {
          if (rg.type === 7 && KEYFRAMES_MORTOS.test(rg.name)) v('18', '@keyframes morto carregado', document.documentElement, rg.name, 'removido')
          if (rg.cssRules) varre(rg.cssRules)
        })
      })(regras)
    })
  })

  item(19, function (v) {
    visiveis('*').forEach(function (el) {
      if (el.closest('[data-marca]') || el.closest('svg')) return
      var s = cs(el)
      var temBorda = px(s.borderTopWidth) > 0 || px(s.borderLeftWidth) > 0
      var temFundo = cor(s.backgroundColor).a > 0 || (s.backgroundImage && s.backgroundImage !== 'none')
      if (!temBorda && !temFundo) return
      var r = el.getBoundingClientRect()
      ;['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].forEach(function (p) {
        var cru = s[p]
        if (/%/.test(cru)) { if (parseFloat(cru) === 50) return }
        var n = px(cru)
        if (n >= Math.min(r.width, r.height) / 2 - 0.5 && n > 20) return // pílula (9999 recortado)
        if (RAIOS.indexOf(Math.round(n * 100) / 100) < 0 && !RAIOS.some(function (x) { return perto(n, x, 0.05) }))
          v('19', 'raio fora da escala', el, p + ' ' + cru, '{0, 6, 8, 14, 20, 9999, 50%}')
      })
      var cx = ancestral(el, '[data-caixa]')
      if (cx && !el.hasAttribute('data-dica') && perto(px(cs(cx).borderTopLeftRadius), 14, 0.05) && px(s.borderTopLeftRadius) > 8 + 0.05 && px(s.borderTopLeftRadius) < Math.min(r.width, r.height) / 2 - 0.5)
        v('19', 'filho de caixa 14 com raio ≤ 8', el, s.borderTopLeftRadius, '≤ 8px')
    })
  })

  function corTextoEfetiva(el) {
    var c = cor(cs(el).color)
    c.a *= opacidadeAcumulada(el)
    return c
  }

  item(20, function (v, nm) {
    var raiz = document.body
    textosVisiveis(raiz).forEach(function (t) {
      var el = t.el
      if (el.closest('[aria-hidden=true]') && !el.closest('[data-marca]')) return
      if (el.closest(':disabled, [aria-disabled=true]')) return
      var s = cs(el)
      var tam = px(s.fontSize), peso = parseInt(s.fontWeight, 10) || 400
      var grande = tam >= 18.66 || (tam >= 14 && peso >= 700)
      var fundo = fundoEfetivo(el)
      if (fundo.temImagem) return // degradê/imagem: medido no item 55
      var c = sobre(corTextoEfetiva(el), fundo)
      var k = contraste(c, fundo)
      var min = grande ? 3 : 4.5
      if (k < min - 0.005) v('20', 'contraste de texto', el, r1(k * 100) / 100 + ':1 (' + tam + 'px ' + peso + ')', '≥ ' + min + ':1', t.no.nodeValue.trim().slice(0, 60))
    })
    nm('20', 'Hover forçado: via CDP (CSS.forcePseudoState :hover) em cada [data-linha]/[data-parcela] e rodar o item 20 de novo; repetir no outro tema.')
  })

  item(21, function (v, nm) {
    visiveis('input, select, textarea').forEach(function (el) {
      var s = cs(el)
      if (px(s.borderTopWidth) === 0 && px(s.borderBottomWidth) === 0) return
      var lado = px(s.borderTopWidth) > 0 ? 'borderTopColor' : 'borderBottomColor'
      var fundo = fundoEfetivo(el.parentElement || el)
      var k = contraste(sobre(cor(s[lado]), fundo), fundo)
      if (k < 3 - 0.005) v('21', 'borda de campo ≥ 3:1', el, r1(k * 100) / 100 + ':1', '≥ 3:1', el.getAttribute('aria-label') || el.name || '')
    })
    visiveis('button svg, a svg').forEach(function (svg) {
      var alvo = svg.closest('button, a')
      if (textosVisiveis(alvo).length) return
      var s = cs(svg)
      var traco = s.stroke && s.stroke !== 'none' ? s.stroke : s.color
      var c = cor(traco === 'currentcolor' || traco === 'currentColor' ? s.color : traco)
      c.a *= opacidadeAcumulada(svg)
      var fundo = fundoEfetivo(svg)
      var k = contraste(sobre(c, fundo), fundo)
      if (k < 3 - 0.005) v('21', 'ícone de botão sem texto ≥ 3:1', svg, r1(k * 100) / 100 + ':1', '≥ 3:1', alvo.getAttribute('aria-label') || '')
    })
    nm('21', 'Hover, erro e foco: forçar :hover/:focus-visible (CDP) e aria-invalid num campo e medir borda e outline ≥ 3:1.')
  })

  item(22, function (v) {
    var inks = ['--success-ink', '--warning-ink', '--error-ink', '--info-ink'].map(token).filter(function (c) { return c.a > 0 })
    textosVisiveis(document.body).forEach(function (t) {
      var c = cor(cs(t.el).color)
      if (!inks.some(function (k) { return mesmaCor(c, k, 3) })) return
      // dinheiro negativo/vencido: o próprio "−" e o estado da linha são o texto de estado (6.3)
      if (t.el.closest('[data-valor], [data-selo], [aria-hidden=true]')) return // o ordinal do Selo anda com o ChipSituacao (7.7)
      var pai = t.el.parentElement || t.el
      if (!pai.querySelector('svg') && !t.el.querySelector('svg')) v('22', 'cor *-ink acompanhada de ícone no mesmo pai', t.el, 'sem svg', 'svg ou texto de estado', t.no.nodeValue.trim())
    })
    visiveis('svg.lucide').forEach(function (s) {
      var sw = s.getAttribute('stroke-width') || cs(s).strokeWidth
      if (!perto(px(sw), 1.6, 0.01)) v('22', 'stroke-width de ícone lucide', s, sw, '1.6', s.getAttribute('class'))
    })
    visiveis('svg.lucide-calendar-clock').forEach(function (s) {
      var dono = s.closest('[data-chip], [data-goteira], .chip') || s.parentElement
      if (!/previst/i.test(textoCompleto(dono) + ' ' + (dono.getAttribute('aria-label') || '') + ' ' + (dono.getAttribute('title') || '')))
        v('22', 'calendar-clock só em situação "Prevista"', s, textoDe(dono), 'chip/goteira "Prevista"')
    })
    visiveis('svg.lucide-calendar-x-2, svg.lucide-calendar-x2').forEach(function (s) {
      var dono = s.closest('[data-chip], [data-goteira], .chip') || s.parentElement
      if (!/sem baixa/i.test(textoCompleto(dono) + ' ' + (dono.getAttribute('aria-label') || '')))
        v('22', 'calendar-x-2 só em "Sem baixa"', s, textoDe(dono), '"Sem baixa"')
    })
    visiveis('[data-parcela] svg.lucide-triangle-alert, [data-parcela] svg.lucide-alert-triangle').forEach(function (s) {
      var p = s.closest('[data-parcela]')
      if (!/recebid/i.test(textoCompleto(p))) v('22', 'triângulo de alerta em parcela a receber', s, 'presente', 'ausente', textoDe(p))
    })
    var cabs = visiveis('[data-caixa] h2').filter(function (h) { return !h.closest('[data-heroi]') }).map(function (h) {
      var cab = h.parentElement
      return { h: h, icone: !!(cab && cab.querySelector('svg, [data-icone-tom]')) }
    })
    var com = cabs.filter(function (c) { return c.icone }).length
    if (com && com < cabs.length) cabs.filter(function (c) { return !c.icone }).forEach(function (c) {
      v('22', 'cabeçalhos de Cartao consistentes (todos ou nenhum com ícone)', c.h, 'sem ícone (' + com + '/' + cabs.length + ' com)', 'todos ou nenhum', textoDe(c.h))
    })
  })

  /* ---------- Tipografia e números (23 a 31) ---------- */

  item(23, function (v) {
    textosVisiveis(document.body).forEach(function (t) {
      var el = t.el, s = cs(el)
      var tam = Math.round(px(s.fontSize) * 100) / 100
      var marca = el.closest('[data-marca]')
      var txt = t.no.nodeValue.trim().slice(0, 60)
      if (tam < 11 - 0.05) v('23', 'texto < 11px', el, tam + 'px', '≥ 11px', txt)
      else if (perto(tam, 11, 0.05) && !marca && !el.closest('.text-rotulo, .text-chip'))
        v('23', '11px só em .text-rotulo/.text-chip/[data-marca]', el, '11px', '.text-rotulo ou .text-chip', txt)
      else if (perto(tam, 12, 0.05) && !marca && !el.closest('.text-nota'))
        v('23', '12px só em .text-nota', el, '12px', '.text-nota', txt)
      if (s.textTransform === 'uppercase' && !perto(tam, 11, 0.05) && !marca) v('23', 'uppercase só em 11px', el, tam + 'px', '11px', txt)
    })
  })

  item(24, function (v) {
    var h1s = visiveis('h1')
    if (h1s.length !== 1 && rota() !== '/login' && !/kit\.html$/.test(location.pathname)) v('24', 'exatamente um h1 visível', h1s[1] || document.body, h1s.length + '', '1')
    var esp = W() >= 1024 ? 19 : 17
    h1s.forEach(function (h) {
      var s = cs(h)
      if (!/^["']?Sora/i.test(s.fontFamily) || !perto(px(s.fontSize), esp, 0.05)) v('24', 'h1 Sora ' + esp + 'px', h, s.fontFamily.split(',')[0] + ' ' + s.fontSize, 'Sora ' + esp + 'px', textoDe(h))
      if (h.closest('main') && cabecalho()) v('24', 'h1 só no cabeçalho, não no <main>', h, 'dentro do <main>', 'no header.cabecalho', textoDe(h))
    })
    visiveis('[data-caixa] h2').forEach(function (h) {
      if (h.closest('[data-heroi]')) return // o rótulo do herói é text-rotulo (7.5)
      var s = cs(h)
      if (!/^["']?Sora/i.test(s.fontFamily) || !perto(px(s.fontSize), 15, 0.05) || parseInt(s.fontWeight, 10) !== 600)
        v('24', 'h2 de Cartao Sora 15px 600', h, s.fontFamily.split(',')[0] + ' ' + s.fontSize + ' ' + s.fontWeight, 'Sora 15px 600', textoDe(h))
    })
  })

  var RE_DINHEIRO = /^[−-]?R\$[\s   ]?\d{1,3}(\.\d{3})*,\d{2}$/

  item(25, function (v) {
    visiveis('[data-valor]').forEach(function (el) {
      var s = cs(el)
      var txt = textoCompleto(el)
      if (!/^["']?Sora/i.test(s.fontFamily)) v('25', '[data-valor] em Sora', el, s.fontFamily.split(',')[0], 'Sora', txt)
      if (!/tabular-nums/.test(s.fontVariantNumeric)) v('25', '[data-valor] tabular-nums', el, s.fontVariantNumeric, 'tabular-nums', txt)
      if (s.whiteSpace !== 'nowrap') v('25', '[data-valor] nowrap', el, s.whiteSpace, 'nowrap', txt)
      if (s.textOverflow === 'ellipsis' || el.scrollWidth > el.clientWidth + 1 && s.overflow === 'hidden') v('25', '[data-valor] sem reticência/corte', el, 'cortado', 'inteiro', txt)
      var lh = s.lineHeight === 'normal' ? px(s.fontSize) * 1.25 : px(s.lineHeight)
      var alt = el.getBoundingClientRect().height
      if (alt > lh + 1 + TOL && s.display.indexOf('inline') === 0) v('25', 'altura do valor ≤ line-height + 1', el, r1(alt) + 'px', '≤ ' + r1(lh + 1) + 'px', txt)
      var limpo = txt.replace(/\s+/g, ' ').replace(/^\+\s?/, '')
      if (!RE_DINHEIRO.test(limpo)) v('25', 'formato do dinheiro', el, txt, '−R$ 1.234,56', txt)
    })
    var t = document.createElement('span')
    t.className = 'num'
    t.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:nowrap'
    document.body.appendChild(t)
    t.textContent = '111,11'; var a = t.getBoundingClientRect().width
    t.textContent = '000,00'; var b = t.getBoundingClientRect().width
    t.remove()
    if (!perto(a, b, 0.05)) v('25', '.num: "111,11" e "000,00" com a mesma largura', document.documentElement, r1(a) + ' vs ' + r1(b), 'iguais')
    textosVisiveis(document.body).forEach(function (x) {
      if (/\(–\)|\(-\)|-R\$/.test(x.no.nodeValue)) v('25', 'texto com "(–)", "(-)" ou "-R$"', x.el, x.no.nodeValue.trim(), 'sinal "−" colado ao R$', x.no.nodeValue.trim())
    })
  })

  function ehKpi(el) { return !!el.closest('[data-kpi], .kpi') }
  function tamDigitos(el) {
    var maior = px(cs(el).fontSize)
    textosVisiveis(el).forEach(function (t) { if (/\d/.test(t.no.nodeValue)) maior = Math.max(maior, px(cs(t.el).fontSize)) })
    return Math.round(maior * 100) / 100
  }

  item(26, function (v) {
    visiveis('[data-valor]').forEach(function (el) {
      var tam = tamDigitos(el), txt = textoCompleto(el)
      if (el.closest('[data-amostra]')) return // mostruário de postos do kit
      var heroi = !!el.closest('[data-heroi]'), kpi = ehKpi(el)
      if (!TAM_VALOR.some(function (x) { return perto(tam, x, 0.05) })) v('26', 'tamanho do número na escala', el, tam + 'px', '{34, 28, 22, 17, 15, 14}', txt)
      if (perto(tam, 34, 0.05) && !heroi) v('26', '34px só no herói', el, '34px', 'dentro de [data-heroi]', txt)
      if (tam > 17 + 0.05 && !heroi && !kpi) v('26', 'fora de herói e KPI ≤ 17px', el, tam + 'px', '≤ 17px', txt)
    })
  })

  function grupoColunas(raiz) {
    // agrupa [data-valor] pela linha (data-linha, data-parcela, tr) e mede o right do último de cada linha
    var linhas = todos(':scope > [data-linha], :scope > li > [data-linha], :scope > [data-parcela], :scope tr, :scope > li', raiz).filter(visivel)
    var rights = []
    linhas.forEach(function (ln) {
      if (ln.closest('[data-celulas]')) return
      var vals = visiveis('[data-valor]', ln).filter(function (x) { return !x.closest('[data-celulas], dl, .meta') })
      if (!vals.length) return
      var ult = vals.reduce(function (m, x) { return x.getBoundingClientRect().right > m.getBoundingClientRect().right ? x : m })
      rights.push({ el: ult, right: ult.getBoundingClientRect().right })
    })
    return rights
  }

  /* ---------- Tipografia (27 a 31) ---------- */

  item(27, function (v) {
    var porLista = []
    visiveis('.lista, table').forEach(function (l) {
      var rs = grupoColunas(l)
      if (rs.length < 2) return
      var ref = rs[0].right
      rs.forEach(function (x) {
        if (!perto(x.right, ref, 0.05)) v('27', 'coluna de valor alinhada (right igual)', x.el, r1(x.right - ref) + 'px de diferença', '0px', textoCompleto(x.el))
      })
      var cab = visiveis('[role=columnheader], th', l).pop()
      if (cab && Math.abs(cab.getBoundingClientRect().right - ref) > TOL && /valor|total|R\$/i.test(textoDe(cab)))
        v('27', 'right do cabeçalho numérico = coluna', cab, r1(cab.getBoundingClientRect().right - ref) + 'px', '0px', textoDe(cab))
      porLista.push({ l: l, w: r1(l.getBoundingClientRect().width), right: ref })
    })
    for (var i = 0; i < porLista.length; i++) for (var j = i + 1; j < porLista.length; j++) {
      var a = porLista[i], b = porLista[j]
      var ca = a.l.closest('[data-caixa]'), cb = b.l.closest('[data-caixa]')
      if (!ca || !cb || ca.parentElement !== cb.parentElement) continue // irmãs = cartões da mesma grade
      if (a.l.parentElement && a.w === b.w && a.l.className === b.l.className && Math.abs(a.l.getBoundingClientRect().left - b.l.getBoundingClientRect().left) < 1 && !perto(a.right, b.right, 0.05))
        v('27', 'listas irmãs com a coluna de valor no mesmo right', b.l, r1(b.right - a.right) + 'px', '0px')
    }
  })

  item(28, function (v) {
    visiveis('[data-goteira]').forEach(function (g) {
      var w = g.getBoundingClientRect().width
      if (!perto(w, 28)) v('28', 'goteira com 28px', g, r1(w) + 'px', '28px')
    })
    visiveis('.lista').forEach(function (l) {
      var selos = visiveis('[data-goteira] [data-selo], [data-goteira] .selo', l)
      var tons = visiveis('[data-goteira] [data-icone-tom], [data-goteira] .icone-tom', l)
      if (selos.length && tons.length) v('28', 'lista não mistura Selo e IconeTom', l, selos.length + ' selos + ' + tons.length + ' ícones', 'um tipo só')
      var nums = selos.map(function (s) { return parseInt(textoCompleto(s), 10) }).filter(function (n) { return !isNaN(n) })
      for (var i = 1; i < nums.length; i++) if (nums[i] <= nums[i - 1]) { v('28', 'números dos Selos crescentes', l, nums.join(','), 'crescentes'); break }
    })
  })

  item(29, function (v) {
    var vals = visiveis('[data-valor]').filter(function (x) {
      if (x.closest('table, [data-celulas], dl')) return false
      var forma = x.closest('[data-parcela]')
      if (forma && forma.parentElement && forma.parentElement.querySelector('[role=columnheader], [data-cabecalho-parcelas]')) return false
      return !ancestral(x, '[data-valor]')
    })
    var usados = new Set()
    vals.forEach(function (a) {
      if (usados.has(a)) return
      var ta = a.getBoundingClientRect().top
      var pai = a.closest('[data-linha], [data-parcela], [data-caixa], [role=dialog]') || document.body
      var mesma = vals.filter(function (b) { return (b.closest('[data-linha], [data-parcela], [data-caixa], [role=dialog]') || document.body) === pai && Math.abs(b.getBoundingClientRect().top - ta) <= 4 })
      if (mesma.length >= 3) {
        mesma.forEach(function (b) { usados.add(b) })
        v('29', 'fileira de ≥ 3 valores na mesma faixa', pai, mesma.length + ' valores', '< 3 (usar Demonstrativo/data-celulas)', mesma.map(textoCompleto).join(' | ').slice(0, 80))
      }
    })
    if (W() < 640) visiveis('[data-parcela] dl').forEach(function (dl) {
      if (dl.closest('[data-rolagem]')) return // formas de largura fixa em mostruário rolável
      var vs = visiveis('[data-valor]', dl)
      var r0 = vs[0] && vs[0].getBoundingClientRect()
      vs.slice(1).forEach(function (x, i) {
        var r = x.getBoundingClientRect()
        if (!perto(r.right, r0.right) || perto(r.top, vs[i].getBoundingClientRect().top, 1)) v('29', 'decomposição da parcela em 390: right igual, top diferente', x, 'right ' + r1(r.right - r0.right), '0px e top diferente', textoCompleto(x))
      })
    })
  })

  item(30, function (v) {
    visiveis('[data-linha] h3, [data-linha] .titulo, [data-parcela] h3, [data-parcela] .titulo, [data-linha] > * > :first-child').forEach(function (t) {
      var s = cs(t)
      if (s.textOverflow === 'ellipsis' && s.whiteSpace === 'nowrap' && t.scrollWidth > t.clientWidth + 1) v('30', 'título de linha sem reticência numa linha só', t, 'ellipsis', 'quebra em 2 linhas', textoDe(t))
    })
    if (W() < 640) visiveis('.meta').forEach(function (m) {
      var ml = m.getBoundingClientRect().left
      var filhos = Array.prototype.filter.call(m.children, visivel)
      for (var i = 1; i < filhos.length; i++) {
        var r = filhos[i].getBoundingClientRect(), ant = filhos[i - 1].getBoundingClientRect()
        if (r.top > ant.top + 2 && !perto(r.left, ml)) v('30', 'item da .meta que quebra começa no left da .meta', filhos[i], r1(r.left - ml) + 'px', '0px', textoDe(filhos[i]))
      }
    })
    visiveis('input[placeholder]').forEach(function (inp) {
      var s = cs(inp)
      var sp = document.createElement('span')
      sp.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:pre;font:' + s.font + ';letter-spacing:' + s.letterSpacing
      sp.textContent = inp.placeholder
      document.body.appendChild(sp)
      var w = sp.getBoundingClientRect().width
      sp.remove()
      var util = inp.clientWidth - px(s.paddingLeft) - px(s.paddingRight)
      if (w > util + TOL) v('30', 'placeholder inteiro visível', inp, r1(w) + 'px > ' + r1(util) + 'px', '≤ largura útil', inp.placeholder)
    })
  })

  item(31, function (v, nm) {
    if (CTX.perfil !== 'corretor') { nm('31', 'Só no perfil corretor: logar como corretor e rodar com perfil "corretor".'); return }
    var html = document.documentElement.outerHTML
    if (/Fica para a imobili/i.test(html)) v('31', 'corretor não vê "Fica para a imobiliária"', document.body, 'presente no DOM', 'ausente')
    todos('[aria-label]').forEach(function (el) {
      if (/imobili[aá]ria.*l[ií]quid|l[ií]quid.*imobili/i.test(el.getAttribute('aria-label'))) v('31', 'líquido da imobiliária em aria-label', el, el.getAttribute('aria-label'), 'ausente')
    })
    nm('31', 'Valor líquido da imobiliária sem rótulo: comparar à mão com o valor do admin para a mesma venda (buscar o texto do número no DOM).')
  })

  /* ---------- Toque e movimento (32, 34, 35, 36): o que dá para medir parado ---------- */

  item(32, function (v, nm) {
    var fino = window.matchMedia('(pointer: fine)').matches && W() >= 1024
    var min = fino ? 32 : 44
    visiveis('a[href], button, input:not([type=hidden]), select, [role=tab], [role=radio]').forEach(function (el) {
      if (el.closest('[aria-hidden=true]')) return
      // título de linha clicável: o ::after cobre a linha inteira, o alvo é a linha
      if (el.matches('[data-linha] [data-coluna=titulo] button, [data-linha] [data-coluna=titulo] a, [data-linha] button[data-coluna=titulo], [data-linha] a[data-coluna=titulo]')) return
      var r = el.getBoundingClientRect()
      if (r.width + TOL < min || r.height + TOL < min) v('32', 'alvo ≥ ' + min + '×' + min, el, r1(r.width) + '×' + r1(r.height), '≥ ' + min, textoDe(el))
    })
    visiveis('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select').forEach(function (el) {
      var h = el.getBoundingClientRect().height
      if (!perto(h, 44)) v('32', 'campo com 44px', el, r1(h) + 'px', '44px')
    })
    nm('32', 'Sobreposição entre alvos e alinhamento da faixa: conferir à mão.')
  })

  item(34, function (v) {
    todos('[data-acao]').forEach(function (el) {
      var s = cs(el)
      if (el.getBoundingClientRect().width > 0 && (parseFloat(s.opacity) === 0 || s.visibility === 'hidden')) v('34', 'ação visível sem hover', el, 'opacity ' + s.opacity + ' / ' + s.visibility, 'visível')
    })
    visiveis('[data-clicavel]').forEach(function (el) {
      if (cs(el).cursor !== 'pointer') v('34', '[data-clicavel] com cursor pointer', el, cs(el).cursor, 'pointer')
    })
  })

  item(35, function (v) {
    var ok = { barraEnche: 520, saltoBadge: 500, pulsoEsqueleto: 1400 }
    document.getAnimations().forEach(function (a) {
      var ef = a.effect, alvo = ef && ef.target
      var t = ef && ef.getTiming ? ef.getTiming() : {}
      var dur = typeof t.duration === 'number' ? t.duration : 0
      if (a.animationName) {
        var teto = ok[a.animationName] || 280
        if (a.animationName === 'spin' && alvo && alvo.closest('[aria-busy=true]')) return // Loader2 do botão carregando (7.8)
        if (dur > teto + 1) v('35', 'duração da animação', alvo, a.animationName + ' ' + dur + 'ms', '≤ ' + teto + 'ms')
        var kf = ef.getKeyframes ? ef.getKeyframes() : []
        kf.forEach(function (k) {
          Object.keys(k).forEach(function (p) {
            if (['offset', 'easing', 'composite', 'computedOffset', 'opacity', 'transform'].indexOf(p) < 0)
              v('35', 'keyframe só com opacity/transform', alvo, a.animationName + ': ' + p, 'opacity|transform')
          })
        })
        if (a.animationName === 'pulsoEsqueleto' && alvo && !alvo.closest('[aria-busy=true]')) v('35', 'pulsoEsqueleto só sob aria-busy', alvo, 'sem aria-busy', 'aria-busy=true')
      } else if (a.transitionProperty) {
        var prop = a.transitionProperty
        var cores = ['color', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color']
        if (['opacity', 'transform'].indexOf(prop) < 0) {
          var emLinha = alvo && alvo.closest && alvo.closest('[data-linha], [data-parcela]')
          if (cores.indexOf(prop) < 0 || emLinha) v('35', 'transição permitida', alvo, prop, 'opacity|transform (cor só em controle)')
        }
        if (dur > 280 + 1 && dur !== 520) v('35', 'duração da transição', alvo, prop + ' ' + dur + 'ms', '≤ 280ms')
      }
    })
  })

  item(36, function (v) {
    var raiz = main() || document.body
    todos('*', raiz).forEach(function (el) {
      if (!visivel(el)) return
      if (el.matches(':disabled, [aria-disabled=true]') || el.closest('[aria-busy=true]')) return
      var o = parseFloat(cs(el).opacity)
      if (o < 1 && !(el.parentElement && parseFloat(cs(el.parentElement).opacity) < 1 && el.parentElement !== raiz)) v('36', 'nada invisível depois de montar', el, 'opacity ' + o, '1', textoDe(el))
    })
  })

  /* ---------- Drill-down (42): parte estática ---------- */

  item(42, function (v, nm) {
    visiveis('[data-valor]').forEach(function (el) {
      if (el.closest('form, [role=status], [role=alert], [data-toast], [aria-hidden=true]')) return
      if (el.closest('[data-clicavel], button, a[href], [data-amostra]')) return
      if (el.closest('tfoot')) return // total da Tabela: soma das linhas logo acima, que abrem
      var dlg = el.closest('[role=dialog]')
      if (dlg && (el.closest('dl') || el.closest('footer, [data-rodape]'))) return
      v('42', 'todo número abre (dentro de [data-clicavel], button ou a)', el, 'sem gatilho', 'ValorComOrigem')
    })
    var re = CTX.perfil === 'corretor' ? /\/minhas-vendas\?venda=/ : /\/vendas\/[^/?]+\?parcela=/
    visiveis('[role=dialog] a[href]').forEach(function (a) {
      if (/parcela/i.test(textoCompleto(a)) && !re.test(a.getAttribute('href'))) v('42', 'item de composição que é parcela leva à parcela', a, a.getAttribute('href'), re.source)
    })
    var dialogos = todos('[role=dialog]')
    if (dialogos.length > 1) v('42', 'drill-down deixa 1 [role=dialog] no DOM', dialogos[1], dialogos.length + '', '1')
    nm('42', 'Clicar em cada valor de herói, apoio, ParAgoraPrevisto e linha de corretor: [role=dialog] em ≤ 300ms; dentro do painel, um nível de drill-down mostra "Voltar" e mantém 1 [role=dialog].')
  })

  /* ---------- Por tela (43–56) ---------- */

  function botoesSemMenu(raiz) { return botoesVisiveis(raiz).filter(function (b) { return !ehMenuMais(b) }) }
  function porRotulo(re, raiz) {
    var l = botoesVisiveis(raiz).concat(visiveis('a[href]', raiz)).filter(function (b) { return re.test(rotuloBotao(b)) })
    return l.filter(function (b) { return !l.some(function (o) { return o !== b && o.contains(b) }) })
  }
  function cartaoComTitulo(re) {
    return visiveis('[data-caixa]').filter(function (c) {
      var h = c.querySelector('h2, h3')
      return h && re.test(textoCompleto(h))
    })
  }
  function textoVencid(raiz, n, regra) {
    textosVisiveis(raiz).forEach(function (t) { if (/vencid/i.test(t.no.nodeValue)) v43(n, regra, t.el, t.no.nodeValue) })
  }
  var v43 = null

  item(43, function (v, nm) {
    if (CTX.perfil !== 'admin' || !ehVendaDetalhe()) return
    v43 = function (n, regra, el, txt) { v(n, regra, el, 'presente', 'ausente', txt) }
    var h = cabecalho()
    if (temSeletorMes()) v('43', 'sem seletor de mês', h || document.body, 'presente', 'ausente')
    if (h) botoesSemMenu(h).forEach(function (b) {
      if (!/voltar|tema|apar[eê]ncia|menu|conta|perfil|notifica/i.test(rotuloBotao(b))) v('43', 'sem CTA no cabeçalho', b, 'presente', 'ausente', rotuloBotao(b))
    })
    porRotulo(/cancelar venda/i).forEach(function (b) {
      if (!b.closest('[role=menu]')) v('43', '"Cancelar venda" só dentro do menu "⋯"', b, 'visível', 'no menu')
    })
    var aberto = document.querySelector('aside, nav[data-trilho], [data-trilho]')
    visiveis('[data-parcela]').forEach(function (p) {
      var w = W()
      var cols = (cs(p).gridTemplateColumns || '').split(/\s+/).filter(function (x) { return x && x !== 'none' }).length
      if (w >= 1440 && aberto && cols !== 8) v('43', '[data-parcela] com 8 colunas em 1440', p, cols + ' colunas', '8')
      if (w >= 1280 && w < 1440 && !p.querySelector('[data-celulas]')) v('43', '[data-parcela] com [data-celulas] em 1280', p, 'ausente', 'presente')
      if (w < 640 && !p.querySelector('dl')) v('43', '[data-parcela] com dl em 390', p, 'ausente', 'presente')
      var bs = botoesSemMenu(p).filter(function (b) { return !b.closest('[data-valor]') && !b.querySelector('[data-valor]') })
      if (bs.length > 1) v('43', '≤ 1 botão visível por parcela além do "⋯"', p, bs.length + '', '≤ 1')
      if (!/recebid|repassad|pag[ao]/i.test(textoCompleto(p))) textoVencid(p, '43', 'nenhum "vencid" em parcela a receber')
    })
    var bt = brandText()
    visiveis('[data-heroi] dl [data-valor]').forEach(function (el) {
      if (bt.a > 0 && mesmaCor(cor(cs(el).color), bt, 3)) v('43', 'total do Demonstrativo do herói sem brand-text', el, 'brand-text', 't1')
    })
    nm('43', 'Abrir o menu "⋯" para confirmar que "Cancelar venda" mora nele; medir em 1440 com trilho aberto, 1280 e 390.')
  })

  item(44, function (v, nm) {
    if (CTX.perfil !== 'admin' || rota() !== '/') return
    v43 = function (n, regra, el, txt) { v(n, regra, el, 'presente', 'ausente', txt) }
    porRotulo(/ver a (receber|pagar)/i).forEach(function (b) { v('44', 'sem botões "Ver A receber"/"Ver A pagar"', b, 'presente', 'ausente') })
    var agora = cartaoComTitulo(/^agora/i)[0]
    if (!agora) v('44', 'cartão "Agora" presente', main() || document.body, 'ausente', 'presente')
    else if (!/tudo em dia/i.test(textoCompleto(agora)) && !(/voc[eê] deve/i.test(textoCompleto(agora)) && /conferir/i.test(textoCompleto(agora))))
      v('44', 'cartão "Agora" com "Você deve" e "Conferir" (ou "Tudo em dia")', agora, 'grupos ausentes', 'Você deve + Conferir')
    var grupo = agora && todos('[data-grupo], section, div', agora).filter(function (g) {
      var t = g.querySelector('h3, [data-grupo-titulo], .text-rotulo')
      return t && /^conferir/i.test(textoCompleto(t))
    })[0]
    if (grupo) {
      visiveis('[data-linha]', grupo).forEach(function (l) {
        if (!porRotulo(/^recebi$/i, l).length) v('44', 'item de "Conferir" com "Recebi" visível', l, 'ausente', 'presente')
      })
      textoVencid(grupo, '44', 'nenhum "vencid" em "Conferir"')
    }
    var m = main()
    var ult = m && Array.prototype.filter.call(m.children, visivel).pop()
    if (ult && ult.tagName === 'P') v('44', 'rodapé da página sem parágrafo explicativo', ult, 'p', 'ausente')
    nm('44', 'Se o grupo "Conferir" não foi identificado pelo título, conferir à mão o "Recebi" em cada item.')
  })

  item(45, function (v, nm) {
    if (CTX.perfil !== 'admin' || rota() !== '/receber') return
    v43 = function (n, regra, el, txt) { v(n, regra, el, 'presente', 'ausente', txt) }
    textoVencid(main() || document.body, '45', 'nenhum "vencid" em /receber')
    cartaoComTitulo(/a seguir/i).forEach(function (c) {
      textosVisiveis(c).forEach(function (t) { if (/^\s*prevista\s*$/i.test(t.no.nodeValue)) v('45', '"A seguir" sem chip "Prevista"', t.el, 'presente', 'ausente') })
    })
    visiveis('main [data-linha]').forEach(function (l) {
      if (!porRotulo(/^recebi$/i, l).length) v('45', 'toda linha com "Recebi" visível sem hover', l, 'ausente', 'presente')
    })
    nm('45', 'Clicar em cada filtro rápido e confirmar que o texto do [data-valor] do herói não muda.')
  })

  item(46, function (v, nm) {
    if (CTX.perfil !== 'admin' || rota() !== '/pagar') return
    cartaoComTitulo(/pagar agora/i).forEach(function (c) {
      visiveis('[data-linha]', c).forEach(function (l) { if (/retirada|pr[oó]-labore|s[oó]cio/i.test(textoCompleto(l))) v('46', 'nenhuma retirada do sócio em "Pagar agora"', l, 'presente', 'ausente') })
    })
    var prev = cartaoComTitulo(/previsto/i)[0]
    if (prev) {
      var nomes = visiveis('[data-linha]', prev).map(function (l) { var t = l.querySelector('h3, [data-titulo], .text-corpo, span'); return t ? textoCompleto(t) : textoCompleto(l) })
      var unicos = nomes.filter(function (n, i) { return nomes.indexOf(n) === i })
      if (unicos.length !== nomes.length) v('46', 'uma linha por corretor em "Previsto"', prev, nomes.length + ' linhas / ' + unicos.length + ' nomes', 'iguais')
    }
    nm('46', 'Altura do documento em 1440 ≤ 2,5× a de /receber: medir document.documentElement.scrollHeight nas duas rotas e comparar.')
  })

  item(47, function (v) {
    if (CTX.perfil !== 'admin' || rota() !== '/vendas') return
    var m = main()
    if (!m) return
    var lista = m.querySelector('.lista')
    visiveis('a[data-caixa]', m).forEach(function (k) {
      if (!lista || (k.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING)) v('47', 'nenhum KPI acima da lista', k, 'presente', 'ausente')
    })
    var filtros = visiveis('[role=tab], [role=radio], [aria-pressed]', m)
    var primeiro = Array.prototype.filter.call(m.children, visivel)[0]
    if (filtros.length && primeiro && !primeiro.contains(filtros[0])) v('47', 'filtros rápidos no primeiro filho do <main>', filtros[0], 'fora', 'no primeiro filho')
    if (W() < 640) visiveis('[data-linha]', m).forEach(function (l) {
      var h = l.getBoundingClientRect().height
      if (h > 136 + TOL) v('47', 'linha de venda ≤ 136px em 390', l, r1(h) + 'px', '≤ 136px')
      var meta = l.querySelector('.meta')
      if (meta) {
        var lh = px(cs(meta).lineHeight) || 16
        var linhas = Math.round(meta.getBoundingClientRect().height / lh)
        if (linhas > 2) v('47', 'meta em ≤ 2 linhas', meta, linhas + ' linhas', '≤ 2')
      }
    })
  })

  item(48, function (v, nm) {
    if (CTX.perfil !== 'admin' || rota() !== '/despesas') return
    visiveis('main [data-linha]').forEach(function (l) {
      if (/\b(pag[oa]|recebid[oa]|quitad[oa])\b/i.test(textoCompleto(l))) return
      if (!porRotulo(/^(paguei|recebi)$/i, l).length) v('48', '"Paguei"/"Recebi" visível sem hover', l, 'ausente', 'presente')
    })
    porRotulo(/excluir|apagar|remover|lixeira/i).forEach(function (b) {
      if (!b.closest('[role=menu], [role=dialog], [role=alertdialog]')) v('48', 'excluir só dentro do menu "⋯"', b, 'visível na linha', 'no menu', rotuloBotao(b))
    })
    nm('48', 'Trocar window.confirm por uma função que lança erro e acionar "Excluir" pelo menu "⋯" SEM confirmar no ConfirmDialog (banco de produção).')
  })

  item(49, function (v) {
    if (CTX.perfil !== 'admin' || rota() !== '/corretores') return
    if (cartaoComTitulo(/^produ[cç][aã]o/i).length) v('49', 'nenhum cartão "Produção"', cartaoComTitulo(/^produ[cç][aã]o/i)[0], 'presente', 'ausente')
    var listas = visiveis('main .lista')
    if (listas.length > 1) {
      var nomes = []
      listas.forEach(function (l) { visiveis('[data-linha]', l).forEach(function (x) { var t = x.querySelector('h3, [data-titulo]'); if (t) nomes.push(textoCompleto(t)) }) })
      var rep = nomes.filter(function (n, i) { return nomes.indexOf(n) !== i })
      if (rep.length) v('49', 'cada nome de corretor aparece uma vez', listas[1], rep.slice(0, 3).join(', '), 'uma lista só')
    }
    visiveis('[data-valor]').forEach(function (el) {
      var alvo = el.closest('[data-heroi], [data-linha]') || el
      var rot = el.getAttribute('aria-label') || ''
      var ctx = alvo.querySelector('.text-rotulo')
      if (/vgv/i.test(rot) || (el.closest('[data-heroi]') && ctx && /vgv/i.test(textoCompleto(ctx)))) v('49', 'VGV nunca é [data-valor] (fica em .meta)', el, 'VGV em [data-valor]', '.meta')
    })
  })

  item(50, function (v, nm) {
    if (CTX.perfil !== 'admin' || rota() !== '/relatorios') return
    if (textoVisivelEm(document.body, /saldo em conta/i) || /saldo em conta/i.test(document.body.textContent)) v('50', 'texto "Saldo em conta" não existe', document.body, 'presente', 'ausente')
    var h = document.querySelector('[data-heroi] [data-valor]')
    if (h && !h.closest('[data-clicavel], button, a[href]')) v('50', 'número do herói abre [role=dialog]', h, 'sem gatilho', 'ValorComOrigem')
    if (W() >= 768) visiveis('table').forEach(function (t) {
      var alvo = t.parentElement && t.parentElement.scrollWidth > t.parentElement.clientWidth + 1 ? t.parentElement : t
      if (alvo.scrollWidth > alvo.clientWidth + 1) v('50', 'nenhuma table rolando em ≥ 768', t, alvo.scrollWidth + ' > ' + alvo.clientWidth, 'sem rolagem')
    })
    nm('50', 'Clicar no número do herói (abre [role=dialog]) e abrir a aba Corretores; colunas "A pagar agora" e "Previsto" seguem o que o app faz hoje (Fase 0 pendente).')
  })

  item(51, function (v, nm) {
    if (CTX.perfil !== 'admin' || !/^\/config/.test(rota())) return
    var m = main(), h = cabecalho()
    var corpo = m && Array.prototype.filter.call(m.children, visivel)[0]
    if (corpo) {
      var r = corpo.getBoundingClientRect()
      if (r.width > 720 + TOL) v('51', 'corpo ≤ 720px', corpo, r1(r.width) + 'px', '≤ 720px')
      var ph = h && primeiroDoCabecalho(h)
      if (ph && !perto(r.left, ph.getBoundingClientRect().left)) v('51', 'corpo começa no left do cabeçalho', corpo, r1(r.left) + '', r1(ph.getBoundingClientRect().left) + '')
    }
    var abas = visiveis('[role=tab]')
    if (abas.length > 1) abas.forEach(function (a) { if (!perto(a.getBoundingClientRect().top, abas[0].getBoundingClientRect().top)) v('51', 'abas numa fileira só', a, r1(a.getBoundingClientRect().top) + '', r1(abas[0].getBoundingClientRect().top) + '') })
    visiveis('[role=dialog]').forEach(function (d) {
      if (W() >= 640 && !perto(d.getBoundingClientRect().right, W())) v('51', 'edição em [role=dialog] encostado à direita', d, r1(d.getBoundingClientRect().right) + '', W() + '')
    })
    nm('51', 'Clicar em "Editar" (sem salvar) em cada aba e rodar de novo com o painel aberto.')
  })

  function dialogoCom(re) { return visiveis('[role=dialog]').filter(function (d) { var t = d.querySelector('h1, h2, [id*=titulo]'); return re.test(t ? textoCompleto(t) : (d.getAttribute('aria-label') || '')) })[0] }

  item(52, function (v, nm) {
    var d = dialogoCom(/registrar venda/i)
    if (!d) { if (CTX.perfil === 'admin') nm('52', 'Abrir o painel "Registrar venda" (sem preencher nem registrar) e rodar de novo.'); return }
    var r = d.getBoundingClientRect(), w = W()
    if (w >= 768) {
      if (!perto(r.right, w)) v('52', 'painel com right = viewport', d, r1(r.right) + '', w + '')
      if (Math.abs(r.width - 672) > 1) v('52', 'largura 672 ±1', d, r1(r.width) + 'px', '672px')
    } else if (w < 640 && (Math.abs(r.width - w) > 1 || r.left > 1)) v('52', 'tela cheia em 390', d, r1(r.width) + 'px', w + 'px')
    if (d.querySelector('[data-passos], [aria-label*="passo" i], ol[role=list] [aria-current=step]')) v('52', 'sem indicador de passos', d, 'presente', 'ausente')
    var rod = d.querySelector('footer, [data-rodape]')
    if (!rod || !/fica para a imobili/i.test(textoCompleto(rod))) v('52', 'rodapé com o total "Fica para a imobiliária"', rod || d, 'ausente', 'presente')
    if (d.querySelector('[data-caixa]')) v('52', 'nenhum [data-caixa] dentro', d.querySelector('[data-caixa]'), 'presente', 'ausente')
  })

  item(53, function (v, nm) {
    var d = visiveis('[role=dialog]').filter(function (x) { return !dialogoCom(/registrar venda/i) || x !== dialogoCom(/registrar venda/i) })
      .filter(function (x) { return /composi|origem|como chegamos|de onde vem/i.test(textoCompleto(x.querySelector('h1, h2') || x).slice(0, 120)) || x.querySelector('[data-composicao]') })[0]
    if (!d) { nm('53', 'Clicar no número do herói para abrir a composição e rodar de novo (e um nível de drill-down).'); return }
    var r = d.getBoundingClientRect()
    if (W() >= 640 && Math.abs(r.width - 480) > 1) v('53', 'largura 480 ±1', d, r1(r.width) + 'px', '480px')
    visiveis('[data-linha]', d).forEach(function (l) {
      if (!l.querySelector('[data-valor]')) v('53', 'cada item com valor', l, 'sem [data-valor]', 'origem, situação e valor')
    })
    visiveis('*', d).forEach(function (el) {
      if (el === d) return
      var s = cs(el)
      if (bordas4(s) && !el.matches('button, input, select, textarea, [role=tab], [role=radio]') && !el.closest('[data-valor]')) v('53', 'nenhuma borda nos 4 lados no corpo', el, 'borda 4 lados', 'sem caixa')
    })
  })

  item(54, function (v, nm) {
    if (CTX.perfil !== 'corretor') return
    var r = rota()
    if (r === '/') {
      var el = visiveis('[data-heroi] [data-valor]')[0]
      if (el) { try { sessionStorage.setItem('aceite.aReceberAgora', textoCompleto(el)) } catch (e) { /* sem storage */ } }
      nm('54', 'Anotado o [data-valor] do herói de /; rodar em /recebimentos para comparar.')
    }
    if (r === '/recebimentos') {
      var ant = null
      try { ant = sessionStorage.getItem('aceite.aReceberAgora') } catch (e) { /* sem storage */ }
      var vals = visiveis('main [data-valor]').map(textoCompleto)
      if (ant == null) nm('54', 'Rodar primeiro em / para anotar "A receber agora" e depois aqui.')
      else if (vals.indexOf(ant) < 0) v('54', '"A receber agora" com o mesmo texto em / e em /recebimentos', main() || document.body, vals.slice(0, 3).join(' | '), ant)
      var h = cabecalho()
      if (W() < 640 && h && visiveis('[role=tab], [role=radio], [aria-pressed]', h).length) v('54', 'filtros de /recebimentos fora do cabeçalho fixo em 390', h, 'no cabeçalho', 'no <main>')
    }
    if (r === '/minhas-vendas') {
      if (document.querySelector('.lista .lista')) v('54', 'sem .lista .lista', document.querySelector('.lista .lista'), 'presente', 'ausente')
      if (visiveis('[data-heroi]').length) v('54', 'sem [data-heroi]', visiveis('[data-heroi]')[0], 'presente', 'ausente')
    }
  })

  item(55, function (v, nm) {
    if (rota() !== '/login') return
    var pm = todos('[data-painel-marca]')
    if (!pm.length) v('55', '[data-painel-marca] existe', document.body, 'ausente', 'presente')
    todos('*').forEach(function (el) {
      if (/gradient/.test(cs(el).backgroundImage) && !el.matches('[data-painel-marca]')) v('55', 'só [data-painel-marca] com gradient', el, 'gradient', 'ausente')
    })
    visiveis('input:not([type=hidden]):not([type=checkbox])').forEach(function (i) {
      var h = i.getBoundingClientRect().height
      if (!perto(h, 44)) v('55', 'campos com 44px', i, r1(h) + 'px', '44px')
    })
    var ident = visiveis('input:not([type=password]):not([type=hidden]):not([type=checkbox])')[0]
    if (ident) {
      var lab = ident.id && document.querySelector('label[for="' + ident.id + '"]') || ident.closest('label')
      var txt = lab ? textoCompleto(lab) : (ident.getAttribute('aria-label') || '')
      if (!/^login\b/i.test(txt)) v('55', 'rótulo do identificador é "Login"', lab || ident, txt, 'Login')
    }
    if (W() < 640) porRotulo(/^entrar$/i).forEach(function (b) {
      if (b.getBoundingClientRect().bottom > window.innerHeight + TOL || window.scrollY > 0) v('55', '"Entrar" inteiro dentro de 844px sem rolar', b, r1(b.getBoundingClientRect().bottom) + '', '≤ ' + window.innerHeight)
    })
    nm('55', 'Contraste do texto sobre os dois extremos do degradê: amostrar as cores do gradient de [data-painel-marca] e medir ≥ 4,5:1 contra o texto (nos dois temas).')
  })

  item(56, function (v, nm) {
    if (!/kit(\.html)?$/.test(rota())) return
    var claro = document.documentElement.classList.contains('light')
    var pressionados = visiveis('[aria-pressed]').filter(function (b) { return /claro|escuro|tema|apar[eê]ncia|light|dark/i.test(rotuloBotao(b)) })
    if (!pressionados.length) v('56', 'seletor de aparência com aria-pressed', document.body, 'ausente', 'presente')
    pressionados.forEach(function (b) {
      var ehClaro = /claro|light/i.test(rotuloBotao(b))
      var deveria = ehClaro === claro
      if ((b.getAttribute('aria-pressed') === 'true') !== deveria) v('56', 'aria-pressed="true" na opção igual ao tema de html', b, b.getAttribute('aria-pressed'), String(deveria), rotuloBotao(b))
    })
    var c = document.querySelector('.conteudo')
    if (!c) v('56', 'conteúdo usa .conteudo', document.body, 'ausente', 'presente')
    else if (W() >= 1440 && c.getBoundingClientRect().width <= 900) v('56', '.conteudo com largura > 900px em 1440', c, r1(c.getBoundingClientRect().width) + 'px', '> 900px')
    if (!document.querySelector('[data-marca]')) v('56', 'lockup em [data-marca]', document.body, 'ausente', 'presente')
    nm('56', 'Lockup passa o item 20 nos dois temas: rodar itens [20] no claro e no escuro; conferir cada componente nos dois temas e em 390 (iframe).')
  })

  /* ---------- Execução ---------- */

  var SEM_MEDICAO = {
    33: 'Tab pela rota: exige teclado (medir à mão).',
    37: 'Saída de painel/modal/toast: exige abrir e fechar (medir à mão).',
    38: 'Troca de mês: exige clique (medir à mão na tela).',
    39: 'Movimento reduzido: exige emulateMedia.',
    40: 'Falha: exige bloquear a rede.',
    41: 'Esqueleto: exige latência de rede.',
  }

  window.aceiteVisual = function (opcoes) {
    opcoes = opcoes || {}
    CTX = { perfil: opcoes.perfil || 'admin' }
    var amostra = opcoes.amostra || 30
    var violacoes = [], contagem = {}, naoMedidos = []
    var lista = opcoes.itens ? opcoes.itens.map(String) : Object.keys(ITENS).concat(Object.keys(SEM_MEDICAO))
    lista.forEach(function (n) {
      var fn = ITENS[n]
      if (!fn) { if (SEM_MEDICAO[n]) naoMedidos.push({ item: n, motivo: SEM_MEDICAO[n] }); return }
      var v = function (it, regra, el, medida, esperado, texto) {
        contagem[it] = (contagem[it] || 0) + 1
        if (contagem[it] <= amostra) violacoes.push({ item: it, regra: regra, seletor: seletorDe(el), texto: texto || textoDe(el), medida: medida, esperado: esperado })
      }
      var nm = function (it, motivo) { naoMedidos.push({ item: it, motivo: motivo }) }
      try { fn(v, nm) } catch (e) { naoMedidos.push({ item: n, motivo: 'erro de medição: ' + (e && e.message) }) }
    })
    if (tokensAusentes.length) naoMedidos.push({ item: '-', motivo: 'tokens ausentes no CSS (usado o derivado de 5.1): ' + tokensAusentes.join(', ') })
    return {
      rota: rota(), largura: W(), tema: CLARO ? 'claro' : 'escuro', perfil: CTX.perfil,
      violacoes: violacoes, contagem: contagem, naoMedidos: naoMedidos,
    }
  }
})()
