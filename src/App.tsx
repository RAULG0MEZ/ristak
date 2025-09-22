import React from 'react'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { Layout, DeployToast } from './ui'
import { DateProvider } from './contexts/DateContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { DeploymentProvider, useDeployment } from './contexts/DeploymentContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { ToastProvider } from './hooks/useToast'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Sidebar } from './modules/sidebar/Sidebar'
import { Header } from './modules/header/Header'
import { Dashboard } from './pages/Dashboard'
import { Campaigns } from './pages/Campaigns'
import { Contacts } from './pages/Contacts'
import { Payments } from './pages/Payments'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { DataImport } from './pages/DataImport'
import { Login } from './pages/Login'
import { Analytics } from './pages/Analytics'

function RootLayout() {
  const { deployStatus, deployMessage, deployLogs, showToast, hideToast } = useDeployment()

  return (
    <ProtectedRoute>
      <SettingsProvider>
        <DateProvider>
          <ToastProvider>
            <Layout sidebar={<Sidebar />}>
              <div className="flex flex-col h-full">
                <Header />
                <div className="flex-1 overflow-auto">
                  <Outlet />
                </div>
              </div>
            </Layout>
            {/* Deploy Toast - ahora fuera del Layout */}
            <DeployToast
              isOpen={showToast}
              status={deployStatus}
              message={deployMessage}
              logs={deployLogs}
              onClose={hideToast}
            />
          </ToastProvider>
        </DateProvider>
      </SettingsProvider>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <DeploymentProvider>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<RootLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="campaigns" element={<Campaigns />} />
                  <Route path="contacts" element={<Contacts />} />
                  <Route path="payments" element={<Payments />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="import" element={<DataImport />} />
                </Route>
              </Routes>
          </DeploymentProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
