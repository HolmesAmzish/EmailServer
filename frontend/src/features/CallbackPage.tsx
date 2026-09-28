import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleCallback, isAuthenticated, login } from '@/api/auth'

export function CallbackPage() {
  const navigate = useNavigate()
  const exchanged = useRef(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (exchanged.current) return
    exchanged.current = true

    void handleCallback().then(async (user) => {
      const authenticated = Boolean(user) || (await isAuthenticated())
      if (authenticated) {
        navigate('/mail/inbox', { replace: true })
      } else {
        setFailed(true)
      }
    })
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center">
        {failed ? (
          <>
            <p className="text-[13px] font-medium text-foreground">Sign-in could not be completed.</p>
            <button
              type="button"
              onClick={login}
              className="mt-4 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="mt-4 text-[11px] font-medium text-muted-foreground">
              Completing sign in
            </p>
          </>
        )}
      </div>
    </div>
  )
}
