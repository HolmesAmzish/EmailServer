import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleCallback } from '@/api/auth'

export function CallbackPage() {
  const navigate = useNavigate()
  const exchanged = useRef(false)

  useEffect(() => {
    if (exchanged.current) return
    exchanged.current = true
    handleCallback().then(() => navigate('/', { replace: true }))
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
          Completing login...
        </p>
        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )
}
