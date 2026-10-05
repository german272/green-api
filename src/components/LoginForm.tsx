import { useState, type FormEvent } from 'react'
import { createGreenApi, errorMessage, type Credentials } from '../api/greenApi'
import { PlaneIcon } from './icons'

interface Props {
  onLogin: (credentials: Credentials) => void
}

export function LoginForm({ onLogin }: Props) {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const credentials = { idInstance: idInstance.trim(), apiTokenInstance: apiTokenInstance.trim() }
    if (!/^\d+$/.test(credentials.idInstance)) {
      setError('idInstance состоит только из цифр')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { stateInstance } = await createGreenApi(credentials).getStateInstance()
      if (stateInstance === 'authorized') {
        onLogin(credentials)
      } else {
        setError(`Инстанс не авторизован в Telegram (состояние: ${stateInstance})`)
      }
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <form className="login__form" onSubmit={submit}>
        <div className="login__logo" aria-hidden="true">
          <PlaneIcon size={56} />
        </div>
        <h1 className="login__title">Telegram через GREEN-API</h1>
        <p className="login__hint">
          Введите параметры доступа к инстансу из личного кабинета GREEN-API
        </p>

        <input
          className="field"
          placeholder="idInstance"
          aria-label="idInstance"
          inputMode="numeric"
          autoComplete="off"
          value={idInstance}
          onChange={(event) => setIdInstance(event.target.value)}
          required
        />
        <input
          className="field"
          placeholder="apiTokenInstance"
          aria-label="apiTokenInstance"
          type="password"
          autoComplete="off"
          value={apiTokenInstance}
          onChange={(event) => setApiTokenInstance(event.target.value)}
          required
        />

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Проверяем…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}
