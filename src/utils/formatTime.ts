const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const date = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' })

export function formatTime(timestamp: number): string {
  return time.format(timestamp)
}

export function formatChatDate(timestamp: number): string {
  const isToday = new Date(timestamp).toDateString() === new Date().toDateString()
  return isToday ? time.format(timestamp) : date.format(timestamp)
}
