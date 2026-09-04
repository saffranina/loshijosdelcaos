# Los hijos del caos: El último dado — estado del juego

Documento de contexto para trabajar los diálogos con otra IA.
Actualizado el 4 de septiembre de 2026. Refleja el código tal como está,
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

## 3. El sistema de finales

Hay **dos finales** y un game over. Además, dos **preludios**: escenas que se
juegan *antes* del final si se leyó a Daku de una forma concreta.

| Final | Líneas | ¿Se ve? | Splash |
|---|---|---|---|
| `rein_wins` | 20 | Sí | Existe |
| `daku_wins` | 13 | Sí | Existe |
| Game over por alcohol | 4 | Sí | No tiene, y no lo necesita |

| Preludio | Líneas | Cuándo |
|---|---|---|
| `all_caught_prelude` | 10 | Cazó todas las trampas y no acusó ni una vez en falso |
| `none_caught_prelude` | 13 | Daku hizo 3+ trampas y el jugador no acusó jamás |

**Los preludios no sustituyen al final.** Van delante: se juega el preludio, y
después el final normal con su splash. Quien gana sigue ganando. Por eso estas
dos escenas **no necesitan arte propio**.

Las dos condiciones son mutuamente excluyentes: cazarlas todas exige haber
acusado, y la otra exige no haber acusado nunca.

Los umbrales se tocan en `farkle-config.json`:
`all_caught_min_cheats` (1) y `none_caught_min_cheats` (3).

### Cuánto se ven (2000 partidas simuladas por estilo)

| Estilo de jugador | all_caught | none_caught |
|---|---|---|
| Normal (pilla ~80%, acusa de más a veces) | 14,2% | 0,3% |
| Ojo perfecto (pilla todas, nunca falla) | 98,7% | 0% |
| Nunca acusa | 0% | **92,5%** |
| Acusa a lo loco | 0% | 0% |

---

## 4. Historial de esta decisión

Los dos preludios **eran** finales completos y separados, de 20 y 29 líneas,
que sustituían al de ganar/perder y pedían cada uno su propio splash. Nunca se
podían ver jugando: el código no comprobaba la condición.

La autora decidió convertirlos en preludios, más cortos, y reescribió el texto
quitando todo lo que presuponía un desenlace concreto — antes había líneas como
*"la ropa da igual"* o *"no vine a ganar"*, que chocaban con el final de quién
gana. También quitó la mención al doble o nada, una mecánica que no existe.

El texto anterior sigue en el historial de git por si hace falta.

---

## 5. El texto actual de los preludios

### `all_caught_prelude` (10 líneas)

```
stage: Antes de que ninguno se mueva, Daku se detiene.
daku:  Las viste todas.
rein:  Todas.
daku:  ¿Cómo? Nadie— nunca nadie—
rein:  Te estaba mirando.
daku:  No. Todos me miran. Tú me estabas viendo. De verdad.
stage: Silencio. Cuando Daku habla, no sonríe.
daku:  No me mires así, Diermissen.
rein:  ¿Así cómo?
daku:  Como si me conocieras.
```

### `none_caught_prelude` (13 líneas)

```
daku:  Buena partida, soldadito.
stage: Pausa. Rein no dice nada.
daku:  ¿No me vas a decir que hice trampa?
rein:  No.
daku:  ¿Por qué no?
rein:  Porque ya lo sé.
stage: La sonrisa de Daku se congela.
daku:  ...¿Qué?
rein:  El tercer tiro. El quinto. El octavo.
daku:  Los viste.
rein:  Los vi todos.
daku:  ¿Y no dijiste nada?
stage: Rein no responde. No necesita hacerlo.
```

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
  `{ "splash": "ending_rein_wins", "caption": "descripción" }`

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
Sus líneas de diálogo (`act3.double_or_nothing`) están escritas sin usarse.

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
