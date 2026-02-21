import { create } from 'zustand'
import dayjs from 'dayjs'

export const useStore = create((set, get) => ({
  // Calendar
  view: 'week',
  currentDate: dayjs().format('YYYY-MM-DD'),
  setView: (view) => set({ view }),
  setDate: (date) => set({ currentDate: date }),
  goToday: () => set({ currentDate: dayjs().format('YYYY-MM-DD') }),
  navigateDate: (direction) => {
    const { view, currentDate } = get()
    const d = dayjs(currentDate)
    const unitMap = { day: 'day', week: 'week', month: 'month', year: 'year' }
    const unit = unitMap[view] || 'week'
    set({ currentDate: (direction === 'next' ? d.add(1, unit) : d.subtract(1, unit)).format('YYYY-MM-DD') })
  },

  // Tasks
  tasks: [],
  undatedTasks: [],
  unsortedTasks: [],
  overdueTasks: [],
  setTasks: (tasks) => set({ tasks }),
  setUndatedTasks: (t) => set({ undatedTasks: t }),
  setUnsortedTasks: (t) => set({ unsortedTasks: t }),
  setOverdueTasks: (t) => set({ overdueTasks: t }),

  // Tips
  tips: [],
  loadInfo: null,
  setTips: (tips) => set({ tips }),
  setLoadInfo: (info) => set({ loadInfo: info }),

  // Chat
  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  isAiTyping: false,
  setAiTyping: (v) => set({ isAiTyping: v }),
}))
