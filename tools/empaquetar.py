# -*- coding: utf-8 -*-
"""
Arma el paquete que se le pasa a otra persona para que juegue SIN INTERNET y
SIN INSTALAR NADA: descomprime el zip y hace doble clic en un .html.

    python tools/empaquetar.py

Deja el resultado en dist/:

    dist/Los hijos del caos - El ultimo dado/     la carpeta lista
    dist/Los-hijos-del-caos-El-ultimo-dado.zip    la misma carpeta comprimida


POR QUE HACE FALTA UN PASO DE ARMADO
------------------------------------

Durante el desarrollo el juego se abre con jugar.bat, que levanta un servidor
local. Eso hace falta porque el codigo esta partido en modulos (los `import`
de src/) y porque los dialogos se leen de un .json: las dos cosas son pedidos
de red, y el navegador solo los permite si hay un servidor del otro lado.

Abriendo el index.html directamente (o sea con la direccion file://) el
navegador bloquea todo eso y no arranca. Pero la otra persona no tiene por que
instalar Python solo para jugar. Asi que este script prepara una version que
funciona con doble clic:

  1. UNE LOS MODULOS en un unico archivo (juego.js) sin `import` ni `export`.
     Cada modulo queda envuelto en su propia funcion, para que dos archivos
     puedan tener variables internas con el mismo nombre sin pisarse.

  2. INCRUSTA LOS DATOS (dialogues.json y farkle-config.json) en datos.js,
     como una variable. Asi no hay que ir a buscarlos por red.
     Del otro lado lo recoge BootScene.js.

  3. INCRUSTA LAS FUENTES dentro del .css, en base64. Los .woff2 sueltos
     Chrome no los carga desde file://, y los titulos se caian a Georgia.

  4. COPIA el arte, la musica y Phaser tal cual.

Las dos opciones que Phaser necesita para cargar imagenes y musica desde el
disco estan en src/main.js, activadas solo cuando la direccion es file://.
"""
import base64
import io
import json
import os
import re
import shutil
import sys
import zipfile

RAIZ = os.path.dirname(os.path.abspath(os.path.join(__file__, '..')))
NOMBRE = 'Los hijos del caos - El ultimo dado'
ENTRADA = 'src/main.js'


# ---------------------------------------------------------------- 1. modulos

# `import { A, B } from './x.js';`  — puede ocupar varias lineas.
RE_IMPORT = re.compile(
    r"^[ \t]*import[ \t]*\{(?P<nombres>[^}]*)\}[ \t]*from[ \t]*"
    r"['\"](?P<ruta>[^'\"]+)['\"][ \t]*;?[ \t]*\n",
    re.MULTILINE | re.DOTALL)

# `export { A, B } from './x.js';`  (reexporta) y `export { A };` (a secas).
RE_REEXPORT = re.compile(
    r"^[ \t]*export[ \t]*\{(?P<nombres>[^}]*)\}[ \t]*from[ \t]*"
    r"['\"](?P<ruta>[^'\"]+)['\"][ \t]*;?[ \t]*\n",
    re.MULTILINE | re.DOTALL)
RE_EXPORT_SUELTO = re.compile(
    r"^[ \t]*export[ \t]*\{(?P<nombres>[^}]*)\}[ \t]*;?[ \t]*\n",
    re.MULTILINE | re.DOTALL)

# `export class X`, `export function X`, `export const X`, ...
RE_EXPORT_DECL = re.compile(
    r"^(?P<sangria>[ \t]*)export[ \t]+"
    r"(?P<tipo>class|function|const|let|var|async[ \t]+function)[ \t]+"
    r"(?P<nombre>[A-Za-z_$][\w$]*)",
    re.MULTILINE)


def nombres_de(texto):
    """Parte la lista de un `{ A, B as C }` en pares (externo, local)."""
    salida = []
    for trozo in texto.split(','):
        trozo = trozo.strip()
        if not trozo:
            continue
        if ' as ' in trozo:
            origen, destino = [t.strip() for t in trozo.split(' as ', 1)]
            salida.append((origen, destino))
        else:
            salida.append((trozo, trozo))
    return salida


def resolver(desde, ruta):
    """'../theme.js' visto desde 'src/scenes/X.js' -> 'src/theme.js'."""
    ruta = ruta.split('?')[0]            # el ?v=... para saltear la cache
    base = os.path.dirname(desde)
    return os.path.normpath(os.path.join(base, ruta)).replace(os.sep, '/')


