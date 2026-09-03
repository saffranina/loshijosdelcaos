# La Estrella de Mar — Strip Farkle

Mini juego narrativo para web. Visual novel + Farkle con gestión de tres recursos.
Universo: **Los hijos del caos** (Terhemin).

---

## Cómo jugarlo

Doble clic en **`jugar.bat`**. Nada más.

Levanta un servidor local con Python (ya lo tenés instalado, 3.14) y abre el navegador
en `http://localhost:8123/`. Se abre una ventana minimizada llamada **"servidor"** —
cerrala cuando termines de jugar.

> El juego **no** funciona abriendo `index.html` directo con doble clic: el navegador
> bloquea la carga de los diálogos por seguridad. Tiene que ser por el servidor local.

**No hace falta acordarse de Ctrl+F5.** `servidor.py` manda `Cache-Control: no-store`,
así que el navegador nunca guarda copias viejas del código: cada vez que abrís el
juego se baja todo de nuevo. Si alguna vez volvés a `python -m http.server`, ese
problema vuelve.

Si al abrir aparece "No pude usar el puerto 8123", es que quedó otra ventana del
servidor abierta de antes. Cerrala y volvé a darle a `jugar.bat`.

Phaser se carga desde CDN, así que la primera vez necesitás internet.

---

## Estado actual

| Fase | Estado |
|---|---|
| 0 — Setup | ✅ hecho |
| 1 — Diálogos | ✅ hecho (guion v2 completo, transcrito a `dialogues.json`) |
| 2 — Prototipo funcional | ✅ hecho (con placeholders) |
| 3 — Arte | ⬜ pendiente |
| 4 — Integración | ⬜ pendiente |
| 5 — Publicación | ⬜ pendiente |

**Toca el checkpoint obligatorio de playtesting.** No pintar nada todavía.

### Lo que ya funciona

- Flujo completo: Título → Acto 1 → Acto 2 → Farkle → Ending → Créditos.
- Reglas completas de Farkle (35 tests pasando, ver abajo).
- IA de Daku: decide riesgo por valor esperado, con agresividad configurable.
- Trampas por telekinesis durante el taunt y durante el trago, con destello
  que se vuelve más sutil cuanto más borracho está Rein.
- EMP: 3 cargas, acusar cuesta 1, acierto = Daku pierde el turno,
  fallo = Rein pierde el turno siguiente.
- Bebida: +1 EMP, −0.2 sobriedad. Los dados se ven borrosos y con fantasma doble.
- Ropa: 6 prendas por personaje, doble o nada, y los 5 endings con sus condiciones.
- Los 3 taunts (provocar / coquetear / estoico) escalan por nivel de desnudez.

### Placeholders

Todo el arte que falta se dibuja por código y **no rompe nada**: los splash arts
salen como un cartel con la descripción del guion, los fondos como degradados, y
los dados pintados con círculos. A medida que vayas dejando PNGs en `assets/`,
el juego los va tomando solo — no hay que tocar código.

Todos los portraits están conectados y **con alfa real** — el cuadriculado que
venía pintado en los píxeles (dos grises alternados, 253 y 243) ya está quitado.
Los originales sin tocar siguen en `OneDrive/videojuegos/imagene/`.

Si aparece un portrait nuevo con el fondo pegado, el limpiador está documentado
en el historial: marca los píxeles claros y sin color, rellena desde el borde
para no comerse los brillos internos, y además detecta los huecos encerrados
(el espacio entre el brazo y el torso no toca el borde, pero es fondo igual).

---

## Tests

Con el servidor corriendo:

- **`http://localhost:8123/tests/test.html`** — 35 tests del motor de Farkle
  (puntuación, validez de apartados, detección de Farkle, mejor jugada).
- **`http://localhost:8123/tests/sim.html`** — simula 1600 partidas completas sin
  gráficos y reporta balance: endings alcanzados, rondas por partida, trampas,
  acusaciones y tasa de Farkle.

---

## Estructura

```
la-estrella-de-mar/
├── index.html            ventana del juego
├── jugar.bat             levanta el servidor y abre el navegador
├── src/
│   ├── main.js           configuración de Phaser
│   ├── theme.js          TODA la paleta y tipografía, en un solo lugar
│   ├── scenes/           Boot, Title, Act1, Act2, Farkle, Ending (+ VNScene base)
│   ├── systems/          DialogueSystem, FarkleLogic, DakuAI, EMPSystem,
│   │                     DrinkSystem, ClothingManager, SplashScreen, Dice,
│   │                     Portraits, GameState, Ui
│   └── data/
│       ├── dialogues.json      el guion entero
│       └── farkle-config.json  balance (ver abajo)
├── assets/               acá van tus PNGs
├── tests/
└── dist/                 build final para itch.io
```

---

## Ajustar el balance

Todo se toca en **`src/data/farkle-config.json`**, sin recompilar nada:
guardás el archivo y recargás el navegador.

