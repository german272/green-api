export interface Credentials {
  idInstance: string
  apiTokenInstance: string
}

export interface Notification {
  receiptId: number
  body: NotificationBody
}

export interface NotificationBody {
  typeWebhook: string
  timestamp: number
  idMessage?: string
  senderData?: {
    chatId: string
    chatName?: string
  }
  messageData?: {
    typeMessage: string
    textMessageData?: { textMessage: string }
    extendedTextMessageData?: { text: string }
  }
}

interface InstanceSettings {
  webhookUrl: string
  incomingWebhook: string
}

export interface ChatInfo {
  chatId: string
  name: string
  phoneNumber: number
}

export interface HistoryMessage {
  type: 'incoming' | 'outgoing'
  idMessage: string
  timestamp: number
  typeMessage: string
  textMessage?: string
}

interface AccountCheck {
  exist: boolean
  chatId: string
}

export type GreenApi = ReturnType<typeof createGreenApi>

const SLOW_METHODS = new Set(['getSettings', 'setSettings', 'getChats', 'getChatHistory'])
const SLOW_METHOD_INTERVAL_MS = 1000

export function createGreenApi({ idInstance, apiTokenInstance }: Credentials) {
  const baseUrl = `https://${idInstance.slice(0, 4)}.api.green-api.com/waInstance${idInstance}`
  const queues = new Map<string, Promise<unknown>>()

  function request<T>(method: string, suffix = '', init?: RequestInit): Promise<T> {
    const send = () => fetchJson<T>(`${baseUrl}/${method}/${apiTokenInstance}${suffix}`, init)
    if (!SLOW_METHODS.has(method)) return send()

    const result = (queues.get(method) ?? Promise.resolve()).then(send)
    const pause = () => new Promise((resolve) => setTimeout(resolve, SLOW_METHOD_INTERVAL_MS))
    queues.set(method, result.then(pause, pause))
    return result
  }

  function post<T>(method: string, body: unknown): Promise<T> {
    return request<T>(method, '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  return {
    getStateInstance: () => request<{ stateInstance: string }>('getStateInstance'),

    getSettings: () => request<InstanceSettings>('getSettings'),

    setSettings: (settings: InstanceSettings) =>
      post<{ saveSettings: boolean }>('setSettings', settings),

    getChats: async () => (await request<ChatInfo[] | null>('getChats')) ?? [],

    getChatHistory: async (chatId: string) =>
      (await post<HistoryMessage[] | null>('getChatHistory', { chatId })) ?? [],

    checkAccount: (phoneNumber: string) =>
      post<AccountCheck>('checkAccount', { phoneNumber: Number(phoneNumber) }),

    sendMessage: (chatId: string, message: string) =>
      post<{ idMessage: string }>('sendMessage', { chatId, message }),

    receiveNotification: (signal: AbortSignal) =>
      request<Notification | null>('receiveNotification', '', { signal }),

    deleteNotification: (receiptId: number) =>
      request<{ result: boolean }>('deleteNotification', `/${receiptId}`, { method: 'DELETE' }),
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init).catch(() => {
    throw new Error('Не удалось связаться с GREEN-API')
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(describeError(response.status, text))
  }
  const body = parseBody(text)
  if ((body as { status?: unknown } | null)?.status === false) {
    throw new Error(`Запрос отклонён: ${failureReason(text)}`)
  }
  return body as T
}

function parseBody(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Некорректный ответ GREEN-API')
  }
}

function describeError(status: number, body: string): string {
  if (status === 401 || status === 403) return 'Неверный idInstance или apiTokenInstance'
  if (status === 429) return 'Слишком много запросов, попробуйте чуть позже'
  if (status === 466) return 'Исчерпан лимит тарифа инстанса'
  return body ? `Ошибка ${status}: ${failureReason(body)}` : `Ошибка ${status}`
}

function failureReason(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      message?: string
      reason?: string
      data?: { reason?: string }
    }
    return parsed.message ?? parsed.reason ?? parsed.data?.reason ?? body
  } catch {
    return body
  }
}

export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