class Modulo(object):
    def __init__(self, id_, fuente):
        self.id = id_
        self.imports = []      # (id del modulo, [(externo, local), ...])
        self.exports = {}      # nombre exportado -> expresion JS que lo da
        self.cuerpo = fuente

        def comer_import(m):
            self.imports.append((resolver(id_, m.group('ruta')),
                                 nombres_de(m.group('nombres'))))
            return ''

        def comer_reexport(m):
            otro = resolver(id_, m.group('ruta'))
            for externo, local in nombres_de(m.group('nombres')):
                self.exports[local] = '__M[%s].%s' % (json.dumps(otro), externo)
            # Es una dependencia aunque no haya un `import`: hay que cargar
            # ese modulo antes que este.
            self.imports.append((otro, []))
            return ''

        def comer_export_suelto(m):
            for externo, local in nombres_de(m.group('nombres')):
                self.exports[local] = externo
            return ''

        self.cuerpo = RE_IMPORT.sub(comer_import, self.cuerpo)
        self.cuerpo = RE_REEXPORT.sub(comer_reexport, self.cuerpo)
        self.cuerpo = RE_EXPORT_SUELTO.sub(comer_export_suelto, self.cuerpo)

        # `export class X {` -> `class X {`, anotando X como exportado.
        def comer_decl(m):
            self.exports[m.group('nombre')] = m.group('nombre')
            return '%s%s %s' % (m.group('sangria'), m.group('tipo'),
                                m.group('nombre'))

        self.cuerpo = RE_EXPORT_DECL.sub(comer_decl, self.cuerpo)

        sobra = re.search(r'^[ \t]*export\b', self.cuerpo, re.MULTILINE)
        if sobra:
            linea = self.cuerpo[:sobra.start()].count('\n') + 1
            raise SystemExit(
                'No se como traducir el `export` de %s, linea %d.\n'
                'Hay que ensenarle esa forma a tools/empaquetar.py.'
                % (id_, linea))


def leer(id_, cache):
    if id_ not in cache:
        ruta = os.path.join(RAIZ, id_.replace('/', os.sep))
        if not os.path.exists(ruta):
            raise SystemExit('Falta el archivo %s' % id_)
        cache[id_] = Modulo(id_, io.open(ruta, encoding='utf-8').read())
    return cache[id_]


def ordenar(entrada, cache):
    """Dependencias primero. Avisa si hay un ciclo en vez de colgarse."""
    orden, visto, en_curso = [], set(), []

    def bajar(id_):
        if id_ in visto:
            return
        if id_ in en_curso:
            raise SystemExit('Dependencia circular: %s'
                             % ' -> '.join(en_curso + [id_]))
        en_curso.append(id_)
        for dep, _ in leer(id_, cache).imports:
            bajar(dep)
        en_curso.pop()
        visto.add(id_)
        orden.append(id_)

    bajar(entrada)
    return orden


def unir():
    cache = {}
    orden = ordenar(ENTRADA, cache)

    partes = [
        '// juego.js — TODOS los modulos de src/ en un solo archivo.\n'
        '//\n'
        '// Generado por tools/empaquetar.py. No editar a mano: se pisa en el\n'
        '// proximo armado. Los originales estan en src/.\n'
        '(function () {\n'
        '"use strict";\n'
        'var __M = {};\n'
    ]

    for id_ in orden:
        mod = cache[id_]
        cabecera = []
        for dep, nombres in mod.imports:
            for externo, local in nombres:
                cabecera.append('var %s = __M[%s].%s;'
                                % (local, json.dumps(dep), externo))
        devuelve = ', '.join('%s: %s' % (json.dumps(n), expr)
                             for n, expr in sorted(mod.exports.items()))

        partes.append('\n// ' + '-' * 68 + '\n// %s\n' % id_)
        partes.append('__M[%s] = (function () {\n' % json.dumps(id_))
        if cabecera:
            partes.append('\n'.join(cabecera) + '\n')
        partes.append(mod.cuerpo.rstrip() + '\n')
        partes.append('return { %s };\n})();\n' % devuelve)

    partes.append('\n})();\n')
    return ''.join(partes), orden


# ------------------------------------------------------------------ 2. datos

def datos_js():
    def leer_json(ruta):
        with io.open(os.path.join(RAIZ, ruta), encoding='utf-8') as f:
            return json.load(f)

    payload = {
        'dialogues': leer_json('src/data/dialogues.json'),
        'farkleConfig': leer_json('src/data/farkle-config.json'),
    }
    return (
        '// datos.js — los dialogos y el balance, incrustados.\n'
        '//\n'
        '// Generado por tools/empaquetar.py desde src/data/. No editar a mano:\n'
        '// se pisa en el proximo armado.\n'
        'window.LDC_DATOS = %s;\n'
        % json.dumps(payload, ensure_ascii=False, indent=1)
    )


# ----------------------------------------------------------------- 3. fuentes

def css_con_fuentes():
    """El mismo fuentes.css pero con los .woff2 metidos adentro en base64.

    Chrome no carga tipografias externas desde una pagina file://: las trata
    como si vinieran de otro sitio y las bloquea. Metidas en el propio .css
    no hay nada que bloquear.
    """
    origen = os.path.join(RAIZ, 'vendor', 'fonts', 'fuentes.css')
    css = io.open(origen, encoding='utf-8').read()

    def incrustar(m):
        archivo = m.group(1)
        ruta = os.path.join(RAIZ, 'vendor', 'fonts', archivo)
        b64 = base64.b64encode(io.open(ruta, 'rb').read()).decode('ascii')
        return "url('data:font/woff2;base64,%s')" % b64

    css, cuantas = re.subn(r"url\('\./([^']+\.woff2)'\)", incrustar, css)
    if not cuantas:
        raise SystemExit('No encontre ninguna fuente en vendor/fonts/fuentes.css')
    return css


