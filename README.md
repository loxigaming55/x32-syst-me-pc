# X32 Système PC

Un système 32 bits (i386) **allégé**, bâti sur **Lubuntu 18.04.5 LTS**, pensé pour
l'**ASUS Eee PC 1001PX / 1001PXD** (Atom N450, 1 à 2 Go de RAM).

> Lubuntu 18.04 est la **dernière version de Lubuntu proposée en 32 bits**
> (bureau LXDE, très léger). Les versions plus récentes n'existent plus en i386.
> Les mises à jour de sécurité d'Ubuntu 18.04 sont terminées (sauf ESM payant) :
> évitez d'y faire des opérations sensibles (banque, etc.).

## Ce qui est modifié par rapport à Lubuntu

| Réglage | Effet |
|---|---|
| **zram** (40 % de la RAM, lz4) | swap compressé en RAM : moins de disque lent, plus de fluidité |
| **Gouverneur CPU `ondemand`** | la fréquence suit la charge (modifiable) |
| `sysctl` (swappiness, cache, écritures) | moins de pics d'E/S, mémoire mieux gérée |
| `mitigations=off`, pas de splash | démarrage plus rapide, moins de coût CPU |
| Services désactivés | ModemManager, cups-browsed, avahi, apport, whoopsie, irqbalance… |
| Applets de session masqués | blueman, update-notifier, tracker, etc. |
| Animations coupées | Openbox et GTK3 |
| Firefox allégé | 1 seul processus de contenu, pas d'animations |
| `noatime` au 1ᵉʳ démarrage | moins d'écritures sur le disque (système installé) |
| journald limité à 30 Mo | |
| Mises à jour apt en priorité « idle » | n'interrompent pas votre travail |
| Squashfs en **gzip** | décompression la plus légère pour le processeur |
| LibreOffice → **AbiWord + Gnumeric** | bureautique bien plus légère |
| Thunderbird, Pidgin, Transmission, etc. retirés | |

> `mitigations=off` désactive les protections contre les failles CPU de type
> Spectre/Meltdown. Sur un Atom N450 (processeur en ordre) le risque est faible,
> mais retirez ce paramètre si cela vous inquiète (`config.env` et
> `overlay/etc/default/grub.d/99-x32.cfg`).

## Compiler l'ISO

### Option 1 : sur GitHub (aucun outil à installer)

1. Onglet **Actions** → « Compiler l'ISO X32 Système PC » → **Run workflow**.
2. Attendez 20 à 40 min, puis téléchargez l'artefact `x32-systeme-pc-iso` (ZIP contenant l'ISO).
3. Pour une publication durable : créez un tag (`git tag v0.1.0 && git push --tags`),
   l'ISO apparaîtra dans **Releases**.

### Option 2 : sur votre PC Debian / Ubuntu / Lubuntu

```bash
sudo apt-get install -y xorriso squashfs-tools wget util-linux coreutils
git clone https://github.com/loxigaming55/x32-syst-me-pc
cd x32-syst-me-pc
sudo ./build.sh
```

L'ISO (≈ 1 Go) et son `.sha256` sont créés dans `out/`. Il faut ~8 Go libres et
une connexion internet (ISO de base ≈ 1,1 Go + paquets AbiWord/Gnumeric).
Si les paquets ne peuvent pas être téléchargés, le build conserve LibreOffice au lieu d'échouer.

## Installer sur l'Eee PC

Le 1001PX n'a pas de lecteur CD : utilisez une clé USB (≥ 2 Go).

```bash
sudo dd if=out/x32-systeme-pc-0.1.0-i386.iso of=/dev/sdX bs=4M status=progress conv=fsync
```

(remplacez `/dev/sdX` par votre clé, **vérifiez-la avec `lsblk`**), ou utilisez
Etcher / Rufus (mode DD). Au démarrage, appuyez sur **Échap** (menu de boot ASUS),
choisissez la clé, puis lancez l'installateur Lubuntu.

Si le BIOS de l'Eee PC refuse de démarrer l'ISO, essayez Rufus en mode « Image DD ».

## Personnaliser

| Fichier | Rôle |
|---|---|
| `config.env` | ISO de base, miroirs, compression, paramètres noyau |
| `packages-add.txt` / `packages-remove.txt` | paquets ajoutés / retirés |
| `overlay/` | fichiers copiés tels quels dans le système (`/etc`, `/usr/local/sbin`…) |
| `overlay/etc/default/x32-tuning` | zram et gouverneur CPU |
| `scripts/chroot-customize.sh` | réglages appliqués dans le chroot |

## Avertissement

Ce projet n'a pas été testé sur du matériel réel au moment de sa création : testez d'abord
l'ISO en session live (ou sous VM i386 / QEMU) avant d'installer, et sauvegardez vos données.

Base : [Lubuntu](https://lubuntu.me/) / Ubuntu, sous leurs licences respectives.
