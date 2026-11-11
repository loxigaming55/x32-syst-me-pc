#!/usr/bin/env python3
"""Génère le fond d'écran X32 (dégradé + formes douces). Usage : python3 tools/gen-wallpaper.py
Image statique, JPEG léger : aucun coût CPU à l'exécution."""
import random
from PIL import Image, ImageDraw, ImageFilter

def make(w, h, path):
    random.seed(32)
    top, bot = (22, 28, 48), (52, 36, 96)
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    # grandes formes translucides floues
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for cx, cy, r, col in [(0.80, 0.25, 0.45, (96, 120, 255, 70)),
                           (0.15, 0.85, 0.50, (190, 80, 200, 55)),
                           (0.55, 1.05, 0.40, (70, 200, 220, 45))]:
        R = int(r * h * 1.3)
        d.ellipse([cx*w-R, cy*h-R, cx*w+R, cy*h+R], fill=col)
    layer = layer.filter(ImageFilter.GaussianBlur(h // 7))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    # fin bruit pour éviter les bandes de dégradé
    noise = Image.effect_noise((w, h), 6).convert("RGB")
    img = Image.blend(img, Image.blend(img, noise, 0.5), 0.04)
    img.save(path, "JPEG", quality=82, optimize=True, progressive=True)

if __name__ == "__main__":
    make(1366, 768, "overlay/usr/share/backgrounds/x32/x32-wallpaper.jpg")
