# Los hijos del caos: El último dado — estado del juego

Documento de contexto para trabajar los diálogos con otra IA.
Escrito el 3 de septiembre de 2026. Refleja el código tal como está,
no el diseño original.

---

## 1. Qué es

Mini juego narrativo para web: novela visual + partidas de **Farkle** (juego de
dados) con gestión de recursos y ropa. El jugador es **Reinhart** (Rein), un
sargento estoico y directo. El oponente es **Daku**, carismático y tramposo.

Ya se conocen. Hay tensión sexual y un conflicto: Rein busca información sobre
el cónsul desaparecido Esry Inerun, a quien Daku ayudó a esconder.

Contenido NSFW. Universo propio ("Los hijos del caos" / Terhemin).

Técnico: Phaser 3.80.1, JavaScript, 800×600, 100% en el navegador, sin
servidor. Los diálogos viven en `src/data/dialogues.json`.

---

## 2. Cómo se juega ahora mismo

**Estructura:** Acto 1 (bar) → Acto 2 (negociación, subir a la habitación) →
Acto 3 (el Farkle) → Acto 4 (final).

**Las prendas son tres:** camisa, pantalón, ropa interior. En ese orden.

**Cada ronda de Farkle** se juega a 2000 puntos. Quien menos puntúa al final de
la ronda pierde **una** prenda.

**Se pierde la partida al quedarse sin las tres.** No hay número fijo de
rondas: si van 2–2, se juega otra. El mínimo son 3 rondas y el máximo 5.

> Esto se corrigió hace poco. Antes eran exactamente 3 rondas y ganaba quien
> hubiera ganado más, lo que hacía que el 71% de las partidas terminaran con
> los dos todavía vestidos.

**Importante para el arte:** los sprites solo llegan hasta ropa interior. Al
perder la tercera prenda la partida termina, pero **el personaje nunca se
muestra desnudo**. Es una limitación asumida.

### Los tres recursos

| Recurso | Qué hace |
|---|---|
| **EMP** | Cargas para acusar a Daku de hacer trampa. Empieza con 5, máximo 5. |
| **Alcohol** | Un trago da +1 EMP pero baja la sobriedad. A sobriedad 0 se pierde. |
| **Ropa** | Tres prendas. Perder las tres es perder. |

### Las trampas de Daku

Daku mueve un dado con telequinesis mientras el jugador está distraído (leyendo
un taunt, pidiendo un trago). El dado cambia de cara y aparece **un borde
violeta que se desvanece**, más un tembleque breve.

La duración del brillo escala con la borrachera: **520 ms sobrio, 170 ms
bebido**. Cuanto más bebes, más difícil verlo.

Probabilidad: 25% base, +12% si Daku va perdiendo, −7% por cada vez seguida que
lo pillan. En rondas tempranas hace trampas pequeñas; en las últimas, grandes.

El botón de acusar aparece **siempre**, haya trampa o no. Acertar hace que Daku
pierda el turno; fallar hace que lo pierda Rein y gasta la carga igual.

---

## 3. El sistema de finales — aquí está el problema

Hay **cuatro finales escritos** más un game over. Pero el código solo produce
tres de ellos.

| Final | Líneas escritas | ¿Se puede ver jugando? | Splash |
|---|---|---|---|
| `rein_wins` | 20 | Sí | Existe |
| `daku_wins` | 13 | Sí | Existe |
| `all_caught` | 20 | **No** | **Falta** |
| `none_caught` | 29 | **No** | **Falta** |
| Game over por alcohol | 4 | Sí | No tiene, y no lo necesita |

`resolveEnding()` en `src/systems/GameState.js` solo mira quién se quedó sin
ropa. Nunca comprueba si el jugador cazó todas las trampas o ninguna. Las 49
líneas de los dos finales secretos **llevan desde el principio sin poder
verse**.

### Lo que haría falta para activarlos

El estado del juego ya lleva la cuenta de todo lo necesario: trampas totales,
trampas cazadas, acusaciones hechas y acusaciones falsas. La condición del
diseño original es:

```
all_caught   → cazó todas las trampas Y cero acusaciones falsas
none_caught  → Daku hizo varias trampas Y el jugador no acusó ni una vez
```

Son unas cinco líneas de código. **La parte difícil no es programarlo.**

