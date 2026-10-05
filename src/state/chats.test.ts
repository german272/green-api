import { describe, expect, it } from 'vitest'
import type { NotificationBody } from '../api/greenApi'
import { chatsReducer, initialChatsState, notificationToAction, type Message } from './chats'

const incoming = (id: string, text = 'hi'): Message => ({ id, text, timestamp: 1, outgoing: false })

function textNotification(overrides: Partial<NotificationBody> = {}): NotificationBody {
  return {
    typeWebhook: 'incomingMessageReceived',
    timestamp: 1763115112,
    idMessage: 'm1',
    senderData: { chatId: '100', chatName: 'Василиса' },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
    ...overrides,
  }
}

describe('notificationToAction', () => {
  it('maps an incoming text message', () => {
    expect(notificationToAction(textNotification())).toEqual({
      type: 'messageAdded',
      chatId: '100',
      title: 'Василиса',
      message: { id: 'm1', text: 'Привет', timestamp: 1763115112000, outgoing: false },
    })
  })

  it.each(['outgoingMessageReceived', 'outgoingAPIMessageReceived'])(
    'marks %s as outgoing',
    (typeWebhook) => {
      const action = notificationToAction(textNotification({ typeWebhook }))
      expect(action).toMatchObject({ message: { outgoing: true } })
    },
  )

  it('reads text from a message with a link preview', () => {
    const action = notificationToAction(
      textNotification({
        messageData: {
          typeMessage: 'extendedTextMessage',
          extendedTextMessageData: { text: 'https://a.b' },
        },
      }),
    )
    expect(action).toMatchObject({ message: { text: 'https://a.b' } })
  })

  it('ignores non-text messages and service notifications', () => {
    expect(
      notificationToAction(textNotification({ messageData: { typeMessage: 'imageMessage' } })),
    ).toBeNull()
    expect(notificationToAction({ typeWebhook: 'stateInstanceChanged', timestamp: 1 })).toBeNull()
    expect(
      notificationToAction(textNotification({ typeWebhook: 'outgoingMessageStatus' })),
    ).toBeNull()
  })
})

const opened = chatsReducer(initialChatsState, {
  type: 'chatOpened',
  chatId: '100',
  title: '+7900',
})

describe('chatsReducer', () => {
  it('opens a new chat and makes it active', () => {
    expect(opened.activeChatId).toBe('100')
    expect(opened.chats).toEqual([{ chatId: '100', title: '+7900', messages: [], unread: 0 }])
  })

  it('does not duplicate a chat opened twice', () => {
    const again = chatsReducer(opened, { type: 'chatOpened', chatId: '100', title: 'other' })
    expect(again.chats).toHaveLength(1)
    expect(again.chats[0].title).toBe('+7900')
  })

  it('closes the active chat without removing it', () => {
    const closed = chatsReducer(opened, { type: 'chatClosed' })
    expect(closed.activeChatId).toBeNull()
    expect(closed.chats).toHaveLength(1)
  })

  it('adds a message once even if it is delivered twice', () => {
    const action = { type: 'messageAdded', chatId: '100', message: incoming('m1') } as const
    const state = chatsReducer(chatsReducer(opened, action), action)
    expect(state.chats[0].messages).toHaveLength(1)
  })

  it('creates a chat for a message from an unknown sender and counts it as unread', () => {
    const state = chatsReducer(opened, {
      type: 'messageAdded',
      chatId: '200',
      title: 'Иван',
      message: incoming('m2'),
    })
    expect(state.chats.map((chat) => chat.chatId)).toEqual(['200', '100'])
    expect(state.chats[0]).toMatchObject({ title: 'Иван', unread: 1 })
    expect(state.activeChatId).toBe('100')
  })

  it('does not count messages in the active chat as unread and clears unread on select', () => {
    const active = chatsReducer(opened, {
      type: 'messageAdded',
      chatId: '100',
      message: incoming('m1'),
    })
    expect(active.chats[0].unread).toBe(0)

    const other = chatsReducer(active, {
      type: 'messageAdded',
      chatId: '200',
      message: incoming('m2'),
    })
    const selected = chatsReducer(other, { type: 'chatSelected', chatId: '200' })
    expect(selected.chats.find((chat) => chat.chatId === '200')?.unread).toBe(0)
  })

  it('appends chats loaded from the server without duplicating open ones', () => {
    const state = chatsReducer(opened, {
      type: 'chatsLoaded',
      chats: [
        { chatId: '100', name: 'Василиса', phoneNumber: 7900 },
        { chatId: '200', name: 'Иван', phoneNumber: 0 },
        { chatId: '300', name: '', phoneNumber: 79001112233 },
        { chatId: '-400', name: '', phoneNumber: 0 },
      ],
    })
    expect(state.chats.map((chat) => [chat.chatId, chat.title])).toEqual([
      ['100', '+7900'],
      ['200', 'Иван'],
      ['300', '+79001112233'],
      ['-400', '-400'],
    ])
    expect(state.activeChatId).toBe('100')
  })

  it('merges text history in chronological order without duplicates', () => {
    const live = chatsReducer(opened, {
      type: 'messageAdded',
      chatId: '100',
      message: { id: 'h2', text: 'из очереди', timestamp: 2000, outgoing: false },
    })
    const state = chatsReducer(live, {
      type: 'historyLoaded',
      chatId: '100',
      history: [
        {
          type: 'outgoing',
          idMessage: 'h3',
          timestamp: 3,
          typeMessage: 'textMessage',
          textMessage: 'третье',
        },
        {
          type: 'incoming',
          idMessage: 'h2',
          timestamp: 2,
          typeMessage: 'textMessage',
          textMessage: 'из истории',
        },
        { type: 'incoming', idMessage: 'img', timestamp: 2, typeMessage: 'imageMessage' },
        {
          type: 'incoming',
          idMessage: 'h4',
          timestamp: 4,
          typeMessage: 'extendedTextMessage',
          textMessage: 'https://green-api.com',
        },
        {
          type: 'incoming',
          idMessage: 'h1',
          timestamp: 1,
          typeMessage: 'textMessage',
          textMessage: 'первое',
        },
      ],
    })
    expect(state.chats[0].messages).toEqual([
      { id: 'h1', text: 'первое', timestamp: 1000, outgoing: false },
      { id: 'h2', text: 'из очереди', timestamp: 2000, outgoing: false },
      { id: 'h3', text: 'третье', timestamp: 3000, outgoing: true },
      { id: 'h4', text: 'https://green-api.com', timestamp: 4000, outgoing: false },
    ])
    expect(state.chats[0].unread).toBe(0)
  })
})

