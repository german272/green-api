import { useEffect, useReducer, useRef, useState } from 'react'
import { errorMessage, type GreenApi } from '../api/greenApi'
import { chatsReducer, initialChatsState, notificationToAction, type Message } from '../state/chats'
import { useNotifications } from './useNotifications'

export function useChats(api: GreenApi) {
  const [state, dispatch] = useReducer(chatsReducer, initialChatsState)
  const [chatsError, setChatsError] = useState<string | null>(null)
  const [historyErrors, setHistoryErrors] = useState<Record<string, string | undefined>>({})
  const historyRequested = useRef(new Set<string>())
  const lastLocalId = useRef(0)

  const receiveError = useNotifications(api, (body) => {
    const action = notificationToAction(body)
    if (action) dispatch(action)
  })

  useEffect(() => {
    let ignore = false
    api
      .getChats()
      .then((chats) => {
        if (!ignore) dispatch({ type: 'chatsLoaded', chats })
      })
      .catch((cause: unknown) => {
        if (!ignore) setChatsError(errorMessage(cause))
      })
    return () => {
      ignore = true
    }
  }, [api])

  async function loadHistory(chatId: string) {
    if (historyRequested.current.has(chatId)) return
    historyRequested.current.add(chatId)
    setHistoryErrors((errors) => ({ ...errors, [chatId]: undefined }))

    try {
      const history = await api.getChatHistory(chatId)
      dispatch({ type: 'historyLoaded', chatId, history })
    } catch (cause) {
      historyRequested.current.delete(chatId)
      setHistoryErrors((errors) => ({ ...errors, [chatId]: errorMessage(cause) }))
    }
  }

  async function deliver(chatId: string, localId: string, text: string) {
    try {
      const { idMessage } = await api.sendMessage(chatId, text)
      dispatch({ type: 'messageSent', chatId, localId, id: idMessage })
    } catch (cause) {
      dispatch({ type: 'messageFailed', chatId, localId, error: errorMessage(cause) })
    }
  }

  const activeChat = state.chats.find((chat) => chat.chatId === state.activeChatId)
  const historyError = activeChat && historyErrors[activeChat.chatId]

  const errors: string[] = []
  if (receiveError) errors.push(`Не удаётся получить сообщения: ${receiveError}`)
  if (chatsError) errors.push(`Не удалось загрузить чаты: ${chatsError}`)
  if (historyError) errors.push(`Не удалось загрузить историю: ${historyError}`)

  return {
    chats: state.chats,
    activeChat,
    errors,

    async startChat(phoneNumber: string) {
      const account = await api.checkAccount(phoneNumber)
      if (!account.exist || !account.chatId) {
        throw new Error('Telegram на этом номере не найден или номер скрыт')
      }
      dispatch({ type: 'chatOpened', chatId: account.chatId, title: `+${phoneNumber}` })
      void loadHistory(account.chatId)
    },

    selectChat(chatId: string) {
      dispatch({ type: 'chatSelected', chatId })
      void loadHistory(chatId)
    },

    closeChat() {
      dispatch({ type: 'chatClosed' })
    },

    sendMessage(chatId: string, text: string) {
      const localId = `local-${++lastLocalId.current}`
      dispatch({
        type: 'messageAdded',
        chatId,
        message: { id: localId, text, timestamp: Date.now(), outgoing: true, status: 'sending' },
      })
      void deliver(chatId, localId, text)
    },

    retryMessage(chatId: string, message: Message) {
      dispatch({ type: 'messageRetried', chatId, localId: message.id, timestamp: Date.now() })
      void deliver(chatId, message.id, message.text)
    },
  }
}
