// Sfx.js — efectos de sonido cortos, sintetizados en el momento.
//
// No hay archivos de audio para esto todavía, así que en vez de esperar los
// assets se generan con WebAudio: son ruidos muy breves (5 a 60 ms) y salen
// más livianos que cualquier .mp3. Cuando haya sonidos pintados a mano, se
// reemplaza el cuerpo de cada función por scene.sound.play('...') y el resto
// del juego no cambia.
//
// Todo pasa por un único nodo de volumen para poder silenciarlo de una.

let ctx = null;
let master = null;
let apagado = false;

function audio() {
  if (apagado) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { apagado = true; return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  // El navegador suspende el contexto hasta que hay un gesto del usuario.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Ruido blanco corto, la base de los golpes secos (dados, teclas). */
function golpe({ dur = 0.03, vol = 0.2, corte = 3000, tipo = 'bandpass', q = 1 } = {}) {
  const c = audio();
  if (!c) return;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, n, c.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) {
    // Ruido que se apaga rápido: da la sensación de impacto, no de zumbido.
    datos[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;

  const filtro = c.createBiquadFilter();
  filtro.type = tipo;
  filtro.frequency.value = corte;
  filtro.Q.value = q;

  const g = c.createGain();
  g.gain.value = vol;

  src.connect(filtro); filtro.connect(g); g.connect(master);
  src.start();
}

/** Una letra del typewriter. Muy corto y muy bajo: se escucha en ráfaga. */
export function tecla() {
  golpe({
    dur: 0.012,
    vol: 0.05,
    // Un poco de variación de tono para que no suene a metrónomo.
    corte: 1700 + Math.random() * 900,
    q: 1.6,
  });
}

/** Apartar o soltar un dado: un clic seco de marfil. */
export function dadoElegido() {
  golpe({ dur: 0.035, vol: 0.16, corte: 2600 + Math.random() * 600, q: 2.2 });
}

/** Tirada: varios golpes seguidos, como los dados rebotando en la mesa. */
export function dadosLanzados(cantidad = 6) {
  const c = audio();
  if (!c) return;
  const rebotes = Math.min(9, 3 + cantidad);
  for (let i = 0; i < rebotes; i++) {
    const t = 30 + i * (55 + Math.random() * 70);
    setTimeout(() => golpe({
      dur: 0.05,
      vol: 0.2 * (1 - i / rebotes) + 0.04,
      corte: 900 + Math.random() * 1400,
      q: 1.2,
    }), t);
  }
}

/** Silencia o reactiva todos los efectos. */
export function silenciar(v) {
  if (master) master.gain.value = v ? 0 : 0.5;
}
