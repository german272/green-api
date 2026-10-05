import { useEffect, useState } from 'react'
import { errorMessage, type GreenApi } from '../api/greenApi'

type Status = 'unknown' | 'enabled' | 'disabled' | 'saving' | 'saved'

export function useReceivingSetup(api: GreenApi) {
  const [status, setStatus] = useState<Status>('unknown')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    api
      .getSettings()
      .then(({ incomingWebhook, webhookUrl }) => {
        if (!ignore) setStatus(incomingWebhook === 'yes' && !webhookUrl ? 'enabled' : 'disabled')
      })
      .catch((cause: unknown) => {
        if (!ignore) setError(`Не удалось проверить настройки инстанса: ${errorMessage(cause)}`)
      })
    return () => {
      ignore = true
    }
  }, [api])

  async function enable() {
    setStatus('saving')
    setError(null)
    try {
      const { saveSettings } = await api.setSettings({ webhookUrl: '', incomingWebhook: 'yes' })
      if (!saveSettings) throw new Error('GREEN-API не применил изменения')
      setStatus('saved')
    } catch (cause) {
      setStatus('disabled')
      setError(`Не удалось сохранить настройки: ${errorMessage(cause)}`)
    }
  }

  return { status, error, enable }
}
