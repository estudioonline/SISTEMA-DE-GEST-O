import {useEffect, useState} from 'react'
import {readThemePreference, resolveDark, saveThemePreference, THEME_STORAGE_KEY} from './theme'
import type {ThemePreference} from './theme'

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try { return readThemePreference(window.localStorage) } catch { return 'system' }
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const dark = resolveDark(preference, systemDark)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const changed = () => setSystemDark(media.matches)
    changed()
    media.addEventListener('change', changed)
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        try { setPreference(readThemePreference(window.localStorage)) } catch { setPreference('system') }
      }
    }
    window.addEventListener('storage', sync)
    return () => { media.removeEventListener('change', changed); window.removeEventListener('storage', sync) }
  }, [])
  function choose(next: ThemePreference) {
    setPreference(next)
    try { saveThemePreference(window.localStorage, next) } catch { /* Storage may be disabled. */ }
  }
  return {dark, preference, setPreference: choose, toggleTheme: () => choose(dark ? 'light' : 'dark')}
}
