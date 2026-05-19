// Duck Hunt / Mario theme — NES era SFX, all procedural square waves.
// Count = Mario coin chirp. Alarm = Duck Hunt dog laugh.
import { createAudioCtx, playTone } from './audioEngine'

export const ducklehunt = {
  id: 'ducklehunt',
  label: 'Duck Hunt',
  badge: '🦆',
  description: 'NES coins + dog laugh.',
  sounds: {
    // Mario coin: B5 → E6 ka-ching
    count() {
      const c = createAudioCtx()
      playTone(988, 0.08, 'square', 0.3, c)
      setTimeout(() => playTone(1319, 0.18, 'square', 0.3, c), 80)
    },
    // Duck Hunt dog laugh — three descending tones with a faint harmonic
    alarm() {
      const c = createAudioCtx()
      const notes = [880, 700, 520]
      notes.forEach((f, i) => {
        setTimeout(() => {
          playTone(f, 0.12, 'square', 0.3, c)
          playTone(f * 1.5, 0.12, 'square', 0.1, c)
        }, i * 160)
      })
    },
    // Super Mario Bros overworld opening 4-note phrase
    boot() {
      const c = createAudioCtx()
      const seq = [
        [659, 0],
        [659, 150],
        [659, 420],
        [523, 580],
        [659, 720],
        [784, 1000],
      ]
      seq.forEach(([f, t]) => setTimeout(() => playTone(f, 0.12, 'square', 0.3, c), t))
    },
    // 1-up jingle: E5 G5 E6 C6 D6 G6
    success() {
      const c = createAudioCtx()
      const seq = [
        [659, 0],
        [784, 100],
        [1319, 200],
        [1047, 300],
        [1175, 400],
        [1568, 500],
      ]
      seq.forEach(([f, t]) => setTimeout(() => playTone(f, 0.1, 'square', 0.3, c), t))
    },
    // SMB pipe bump
    error() {
      const c = createAudioCtx()
      playTone(196, 0.1, 'square', 0.3, c)
      setTimeout(() => playTone(147, 0.15, 'square', 0.3, c), 100)
    },
  },
}
