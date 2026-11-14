#!/bin/bash
# Exécuté en root par x32-update APRÈS la copie des fichiers.

chmod +x /usr/local/sbin/x32-* /usr/local/bin/x32-* 2>/dev/null || true

systemctl daemon-reload 2>/dev/null || true
for u in x32-zram x32-cpu x32-firstboot x32-prefetch; do
  systemctl enable "$u.service" >/dev/null 2>&1 || true
done
sysctl --system >/dev/null 2>&1 || true

# Réglages Firefox X32 : recopiés dans l'installation officielle si elle existe
if [ -d /opt/firefox ] && [ -d /usr/share/x32/firefox ]; then
  mkdir -p /opt/firefox/distribution /opt/firefox/defaults/pref
  cp /usr/share/x32/firefox/policies.json /opt/firefox/distribution/policies.json 2>/dev/null || true
  cp /usr/share/x32/firefox/x32-prefs.js  /opt/firefox/defaults/pref/x32-prefs.js 2>/dev/null || true
fi

# Caches de menus / icônes
update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
gtk-update-icon-cache -f /usr/share/icons/hicolor >/dev/null 2>&1 || true
exit 0
