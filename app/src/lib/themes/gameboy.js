// Game Boy DMG theme — the existing production look + sound.
// All theme profiles export the same surface: { id, label, badge, sounds }
import { createAudioCtx, playTone } from './audioEngine'

export const gameboy = {
  id: 'gameboy',
  label: 'Game Boy',
  badge: '🎮',
  description: 'Classic DMG green. Square-wave chirps.',
  sounds: {
    // Short ascending double beep — coin pickup feel
    count() {
      const c = createAudioCtx()
      playTone(880, 0.06, 'square', 0.25, c)
      setTimeout(() => playTone(1175, 0.08, 'square', 0.2, c), 60)
    },
    // Three rapid descending beeps, repeated — urgent attention grab
    alarm() {
      const c = createAudioCtx()
      playTone(1047, 0.1, 'square', 0.35, c)
      setTimeout(() => playTone(880, 0.1, 'square', 0.35, c), 120)
      setTimeout(() => playTone(698, 0.15, 'square', 0.35, c), 240)
      setTimeout(() => playTone(1047, 0.1, 'square', 0.35, c), 500)
      setTimeout(() => playTone(880, 0.1, 'square', 0.35, c), 620)
      setTimeout(() => playTone(698, 0.15, 'square', 0.35, c), 740)
    },
    boot() {
      playTone(262, 0.12, 'square', 0.3)
      setTimeout(() => playTone(523, 0.25, 'square', 0.35), 130)
    },
    success() {
      playTone(523, 0.08, 'square', 0.2)
      setTimeout(() => playTone(659, 0.08, 'square', 0.2), 80)
      setTimeout(() => playTone(784, 0.12, 'square', 0.2), 160)
    },
    error() {
      playTone(220, 0.15, 'square', 0.2)
    },
  },
}
