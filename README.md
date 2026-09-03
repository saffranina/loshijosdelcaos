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

```
python tools/empaquetar.py
```

Deja en `dist/` una carpeta y un zip de unos 74 MB. Quien lo reciba
descomprime y hace doble clic en `Jugar.html`: se abre en el navegador y ya
está. Sin internet, sin instalar nada, sin servidor.

Ese paso de armado hace falta porque el juego, abierto directamente desde el
disco, choca con cuatro restricciones del navegador. `tools/empaquetar.py`
las resuelve una por una y el archivo explica cada una en detalle:

| Qué se rompe abriendo el `index.html` a mano | Cómo lo salva el paquete |
|---|---|
| Los `import` entre módulos de `src/` | Los une en un solo `juego.js` |
| `dialogues.json` y `farkle-config.json` | Los incrusta en `datos.js` |
| Las tipografías `.woff2` | Las incrusta en el `.css`, en base64 |
| WebGL rechaza las imágenes del disco | El juego usa el renderer de canvas |

Las dos últimas líneas dependen de un ajuste en `src/main.js`, que detecta si
el juego está corriendo sin servidor (`file://`) y cambia de renderer y de
sistema de carga. Con servidor no cambia nada.

Cuando se toca `src/`, hay que volver a correr el empaquetador: `juego.js` y
`datos.js` son archivos generados y no se editan a mano.
