# -*- coding: utf-8 -*-
"""
Quita el fondo a damero (o blanco) que queda pegado en los píxeles cuando se
exporta sin transparencia, y deja alfa real.

Uso:
    python tools/limpiar_fondo.py  entrada.jpg  salida.png
    python tools/limpiar_fondo.py  entrada.jpg  salida.png  --tam 1024x1536

Cómo funciona:

  1. DETECTA LOS TONOS DEL DAMERO mirando el marco exterior de la imagen.
     No usa un umbral fijo: cada archivo tiene los suyos. Los portraits de
     Rein y Daku venían con 253/243; el de Nuri con 255/223. Un umbral fijo
     se comía solo la mitad de los cuadros y dejaba el damero a la vista.

  2. RELLENA DESDE EL BORDE hacia adentro, y se queda solo con las manchas de
     fondo que tocan el borde. Así los blancos internos (brillo de los ojos,
     hebillas, gotas) no se borran.

  3. AGREGA LOS HUECOS ENCERRADOS que también son damero — el espacio entre
     el brazo y el torso, o entre el abrigo y el cuerpo, no toca el borde
     pero es fondo igual.

  4. COME EL HALO: el borde del personaje queda con píxeles a medio camino
     entre el dibujo y el fondo (por el antialias y, en los .jpg, por el
     ruido de compresión). Sin esto queda un contorno claro de 1-2 px.

Requiere: pillow, numpy, scipy.
"""
import argparse
import os
import sys

import numpy as np
from scipy import ndimage
from PIL import Image

MARCO = 40          # ancho en px del marco que se mira para detectar el fondo
SAT_NEUTRO = 26     # un píxel "sin color": max(RGB) - min(RGB) <= esto
TOLERANCIA = 8      # cuánto se aparta un píxel de un tono del damero y sigue contando
AREA_HUECO = 800    # huecos encerrados más chicos que esto se respetan
PASADAS_HALO = 2
MIN_PIEZA = 2000    # fragmentos opacos sueltos más chicos que esto son basura


def detectar_tonos(lum, sat):
    """Los grises dominantes del marco exterior: los cuadros del damero."""
    h, w = lum.shape
    marco = np.zeros(lum.shape, dtype=bool)
    marco[:MARCO, :] = marco[-MARCO:, :] = True
    marco[:, :MARCO] = marco[:, -MARCO:] = True
    neutros = lum[marco & (sat <= SAT_NEUTRO)]
    if neutros.size == 0:
        return []
    hist = np.bincount(neutros.astype(np.uint8), minlength=256)
    # Nos quedamos con los picos que expliquen al menos el 8% del marco neutro
    corte = max(1, int(neutros.size * 0.08))
    return [int(t) for t in np.argsort(hist)[::-1][:4] if hist[t] >= corte]


def limpiar(path, tam=None, verbose=True):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im).astype(np.int16)
    rgb = a[:, :, :3]
    lum = rgb.max(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)

    tonos = detectar_tonos(lum, sat)
    if not tonos:
        raise SystemExit("No encontré un fondo neutro en el marco de %s" % path)
    if verbose:
        print("  tonos del fondo detectados: %s" % tonos)

    # 1) candidatos: neutros y dentro del rango que cubren los tonos del damero.
    #    Un rango y no dos tonos exactos, porque el ruido de compresión del .jpg
    #    genera valores intermedios entre un cuadro y el otro; con tonos exactos
    #    esos quedaban opacos y aparecían como motitas alrededor del personaje.
    piso_fondo = min(tonos) - TOLERANCIA
    fondo = (lum >= piso_fondo) & (sat <= SAT_NEUTRO)
    if verbose:
        print("  rango de fondo: luminancia >= %d, sin color" % piso_fondo)

    # 2) solo lo conectado al borde  + 3) huecos encerrados de damero
    etiquetas, n = ndimage.label(fondo)
    huecos = []
    if n:
        borde = np.concatenate([etiquetas[0, :], etiquetas[-1, :],
                                etiquetas[:, 0], etiquetas[:, -1]])
        vivos = set(int(v) for v in np.unique(borde)) - {0}
        areas = ndimage.sum(np.ones_like(lum), etiquetas, range(1, n + 1))
        for etq in range(1, n + 1):
            if etq in vivos or areas[etq - 1] < AREA_HUECO:
                continue
            vivos.add(etq)
            huecos.append(int(areas[etq - 1]))
        fondo = np.isin(etiquetas, list(vivos))
    if verbose and huecos:
        print("  huecos internos rellenados: %s" % sorted(huecos, reverse=True)[:5])

    # 4) halo del contorno, con umbral relativo al tono más oscuro del damero
    halo_ok = (lum >= piso_fondo - 12) & (sat <= SAT_NEUTRO + 20)
    for _ in range(PASADAS_HALO):
        fondo = fondo | (ndimage.binary_dilation(fondo) & halo_ok)

    # 5) motitas: cuadros del damero que el ruido del .jpg dejó fuera de tono
    #    y quedaron como islitas opacas flotando alrededor del personaje.
    #    Se van todos los fragmentos sueltos más chicos que MIN_PIEZA.
    et_fg, n_fg = ndimage.label(~fondo)
    if n_fg > 1:
        areas_fg = ndimage.sum(np.ones_like(lum), et_fg, range(1, n_fg + 1))
        motitas = [i + 1 for i, ar in enumerate(areas_fg) if ar < MIN_PIEZA]
        if motitas:
            fondo = fondo | np.isin(et_fg, motitas)
            if verbose:
                print("  motitas sueltas eliminadas: %d (la mayor era de %d px)"
                      % (len(motitas), int(max(areas_fg[i - 1] for i in motitas))))

    alpha = np.where(fondo, 0, 255).astype(np.uint8)
    out = Image.fromarray(np.dstack([a[:, :, :3].astype(np.uint8), alpha]), "RGBA")
    if tam and out.size != tam:
        out = out.resize(tam, Image.LANCZOS)

    if verbose:
        op = np.asarray(out)[:, :, 3] > 24
        ys, xs = np.where(op)
        h, w = op.shape
        print("  transparente: %.1f%%   encuadre: cabeza y=%.1f%%  pies y=%.1f%%  "
              "centro x=%.1f%%  ancho=%.1f%%"
              % ((alpha == 0).mean() * 100, ys.min() / h * 100, ys.max() / h * 100,
                 (xs.min() + xs.max()) / 2 / w * 100, (xs.max() - xs.min()) / w * 100))
    return out


def main():
    p = argparse.ArgumentParser(description="Quita el fondo a damero de un portrait.")
    p.add_argument("entrada")
    p.add_argument("salida")
    p.add_argument("--tam", help="redimensionar, por ejemplo 1024x1536")
    args = p.parse_args()

    tam = None
    if args.tam:
        w, h = args.tam.lower().split("x")
        tam = (int(w), int(h))

    print(os.path.basename(args.entrada))
    out = limpiar(args.entrada, tam)
    os.makedirs(os.path.dirname(os.path.abspath(args.salida)), exist_ok=True)
    out.save(args.salida)
    print("  -> %s" % args.salida)


if __name__ == "__main__":
    main()
