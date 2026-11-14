/* X32 Tableur : moteur de formules (sans eval, sans dépendance).
   Syntaxe JS volontairement conservatrice (ES2015) pour les vieux WebKitGTK. */
(function (root) {
  'use strict';

  function XErr(code) { this.code = code; }

  function colToName(c) {            // 0 -> A, 25 -> Z, 26 -> AA
    var s = '';
    c++;
    while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
    return s;
  }
  function nameToCol(s) {
    s = s.toUpperCase(); var n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }
  function parseKey(k) {
    var m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(k);
    if (!m) return null;
    return { c: nameToCol(m[1]), r: parseInt(m[2], 10) - 1 };
  }
  function keyOf(c, r) { return colToName(c) + (r + 1); }

  var NUM_RE = /^\s*[-+]?(\d+([.,]\d+)?|[.,]\d+)([eE][-+]?\d+)?\s*$/;
  function parseNumber(s) {
    if (typeof s === 'number') return s;
    if (typeof s !== 'string' || !NUM_RE.test(s)) return null;
    return parseFloat(s.replace(',', '.'));
  }

  /* ---------- tokenizer ---------- */
  var IDENT_RE = /^[A-Za-z_À-ſ][A-Za-z0-9_.À-ſ]*/;
  var REF_RE = /^\$?[A-Za-z]{1,3}\$?\d+$/;

  function tokenize(src) {
    var t = [], i = 0, m, ch, rest;
    // Si la formule utilise « ; » comme séparateur (style français), la virgule est décimale.
    var decimalComma = /;/.test(src.replace(/"(?:[^"]|"")*"/g, ''));
    while (i < src.length) {
      ch = src[i];
      if (ch === ' ' || ch === '\t') { i++; continue; }
      rest = src.slice(i);
      if (ch === '"') {
        var j = i + 1, str = '';
        while (j < src.length) {
          if (src[j] === '"') { if (src[j + 1] === '"') { str += '"'; j += 2; continue; } break; }
          str += src[j++];
        }
        if (j >= src.length) throw new XErr('#ERR!');
        t.push({ t: 'str', v: str }); i = j + 1; continue;
      }
      m = (decimalComma ? /^(\d+([.,]\d+)?|[.,]\d+)([eE][-+]?\d+)?/ : /^(\d+([.]\d+)?|[.]\d+)([eE][-+]?\d+)?/).exec(rest);
      if (m) { t.push({ t: 'num', v: parseFloat(m[0].replace(',', '.')) }); i += m[0].length; continue; }
      m = IDENT_RE.exec(rest);
      if (m) {
        var id = m[0], after = src[i + id.length];
        // ref ou plage : A1, $B$2, A1:B9
        if (REF_RE.test(id) && after !== '(') {
          var rg = /^(\$?[A-Za-z]{1,3}\$?\d+):(\$?[A-Za-z]{1,3}\$?\d+)/.exec(rest);
          if (rg) { t.push({ t: 'range', a: rg[1], b: rg[2] }); i += rg[0].length; continue; }
          t.push({ t: 'ref', v: id }); i += id.length; continue;
        }
        t.push({ t: after === '(' ? 'func' : 'name', v: id }); i += id.length; continue;
      }
      m = /^\$?[A-Za-z]{1,3}\$?\d+:\$?[A-Za-z]{1,3}\$?\d+/.exec(rest);
      if (m) { var p = m[0].split(':'); t.push({ t: 'range', a: p[0], b: p[1] }); i += m[0].length; continue; }
      m = /^(<=|>=|<>|[-+*\/^&=<>%(),;])/.exec(rest);
      if (m) { t.push({ t: 'op', v: m[0] }); i += m[0].length; continue; }
      throw new XErr('#ERR!');
    }
    return t;
  }

  /* ---------- parser -> AST ---------- */
  function parse(src) {
    var toks = tokenize(src), p = 0;
    function peek() { return toks[p]; }
    function isOp(v) { var k = toks[p]; return k && k.t === 'op' && k.v === v; }
    function next() { return toks[p++]; }
    function expect(v) { if (!isOp(v)) throw new XErr('#ERR!'); p++; }

    function cmp() {
      var l = concat();
      while (peek() && peek().t === 'op' && /^(=|<>|<|>|<=|>=)$/.test(peek().v)) {
        var op = next().v; l = { k: 'bin', op: op, l: l, r: concat() };
      }
      return l;
    }
    function concat() {
      var l = add();
      while (isOp('&')) { next(); l = { k: 'bin', op: '&', l: l, r: add() }; }
      return l;
    }
    function add() {
      var l = mul();
      while (isOp('+') || isOp('-')) { var op = next().v; l = { k: 'bin', op: op, l: l, r: mul() }; }
      return l;
    }
    function mul() {
      var l = pow();
      while (isOp('*') || isOp('/')) { var op = next().v; l = { k: 'bin', op: op, l: l, r: pow() }; }
      return l;
    }
    function pow() {
      var l = unary();
      while (isOp('^')) { next(); l = { k: 'bin', op: '^', l: l, r: unary() }; }
      return l;
    }
    function unary() {
      if (isOp('-')) { next(); return { k: 'neg', e: unary() }; }
      if (isOp('+')) { next(); return unary(); }
      return postfix();
    }
    function postfix() {
      var e = primary();
      while (isOp('%')) { next(); e = { k: 'pct', e: e }; }
      return e;
    }
    function primary() {
      var k = next();
      if (!k) throw new XErr('#ERR!');
      if (k.t === 'num') return { k: 'num', v: k.v };
      if (k.t === 'str') return { k: 'str', v: k.v };
      if (k.t === 'ref') return { k: 'ref', v: k.v };
      if (k.t === 'range') return { k: 'range', a: k.a, b: k.b };
      if (k.t === 'name') {
        var u = k.v.toUpperCase();
        if (u === 'TRUE' || u === 'VRAI') return { k: 'bool', v: true };
        if (u === 'FALSE' || u === 'FAUX') return { k: 'bool', v: false };
        throw new XErr('#NOM?');
      }
      if (k.t === 'func') {
        expect('(');
        var args = [];
        if (!isOp(')')) {
          args.push(cmp());
          while (isOp(',') || isOp(';')) { next(); args.push(cmp()); }
        }
        expect(')');
        return { k: 'func', n: k.v.toUpperCase(), a: args };
      }
      if (k.t === 'op' && k.v === '(') { var e = cmp(); expect(')'); return e; }
      throw new XErr('#ERR!');
    }
    var ast = cmp();
    if (p < toks.length) throw new XErr('#ERR!');
    return ast;
  }

  /* ---------- fonctions ---------- */
  function flat(vals) {            // aplatit plages et valeurs en liste
    var out = [];
    for (var i = 0; i < vals.length; i++) {
      if (vals[i] && vals[i].range) { for (var j = 0; j < vals[i].range.length; j++) out.push({ v: vals[i].range[j], inRange: true }); }
      else out.push({ v: vals[i], inRange: false });
    }
    return out;
  }
  function numsOf(vals) {          // nombres d'une liste (texte/vide ignorés dans les plages)
    var out = [], l = flat(vals);
    for (var i = 0; i < l.length; i++) {
      var v = l[i].v;
      if (typeof v === 'number') out.push(v);
      else if (typeof v === 'boolean') { if (!l[i].inRange) out.push(v ? 1 : 0); }
      else if (typeof v === 'string' && v !== '' && !l[i].inRange) { var n = parseNumber(v); if (n === null) throw new XErr('#VALEUR!'); out.push(n); }
    }
    return out;
  }
  function toNum(v) {
    if (v && v.range) v = v.range[0];
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v === '' || v === null || v === undefined) return 0;
    var n = parseNumber(v); if (n === null) throw new XErr('#VALEUR!'); return n;
  }
  function toStr(v) {
    if (v && v.range) v = v.range[0];
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
    if (typeof v === 'number') return String(+v.toPrecision(12)).replace('.', ',');
    return String(v);
  }
  function toBool(v) {
    if (v && v.range) v = v.range[0];
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') { var u = v.toUpperCase(); if (u === 'VRAI' || u === 'TRUE') return true; if (u === 'FAUX' || u === 'FALSE' || u === '') return false; }
    throw new XErr('#VALEUR!');
  }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  var FN = {
    SUM: function (a) { return sum(numsOf(a)); },
    AVERAGE: function (a) { var n = numsOf(a); if (!n.length) throw new XErr('#DIV/0!'); return sum(n) / n.length; },
    MIN: function (a) { var n = numsOf(a); return n.length ? Math.min.apply(null, n) : 0; },
    MAX: function (a) { var n = numsOf(a); return n.length ? Math.max.apply(null, n) : 0; },
    COUNT: function (a) {
      var l = flat(a), c = 0;
      for (var i = 0; i < l.length; i++) { if (typeof l[i].v === 'number') c++; else if (!l[i].inRange && typeof l[i].v === 'string' && parseNumber(l[i].v) !== null) c++; }
      return c;
    },
    COUNTA: function (a) { var l = flat(a), c = 0; for (var i = 0; i < l.length; i++) if (l[i].v !== '' && l[i].v !== null) c++; return c; },
    PRODUCT: function (a) { var n = numsOf(a), p = 1; for (var i = 0; i < n.length; i++) p *= n[i]; return p; },
    ROUND: function (a) { var n = toNum(a[0]), d = a.length > 1 ? toNum(a[1]) : 0, f = Math.pow(10, d); return Math.round((n + (n < 0 ? -1e-12 : 1e-12)) * f) / f; },
    ABS: function (a) { return Math.abs(toNum(a[0])); },
    SQRT: function (a) { var n = toNum(a[0]); if (n < 0) throw new XErr('#NOMBRE!'); return Math.sqrt(n); },
    POWER: function (a) { return Math.pow(toNum(a[0]), toNum(a[1])); },
    MOD: function (a) { var d = toNum(a[1]); if (d === 0) throw new XErr('#DIV/0!'); var n = toNum(a[0]); return n - d * Math.floor(n / d); },
    INT: function (a) { return Math.floor(toNum(a[0])); },
    PI: function () { return Math.PI; },
    AND: function (a) { var l = flat(a); for (var i = 0; i < l.length; i++) if (!toBool(l[i].v)) return false; return true; },
    OR: function (a) { var l = flat(a); for (var i = 0; i < l.length; i++) if (toBool(l[i].v)) return true; return false; },
    NOT: function (a) { return !toBool(a[0]); },
    CONCAT: function (a) { var l = flat(a), s = ''; for (var i = 0; i < l.length; i++) s += toStr(l[i].v); return s; },
    LEN: function (a) { return toStr(a[0]).length; },
    UPPER: function (a) { return toStr(a[0]).toUpperCase(); },
    LOWER: function (a) { return toStr(a[0]).toLowerCase(); },
    TODAY: function () { var d = new Date(); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
  };
  var ALIAS = { SOMME: 'SUM', MOYENNE: 'AVERAGE', NB: 'COUNT', NBVAL: 'COUNTA', PRODUIT: 'PRODUCT', ARRONDI: 'ROUND',
    RACINE: 'SQRT', PUISSANCE: 'POWER', ENT: 'INT', ET: 'AND', OU: 'OR', NON: 'NOT', CONCATENER: 'CONCAT',
    NBCAR: 'LEN', MAJUSCULE: 'UPPER', MINUSCULE: 'LOWER', AUJOURDHUI: 'TODAY' };

  /* ---------- feuille ---------- */
  function Sheet() { this.cells = {}; this.cache = {}; this.asts = {}; this.stack = {}; }

  Sheet.prototype.setRaw = function (key, raw) {
    if (raw === '' || raw === null || raw === undefined) delete this.cells[key]; else this.cells[key] = String(raw);
    this.cache = {};
  };
  Sheet.prototype.getRaw = function (key) { return this.cells.hasOwnProperty(key) ? this.cells[key] : ''; };

  // Valeur calculée : nombre | texte | booléen | XErr
  Sheet.prototype.valueOf = function (key) {
    key = key.replace(/\$/g, '').toUpperCase();
    if (this.cache.hasOwnProperty(key)) return this.cache[key];
    var raw = this.getRaw(key), v;
    if (raw.charAt(0) === '=') {
      if (this.stack[key]) return new XErr('#CIRC!');
      this.stack[key] = true;
      try { v = this.evalAst(this.ast(raw.slice(1))); if (v && v.range) v = v.range[0]; }
      catch (e) { v = (e instanceof XErr) ? e : new XErr('#ERR!'); }
      delete this.stack[key];
    } else {
      var n = parseNumber(raw);
      v = (n !== null) ? n : raw;
    }
    this.cache[key] = v;
    return v;
  };

  Sheet.prototype.ast = function (src) {
    if (!this.asts.hasOwnProperty(src)) this.asts[src] = parse(src);
    return this.asts[src];
  };

  Sheet.prototype.cellVal = function (key) {
    var v = this.valueOf(key);
    if (v instanceof XErr) throw v;
    return v;
  };

  Sheet.prototype.evalAst = function (n) {
    var self = this;
    switch (n.k) {
      case 'num': case 'str': case 'bool': return n.v;
      case 'ref': return this.cellVal(n.v);
      case 'range': {
        var a = parseKey(n.a), b = parseKey(n.b);
        if (!a || !b) throw new XErr('#REF!');
        var c1 = Math.min(a.c, b.c), c2 = Math.max(a.c, b.c), r1 = Math.min(a.r, b.r), r2 = Math.max(a.r, b.r);
        if ((c2 - c1 + 1) * (r2 - r1 + 1) > 200000) throw new XErr('#REF!');
        var out = [];
        for (var r = r1; r <= r2; r++) for (var c = c1; c <= c2; c++) out.push(this.cellVal(keyOf(c, r)));
        return { range: out };
      }
      case 'neg': return -toNum(this.evalAst(n.e));
      case 'pct': return toNum(this.evalAst(n.e)) / 100;
      case 'bin': {
        var l = this.evalAst(n.l), r2v = this.evalAst(n.r);
        switch (n.op) {
          case '+': return toNum(l) + toNum(r2v);
          case '-': return toNum(l) - toNum(r2v);
          case '*': return toNum(l) * toNum(r2v);
          case '/': { var d = toNum(r2v); if (d === 0) throw new XErr('#DIV/0!'); return toNum(l) / d; }
          case '^': return Math.pow(toNum(l), toNum(r2v));
          case '&': return toStr(l) + toStr(r2v);
          default: return compare(n.op, l, r2v);
        }
      }
      case 'func': {
        var name = ALIAS[n.a === undefined ? '' : n.n] || n.n;
        if (name === 'IF' || name === 'SI') {
          if (n.a.length < 2) throw new XErr('#ERR!');
          if (toBool(this.evalAst(n.a[0]))) return this.evalAst(n.a[1]);
          return n.a.length > 2 ? this.evalAst(n.a[2]) : false;
        }
        if (name === 'IFERROR' || name === 'SIERREUR') {
          try { var rv = this.evalAst(n.a[0]); return rv; } catch (e) { if (e instanceof XErr) return n.a.length > 1 ? this.evalAst(n.a[1]) : ''; throw e; }
        }
        var f = FN[name];
        if (!f) throw new XErr('#NOM?');
        var args = [];
        for (var i = 0; i < n.a.length; i++) args.push(self.evalAst(n.a[i]));
        return f(args);
      }
    }
    throw new XErr('#ERR!');
  };

  function compare(op, a, b) {
    if (a && a.range) a = a.range[0];
    if (b && b.range) b = b.range[0];
    var x, y;
    if (typeof a === 'string' || typeof b === 'string') {
      var an = parseNumber(a), bn = parseNumber(b);
      if (an !== null && bn !== null) { x = an; y = bn; } else { x = toStr(a).toLowerCase(); y = toStr(b).toLowerCase(); }
    } else { x = toNum(a); y = toNum(b); }
    switch (op) {
      case '=': return x === y; case '<>': return x !== y;
      case '<': return x < y; case '>': return x > y;
      case '<=': return x <= y; default: return x >= y;
    }
  }

  // Décale les références relatives d'une formule (copier-coller, recopie vers le bas)
  function shiftFormula(raw, dc, dr) {
    if (raw.charAt(0) !== '=') return raw;
    var parts = raw.split(/("(?:[^"]|"")*")/);
    for (var i = 0; i < parts.length; i += 2) {
      parts[i] = parts[i].replace(/(^|[^A-Za-z0-9_.])(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g,
        function (m, pre, d1, col, d2, row) {
          var c = nameToCol(col), r = parseInt(row, 10) - 1;
          if (!d1) c += dc;
          if (!d2) r += dr;
          if (c < 0 || r < 0) return pre + '#REF!';
          return pre + d1 + colToName(c) + d2 + (r + 1);
        });
    }
    return parts.join('');
  }

  var api = { Sheet: Sheet, XErr: XErr, colToName: colToName, nameToCol: nameToCol, parseKey: parseKey,
    keyOf: keyOf, parseNumber: parseNumber, shiftFormula: shiftFormula, toStr: toStr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.X32Calc = api;
})(typeof window !== 'undefined' ? window : this);
