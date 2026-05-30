const TOKEN_KEY = 'logs_access_token'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token)
}

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
}

export const authedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })

  if (res.status === 401) {
    clearToken()
    window.location.href = '/logs/login'
    throw new Error('Unauthorized')
  }

  return res
}
