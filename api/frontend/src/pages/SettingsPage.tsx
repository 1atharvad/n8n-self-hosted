import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogStore } from '@/store/useLogStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { UserManagement } from '@/components/UserManagement'
import { Header } from '@/components/Header'
import { PageAside, AsideBtn } from 'advi-ui'
import { Button, Input, Checkbox } from 'advi-ui'
import { LayoutGrid, KeyRound, Users, LogOut, ChevronLeft } from 'lucide-react'

type Section = 'containers' | 'password' | 'users'

export default function SettingsPage() {
  const navigate = useNavigate()
  const labels = useLogStore((s) => s.labels)
  const loadLabels = useLogStore((s) => s.loadLabels)
  const { visibleContainers, setVisibleContainers } = useSettingsStore()
  const changePassword = useAuthStore((s) => s.changePassword)
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  const [activeSection, setActiveSection] = useState<Section>('containers')
  const [asideOpen, setAsideOpen] = useState(true)

  const [checked, setChecked] = useState<Set<string>>(() =>
    visibleContainers.length === 0 ? new Set() : new Set(visibleContainers)
  )
  const [containersSaved, setContainersSaved] = useState(false)

  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    loadLabels()
  }, [loadLabels])

  const effectiveLabels = labels
  const allVisible = checked.size === 0

  function isVisible(name: string) {
    return checked.size === 0 || checked.has(name)
  }

  function toggleContainer(name: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.size === 0) effectiveLabels.forEach((l) => next.add(l))
      if (next.has(name)) next.delete(name)
      else next.add(name)
      if (next.size === effectiveLabels.length) return new Set()
      return next
    })
    setContainersSaved(false)
  }

  function toggleAll() {
    setChecked((prev) => (prev.size === 0 ? new Set(effectiveLabels) : new Set()))
    setContainersSaved(false)
  }

  function saveContainerSettings() {
    setVisibleContainers(checked.size === 0 ? [] : Array.from(checked))
    setContainersSaved(true)
    setTimeout(() => setContainersSaved(false), 2000)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (newPw !== confirmPw) {
      setPwError('Passwords do not match')
      return
    }
    if (newPw.length < 8) {
      setPwError('Password must be at least 8 characters')
      return
    }
    try {
      await changePassword(oldPw, newPw)
      setPwSuccess(true)
      setOldPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Failed to change password')
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const navItems: { id: Section; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'containers', label: 'Containers', icon: <LayoutGrid className="h-4 w-4" /> },
    { id: 'password', label: 'Password', icon: <KeyRound className="h-4 w-4" /> },
    { id: 'users', label: 'User Management', icon: <Users className="h-4 w-4" />, adminOnly: true },
  ]

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header
        title="Settings"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ChevronLeft className="h-4 w-4" />
            Back to Logs
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <PageAside
          open={asideOpen}
          onToggle={() => setAsideOpen((v) => !v)}
          items={navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => ({
              icon: item.icon,
              label: item.label,
              onClick: () => setActiveSection(item.id),
              active: activeSection === item.id,
            }))}
          footer={(open: boolean) => (
            <>
              {open && (
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-medium truncate">{user?.username}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{user?.role}</p>
                </div>
              )}
              <AsideBtn
                icon={<LogOut className="h-4 w-4" />}
                label="Sign out"
                onClick={handleLogout}
                tooltip={!open ? 'Sign out' : undefined}
              />
            </>
          )}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl space-y-6">
            {/* Containers section */}
            {activeSection === 'containers' && (
              <section className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="text-sm font-semibold">
                    {isAdmin ? 'Container Visibility' : 'Container Access'}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAdmin
                      ? 'Personal preference for which containers appear in your log filter dropdown.'
                      : 'Containers you have access to (set by an administrator).'}
                  </p>
                </div>

                {isAdmin ? (
                  <>
                    <div className="px-4 py-3">
                      {effectiveLabels.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic px-2 py-1">
                          No containers discovered yet.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          <Checkbox
                            label={
                              allVisible
                                ? 'All containers shown'
                                : `${checked.size} of ${effectiveLabels.length} shown`
                            }
                            checked={allVisible}
                            onChange={toggleAll}
                          />
                          <div className="border-t border-border my-2 mx-1" />
                          {effectiveLabels.map((name) => (
                            <Checkbox
                              key={name}
                              label={name}
                              checked={isVisible(name)}
                              onChange={() => toggleContainer(name)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 px-6 py-4 border-t border-border bg-background/40">
                      <Button onClick={saveContainerSettings} variant="default" size="sm">
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setChecked(new Set())
                          setContainersSaved(false)
                        }}
                      >
                        Reset to all
                      </Button>
                      {containersSaved && (
                        <span className="text-xs text-green-400 ml-2">Saved.</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="px-6 py-4">
                    {user?.allowed_containers === null ? (
                      <p className="text-xs text-muted-foreground">Access to all containers.</p>
                    ) : user?.allowed_containers?.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No containers assigned.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {user?.allowed_containers?.map((c) => (
                          <span
                            key={c}
                            className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-foreground border border-border"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Password section */}
            {activeSection === 'password' && (
              <section className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="text-sm font-semibold">Change Password</h2>
                  <p className="text-xs text-muted-foreground mt-1">Update your login password.</p>
                </div>
                <form onSubmit={handlePasswordChange} className="px-6 py-4 space-y-3 max-w-sm">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Current Password
                    </label>
                    <Input
                      type="password"
                      placeholder="Current password"
                      value={oldPw}
                      onChange={(e) => setOldPw(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">
                      New Password
                    </label>
                    <Input
                      type="password"
                      placeholder="New password (min 8 chars)"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Confirm New Password
                    </label>
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                    />
                  </div>
                  {pwError && (
                    <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                      <span className="text-destructive text-xs">⚠</span>
                      <p className="text-xs text-destructive">{pwError}</p>
                    </div>
                  )}
                  {pwSuccess && (
                    <p className="text-xs text-green-400">Password updated successfully.</p>
                  )}
                  <Button type="submit" size="sm" disabled={!oldPw || !newPw || !confirmPw}>
                    Update Password
                  </Button>
                </form>
              </section>
            )}

            {/* Users section (admin only) */}
            {activeSection === 'users' && isAdmin && (
              <section className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="text-sm font-semibold">User Management</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create users, assign roles, and restrict container access.
                  </p>
                </div>
                <div className="px-6 py-4">
                  <UserManagement />
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
