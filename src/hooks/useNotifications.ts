import { useEffect, useEffectEvent, useState } from 'react'
import { errorMessage, type GreenApi, type NotificationBody } from '../api/greenApi'

const RETRY_DELAY_MS = 5000

export async function pollNotifications(
  api: Pick<GreenApi, 'receiveNotification' | 'deleteNotification'>,
  onNotification: (body: NotificationBody) => void,
  onError: (message: string | null) => void,
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    try {
      const notification = await api.receiveNotification(signal)
      if (signal.aborted) return
      onError(null)
      if (notification) {
        onNotification(notification.body)
        await api.deleteNotification(notification.receiptId)
      }
    } catch (cause) {
      if (signal.aborted) return
      onError(errorMessage(cause))
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }
}

export function useNotifications(
  api: GreenApi,
  onNotification: (body: NotificationBody) => void,
): string | null {
  const [error, setError] = useState<string | null>(null)
  const handleNotification = useEffectEvent(onNotification)

  useEffect(() => {
    const controller = new AbortController()
    void pollNotifications(api, (body) => handleNotification(body), setError, controller.signal)
    return () => controller.abort()
  }, [api])

  return error
}
