#!/bin/bash
# Exécuté À L'INTÉRIEUR du chroot i386 par build.sh.
# Ne pas lancer sur votre machine !
set -uo pipefail

export DEBIAN_FRONTEND=noninteractive LC_ALL=C INITRD=No
SRC=/tmp/x32
log() { echo "[chroot] $*"; }

# Empêche les paquets de démarrer des services pendant le build
printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d
chmod +x /usr/sbin/policy-rc.d
trap 'rm -f /usr/sbin/policy-rc.d' EXIT

read_list() { grep -vE '^[[:space:]]*(#|$)' "$1" 2>/dev/null || true; }

# ------------------------------------------------------------------ 1. ajouts
# Lignes normales = requises (si l'une échoue, on garde LibreOffice).
# Lignes "@optionnel:" = design, installées une par une sans bloquer le build.
INSTALL_OK=1
REQ=(); OPT=()
while IFS= read -r line; do
  if [[ "$line" == @optionnel:* ]]; then OPT+=("${line#@optionnel:}"); else REQ+=("$line"); fi
done < <(read_list "$SRC/packages-add.txt")

if [ "${X32_SKIP_APT:-0}" = 1 ]; then
  log "X32_SKIP_APT=1 : aucun paquet ajouté"; INSTALL_OK=0
elif [ "${#REQ[@]}" -gt 0 ] || [ "${#OPT[@]}" -gt 0 ]; then
  if ! apt-get update; then
    log "ATTENTION : apt-get update impossible, les paquets d'origine seront conservés"
    INSTALL_OK=0
  else
    if [ "${#REQ[@]}" -gt 0 ]; then
      if apt-get install -y --no-install-recommends "${REQ[@]}"; then
        log "paquets ajoutés : ${REQ[*]}"
      else
        log "ATTENTION : paquets requis non installés, les originaux sont conservés"
        INSTALL_OK=0
      fi
    fi
    for p in "${OPT[@]}"; do
      if apt-get install -y --no-install-recommends "$p"; then log "optionnel ajouté : $p"
      else log "optionnel ignoré : $p"; fi
    done
  fi
fi

# Tout marquer « installé manuellement » : une suppression ne doit JAMAIS
# entraîner de purge en cascade des dépendances (méta-paquets lubuntu-*).
dpkg-query -W -f='${db:Status-Abbrev} ${Package}\n' | awk '$1=="ii"{print $2}' \
  | xargs apt-mark manual >/dev/null 2>&1 || true

# --------------------------------------------------------------- 2. suppressions
installed_matching() {
  dpkg-query -W -f='${db:Status-Abbrev} ${Package}\n' "$1" 2>/dev/null | awk '$1=="ii"{print $2}'
}
TO_REMOVE=()
while IFS= read -r line; do
  pat="$line"
  if [[ "$line" == @remplace:* ]]; then
    pat="${line#@remplace:}"
    [ "$INSTALL_OK" = 1 ] || { log "conservé (pas de remplaçant installé) : $pat"; continue; }
  fi
  while IFS= read -r p; do [ -n "$p" ] && TO_REMOVE+=("$p"); done < <(installed_matching "$pat")
done < <(read_list "$SRC/packages-remove.txt")

if [ "${#TO_REMOVE[@]}" -gt 0 ]; then
  log "suppression de ${#TO_REMOVE[@]} paquets"
  apt-get purge -y "${TO_REMOVE[@]}" || log "ATTENTION : la suppression a échoué (le build continue)"
fi
apt-get clean

# ------------------------------------------------------------ 3. services inutiles
for s in ModemManager.service cups-browsed.service avahi-daemon.service \
         apport.service whoopsie.service motd-news.timer irqbalance.service \
         ondemand.service speech-dispatcher.service; do
  systemctl disable "$s" >/dev/null 2>&1 || true
done

# Services maison (zram, gouverneur CPU, noatime au premier démarrage)
for u in x32-zram.service x32-cpu.service x32-firstboot.service x32-prefetch.service; do
  systemctl enable "$u" >/dev/null 2>&1 \
    || ln -sf "/etc/systemd/system/$u" "/etc/systemd/system/multi-user.target.wants/$u"
