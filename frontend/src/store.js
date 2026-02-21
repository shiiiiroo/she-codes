import { create } from 'zustand'
import dayjs from 'dayjs'

export const useStore = create((set, get) => ({
  // Calendar state
  view: 'week',           // 'day' | 'week' | 'month' | 'year'
  currentDate: dayjs().format('YYYY-MM-DD'),

  setView: (view) => set({ view }),
  setDate: (date) => set({ currentDate: date }),
  goToday: () => set({ currentDate: dayjs().format('YYYY-MM-DD') }),

  navigateDate: (direction) => {
    const { view, currentDate } = get()
    const d = dayjs(currentDate)
    const unitMap = { day: 'day', week: 'week', month: 'month', year: 'year' }
    const unit = unitMap[view] || 'week'
    const newDate = direction === 'next' ? d.add(1, unit) : d.subtract(1, unit)
    set({ currentDate: newDate.format('YYYY-MM-DD') })
  },

  // Tasks
  tasks: [],
  unsortedTasks: [],
  overdueTasks: [],
  setTasks: (tasks) => set({ tasks }),
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

  // AI state
  isAiTyping: false,
  setAiTyping: (v) => set({ isAiTyping: v }),

  // UI
  showAddForm: false,
  setShowAddForm: (v) => set({ showAddForm: v }),
  selectedTask: null,
  setSelectedTask: (t) => set({ selectedTask: t }),
}))