describe('sending a message', () => {
  const sending = chatsReducer(opened, {
    type: 'messageAdded',
    chatId: '100',
    message: { id: 'local', text: 'Привет', timestamp: 1, outgoing: true, status: 'sending' },
  })
  const messages = (state: typeof sending) => state.chats[0].messages

  it('replaces the local message with the sent one', () => {
    const state = chatsReducer(sending, {
      type: 'messageSent',
      chatId: '100',
      localId: 'local',
      id: '42',
    })
    expect(messages(state)).toEqual([{ id: '42', text: 'Привет', timestamp: 1, outgoing: true }])
  })

  const notification = {
    type: 'messageAdded',
    chatId: '100',
    message: { id: '42', text: 'Привет', timestamp: 2, outgoing: true },
  } as const

  it('keeps the message in place when the notification arrives before the response', () => {
    const second = chatsReducer(sending, {
      type: 'messageAdded',
      chatId: '100',
      message: { id: 'local-2', text: 'Пока', timestamp: 3, outgoing: true, status: 'sending' },
    })
    const notified = chatsReducer(second, notification)
    expect(messages(notified).map((message) => message.id)).toEqual(['42', 'local-2'])

    const state = chatsReducer(notified, {
      type: 'messageSent',
      chatId: '100',
      localId: 'local',
      id: '42',
    })
    expect(messages(state).map((message) => message.id)).toEqual(['42', 'local-2'])
  })

  it('does not report a failure for a message that was delivered anyway', () => {
    const state = chatsReducer(chatsReducer(sending, notification), {
      type: 'messageFailed',
      chatId: '100',
      localId: 'local',
      error: 'Не удалось связаться с GREEN-API',
    })
    expect(messages(state)).toEqual([notification.message])
  })

  it('marks a failed message and moves it to the end on retry', () => {
    const failed = chatsReducer(sending, {
      type: 'messageFailed',
      chatId: '100',
      localId: 'local',
      error: 'Ошибка 500',
    })
    expect(messages(failed)[0]).toMatchObject({ status: 'failed', error: 'Ошибка 500' })

    const answered = chatsReducer(failed, {
      type: 'messageAdded',
      chatId: '100',
      message: { id: 'in', text: 'Ответ', timestamp: 5, outgoing: false },
    })
    const retried = chatsReducer(answered, {
      type: 'messageRetried',
      chatId: '100',
      localId: 'local',
      timestamp: 9,
    })
    expect(messages(retried)).toEqual([
      { id: 'in', text: 'Ответ', timestamp: 5, outgoing: false },
      { id: 'local', text: 'Привет', timestamp: 9, outgoing: true, status: 'sending' },
    ])
  })

  it('leaves a failed message alone when the same text is sent again', () => {
    const failed = chatsReducer(sending, {
      type: 'messageFailed',
      chatId: '100',
      localId: 'local',
      error: 'Ошибка 500',
    })
    const resent = chatsReducer(failed, {
      type: 'messageAdded',
      chatId: '100',
      message: { id: 'local-2', text: 'Привет', timestamp: 3, outgoing: true, status: 'sending' },
    })
    const state = chatsReducer(resent, notification)
    expect(messages(state).map((message) => message.id)).toEqual(['local', '42'])
  })
})
