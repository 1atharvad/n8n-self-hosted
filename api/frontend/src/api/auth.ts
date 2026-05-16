import type { AuthUser, CreateUserRequest, LoginResponse, UpdateUserRequest } from '@/types'
import { authedFetch } from './client'

const BASE = '/api/logs/auth'

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Login failed')
  }
  return res.json()
}

export async function getMe(): Promise<AuthUser> {
  const res = await authedFetch(`${BASE}/me`)
  if (!res.ok) throw new Error('Failed to fetch user')
  return res.json()
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const res = await authedFetch(`${BASE}/change-password`, {
    method: 'POST',
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Password change failed')
  }
}

export async function listUsers(): Promise<AuthUser[]> {
  const res = await authedFetch(`${BASE}/users`)
  if (!res.ok) throw new Error('Failed to fetch users')
  const data = await res.json()
  return data.users
}

export async function createUser(body: CreateUserRequest): Promise<AuthUser> {
  const res = await authedFetch(`${BASE}/users`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Failed to create user')
  }
  return res.json()
}

export async function updateUser(userId: string, body: UpdateUserRequest): Promise<AuthUser> {
  const res = await authedFetch(`${BASE}/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Failed to update user')
  }
  return res.json()
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await authedFetch(`${BASE}/users/${userId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Failed to delete user')
  }
}
