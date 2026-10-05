import { afterEach, expect, it, vi } from 'vitest'
import { formatChatDate } from './formatTime'

afterEach(() => vi.useRealTimers())

it('shows the time for today and the date for older messages', () => {
  vi.useFakeTimers({ now: new Date(2026, 9, 4, 18, 0) })

  expect(formatChatDate(new Date(2026, 9, 4, 9, 5).getTime())).toBe('09:05')
  expect(formatChatDate(new Date(2026, 9, 3, 23, 59).getTime())).toBe('03.10')
})
