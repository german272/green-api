import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Notification } from '../api/greenApi'
import { pollNotifications } from './useNotifications'

const notification = (receiptId: number): Notification => ({
  receiptId,
  body: { typeWebhook: 'incomingMessageReceived', timestamp: 1, idMessage: `m${receiptId}` },
})

function setup(responses: Array<Notification | null | Error>) {
  const controller = new AbortController()
  const calls: string[] = []
  const errors: Array<string | null> = []

  const api = {
    receiveNotification: vi.fn(async () => {
      const next = responses.shift()
      if (next === undefined) {
        controller.abort()
        return null
      }
      if (next instanceof Error) throw next
      return next
    }),
    deleteNotification: vi.fn(async (receiptId: number) => {
      calls.push(`delete:${receiptId}`)
      return { result: true }
    }),
  }

  const done = pollNotifications(
    api,
    (body) => calls.push(`handle:${body.idMessage}`),
    (message) => errors.push(message),
    controller.signal,
  )
  return { api, calls, errors, done, controller }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('pollNotifications', () => {
  it('handles each notification and then deletes it, in queue order', async () => {
    const { calls, done } = setup([notification(1), null, notification(2)])

    await done

    expect(calls).toEqual(['handle:m1', 'delete:1', 'handle:m2', 'delete:2'])
  })

  it('reports a failure, retries after 5 seconds and clears the error on success', async () => {
    const { api, errors, done } = setup([new Error('Ошибка 500'), notification(1)])

    await vi.advanceTimersByTimeAsync(4999)
    expect(api.receiveNotification).toHaveBeenCalledTimes(1)
    expect(errors).toEqual(['Ошибка 500'])

    await vi.advanceTimersByTimeAsync(1)
    await done
    expect(errors).toEqual(['Ошибка 500', null])
  })

  it('drops a notification that arrives after abort and stops polling', async () => {
    const { api, calls, controller, done } = setup([notification(1), notification(2)])
    controller.abort()

    await done

    expect(api.receiveNotification).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([])
  })
})
