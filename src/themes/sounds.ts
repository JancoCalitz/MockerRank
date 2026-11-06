import { getPreference } from './store.ts';

// Short retro tones, made in the browser so there are no audio files to download. They only play
// when sounds are switched on in the theme menu.

type Sound = 'run' | 'pass';

// Each note: frequency in Hz, start and length in seconds.
const NOTES: Record<Sound, [number, number, number][]> = {
  run: [[880, 0, 0.06]],
  pass: [
    [523, 0, 0.1],
    [659, 0.09, 0.1],
    [784, 0.18, 0.18],
  ],
};

let audio: AudioContext | null = null;

export function playSound(sound: Sound) {
  if (!getPreference('sounds') || typeof AudioContext === 'undefined') return;
  audio ??= new AudioContext();
  const start = audio.currentTime;
  for (const [frequency, offset, length] of NOTES[sound]) {
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.type = 'square';
    tone.frequency.value = frequency;
    volume.gain.setValueAtTime(0.06, start + offset);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + offset + length);
    tone.connect(volume).connect(audio.destination);
    tone.start(start + offset);
    tone.stop(start + offset + length);
  }
}
