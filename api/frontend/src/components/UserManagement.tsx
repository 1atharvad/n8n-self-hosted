import { useEffect, useState } from 'react'
import { createUser, deleteUser, listUsers, updateUser } from '@/api/auth'
import {
  Button,
  Input,
  Select,
  Checkbox,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from 'advi-ui'
import { useLogStore } from '@/store/useLogStore'
import type { AuthUser } from '@/types'
import { AlertTriangle, UserPlus, X } from 'lucide-react'

type ModalMode = 'create' | 'edit' | null

interface UserForm {
  username: string
  password: string
  role: 'admin' | 'viewer'
  allowed_containers: string[]
  restrict_containers: boolean
  is_active: boolean
}

const emptyForm = (): UserForm => ({
  username: '',
  password: '',
  role: 'viewer',
  allowed_containers: [],
  restrict_containers: false,
  is_active: true,
})

export const UserManagement = () => {
  const allLabels = useLogStore((s) => s.labels)
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<ModalMode>(null)
  const [editTarget, setEditTarget] = useState<AuthUser | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setUsers(await listUsers())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setForm(emptyForm())
    setEditTarget(null)
    setFormError('')
    setModal('create')
  }

  const openEdit = (user: AuthUser) => {
    setForm({
      username: user.username,
      password: '',
      role: user.role,
      allowed_containers: user.allowed_containers ?? [],
      restrict_containers: user.allowed_containers !== null,
      is_active: user.is_active,
    })
    setEditTarget(user)
    setFormError('')
    setModal('edit')
  }

  const closeModal = () => {
    setModal(null)
    setEditTarget(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setFormError('')
    try {
      if (modal === 'create') {
        await createUser({
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          allowed_containers: form.restrict_containers ? form.allowed_containers : null,
        })
      } else if (modal === 'edit' && editTarget) {
        await updateUser(editTarget.id, {
          role: form.role,
          is_active: form.is_active,
          ...(form.password ? { password: form.password } : {}),
          ...(form.restrict_containers
            ? { allowed_containers: form.allowed_containers }
            : { clear_container_restriction: true }),
        })
      }
      await load()
      closeModal()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user: AuthUser) => {
    if (!confirm(`Delete user "${user.username}"?`)) return
    try {
      await deleteUser(user.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const toggleContainer = (name: string) => {
    setForm((prev) => ({
      ...prev,
      allowed_containers: prev.allowed_containers.includes(name)
        ? prev.allowed_containers.filter((c) => c !== name)
        : [...prev.allowed_containers, name],
    }))
  }

  return (
    <div>
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 mb-4">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {users.length} user{users.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" variant="default" onClick={openCreate}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          New user
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Containers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.username}</TableCell>
                <TableCell>
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} size="sm">
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.allowed_containers === null
                    ? 'All'
                    : u.allowed_containers.length === 0
                      ? 'None'
                      : `${u.allowed_containers.length} selected`}
                </TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? 'default' : 'secondary'} size="sm">
                    {u.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1.5 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(u)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold">
                {modal === 'create' ? 'New User' : `Edit: ${editTarget?.username}`}
              </h3>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {modal === 'create' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Username
                  </label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    placeholder="username"
                    autoFocus
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">
                  {modal === 'create' ? 'Password' : 'New Password (leave blank to keep)'}
                </label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder={
                    modal === 'create' ? 'min 8 characters' : 'Leave blank to keep current'
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Role
                </label>
                <Select
                  options={[
                    { value: 'viewer', label: 'Viewer' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                  value={form.role}
                  onChange={(v) => setForm((p) => ({ ...p, role: v as 'admin' | 'viewer' }))}
                  className="w-full"
                />
              </div>

              {modal === 'edit' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Status
                  </label>
                  <Select
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                    ]}
                    value={form.is_active ? 'active' : 'inactive'}
                    onChange={(v) => setForm((p) => ({ ...p, is_active: v === 'active' }))}
                    className="w-full"
                  />
                </div>
              )}

              {/* Container restriction */}
              <div className="space-y-2">
                <Checkbox
                  label="Restrict container access"
                  checked={form.restrict_containers}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, restrict_containers: e.target.checked }))
                  }
                />

                {form.restrict_containers && (
                  <div className="rounded-md border border-border bg-background/50 divide-y divide-border max-h-40 overflow-y-auto">
                    {allLabels.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic px-3 py-2">
                        No containers discovered yet.
                      </p>
                    ) : (
                      allLabels.map((name) => (
                        <div key={name} className="px-3 py-1.5">
                          <Checkbox
                            label={name}
                            checked={form.allowed_containers.includes(name)}
                            onChange={() => toggleContainer(name)}
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {formError && <p className="text-xs text-destructive">{formError}</p>}
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-border">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
