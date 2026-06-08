import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import LogsPage from '@/pages/LogsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import DashboardPage from '@/pages/DashboardPage'
import PerformancePage from '@/pages/PerformancePage'
import InfrastructurePage from '@/pages/InfrastructurePage'
import WorkflowsPage from '@/pages/WorkflowsPage'
import AuditPage from '@/pages/AuditPage'
import ReportsPage from '@/pages/ReportsPage'

export default function App() {
  useTheme()
  return (
    <>
      <div className="screen-guard max-[599px]:flex min-[600px]:hidden fixed inset-0 z-[9999] bg-background flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="text-4xl">🖥️</span>
        <h1 className="text-base font-semibold text-foreground">Screen too small</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          This admin panel requires a screen width of at least 600px. Please use a desktop or larger device.
        </p>
      </div>
    <BrowserRouter basename="/admin" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute>
              <LogsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/settings" element={<Navigate to="/settings/personal" replace />} />
        <Route
          path="/settings/:tab"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/performance"
          element={
            <ProtectedRoute>
              <PerformancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/infrastructure"
          element={
            <ProtectedRoute>
              <InfrastructurePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workflows"
          element={
            <ProtectedRoute>
              <WorkflowsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute>
              <AuditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
    </>
  )
}
