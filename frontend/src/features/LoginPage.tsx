import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, isAuthenticated } from '@/api/auth'

export function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    isAuthenticated().then((authed) => {
      if (authed) navigate('/', { replace: true })
      else login()
    })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
          Redirecting to login...
        </p>
        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )
}
