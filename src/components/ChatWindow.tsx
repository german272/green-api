import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type UIEvent,
} from 'react'
import type { Chat, Message } from '../state/chats'
import { formatTime } from '../utils/formatTime'
import { Avatar } from './Avatar'
import { BackIcon, ClockIcon, SendIcon } from './icons'

const MAX_MESSAGE_LENGTH = 4096
const BOTTOM_THRESHOLD_PX = 80

interface Props {
  chat: Chat
  onSend: (text: string) => void
  onRetry: (message: Message) => void
  onBack: () => void
}

export function ChatWindow({ chat, onSend, onRetry, onBack }: Props) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const pinnedToBottom = useRef(true)
  const messageCount = useRef(0)

  useEffect(() => {
    const list = listRef.current
    const sentNewMessage =
      chat.messages.length > messageCount.current && chat.messages.at(-1)?.outgoing
    messageCount.current = chat.messages.length

    if (list && (pinnedToBottom.current || sentNewMessage)) {
      list.scrollTop = list.scrollHeight
    }
  }, [chat.messages])

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget
    pinnedToBottom.current = scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD_PX
  }

  function send() {
    const message = text.trim()
    if (!message) return
    onSend(message)
    setText('')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    send()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <>
      <header className="chat-header">
        <button
          className="icon-button chat-header__back"
          type="button"
          onClick={onBack}
          aria-label="Назад"
        >
          <BackIcon />
        </button>
        <Avatar seed={chat.chatId} name={chat.title} />
        <span className="chat-header__title">{chat.title}</span>
      </header>

      <div className="messages" ref={listRef} onScroll={handleScroll}>
        <div className="messages__inner">
          {chat.messages.map((message) => (
            <MessageBubble key={message.id} message={message} onRetry={() => onRetry(message)} />
          ))}
        </div>
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          className="composer__input"
          rows={1}
          placeholder="Сообщение"
          aria-label="Сообщение"
          maxLength={MAX_MESSAGE_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button
          className="icon-button icon-button--primary"
          type="submit"
          disabled={!text.trim()}
          aria-label="Отправить"
        >
          <SendIcon />
        </button>
      </form>
    </>
  )
}

function MessageBubble({ message, onRetry }: { message: Message; onRetry: () => void }) {
  return (
    <div className={message.outgoing ? 'bubble bubble--out' : 'bubble bubble--in'}>
      <span className="bubble__text">{message.text}</span>
      <span className="bubble__meta">
        {message.status === 'sending' ? (
          <ClockIcon size={14} />
        ) : (
          <time dateTime={new Date(message.timestamp).toISOString()}>
            {formatTime(message.timestamp)}
          </time>
        )}
      </span>
      {message.status === 'failed' && (
        <span className="bubble__failure" role="alert">
          Не отправлено: {message.error}
          <button type="button" onClick={onRetry}>
            Повторить
          </button>
        </span>
      )}
    </div>
  )
}
