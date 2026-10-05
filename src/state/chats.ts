import type { ChatInfo, HistoryMessage, NotificationBody } from '../api/greenApi'

export interface Message {
  id: string
  text: string
  timestamp: number
  outgoing: boolean
  status?: 'sending' | 'failed'
  error?: string
}

export interface Chat {
  chatId: string
  title: string
  messages: Message[]
  unread: number
}

export interface ChatsState {
  chats: Chat[]
  activeChatId: string | null
}

export type ChatsAction =
  | { type: 'chatOpened'; chatId: string; title: string }
  | { type: 'chatSelected'; chatId: string }
  | { type: 'chatClosed' }
  | { type: 'chatsLoaded'; chats: ChatInfo[] }
  | { type: 'historyLoaded'; chatId: string; history: HistoryMessage[] }
  | { type: 'messageAdded'; chatId: string; title?: string; message: Message }
  | { type: 'messageSent'; chatId: string; localId: string; id: string }
  | { type: 'messageFailed'; chatId: string; localId: string; error: string }
  | { type: 'messageRetried'; chatId: string; localId: string; timestamp: number }

export const initialChatsState: ChatsState = { chats: [], activeChatId: null }

export function chatsReducer(state: ChatsState, action: ChatsAction): ChatsState {
  switch (action.type) {
    case 'chatOpened': {
      const exists = state.chats.some((chat) => chat.chatId === action.chatId)
      const chats = exists
        ? state.chats
        : [{ chatId: action.chatId, title: action.title, messages: [], unread: 0 }, ...state.chats]
      return selectChat({ ...state, chats }, action.chatId)
    }
    case 'chatSelected':
      return selectChat(state, action.chatId)
    case 'chatClosed':
      return { ...state, activeChatId: null }
    case 'chatsLoaded': {
      const known = new Set(state.chats.map((chat) => chat.chatId))
      const loaded = action.chats
        .filter((info) => !known.has(info.chatId))
        .map((info) => ({ chatId: info.chatId, title: chatTitle(info), messages: [], unread: 0 }))
      return { ...state, chats: [...state.chats, ...loaded] }
    }
    case 'historyLoaded':
      return updateMessages(state, action.chatId, (messages) =>
        mergeHistory(messages, action.history),
      )
    case 'messageSent':
      return updateMessages(state, action.chatId, (messages) =>
        messages.some((message) => message.id === action.id)
          ? messages.filter((message) => message.id !== action.localId)
          : messages.map((message) =>
              message.id === action.localId
                ? {
                    id: action.id,
                    text: message.text,
                    timestamp: message.timestamp,
                    outgoing: true,
                  }
                : message,
            ),
      )
    case 'messageFailed':
      return updateMessages(state, action.chatId, (messages) =>
        messages.map((message) =>
          message.id === action.localId
            ? { ...message, status: 'failed', error: action.error }
            : message,
        ),
      )
    case 'messageRetried':
      return updateMessages(state, action.chatId, (messages) => {
        const failed = messages.find((message) => message.id === action.localId)
        if (!failed) return messages
        return [
          ...messages.filter((message) => message !== failed),
          { ...failed, status: 'sending', error: undefined, timestamp: action.timestamp },
        ]
      })
    case 'messageAdded': {
      const { chatId, message } = action
      const existing = state.chats.find((chat) => chat.chatId === chatId)
      const messages = existing?.messages ?? []
      if (messages.some((item) => item.id === message.id)) return state

      const local =
        message.outgoing && !message.status
          ? messages.find((item) => item.status === 'sending' && item.text === message.text)
          : undefined

      const isUnread = !message.outgoing && chatId !== state.activeChatId
      const updated: Chat = {
        chatId,
        title: existing?.title ?? action.title ?? chatId,
        messages: local
          ? messages.map((item) => (item === local ? message : item))
          : [...messages, message],
        unread: (existing?.unread ?? 0) + (isUnread ? 1 : 0),
      }
      return {
        ...state,
        chats: [updated, ...state.chats.filter((chat) => chat.chatId !== chatId)],
      }
    }
  }
}

function selectChat(state: ChatsState, chatId: string): ChatsState {
  return {
    activeChatId: chatId,
    chats: state.chats.map((chat) => (chat.chatId === chatId ? { ...chat, unread: 0 } : chat)),
  }
}

function updateMessages(
  state: ChatsState,
  chatId: string,
  update: (messages: Message[]) => Message[],
): ChatsState {
  return {
    ...state,
    chats: state.chats.map((chat) =>
      chat.chatId === chatId ? { ...chat, messages: update(chat.messages) } : chat,
    ),
  }
}

function chatTitle({ chatId, name, phoneNumber }: ChatInfo): string {
  if (name) return name
  return phoneNumber ? `+${phoneNumber}` : chatId
}

function mergeHistory(current: Message[], history: HistoryMessage[]): Message[] {
  const known = new Set(current.map((message) => message.id))
  const loaded = history
    .filter((item) => item.textMessage && !known.has(item.idMessage))
    .map((item) => ({
      id: item.idMessage,
      text: item.textMessage!,
      timestamp: item.timestamp * 1000,
      outgoing: item.type === 'outgoing',
    }))
  return [...current, ...loaded].sort((a, b) => a.timestamp - b.timestamp)
}

const OUTGOING_WEBHOOKS = ['outgoingMessageReceived', 'outgoingAPIMessageReceived']

export function notificationToAction(body: NotificationBody): ChatsAction | null {
  const outgoing = OUTGOING_WEBHOOKS.includes(body.typeWebhook)
  if (!outgoing && body.typeWebhook !== 'incomingMessageReceived') return null

  const text =
    body.messageData?.textMessageData?.textMessage ??
    body.messageData?.extendedTextMessageData?.text
  if (!text || !body.idMessage || !body.senderData) return null

  return {
    type: 'messageAdded',
    chatId: body.senderData.chatId,
    title: body.senderData.chatName,
    message: { id: body.idMessage, text, timestamp: body.timestamp * 1000, outgoing },
  }
}
