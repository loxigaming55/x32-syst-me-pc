#!/usr/bin/env bash
# Fabrique le paquet de mise à jour :  out/x32-update-<version>.tar.gz  (+ .sig si signé)
# Il contient overlay/ (tous les réglages, scripts, X32 Office...) : c'est ce que
# `x32-update` installe sur un système déjà en place, sans réinstaller.
#
#   tools/make-update.sh                       -> non signé (refusé par x32-update !)
#   X32_SIGNING_KEY=cle-privee.pem tools/make-update.sh   -> signé
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"
OUT="${OUT:-$ROOT/out}"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$OUT" "$STAGE/pkg"

cp -a "$ROOT/overlay" "$STAGE/pkg/payload"
echo "$VERSION" > "$STAGE/pkg/VERSION"

# Fichiers de configuration que l'utilisateur peut avoir modifiés : jamais écrasés
cat > "$STAGE/pkg/CONFFILES" <<'EOF'
etc/default/x32-tuning
etc/default/grub.d/99-x32.cfg
etc/lightdm/lightdm-gtk-greeter.conf
etc/x32/update.conf
EOF

# Le dossier skel ne concerne que les NOUVEAUX utilisateurs : inutile dans une mise à jour
rm -rf "$STAGE/pkg/payload/etc/skel"
# La clé publique est fixée à la création de l'ISO : une mise à jour ne la remplace pas
rm -f "$STAGE/pkg/payload/etc/x32/update-pubkey.pem"

cp "$ROOT/scripts/update-post.sh" "$STAGE/pkg/post.sh"

TGZ="$OUT/x32-update-$VERSION.tar.gz"
tar -C "$STAGE/pkg" --owner=0 --group=0 --numeric-owner --sort=name -czf "$TGZ" .
echo "créé : $TGZ ($(du -h "$TGZ" | cut -f1))"

if [ -n "${X32_SIGNING_KEY:-}" ]; then
  openssl dgst -sha256 -sign "$X32_SIGNING_KEY" -out "$TGZ.sig" "$TGZ"
  echo "signé : $TGZ.sig"
else
  echo "ATTENTION : non signé. x32-update refusera ce paquet (définissez X32_SIGNING_KEY)." >&2
fi