# -------------------------------------------------------------------- 4. html

PLANTILLA = u"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Los hijos del caos: El último dado</title>
  <link href="./vendor/fonts/fuentes.css" rel="stylesheet">
  <style>
%(estilos)s  </style>
</head>
<body>
  <div id="game"></div>
  <script src="./vendor/phaser.min.js"></script>
  <script src="./datos.js"></script>
  <script src="./juego.js"></script>
</body>
</html>
"""


def html_offline():
    """Reusa los estilos del index.html de desarrollo, para no tener dos
    copias que se vayan separando con el tiempo."""
    fuente = io.open(os.path.join(RAIZ, 'index.html'), encoding='utf-8').read()
    m = re.search(r'<style>\n(.*?)  </style>', fuente, re.DOTALL)
    if not m:
        raise SystemExit('No pude sacar los estilos de index.html')
    return PLANTILLA % {'estilos': m.group(1)}


LEEME = u"""LOS HIJOS DEL CAOS: EL ÚLTIMO DADO
==================================

CÓMO JUGAR

  Doble clic en:  Jugar.html

  Se abre en el navegador y ya está. No hace falta internet ni instalar
  nada. Si el doble clic abre un editor de texto en vez del navegador,
  clic derecho sobre el archivo -> Abrir con -> Chrome (o Firefox).

  Se recomienda Chrome o Firefox.


ANTES DE EMPEZAR

  El juego tiene contenido sexual explícito. Es para mayores de edad.


CÓMO SE JUEGA

  Es una novela visual con partidas de Farkle (un juego de dados) de por
  medio. Se hace clic para avanzar el diálogo y se eligen las respuestas.

  Quien pierde cada ronda se saca una prenda. Daku hace trampa con
  telequinesis: cambia el valor de un dado cuando uno está distraído.
  Se lo puede acusar, pero acusar de más también se paga.

  Hay cinco finales distintos.


LA CARPETA

  Jugar.html    el juego
  assets/       el arte y la música
  juego.js      el código
  datos.js      los diálogos
  vendor/       el motor (Phaser) y las tipografías

  Hay que dejar todo junto: si se mueve Jugar.html a otra carpeta sin el
  resto, no arranca.
"""


# -------------------------------------------------------------------- armado

def main():
    salida_dir = os.path.join(RAIZ, 'dist', NOMBRE)
    if os.path.exists(salida_dir):
        shutil.rmtree(salida_dir)
    os.makedirs(salida_dir)

    def escribir(rel, texto):
        ruta = os.path.join(salida_dir, rel.replace('/', os.sep))
        carpeta = os.path.dirname(ruta)
        if carpeta and not os.path.isdir(carpeta):
            os.makedirs(carpeta)
        with io.open(ruta, 'w', encoding='utf-8') as f:
            f.write(texto)

    bundle, orden = unir()
    escribir('juego.js', bundle)
    escribir('datos.js', datos_js())
    escribir('Jugar.html', html_offline())
    escribir('LEEME.txt', LEEME)
    escribir('vendor/fonts/fuentes.css', css_con_fuentes())

    shutil.copy2(os.path.join(RAIZ, 'vendor', 'phaser.min.js'),
                 os.path.join(salida_dir, 'vendor', 'phaser.min.js'))
    shutil.copytree(os.path.join(RAIZ, 'assets'),
                    os.path.join(salida_dir, 'assets'))

    print('  %d modulos unidos en juego.js' % len(orden))

    # El zip: lo que se manda por WeTransfer, Drive o lo que sea.
    zip_ruta = os.path.join(RAIZ, 'dist',
                            NOMBRE.replace(' - ', '-').replace(' ', '-') + '.zip')
    if os.path.exists(zip_ruta):
        os.remove(zip_ruta)
    with zipfile.ZipFile(zip_ruta, 'w', zipfile.ZIP_DEFLATED) as z:
        for base, _, archivos in os.walk(salida_dir):
            for nombre in sorted(archivos):
                completo = os.path.join(base, nombre)
                dentro = os.path.relpath(completo, os.path.dirname(salida_dir))
                z.write(completo, dentro)

    mb = os.path.getsize(zip_ruta) / (1024.0 * 1024.0)
    print()
    print('  Carpeta:  dist/%s/' % NOMBRE)
    print('  Zip:      dist/%s  (%.0f MB)' % (os.path.basename(zip_ruta), mb))
    print()
    print('  Para probarlo: doble clic en Jugar.html dentro de la carpeta.')
    print()
    return 0


if __name__ == '__main__':
    sys.exit(main())
