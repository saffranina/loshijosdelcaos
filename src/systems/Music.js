let current = null;
let currentKey = null;

export function playMusic(scene, key, volume = 0.34) {
  if (!scene.cache.audio.exists(key)) return;
  if (currentKey === key && current?.isPlaying) return;
  if (current) {
    current.stop();
    current.destroy();
  }
  currentKey = key;
  current = scene.sound.add(key, { loop: true, volume });
  current.play();
}

export function stopMusic() {
  if (current) {
    current.stop();
    current.destroy();
  }
  current = null;
  currentKey = null;
}
