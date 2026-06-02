import { create } from 'zustand'

// visibleContainers: admin's personal UI preference for which containers to show.
// Empty array = show all (within the user's allowed_containers from auth).
// For viewer users, allowed_containers from the JWT is the enforced limit.
const SETTINGS_KEY = 'app_settings'

type Theme = 'dark' | 'light' | 'system'

interface Settings {
  visibleContainers: string[]
  theme: Theme
}

interface SettingsStore extends Settings {
  setVisibleContainers: (containers: string[]) => void
  setTheme: (theme: Theme) => void
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { theme: 'dark', ...JSON.parse(raw) } as Settings
  } catch {}
  return { visibleContainers: [], theme: 'dark' }
}

function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...loadSettings(),

  setVisibleContainers: (visibleContainers) => {
    const next = { ...get(), visibleContainers }
    saveSettings(next)
    set({ visibleContainers })
  },

  setTheme: (theme) => {
    const next = { ...get(), theme }
    saveSettings(next)
    set({ theme })
  },
}))
