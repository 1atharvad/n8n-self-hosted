import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogStore } from '@/store/useLogStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { UserManagement } from '@/components/UserManagement'
import { Header } from '@/components/Header'
import { PageAside, AsideBtn } from 'advi-ui'
import { Button, Input } from 'advi-ui'
import { LogOut, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const navigate = useNavigate()
  const labels = useLogStore((s) => s.labels)
  const loadLabels = useLogStore((s) => s.loadLabels)
  const { visibleContainers, setVisibleContainers } = useSettingsStore()
  const changePassword = useAuthStore((s) => s.changePassword)
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  const [asideOpen, setAsideOpen] = useState(false)

  const [checked, setChecked] = useState<Set<string>>(() =>
    visibleContainers.length === 0 ? new Set() : new Set(visibleContainers)
  )
  const [containersSaved, setContainersSaved] = useState(false)

  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    loadLabels()
  }, [loadLabels])

  const effectiveLabels = labels
  const allVisible = checked.size === 0

  const isVisible = (name: string) => checked.size === 0 || checked.has(name)

  const toggleContainer = (name: string) => {
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

  const toggleAll = () => {
    setChecked((prev) => (prev.size === 0 ? new Set(effectiveLabels) : new Set()))
    setContainersSaved(false)
  }

  const saveContainerSettings = () => {
    setVisibleContainers(checked.size === 0 ? [] : Array.from(checked))
    setContainersSaved(true)
    setTimeout(() => setContainersSaved(false), 2000)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    setPwLoading(true)
    try {
      await changePassword(oldPw, newPw)
      setPwSuccess(true)
      setOldPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Failed to change password')
    } finally {
      setPwLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const pwFields = [
    { label: 'Current password', value: oldPw, onChange: setOldPw },
    { label: 'New password',     value: newPw, onChange: setNewPw },
    { label: 'Confirm password', value: confirmPw, onChange: setConfirmPw },
  ]

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header
        title="Settings"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/logs')}>
            <ChevronLeft className="h-4 w-4" />
            Back to Logs
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <PageAside
          open={asideOpen}
          onToggle={() => setAsideOpen((v) => !v)}
          items={[]}
          footer={(open: boolean) => (
            <AsideBtn
              icon={<LogOut className="h-4 w-4" />}
              label="Sign out"
              onClick={handleLogout}
              tooltip={!open ? 'Sign out' : undefined}
            />
          )}
        />

        <main className="flex-1 overflow-y-auto px-5 py-5">
          <div className="max-w-2xl space-y-4">

            {/* Container Visibility */}
            <section className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {isAdmin ? 'Container Visibility' : 'Container Access'}
                </h2>
                <p className="text-xs text-foreground/80 mt-1">
                  {isAdmin
                    ? 'Choose which containers appear in the log filter dropdown.'
                    : 'Containers you have access to (set by an administrator).'}
                </p>
              </div>

              {isAdmin ? (
                <>
                  <div className="px-5 py-4">
                    {effectiveLabels.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No containers discovered yet.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {allVisible
                              ? `All ${effectiveLabels.length} containers visible`
                              : `${checked.size} of ${effectiveLabels.length} visible`}
                          </span>
                          <button onClick={toggleAll} className="text-[11px] text-primary hover:underline">
                            {allVisible ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {effectiveLabels.map((name) => (
                            <button
                              key={name}
                              onClick={() => toggleContainer(name)}
                              className={cn(
                                'font-mono text-[11px] px-2.5 py-1 rounded-md border transition-colors cursor-pointer',
                                isVisible(name)
                                  ? 'bg-primary/10 border-primary/40 text-primary'
                                  : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                              )}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-background/40">
                    <Button onClick={saveContainerSettings} variant="default" size="sm">Save</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setChecked(new Set()); setContainersSaved(false); }}
                    >
                      Reset to all
                    </Button>
                    {containersSaved && <span className="text-xs text-green-400 ml-2">Saved.</span>}
                  </div>
                </>
              ) : (
                <div className="px-5 py-4">
                  {user?.allowed_containers === null ? (
                    <p className="text-xs text-muted-foreground">Access to all containers.</p>
                  ) : user?.allowed_containers?.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No containers assigned.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {user?.allowed_containers?.map((c) => (
                        <span key={c} className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Change Password */}
            <section className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Change Password</h2>
                <p className="text-xs text-foreground/80 mt-1">Update your login credentials.</p>
              </div>
              <form onSubmit={handlePasswordChange} className="px-5 py-4">
                <div className="space-y-2.5 max-w-md">
                  {pwFields.map(({ label, value, onChange }) => (
                    <div key={label} className="grid grid-cols-[9rem_1fr] items-center gap-3">
                      <span className="text-xs text-muted-foreground text-right">{label}</span>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                      />
                    </div>
                  ))}

                  {pwError && (
                    <div className="grid grid-cols-[9rem_1fr] gap-3 items-start">
                      <span />
                      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                        <span className="text-destructive text-xs">⚠</span>
                        <p className="text-xs text-destructive">{pwError}</p>
                      </div>
                    </div>
                  )}

                  {pwSuccess && (
                    <div className="grid grid-cols-[9rem_1fr] gap-3">
                      <span />
                      <p className="text-xs text-green-400">Password updated successfully.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-[9rem_1fr] items-center gap-3 pt-1">
                    <span />
                    <Button type="submit" size="sm" disabled={!oldPw || !newPw || !confirmPw || pwLoading}>
                      {pwLoading ? 'Updating…' : 'Update password'}
                    </Button>
                  </div>
                </div>
              </form>
            </section>

            {/* User Management (admin only) */}
            {isAdmin && (
              <section className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border">
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">User Management</h2>
                  <p className="text-xs text-foreground/80 mt-1">Create users, assign roles, and restrict container access.</p>
                </div>
                <div className="px-5 py-4">
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
