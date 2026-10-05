import { useState, type FormEvent } from 'react'
import { errorMessage } from '../api/greenApi'
import type { Chat } from '../state/chats'
import { formatChatDate } from '../utils/formatTime'
import { Avatar } from './Avatar'
import { PlusIcon } from './icons'

interface Props {
  chats: Chat[]
  activeChatId?: string
  onStartChat: (phoneNumber: string) => Promise<void>
  onSelect: (chatId: string) => void
  onLogout: () => void
}

export function Sidebar({ chats, activeChatId, onStartChat, onSelect, onLogout }: Props) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) {
      setError('Введите номер в международном формате')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await onStartChat(digits)
      setPhone('')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="sidebar">
      <form className="sidebar__new" onSubmit={handleSubmit}>
        <input
          className="field field--round"
          type="tel"
          placeholder="Номер телефона"
          aria-label="Номер телефона получателя"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <button className="icon-button" type="submit" disabled={loading} aria-label="Создать чат">
          <PlusIcon size={22} />
        </button>
      </form>
      {error && (
        <p className="error sidebar__error" role="alert">
          {error}
        </p>
      )}

      <ul className="chat-list">
        {chats.map((chat) => {
          const last = chat.messages.at(-1)
          return (
            <li key={chat.chatId}>
              <button
                type="button"
                className={
                  chat.chatId === activeChatId ? 'chat-item chat-item--active' : 'chat-item'
                }
                onClick={() => onSelect(chat.chatId)}
              >
                <Avatar seed={chat.chatId} name={chat.title} />
                <span className="chat-item__body">
                  <span className="chat-item__row">
                    <span className="chat-item__title">{chat.title}</span>
                    {last && (
                      <span className="chat-item__time">{formatChatDate(last.timestamp)}</span>
                    )}
                  </span>
                  <span className="chat-item__row">
                    <span className="chat-item__preview">{last?.text}</span>
                    {chat.unread > 0 && <span className="chat-item__badge">{chat.unread}</span>}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <button className="sidebar__logout" type="button" onClick={onLogout}>
        Выйти
      </button>
    </aside>
  )
}
