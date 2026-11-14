// X32 Système PC : valeurs par défaut de Firefox pour un petit processeur (Atom N450, 1-2 Go).
// Ce sont des valeurs PAR DÉFAUT : vous pouvez les changer dans about:config ou les
// supprimer en éditant ce fichier (/opt/firefox/defaults/pref/x32-prefs.js, recréé à chaque
// mise à jour depuis /usr/share/x32/firefox/x32-prefs.js).

// --- Démarrage plus rapide ---
pref("browser.startup.homepage", "about:blank");
pref("browser.startup.page", 1);
pref("browser.aboutwelcome.enabled", false);
pref("browser.shell.checkDefaultBrowser", false);
pref("browser.sessionstore.restore_on_demand", true);   // onglets restaurés un par un
pref("browser.sessionstore.restore_pinned_tabs_on_demand", true);
pref("browser.sessionstore.interval", 120000);           // sauvegarde de session toutes les 2 min
pref("browser.tabs.unloadOnLowMemory", true);
pref("browser.newtabpage.activity-stream.feeds.topsites", false);
pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
pref("browser.newtabpage.activity-stream.showSponsored", false);
pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);

// --- Processus et mémoire : un seul processus de contenu ---
pref("dom.ipc.processCount", 1);
pref("dom.ipc.processCount.webIsolated", 1);
pref("dom.ipc.processPrelaunch.enabled", false);
pref("dom.ipc.processPrelaunch.fission.number", 0);
pref("dom.ipc.keepProcessesAlive.web", 0);
pref("browser.sessionhistory.max_total_viewers", 1);
pref("browser.cache.disk.enable", false);                // disque lent : cache en mémoire
pref("browser.cache.memory.enable", true);
pref("browser.cache.memory.capacity", 49152);            // 48 Mo

// --- Moins de CPU en tâche de fond ---
pref("toolkit.cosmeticAnimations.enabled", false);
pref("browser.tabs.animate", false);
pref("browser.fullscreen.animate", false);
pref("browser.download.animateNotifications", false);
pref("general.smoothScroll", false);
pref("ui.prefersReducedMotion", 1);
pref("media.autoplay.default", 5);                       // pas de lecture automatique
pref("media.hardware-video-decoding.enabled", false);
pref("dom.webnotifications.enabled", false);
pref("dom.push.enabled", false);
pref("network.prefetch-next", false);
pref("network.dns.disablePrefetch", true);
pref("network.predictor.enabled", false);
pref("browser.urlbar.suggest.quicksuggest.nonsponsored", false);
pref("browser.urlbar.suggest.quicksuggest.sponsored", false);
pref("browser.urlbar.suggest.trending", false);
pref("browser.search.suggest.enabled", false);

// --- Pas de remontées de données ni de campagnes ---
pref("datareporting.healthreport.uploadEnabled", false);
pref("datareporting.policy.dataSubmissionEnabled", false);
pref("toolkit.telemetry.enabled", false);
pref("toolkit.telemetry.unified", false);
pref("app.shield.optoutstudies.enabled", false);
pref("app.normandy.enabled", false);
pref("extensions.pocket.enabled", false);
pref("browser.ping-centre.telemetry", false);
