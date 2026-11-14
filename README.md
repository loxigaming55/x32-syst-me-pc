# X32 Système PC

Un système 32 bits (i386) **allégé**, bâti sur **Lubuntu 18.04.5 LTS**, pensé pour
l'**ASUS Eee PC 1001PX / 1001PXD** (Atom N450, 1 à 2 Go de RAM).

> Lubuntu 18.04 est la **dernière version de Lubuntu proposée en 32 bits** (bureau LXDE).
> Ses mises à jour de sécurité gratuites sont terminées (sauf Ubuntu Pro/ESM) : évitez les
> opérations sensibles (banque, etc.) sur ce système.

## Contenu

| | |
|---|---|
| **Firefox ESR 140** officiel (build 32 bits de Mozilla) | à la place du Firefox d'Ubuntu 18.04, très ancien. Réglé pour démarrer vite (voir plus bas). |
| **X32 Office** : Texte + Tableur en HTML | remplace LibreOffice, s'ouvre comme une application classique |
| **Mises à jour sans réinstaller** | Wi-Fi/Ethernet ou clé USB, signées, avec retour arrière |
| zram, gouverneur CPU `ondemand`, `sysctl`, noatime, journald limité… | moins de disque, plus de fluidité |
| Services et applets inutiles désactivés | ModemManager, cups-browsed, avahi, apport, blueman, tracker… |
| Squashfs en gzip, pas de splash | démarrage plus léger pour le CPU |
| Thème Arc-Dark, icônes Papirus, fond d'écran, écran de connexion | sans transparence ni ombres (aucun effet coûteux) |
| Thunderbird, Pidgin, Transmission, LibreOffice… retirés | |

> `mitigations=off` désactive les protections contre les failles CPU de type Spectre/Meltdown.
> Sur un Atom N450 (processeur en ordre) le risque est faible ; retirez ce paramètre si cela vous
> inquiète (`config.env` et `overlay/etc/default/grub.d/99-x32.cfg`).

## Firefox

**Important : Mozilla a arrêté Firefox 32 bits sur Linux.** La dernière version normale est la 144 ;
**ESR 140** est la dernière branche qui existe encore en 32 bits, avec des mises à jour de sécurité
annoncées « au moins jusqu'en septembre 2026 » ([source](https://blog.mozilla.org/futurereleases/2025/09/05/firefox-32-bit-linux-support-to-end-in-2026/)).
Il n'existera donc **pas de Firefox plus récent** sur ce PC ; passé cette échéance, le navigateur
ne recevra peut-être plus de correctifs. Vérifiez avec `x32-update --check` / `x32-firefox-update --check`.

Pour le rendre plus rapide à ouvrir :

- processus unique, pas de cache disque (le disque est le point faible), pas d'animations,
  pas de page d'accueil/nouvel onglet chargés, sessions restaurées onglet par onglet ;
- télémétrie, études, Pocket, suggestions désactivés ; **uBlock Origin** installé au premier
  lancement (pages bien plus légères) ;
- **préchargement** de Firefox en cache au démarrage (priorité minimale, seulement si ≥ 1,4 Go de RAM,
  désactivable avec `X32_PREFETCH=0` dans `/etc/default/x32-tuning`).

Réglages dans `overlay/usr/share/x32/firefox/` (`x32-prefs.js`, `policies.json`). Le temps de démarrage
réel dépend surtout du disque : sur un disque dur 5400 tr/min, un SSD reste le meilleur gain.

## X32 Office

Applications locales, hors ligne, sans dépendance : **X32 Texte** et **X32 Tableur**
(menu *Bureautique*, ou `x32-writer` / `x32-calc` / `x32-office`).

- **Texte** : titres, gras/italique/souligné, polices, tailles, couleurs, listes, tableaux, images
  (réduites automatiquement), liens, rechercher, impression / PDF, brouillon automatique.
  Format : `.html` (s'ouvre aussi dans n'importe quel navigateur) et `.txt`.
- **Tableur** : 26 colonnes × jusqu'à 1000 lignes, formules (`=SOMME(A1:A10)`, `=SI(...)`, `=MOYENNE`,
  `=ARRONDI`, etc., noms français ou anglais), recopie vers le bas (Ctrl+D), copier-coller avec décalage
  des références, couleurs, gras, formats (`0,00`, `%`, `€`), tri, annuler/rétablir.
  Format : `.x32c`, import/export **CSV** (séparateur `;`, compatible Excel et LibreOffice).
- Fenêtre d'application via WebKitGTK (réseau bloqué pour les documents, liens ouverts dans le
  navigateur). Si WebKitGTK est absent, la page s'ouvre dans Firefox.

**Limites** : pas de lecture/écriture de `.docx` / `.xlsx` / `.odt` (pas de présentations non plus).
Pour ces formats : `sudo apt install abiword gnumeric`, ou exportez en CSV/HTML depuis un autre PC.

## Mettre à jour sans réinstaller

Menu *Système* → **Mise à jour X32** (Wi-Fi) ou **Mise à jour X32 (clé USB)**, ou en terminal :

