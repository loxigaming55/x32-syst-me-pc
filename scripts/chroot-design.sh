# Sourcé par chroot-customize.sh (dans le chroot). Applique le design visuel.
# Tout est conditionnel : si arc-theme / papirus n'ont pas pu être installés,
# le thème Lubuntu d'origine est conservé. Aucun effet de composition (pas de
# transparence ni d'ombres) : le rendu reste léger pour l'Atom.

set_ini() {  # set_ini fichier clé valeur  (dans la section [GTK])
  local f="$1" k="$2" v="$3"
  mkdir -p "$(dirname "$f")"; touch "$f"
  grep -q '^\[GTK\]' "$f" || printf '[GTK]\n' >> "$f"
  if grep -q "^$k=" "$f"; then sed -i "s#^$k=.*#$k=$v#" "$f"
  else sed -i "/^\[GTK\]/a $k=$v" "$f"; fi
}

GTK_THEME=""; ICON_THEME=""
[ -d /usr/share/themes/Arc-Dark/gtk-3.0 ] && GTK_THEME="Arc-Dark"
[ -d /usr/share/icons/Papirus-Dark ]      && ICON_THEME="Papirus-Dark"
[ -z "$ICON_THEME" ] && [ -d /usr/share/icons/Papirus ] && ICON_THEME="Papirus"
log "design : thème='${GTK_THEME:-défaut}' icônes='${ICON_THEME:-défaut}'"

# Session LXDE : thème GTK2, icônes, police
for conf in /etc/xdg/lxsession/Lubuntu/desktop.conf /etc/xdg/lxsession/LXDE/desktop.conf; do
  [ -f "$conf" ] || continue
  [ -n "$GTK_THEME" ]  && set_ini "$conf" sNet/ThemeName "$GTK_THEME"
  [ -n "$ICON_THEME" ] && set_ini "$conf" sNet/IconThemeName "$ICON_THEME"
  set_ini "$conf" sGtk/FontName "Ubuntu 10"
done

# GTK3
for kv in "gtk-theme-name=$GTK_THEME" "gtk-icon-theme-name=$ICON_THEME" "gtk-font-name=Ubuntu 10"; do
  [ -n "${kv#*=}" ] || continue
  if grep -q "^${kv%%=*}=" /etc/gtk-3.0/settings.ini; then
    sed -i "s#^${kv%%=*}=.*#$kv#" /etc/gtk-3.0/settings.ini
  else
    sed -i "/^\[Settings\]/a $kv" /etc/gtk-3.0/settings.ini
  fi
done

# Fenêtres Openbox assorties (thème fourni par arc-theme)
if [ -d /usr/share/themes/Arc-Dark/openbox-3 ]; then
  for f in /etc/xdg/openbox/lubuntu-rc.xml /etc/xdg/openbox/rc.xml; do
    [ -f "$f" ] || continue
    sed -i '/<theme>/,/<\/theme>/ s#<name>[^<]*</name>#<name>Arc-Dark</name>#' "$f"
  done
fi

# Écran de connexion (lightdm-gtk-greeter)
mkdir -p /etc/lightdm
{
  echo "[greeter]"
  echo "background=/usr/share/backgrounds/x32/x32-wallpaper.jpg"
  [ -n "$GTK_THEME" ]  && echo "theme-name=$GTK_THEME"
  [ -n "$ICON_THEME" ] && echo "icon-theme-name=$ICON_THEME"
  echo "font-name=Ubuntu 10"
  echo "indicators=~host;~spacer;~clock;~spacer;~session;~language;~a11y;~power"
} > /etc/lightdm/lightdm-gtk-greeter.conf

# Pas d'activation de l'écran de veille graphique
rm -f /etc/xdg/autostart/xscreensaver.desktop 2>/dev/null || true
