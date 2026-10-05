import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGreenApi } from './greenApi'

const base = 'https://4100.api.green-api.com/waInstance4100123456'

function setup(status: number, body: string) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(body || null, { status }))
  vi.stubGlobal('fetch', fetchMock)
  return { api: createGreenApi({ idInstance: '4100123456', apiTokenInstance: 'token' }), fetchMock }
}

const sentBody = (init?: RequestInit) => JSON.parse(init?.body as string)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('requests', () => {
  it('sends a text message to the instance host', async () => {
    const { api, fetchMock } = setup(200, '{"idMessage":"42"}')

    await expect(api.sendMessage('100', 'Привет')).resolves.toEqual({ idMessage: '42' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${base}/sendMessage/token`)
    expect(init?.method).toBe('POST')
    expect(sentBody(init)).toEqual({ chatId: '100', message: 'Привет' })
  })

  it('checks an account by a numeric phone number', async () => {
    const { api, fetchMock } = setup(200, '{"exist":true,"chatId":"100"}')

    await api.checkAccount('79876543210')

    expect(sentBody(fetchMock.mock.calls[0][1])).toEqual({ phoneNumber: 79876543210 })
  })

  it('deletes a notification by receipt id', async () => {
    const { api, fetchMock } = setup(200, '{"result":true}')

    await api.deleteNotification(7)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${base}/deleteNotification/token/7`)
    expect(init?.method).toBe('DELETE')
  })

  it('returns null when the notification queue is empty', async () => {
    const { api } = setup(200, '')

    await expect(api.receiveNotification(new AbortController().signal)).resolves.toBeNull()
  })

  it('treats an empty response as no chats', async () => {
    const { api } = setup(200, '')

    await expect(api.getChats()).resolves.toEqual([])
  })

  it('spaces out calls of a rate-limited method by a second', async () => {
    vi.useFakeTimers()
    const { api, fetchMock } = setup(200, '[]')

    void api.getChatHistory('100')
    void api.getChatHistory('200')
    void api.getChats()
    await vi.advanceTimersByTimeAsync(999)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(sentBody(fetchMock.mock.calls[2][1])).toEqual({ chatId: '200' })
  })

  it('keeps the queue going after a failed request', async () => {
    vi.useFakeTimers()
    const { api, fetchMock } = setup(500, '')

    const failed = api.getChats().catch((cause: Error) => cause.message)
    const next = api.getChats().catch((cause: Error) => cause.message)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(failed).resolves.toBe('Ошибка 500')
    await expect(next).resolves.toBe('Ошибка 500')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('errors', () => {
  it('explains wrong credentials', async () => {
    const { api } = setup(401, '')

    await expect(api.getStateInstance()).rejects.toThrow('Неверный idInstance или apiTokenInstance')
  })

  it.each([
    ['{"message":"Validation failed"}', 'Ошибка 400: Validation failed'],
    ['Bad Request', 'Ошибка 400: Bad Request'],
  ])('shows the reason from an error body: %s', async (body, message) => {
    const { api } = setup(400, body)

    await expect(api.sendMessage('100', 'x')).rejects.toThrow(message)
  })

  it.each([
    [
      '{"status":false,"reason":"instance is starting or not authorized"}',
      'instance is starting or not authorized',
    ],
    [
      '{"status":false,"data":{"status":"fail","reason":"rate_limit_exceeded"}}',
      'rate_limit_exceeded',
    ],
  ])('rejects a refusal sent with HTTP 200: %s', async (body, reason) => {
    const { api } = setup(200, body)

    await expect(api.sendMessage('100', 'x')).rejects.toThrow(`Запрос отклонён: ${reason}`)
  })

  it('reports an unreachable host', async () => {
    const { api, fetchMock } = setup(200, '')
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(api.getStateInstance()).rejects.toThrow('Не удалось связаться с GREEN-API')
  })

  it('reports a response that is not JSON', async () => {
    const { api } = setup(200, '<html>')

    await expect(api.getStateInstance()).rejects.toThrow('Некорректный ответ GREEN-API')
  })
})
