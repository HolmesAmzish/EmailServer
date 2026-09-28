import { useCallback, useEffect, useState } from 'react'
import {
  getUserInfo,
  isAuthenticated,
  login as beginLogin,
  logout as beginLogout,
} from '@/api/auth'
import type { AuthUser } from '@/types/mail'

interface AuthState {
  authenticated: boolean
  loading: boolean
  user: AuthUser | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    loading: true,
    user: null,
  })

  useEffect(() => {
    let active = true
    const check = async () => {
      const authenticated = await isAuthenticated()
      const user = authenticated ? await getUserInfo() : null
      if (active) setState({ authenticated, loading: false, user })
    }
    void check()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(() => beginLogin(), [])
  const logout = useCallback(() => beginLogout(), [])

  return { ...state, login, logout }
}