### Cuánto se verían (medido sobre 2000 partidas simuladas por estilo)

| Estilo de jugador | all_caught | none_caught |
|---|---|---|
| Normal (pilla ~80%, acusa de más a veces) | 14,2% | 0,3% |
| Ojo perfecto (pilla todas, nunca falla) | 98,7% | 0% |
| Nunca acusa | 0% | **92,5%** |
| Acusa a lo loco | 0% | 0% |

Las condiciones funcionan bien como diseño: premian dos formas opuestas y
deliberadas de jugar.

---

## 4. LA PREGUNTA ABIERTA (esto es lo que hay que resolver)

La autora **no está convencida** de dos cosas:

1. Que `all_caught` y `none_caught` deban ser **finales aparte** que sustituyen
   al de "gana Rein / gana Daku".
2. Que sean **tan largos** (20 y 29 líneas, frente a 13–20 de los normales).

Su propuesta alternativa: que el splash de la escena secreta vaya **antes** del
splash final de quién ganó, como una escena extra en vez de un final completo.

### El argumento en contra (para tenerlo en cuenta)

Al leer el texto actual, los dos parecen finales completos que **contradicen**
al final de quién gana:

- En `all_caught`, Daku dice literalmente *"y no hablo de la ropa. **La ropa da
  igual**"*. Toda la escena va de que el resultado del juego dejó de importar.
- En `none_caught`, Rein dice *"**no vine a ganar**"*: reveló que perdió a
  propósito. La escena ya presupone un resultado concreto.

Encadenar después un splash de victoria chocaría con esas líneas.

### Lo que se busca

Decidir una de estas tres, y reescribir el texto en consecuencia:

- **A.** Se quedan como finales completos que sustituyen al normal, pero **más
  cortos** (bajarlos a ~12–15 líneas).
