import { useMemo } from 'react'
import { createGreenApi, type Credentials } from '../api/greenApi'
import { useChats } from '../hooks/useChats'
import { useReceivingSetup } from '../hooks/useReceivingSetup'
import { ChatWindow } from './ChatWindow'
import { Sidebar } from './Sidebar'

interface Props {
  credentials: Credentials
  onLogout: () => void
}

export function ChatScreen({ credentials, onLogout }: Props) {
  const api = useMemo(() => createGreenApi(credentials), [credentials])
  const { chats, activeChat, errors, startChat, selectChat, closeChat, sendMessage, retryMessage } =
    useChats(api)
  const receiving = useReceivingSetup(api)
  const banners = receiving.error ? [...errors, receiving.error] : errors

  return (
    <div className={activeChat ? 'app app--chat-open' : 'app'}>
      {banners.map((error) => (
        <p key={error} className="banner" role="alert">
          {error}
        </p>
      ))}
      {(receiving.status === 'disabled' || receiving.status === 'saving') && (
        <p className="banner banner--warning">
          Входящие сообщения не приходят: в настройках инстанса выключены уведомления о входящих или
          задан webhookUrl. Кнопка включит уведомления и очистит webhookUrl.
          <button
            className="banner__action"
            type="button"
            onClick={receiving.enable}
            disabled={receiving.status === 'saving'}
          >
            {receiving.status === 'saving' ? 'Сохраняем…' : 'Включить'}
          </button>
        </p>
      )}
      {receiving.status === 'saved' && (
        <p className="banner banner--warning">
          Настройки сохранены. Инстанс перезапускается, входящие начнут приходить в течение пяти
          минут.
        </p>
      )}

      <div className="app__main">
        <Sidebar
          chats={chats}
          activeChatId={activeChat?.chatId}
          onStartChat={startChat}
          onSelect={selectChat}
          onLogout={onLogout}
        />
        <section className="content">
          {activeChat ? (
            <ChatWindow
              key={activeChat.chatId}
              chat={activeChat}
              onSend={(text) => sendMessage(activeChat.chatId, text)}
              onRetry={(message) => retryMessage(activeChat.chatId, message)}
              onBack={closeChat}
            />
          ) : (
            <p className="content__empty">Выберите чат или введите номер телефона</p>
          )}
        </section>
      </div>
    </div>
  )
}
