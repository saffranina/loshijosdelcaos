# CLAUDE.md — Instrucciones para Claude Code
## Proyecto: Los hijos del caos: El último dado

---

## Resumen

Mini juego narrativo para web: visual novel interactiva + strip Farkle con gestión de recursos. El jugador es Reinhart y juega contra Daku en la habitación de un bar. 5 endings posibles. Contenido NSFW.

Universo: "Los hijos del caos" (Terhemin). Reinhart es estoico y directo. Daku es carismático y tramposo. Ya se conocen; hay tensión sexual y un conflicto narrativo (Rein busca información sobre el cónsul desaparecido Esry Inerun, que Daku ayudó a esconder).

---

## Stack

- **Motor:** Phaser.js 3.x
- **Lenguaje:** JavaScript (ES6+)
- **Resolución:** ~800×600, ventana centrada, fondo oscuro alrededor
- **Distribución:** HTML5 en itch.io (100% client-side, cero backend)
- **Control de versiones:** Git + GitHub

---

## Estilo visual

**Visual novel pura.** Estilo pintado a mano tipo Undertale / Fields of Mistria (no pixel art de cuadrícula).

Layout estándar (diálogo):
```
┌──────────────────────────────┐
│ [fondo atmosférico]          │
│                              │
│    [portrait grande           │
│     del que habla,           │
│     rodillas para arriba]    │
│                              │
├──────────────────────────────┤
│ Nombre:                      │
│ "Texto del diálogo"          │
│                              │
│ [Opción A] [B] [C]          │
└──────────────────────────────┘
```

Layout durante Farkle:
```
┌──────────────────────────────┐
│ [fondo habitación]           │
│                              │
│    [dados al centro]         │
│ [EMP: ███░░]   [🥃 Beber]   │
│                              │
│ [portrait Rein] [portrait Daku]│
├──────────────────────────────┤
│ Nombre:                      │
│ "Texto / taunt"              │
│                              │
│ [Acusar trampa] [Continuar]  │
└──────────────────────────────┘
```

- Portraits: grandes, anime, de rodillas para arriba, sobre el fondo
- Portraits usan sistema de capas: PNG base (desnudo) + capa de expresión (ojos/boca) + capas de ropa
- Dados: 6 imágenes estáticas de caras, animadas por Phaser (rotar, rebotar, caer con tweens)
- Splash arts: imágenes que ocupan toda la ventana del juego con transición fade

---

## Estructura del proyecto

```
la-estrella-de-mar/
├── index.html
├── package.json
├── CLAUDE.md
├── src/
│   ├── main.js
│   ├── scenes/
│   │   ├── BootScene.js
│   │   ├── TitleScene.js
│   │   ├── Act1Scene.js
│   │   ├── Act2Scene.js
│   │   ├── FarkleScene.js
│   │   └── EndingScene.js
│   ├── systems/
│   │   ├── DialogueSystem.js
│   │   ├── FarkleLogic.js
│   │   ├── DakuAI.js
│   │   ├── ClothingManager.js
│   │   ├── EMPSystem.js
│   │   ├── DrinkSystem.js
│   │   └── SplashScreen.js
│   └── data/
│       ├── dialogues.json
│       └── farkle-config.json
├── assets/  (proporcionados por la autora)
└── dist/    (build final para itch.io)
```

---

## Sistemas a implementar

### 1. DialogueSystem.js
- Cuadro de texto en parte inferior de la ventana
- Portrait del hablante encima del fondo (grande, rodillas para arriba)
- Texto progresivo (typewriter effect), click/tecla para avanzar
- Soporte para 2-3 opciones de respuesta
- Cambio de portrait por personaje, expresión, y estado de ropa
- Portraits usan sistema de capas: base + expresión + ropa (composición en runtime)
- Cargar diálogos desde dialogues.json

### 2. FarkleLogic.js
Reglas completas:
- 6 dados por turno
- Apartar al menos un dado de puntuación por tiro
- Continuar tirando o plantarse
- Sin dado de puntuación = Farkle (pierde puntos del turno)
- Puntuación: ver tabla en GDD
- Meta por ronda: 2000 puntos (desde farkle-config.json)
- Menos puntos al final de la ronda = pierde prenda
- Empate = ronda extra
- Doble o nada: cualquiera puede proponer, perdedor pierde 2 prendas