- **B.** Se convierten en **escenas previas** al final normal, y entonces hay
  que quitarles todo lo que presupone un desenlace ("la ropa da igual", "no
  vine a ganar") para que encajen con cualquier resultado.
- **C.** Otra estructura.

---

## 5. El texto actual de los dos finales

### `all_caught` (20 líneas)

```
stage: Rein acusó cada trampa. Ninguna falsa acusación.
daku:  ...
stage: Daku está quieto. No sonríe. La máscara se cayó.
daku:  Las viste todas.
rein:  Todas.
daku:  ¿Cómo? ¿Cómo es posible? Nadie— Nunca nadie—
rein:  Te estaba mirando.
daku:  No. Todos me miran. Todos. Todo el tiempo. Pero tú... tú me estabas
       viendo. De verdad.
stage: Silencio largo. Daku baja la mirada. Cuando la sube, no hay sonrisa. No
       hay coqueteo. No hay juego.
daku:  ¿Sabes lo que se siente? ¿Que alguien vea cada truco? ¿Cada movimiento?
       No se siente como perder un juego. Se siente como... estar desnudo. Y no
       hablo de la ropa. La ropa da igual.
stage: Pausa.
daku:  Petri nunca me vio así. Ella ve lo que uso. Lo que hago. No lo que soy.
       Nadie ve lo que soy.
stage: Su voz se quiebra un milímetro. Lo controla.
daku:  No me mires así, Diermissen.
rein:  ¿Así cómo?
daku:  Como si me conocieras.
stage: Silencio.
rein:  ¿Y si te conozco?
stage: Daku no tiene respuesta. Se acerca despacio. Sin juegos. Sin actuación.
       Solo él.
[SPLASH: ending_all_caught] Escena íntima. Suave. Vulnerable. Diferente a
todos los otros endings.
```

### `none_caught` (29 líneas)

```
daku:  Buena partida, soldadito. Un poco fácil, pero buena.
stage: Pausa. Rein no dice nada.
daku:  ¿No me vas a decir que hice trampa?
rein:  No.
daku:  ¿Por qué no?
stage: Silencio.
rein:  Porque ya lo sé.
stage: La sonrisa de Daku se congela.
daku:  ...¿Qué?
rein:  El tercer tiro. El quinto. El octavo. El del doble o nada.
daku:  Los viste.
rein:  Los vi todos.
daku:  ¿Todos? ¿Y no dijiste nada? ¿Por qué?
stage: Pausa larga. Rein lo mira directamente.
rein:  Porque no vine a ganar.
stage: Silencio absoluto.
daku:  ...Sabías. Desde el principio.
rein:  Desde el principio.
daku:  Sabías y dejaste que yo... todo esto... las trampas, el juego, el—
rein:  Sí.
daku:  Entonces yo nunca tuve el control.
rein:  No.
stage: Daku lo mira. Algo se desarma. Todo lo que fue esta noche — la sonrisa,
       las trampas, la seducción, el juego — fue de Daku. Y de pronto no. De
       pronto nunca lo fue.
daku:  ¿Por qué?
rein:  Porque quería que eligieras.
stage: Silencio.
stage: Y Daku entiende. Rein le dio el control a propósito. Le dio la victoria.
       No porque no pudiera ganar — sino porque quería que Daku tuviera la
       elección. La elección que nunca tiene.
stage: Por primera vez en la noche, es Rein quien se acerca.
[SPLASH: ending_none_caught] NSFW — el poder se invirtió, pero no por la
fuerza. Por la entrega.
```

**Ojo con una línea:** en `none_caught`, Rein menciona *"el del doble o nada"*.
El doble o nada **no existe en el juego** (ver cabos sueltos). Esa línea hay que
retocarla o implementar la mecánica.

---

## 6. Formato de los diálogos

Todo vive en `src/data/dialogues.json`. Una línea normal:

```json
{ "speaker": "daku", "expression": "flirty", "text": "Cuánto tiempo." }
```

- **`speaker`**: `rein`, `daku`, `nuri` (la camarera), `narrator`, `stage`
  (acotación, se ve en cursiva y sin nombre).
- **`expression`** (solo rein y daku): `neutral`, `smile`, `flirty`, `smug`,
  `surprised`, `dice`.
- Un splash a pantalla completa:
  `{ "splash": "ending_all_caught", "caption": "descripción" }`

También existen **intercambios**: una entrada puede ser una lista de líneas que
van siempre juntas, en vez de un texto suelto.

```json
[
  { "speaker": "daku", "text": "Disfrútalo, Diermissen." },
  { "speaker": "rein", "text": "No necesitaba permiso." }
]
```

### Cuánto texto hay ya escrito

- Acto 1: 37 entradas · Acto 2: 38 repartidas en 3 ramas
- Taunts de Rein: 46 (3 tonos × 3 niveles de desnudez)
- Taunts de Daku: 46
- Al perder prenda: 6 por personaje
- Al sacar más de 1000 puntos de golpe: 4
- Al pillar trampa: 3 · Acusación falsa: 2

Los taunts se organizan por **tono** (provocar / coquetear / estoico) y por
**nivel de desnudez** (`clothed` / `half_stripped` / `nearly_naked`), para que
la intensidad sexual escale a lo largo de la partida.

---

## 7. Cabos sueltos conocidos

**El doble o nada no existe.** `offerDoubleOrNothing()` está escrito pero no lo
llama nadie, y aunque lo hiciera, al perder la ronda se quita una prenda igual.
Sus líneas de diálogo (`act3.double_or_nothing`) están escritas sin usarse. Un
final las menciona.

**Falta el arte de dos finales.** `ending_all_caught` y `ending_none_caught` no
existen como PNG. Sin ellos, ese momento se ve como un rectángulo de color.

**`none_caught_min_cheats` está en la configuración pero no lo usa nadie.** Otro
resto de los finales secretos nunca implementados.

**El texto del game over por alcohol está dentro del código**, en
`EndingScene.js`, no en el JSON como todo lo demás. Son 4 líneas.

**No hay final de empate.** Existía escrito y se eliminó: como cada ronda la
pierde uno solo, los dos no pueden quedarse sin ropa a la vez.

---

## 8. Restricciones al escribir

- **Español neutro.** Nada de voseo rioplatense. El texto usa "tú" (*"haz clic",
  "debes elegir", "relájate"*).
- **Las voces:** Rein es seco, corto, directo; casi nunca adorna. Daku habla
  más, provoca, usa diminutivos ("soldadito") y llama a Rein por el apellido
  ("Diermissen") o por el rango ("sargento").
- **El diálogo es de la autora.** Cualquier línea nueva la decide ella.
- **NSFW explícito**, pero solo en los splash finales; el diálogo sugiere.
