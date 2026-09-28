import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/app/ProtectedRoute'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/context/ToastContext'
import { CallbackPage } from '@/features/CallbackPage'
import { LoginPage } from '@/features/LoginPage'
import { MailWorkspacePage } from '@/features/mail/MailWorkspacePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/callback" element={<CallbackPage />} />
              <Route
                path="/mail/:mailboxKey?/:mailId?"
                element={
                  <ProtectedRoute>
                    <MailWorkspacePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/mail/inbox" replace />} />
              <Route path="*" element={<Navigate to="/mail/inbox" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
