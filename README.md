# Los hijos del caos: El último dado

Mini juego narrativo para web. Visual novel + Farkle con gestión de tres recursos.

## Para desarrollar

Doble clic en `jugar.bat`. Levanta un servidor local (Python) y abre el
navegador en `http://localhost:8123/`. No hay `npm install` ni build: Phaser y
las tipografías están guardados en `vendor/`, así que tampoco hace falta
internet.

Las pruebas son `tests/test.html` (reglas del Farkle) y `tests/sim.html`
(balance). Se abren desde el mismo servidor.

## Para que alguien más lo juegue

Hay dos caminos, y los dos salen del mismo comando:

```
python tools/empaquetar.py
```

(o doble clic en `empaquetar.bat`)

**1. Bajándolo de GitHub.** El comando deja `Jugar.html` y `offline/` dentro
del repo. Con eso, el zip del botón "Code → Download ZIP" ya viene jugable:
quien lo baje descomprime y hace doble clic en `Jugar.html`. Sirve desde el
celular, y no hay que mandar nada por otro lado.

Esos cuatro archivos generados **sí se suben al repo**, aunque sean generados.
Pesan 150 KB; duplicar los assets para tener un zip aparte costaría 74 MB.

**2. Un zip limpio.** El comando deja además en `dist/` una carpeta y un zip de
unos 74 MB con solo lo que hace falta para jugar, sin `src/` ni `tests/` ni el
resto del repo. Es lo que conviene mandar por Drive o WeTransfer.

### Por qué hace falta armarlo

El juego abierto directamente desde el disco choca con cuatro restricciones del
navegador. `tools/empaquetar.py` las resuelve una por una y el archivo explica
cada una en detalle:

| Qué se rompe abriendo el `index.html` a mano | Cómo lo salva el paquete |
|---|---|
| Los `import` entre módulos de `src/` | Los une en `offline/juego.js` |
| `dialogues.json` y `farkle-config.json` | Los incrusta en `offline/datos.js` |
| Las tipografías `.woff2` | Las incrusta en el `.css`, en base64 |
| WebGL rechaza las imágenes del disco | El juego usa el renderer de canvas |

Las dos últimas líneas dependen de un ajuste en `src/main.js`, que detecta si
el juego está corriendo sin servidor (`file://`) y cambia de renderer y de
sistema de carga. Con servidor no cambia nada.

**Cuando se toca `src/` hay que volver a correr el empaquetador y subir el
resultado**, o el `Jugar.html` del repo se queda con la versión vieja.
`offline/juego.js` y `offline/datos.js` son generados: no se editan a mano.

## Los dos index

- `index.html` — el de desarrollo, con `jugar.bat`. Usa módulos y WebGL.
- `Jugar.html` — el generado, para jugar sin servidor. No se edita a mano.