```bash
sudo x32-update              # Wi-Fi : système X32, puis Firefox
sudo x32-update --usb        # clé USB contenant x32-update-*.tar.gz (+ .sig)
sudo x32-update --firefox    # seulement Firefox
sudo x32-update --apt        # aussi les paquets Ubuntu 18.04 (peu de correctifs : support terminé)
sudo x32-update --rollback   # revenir avant la dernière mise à jour X32
x32-update --check           # voir s'il y a du nouveau
```

Une mise à jour remplace les scripts, réglages, X32 Office, etc. Vos fichiers de configuration
modifiés (`/etc/default/x32-tuning`…) sont conservés (la nouvelle version est déposée à côté en
`.x32-new`). Les trois dernières versions sont sauvegardées pour le retour arrière.
Firefox se met à jour séparément (`x32-firefox-update`, aussi hors ligne avec `--from-file`).

**Ce que ça ne fait pas** : changer de version d'Ubuntu ou de noyau. La base reste 18.04.

### Signer les mises à jour (une seule fois)

Un paquet de mise à jour est du code exécuté en root : `x32-update` **refuse tout paquet non signé**.

1. Sur votre ordinateur : `tools/gen-signing-key.sh` crée une clé privée (`x32-update-private.pem`,
   **à garder secrète, jamais dans le dépôt**) et la clé publique `overlay/etc/x32/update-pubkey.pem`.
2. Ajoutez le contenu de la clé privée dans GitHub : *Settings → Secrets and variables → Actions →
   New repository secret* nommé **`UPDATE_SIGNING_KEY`**.
3. Committez et poussez `overlay/etc/x32/update-pubkey.pem`, **puis** compilez l'ISO (la clé publique y est intégrée).
4. Pour publier une mise à jour : augmentez `VERSION`, puis `git tag v0.2.1 && git push --tags`.
   GitHub fabrique, signe et publie `x32-update-<version>.tar.gz` + `.sig` dans **Releases**.

Pour la clé USB : téléchargez ces deux fichiers depuis *Releases*, copiez-les à la racine de la clé.

## Compiler l'ISO

### Option 1 : sur GitHub (rien à installer)

1. Onglet **Actions** → « Compiler X32 Système PC » → **Run workflow**.
2. Attendez 20 à 40 min, puis téléchargez l'artefact `x32-systeme-pc-iso` (un ZIP : **décompressez-le**, l'ISO est dedans).
3. Pour une publication durable, créez un tag (`git tag v0.2.0 && git push --tags`) : l'ISO et le
   paquet de mise à jour apparaissent dans **Releases**.

### Option 2 : sur un PC Debian / Ubuntu / Lubuntu

```bash
sudo apt-get install -y xorriso squashfs-tools wget util-linux coreutils python3 file
git clone https://github.com/loxigaming55/x32-syst-me-pc
cd x32-syst-me-pc
sudo ./build.sh
```

~8 Go libres et internet (ISO de base ≈ 1,1 Go, Firefox ≈ 70 Mo, quelques paquets). Si un
téléchargement échoue (Firefox, thème…), le build continue avec l'élément d'origine.
Variables utiles : `X32_SKIP_FIREFOX=1`, `X32_SKIP_APT=1`.

## Installer sur l'Eee PC

Le 1001PX n'a pas de lecteur CD : clé USB (≥ 2 Go) avec Rufus (schéma **MBR**, mode « Image DD »
si l'ISO ne démarre pas) ou :

```bash
sudo dd if=out/x32-systeme-pc-0.2.0-i386.iso of=/dev/sdX bs=4M status=progress conv=fsync
```

(remplacez `/dev/sdX`, **vérifiez avec `lsblk`**). Au démarrage, **Échap** ouvre le menu de boot ASUS.

## Personnaliser

| Fichier | Rôle |
|---|---|
| `config.env` | ISO de base, miroirs, compression, paramètres noyau, branche Firefox |
| `packages-add.txt` / `packages-remove.txt` | paquets ajoutés / retirés |
| `overlay/` | fichiers copiés tels quels dans le système (et dans les mises à jour) |
| `overlay/usr/share/x32-office/` | X32 Office (`writer.html`, `calc.html`, `calc-engine.js`…) |
| `overlay/usr/share/x32/firefox/` | réglages Firefox |
| `overlay/etc/default/x32-tuning` | zram, gouverneur CPU, préchargement |
| `scripts/` | scripts exécutés dans le chroot / après une mise à jour |
| `tools/` | fabrication du paquet de mise à jour, clés de signature, fond d'écran |
| `tests/` | `node tests/calc-engine.test.js`, `node tests/office-ui.test.js` (Playwright) |

## Avertissement

Ce projet n'a **pas été testé sur du matériel réel** : le moteur de formules, l'interface X32 Office
(dans Chromium), le paquet de mise à jour signé et le retour arrière ont été testés ; la compilation de
l'ISO complète, le lanceur WebKitGTK et le temps de démarrage de Firefox sur l'Eee PC ne l'ont pas été.
Testez d'abord l'ISO en session live (ou sous QEMU) et sauvegardez vos données.

Base : [Lubuntu](https://lubuntu.me/) / Ubuntu, sous leurs licences respectives. Firefox : © Mozilla.