done

# Applets de session qui consomment du CPU/RAM (masqués, pas supprimés :
# retirez la ligne Hidden=true pour les réactiver)
for a in blueman update-notifier print-applet orca-autostart geoclue-demo-agent \
         tracker-store tracker-miner-fs tracker-miner-apps tracker-extract \
         zeitgeist-datahub deja-dup-monitor snap-userd-autostart; do
  f="/etc/xdg/autostart/$a.desktop"
  [ -f "$f" ] && ! grep -q '^Hidden=true' "$f" && echo 'Hidden=true' >> "$f"
done

# ---------------------------------------------------------------- 4. interface
# Openbox : pas d'animation à la minimisation
for f in /etc/xdg/openbox/lubuntu-rc.xml /etc/xdg/openbox/rc.xml; do
  [ -f "$f" ] && sed -i 's#<animateIconify>yes#<animateIconify>no#' "$f"
done

# GTK3 : animations et clignotement du curseur désactivés (sans écraser le fichier existant)
mkdir -p /etc/gtk-3.0
touch /etc/gtk-3.0/settings.ini
grep -q '^\[Settings\]' /etc/gtk-3.0/settings.ini || echo '[Settings]' >> /etc/gtk-3.0/settings.ini
for kv in gtk-enable-animations=false gtk-cursor-blink=false; do
  grep -q "^${kv%%=*}=" /etc/gtk-3.0/settings.ini \
    || sed -i "/^\[Settings\]/a $kv" /etc/gtk-3.0/settings.ini
done

# Design (thème, icônes, écran de connexion) : voir chroot-design.sh
[ -f "$SRC/chroot-design.sh" ] && . "$SRC/chroot-design.sh"

# Firefox ESR 140 officiel (installé par build.sh dans /opt/firefox) : si présent,
# on retire le Firefox d'Ubuntu 18.04 (trop ancien) et on met le nouveau par défaut.
if [ -x /opt/firefox/firefox ]; then
  mapfile -t OLDFF < <(installed_matching 'firefox*')
  if [ "${#OLDFF[@]}" -gt 0 ]; then
    log "remplacement de Firefox Ubuntu (${OLDFF[*]}) par Firefox ESR officiel"
    apt-get purge -y "${OLDFF[@]}" || log "ATTENTION : suppression de l'ancien Firefox impossible"
  fi
  ln -sf /opt/firefox/firefox /usr/local/bin/firefox
  update-alternatives --install /usr/bin/x-www-browser x-www-browser /opt/firefox/firefox 200 >/dev/null 2>&1 || true
  update-alternatives --install /usr/bin/gnome-www-browser gnome-www-browser /opt/firefox/firefox 200 >/dev/null 2>&1 || true
  # Entrée de menu (le paquet Ubuntu l'avait fournie)
  if [ ! -f /usr/share/applications/firefox.desktop ]; then
    cat > /usr/share/applications/firefox.desktop <<'DESK'
[Desktop Entry]
Type=Application
Name=Firefox
GenericName=Navigateur web
Comment=Navigateur web (ESR, version allégée X32)
Exec=/opt/firefox/firefox %u
Icon=/opt/firefox/browser/chrome/icons/default/default128.png
Terminal=false
Categories=Network;WebBrowser;
MimeType=text/html;text/xml;application/xhtml+xml;x-scheme-handler/http;x-scheme-handler/https;
StartupWMClass=firefox
DESK
  fi
else
  log "Firefox officiel absent : le Firefox d'Ubuntu est conservé"
fi

# X32 Office : droits, types MIME, menus et icônes
chmod +x /usr/local/bin/x32-* /usr/local/sbin/x32-* 2>/dev/null || true
update-mime-database /usr/share/mime >/dev/null 2>&1 || true
update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
gtk-update-icon-cache -f /usr/share/icons/hicolor >/dev/null 2>&1 || true

# ---------------------------------------------------------------- 5. identité
if [ -f /etc/os-release ]; then
  sed -i 's/^PRETTY_NAME=.*/PRETTY_NAME="X32 Système PC (base Lubuntu 18.04)"/' /etc/os-release 2>/dev/null || true
fi

log "personnalisation terminée"
