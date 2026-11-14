/* X32 Office : pont entre les pages et le lanceur natif (fichiers, impression).
   Fonctionne aussi dans un navigateur normal (téléchargement / sélecteur de fichier). */
(function () {
  'use strict';
  var native = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.x32);
  var X32 = window.X32 = { native: native, dirty: false, openHandler: null, _saveCb: null };

  function post(m) { window.webkit.messageHandlers.x32.postMessage(JSON.stringify(m)); }

  X32.save = function (name, mime, text, cb) {
    X32._saveCb = cb || null;
    if (native) { post({ action: 'save', name: name, mime: mime, content: text }); return; }
    var blob = new Blob([text], { type: mime + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    X32._saved(name);
  };
  X32._saved = function (name) { if (X32._saveCb) X32._saveCb(name); X32._saveCb = null; };

  X32.open = function (accept) {
    if (native) { post({ action: 'open', accept: accept }); return; }
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { X32.receive(f.name, String(rd.result)); };
      rd.readAsText(f);
    };
    inp.click();
  };
  X32.receive = function (name, text) { if (X32.openHandler) X32.openHandler(name, text); };

  X32.print = function () { if (native) post({ action: 'print' }); else window.print(); };
  X32.quit = function () { if (native) post({ action: 'quit' }); else window.close(); };
  X32.home = function () { location.href = 'index.html'; };

  var tt;
  X32.toast = function (msg) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 't'; t.className = 'toast'; t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('show'); }, 2200);
  };

  // Petite boîte de dialogue (prompt()/confirm() ne sont pas fiables selon le moteur web)
  X32.ask = function (label, def, cb, opts) {
    opts = opts || {};
    var back = document.createElement('div'); back.className = 'modal-back show';
    var m = document.createElement('div'); m.className = 'modal';
    var p = document.createElement('p'); p.textContent = label; m.appendChild(p);
    var inp = null;
    if (!opts.confirm) { inp = document.createElement('input'); inp.type = 'text'; inp.value = def || ''; m.appendChild(inp); }
    var row = document.createElement('div'); row.className = 'row';
    var no = document.createElement('button'); no.className = 'btn'; no.textContent = opts.no || 'Annuler';
    var ok = document.createElement('button'); ok.className = 'btn primary'; ok.textContent = opts.yes || 'OK';
    row.appendChild(no); row.appendChild(ok); m.appendChild(row); back.appendChild(m); document.body.appendChild(back);
    function close(v) { back.remove(); if (v !== null) cb(v); }
    ok.onclick = function () { close(inp ? inp.value : true); };
    no.onclick = function () { close(null); };
    back.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); ok.onclick(); }
      if (e.key === 'Escape') { e.preventDefault(); no.onclick(); }
    });
    (inp || ok).focus(); if (inp) inp.select();
  };

  // Évite de perdre le travail en cours (le lanceur interroge X32.dirty à la fermeture)
  window.addEventListener('beforeunload', function (e) { if (X32.dirty && !native) { e.preventDefault(); e.returnValue = ''; } });

  // Pas de navigation vers l'extérieur depuis un document
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (a && /^https?:/i.test(a.getAttribute('href')) && document.getElementById('page') && document.getElementById('page').contains(a)) {
      if (!(e.ctrlKey || e.metaKey)) e.preventDefault();   // en édition : clic = placer le curseur
    }
  });
})();