### 3. DakuAI.js
IA del oponente:
- Decisiones de riesgo: cuándo seguir tirando vs plantarse (agresividad configurable)
- **Sistema de trampas (telekinesis):**
  - ~25% probabilidad por turno (configurable)
  - Cambia valor de un dado DURANTE MOMENTOS DE DISTRACCIÓN:
    - Mientras el jugador lee un taunt de Daku
    - Mientras el jugador elige su respuesta de diálogo
    - Mientras el jugador pide una bebida (animación del trago)
    - Cuando Daku se quita una prenda (jugador mira el portrait)
  - Animación visual sutil del dado que cambió (brillo/temblor leve)
  - La sutileza de la animación escala con la ebriedad del jugador (más borracho = más difícil ver)
- Estrategia de trampas:
  - Trampas pequeñas al principio para gastar EMP del jugador
  - Trampas grandes al final cuando el jugador tiene pocas cargas
  - Si lo pillan mucho, se vuelve más sutil

### 4. EMPSystem.js
Recurso de acusación:
- Barra con cargas (empieza con 3, máximo configurable)
- Acusar trampa gasta 1 carga
- Acusación correcta → Daku pierde el turno
- Acusación incorrecta → Rein pierde el turno + pierde la carga
- Se recarga con alcohol (+1 por trago, desde DrinkSystem)
- Sin EMP = no puede acusar
- Botón "Acusar trampa" aparece SIEMPRE después de cada tiro de Daku (haya o no trampa)

### 5. DrinkSystem.js
Sistema de bebidas:
- Botón para pedir trago disponible entre turnos
- +1 carga de EMP por trago
- Baja nivel de sobriedad por trago
- Efectos visuales de ebriedad (escalan con tragos):
  - Dados ligeramente distorsionados/borrosos
  - Animación de trampa más sutil
  - Números de dados ambiguos (¿3 o 5?)
  - Posible leve bamboleo de la pantalla
- Beber es un momento de distracción donde Daku puede hacer trampa

### 6. ClothingManager.js
- 6 prendas por personaje: chaqueta, zapatos, medias, camisa, pantalón, ropa interior
- Perder ropa interior = perder juego
- Actualiza portrait (quita capa de ropa del composite)
- Track del estado para condiciones de ending

### 7. SplashScreen.js
- Imagen fullscreen dentro de la ventana del juego
- Transición fade in / fade out
- Click o tecla para continuar

---

## Endings y condiciones

```javascript
// Pseudocódigo de condiciones
if (empate_final) {
    // Ambos pierden ropa interior en la misma ronda
    ending = "TIE"; // Splash: 69
} else if (todas_trampas_acusadas_correctamente && cero_falsas_acusaciones) {
    ending = "ALL_CAUGHT"; // Splash: vulnerable
} else if (daku_hizo_trampa_multiple && cero_acusaciones_hechas) {
    ending = "NONE_CAUGHT"; // Splash: "sabías"
} else if (rein_gana) {
    ending = "REIN_WINS"; // Splash: Rein top
} else {
    ending = "DAKU_WINS"; // Splash: Daku top
}
```

Los endings secretos tienen prioridad sobre los principales. Si se cumple la condición de ALL_CAUGHT o NONE_CAUGHT, esos ganan independientemente de quién perdió la ropa.

---

## Formato de dialogues.json

```json
{
  "act1": {
    "entrance": [
      { "speaker": "narrator", "text": "La Estrella de Mar..." },
      { "speaker": "daku", "expression": "smile", "text": "Cuánto tiempo." }
    ]
  },
  "act2": {
    "negotiation": [
      {
        "choice": true,
        "speaker": "rein",
        "options": [
          { "label": "Agresivo", "text": "Dime dónde está Esry.", "next": "esry_aggressive" },
          { "label": "Diplomático", "text": "Necesito hablar sobre Esry.", "next": "esry_diplomatic" },
          { "label": "Directo", "text": "Esry Inerun. ¿Qué sabes?", "next": "esry_direct" }
        ]
      }
    ],
    "esry_aggressive": [],
    "esry_diplomatic": [],
    "esry_direct": []
  },
  "farkle_taunts": {
    "rein": {
      "provoke": {
        "clothed": ["..."],
        "half_stripped": ["..."],
        "nearly_naked": ["..."]
      },
      "flirt": {
        "clothed": ["..."],
        "half_stripped": ["..."],
        "nearly_naked": ["..."]
      },
      "stoic": {
        "clothed": ["..."],
        "half_stripped": ["..."],
        "nearly_naked": ["..."]
      }
    },
    "daku": {
      "winning": { "clothed": [], "half_stripped": [], "nearly_naked": [] },
      "losing": { "clothed": [], "half_stripped": [], "nearly_naked": [] },
      "caught_cheating": [],
      "false_accusation": [],
      "opponent_stripped": { "half_stripped": [], "nearly_naked": [] },
      "double_or_nothing_propose": [],
      "drink_reaction": []
    }
  },
  "act4": {
    "rein_wins": [],
    "daku_wins": [],
    "tie": [],
    "all_caught": [],
    "none_caught": []
  }
}
```

