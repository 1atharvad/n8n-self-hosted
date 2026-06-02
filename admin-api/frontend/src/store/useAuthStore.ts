import { create } from 'zustand'
import { login as apiLogin, changePassword as apiChangePassword } from '@/api/auth'
import { clearToken, getToken, setToken } from '@/api/client'
import type { AuthUser } from '@/types'

const USER_KEY = 'logs_user'

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

interface AuthStore {
  token: string | null
  user: AuthUser | null
  authenticated: boolean
  initialized: boolean

  init: () => void
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  authenticated: false,
  initialized: false,

  init: () => {
    const token = getToken()
    const user = loadStoredUser()
    if (token && user && !isTokenExpired(token)) {
      set({ token, user, authenticated: true, initialized: true })
    } else {
      clearToken()
      localStorage.removeItem(USER_KEY)
      set({ token: null, user: null, authenticated: false, initialized: true })
    }
  },

  login: async (username, password) => {
    const data = await apiLogin(username, password)
    const user: AuthUser = {
      id: data.id,
      username: data.username,
      role: data.role,
      allowed_containers: data.allowed_containers,
      is_active: data.is_active,
      created_at: data.created_at,
    }
    setToken(data.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ token: data.access_token, user, authenticated: true })
  },

  logout: () => {
    clearToken()
    localStorage.removeItem(USER_KEY)
    set({ token: null, user: null, authenticated: false })
  },

  changePassword: async (oldPassword, newPassword) => {
    await apiChangePassword(oldPassword, newPassword)
  },
}))