| Clave | Qué hace |
|---|---|
| `round_target` | puntos para cerrar la ronda (**la palanca más fuerte de duración**) |
| `cheat_probability` | cuánto hace trampa Daku por tiro |
| `ai_aggression` | cuánto arriesga antes de plantarse |
| `starting_emp` / `max_emp` | cargas de acusación |
| `emp_per_drink` | cuánto recarga cada trago |
| `sobriety_loss_per_drink` | cuánto te ciega cada trago |
| `cheat_flash_ms_sober` / `_drunk` | cuánto dura el destello de la trampa, sobrio y borracho |
| `double_or_nothing_threshold` | prendas perdidas de Daku antes de que proponga doble o nada |
| `none_caught_min_cheats` | trampas mínimas para que valga el ending "Sabías" |

---

## Notas de implementación

- El ending de **empate** necesita que los dos lleguen a la última prenda **y** que
  esa ronda termine empatada en puntos. Es rarísimo (0 de 1600 partidas simuladas).
  Si lo querés alcanzable, la palanca es aflojar la condición.
- Las trampas se disparan en dos momentos de distracción: **mientras leés el taunt
  de Daku** y **mientras pedís un trago**. Los otros dos momentos del GDD (elegir
  respuesta, y cuando alguien se quita ropa) no tienen dados en la mesa en este
  flujo, así que quedaron fuera.
- Durante el playtesting podés inspeccionar el estado desde la consola del
  navegador: `window.game.scene.getScene('Farkle')`.

---

## Nitidez del texto — no volver a romperlo

El canvas mide **800×600 píxeles reales** y tiene que mostrarse a **exactamente
ese tamaño**. Si el CSS lo estira a un tamaño fraccionario (por ejemplo 746,66
para "que entre en la ventana"), cada píxel de texto cae entre dos píxeles de
pantalla y las serifas se ven borrosas. El arte lo disimula; el texto no.

Medido:

| ventana | contenedor CSS | factor de escala | resultado |
|---|---|---|---|
| 1280×800 | 800,00 × 600,00 | 1,0000 | nítido |
| 1000×560 | 746,66 × 559,98 | 0,9333 | borroso |

Por eso, en `index.html`:

- `#game` tiene `width: 800px; height: 600px` fijos — **no** `min()`,
  **no** `aspect-ratio`, **no** `height: auto`.
- El canvas **no** lleva `width/height: 100% !important`.
- `margin: auto` en vez de `justify-content: center`, para que si la ventana
  es más chica el desborde se pueda alcanzar con scroll en lugar de quedar
  cortado.

Y en `src/main.js`:

- `scale.mode: Phaser.Scale.NONE` (FIT reintroduce el escalado fraccionario).
- `roundPixels: true`, para que un texto con `setOrigin(0.5)` no caiga en x,5.
- **Nada de `resolution:` en la config** — Phaser 3 lo ignora, no hace nada.

Si alguna vez hay que soportar pantallas chicas de verdad, la solución correcta
no es estirar el canvas: es subir la resolución del canvas al tamaño real de
pantalla y compensar con `camera.setZoom()` más `Text.setResolution()`. Eso es
una refactorización de las coordenadas, no un cambio de CSS.

### La segunda causa: las webfonts no se descargaban

Poner `ctx.font = '19px Spectral'` en un canvas **no** hace que el navegador
baje esa fuente. El navegador solo la descarga cuando un elemento del **DOM**
la necesita. Como `index.html` no tiene ningún texto HTML, Spectral y Cormorant
Garamond nunca se pedían y Phaser rasterizaba todo el juego en Georgia, sin
avisar por consola.

Peor: Phaser dibuja cada texto **una sola vez** y no lo rehace cuando la fuente
llega tarde. Por eso `src/main.js` ahora hace `document.fonts.load()` de cada
combinación y **espera** antes de crear el juego (con un límite de 2,5 s para
no colgarse si no hay internet).

Si agregás una fuente o un peso nuevo, sumalo a la lista `FUENTES` de `main.js`
o no se va a ver.

### Tamaños medidos, no elegidos a ojo

`tests/nitidez.html` dibuja el texto del juego y calcula qué proporción de la
tinta cae en tonos intermedios — cuanto más alto, más difusa se ve la letra:

| | tinta intermedia |
|---|---|
| Spectral 400 a 15px | era lo que había, el peor |
| Cormorant Garamond a 19px | 58,8 % |
| Spectral 400 a 17px | 52,7 % |
| Georgia 400 a 17px | 45,3 % |
| **Spectral 600 a 19px** | **45,2 %** ← lo que usamos |

Cormorant Garamond es una fuente de **titular**: a 19px sus trazos finos no
llegan a ocupar un píxel entero. Sirve para el título a 52px, no para nombres.

Los tamaños viven en `F` dentro de `src/theme.js`. Si los tocás, volvé a correr
`tests/nitidez.html`. Y si agrandás el cuerpo, revisá que el guion siga
entrando: la línea más larga de `dialogues.json` ocupa 3 renglones (124px) y el
cuadro más chico tiene 154px.
