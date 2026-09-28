import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAuthenticated, login } from '@/api/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void isAuthenticated().then((authenticated) => {
      if (authenticated) navigate('/mail/inbox', { replace: true })
      else login()
    })
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="mt-4 text-[11px] font-medium text-muted-foreground">
          Signing in with Keycloak
        </p>
      </div>
    </div>
  )
}
