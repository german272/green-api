import { useState } from 'react'
import type { Credentials } from './api/greenApi'
import { ChatScreen } from './components/ChatScreen'
import { LoginForm } from './components/LoginForm'

const STORAGE_KEY = 'green-api-credentials'

function loadCredentials(): Credentials | null {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    return null
  }
}

export function App() {
  const [credentials, setCredentials] = useState(loadCredentials)

  function login(next: Credentials) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setCredentials(next)
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY)
    setCredentials(null)
  }

  return credentials ? (
    <ChatScreen credentials={credentials} onLogout={logout} />
  ) : (
    <LoginForm onLogin={login} />
  )
}
