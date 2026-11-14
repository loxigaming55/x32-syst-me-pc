const assert = require('assert');
const E = require('../overlay/usr/share/x32-office/calc-engine.js');
function run(cells) { const s = new E.Sheet(); for (const k in cells) s.setRaw(k, cells[k]); return s; }
function val(s, k) { const v = s.valueOf(k); return v instanceof E.XErr ? v.code : v; }

let s = run({ A1: '1', A2: '2', A3: '3,5', B1: '=SUM(A1:A3)', B2: '=A1+A2*A3', B3: '=(A1+A2)*A3', B4: '=2^3^2', B5: '=-A1^2' });
assert.strictEqual(val(s, 'B1'), 6.5);
assert.strictEqual(val(s, 'B2'), 8);
assert.strictEqual(val(s, 'B3'), 10.5);
assert.strictEqual(val(s, 'B4'), 64);          // associativité gauche (comme Excel)
assert.strictEqual(val(s, 'B5'), 1);           // -1^2 = (-1)^2 comme Excel

s = run({ A1: '10', A2: '0', B1: '=A1/A2', B2: '=IF(A1>5;"grand";"petit")', B3: '=SI(A1<5,1,2)', B4: '=SIERREUR(A1/A2;"x")',
  B5: '="a"&"b"&A1', B6: '=SOMME(A1:A2)', B7: '=MOYENNE(A1:A2)', B8: '=ARRONDI(2,345;2)', B9: '=NB(A1:A2)', C1: '=C2', C2: '=C1', C3: '=A1%', C4: '=FOO(1)', C5: '=1+', C6: '=MAX(A1:A2;3)' });
assert.strictEqual(val(s, 'B1'), '#DIV/0!');
assert.strictEqual(val(s, 'B2'), 'grand');
assert.strictEqual(val(s, 'B3'), 2);
assert.strictEqual(val(s, 'B4'), 'x');
assert.strictEqual(val(s, 'B5'), 'ab10');
assert.strictEqual(val(s, 'B6'), 10);
assert.strictEqual(val(s, 'B7'), 5);
assert.strictEqual(val(s, 'B8'), 2.35);
assert.strictEqual(val(s, 'B9'), 2);
assert.strictEqual(val(s, 'C1'), '#CIRC!');
assert.strictEqual(val(s, 'C2'), '#CIRC!');
assert.strictEqual(val(s, 'C3'), 0.1);
assert.strictEqual(val(s, 'C4'), '#NOM?');
assert.strictEqual(val(s, 'C5'), '#ERR!');
assert.strictEqual(val(s, 'C6'), 10);

// texte ignoré dans les plages, erreurs propagées, vides
s = run({ A1: 'titre', A2: '4', A3: '', A4: '6', B1: '=SUM(A1:A4)', B2: '=A1+1', B3: '=B2+1', B4: '=COUNTA(A1:A4)' });
assert.strictEqual(val(s, 'B1'), 10);
assert.strictEqual(val(s, 'B2'), '#VALEUR!');
assert.strictEqual(val(s, 'B3'), '#VALEUR!');
assert.strictEqual(val(s, 'B4'), 3);

// modification -> recalcul
s = run({ A1: '1', B1: '=A1*2' }); assert.strictEqual(val(s, 'B1'), 2);
s.setRaw('A1', '5'); assert.strictEqual(val(s, 'B1'), 10);

// décalage de références
assert.strictEqual(E.shiftFormula('=A1+$B$2+C$3', 1, 1), '=B2+$B$2+D$3'.replace('D$3', 'D$3'));
assert.strictEqual(E.shiftFormula('=SUM(A1:A3)&"A1"', 0, 2), '=SUM(A3:A5)&"A1"');
assert.strictEqual(E.shiftFormula('=LOG10(A1)', 0, 1), '=LOG10(A2)');
assert.strictEqual(E.shiftFormula('texte A1', 1, 1), 'texte A1');
assert.strictEqual(E.colToName(0), 'A'); assert.strictEqual(E.colToName(26), 'AA'); assert.strictEqual(E.nameToCol('AB'), 27);

// performance : 100 x 26 cellules avec formules
s = new E.Sheet();
for (let r = 1; r <= 100; r++) { for (let c = 0; c < 25; c++) s.setRaw(E.keyOf(c, r - 1), String(r * c)); s.setRaw('Z' + r, `=SUM(A${r}:Y${r})`); }
const t0 = Date.now(); for (let r = 1; r <= 100; r++) s.valueOf('Z' + r); const dt = Date.now() - t0;
assert.strictEqual(val(s, 'Z2'), 2 * 300);
console.log('moteur OK, 100 sommes de 25 cellules en', dt, 'ms');
