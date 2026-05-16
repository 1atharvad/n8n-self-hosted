export interface LogEntry {
  ts: string
  container: string
  level: string
  message: string
}

export type TimeRange = '15m' | '1h' | '6h' | '24h'

export interface Filters {
  containers: string[]
  level: string
  search: string
  range: TimeRange
  limit: number
}

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'viewer'
  allowed_containers: string[] | null
  is_active: boolean
  created_at: string
}

export interface LoginResponse extends AuthUser {
  access_token: string
  token_type: string
}

export interface CreateUserRequest {
  username: string
  password: string
  role: 'admin' | 'viewer'
  allowed_containers: string[] | null
}

export interface UpdateUserRequest {
  role?: 'admin' | 'viewer'
  allowed_containers?: string[]
  clear_container_restriction?: boolean
  is_active?: boolean
  password?: string
}
