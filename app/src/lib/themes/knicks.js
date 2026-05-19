// Knicks / NBA Jam theme — MSG hardwood vibe.
// Count = real basketball swish (sampled MP3 served from /sounds/swish.mp3).
// Alarm = end-of-quarter buzzer (sustained sawtooth horn).
import { createAudioCtx, playTone, playNoiseBurst, playSample } from './audioEngine'

const SWISH_URL = '/sounds/swish.mp3'

export const knicks = {
  id: 'knicks',
  label: 'Knicks',
  badge: '🏀',
  description: 'MSG hardwood. Swish + buzzer.',
  sounds: {
    count() {
      playSample(SWISH_URL, 0.85)
    },
    // Buzzer beater: sustained sawtooth, slightly detuned dual oscillator
    alarm() {
      const c = createAudioCtx()
      playTone(110, 1.2, 'sawtooth', 0.38, c)
      playTone(112, 1.2, 'sawtooth', 0.22, c)
    },
    // Arena horn — brassy fifth
    boot() {
      const c = createAudioCtx()
      playTone(330, 0.4, 'sawtooth', 0.3, c)
      playTone(495, 0.4, 'sawtooth', 0.25, c)
    },
    // Swish + crowd cheer
    success() {
      playSample(SWISH_URL, 0.7)
      setTimeout(() => playNoiseBurst(0.6, 0.12, 800, null, 0, 0.7), 120)
    },
    // Ref whistle
    error() {
      const c = createAudioCtx()
      playTone(2400, 0.12, 'sine', 0.25, c)
      playTone(2380, 0.12, 'sine', 0.2, c)
    },
  },
}
