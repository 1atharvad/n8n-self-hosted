import { create } from 'zustand'

// visibleContainers: admin's personal UI preference for which containers to show.
// Empty array = show all (within the user's allowed_containers from auth).
// For viewer users, allowed_containers from the JWT is the enforced limit.
const SETTINGS_KEY = 'app_settings'

interface Settings {
  visibleContainers: string[]
}

interface SettingsStore extends Settings {
  setVisibleContainers: (containers: string[]) => void
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw) as Settings
  } catch {}
  return { visibleContainers: [] }
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...loadSettings(),

  setVisibleContainers: (visibleContainers) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ visibleContainers }))
    set({ visibleContainers })
  },
}))
