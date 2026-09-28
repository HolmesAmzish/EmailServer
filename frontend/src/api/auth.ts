import { UserManager, type User } from 'oidc-client-ts'
import type { AuthUser } from '@/types/mail'

const configuredRedirectUri =
  import.meta.env.VITE_OAUTH_REDIRECT_URI || `${window.location.origin}/callback`

const OIDC_CONFIG = {
  authority: import.meta.env.VITE_OAUTH_AUTH_SERVER,
  client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
  redirect_uri: new URL(configuredRedirectUri, window.location.origin).toString(),
  post_logout_redirect_uri: window.location.origin + '/login',
  response_type: 'code',
  scope: 'openid profile email',
}

let userManager: UserManager | null = null

export const getUserManager = (): UserManager => {
  if (!userManager) {
    userManager = new UserManager(OIDC_CONFIG)
  }
  return userManager
}

export const login = (): void => {
  void getUserManager().signinRedirect()
}

export const logout = async (): Promise<void> => {
  await getUserManager().signoutRedirect()
}

export const handleCallback = async (): Promise<User | null> => {
  try {
    return await getUserManager().signinRedirectCallback()
  } catch {
    return null
  }
}

export const getAccessToken = async (): Promise<string | null> => {
  try {
    const user = await getUserManager().getUser()
    return user?.access_token ?? null
  } catch {
    return null
  }
}

export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const user = await getUserManager().getUser()
    return !!user && !user.expired
  } catch {
    return false
  }
}

export const getUserInfo = async (): Promise<AuthUser | null> => {
  try {
    const user = await getUserManager().getUser()
    if (!user) return null
    return {
      id: user.profile.sub,
      username: user.profile.preferred_username ?? user.profile.sub,
      email: user.profile.email ?? '',
    }
  } catch {
    return null
  }
}
