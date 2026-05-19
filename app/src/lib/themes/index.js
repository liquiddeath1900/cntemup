import { gameboy } from './gameboy'
import { knicks } from './knicks'
import { ducklehunt } from './ducklehunt'

export const themes = {
  gameboy,
  knicks,
  ducklehunt,
}

export const themeList = [gameboy, knicks, ducklehunt]

export const DEFAULT_THEME = 'gameboy'

export function getTheme(id) {
  return themes[id] || themes[DEFAULT_THEME]
}
