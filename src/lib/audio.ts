let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(frequency: number, duration: number, gain = 0.3): void {
  const audioCtx = getCtx();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(gain, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);

  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + duration / 1000);
}

export function playSuccess(): void {
  beep(800, 200);
}

export function playError(): void {
  beep(300, 500);
}
