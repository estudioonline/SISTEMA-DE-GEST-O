export type ThemePreference = 'system' | 'light' | 'dark'
export const THEME_STORAGE_KEY = 'erp.theme'
export function readThemePreference(storage: Pick<Storage, 'getItem'>): ThemePreference {
  try {
    const saved = storage.getItem(THEME_STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch { return 'system' }
}
export function resolveDark(preference: ThemePreference, systemDark: boolean) {
  return preference === 'system' ? systemDark : preference === 'dark'
}
export function saveThemePreference(storage: Pick<Storage, 'setItem' | 'removeItem'>, preference: ThemePreference) {
  try {
    if (preference === 'system') storage.removeItem(THEME_STORAGE_KEY)
    else storage.setItem(THEME_STORAGE_KEY, preference)
  } catch { /* The selected theme still works when browser storage is unavailable. */ }
}
