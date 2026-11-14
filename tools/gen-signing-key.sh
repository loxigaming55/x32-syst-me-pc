#!/usr/bin/env bash
# À lancer UNE SEULE FOIS sur votre ordinateur pour créer la paire de clés qui signe
# les mises à jour.
#   - la clé PRIVÉE (x32-update-private.pem) : à garder secrète, JAMAIS dans le dépôt ;
#     copiez son contenu dans un secret GitHub nommé UPDATE_SIGNING_KEY.
#   - la clé PUBLIQUE est écrite dans overlay/etc/x32/update-pubkey.pem : à valider
#     (git add / commit / push) avant de compiler l'ISO.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRIV="${1:-$ROOT/x32-update-private.pem}"
[ -e "$PRIV" ] && { echo "Existe déjà : $PRIV (rien n'a été modifié)"; exit 1; }
umask 077
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$PRIV"
mkdir -p "$ROOT/overlay/etc/x32"
openssl pkey -in "$PRIV" -pubout -out "$ROOT/overlay/etc/x32/update-pubkey.pem"
chmod 600 "$PRIV"
cat <<EOF

Clé privée  : $PRIV     <- SECRÈTE. Ajoutez son contenu au secret GitHub UPDATE_SIGNING_KEY
              (Settings > Secrets and variables > Actions > New repository secret).
Clé publique: overlay/etc/x32/update-pubkey.pem   <- à committer et pousser.
Sauvegardez la clé privée : si vous la perdez, il faudra réinstaller les ordinateurs.
EOF
