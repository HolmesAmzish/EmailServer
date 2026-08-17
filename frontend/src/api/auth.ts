import { UserManager, type User } from 'oidc-client-ts'

const OIDC_CONFIG = {
  authority: import.meta.env.VITE_OAUTH_AUTH_SERVER,
  client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
  post_logout_redirect_uri: window.location.origin + '/',
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
  getUserManager().signinRedirect()
}

export const logout = async (): Promise<void> => {
  await getUserManager().signoutRedirect()
}

export const handleCallback = async (): Promise<User> => {
  return getUserManager().signinRedirectCallback()
}

export const getAccessToken = async (): Promise<string | null> => {
  const user = await getUserManager().getUser()
  return user?.access_token ?? null
}

export const isAuthenticated = async (): Promise<boolean> => {
  const user = await getUserManager().getUser()
  return !!user && !user.expired
}

export const getUserInfo = async (): Promise<{ username: string; email: string } | null> => {
  const user = await getUserManager().getUser()
  if (!user) return null
  return {
    username: user.profile.preferred_username ?? user.profile.sub,
    email: user.profile.email ?? '',
  }
}