Los taunts se categorizan por nivel de desnudez para que escalen en intensidad sexual:
- **clothed:** indirectas y competitividad
- **half_stripped:** insinuaciones
- **nearly_naked:** descarados

---

## Formato de farkle-config.json

```json
{
  "round_target": 2000,
  "cheat_probability": 0.25,
  "ai_aggression": 0.6,
  "starting_emp": 3,
  "max_emp": 5,
  "emp_per_drink": 1,
  "sobriety_loss_per_drink": 0.2,
  "clothing_order": ["jacket", "shoes", "socks", "shirt", "pants", "underwear"],
  "dice_count": 6,
  "double_or_nothing_threshold": 3
}
```

---

## Notas de desarrollo

- **Fase de prototipo:** Usar rectángulos de colores para todos los assets visuales. La lógica y el texto deben funcionar completos antes de integrar arte.
- **Assets son proporcionados por la autora.** No generar arte. Esperar a que entregue los PNGs.
- **100% client-side.** Sin backend, sin base de datos.
- **Build final:** Carpeta con index.html + assets → ZIP → itch.io.
- **Testear en Chrome y Firefox.**
- **Contenido NSFW.** Los splash arts de endings contienen contenido sexual explícito. Programáticamente son PNGs normales.
- **La autora (Deb) trabaja a través de Claude (chat) para diseño y diálogos, y directamente con Claude Code para programación.** Ella toma todas las decisiones creativas y provee todos los assets pintados a mano.

---

## Estado del código (actualizado por Claude Code)

El prototipo de la Fase 2 está completo. Antes de tocar nada, leer `README.md`.

Diferencias entre este documento y lo que existe en el repo:

- **Sin Node.** Se corre con `jugar.bat` (servidor de Python). No hay
  `npm install` ni build step para desarrollar. `package.json` está solo por si
  más adelante se agrega uno.
- **Nada viene de internet.** Phaser y las dos tipografías están guardados en
  `vendor/`. Antes se pedían al CDN de jsdelivr y a Google Fonts; sin conexión
  el juego no arrancaba y los títulos se caían a Georgia. No volver a poner un
  `<link>` o un `<script>` a un dominio externo.
- **`tools/empaquetar.py` arma el paquete para regalar.** Genera en `dist/` una
  carpeta que se juega con doble clic en `Jugar.html`, sin servidor y sin
  instalar nada — es lo que se le pasa a alguien para que pruebe el juego.
  Para eso une los módulos de `src/` en un solo archivo, incrusta los JSON y
  las tipografías, y `src/main.js` cambia a renderer de canvas cuando detecta
  `file://`. El README lo explica; el propio script, con más detalle.
- Se agregaron tres módulos que no estaban en la lista original:
  `GameState.js` (estado compartido entre escenas), `Dice.js` (el dado pintado por
  código) y `Ui.js` (botones y paneles). `theme.js` centraliza la paleta.
- `VNScene.js` es la clase base de los actos de visual novel (1, 2 y 4).
- Todo el arte es opcional: si un PNG no existe, se dibuja un placeholder.
  No agregar chequeos de "si falta el asset" — ya está resuelto en
  `Portraits.js`, `SplashScreen.js` y `VNScene.js`.

### Reglas de trabajo

- Los diálogos son de la autora. **No inventar ni reescribir líneas.**
  `dialogues.json` es una transcripción fiel del guion; si hay que ampliar pools de
  taunts, se los pide a ella.
- El balance se toca en `farkle-config.json`, nunca hardcodeado en el código.
- Antes de dar por buena una cambio en las reglas, correr `tests/test.html` y
  `tests/sim.html`.
