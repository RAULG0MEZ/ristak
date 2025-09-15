import React from 'react'
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'
import { Layout, DeployToast } from './ui'
import { DateProvider } from './contexts/DateContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { DeploymentProvider, useDeployment } from './contexts/DeploymentContext'
import { ToastProvider } from './hooks/useToast'
import { SubaccountProvider } from './contexts/SubaccountContext'
import { Sidebar } from './modules/sidebar/Sidebar'
import { Header } from './modules/header/Header'
import { Dashboard } from './pages/Dashboard'
import { Campaigns } from './pages/Campaigns'
import { Contacts } from './pages/Contacts'
import { Payments } from './pages/Payments'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { Webhooks } from './pages/Webhooks'
import { DataImport } from './pages/DataImport'

function RootLayout() {
  const { deployStatus, deployMessage, deployLogs, showToast, hideToast } = useDeployment()
  
  return (
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
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'campaigns', element: <Campaigns /> },
      { path: 'contacts', element: <Contacts /> },
      { path: 'payments', element: <Payments /> },
      { path: 'reports', element: <Reports /> },
      { path: 'settings', element: <Settings /> },
      { path: 'webhooks', element: <Webhooks /> },
      { path: 'import', element: <DataImport /> },
    ],
  },
])

function App() {
  return (
    <ThemeProvider>
      <DeploymentProvider>
        <SubaccountProvider>
          <RouterProvider router={router} />
        </SubaccountProvider>
      </DeploymentProvider>
    </ThemeProvider>
  )
}

export default App
