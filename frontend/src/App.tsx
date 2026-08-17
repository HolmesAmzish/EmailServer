import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from '@/features/HomePage'
import { LoginPage } from '@/features/LoginPage'
import { CallbackPage } from '@/features/CallbackPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/callback" element={<CallbackPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
