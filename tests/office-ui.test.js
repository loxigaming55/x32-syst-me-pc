// Test d'interface avec Playwright/Chromium : node tests/office-ui.test.js [dossier-captures]
const { chromium } = require('playwright');
const path = require('path'), assert = require('assert');
const dir = path.resolve(__dirname, '../overlay/usr/share/x32-office');
const shots = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1024, height: 600 }, deviceScaleFactor: 1 });
  const watch = (p) => { p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };

  // ---------- accueil ----------
  let p = await ctx.newPage(); watch(p);
  await p.goto('file://' + dir + '/index.html');
  if (shots) await p.screenshot({ path: shots + '/index.png' });

  // ---------- tableur ----------
  p = await ctx.newPage(); watch(p);
  await p.goto('file://' + dir + '/calc.html');
  const type = async (txt) => { await p.keyboard.type(txt); await p.keyboard.press('Enter'); };
  await type('Produit'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('Tab');
  await type('Prix'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('Tab'); await type('Qté'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('Tab'); await type('Total');
  // lignes de données
  const rows = [['Pommes', '1,5', '10'], ['Poires', '2', '7'], ['Cerises', '12,9', '3']];
  for (let i = 0; i < rows.length; i++) {
    await p.click(`#grid tr:nth-child(${i + 3}) td:nth-child(2)`);
    for (const v of rows[i]) { await p.keyboard.type(v); await p.keyboard.press('Tab'); }
    await p.keyboard.type(`=B${i + 2}*C${i + 2}`); await p.keyboard.press('Enter');
  }
  await p.click('#grid tr:nth-child(6) td:nth-child(2)'); await type('Total général');
  await p.click('#grid tr:nth-child(6) td:nth-child(5)'); await type('=SOMME(D2:D4)');
  const txt = async (r, c) => (await p.$eval(`#grid tr:nth-child(${r + 1}) td:nth-child(${c + 1})`, e => e.textContent));
  assert.strictEqual(await txt(2, 4), '15');
  assert.strictEqual(await txt(3, 4), '14');
  assert.strictEqual(await txt(4, 4), '38,7');
  assert.strictEqual(await txt(5, 4), '67,7');
  // gras + format € sur la colonne des prix, annulation
  await p.click('#grid tr:nth-child(3) td:nth-child(3)'); await p.keyboard.down('Shift'); await p.click('#grid tr:nth-child(5) td:nth-child(3)'); await p.keyboard.up('Shift');
  await p.selectOption('#fmt', '€');
  assert.strictEqual(await txt(2, 2), '1,50 €');
  await p.click('button[title^="Annuler"]'); assert.strictEqual(await txt(2, 2), '1,5');
  await p.click('button[title^="Rétablir"]'); assert.strictEqual(await txt(2, 2), '1,50 €');
  // recopie vers le bas avec décalage de références (Ctrl+D)
  await p.click('#grid tr:nth-child(3) td:nth-child(5)'); await p.keyboard.down('Shift'); await p.click('#grid tr:nth-child(5) td:nth-child(5)'); await p.keyboard.up('Shift');
  await p.keyboard.press('Control+d');
  assert.strictEqual(await txt(4, 4), '38,7');
  // un en-tête en gras + couleur
  await p.click('#grid tr:nth-child(2) td:nth-child(2)'); await p.keyboard.down('Shift'); await p.click('#grid tr:nth-child(2) td:nth-child(5)'); await p.keyboard.up('Shift');
  await p.click('button[title^="Gras"]');
  await p.$eval('input[type=color][title^="Couleur de fond"]', (e) => { e.value = '#cfe0ff'; e.dispatchEvent(new Event('change')); });
  // tri décroissant sur la colonne Total
  await p.click('#grid tr:nth-child(3) td:nth-child(5)'); await p.keyboard.down('Shift'); await p.click('#grid tr:nth-child(5) td:nth-child(5)'); await p.keyboard.up('Shift');
  await p.click('button[title^="Trier la colonne Z"]');
  assert.strictEqual(await txt(2, 1), 'Cerises');
  await p.click('#grid tr:nth-child(2) td:nth-child(2)');
  if (shots) await p.screenshot({ path: shots + '/calc.png' });

  // ---------- texte ----------
  p = await ctx.newPage(); watch(p);
  await p.goto('file://' + dir + '/writer.html');
  await p.click('#page');
  await p.selectOption('#block', 'h1'); await p.keyboard.type('Rapport mensuel'); await p.keyboard.press('Enter');
  await p.selectOption('#block', 'p');
  await p.keyboard.type('Bonjour, ceci est un '); await p.click('button[title^="Gras"]'); await p.keyboard.type('texte en gras'); await p.click('button[title^="Gras"]');
  await p.keyboard.type(' avec un lien et une liste :'); await p.keyboard.press('Enter');
  await p.click('button[title="Liste à puces"]'); await p.keyboard.type('Premier point'); await p.keyboard.press('Enter'); await p.keyboard.type('Deuxième point');
  const html = await p.$eval('#page', e => e.innerHTML);
  assert(/<h1>Rapport mensuel<\/h1>/.test(html), html);
  assert(/<b>texte en gras<\/b>/.test(html), html);
  assert(/<li>Premier point<\/li>/.test(html), html);
  assert((await p.textContent('#count')).includes('mots'));
  // ouverture d'un HTML piégé : scripts et attributs on* retirés
  await p.evaluate(() => X32.openHandler('piege.html', '<html><body><p onclick="alert(1)">Salut</p><script>window.hacked=1</script><img src="x" onerror="window.hacked=2"><a href="javascript:alert(1)">m</a></body></html>'));
  const cleaned = await p.$eval('#page', e => e.innerHTML);
  assert(!/script|onclick|onerror|javascript:/i.test(cleaned), cleaned);
  assert.strictEqual(await p.evaluate(() => window.hacked), undefined);
  await p.evaluate(() => X32.openHandler('demo.html', '<h1>Rapport mensuel</h1><p>Bonjour, ceci est un <b>texte en gras</b> avec une liste :</p><ul><li>Premier point</li><li>Deuxième point</li></ul>'));
  if (shots) await p.screenshot({ path: shots + '/writer.png' });

  await b.close();
  if (errors.length) { console.error('Erreurs JS :', errors); process.exit(1); }
  console.log('interface OK (accueil, tableur, traitement de texte)');
})().catch(e => { console.error(e); process.exit(1); });
