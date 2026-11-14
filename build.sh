#!/usr/bin/env bash
# Compile l'ISO « X32 Système PC » (32 bits) à partir de Lubuntu 18.04.5 i386.
# À lancer sur une machine Debian/Ubuntu (ou dans GitHub Actions) :
#     sudo ./build.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.env
. "$ROOT/config.env"

VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"
WORK="${WORK:-$ROOT/work}"
OUT="${OUT:-$ROOT/out}"
ISO_SRC="$WORK/$BASE_ISO_NAME"
ISO_TREE="$WORK/iso"
CHROOT="$WORK/chroot"
OUT_ISO="$OUT/${OUT_PREFIX}-${VERSION}-i386.iso"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mAttention : %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mErreur : %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "lancez ce script en root : sudo ./build.sh"

missing=()
for c in xorriso unsquashfs mksquashfs wget sha256sum linux32 chroot tar dd; do
  command -v "$c" >/dev/null 2>&1 || missing+=("$c")
done
[ "${#missing[@]}" -eq 0 ] || die "outils manquants : ${missing[*]}
    sudo apt-get install -y xorriso squashfs-tools wget util-linux coreutils"

# ---------------------------------------------------------------- montages
MOUNTS=()
unmount_all() {
  set +e
  local i
  for ((i=${#MOUNTS[@]}-1; i>=0; i--)); do
    umount -lf "${MOUNTS[i]}" 2>/dev/null
  done
  MOUNTS=()
}
trap unmount_all EXIT

mount_chroot() {
  mount --bind /dev "$CHROOT/dev";            MOUNTS+=("$CHROOT/dev")
  mount --bind /dev/pts "$CHROOT/dev/pts";    MOUNTS+=("$CHROOT/dev/pts")
  mount -t proc proc "$CHROOT/proc";          MOUNTS+=("$CHROOT/proc")
  mount -t sysfs sysfs "$CHROOT/sys";         MOUNTS+=("$CHROOT/sys")
}

setup_dns() {
  mv "$CHROOT/etc/resolv.conf" "$CHROOT/etc/resolv.conf.x32bak" 2>/dev/null || true
  local src=/etc/resolv.conf
  if grep -q '^nameserver 127\.' "$src" 2>/dev/null && [ -r /run/systemd/resolve/resolv.conf ]; then
    src=/run/systemd/resolve/resolv.conf
  fi
  cp -L "$src" "$CHROOT/etc/resolv.conf" 2>/dev/null \
    || printf 'nameserver 1.1.1.1\nnameserver 9.9.9.9\n' > "$CHROOT/etc/resolv.conf"
}

restore_dns() {
  rm -f "$CHROOT/etc/resolv.conf"
  if [ -e "$CHROOT/etc/resolv.conf.x32bak" ] || [ -L "$CHROOT/etc/resolv.conf.x32bak" ]; then
    mv "$CHROOT/etc/resolv.conf.x32bak" "$CHROOT/etc/resolv.conf"
  fi
}

# ------------------------------------------------------------ 1. téléchargement
download_iso() {
  mkdir -p "$WORK"
  local base
  if [ ! -s "$ISO_SRC" ]; then
    local ok=0
    for base in "${BASE_ISO_BASES[@]}"; do
      log "Téléchargement de $BASE_ISO_NAME depuis $base"
      if wget -c --tries=3 --timeout=30 -O "$ISO_SRC.part" "$base/$BASE_ISO_NAME"; then
        mv "$ISO_SRC.part" "$ISO_SRC"; ok=1; break
      fi
      warn "échec avec ce miroir, essai suivant"
    done
    [ "$ok" = 1 ] || die "impossible de télécharger l'ISO de base (placez-la à la main dans $WORK/)"
  else
    log "ISO de base déjà présente : $ISO_SRC"
  fi

  log "Vérification SHA256"
  local sums="$WORK/SHA256SUMS" got=0
  for base in "${BASE_ISO_BASES[@]}"; do
    if wget -q --timeout=30 -O "$sums" "$base/SHA256SUMS"; then got=1; break; fi
  done
  if [ "$got" = 1 ] && grep -qE "[ *]$BASE_ISO_NAME\$" "$sums"; then
    ( cd "$WORK" && grep -E "[ *]$BASE_ISO_NAME\$" SHA256SUMS | sed -E 's/ \*/  /' | sha256sum -c - ) \
      || die "somme SHA256 incorrecte : supprimez $ISO_SRC et relancez"
  elif [ "${ALLOW_UNVERIFIED:-0}" = 1 ]; then
    warn "SHA256SUMS introuvable : ISO NON vérifiée (ALLOW_UNVERIFIED=1)"
  else
    die "SHA256SUMS introuvable. Relancez plus tard, ou avec ALLOW_UNVERIFIED=1 à vos risques."
  fi
}

# ------------------------------------------------------------ 2. extraction
extract_iso() {
  log "Extraction de l'ISO et du système de fichiers live"
  rm -rf "$ISO_TREE" "$CHROOT"
  xorriso -osirrox on -indev "$ISO_SRC" -extract / "$ISO_TREE" >/dev/null 2>&1 \
    || die "xorriso n'a pas pu extraire l'ISO"
  chmod -R u+w "$ISO_TREE"
  # Secteur de démarrage hybride (USB) récupéré tel quel depuis l'ISO d'origine
  dd if="$ISO_SRC" bs=432 count=1 of="$WORK/isohdpfx.bin" status=none
  [ -f "$ISO_TREE/casper/filesystem.squashfs" ] || die "casper/filesystem.squashfs introuvable"
  unsquashfs -f -d "$CHROOT" "$ISO_TREE/casper/filesystem.squashfs" >/dev/null
}

# ------------------------------------------------------------ 3. personnalisation
customize() {
  log "Application des réglages (overlay) et des scripts"
  tar -C "$ROOT/overlay" --owner=0 --group=0 --numeric-owner -cf - . | tar -C "$CHROOT" -xpf -

  # Numéro de version du système (lu plus tard par x32-update)
  mkdir -p "$CHROOT/etc"
  cp "$ROOT/VERSION" "$CHROOT/etc/x32-release"

  # Firefox ESR officiel 32 bits (dernier build i686 de Mozilla), installé depuis l'hôte.
  # Si le téléchargement échoue, on garde le Firefox d'Ubuntu et le build continue.
  if [ "${X32_SKIP_FIREFOX:-0}" = 1 ]; then
    warn "X32_SKIP_FIREFOX=1 : Firefox d'Ubuntu conservé"
  else
    log "Installation de Firefox ESR (build i686 officiel)"
    "$ROOT/overlay/usr/local/sbin/x32-firefox-update" --root "$CHROOT" --force \
      || warn "Firefox ESR non installé : le Firefox d'Ubuntu est conservé"
  fi

  mkdir -p "$CHROOT/tmp/x32"
  cp "$ROOT/scripts/chroot-customize.sh" "$ROOT/scripts/chroot-design.sh" "$ROOT/packages-add.txt" "$ROOT/packages-remove.txt" "$CHROOT/tmp/x32/"

  mount_chroot
  setup_dns

  log "Exécution de chroot-customize.sh dans le chroot i386"
  linux32 chroot "$CHROOT" /usr/bin/env X32_SKIP_APT="${X32_SKIP_APT:-0}" \
    /bin/bash /tmp/x32/chroot-customize.sh

  log "Nettoyage du chroot"
  restore_dns
  rm -rf "$CHROOT/tmp/x32" "$CHROOT/root/.bash_history" "$CHROOT/var/cache/apt/"*.bin
  find "$CHROOT/var/lib/apt/lists" -type f ! -name lock ! -name partial -delete 2>/dev/null || true
  # Manifeste des paquets (avant de démonter /proc etc.)
  linux32 chroot "$CHROOT" dpkg-query -W --showformat='${Package} ${Version}\n' \
    > "$ISO_TREE/casper/filesystem.manifest"
  unmount_all
}

# ------------------------------------------------------------ 4. reconstruction
rebuild_iso() {
  log "Compression du système (mksquashfs : $SQUASH_OPTS)"
  rm -f "$ISO_TREE/casper/filesystem.squashfs"
  # shellcheck disable=SC2086
  mksquashfs "$CHROOT" "$ISO_TREE/casper/filesystem.squashfs" -noappend $SQUASH_OPTS
  du -sx --block-size=1 "$CHROOT" | cut -f1 > "$ISO_TREE/casper/filesystem.size"

  log "Paramètres de démarrage et métadonnées"
  local f
  for f in "$ISO_TREE/isolinux/txt.cfg" "$ISO_TREE/isolinux/isolinux.cfg" \
           "$ISO_TREE/boot/grub/grub.cfg" "$ISO_TREE/boot/grub/loopback.cfg"; do
    [ -f "$f" ] && sed -i "s/quiet splash/$KERNEL_PARAMS_LIVE/g" "$f"
  done
  mkdir -p "$ISO_TREE/.disk"
  echo "X32 Systeme PC $VERSION (base Lubuntu 18.04.5 i386) - $(date +%Y%m%d)" > "$ISO_TREE/.disk/info"

  ( cd "$ISO_TREE" && rm -f md5sum.txt \
    && find . -type f ! -name md5sum.txt ! -name boot.cat ! -path './isolinux/isolinux.bin' -print0 \
       | sort -z | xargs -0 md5sum > md5sum.txt )

  log "Génération de l'ISO : $OUT_ISO"
  mkdir -p "$OUT"
  local efi=()
  if [ -f "$ISO_TREE/boot/grub/efi.img" ]; then
    efi=(-eltorito-alt-boot -e boot/grub/efi.img -no-emul-boot -isohybrid-gpt-basdat)
  fi
  xorriso -as mkisofs -r -V "$VOLID" -J -joliet-long -l -iso-level 3 \
    -isohybrid-mbr "$WORK/isohdpfx.bin" \
    -c isolinux/boot.cat -b isolinux/isolinux.bin \
    -no-emul-boot -boot-load-size 4 -boot-info-table \
    "${efi[@]}" \
    -o "$OUT_ISO" "$ISO_TREE"

  ( cd "$OUT" && sha256sum "$(basename "$OUT_ISO")" > "$(basename "$OUT_ISO").sha256" )
  log "Terminé : $(du -h "$OUT_ISO" | cut -f1)  $OUT_ISO"
}

download_iso
extract_iso
customize
rebuild_iso
