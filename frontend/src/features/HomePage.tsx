import { useEffect, useState } from 'react'
import { getAccessToken, getUserInfo, isAuthenticated, login, logout } from '@/api/auth'

export function HomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<{ username: string; email: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    isAuthenticated().then((ok) => {
      setAuthed(ok)
      if (ok) {
        getAccessToken().then((t) => {
          setToken(t)
          // eslint-disable-next-line no-console
          if (t) console.log('Keycloak access token:', t)
        })
        getUserInfo().then(setUser)
      }
    })
  }, [])

  const handleCopy = async () => {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-6">Email Server</h1>
          <button
            onClick={() => login()}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Login with Keycloak
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-white">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Email Server</h1>
          <button
            onClick={() => logout()}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Logout
          </button>
        </div>

        {user && (
          <div className="mb-6">
            <p className="text-sm text-gray-500">Logged in as</p>
            <p className="font-medium">{user.username}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Access Token</p>
            <button
              onClick={handleCopy}
              className="text-sm px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="p-4 bg-gray-50 rounded border border-gray-200 break-all font-mono text-xs">
            {token ?? 'No token available'}
          </div>
        </div>
      </div>
    </div>
  )
}
